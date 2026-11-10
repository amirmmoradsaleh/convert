import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import { convertWebpToJpg } from '../../engines/image/convert';
import { processImageJob } from '../../engines/image/worker/image.worker';
import { ImageWorkerRequest } from '../../engines/image/worker/worker-types';
import {
  validateWebpFile,
  hasWebpMagicBytes,
  validateFileCount,
  VALIDATION_LIMITS,
} from '../../engines/shared/validation';
import { createZipBlob, generateUniqueFilename } from '../../engines/shared/file-utils';

// Polyfill ImageBitmap and OffscreenCanvas for Node test environment
class MockImageBitmap {
  width: number;
  height: number;
  isClosed = false;

  constructor(w = 1920, h = 1080) {
    this.width = w;
    this.height = h;
  }

  close() {
    this.isClosed = true;
    this.width = 0;
    this.height = 0;
  }
}

class MockOffscreenCanvas {
  width: number;
  height: number;
  drawnOperations: Array<{ type: string; color?: string; x?: number; y?: number; w?: number; h?: number }> = [];

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
  }

  getContext(type: string) {
    if (type === '2d') {
      const ops = this.drawnOperations;
      return {
        fillStyle: '#FFFFFF',
        fillRect(x: number, y: number, w: number, h: number) {
          ops.push({ type: 'fillRect', color: this.fillStyle, x, y, w, h });
        },
        drawImage(_bitmap: unknown, x: number, y: number) {
          ops.push({ type: 'drawImage', x, y });
        },
      };
    }
    return null;
  }

  async convertToBlob(options?: { type?: string; quality?: number }) {
    if (options?.type === 'image/jpeg') {
      // JPEG signature: FF D8 FF E0 00 10 4A 46 49 46
      const jpegHeader = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
      return new Blob([jpegHeader], { type: 'image/jpeg' });
    }
    const webpHeader = new Uint8Array([
      0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
    ]);
    return new Blob([webpHeader], { type: options?.type || 'image/webp' });
  }
}

beforeAll(() => {
  if (typeof globalThis.OffscreenCanvas === 'undefined') {
    // @ts-expect-error polyfill for testing
    globalThis.OffscreenCanvas = MockOffscreenCanvas;
  }

  if (typeof globalThis.createImageBitmap === 'undefined') {
    // @ts-expect-error polyfill for testing
    globalThis.createImageBitmap = async (source: Blob) => {
      const buffer = await source.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      const isWebp =
        bytes.length >= 12 &&
        bytes[0] === 0x52 &&
        bytes[1] === 0x49 &&
        bytes[2] === 0x46 &&
        bytes[3] === 0x46 &&
        bytes[8] === 0x57 &&
        bytes[9] === 0x45 &&
        bytes[10] === 0x42 &&
        bytes[11] === 0x50;

      if (!isWebp) {
        throw new Error('Invalid image data');
      }
      if (bytes.length < 20) {
        throw new Error('Corrupted image stream');
      }
      return new MockImageBitmap(1280, 720) as unknown as ImageBitmap;
    };
  }
});

describe('WEBP to JPG Conversion Engine & Validation', () => {
  const fixturesDir = path.join(process.cwd(), 'tests/fixtures');
  const validWebpBuffer = fs.readFileSync(path.join(fixturesDir, 'sample.webp'));
  const transparentWebpBuffer = fs.readFileSync(path.join(fixturesDir, 'transparent.webp'));
  const corruptWebpBuffer = fs.readFileSync(path.join(fixturesDir, 'corrupted.webp'));
  const invalidWebpBuffer = fs.readFileSync(path.join(fixturesDir, 'invalid.webp'));

  describe('1. WebP Container and Magic Byte Validation', () => {
    it('identifies valid WebP RIFF container (RIFF at 0-3, WEBP at 8-11)', () => {
      expect(hasWebpMagicBytes(validWebpBuffer)).toBe(true);
      expect(hasWebpMagicBytes(transparentWebpBuffer)).toBe(true);
    });

    it('rejects buffers missing RIFF or WEBP signatures', () => {
      expect(hasWebpMagicBytes(invalidWebpBuffer)).toBe(false);

      // Truncated buffer
      const shortBuffer = new Uint8Array([0x52, 0x49, 0x46, 0x46]);
      expect(hasWebpMagicBytes(shortBuffer)).toBe(false);

      // JPEG buffer
      const jpegBuffer = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
      expect(hasWebpMagicBytes(jpegBuffer)).toBe(false);

      // PNG buffer
      const pngBuffer = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
      expect(hasWebpMagicBytes(pngBuffer)).toBe(false);
    });

    it('validates a proper WebP File object successfully', async () => {
      const file = new File([validWebpBuffer], 'sample.webp', { type: 'image/webp' });
      const result = await validateWebpFile(file);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('rejects non-WebP file extension', async () => {
      const file = new File([validWebpBuffer], 'sample.png', { type: 'image/webp' });
      const result = await validateWebpFile(file);
      expect(result.valid).toBe(false);
      expect(result.error?.code).toBe('UNSUPPORTED_FORMAT');
    });

    it('rejects invalid file content with .webp extension', async () => {
      const file = new File([invalidWebpBuffer], 'fake.webp', { type: 'image/webp' });
      const result = await validateWebpFile(file);
      expect(result.valid).toBe(false);
      expect(result.error?.code).toBe('INVALID_FILE');
    });

    it('rejects files larger than 50 MB limit', async () => {
      // Mock an oversized File object
      const oversizedBlob = new Blob([new Uint8Array(100)]);
      Object.defineProperty(oversizedBlob, 'size', {
        value: VALIDATION_LIMITS.MAX_IMAGE_SIZE_BYTES + 1024,
      });
      const file = new File([oversizedBlob], 'large.webp', { type: 'image/webp' });
      Object.defineProperty(file, 'size', {
        value: VALIDATION_LIMITS.MAX_IMAGE_SIZE_BYTES + 1024,
      });

      const result = await validateWebpFile(file);
      expect(result.valid).toBe(false);
      expect(result.error?.code).toBe('FILE_TOO_LARGE');
    });

    it('enforces maximum 20 files per batch', () => {
      const createDummyFiles = (count: number) =>
        Array.from({ length: count }, (_, i) => new File(['data'], `f${i}.webp`, { type: 'image/webp' }));

      expect(validateFileCount(createDummyFiles(1), 20).valid).toBe(true);
      expect(validateFileCount(createDummyFiles(20), 20).valid).toBe(true);
      const invalid = validateFileCount(createDummyFiles(21), 20);
      expect(invalid.valid).toBe(false);
      expect(invalid.error?.code).toBe('INVALID_FILE');
    });
  });

  describe('2. Worker Conversion Processing (processImageJob)', () => {
    it('converts WebP to JPG with High quality (0.90) and White background', async () => {
      const request: ImageWorkerRequest = {
        id: 'test-1',
        operation: 'convert',
        fileData: validWebpBuffer.buffer.slice(
          validWebpBuffer.byteOffset,
          validWebpBuffer.byteOffset + validWebpBuffer.byteLength
        ),
        fileName: 'sample.webp',
        mimeType: 'image/webp',
        options: {
          targetFormat: 'jpg',
          sourceFormat: 'webp',
          quality: 0.9,
          backgroundColor: '#FFFFFF',
        },
      };

      const stages: string[] = [];
      const response = await processImageJob(request, (stage) => {
        stages.push(stage);
      });

      expect(response.success).toBe(true);
      expect(response.resultMime).toBe('image/jpeg');
      expect(response.fileName).toBe('sample.jpg');
      expect(response.width).toBe(1280);
      expect(response.height).toBe(720);
      expect(response.resultData).toBeDefined();
      expect(response.resultData!.byteLength).toBeGreaterThan(0);
      expect(stages).toContain('validating');
      expect(stages).toContain('reading');
      expect(stages).toContain('decoding');
      expect(stages).toContain('encoding');
    });

    it('converts WebP to JPG with Medium (0.80) and Low (0.70) quality presets', async () => {
      for (const q of [0.8, 0.7]) {
        const request: ImageWorkerRequest = {
          id: `test-q-${q}`,
          operation: 'convert',
          fileData: validWebpBuffer.buffer.slice(
            validWebpBuffer.byteOffset,
            validWebpBuffer.byteOffset + validWebpBuffer.byteLength
          ),
          fileName: 'photo.WEBP',
          mimeType: 'image/webp',
          options: {
            targetFormat: 'jpg',
            sourceFormat: 'webp',
            quality: q,
            backgroundColor: '#FFFFFF',
          },
        };

        const response = await processImageJob(request);
        expect(response.success).toBe(true);
        expect(response.resultMime).toBe('image/jpeg');
        expect(response.fileName).toBe('photo.jpg');
      }
    });

    it('composites transparent WebP over Black (#000000) background', async () => {
      const request: ImageWorkerRequest = {
        id: 'test-bg-black',
        operation: 'convert',
        fileData: transparentWebpBuffer.buffer.slice(
          transparentWebpBuffer.byteOffset,
          transparentWebpBuffer.byteOffset + transparentWebpBuffer.byteLength
        ),
        fileName: 'badge.webp',
        mimeType: 'image/webp',
        options: {
          targetFormat: 'jpg',
          sourceFormat: 'webp',
          quality: 0.9,
          backgroundColor: '#000000',
        },
      };

      const response = await processImageJob(request);
      expect(response.success).toBe(true);
      expect(response.resultMime).toBe('image/jpeg');
      expect(response.fileName).toBe('badge.jpg');
    });

    it('handles corrupted WebP stream gracefully', async () => {
      const request: ImageWorkerRequest = {
        id: 'test-corrupt',
        operation: 'convert',
        fileData: corruptWebpBuffer.buffer.slice(
          corruptWebpBuffer.byteOffset,
          corruptWebpBuffer.byteOffset + corruptWebpBuffer.byteLength
        ),
        fileName: 'broken.webp',
        mimeType: 'image/webp',
        options: {
          targetFormat: 'jpg',
          sourceFormat: 'webp',
          quality: 0.9,
          backgroundColor: '#FFFFFF',
        },
      };

      const response = await processImageJob(request);
      expect(response.success).toBe(false);
      expect(response.error).toBeDefined();
    });

    it('rejects conversion if output MIME is not image/jpeg', async () => {
      // Create a canvas that returns image/png instead of image/jpeg
      class BrokenOffscreenCanvas extends MockOffscreenCanvas {
        override async convertToBlob() {
          return new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], { type: 'image/png' });
        }
      }

      const originalCanvas = globalThis.OffscreenCanvas;
      // @ts-expect-error test swap
      globalThis.OffscreenCanvas = BrokenOffscreenCanvas;

      try {
        const request: ImageWorkerRequest = {
          id: 'test-mime-fail',
          operation: 'convert',
          fileData: validWebpBuffer.buffer.slice(
            validWebpBuffer.byteOffset,
            validWebpBuffer.byteOffset + validWebpBuffer.byteLength
          ),
          fileName: 'sample.webp',
          mimeType: 'image/webp',
          options: {
            targetFormat: 'jpg',
            sourceFormat: 'webp',
            quality: 0.9,
            backgroundColor: '#FFFFFF',
          },
        };

        const response = await processImageJob(request);
        expect(response.success).toBe(false);
        expect(response.errorCode).toBe('UNSUPPORTED_FORMAT');
        expect(response.error).toContain('Your browser could not create a JPG image');
      } finally {
        globalThis.OffscreenCanvas = originalCanvas;
      }
    });
  });

  describe('3. High-Level convertWebpToJpg Pipeline', () => {
    it('executes end-to-end convertWebpToJpg on a valid file', async () => {
      const file = new File([validWebpBuffer], 'graphic.webp', { type: 'image/webp' });
      const progressCalls: number[] = [];

      const result = await convertWebpToJpg(
        file,
        { quality: 0.9, backgroundColor: '#FFFFFF' },
        (progress) => progressCalls.push(progress)
      );

      expect(result.blob).toBeInstanceOf(Blob);
      expect(result.blob.type).toBe('image/jpeg');
      expect(result.fileName).toBe('graphic.jpg');
      expect(result.width).toBe(1280);
      expect(result.height).toBe(720);
      expect(result.convertedSize).toBeGreaterThan(0);
      expect(progressCalls.length).toBeGreaterThan(0);
    });

    it('throws ToolError on invalid input file', async () => {
      const file = new File([invalidWebpBuffer], 'corrupted.webp', { type: 'image/webp' });

      await expect(convertWebpToJpg(file)).rejects.toThrow();
    });
  });

  describe('4. ZIP Archive Generation and Utilities', () => {
    it('creates a valid ZIP archive containing multiple converted JPG files', async () => {
      const zipBlob = await createZipBlob([
        {
          name: 'photo-1.jpg',
          blob: new Blob([new Uint8Array([0xff, 0xd8, 0xff])], { type: 'image/jpeg' }),
        },
        {
          name: 'photo-2.jpg',
          blob: new Blob([new Uint8Array([0xff, 0xd8, 0xff])], { type: 'image/jpeg' }),
        },
      ]);

      expect(zipBlob).toBeInstanceOf(Blob);
      expect(zipBlob.size).toBeGreaterThan(0);
      expect(zipBlob.type).toBe('application/zip');
    });

    it('generates unique filenames to prevent ZIP naming collisions', () => {
      const existing = new Set<string>();
      const name1 = generateUniqueFilename('image.jpg', existing);
      existing.add(name1);
      const name2 = generateUniqueFilename('image.jpg', existing);
      existing.add(name2);
      const name3 = generateUniqueFilename('image.jpg', existing);

      expect(name1).toBe('image.jpg');
      expect(name2).toBe('image (1).jpg');
      expect(name3).toBe('image (2).jpg');
    });
  });
});
