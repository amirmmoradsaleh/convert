import { ToolError } from '../../shared/errors';
import { hasPngMagicBytes } from '../../shared/validation';
import { validateGifFile, GIF_LIMITS } from './gif-validator';
import type { GifDecodeResult } from './gif-types';

/**
 * Decodes the first rendered frame of a GIF file and encodes it into a standard PNG blob.
 * Preserves alpha transparency, enforces 8192px raster boundaries, and thoroughly cleans up
 * all decoder, ImageBitmap, canvas, and Object URL resources.
 */
export async function decodeGifFirstFrameToPng(
  gifSource: File | Blob | ArrayBuffer,
  fileName = 'image.gif',
  onProgress?: (progress: number, stage?: 'validating' | 'reading' | 'decoding' | 'encoding' | 'finalizing') => void
): Promise<GifDecodeResult> {
  // 1. Validating Stage (0 - 15%)
  onProgress?.(10, 'validating');

  let fileBlob: Blob;
  let fileBuffer: ArrayBuffer;
  let originalSize: number;

  if (gifSource instanceof File) {
    const val = await validateGifFile(gifSource);
    if (!val.valid && val.error) {
      throw val.error;
    }
    fileBlob = gifSource;
    originalSize = gifSource.size;
    onProgress?.(25, 'reading');
    fileBuffer = await gifSource.arrayBuffer();
  } else if (gifSource instanceof Blob) {
    fileBlob = gifSource;
    originalSize = gifSource.size;
    onProgress?.(25, 'reading');
    fileBuffer = await gifSource.arrayBuffer();
  } else {
    fileBuffer = gifSource;
    originalSize = gifSource.byteLength;
    fileBlob = new Blob([gifSource], { type: 'image/gif' });
  }

  // 2. Decoding First Frame Stage (30 - 65%)
  onProgress?.(45, 'decoding');

  let width = 0;
  let height = 0;
  let canvas: OffscreenCanvas | HTMLCanvasElement | null = null;
  let ctx: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D | null = null;
  let isAnimated = false;

  // Strategy A: ImageDecoder API (WebCodecs) - deterministic frameIndex: 0 extraction
  let decodedViaImageDecoder = false;
  if (typeof ImageDecoder !== 'undefined') {
    let decoder: ImageDecoder | null = null;
    let videoFrame: VideoFrame | null = null;
    try {
      decoder = new ImageDecoder({
        data: fileBuffer,
        type: 'image/gif',
      });

      // Check tracks/animation
      if (decoder.tracks && decoder.tracks.selectedTrack) {
        isAnimated = decoder.tracks.selectedTrack.frameCount > 1;
      }

      const decoded = await decoder.decode({ frameIndex: 0 });
      videoFrame = decoded.image;

      width = videoFrame.displayWidth || videoFrame.codedWidth;
      height = videoFrame.displayHeight || videoFrame.codedHeight;

      if (width <= 0 || height <= 0) {
        throw new ToolError('INVALID_FILE', 'This file is not a valid GIF image.');
      }

      if (width > GIF_LIMITS.MAX_DIMENSION || height > GIF_LIMITS.MAX_DIMENSION) {
        throw new ToolError('BROWSER_MEMORY_ERROR', 'This GIF is too large to process in your browser.');
      }

      // Initialize canvas
      if (typeof OffscreenCanvas !== 'undefined') {
        canvas = new OffscreenCanvas(width, height);
        ctx = canvas.getContext('2d');
      } else if (typeof document !== 'undefined') {
        const domCanvas = document.createElement('canvas');
        domCanvas.width = width;
        domCanvas.height = height;
        canvas = domCanvas;
        ctx = domCanvas.getContext('2d');
      }

      if (!ctx || !canvas) {
        throw new ToolError('PROCESSING_FAILED', "We couldn't convert this GIF. Please try again.");
      }

      // Draw VideoFrame (preserving transparency)
      ctx.drawImage(videoFrame as unknown as CanvasImageSource, 0, 0, width, height);
      decodedViaImageDecoder = true;
    } catch (err) {
      if (err instanceof ToolError) {
        throw err;
      }
      // If ImageDecoder fails, allow falling back to Strategy B / C
      decodedViaImageDecoder = false;
    } finally {
      if (videoFrame) {
        try {
          videoFrame.close();
        } catch {
          // Ignored
        }
      }
      if (decoder) {
        try {
          decoder.close();
        } catch {
          // Ignored
        }
      }
    }
  }

  // Strategy B: createImageBitmap (browser native frame 0 decoder)
  if (!decodedViaImageDecoder && typeof createImageBitmap === 'function') {
    let bitmap: ImageBitmap | null = null;
    try {
      bitmap = await createImageBitmap(fileBlob);
      width = bitmap.width;
      height = bitmap.height;

      if (width <= 0 || height <= 0) {
        throw new ToolError('INVALID_FILE', 'This file is not a valid GIF image.');
      }

      if (width > GIF_LIMITS.MAX_DIMENSION || height > GIF_LIMITS.MAX_DIMENSION) {
        throw new ToolError('BROWSER_MEMORY_ERROR', 'This GIF is too large to process in your browser.');
      }

      if (typeof OffscreenCanvas !== 'undefined') {
        canvas = new OffscreenCanvas(width, height);
        ctx = canvas.getContext('2d');
      } else if (typeof document !== 'undefined') {
        const domCanvas = document.createElement('canvas');
        domCanvas.width = width;
        domCanvas.height = height;
        canvas = domCanvas;
        ctx = domCanvas.getContext('2d');
      }

      if (!ctx || !canvas) {
        throw new ToolError('PROCESSING_FAILED', "We couldn't convert this GIF. Please try again.");
      }

      ctx.drawImage(bitmap, 0, 0, width, height);
    } catch (err) {
      if (err instanceof ToolError) {
        throw err;
      }
      const msg = err instanceof Error ? err.message.toLowerCase() : '';
      if (msg.includes('memory') || msg.includes('quota')) {
        throw new ToolError('BROWSER_MEMORY_ERROR', 'This image is too large for your browser to process.');
      }
      // If createImageBitmap fails and we are in a browser DOM environment, try Strategy C
      if (typeof document === 'undefined') {
        throw new ToolError('PROCESSING_FAILED', "We couldn't decode this GIF. Please try another file.");
      }
    } finally {
      if (bitmap) {
        try {
          bitmap.close();
        } catch {
          // Ignored
        }
      }
    }
  }

  // Strategy C: HTMLImageElement fallback (for DOM environments)
  if (!canvas && typeof document !== 'undefined') {
    let objectUrl = '';
    try {
      objectUrl = URL.createObjectURL(fileBlob);
      const img = new Image();
      img.decoding = 'sync';
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new ToolError('PROCESSING_FAILED', "We couldn't decode this GIF. Please try another file."));
        img.src = objectUrl;
      });

      width = img.naturalWidth || img.width;
      height = img.naturalHeight || img.height;

      if (width <= 0 || height <= 0) {
        throw new ToolError('INVALID_FILE', 'This file is not a valid GIF image.');
      }

      if (width > GIF_LIMITS.MAX_DIMENSION || height > GIF_LIMITS.MAX_DIMENSION) {
        throw new ToolError('BROWSER_MEMORY_ERROR', 'This GIF is too large to process in your browser.');
      }

      const domCanvas = document.createElement('canvas');
      domCanvas.width = width;
      domCanvas.height = height;
      canvas = domCanvas;
      ctx = domCanvas.getContext('2d');

      if (!ctx) {
        throw new ToolError('PROCESSING_FAILED', "We couldn't convert this GIF. Please try again.");
      }

      ctx.drawImage(img, 0, 0, width, height);
    } finally {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    }
  }

  if (!canvas || !ctx || width <= 0 || height <= 0) {
    throw new ToolError('PROCESSING_FAILED', "We couldn't decode this GIF. Please try another file.");
  }

  // 3. Encoding PNG Stage (70 - 90%)
  onProgress?.(75, 'encoding');
  onProgress?.(85, 'encoding');

  let pngBlob: Blob;
  if ('convertToBlob' in canvas && typeof canvas.convertToBlob === 'function') {
    pngBlob = await canvas.convertToBlob({ type: 'image/png' });
  } else if ('toBlob' in canvas && typeof canvas.toBlob === 'function') {
    pngBlob = await new Promise<Blob>((resolve, reject) => {
      (canvas as HTMLCanvasElement).toBlob((b) => {
        if (b) resolve(b);
        else reject(new ToolError('UNSUPPORTED_FORMAT', 'Your browser could not create a PNG image. Please try another browser.'));
      }, 'image/png');
    });
  } else {
    throw new ToolError('PROCESSING_FAILED', 'Image canvas encoding is not supported in this runtime.');
  }

  // 4. Verification of Output Integrity (95 - 100%)
  onProgress?.(95, 'finalizing');

  if (!pngBlob || pngBlob.type !== 'image/png' || pngBlob.size <= 0) {
    throw new ToolError('UNSUPPORTED_FORMAT', 'Your browser could not create a PNG image. Please try another browser.');
  }

  const pngBuffer = await pngBlob.arrayBuffer();
  if (!hasPngMagicBytes(pngBuffer)) {
    throw new ToolError('PROCESSING_FAILED', 'Invalid PNG signature detected in generated file.');
  }

  onProgress?.(100, 'finalizing');

  const pngFileName = (gifSource instanceof File ? gifSource.name : fileName).replace(/\.gif$/i, '') + '.png';

  return {
    blob: pngBlob,
    fileName: pngFileName,
    convertedSize: pngBlob.size,
    width,
    height,
    originalSize,
    isAnimated,
  };
}
