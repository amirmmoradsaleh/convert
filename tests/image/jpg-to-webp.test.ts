import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import { convertJpgToWebp } from '../../engines/image/convert';
import { processImageJob } from '../../engines/image/worker/image.worker';
import { ImageWorkerRequest } from '../../engines/image/worker/worker-types';
import { validateJpegFile, hasJpegMagicBytes, validateFileCount } from '../../engines/shared/validation';
import { ToolError, getHumanErrorMessage } from '../../engines/shared/errors';
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
  drawnOperations: Array<{ type: string; x?: number; y?: number }> = [];

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
  }

  getContext(type: string) {
    if (type === '2d') {
      const ops = this.drawnOperations;
      return {
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
      const isJpg = bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
      if (!isJpg) {
        throw new Error('Invalid image data');
      }
      if (bytes.length < 15) {
        throw new Error('Corrupted image stream');
      }
      return new MockImageBitmap(1920, 1080) as unknown as ImageBitmap;
    };
  }
});

describe('JPG to WebP Conversion Engine & Validation', () => {
  const fixturesDir = path.join(process.cwd(), 'tests/fixtures');
  const validJpgBuffer = fs.readFileSync(path.join(fixturesDir, 'sample.jpg'));
  const validJpegBuffer = fs.readFileSync(path.join(fixturesDir, 'sample.jpeg'));
  const corruptJpgBuffer = fs.readFileSync(path.join(fixturesDir, 'corrupted.jpg'));
  const fakeJpgBuffer = fs.readFileSync(path.join(fixturesDir, 'fake.jpg'));

  // 1. Valid JPG converts successfully
  it('1. should convert valid JPG file successfully', async () => {
    const file = new File([validJpgBuffer], 'photo.jpg', { type: 'image/jpeg' });
    const result = await convertJpgToWebp(file);

    expect(result).toBeDefined();
    expect(result.blob).toBeInstanceOf(Blob);
    expect(result.fileName).toBe('photo.webp');
  });

  // 2. Valid JPEG converts successfully
  it('2. should convert valid JPEG file successfully', async () => {
    const file = new File([validJpegBuffer], 'photo.jpeg', { type: 'image/jpeg' });
    const result = await convertJpgToWebp(file);

    expect(result).toBeDefined();
    expect(result.blob).toBeInstanceOf(Blob);
    expect(result.fileName).toBe('photo.webp');
  });

  // 3. Output MIME type is image/webp
  it('3. should produce output with MIME type image/webp', async () => {
    const file = new File([validJpgBuffer], 'test.jpg', { type: 'image/jpeg' });
    const result = await convertJpgToWebp(file);

    expect(result.blob.type).toBe('image/webp');
  });

  // 4. Output is a valid WebP
  it('4. should produce a valid WebP with RIFF...WEBP header', async () => {
    const file = new File([validJpgBuffer], 'header-test.jpg', { type: 'image/jpeg' });
    const result = await convertJpgToWebp(file);
    const buffer = await result.blob.arrayBuffer();
    const bytes = new Uint8Array(buffer);

    // RIFF header: 52 49 46 46
    expect(bytes[0]).toBe(0x52);
    expect(bytes[1]).toBe(0x49);
    expect(bytes[2]).toBe(0x46);
    expect(bytes[3]).toBe(0x46);
    // WEBP: 57 45 42 50
    expect(bytes[8]).toBe(0x57);
    expect(bytes[9]).toBe(0x45);
    expect(bytes[10]).toBe(0x42);
    expect(bytes[11]).toBe(0x50);
  });

  // 5. Output size is greater than 0
  it('5. should have output size greater than 0', async () => {
    const file = new File([validJpgBuffer], 'size.jpg', { type: 'image/jpeg' });
    const result = await convertJpgToWebp(file);

    expect(result.convertedSize).toBeGreaterThan(0);
    expect(result.blob.size).toBeGreaterThan(0);
  });

  // 6. Width is preserved
  it('6. should preserve original image width', async () => {
    const file = new File([validJpgBuffer], 'dimension-w.jpg', { type: 'image/jpeg' });
    const result = await convertJpgToWebp(file);

    expect(result.width).toBe(1920);
  });

  // 7. Height is preserved
  it('7. should preserve original image height', async () => {
    const file = new File([validJpgBuffer], 'dimension-h.jpg', { type: 'image/jpeg' });
    const result = await convertJpgToWebp(file);

    expect(result.height).toBe(1080);
  });

  // 8. Quality 90% produces valid WebP
  it('8. should produce valid WebP with High (90%) quality', async () => {
    const file = new File([validJpgBuffer], 'q90.jpg', { type: 'image/jpeg' });
    const result = await convertJpgToWebp(file, { quality: 0.9 });

    expect(result.blob.type).toBe('image/webp');
    expect(result.convertedSize).toBeGreaterThan(0);
  });

  // 9. Quality 80% produces valid WebP
  it('9. should produce valid WebP with Medium (80%) quality', async () => {
    const file = new File([validJpgBuffer], 'q80.jpg', { type: 'image/jpeg' });
    const result = await convertJpgToWebp(file, { quality: 0.8 });

    expect(result.blob.type).toBe('image/webp');
    expect(result.convertedSize).toBeGreaterThan(0);
  });

  // 10. Quality 70% produces valid WebP
  it('10. should produce valid WebP with Low (70%) quality', async () => {
    const file = new File([validJpgBuffer], 'q70.jpg', { type: 'image/jpeg' });
    const result = await convertJpgToWebp(file, { quality: 0.7 });

    expect(result.blob.type).toBe('image/webp');
    expect(result.convertedSize).toBeGreaterThan(0);
  });

  // 11. Invalid JPEG is rejected
  it('11. should reject invalid JPEG file', async () => {
    const file = new File([new TextEncoder().encode('not an image')], 'invalid.jpg', { type: 'image/jpeg' });
    await expect(convertJpgToWebp(file)).rejects.toThrow('This file is not a valid JPEG image.');
  });

  // 12. Wrong extension/content mismatch is rejected
  it('12. should reject wrong extension/content mismatch (fake.jpg containing text)', async () => {
    const file = new File([fakeJpgBuffer], 'fake.jpg', { type: 'image/jpeg' });
    await expect(convertJpgToWebp(file)).rejects.toThrow('This file is not a valid JPEG image.');
  });

  // 13. JPEG magic-byte failure is rejected
  it('13. should reject files lacking FF D8 FF signature', () => {
    const nonJpeg = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]);
    expect(hasJpegMagicBytes(nonJpeg)).toBe(false);

    const validBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
    expect(hasJpegMagicBytes(validBytes)).toBe(true);
  });

  // 14. Oversized file is rejected
  it('14. should reject file exceeding 50 MB limit', async () => {
    const hugeBlob = {
      name: 'large.jpg',
      size: 51 * 1024 * 1024,
      type: 'image/jpeg',
      slice: () => new Blob([]),
    } as unknown as File;

    const validation = await validateJpegFile(hugeBlob);
    expect(validation.valid).toBe(false);
    expect(validation.error?.code).toBe('FILE_TOO_LARGE');
    expect(validation.error?.message).toBe('This file is too large. Maximum size is 50 MB.');
  });

  // 15. More than 20 files is handled according to existing validation behavior
  it('15. should enforce batch limit of 20 files', () => {
    const files = Array.from({ length: 21 }, (_, i) => new File([], `img${i}.jpg`));
    const validation = validateFileCount(files, 20);
    expect(validation.valid).toBe(false);
    expect(validation.error?.message).toContain('up to 20 files');
  });

  // 16. Multiple files process successfully
  it('16. should process multiple files in sequence', async () => {
    const files = [
      new File([validJpgBuffer], 'batch1.jpg', { type: 'image/jpeg' }),
      new File([validJpegBuffer], 'batch2.jpeg', { type: 'image/jpeg' }),
    ];

    const results = [];
    for (const f of files) {
      results.push(await convertJpgToWebp(f, { quality: 0.9 }));
    }

    expect(results).toHaveLength(2);
    expect(results[0].fileName).toBe('batch1.webp');
    expect(results[1].fileName).toBe('batch2.webp');
    expect(results[0].blob.type).toBe('image/webp');
    expect(results[1].blob.type).toBe('image/webp');
  });

  // 17. Output filename: photo.jpg → photo.webp
  it('17. should convert photo.jpg filename to photo.webp', async () => {
    const file = new File([validJpgBuffer], 'photo.jpg', { type: 'image/jpeg' });
    const result = await convertJpgToWebp(file);
    expect(result.fileName).toBe('photo.webp');
  });

  // 18. Output filename: photo.jpeg → photo.webp
  it('18. should convert photo.jpeg filename to photo.webp', async () => {
    const file = new File([validJpegBuffer], 'photo.jpeg', { type: 'image/jpeg' });
    const result = await convertJpgToWebp(file);
    expect(result.fileName).toBe('photo.webp');
  });

  // 19. A returned Blob with type image/png is rejected
  it('19. should reject a returned Blob with type image/png when WebP requested', async () => {
    // Test worker level rejection
    const mockRequest: ImageWorkerRequest = {
      id: 'test-bad-mime-png',
      operation: 'convert',
      fileData: validJpgBuffer.buffer.slice(validJpgBuffer.byteOffset, validJpgBuffer.byteOffset + validJpgBuffer.byteLength),
      fileName: 'test.jpg',
      mimeType: 'image/jpeg',
      options: { targetFormat: 'webp' },
    };

    // Temporarily mock convertToBlob to return image/png
    const origMethod = MockOffscreenCanvas.prototype.convertToBlob;
    MockOffscreenCanvas.prototype.convertToBlob = async () => new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' });

    try {
      const response = await processImageJob(mockRequest);
      expect(response.success).toBe(false);
      expect(response.errorCode).toBe('UNSUPPORTED_FORMAT');
      expect(response.error).toBe('Your browser could not create a WebP image. Please try another browser.');
    } finally {
      MockOffscreenCanvas.prototype.convertToBlob = origMethod;
    }
  });

  // 20. A returned Blob with type image/jpeg is rejected
  it('20. should reject a returned Blob with type image/jpeg when WebP requested', async () => {
    const mockRequest: ImageWorkerRequest = {
      id: 'test-bad-mime-jpg',
      operation: 'convert',
      fileData: validJpgBuffer.buffer.slice(validJpgBuffer.byteOffset, validJpgBuffer.byteOffset + validJpgBuffer.byteLength),
      fileName: 'test.jpg',
      mimeType: 'image/jpeg',
      options: { targetFormat: 'webp' },
    };

    const origMethod = MockOffscreenCanvas.prototype.convertToBlob;
    MockOffscreenCanvas.prototype.convertToBlob = async () => new Blob([new Uint8Array([1, 2, 3])], { type: 'image/jpeg' });

    try {
      const response = await processImageJob(mockRequest);
      expect(response.success).toBe(false);
      expect(response.errorCode).toBe('UNSUPPORTED_FORMAT');
      expect(response.error).toBe('Your browser could not create a WebP image. Please try another browser.');
    } finally {
      MockOffscreenCanvas.prototype.convertToBlob = origMethod;
    }
  });

  // 21. Worker communication works
  it('21. should communicate with worker and report progress stages', async () => {
    const stagesReported: string[] = [];
    const mockRequest: ImageWorkerRequest = {
      id: 'test-progress',
      operation: 'convert',
      fileData: validJpgBuffer.buffer.slice(validJpgBuffer.byteOffset, validJpgBuffer.byteOffset + validJpgBuffer.byteLength),
      fileName: 'progress.jpg',
      mimeType: 'image/jpeg',
      options: { targetFormat: 'webp', quality: 0.9 },
    };

    const response = await processImageJob(mockRequest, (stage) => {
      stagesReported.push(stage);
    });

    expect(response.success).toBe(true);
    expect(response.resultMime).toBe('image/webp');
    expect(stagesReported).toContain('validating');
    expect(stagesReported).toContain('reading');
    expect(stagesReported).toContain('decoding');
    expect(stagesReported).toContain('encoding');
    expect(stagesReported).toContain('finalizing');
  });

  // 22. Worker errors are normalized
  it('22. should normalize worker errors into ToolError format', () => {
    const err = new ToolError('INVALID_FILE', 'This file is not a valid JPEG image.');
    const humanMsg = getHumanErrorMessage(err);
    expect(humanMsg).toBe('This file is not a valid JPEG image.');

    const unsupported = new ToolError('UNSUPPORTED_FORMAT', 'Your browser could not create a WebP image. Please try another browser.');
    expect(getHumanErrorMessage(unsupported)).toBe('Your browser could not create a WebP image. Please try another browser.');
  });

  // 23. Memory cleanup path is executed
  it('23. should close ImageBitmap after rendering', async () => {
    let closed = false;
    const origCreate = (globalThis as unknown as { createImageBitmap?: unknown }).createImageBitmap;

    (globalThis as unknown as Record<string, unknown>).createImageBitmap = async () => {
      return {
        width: 800,
        height: 600,
        close() {
          closed = true;
        },
      };
    };

    try {
      const file = new File([validJpgBuffer], 'cleanup.jpg', { type: 'image/jpeg' });
      await convertJpgToWebp(file);
      expect(closed).toBe(true);
    } finally {
      (globalThis as unknown as Record<string, unknown>).createImageBitmap = origCreate;
    }
  });

  // 24. Retry path works
  it('24. should support retrying conversion on a failed file', async () => {
    let shouldFail = true;
    const origCreate = (globalThis as unknown as { createImageBitmap?: unknown }).createImageBitmap;

    (globalThis as unknown as Record<string, unknown>).createImageBitmap = async () => {
      if (shouldFail) {
        throw new Error('Temporary failure');
      }
      return new MockImageBitmap(800, 600);
    };

    try {
      const file = new File([validJpgBuffer], 'retry.jpg', { type: 'image/jpeg' });

      // First attempt fails
      await expect(convertJpgToWebp(file)).rejects.toThrow();

      // Retry attempt succeeds
      shouldFail = false;
      const retryResult = await convertJpgToWebp(file);
      expect(retryResult).toBeDefined();
      expect(retryResult.fileName).toBe('retry.webp');
      expect(retryResult.blob.type).toBe('image/webp');
    } finally {
      (globalThis as unknown as Record<string, unknown>).createImageBitmap = origCreate;
    }
  });

  // 25. Verify ZIP creation works for batch downloads
  it('25. should create valid ZIP archive for multiple converted files', async () => {
    const entries = [
      { name: 'photo1.webp', blob: new Blob([new Uint8Array([1, 2, 3])], { type: 'image/webp' }) },
      { name: 'photo2.webp', blob: new Blob([new Uint8Array([4, 5, 6])], { type: 'image/webp' }) },
    ];

    const zipBlob = await createZipBlob(entries);
    expect(zipBlob).toBeInstanceOf(Blob);
    expect(zipBlob.type).toBe('application/zip');
    expect(zipBlob.size).toBeGreaterThan(0);
  });

  // 26. Unique filename collision handling
  it('26. should generate unique filenames when collision occurs', () => {
    const existing = new Set<string>(['photo.webp', 'photo (1).webp']);
    const unique = generateUniqueFilename('photo.webp', existing);
    expect(unique).toBe('photo (2).webp');
  });

  // 27. Corrupted JPEG error handling
  it('27. should handle corrupted JPEG data gracefully', async () => {
    const file = new File([corruptJpgBuffer], 'corrupted.jpg', { type: 'image/jpeg' });
    await expect(convertJpgToWebp(file)).rejects.toThrow('This file is not a valid JPEG image.');
  });
});
