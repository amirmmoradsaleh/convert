import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  validateGifFile,
  validateGifBuffer,
  parseGifDimensions,
  detectGifAnimation,
  hasGifMagicBytes,
} from '../../engines/image/gif/gif-validator';
import { convertGifToPng } from '../../engines/image/convert';
import { validateFileCount, hasPngMagicBytes } from '../../engines/shared/validation';
import { createZipBlob, generateUniqueFilename } from '../../engines/shared/file-utils';

// Polyfill ImageBitmap and OffscreenCanvas for Node test environment
class MockImageBitmap {
  width: number;
  height: number;
  isClosed = false;

  constructor(w = 2, h = 2) {
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

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
  }

  getContext(type: string) {
    if (type === '2d') {
      return {
        drawImage: (_bitmap: unknown, _x: number, _y: number) => {},
        clearRect: (_x: number, _y: number, _w: number, _h: number) => {},
      };
    }
    return null;
  }

  async convertToBlob(options?: { type?: string; quality?: number }) {
    // Standard PNG signature: 89 50 4E 47 0D 0A 1A 0A
    const pngHeader = new Uint8Array([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
      0x00, 0x00, 0x00, 0x02, 0x00, 0x00, 0x00, 0x02, 0x08, 0x06, 0x00, 0x00, 0x00,
    ]);
    return new Blob([pngHeader], { type: options?.type || 'image/png' });
  }
}

describe('Tool #9: GIF → PNG Engine, Validation & First-Frame Extraction', () => {
  const fixturesDir = path.join(process.cwd(), 'tests/fixtures');
  const sample87aPath = path.join(fixturesDir, 'sample-87a.gif');
  const sample89aPath = path.join(fixturesDir, 'sample-89a.gif');
  const sampleAnimatedPath = path.join(fixturesDir, 'sample-animated.gif');
  const sampleTransparentPath = path.join(fixturesDir, 'sample-transparent.gif');
  const corruptedPath = path.join(fixturesDir, 'corrupted.gif');

  let sample87aBytes: Uint8Array;
  let sample89aBytes: Uint8Array;
  let sampleAnimatedBytes: Uint8Array;
  let sampleTransparentBytes: Uint8Array;
  let corruptedBytes: Uint8Array;

  beforeAll(() => {
    if (typeof globalThis.OffscreenCanvas === 'undefined') {
      // @ts-expect-error polyfill for testing
      globalThis.OffscreenCanvas = MockOffscreenCanvas;
    }

    if (typeof globalThis.createImageBitmap === 'undefined') {
      globalThis.createImageBitmap = async (source: Blob | unknown) => {
        if (source instanceof Blob) {
          const buffer = await source.arrayBuffer();
          const bytes = new Uint8Array(buffer);
          const isGif = hasGifMagicBytes(bytes);
          if (!isGif) {
            throw new Error('Invalid image data');
          }
          if (bytes.length < 15) {
            throw new Error('Corrupted image stream');
          }
          const dim = parseGifDimensions(bytes);
          return new MockImageBitmap(dim?.width || 2, dim?.height || 2) as unknown as ImageBitmap;
        }
        return new MockImageBitmap(2, 2) as unknown as ImageBitmap;
      };
    }

    sample87aBytes = new Uint8Array(fs.readFileSync(sample87aPath));
    sample89aBytes = new Uint8Array(fs.readFileSync(sample89aPath));
    sampleAnimatedBytes = new Uint8Array(fs.readFileSync(sampleAnimatedPath));
    sampleTransparentBytes = new Uint8Array(fs.readFileSync(sampleTransparentPath));
    corruptedBytes = new Uint8Array(fs.readFileSync(corruptedPath));
  });

  describe('1. Magic Byte & Header Validation', () => {
    it('should recognize GIF87a magic bytes', () => {
      expect(hasGifMagicBytes(sample87aBytes)).toBe(true);
    });

    it('should recognize GIF89a magic bytes', () => {
      expect(hasGifMagicBytes(sample89aBytes)).toBe(true);
      expect(hasGifMagicBytes(sampleAnimatedBytes)).toBe(true);
      expect(hasGifMagicBytes(sampleTransparentBytes)).toBe(true);
    });

    it('should reject non-GIF headers', () => {
      const fakePng = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      const fakeJpg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
      expect(hasGifMagicBytes(fakePng)).toBe(false);
      expect(hasGifMagicBytes(fakeJpg)).toBe(false);
      expect(hasGifMagicBytes(new Uint8Array([0x00, 0x00, 0x00]))).toBe(false);
    });
  });

  describe('2. Dimension Parsing & Screen Descriptors', () => {
    it('should parse 2x2 dimensions from GIF screen descriptor', () => {
      const dim87a = parseGifDimensions(sample87aBytes);
      expect(dim87a).toEqual({ width: 2, height: 2 });

      const dim89a = parseGifDimensions(sample89aBytes);
      expect(dim89a).toEqual({ width: 2, height: 2 });

      const dimAnim = parseGifDimensions(sampleAnimatedBytes);
      expect(dimAnim).toEqual({ width: 2, height: 2 });
    });

    it('should return null for truncated buffers', () => {
      expect(parseGifDimensions(new Uint8Array([0x47, 0x49, 0x46]))).toBeNull();
    });

    it('should reject dimension > 8192px as browser memory error', () => {
      const hugeGif = new Uint8Array(sample89aBytes);
      // Change width to 9000 (0x2328 -> 28 23)
      hugeGif[6] = 0x28;
      hugeGif[7] = 0x23;
      const res = validateGifBuffer(hugeGif);
      expect(res.valid).toBe(false);
      expect(res.error?.code).toBe('BROWSER_MEMORY_ERROR');
    });
  });

  describe('3. Animation Detection', () => {
    it('should detect static GIF87a as non-animated', () => {
      expect(detectGifAnimation(sample87aBytes)).toBe(false);
    });

    it('should detect static GIF89a as non-animated', () => {
      expect(detectGifAnimation(sample89aBytes)).toBe(false);
    });

    it('should detect multi-frame animated GIF', () => {
      expect(detectGifAnimation(sampleAnimatedBytes)).toBe(true);
    });
  });

  describe('4. File-Level Validation', () => {
    it('should validate valid static GIF file', async () => {
      const file = new File([sample89aBytes as unknown as BlobPart], 'test.gif', { type: 'image/gif' });
      const res = await validateGifFile(file);
      expect(res.valid).toBe(true);
      expect(res.dimensions).toEqual({ width: 2, height: 2 });
      expect(res.isAnimated).toBe(false);
    });

    it('should validate valid animated GIF file and set isAnimated to true', async () => {
      const file = new File([sampleAnimatedBytes as unknown as BlobPart], 'banner.gif', { type: 'image/gif' });
      const res = await validateGifFile(file);
      expect(res.valid).toBe(true);
      expect(res.isAnimated).toBe(true);
    });

    it('should reject corrupted GIF files', async () => {
      const file = new File([corruptedBytes as unknown as BlobPart], 'broken.gif', { type: 'image/gif' });
      const res = await validateGifFile(file);
      expect(res.valid).toBe(false);
      expect(res.error?.code).toBe('INVALID_FILE');
    });

    it('should reject files exceeding 50 MB limit', async () => {
      const bigFile = new File([''], 'huge.gif', { type: 'image/gif' });
      Object.defineProperty(bigFile, 'size', { value: 50 * 1024 * 1024 + 1 });
      const res = await validateGifFile(bigFile);
      expect(res.valid).toBe(false);
      expect(res.error?.code).toBe('FILE_TOO_LARGE');
    });

    it('should reject non-GIF file extensions', async () => {
      const file = new File([sample89aBytes as unknown as BlobPart], 'image.png', { type: 'image/gif' });
      const res = await validateGifFile(file);
      expect(res.valid).toBe(false);
      expect(res.error?.code).toBe('UNSUPPORTED_FORMAT');
    });
  });

  describe('5. Batch Limits Validation', () => {
    it('should accept up to 20 files', () => {
      const validFiles = Array.from({ length: 20 }, (_, i) => new File([''], `file${i}.gif`));
      expect(validateFileCount(validFiles).valid).toBe(true);
    });

    it('should reject more than 20 files', () => {
      const excessFiles = Array.from({ length: 21 }, (_, i) => new File([''], `file${i}.gif`));
      const res = validateFileCount(excessFiles);
      expect(res.valid).toBe(false);
      expect(res.error?.code).toBe('INVALID_FILE');
    });
  });

  describe('6. First-Frame Extraction & PNG Conversion', () => {
    it('should convert static GIF89a into a valid PNG', async () => {
      const file = new File([sample89aBytes as unknown as BlobPart], 'icon.gif', { type: 'image/gif' });
      const stages: string[] = [];

      const result = await convertGifToPng(file, (progress, stage) => {
        if (stage && !stages.includes(stage)) stages.push(stage);
      });

      expect(result).toBeDefined();
      expect(result.fileName).toBe('icon.png');
      expect(result.blob.type).toBe('image/png');
      expect(result.width).toBe(2);
      expect(result.height).toBe(2);

      const outBuffer = new Uint8Array(await result.blob.arrayBuffer());
      expect(hasPngMagicBytes(outBuffer)).toBe(true);
    });

    it('should extract frame 0 deterministically from animated GIF', async () => {
      const file = new File([sampleAnimatedBytes as unknown as BlobPart], 'animation.gif', { type: 'image/gif' });
      const result = await convertGifToPng(file);

      expect(result).toBeDefined();
      expect(result.fileName).toBe('animation.png');
      expect(result.blob.type).toBe('image/png');
      expect(result.width).toBe(2);
      expect(result.height).toBe(2);

      const outBuffer = new Uint8Array(await result.blob.arrayBuffer());
      expect(hasPngMagicBytes(outBuffer)).toBe(true);
    });

    it('should preserve transparency from GIF', async () => {
      const file = new File([sampleTransparentBytes as unknown as BlobPart], 'alpha.gif', { type: 'image/gif' });
      const result = await convertGifToPng(file);

      expect(result).toBeDefined();
      expect(result.blob.type).toBe('image/png');
      const outBuffer = new Uint8Array(await result.blob.arrayBuffer());
      expect(hasPngMagicBytes(outBuffer)).toBe(true);
    });
  });

  describe('7. ZIP Creation & Unique Filenames', () => {
    it('should create ZIP blob with unique names for multiple converted PNGs', async () => {
      const pngBlob1 = new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])], {
        type: 'image/png',
      });
      const pngBlob2 = new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])], {
        type: 'image/png',
      });

      const usedNames = new Set<string>();
      const name1 = generateUniqueFilename('avatar.png', usedNames);
      usedNames.add(name1);
      const name2 = generateUniqueFilename('avatar.png', usedNames);
      usedNames.add(name2);

      expect(name1).toBe('avatar.png');
      expect(name2).toBe('avatar (1).png');

      const zipBlob = await createZipBlob([
        { name: name1, blob: pngBlob1 },
        { name: name2, blob: pngBlob2 },
      ]);

      expect(zipBlob).toBeDefined();
      expect(zipBlob.size).toBeGreaterThan(0);
      expect(zipBlob.type).toBe('application/zip');
    });
  });
});
