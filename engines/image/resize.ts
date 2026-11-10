import { ToolError } from '../shared/errors';
import {
  validateCompressibleImageFile,
  validateMagicBytes,
  isAnimatedWebp,
} from '../shared/validation';
import { imageWorkerClient } from './worker/worker-client';
import type { ImageWorkerRequest, WorkerProgressStage } from './worker/worker-types';

export interface ImageResizeOptions {
  width: number;
  height: number;
  outputFormat?: 'original' | 'jpg' | 'png' | 'webp';
  quality?: number; // 0.1 to 1.0 (default: 0.9)
}

export interface ResizeImageResult {
  blob: Blob;
  fileName: string;
  format: 'jpg' | 'png' | 'webp';
  width: number;
  height: number;
  originalSize: number;
  convertedSize: number;
}

const RESIZE_LIMITS = {
  MAX_DIMENSION: 8192,
  MAX_PIXELS: 67108864, // 8192 * 8192
};

/**
  * Resizes an image (JPG, PNG, or WebP) client-side in the browser.
  */
export async function resizeImage(
  file: File,
  options: ImageResizeOptions,
  onProgress?: (progress: number, stage?: WorkerProgressStage) => void
): Promise<ResizeImageResult> {
  // 1. Initial Validation Pipeline (Size -> Ext -> MIME -> Binary Signature -> Animated WebP check)
  onProgress?.(10, 'validating');
  const validation = await validateCompressibleImageFile(file);
  if (!validation.valid && validation.error) {
    throw validation.error;
  }

  // Check animated WebP specifically for resize
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  if (ext === 'webp' && isAnimatedWebp(bytes)) {
    throw new ToolError('UNSUPPORTED_FORMAT', 'Animated WebP files are not supported by this resize tool.');
  }

  // 2. Validate Target Dimensions
  const targetWidth = Math.round(Number(options.width));
  const targetHeight = Math.round(Number(options.height));

  if (
    isNaN(targetWidth) ||
    isNaN(targetHeight) ||
    targetWidth <= 0 ||
    targetHeight <= 0 ||
    !Number.isFinite(targetWidth) ||
    !Number.isFinite(targetHeight)
  ) {
    throw new ToolError('INVALID_FILE', 'Please enter valid image dimensions.');
  }

  if (targetWidth > RESIZE_LIMITS.MAX_DIMENSION || targetHeight > RESIZE_LIMITS.MAX_DIMENSION) {
    throw new ToolError('INVALID_FILE', 'The selected dimensions are too large to process in your browser.');
  }

  if (targetWidth * targetHeight > RESIZE_LIMITS.MAX_PIXELS) {
    throw new ToolError('INVALID_FILE', 'This image is too large for your browser to process.');
  }

  // 3. Read & Prepare Worker Request
  onProgress?.(25, 'reading');

  const taskId =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `task_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  const sourceFormat =
    ext === 'png' || file.type === 'image/png'
      ? 'png'
      : ext === 'webp' || file.type === 'image/webp'
      ? 'webp'
      : 'jpg';

  const outputFormat = options.outputFormat || 'original';
  const quality = typeof options.quality === 'number' ? Math.max(0.1, Math.min(1.0, options.quality)) : 0.9;

  const request: ImageWorkerRequest = {
    id: taskId,
    operation: 'resize',
    fileData: buffer,
    fileName: file.name,
    mimeType: file.type || (sourceFormat === 'webp' ? 'image/webp' : sourceFormat === 'png' ? 'image/png' : 'image/jpeg'),
    options: {
      sourceFormat,
      targetFormat: outputFormat === 'original' ? undefined : outputFormat,
      width: targetWidth,
      height: targetHeight,
      quality,
    },
  };

  // 4. Process via Image Worker with fallback
  const response = await imageWorkerClient.executeTask(request, (stage, percent) => {
    onProgress?.(percent, stage);
  });

  if (!response.success || !response.resultData) {
    const code = response.errorCode || 'PROCESSING_FAILED';
    const message = response.error || "We couldn't resize this image. Please try again.";
    throw new ToolError(code, message);
  }

  const finalFormat: 'jpg' | 'png' | 'webp' =
    outputFormat === 'original'
      ? sourceFormat
      : outputFormat;

  const resultMime =
    finalFormat === 'webp' ? 'image/webp' : finalFormat === 'jpg' ? 'image/jpeg' : 'image/png';
  const resultBlob = new Blob([response.resultData], { type: response.resultMime || resultMime });

  if (resultBlob.size <= 0) {
    throw new ToolError('PROCESSING_FAILED', "We couldn't resize this image. Please try again.");
  }

  // 5. Output Verification & Signature Validation
  if (finalFormat === 'jpg') {
    const magicCheck = await validateMagicBytes(resultBlob, 'jpeg');
    if (!magicCheck.valid) {
      throw new ToolError('PROCESSING_FAILED', "We couldn't resize this JPEG image. Please try again.");
    }
  } else if (finalFormat === 'png') {
    const magicCheck = await validateMagicBytes(resultBlob, 'png');
    if (!magicCheck.valid) {
      throw new ToolError('PROCESSING_FAILED', "We couldn't resize this PNG image. Please try again.");
    }
  } else if (finalFormat === 'webp') {
    const magicCheck = await validateMagicBytes(resultBlob, 'webp');
    if (!magicCheck.valid) {
      throw new ToolError('PROCESSING_FAILED', "We couldn't resize this WebP image. Please try again.");
    }
  }

  const originalSize = file.size;
  const convertedSize = resultBlob.size;

  const lastDot = file.name.lastIndexOf('.');
  const stem = lastDot === -1 ? file.name : file.name.substring(0, lastDot);
  const outExtension = finalFormat === 'jpg' ? 'jpg' : finalFormat === 'webp' ? 'webp' : 'png';
  const outFileName = `${stem}.${outExtension}`;

  return {
    blob: resultBlob,
    fileName: outFileName,
    format: finalFormat,
    width: response.width || targetWidth,
    height: response.height || targetHeight,
    originalSize,
    convertedSize,
  };
}
