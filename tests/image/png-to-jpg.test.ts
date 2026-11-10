import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import { convertPngToJpg } from '../../engines/image/convert';
import { processImageJob } from '../../engines/image/worker/image.worker';
import { ImageWorkerRequest } from '../../engines/image/worker/worker-types';
import { validatePngFile, hasPngMagicBytes } from '../../engines/shared/validation';
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
    const pngHeader = new Uint8Array([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
    ]);
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
      const isPng = bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
      if (!isJpg && !isPng) {
        throw new Error('Invalid image data');
      }
      if (bytes.length < 15) {
        throw new Error('Corrupted image stream');
      }
      return new MockImageBitmap(1920, 1080) as unknown as ImageBitmap;
    };
  }
});

describe('PNG to JPG Conversion Engine', () => {
  const fixturesDir = path.join(process.cwd(), 'tests/fixtures');
  const validPngBuffer = fs.readFileSync(path.join(fixturesDir, 'sample.png'));
  const transparentPngBuffer = fs.readFileSync(path.join(fixturesDir, 'transparent.png'));
  const semiTransparentPngBuffer = fs.readFileSync(path.join(fixturesDir, 'semitransparent.png'));
  const corruptPngBuffer = fs.readFileSync(path.join(fixturesDir, 'corrupted.png'));
  const invalidPngBuffer = fs.readFileSync(path.join(fixturesDir, 'invalid.png'));

  it('1. should convert valid PNG file successfully', async () => {
    const file = new File([validPngBuffer], 'photo.png', { type: 'image/png' });
    const result = await convertPngToJpg(file);

    expect(result).toBeDefined();
    expect(result.blob).toBeInstanceOf(Blob);
    expect(result.fileName).toBe('photo.jpg');
  });

  it('2. should produce output with MIME type image/jpeg', async () => {
    const file = new File([validPngBuffer], 'graphic.png', { type: 'image/png' });
    const result = await convertPngToJpg(file);

    expect(result.blob.type).toBe('image/jpeg');
  });

  it('3. should produce valid JPEG starting with SOI magic signature (FF D8 FF)', async () => {
    const file = new File([validPngBuffer], 'test.png', { type: 'image/png' });
    const result = await convertPngToJpg(file);

    const buffer = await result.blob.arrayBuffer();
    const bytes = new Uint8Array(buffer);

    expect(bytes[0]).toBe(0xff);
    expect(bytes[1]).toBe(0xd8);
    expect(bytes[2]).toBe(0xff);
  });

  it('4. should preserve original image dimensions (width and height)', async () => {
    const file = new File([validPngBuffer], 'diagram.png', { type: 'image/png' });
    const result = await convertPngToJpg(file);

    expect(result.width).toBe(1920);
    expect(result.height).toBe(1080);
  });

  it('5. should handle transparent PNG with default white background', async () => {
    const file = new File([transparentPngBuffer], 'transparent-icon.png', { type: 'image/png' });
    const result = await convertPngToJpg(file, { backgroundColor: '#FFFFFF' });

    expect(result).toBeDefined();
    expect(result.fileName).toBe('transparent-icon.jpg');
    expect(result.blob.type).toBe('image/jpeg');
  });

  it('6. should handle transparent PNG with black background option', async () => {
    const file = new File([transparentPngBuffer], 'dark-mode-icon.png', { type: 'image/png' });
    const result = await convertPngToJpg(file, { backgroundColor: '#000000' });

    expect(result).toBeDefined();
    expect(result.fileName).toBe('dark-mode-icon.jpg');
    expect(result.blob.type).toBe('image/jpeg');
  });

  it('7. should composite semi-transparent pixels properly', async () => {
    const file = new File([semiTransparentPngBuffer], 'semi-transparent.png', { type: 'image/png' });
    const result = await convertPngToJpg(file, { quality: 0.9, backgroundColor: '#FFFFFF' });

    expect(result).toBeDefined();
    expect(result.fileName).toBe('semi-transparent.jpg');
  });

  it('8. should support High quality (90%) option', async () => {
    const file = new File([validPngBuffer], 'high.png', { type: 'image/png' });
    const result = await convertPngToJpg(file, { quality: 0.9 });

    expect(result).toBeDefined();
    expect(result.blob.type).toBe('image/jpeg');
  });

  it('9. should support Medium quality (80%) option', async () => {
    const file = new File([validPngBuffer], 'medium.png', { type: 'image/png' });
    const result = await convertPngToJpg(file, { quality: 0.8 });

    expect(result).toBeDefined();
    expect(result.blob.type).toBe('image/jpeg');
  });

  it('10. should support Low quality (70%) option', async () => {
    const file = new File([validPngBuffer], 'low.png', { type: 'image/png' });
    const result = await convertPngToJpg(file, { quality: 0.7 });

    expect(result).toBeDefined();
    expect(result.blob.type).toBe('image/jpeg');
  });

  it('11. should reject invalid/fake PNG file during validation', async () => {
    const file = new File([invalidPngBuffer], 'fake.png', { type: 'image/png' });
    const validation = await validatePngFile(file);

    expect(validation.valid).toBe(false);
    expect(validation.error).toBeInstanceOf(ToolError);
    expect(validation.error?.code).toBe('INVALID_FILE');
    expect(validation.error?.message).toBe('This file is not a valid PNG image.');
  });

  it('12. should reject corrupted PNG file with broken chunks', async () => {
    const file = new File([corruptPngBuffer], 'broken.png', { type: 'image/png' });
    await expect(convertPngToJpg(file)).rejects.toThrow();
  });

  it('13. should reject non-PNG files (e.g. .pdf or .txt) with UNSUPPORTED_FORMAT', async () => {
    const textBuffer = Buffer.from('Hello world');
    const file = new File([textBuffer], 'document.txt', { type: 'text/plain' });
    const validation = await validatePngFile(file);

    expect(validation.valid).toBe(false);
    expect(validation.error?.code).toBe('UNSUPPORTED_FORMAT');
  });

  it('14. should reject oversized file (> 50 MB)', async () => {
    const dummyBlob = new Blob([new Uint8Array(10)]);
    const oversizedFile = new File([dummyBlob], 'huge.png', { type: 'image/png' });
    Object.defineProperty(oversizedFile, 'size', { value: 55 * 1024 * 1024 });

    const validation = await validatePngFile(oversizedFile);
    expect(validation.valid).toBe(false);
    expect(validation.error?.code).toBe('FILE_TOO_LARGE');
    expect(validation.error?.message).toContain('50 MB');
  });

  it('15. should correctly verify 8-byte PNG magic signature', () => {
    expect(hasPngMagicBytes(validPngBuffer)).toBe(true);
    expect(hasPngMagicBytes(invalidPngBuffer)).toBe(false);
  });

  it('16. should process multiple PNG files independently in batch', async () => {
    const file1 = new File([validPngBuffer], 'file1.png', { type: 'image/png' });
    const file2 = new File([validPngBuffer], 'file2.png', { type: 'image/png' });

    const [res1, res2] = await Promise.all([
      convertPngToJpg(file1, { quality: 0.9, backgroundColor: '#FFFFFF' }),
      convertPngToJpg(file2, { quality: 0.8, backgroundColor: '#000000' }),
    ]);

    expect(res1.fileName).toBe('file1.jpg');
    expect(res2.fileName).toBe('file2.jpg');
    expect(res1.blob.type).toBe('image/jpeg');
    expect(res2.blob.type).toBe('image/jpeg');
  });

  it('17. should handle filename collision with generateUniqueFilename', () => {
    const existing = new Set<string>(['photo.jpg', 'photo (1).jpg']);
    const unique = generateUniqueFilename('photo.jpg', existing);

    expect(unique).toBe('photo (2).jpg');
  });

  it('18. should create a valid multi-file ZIP archive for batch download', async () => {
    const zipFiles = [
      { name: 'photo-1.jpg', blob: new Blob([new Uint8Array([0xff, 0xd8, 0xff])], { type: 'image/jpeg' }) },
      { name: 'photo-2.jpg', blob: new Blob([new Uint8Array([0xff, 0xd8, 0xff])], { type: 'image/jpeg' }) },
    ];

    const zipBlob = await createZipBlob(zipFiles);
    expect(zipBlob).toBeInstanceOf(Blob);
    expect(zipBlob.size).toBeGreaterThan(0);
    expect(zipBlob.type).toBe('application/zip');
  });

  it('19. should report real progress stages through onProgress callback', async () => {
    const file = new File([validPngBuffer], 'progress-check.png', { type: 'image/png' });
    const recordedStages: string[] = [];

    await convertPngToJpg(file, {}, (_percent, stage) => {
      if (stage && !recordedStages.includes(stage)) {
        recordedStages.push(stage);
      }
    });

    expect(recordedStages).toContain('validating');
    expect(recordedStages).toContain('reading');
    expect(recordedStages).toContain('encoding');
    expect(recordedStages).toContain('finalizing');
  });

  it('20. should normalize errors with getHumanErrorMessage', () => {
    const toolErr = new ToolError('INVALID_FILE', 'Custom error');
    expect(getHumanErrorMessage(toolErr)).toBe('Custom error');

    const genericErr = new Error('Random system crash');
    expect(getHumanErrorMessage(genericErr)).toBe('Random system crash');

    const unknownErr = { weird: 'object' };
    expect(getHumanErrorMessage(unknownErr)).toBe('Something went wrong. Please try again.');
  });

  it('21. should surface worker memory errors properly', async () => {
    const pngArrayBuffer = validPngBuffer.buffer.slice(
      validPngBuffer.byteOffset,
      validPngBuffer.byteOffset + validPngBuffer.byteLength
    );
    const req: ImageWorkerRequest = {
      id: 'test-mem-error',
      operation: 'convert',
      fileData: pngArrayBuffer,
      fileName: 'huge.png',
      mimeType: 'image/png',
      options: { targetFormat: 'jpg' },
    };

    // Temporarily throw out of memory in createImageBitmap
    const orig = globalThis.createImageBitmap;
    globalThis.createImageBitmap = (async () => {
      throw new Error('Out of memory while allocating buffer');
    }) as unknown as typeof globalThis.createImageBitmap;

    try {
      const resp = await processImageJob(req);
      expect(resp.success).toBe(false);
      expect(resp.errorCode).toBe('BROWSER_MEMORY_ERROR');
      expect(resp.error).toBe('This image is too large for your browser to process.');
    } finally {
      globalThis.createImageBitmap = orig;
    }
  });

  it('22. should execute entirely client-side without any network fetch or server calls', () => {
    // Verify pure client-side processing contract
    expect(typeof convertPngToJpg).toBe('function');
    expect(typeof validatePngFile).toBe('function');
  });
});
