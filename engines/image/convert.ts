import { ToolError } from '../shared/errors';
import {
  validateJpegFile,
  validatePngFile,
  validateWebpFile,
  validateHeicFile,
  validateGifFile,
  validateBmpFile,
  validateMagicBytes,
} from '../shared/validation';
import { rasterizeSvgToPng } from './svg/svg-rasterizer';
import { decodeGifFirstFrameToPng } from './gif/gif-decoder';
import { decodeBmpToPng } from './bmp/bmp-decoder';
import { imageWorkerClient } from './worker/worker-client';
import type { ImageWorkerRequest, WorkerProgressStage } from './worker/worker-types';

export interface ImageConvertOptions {
  targetFormat: 'png' | 'jpg' | 'webp';
  sourceFormat?: 'png' | 'jpg' | 'webp' | 'heic' | 'gif' | 'bmp';
  quality?: number; // 0.1 to 1.0
  backgroundColor?: string;
}

export interface PngToJpgOptions {
  quality?: number; // 0.7, 0.8, 0.9 (default: 0.9)
  backgroundColor?: string; // '#FFFFFF' (default) or '#000000'
}

export interface JpgToWebpOptions {
  quality?: number; // 0.7, 0.8, 0.9 (default: 0.9)
}

export interface WebpToJpgOptions {
  quality?: number; // 0.7, 0.8, 0.9 (default: 0.9)
  backgroundColor?: string; // '#FFFFFF' (default) or '#000000'
}

export interface PngToWebpOptions {
  quality?: number; // 0.7, 0.8, 0.9 (default: 0.9)
}

export interface HeicToJpgOptions {
  quality?: number; // 0.7, 0.8, 0.9 (default: 0.9)
}

export interface ImageProcessingResult {
  blob: Blob;
  fileName: string;
  width: number;
  height: number;
  originalSize: number;
  convertedSize: number;
}

/**
 * Converts a JPEG file into a PNG entirely client-side in the browser.
 * Preserves dimensions, handles orientation, and validates magic bytes.
 */
export async function convertJpgToPng(
  file: File,
  onProgress?: (progress: number, stage?: WorkerProgressStage) => void
): Promise<ImageProcessingResult> {
  return convertImage(file, { targetFormat: 'png' }, onProgress);
}

/**
 * Converts a PNG file into a JPG entirely client-side in the browser.
 * Handles solid background compositing for transparency and adjustable JPEG quality.
 */
export async function convertPngToJpg(
  file: File,
  options: PngToJpgOptions = {},
  onProgress?: (progress: number, stage?: WorkerProgressStage) => void
): Promise<ImageProcessingResult> {
  return convertImage(
    file,
    {
      sourceFormat: 'png',
      targetFormat: 'jpg',
      quality: options.quality ?? 0.9,
      backgroundColor: options.backgroundColor ?? '#FFFFFF',
    },
    onProgress
  );
}

/**
 * Converts a JPEG file into a WebP entirely client-side in the browser.
 * Preserves original dimensions, handles orientation, and validates WebP output.
 */
export async function convertJpgToWebp(
  file: File,
  options: JpgToWebpOptions = {},
  onProgress?: (progress: number, stage?: WorkerProgressStage) => void
): Promise<ImageProcessingResult> {
  return convertImage(
    file,
    {
      sourceFormat: 'jpg',
      targetFormat: 'webp',
      quality: options.quality ?? 0.9,
    },
    onProgress
  );
}

/**
 * Converts a WebP file into a JPG entirely client-side in the browser.
 * Handles solid background compositing for transparency and adjustable JPEG quality.
 */
export async function convertWebpToJpg(
  file: File,
  options: WebpToJpgOptions = {},
  onProgress?: (progress: number, stage?: WorkerProgressStage) => void
): Promise<ImageProcessingResult> {
  return convertImage(
    file,
    {
      sourceFormat: 'webp',
      targetFormat: 'jpg',
      quality: options.quality ?? 0.9,
      backgroundColor: options.backgroundColor ?? '#FFFFFF',
    },
    onProgress
  );
}

/**
 * Converts a PNG file into a WebP entirely client-side in the browser.
 * Preserves transparency (alpha channel), original dimensions, and handles adjustable quality.
 */
export async function convertPngToWebp(
  file: File,
  options: PngToWebpOptions = {},
  onProgress?: (progress: number, stage?: WorkerProgressStage) => void
): Promise<ImageProcessingResult> {
  return convertImage(
    file,
    {
      sourceFormat: 'png',
      targetFormat: 'webp',
      quality: options.quality ?? 0.9,
    },
    onProgress
  );
}

/**
 * Converts a WebP file into a PNG entirely client-side in the browser.
 * Preserves full alpha channel transparency and original image dimensions.
 */
export async function convertWebpToPng(
  file: File,
  onProgress?: (progress: number, stage?: WorkerProgressStage) => void
): Promise<ImageProcessingResult> {
  return convertImage(
    file,
    {
      sourceFormat: 'webp',
      targetFormat: 'png',
    },
    onProgress
  );
}

/**
 * Converts a HEIC file into a JPG entirely client-side in the browser using libheif/WASM.
 * Preserves original dimensions, normalizes errors, and validates JPEG output integrity.
 */
export async function convertHeicToJpg(
  file: File,
  options: HeicToJpgOptions = {},
  onProgress?: (progress: number, stage?: WorkerProgressStage) => void
): Promise<ImageProcessingResult> {
  // 1. Initial Validation Pipeline (Size -> Ext -> MIME -> ftyp brand)
  onProgress?.(10, 'validating');
  const validation = await validateHeicFile(file);
  if (!validation.valid && validation.error) {
    throw validation.error;
  }

  // 2. Reading Stage
  onProgress?.(25, 'reading');

  // 3. Decoding Stage (Lazy loading HEIC decoder)
  onProgress?.(45, 'decoding');
  const { defaultHeicDecoder } = await import('./heic');

  // 4. Encoding Stage
  onProgress?.(75, 'encoding');
  const quality = options.quality ?? 0.9;
  const jpegBlob = await defaultHeicDecoder.decodeToJpegBlob(file, quality);

  // 5. Finalizing Stage
  onProgress?.(95, 'finalizing');

  // Explicit verification of JPEG output
  if (!jpegBlob || jpegBlob.type !== 'image/jpeg' || jpegBlob.size <= 0) {
    throw new ToolError(
      'UNSUPPORTED_FORMAT',
      'Your browser could not create a JPG image. Please try another browser.'
    );
  }

  const magicCheck = await validateMagicBytes(jpegBlob, 'jpeg');
  if (!magicCheck.valid) {
    throw new ToolError(
      'PROCESSING_FAILED',
      "We couldn't convert this HEIC image. Please try again."
    );
  }

  // Output filename
  const lastDot = file.name.lastIndexOf('.');
  const stem = lastDot === -1 ? file.name : file.name.substring(0, lastDot);
  const outFileName = `${stem}.jpg`;

  // Get image dimensions
  let width = 0;
  let height = 0;
  if (typeof createImageBitmap === 'function') {
    try {
      const bmp = await createImageBitmap(jpegBlob);
      width = bmp.width;
      height = bmp.height;
      bmp.close();
    } catch {
      // Ignored
    }
  }

  onProgress?.(100, 'finalizing');

  return {
    blob: jpegBlob,
    fileName: outFileName,
    width,
    height,
    originalSize: file.size,
    convertedSize: jpegBlob.size,
  };
}

/**
 * Converts an SVG file into a PNG entirely client-side in the browser.
 * Validates XML safety, dimensions/viewBox, renders via canvas, and verifies output PNG signature.
 */
export async function convertSvgToPng(
  file: File,
  onProgress?: (progress: number, stage?: WorkerProgressStage) => void
): Promise<ImageProcessingResult> {
  return rasterizeSvgToPng(file, file.name, onProgress);
}

/**
 * Converts a GIF file (first frame) into a PNG entirely client-side in the browser.
 * Extracts frame 0 deterministically, preserves alpha transparency, and verifies output PNG signature.
 */
export async function convertGifToPng(
  file: File,
  onProgress?: (progress: number, stage?: WorkerProgressStage) => void
): Promise<ImageProcessingResult> {
  return decodeGifFirstFrameToPng(file, file.name, onProgress);
}

/**
 * Converts a BMP file into a PNG entirely client-side in the browser.
 * Uses browser-native decoding, preserves dimensions, handles top-down/bottom-up BMPs, and verifies output PNG signature.
 */
export async function convertBmpToPng(
  file: File,
  onProgress?: (progress: number, stage?: WorkerProgressStage) => void
): Promise<ImageProcessingResult> {
  return decodeBmpToPng(file, file.name, onProgress);
}

/**
 * Image conversion engine coordinating validation, workers, and encoding.
 */
export async function convertImage(
  file: File,
  options: ImageConvertOptions,
  onProgress?: (progress: number, stage?: WorkerProgressStage) => void
): Promise<ImageProcessingResult> {
  // 1. Initial Validation Pipeline (Size -> Ext -> MIME -> Magic Bytes)
  const isBmpSource =
    options.sourceFormat === 'bmp' ||
    file.name.toLowerCase().endsWith('.bmp') ||
    file.type === 'image/bmp';
  const isGifSource =
    !isBmpSource &&
    (options.sourceFormat === 'gif' ||
      file.name.toLowerCase().endsWith('.gif') ||
      file.type === 'image/gif');
  const isWebpSource =
    !isBmpSource &&
    !isGifSource &&
    (options.sourceFormat === 'webp' ||
      file.name.toLowerCase().endsWith('.webp') ||
      file.type === 'image/webp');
  const isPngSource =
    !isBmpSource &&
    !isGifSource &&
    !isWebpSource &&
    (options.sourceFormat === 'png' ||
      (!isWebpSource &&
        (file.name.toLowerCase().endsWith('.png') ||
          file.type === 'image/png' ||
          options.targetFormat === 'jpg')));

  if (isBmpSource) {
    onProgress?.(10, 'validating');
    const validation = await validateBmpFile(file);
    if (!validation.valid && validation.error) {
      throw validation.error;
    }
  } else if (isGifSource) {
    onProgress?.(10, 'validating');
    const validation = await validateGifFile(file);
    if (!validation.valid && validation.error) {
      throw validation.error;
    }
  } else if (isWebpSource) {
    onProgress?.(10, 'validating');
    const validation = await validateWebpFile(file);
    if (!validation.valid && validation.error) {
      throw validation.error;
    }
  } else if (isPngSource) {
    onProgress?.(10, 'validating');
    const validation = await validatePngFile(file);
    if (!validation.valid && validation.error) {
      throw validation.error;
    }
  } else {
    onProgress?.(10, 'validating');
    const validation = await validateJpegFile(file);
    if (!validation.valid && validation.error) {
      throw validation.error;
    }
  }

  // 2. Read File Data
  onProgress?.(25, 'reading');
  const buffer = await file.arrayBuffer();

  const taskId =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `task_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  const defaultInputMime = isBmpSource
    ? 'image/bmp'
    : isGifSource
    ? 'image/gif'
    : isWebpSource
    ? 'image/webp'
    : isPngSource
    ? 'image/png'
    : 'image/jpeg';

  const request: ImageWorkerRequest = {
    id: taskId,
    operation: 'convert',
    fileData: buffer,
    fileName: file.name,
    mimeType: file.type || defaultInputMime,
    options: {
      targetFormat: options.targetFormat,
      sourceFormat:
        options.sourceFormat ||
        (isBmpSource ? 'bmp' : isGifSource ? 'gif' : isWebpSource ? 'webp' : isPngSource ? 'png' : 'jpg'),
      quality: options.quality,
      backgroundColor: options.backgroundColor,
    },
  };

  // 3. Process via Image Worker with fallback
  const response = await imageWorkerClient.executeTask(request, (stage, percent) => {
    onProgress?.(percent, stage);
  });

  if (!response.success || !response.resultData) {
    const code = response.errorCode || 'PROCESSING_FAILED';
    const message = response.error || "We couldn't convert this image. Please try again.";
    throw new ToolError(code, message);
  }

  const defaultMime =
    options.targetFormat === 'webp'
      ? 'image/webp'
      : options.targetFormat === 'jpg'
      ? 'image/jpeg'
      : 'image/png';
  const resultBlob = new Blob([response.resultData], { type: response.resultMime || defaultMime });

  // Explicit verification for WebP output to prevent accidental PNG or JPEG fallback
  if (
    options.targetFormat === 'webp' &&
    (response.resultMime !== 'image/webp' || resultBlob.type !== 'image/webp' || resultBlob.size <= 0)
  ) {
    throw new ToolError(
      'UNSUPPORTED_FORMAT',
      'Your browser could not create a WebP image. Please try another browser.'
    );
  }

  // Explicit verification for JPEG output to prevent accidental PNG or WebP fallback
  if (
    options.targetFormat === 'jpg' &&
    (response.resultMime !== 'image/jpeg' || resultBlob.type !== 'image/jpeg' || resultBlob.size <= 0)
  ) {
    throw new ToolError(
      'UNSUPPORTED_FORMAT',
      'Your browser could not create a JPG image. Please try another browser.'
    );
  }

  // Explicit verification for PNG output to prevent accidental JPEG or WebP fallback
  if (
    options.targetFormat === 'png' &&
    (response.resultMime !== 'image/png' || resultBlob.type !== 'image/png' || resultBlob.size <= 0)
  ) {
    throw new ToolError(
      'UNSUPPORTED_FORMAT',
      'Your browser could not create a PNG image. Please try another browser.'
    );
  }

  const fallbackFileName =
    options.targetFormat === 'webp'
      ? file.name.replace(/\.(jpe?g|png)$/i, '.webp')
      : options.targetFormat === 'jpg'
      ? file.name.replace(/\.(webp|png)$/i, '.jpg')
      : file.name.replace(/\.(jpe?g|webp)$/i, '.png');

  return {
    blob: resultBlob,
    fileName: response.fileName || fallbackFileName,
    width: response.width || 0,
    height: response.height || 0,
    originalSize: response.originalSize || file.size,
    convertedSize: response.convertedSize || resultBlob.size,
  };
}

