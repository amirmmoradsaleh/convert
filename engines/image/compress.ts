import { ToolError } from '../shared/errors';
import {
  validateCompressibleImageFile,
  validateMagicBytes,
  COMPRESS_IMAGE_LIMITS,
} from '../shared/validation';
import { imageWorkerClient } from './worker/worker-client';
import type { ImageWorkerRequest, WorkerProgressStage } from './worker/worker-types';

export interface ImageCompressOptions {
  quality?: number; // 0.1 to 1.0 (default: 0.8)
}

export interface CompressImageResult {
  blob: Blob;
  fileName: string;
  format: 'jpg' | 'png' | 'webp';
  width: number;
  height: number;
  originalSize: number;
  convertedSize: number;
  savedBytes: number;
  savedPercentage: number;
  noSizeReduction: boolean;
}

export type CompressResult = CompressImageResult;

/**
 * Compresses an image (JPG, PNG, or WebP) client-side in the browser while preserving
 * the original format, pixel dimensions, and transparency.
 */
export async function compressImage(
  file: File,
  options: ImageCompressOptions = {},
  onProgress?: (progress: number, stage?: WorkerProgressStage) => void
): Promise<CompressImageResult> {
  // 1. Initial Validation Pipeline (Size -> Ext -> MIME -> Binary Signature -> Animated WebP check)
  onProgress?.(10, 'validating');
  const validation = await validateCompressibleImageFile(file);
  if (!validation.valid && validation.error) {
    throw validation.error;
  }

  // 2. Read File Data
  onProgress?.(25, 'reading');
  const buffer = await file.arrayBuffer();

  const taskId =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `task_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  const quality = typeof options.quality === 'number' ? Math.max(0.1, Math.min(1.0, options.quality)) : 0.8;

  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  const sourceFormat =
    ext === 'png' || file.type === 'image/png'
      ? 'png'
      : ext === 'webp' || file.type === 'image/webp'
      ? 'webp'
      : 'jpg';

  const defaultInputMime =
    sourceFormat === 'webp' ? 'image/webp' : sourceFormat === 'png' ? 'image/png' : 'image/jpeg';

  const request: ImageWorkerRequest = {
    id: taskId,
    operation: 'compress',
    fileData: buffer,
    fileName: file.name,
    mimeType: file.type || defaultInputMime,
    options: {
      sourceFormat,
      quality,
    },
  };

  // 3. Process via Image Worker with fallback
  const response = await imageWorkerClient.executeTask(request, (stage, percent) => {
    onProgress?.(percent, stage);
  });

  if (!response.success || !response.resultData) {
    const code = response.errorCode || 'PROCESSING_FAILED';
    const message = response.error || "We couldn't compress this image. Please try again.";
    throw new ToolError(code, message);
  }

  const resultMime =
    sourceFormat === 'webp' ? 'image/webp' : sourceFormat === 'png' ? 'image/png' : 'image/jpeg';
  const resultBlob = new Blob([response.resultData], { type: response.resultMime || resultMime });

  // 4. Output verification & Signature validation
  if (resultBlob.size <= 0) {
    throw new ToolError('PROCESSING_FAILED', "We couldn't compress this image. Please try again.");
  }

  if (sourceFormat === 'jpg') {
    const magicCheck = await validateMagicBytes(resultBlob, 'jpeg');
    if (!magicCheck.valid) {
      throw new ToolError('PROCESSING_FAILED', "We couldn't compress this JPEG image. Please try again.");
    }
  } else if (sourceFormat === 'png') {
    const magicCheck = await validateMagicBytes(resultBlob, 'png');
    if (!magicCheck.valid) {
      throw new ToolError('PROCESSING_FAILED', "We couldn't compress this PNG image. Please try again.");
    }
  } else if (sourceFormat === 'webp') {
    const magicCheck = await validateMagicBytes(resultBlob, 'webp');
    if (!magicCheck.valid) {
      throw new ToolError('PROCESSING_FAILED', "We couldn't compress this WebP image. Please try again.");
    }
  }

  const originalSize = response.originalSize || file.size;
  const convertedSize = response.convertedSize || resultBlob.size;
  const savedBytes = Math.max(0, originalSize - convertedSize);
  const savedPercentage = convertedSize < originalSize ? ((originalSize - convertedSize) / originalSize) * 100 : 0;
  const noSizeReduction = convertedSize >= originalSize;

  return {
    blob: resultBlob,
    fileName: response.fileName || file.name,
    format: sourceFormat,
    width: response.width || 0,
    height: response.height || 0,
    originalSize,
    convertedSize,
    savedBytes,
    savedPercentage,
    noSizeReduction,
  };
}

/**
 * Estimates the compressed size for an image at a given quality setting.
 * Performs a fast, non-blocking measurement in the worker and supports AbortSignal.
 */
export async function estimateCompressedSize(
  file: File,
  quality: number,
  signal?: AbortSignal
): Promise<{ estimatedSize: number; isEstimate: boolean }> {
  if (signal?.aborted) {
    throw new DOMException('Aborted', 'AbortError');
  }

  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  const isPng = ext === 'png' || file.type === 'image/png';

  // For PNG, canvas encoding does not use lossy quality.
  // We can quickly return the original size or pre-measure once.
  if (isPng) {
    return { estimatedSize: file.size, isEstimate: false };
  }

  // Check file size limit
  if (file.size > COMPRESS_IMAGE_LIMITS.MAX_FILE_SIZE_BYTES) {
    return { estimatedSize: file.size, isEstimate: true };
  }

  try {
    const buffer = await file.arrayBuffer();
    if (signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }

    const taskId = `est_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const sourceFormat = ext === 'webp' || file.type === 'image/webp' ? 'webp' : 'jpg';

    const request: ImageWorkerRequest = {
      id: taskId,
      operation: 'compress',
      fileData: buffer,
      fileName: file.name,
      mimeType: file.type || (sourceFormat === 'webp' ? 'image/webp' : 'image/jpeg'),
      options: {
        sourceFormat,
        quality: Math.max(0.1, Math.min(1.0, quality > 1 ? quality / 100 : quality)),
      },
    };

    const response = await imageWorkerClient.executeTask(request);
    if (signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }

    if (response.success && typeof response.convertedSize === 'number' && response.convertedSize > 0) {
      return {
        estimatedSize: response.convertedSize,
        isEstimate: true,
      };
    }

    return { estimatedSize: file.size, isEstimate: true };
  } catch (err: unknown) {
    if (signal?.aborted || (err instanceof DOMException && err.name === 'AbortError')) {
      throw new DOMException('Aborted', 'AbortError');
    }
    return { estimatedSize: file.size, isEstimate: true };
  }
}
