import { ToolError } from '../../shared/errors';
import type { DecodedImage, HeicDecoder } from './heic-types';

/**
 * Client-side browser-compatible HEIC decoder implementation wrapping heic-to (libheif/WASM).
 * Uses lazy dynamic import so the libheif decoder is only loaded when HEIC conversion is invoked.
 */
export class BrowserHeicDecoder implements HeicDecoder {
  private heicModule: typeof import('heic-to') | null = null;
  private isInitializing = false;
  private initPromise: Promise<typeof import('heic-to')> | null = null;

  /**
   * Lazily loads the heic-to module and caches the instance for reuse across batches.
   */
  private async getModule(): Promise<typeof import('heic-to')> {
    if (this.heicModule) {
      return this.heicModule;
    }

    if (this.initPromise) {
      return this.initPromise;
    }

    this.isInitializing = true;
    this.initPromise = (async () => {
      try {
        const mod = await import('heic-to');
        this.heicModule = mod;
        return mod;
      } catch {
        throw new ToolError(
          'PROCESSING_FAILED',
          "We couldn't load the HEIC converter. Please try again."
        );
      } finally {
        this.isInitializing = false;
      }
    })();

    return this.initPromise;
  }

  /**
   * Decodes a HEIC file/blob into a strongly-typed internal DecodedImage representation.
   */
  async decode(file: File | Blob): Promise<DecodedImage> {
    try {
      const { heicTo } = await this.getModule();
      
      // If ImageBitmap is supported, attempt bitmap decoding first
      if (typeof createImageBitmap === 'function') {
        try {
          const bitmap = await heicTo({
            blob: file,
            type: 'bitmap',
          });

          return {
            width: bitmap.width,
            height: bitmap.height,
            imageBitmap: bitmap,
          };
        } catch {
          // If bitmap mode failed, fall back to decoding via standard blob route
        }
      }

      // Convert to temporary high-quality image blob and decode via HTML Image
      const intermediateBlob = await heicTo({
        blob: file,
        type: 'image/jpeg',
        quality: 1.0,
      });

      if (typeof createImageBitmap === 'function') {
        const bitmap = await createImageBitmap(intermediateBlob);
        return {
          width: bitmap.width,
          height: bitmap.height,
          imageBitmap: bitmap,
        };
      }

      // DOM fallback for image dimensions
      return new Promise<DecodedImage>((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(intermediateBlob);
        img.onload = () => {
          URL.revokeObjectURL(url);
          resolve({
            width: img.naturalWidth || img.width,
            height: img.naturalHeight || img.height,
          });
        };
        img.onerror = () => {
          URL.revokeObjectURL(url);
          reject(new ToolError('INVALID_FILE', 'This file is not a valid HEIC image.'));
        };
        img.src = url;
      });
    } catch (err: unknown) {
      if (err instanceof ToolError) {
        throw err;
      }
      const msg = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
      if (msg.includes('memory') || msg.includes('quota') || msg.includes('out of memory')) {
        throw new ToolError(
          'BROWSER_MEMORY_ERROR',
          'This image is too large for your browser to process.'
        );
      }
      if (msg.includes('not supported') || msg.includes('load') || msg.includes('worker')) {
        throw new ToolError(
          'PROCESSING_FAILED',
          "We couldn't load the HEIC converter. Please try again."
        );
      }
      throw new ToolError('INVALID_FILE', 'This file is not a valid HEIC image.');
    }
  }

  /**
   * Decodes and encodes HEIC directly to a JPG Blob at specified quality.
   */
  async decodeToJpegBlob(file: File | Blob, quality: number = 0.9): Promise<Blob> {
    try {
      const { heicTo } = await this.getModule();
      const clampedQuality = Math.max(0.1, Math.min(1.0, quality));

      const blob = await heicTo({
        blob: file,
        type: 'image/jpeg',
        quality: clampedQuality,
      });

      if (!blob || blob.size <= 0) {
        throw new ToolError('PROCESSING_FAILED', "We couldn't convert this HEIC image. Please try again.");
      }

      return blob;
    } catch (err: unknown) {
      if (err instanceof ToolError) {
        throw err;
      }
      const msg = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
      if (msg.includes('memory') || msg.includes('quota') || msg.includes('out of memory')) {
        throw new ToolError(
          'BROWSER_MEMORY_ERROR',
          'This image is too large for your browser to process.'
        );
      }
      if (msg.includes('worker') || msg.includes('decoder') || msg.includes('load')) {
        throw new ToolError(
          'PROCESSING_FAILED',
          "We couldn't load the HEIC converter. Please try again."
        );
      }
      throw new ToolError('INVALID_FILE', 'This file is not a valid HEIC image.');
    }
  }
}

export const defaultHeicDecoder = new BrowserHeicDecoder();
