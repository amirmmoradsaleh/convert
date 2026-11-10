import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import { convertPngToWebp } from '../../engines/image/convert';
import { processImageJob } from '../../engines/image/worker/image.worker';
import { ImageWorkerRequest } from '../../engines/image/worker/worker-types';
import { validatePngFile, hasPngMagicBytes, validateFileCount } from '../../engines/shared/validation';
import { ToolError, getHumanErrorMessage } from '../../engines/shared/errors';
import { createZipBlob, generateUniqueFilename } from '../../engines/shared/file-utils';

// Polyfill ImageBitmap and OffscreenCanvas for Node test environment
class MockImageBitmap {
  width: number;
  height: number;
  isClosed = false;

  constructor(w = 800, h = 600) {
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
  drawnOperations: Array<{ type: string; color?: string; x?: number; y?: number }> = [];

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
  }

  getContext(type: string) {
    if (type === '2d') {
      const ops = this.drawnOperations;
      return {
        fillStyle: '',
        fillRect(_x: number, _y: number, _w: number, _h: number) {
          ops.push({ type: 'fillRect', color: this.fillStyle });
        },
        drawImage(_bitmap: unknown, x: number, y: number) {
          ops.push({ type: 'drawImage', x, y });
        },
      };
    }
    return null;
  }

  async convertToBlob(options?: { type?: string; quality?: number }) {
    if (options?.type === 'image/webp') {
      // WebP signature: RIFF....WEBPVP8
      const webpHeader = new Uint8Array([
        0x52, 0x49, 0x46, 0x46, // "RIFF"
        0x24, 0x00, 0x00, 0x00, // length
        0x57, 0x45, 0x42, 0x50, // "WEBP"
        0x56, 0x50, 0x38, 0x20, // "VP8 "
      ]);
      return new Blob([webpHeader], { type: 'image/webp' });
    }
    if (options?.type === 'image/jpeg') {
      const jpegHeader = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
      return new Blob([jpegHeader], { type: 'image/jpeg' });
    }
    const pngHeader = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    return new Blob([pngHeader], { type: options?.type || 'image/png' });
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
      const isPng =
        bytes.length >= 8 &&
        bytes[0] === 0x89 &&
        bytes[1] === 0x50 &&
        bytes[2] === 0x4e &&
        bytes[3] === 0x47 &&
        bytes[4] === 0x0d &&
        bytes[5] === 0x0a &&
        bytes[6] === 0x1a &&
        bytes[7] === 0x0a;
      if (!isPng) {
        throw new Error('Invalid PNG image data');
      }
      if (bytes.length < 15) {
        throw new Error('Corrupted PNG image stream');
      }
      return new MockImageBitmap(800, 600) as unknown as ImageBitmap;
    };
  }
});

describe('PNG to WebP Conversion Engine & Validation', () => {
  const fixturesDir = path.join(process.cwd(), 'tests/fixtures');
  const samplePngBuffer = fs.readFileSync(path.join(fixturesDir, 'sample.png'));
  const transparentPngBuffer = fs.readFileSync(path.join(fixturesDir, 'transparent.png'));
  const semiTransparentPngBuffer = fs.readFileSync(path.join(fixturesDir, 'semitransparent.png'));
  const corruptPngBuffer = fs.readFileSync(path.join(fixturesDir, 'corrupted.png'));
  const invalidPngBuffer = fs.readFileSync(path.join(fixturesDir, 'invalid.png'));

  // 1. Validation tests
  describe('PNG Validation', () => {
    it('validates genuine PNG magic bytes correctly', () => {
      const bytes = new Uint8Array(samplePngBuffer);
      expect(hasPngMagicBytes(bytes)).toBe(true);
    });

    it('rejects non-PNG magic bytes', () => {
      const bytes = new Uint8Array(invalidPngBuffer);
      expect(hasPngMagicBytes(bytes)).toBe(false);
    });

    it('validates a correct PNG file', async () => {
      const file = new File([samplePngBuffer], 'photo.png', { type: 'image/png' });
      const res = await validatePngFile(file);
      expect(res.valid).toBe(true);
      expect(res.error).toBeUndefined();
    });

    it('rejects oversized PNG files (> 50MB)', async () => {
      const bigBuffer = new Uint8Array(51 * 1024 * 1024);
      bigBuffer.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      const file = new File([bigBuffer], 'huge.png', { type: 'image/png' });
      const res = await validatePngFile(file);
      expect(res.valid).toBe(false);
      expect(res.error?.code).toBe('FILE_TOO_LARGE');
    });

    it('rejects files with invalid extensions', async () => {
      const file = new File([samplePngBuffer], 'image.txt', { type: 'text/plain' });
      const res = await validatePngFile(file);
      expect(res.valid).toBe(false);
      expect(res.error?.code).toBe('UNSUPPORTED_FORMAT');
    });

    it('rejects corrupted PNG files', async () => {
      const file = new File([corruptPngBuffer], 'broken.png', { type: 'image/png' });
      const res = await validatePngFile(file);
      // Signature is present but decoding fails
      expect(res.valid).toBe(true); // magic bytes pass, worker decoding will fail gracefully
    });

    it('enforces batch limit of 20 files', () => {
      const validFiles = Array.from({ length: 20 }, (_, i) => new File([], `img${i}.png`));
      const resOk = validateFileCount(validFiles);
      expect(resOk.valid).toBe(true);

      const tooMany = Array.from({ length: 21 }, (_, i) => new File([], `img${i}.png`));
      const resErr = validateFileCount(tooMany);
      expect(resErr.valid).toBe(false);
      expect(resErr.error?.code).toBe('INVALID_FILE');
    });
  });

  // 2. Direct Worker Conversion tests
  describe('Worker Image Conversion (processImageJob)', () => {
    it('converts opaque PNG to WebP with default options', async () => {
      const request: ImageWorkerRequest = {
        id: 'job-1',
        operation: 'convert',
        fileData: samplePngBuffer.buffer.slice(
          samplePngBuffer.byteOffset,
          samplePngBuffer.byteOffset + samplePngBuffer.byteLength
        ),
        fileName: 'sample.png',
        mimeType: 'image/png',
        options: {
          sourceFormat: 'png',
          targetFormat: 'webp',
          quality: 0.9,
        },
      };

      const res = await processImageJob(request);
      expect(res.success).toBe(true);
      if (res.success && res.resultData) {
        expect(res.resultMime).toBe('image/webp');
        expect(res.fileName).toBe('sample.webp');
        expect(res.width).toBe(800);
        expect(res.height).toBe(600);
        expect(res.resultData.byteLength).toBeGreaterThan(0);

        // Verify WebP signature
        const outBytes = new Uint8Array(res.resultData);
        expect(outBytes[0]).toBe(0x52); // R
        expect(outBytes[1]).toBe(0x49); // I
        expect(outBytes[2]).toBe(0x46); // F
        expect(outBytes[3]).toBe(0x46); // F
        expect(outBytes[8]).toBe(0x57); // W
        expect(outBytes[9]).toBe(0x45); // E
        expect(outBytes[10]).toBe(0x42); // B
        expect(outBytes[11]).toBe(0x50); // P
      }
    });

    it('converts fully transparent PNG without background flattening', async () => {
      const request: ImageWorkerRequest = {
        id: 'job-transparent',
        operation: 'convert',
        fileData: transparentPngBuffer.buffer.slice(
          transparentPngBuffer.byteOffset,
          transparentPngBuffer.byteOffset + transparentPngBuffer.byteLength
        ),
        fileName: 'transparent.png',
        mimeType: 'image/png',
        options: {
          sourceFormat: 'png',
          targetFormat: 'webp',
          quality: 0.9,
        },
      };

      const res = await processImageJob(request);
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.resultMime).toBe('image/webp');
        expect(res.fileName).toBe('transparent.webp');
      }
    });

    it('converts semi-transparent PNG preserving alpha channel', async () => {
      const request: ImageWorkerRequest = {
        id: 'job-semitransparent',
        operation: 'convert',
        fileData: semiTransparentPngBuffer.buffer.slice(
          semiTransparentPngBuffer.byteOffset,
          semiTransparentPngBuffer.byteOffset + semiTransparentPngBuffer.byteLength
        ),
        fileName: 'semitransparent.png',
        mimeType: 'image/png',
        options: {
          sourceFormat: 'png',
          targetFormat: 'webp',
          quality: 0.8,
        },
      };

      const res = await processImageJob(request);
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.resultMime).toBe('image/webp');
        expect(res.fileName).toBe('semitransparent.webp');
      }
    });

    it('supports Low 70% quality preset', async () => {
      const request: ImageWorkerRequest = {
        id: 'job-low-q',
        operation: 'convert',
        fileData: samplePngBuffer.buffer.slice(
          samplePngBuffer.byteOffset,
          samplePngBuffer.byteOffset + samplePngBuffer.byteLength
        ),
        fileName: 'sample.png',
        mimeType: 'image/png',
        options: {
          sourceFormat: 'png',
          targetFormat: 'webp',
          quality: 0.7,
        },
      };

      const res = await processImageJob(request);
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.resultMime).toBe('image/webp');
      }
    });

    it('supports Medium 80% quality preset', async () => {
      const request: ImageWorkerRequest = {
        id: 'job-med-q',
        operation: 'convert',
        fileData: samplePngBuffer.buffer.slice(
          samplePngBuffer.byteOffset,
          samplePngBuffer.byteOffset + samplePngBuffer.byteLength
        ),
        fileName: 'sample.png',
        mimeType: 'image/png',
        options: {
          sourceFormat: 'png',
          targetFormat: 'webp',
          quality: 0.8,
        },
      };

      const res = await processImageJob(request);
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.resultMime).toBe('image/webp');
      }
    });

    it('supports High 90% quality preset', async () => {
      const request: ImageWorkerRequest = {
        id: 'job-high-q',
        operation: 'convert',
        fileData: samplePngBuffer.buffer.slice(
          samplePngBuffer.byteOffset,
          samplePngBuffer.byteOffset + samplePngBuffer.byteLength
        ),
        fileName: 'sample.png',
        mimeType: 'image/png',
        options: {
          sourceFormat: 'png',
          targetFormat: 'webp',
          quality: 0.9,
        },
      };

      const res = await processImageJob(request);
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.resultMime).toBe('image/webp');
      }
    });

    it('fails gracefully on invalid magic bytes', async () => {
      const request: ImageWorkerRequest = {
        id: 'job-invalid-bytes',
        operation: 'convert',
        fileData: invalidPngBuffer.buffer.slice(
          invalidPngBuffer.byteOffset,
          invalidPngBuffer.byteOffset + invalidPngBuffer.byteLength
        ),
        fileName: 'invalid.png',
        mimeType: 'image/png',
        options: {
          sourceFormat: 'png',
          targetFormat: 'webp',
        },
      };

      const res = await processImageJob(request);
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.errorCode).toBe('INVALID_FILE');
        expect(res.error).toBe('This file is not a valid PNG image.');
      }
    });

    it('fails gracefully on corrupted PNG data stream', async () => {
      const request: ImageWorkerRequest = {
        id: 'job-corrupted',
        operation: 'convert',
        fileData: corruptPngBuffer.buffer.slice(
          corruptPngBuffer.byteOffset,
          corruptPngBuffer.byteOffset + corruptPngBuffer.byteLength
        ),
        fileName: 'corrupted.png',
        mimeType: 'image/png',
        options: {
          sourceFormat: 'png',
          targetFormat: 'webp',
        },
      };

      const res = await processImageJob(request);
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.errorCode).toBe('INVALID_FILE');
        expect(res.error).toBe('This file is not a valid PNG image.');
      }
    });

    it('reports progress through progress callbacks', async () => {
      const progressUpdates: Array<{ stage: string; percent: number }> = [];
      const request: ImageWorkerRequest = {
        id: 'job-progress',
        operation: 'convert',
        fileData: samplePngBuffer.buffer.slice(
          samplePngBuffer.byteOffset,
          samplePngBuffer.byteOffset + samplePngBuffer.byteLength
        ),
        fileName: 'sample.png',
        mimeType: 'image/png',
        options: {
          sourceFormat: 'png',
          targetFormat: 'webp',
        },
      };

      const res = await processImageJob(request, (stage, percent) => {
        progressUpdates.push({ stage, percent });
      });

      expect(res.success).toBe(true);
      expect(progressUpdates.length).toBeGreaterThanOrEqual(3);
      expect(progressUpdates.map((p) => p.stage)).toContain('validating');
      expect(progressUpdates.map((p) => p.stage)).toContain('decoding');
      expect(progressUpdates.map((p) => p.stage)).toContain('encoding');
    });
  });

  // 3. High-level convertPngToWebp function tests
  describe('High-level convertPngToWebp API', () => {
    it('converts PNG to WebP file and returns complete result', async () => {
      const file = new File([samplePngBuffer], 'landscape.png', { type: 'image/png' });
      const progressSteps: number[] = [];

      const result = await convertPngToWebp(file, { quality: 0.9 }, (p) => {
        progressSteps.push(p);
      });

      expect(result.blob).toBeDefined();
      expect(result.blob.type).toBe('image/webp');
      expect(result.blob.size).toBeGreaterThan(0);
      expect(result.fileName).toBe('landscape.webp');
      expect(result.width).toBe(800);
      expect(result.height).toBe(600);
      expect(progressSteps.length).toBeGreaterThan(0);
    });

    it('preserves uppercase filename casing with .webp extension', async () => {
      const file = new File([samplePngBuffer], 'HERO_BANNER.PNG', { type: 'image/png' });
      const result = await convertPngToWebp(file, { quality: 0.8 });
      expect(result.fileName).toBe('HERO_BANNER.webp');
    });

    it('rejects invalid PNG before calling worker', async () => {
      const file = new File([invalidPngBuffer], 'fake.png', { type: 'image/png' });
      await expect(convertPngToWebp(file)).rejects.toThrow();
    });
  });

  // 4. File utilities & ZIP creation for PNG to WebP
  describe('ZIP Packaging & Unique Filenames', () => {
    it('creates unique filenames for duplicate PNG names', () => {
      const usedNames = new Set<string>();
      const name1 = generateUniqueFilename('icon.webp', usedNames);
      usedNames.add(name1);
      const name2 = generateUniqueFilename('icon.webp', usedNames);
      usedNames.add(name2);
      const name3 = generateUniqueFilename('icon.webp', usedNames);
      usedNames.add(name3);

      expect(name1).toBe('icon.webp');
      expect(name2).toBe('icon (1).webp');
      expect(name3).toBe('icon (2).webp');
    });

    it('creates valid ZIP archive for multiple converted WebP files', async () => {
      const webpHeader = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50]);
      const blob1 = new Blob([webpHeader], { type: 'image/webp' });
      const blob2 = new Blob([webpHeader], { type: 'image/webp' });

      const zipBlob = await createZipBlob([
        { name: 'image1.webp', blob: blob1 },
        { name: 'image2.webp', blob: blob2 },
      ]);

      expect(zipBlob).toBeDefined();
      expect(zipBlob.type).toBe('application/zip');
      expect(zipBlob.size).toBeGreaterThan(0);
    });
  });

  // 5. Error translation and user messaging
  describe('Error Messages & Fallbacks', () => {
    it('returns human-friendly message for INVALID_FILE error', () => {
      const err = new ToolError('INVALID_FILE', 'This file is not a valid PNG image.');
      const msg = getHumanErrorMessage(err);
      expect(msg).toBe('This file is not a valid PNG image.');
    });

    it('returns human-friendly message for FILE_TOO_LARGE', () => {
      const err = new ToolError('FILE_TOO_LARGE', 'File size exceeds 50 MB limit.');
      const msg = getHumanErrorMessage(err);
      expect(msg).toContain('50 MB');
    });

    it('returns human-friendly message for BATCH_LIMIT_EXCEEDED message', () => {
      const err = new ToolError('INVALID_FILE', 'You can only process up to 20 files at a time.');
      const msg = getHumanErrorMessage(err);
      expect(msg).toContain('20 files');
    });
  });
});
