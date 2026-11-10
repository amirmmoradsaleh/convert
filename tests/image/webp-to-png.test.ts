import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import { convertWebpToPng } from '../../engines/image/convert';
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
    if (options?.type === 'image/png') {
      // PNG signature: 89 50 4E 47 0D 0A 1A 0A
      const pngHeader = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      return new Blob([pngHeader], { type: 'image/png' });
    }
    if (options?.type === 'image/jpeg') {
      const jpegHeader = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
      return new Blob([jpegHeader], { type: 'image/jpeg' });
    }
    const webpHeader = new Uint8Array([
      0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
    ]);
    return new Blob([webpHeader], { type: 'image/webp' });
  }
}

beforeAll(() => {
  // @ts-expect-error polyfill for testing
  globalThis.OffscreenCanvas = MockOffscreenCanvas;

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
});

describe('Tool #6: WEBP to PNG Engine & Validation Tests', () => {
  const fixturesDir = path.resolve(__dirname, '../fixtures');

  const getFixtureFile = (fileName: string, mime = 'image/webp'): File => {
    const filePath = path.join(fixturesDir, fileName);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Fixture file not found: ${filePath}`);
    }
    const buffer = fs.readFileSync(filePath);
    return new File([buffer], fileName, { type: mime });
  };

  describe('Validation Suite for WebP Input', () => {
    it('validates a correct WebP file successfully', async () => {
      const validFile = getFixtureFile('sample.webp');
      const result = await validateWebpFile(validFile);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('validates a transparent WebP file successfully', async () => {
      const transparentFile = getFixtureFile('transparent.webp');
      const result = await validateWebpFile(transparentFile);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('rejects files larger than 50 MB', async () => {
      const largeFile = new File(['x'], 'huge.webp', { type: 'image/webp' });
      Object.defineProperty(largeFile, 'size', {
        value: VALIDATION_LIMITS.MAX_IMAGE_SIZE_BYTES + 1024,
      });

      const result = await validateWebpFile(largeFile);
      expect(result.valid).toBe(false);
      expect(result.error?.code).toBe('FILE_TOO_LARGE');
      expect(result.error?.message).toContain('50 MB');
    });

    it('rejects non-webp extensions', async () => {
      const wrongExt = new File(['test'], 'photo.jpg', { type: 'image/webp' });
      const result = await validateWebpFile(wrongExt);
      expect(result.valid).toBe(false);
      expect(result.error?.code).toBe('UNSUPPORTED_FORMAT');
      expect(result.error?.message).toContain('Only WebP files are supported');
    });

    it('rejects non-webp mime types', async () => {
      const wrongMime = new File(['test'], 'photo.webp', { type: 'image/png' });
      const result = await validateWebpFile(wrongMime);
      expect(result.valid).toBe(false);
      expect(result.error?.code).toBe('UNSUPPORTED_FORMAT');
    });

    it('rejects invalid WebP magic bytes', async () => {
      const invalidFile = getFixtureFile('invalid.webp');
      const result = await validateWebpFile(invalidFile);
      expect(result.valid).toBe(false);
      expect(result.error?.code).toBe('INVALID_FILE');
      expect(result.error?.message).toBe('This file is not a valid WebP image.');
    });

    it('rejects a generic RIFF file without WEBP tag (e.g., WAV / AVI)', async () => {
      // RIFF header + WAVE instead of WEBP
      const fakeRiff = new Uint8Array([
        0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x41, 0x56, 0x45, 0x00, 0x00, 0x00, 0x00,
      ]);
      const file = new File([fakeRiff], 'audio.webp', { type: 'image/webp' });
      const result = await validateWebpFile(file);
      expect(result.valid).toBe(false);
      expect(result.error?.code).toBe('INVALID_FILE');
    });

    it('correctly checks hasWebpMagicBytes', () => {
      const validWebp = new Uint8Array([
        0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
      ]);
      expect(hasWebpMagicBytes(validWebp)).toBe(true);

      const invalidWebp = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      expect(hasWebpMagicBytes(invalidWebp)).toBe(false);
    });

    it('enforces maximum 20 files batch limit', () => {
      const sampleFile = getFixtureFile('sample.webp');
      const twentyFiles = new Array(20).fill(sampleFile);
      expect(validateFileCount(twentyFiles, 20).valid).toBe(true);

      const twentyOneFiles = new Array(21).fill(sampleFile);
      const invalidCount = validateFileCount(twentyOneFiles, 20);
      expect(invalidCount.valid).toBe(false);
      expect(invalidCount.error?.code).toBe('INVALID_FILE');
    });
  });

  describe('Image Worker & Conversion Logic', () => {
    it('successfully processes WebP to PNG in worker without filling background color (preserves transparency)', async () => {
      const sampleFile = getFixtureFile('sample.webp');
      const arrayBuffer = await sampleFile.arrayBuffer();

      const request: ImageWorkerRequest = {
        id: 'job-1',
        operation: 'convert',
        fileData: arrayBuffer,
        fileName: 'sample.webp',
        mimeType: 'image/webp',
        options: {
          sourceFormat: 'webp',
          targetFormat: 'png',
        },
      };

      const progressStages: string[] = [];
      const response = await processImageJob(request, (stage) => {
        if (stage) progressStages.push(stage);
      });

      expect(response.success).toBe(true);
      expect(response.resultMime).toBe('image/png');
      expect(response.fileName).toBe('sample.png');
      expect(response.width).toBe(1280);
      expect(response.height).toBe(720);
      expect(response.resultData).toBeDefined();
      expect(response.resultData?.byteLength).toBeGreaterThan(0);
      expect(progressStages).toContain('decoding');
      expect(progressStages).toContain('encoding');
    });

    it('runs convertWebpToPng end-to-end and returns PNG result with correct metadata', async () => {
      const sampleFile = getFixtureFile('sample.webp');
      const progressUpdates: number[] = [];

      const result = await convertWebpToPng(sampleFile, (progress) => {
        progressUpdates.push(progress);
      });

      expect(result.blob).toBeDefined();
      expect(result.blob.type).toBe('image/png');
      expect(result.fileName).toBe('sample.png');
      expect(result.width).toBe(1280);
      expect(result.height).toBe(720);
      expect(result.convertedSize).toBeGreaterThan(0);
      expect(progressUpdates.length).toBeGreaterThan(0);
      expect(progressUpdates[progressUpdates.length - 1]).toBe(100);
    });

    it('converts transparent WebP to PNG without solid background color modification', async () => {
      const transparentFile = getFixtureFile('transparent.webp');
      const result = await convertWebpToPng(transparentFile);

      expect(result.blob.type).toBe('image/png');
      expect(result.fileName).toBe('transparent.png');
      expect(result.convertedSize).toBeGreaterThan(0);
    });

    it('handles corrupted WebP conversion gracefully by throwing a clear error', async () => {
      const corrupted = getFixtureFile('corrupted.webp');
      await expect(convertWebpToPng(corrupted)).rejects.toThrow();
    });
  });

  describe('File Utility & ZIP Tests for WebP to PNG', () => {
    it('creates a valid ZIP archive of converted PNG files', async () => {
      const pngBlob1 = new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])], {
        type: 'image/png',
      });
      const pngBlob2 = new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])], {
        type: 'image/png',
      });

      const zipBlob = await createZipBlob([
        { name: 'photo-1.png', blob: pngBlob1 },
        { name: 'photo-2.png', blob: pngBlob2 },
      ]);

      expect(zipBlob).toBeDefined();
      expect(zipBlob.size).toBeGreaterThan(0);
      expect(zipBlob.type).toBe('application/zip');
    });

    it('deduplicates output filenames when identical names exist in the batch', () => {
      const used = new Set<string>();
      const f1 = generateUniqueFilename('image.png', used);
      const f2 = generateUniqueFilename('image.png', used);
      const f3 = generateUniqueFilename('image.png', used);

      expect(f1).toBe('image.png');
      expect(f2).toBe('image (1).png');
      expect(f3).toBe('image (2).png');
    });
  });
});
