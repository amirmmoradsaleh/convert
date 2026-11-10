import { ToolError } from '../../shared/errors';
import { validateBmpFile } from './bmp-validator';
import type { BmpDecodeResult, BmpDecoderOptions } from './bmp-types';
import type { WorkerProgressStage } from '../worker/worker-types';
import { hasPngMagicBytes } from '../../shared/validation';

/**
 * Decodes a BMP file into a high-fidelity PNG blob client-side in the browser.
 * Uses browser-native image decoding (createImageBitmap / Canvas) with full dimension preservation.
 */
export async function decodeBmpToPng(
  file: File,
  fileName?: string,
  onProgress?: (progress: number, stage?: WorkerProgressStage) => void,
  options?: BmpDecoderOptions
): Promise<BmpDecodeResult> {
  // 1. Validation Stage (0 - 20%)
  onProgress?.(10, 'validating');
  const validation = await validateBmpFile(file);
  if (!validation.valid && validation.error) {
    throw validation.error;
  }

  // 2. Reading Stage (20 - 40%)
  onProgress?.(30, 'reading');
  const blob = file;

  // 3. Decoding Stage (40 - 65%)
  onProgress?.(50, 'decoding');
  let bitmap: ImageBitmap | null = null;
  let decodedImgEl: HTMLImageElement | null = null;
  let objectUrlToRevoke: string | null = null;

  try {
    if (typeof createImageBitmap === 'function') {
      try {
        bitmap = await createImageBitmap(blob);
      } catch {
        // Fallback to Image element in DOM contexts
      }
    }

    if (!bitmap && typeof document !== 'undefined') {
      // DOM image fallback
      objectUrlToRevoke = URL.createObjectURL(blob);
      const img = new Image();
      img.src = objectUrlToRevoke;
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () =>
          reject(
            new ToolError(
              'PROCESSING_FAILED',
              "We couldn't decode this BMP image. Please try another BMP file."
            )
          );
      });
      decodedImgEl = img;
    }

    if (!bitmap && !decodedImgEl) {
      throw new ToolError(
        'PROCESSING_FAILED',
        "We couldn't decode this BMP image. Please try another BMP file."
      );
    }

    const sourceWidth = bitmap ? bitmap.width : decodedImgEl!.naturalWidth || decodedImgEl!.width;
    const sourceHeight = bitmap ? bitmap.height : decodedImgEl!.naturalHeight || decodedImgEl!.height;

    if (!sourceWidth || !sourceHeight || sourceWidth <= 0 || sourceHeight <= 0) {
      throw new ToolError('INVALID_FILE', 'This file is not a valid BMP image.');
    }

    if (sourceWidth > 8192 || sourceHeight > 8192) {
      throw new ToolError(
        'BROWSER_MEMORY_ERROR',
        'This BMP is too large to process in your browser.'
      );
    }

    const targetWidth = options?.maxWidth ? Math.min(sourceWidth, options.maxWidth) : sourceWidth;
    const targetHeight = options?.maxHeight ? Math.min(sourceHeight, options.maxHeight) : sourceHeight;

    // 4. Rendering Stage (65 - 85%)
    onProgress?.(70, 'encoding');

    let pngBlob: Blob | null = null;

    if (typeof OffscreenCanvas !== 'undefined') {
      const canvas = new OffscreenCanvas(targetWidth, targetHeight);
      const ctx = canvas.getContext('2d', { alpha: true });
      if (!ctx) {
        throw new ToolError('PROCESSING_FAILED', "We couldn't convert this BMP. Please try again.");
      }

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      if (bitmap) {
        ctx.drawImage(bitmap, 0, 0, targetWidth, targetHeight);
      } else if (decodedImgEl) {
        ctx.drawImage(decodedImgEl, 0, 0, targetWidth, targetHeight);
      }

      // 5. Encoding Stage (85 - 95%)
      onProgress?.(85, 'encoding');
      pngBlob = await canvas.convertToBlob({ type: 'image/png' });
    } else if (typeof document !== 'undefined') {
      const canvas = document.createElement('canvas');
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      const ctx = canvas.getContext('2d', { alpha: true });
      if (!ctx) {
        throw new ToolError('PROCESSING_FAILED', "We couldn't convert this BMP. Please try again.");
      }

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      if (bitmap) {
        ctx.drawImage(bitmap, 0, 0, targetWidth, targetHeight);
      } else if (decodedImgEl) {
        ctx.drawImage(decodedImgEl, 0, 0, targetWidth, targetHeight);
      }

      onProgress?.(85, 'encoding');
      pngBlob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob((b) => resolve(b), 'image/png');
      });
    }

    // 6. Finalizing & Verification Stage (95 - 100%)
    onProgress?.(95, 'finalizing');

    if (!pngBlob || pngBlob.type !== 'image/png' || pngBlob.size <= 0) {
      throw new ToolError(
        'UNSUPPORTED_FORMAT',
        'Your browser could not create a PNG image. Please try another browser.'
      );
    }

    const pngHeaderBuffer = await pngBlob.slice(0, 8).arrayBuffer();
    if (!hasPngMagicBytes(new Uint8Array(pngHeaderBuffer))) {
      throw new ToolError(
        'PROCESSING_FAILED',
        "We couldn't convert this BMP. Please try again."
      );
    }

    // Output filename
    const resolvedName = fileName || file.name;
    const lastDot = resolvedName.lastIndexOf('.');
    const stem = lastDot === -1 ? resolvedName : resolvedName.substring(0, lastDot);
    const outFileName = `${stem}.png`;

    onProgress?.(100, 'finalizing');

    return {
      blob: pngBlob,
      fileName: outFileName,
      originalSize: file.size,
      convertedSize: pngBlob.size,
      width: targetWidth,
      height: targetHeight,
      isTopDown: validation.dimensions?.isTopDown ?? false,
    };
  } finally {
    if (bitmap) {
      try {
        bitmap.close();
      } catch {
        // Ignored close error
      }
    }
    if (objectUrlToRevoke) {
      URL.revokeObjectURL(objectUrlToRevoke);
    }
  }
}
