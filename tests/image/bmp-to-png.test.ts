import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  validateBmpFile,
  validateBmpBuffer,
  parseBmpDimensions,
  hasBmpMagicBytes,
} from '../../engines/image/bmp/bmp-validator';
import { convertBmpToPng } from '../../engines/image/convert';
import { validateFileCount, hasPngMagicBytes } from '../../engines/shared/validation';
import { createZipBlob, generateUniqueFilename } from '../../engines/shared/file-utils';

// Polyfill ImageBitmap and OffscreenCanvas for Node test environment
class MockImageBitmap {
  width: number;
  height: number;
  isClosed = false;

  constructor(w = 4, h = 4) {
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
        imageSmoothingEnabled: true,
        imageSmoothingQuality: 'high',
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
      0x00, 0x00, 0x00, 0x04, 0x00, 0x00, 0x00, 0x04, 0x08, 0x06, 0x00, 0x00, 0x00,
    ]);
    return new Blob([pngHeader], { type: options?.type || 'image/png' });
  }
}

describe('Tool #10: BMP → PNG Engine, Validation & Native Decoding', () => {
  const fixturesDir = path.join(process.cwd(), 'tests/fixtures');
  const sample24bitPath = path.join(fixturesDir, 'sample-24bit.bmp');
  const sampleTopdownPath = path.join(fixturesDir, 'sample-topdown.bmp');
  const sample32bitPath = path.join(fixturesDir, 'sample-32bit.bmp');
  const sampleCoreheaderPath = path.join(fixturesDir, 'sample-coreheader.bmp');
  const corruptedPath = path.join(fixturesDir, 'corrupted.bmp');
  const oversizedPath = path.join(fixturesDir, 'oversized-dim.bmp');

  let sample24bitBytes: Uint8Array;
  let sampleTopdownBytes: Uint8Array;
  let sample32bitBytes: Uint8Array;
  let sampleCoreheaderBytes: Uint8Array;
  let corruptedBytes: Uint8Array;
  let oversizedBytes: Uint8Array;

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
          const isBmp = hasBmpMagicBytes(bytes);
          if (!isBmp) {
            throw new Error('Invalid image data');
          }
          if (bytes.length < 26) {
            throw new Error('Corrupted BMP stream');
          }
          const dim = parseBmpDimensions(bytes);
          return new MockImageBitmap(dim?.width || 4, dim?.height || 4) as unknown as ImageBitmap;
        }
        return new MockImageBitmap(4, 4) as unknown as ImageBitmap;
      };
    }

    sample24bitBytes = new Uint8Array(fs.readFileSync(sample24bitPath));
    sampleTopdownBytes = new Uint8Array(fs.readFileSync(sampleTopdownPath));
    sample32bitBytes = new Uint8Array(fs.readFileSync(sample32bitPath));
    sampleCoreheaderBytes = new Uint8Array(fs.readFileSync(sampleCoreheaderPath));
    corruptedBytes = new Uint8Array(fs.readFileSync(corruptedPath));
    oversizedBytes = new Uint8Array(fs.readFileSync(oversizedPath));
  });

  describe('1. BMP Signature & Magic Bytes Validation', () => {
    it('detects BMP magic bytes (0x42, 0x4D "BM")', () => {
      expect(hasBmpMagicBytes(sample24bitBytes)).toBe(true);
      expect(hasBmpMagicBytes(sampleTopdownBytes)).toBe(true);
      expect(hasBmpMagicBytes(sample32bitBytes)).toBe(true);
      expect(hasBmpMagicBytes(sampleCoreheaderBytes)).toBe(true);
    });

    it('rejects non-BMP buffers', () => {
      const nonBmp = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]); // PNG
      expect(hasBmpMagicBytes(nonBmp)).toBe(false);
      expect(hasBmpMagicBytes(new Uint8Array([]))).toBe(false);
      expect(hasBmpMagicBytes(new Uint8Array([0x42]))).toBe(false);
    });
  });

  describe('2. Header, DIB & Dimension Parsing', () => {
    it('parses standard 24-bit bottom-up BMP dimensions accurately', () => {
      const dim = parseBmpDimensions(sample24bitBytes);
      expect(dim).not.toBeNull();
      expect(dim?.width).toBe(4);
      expect(dim?.height).toBe(4);
      expect(dim?.isTopDown).toBe(false);
      expect(dim?.bpp).toBe(24);
      expect(dim?.compression).toBe(0);
    });

    it('parses top-down BMP with negative height without error', () => {
      const dim = parseBmpDimensions(sampleTopdownBytes);
      expect(dim).not.toBeNull();
      expect(dim?.width).toBe(4);
      expect(dim?.height).toBe(4);
      expect(dim?.isTopDown).toBe(true);
      expect(dim?.bpp).toBe(24);
    });

    it('parses 32-bit RGBA BMP', () => {
      const dim = parseBmpDimensions(sample32bitBytes);
      expect(dim).not.toBeNull();
      expect(dim?.width).toBe(4);
      expect(dim?.height).toBe(4);
      expect(dim?.bpp).toBe(32);
    });

    it('parses 12-byte BITMAPCOREHEADER', () => {
      const dim = parseBmpDimensions(sampleCoreheaderBytes);
      expect(dim).not.toBeNull();
      expect(dim?.width).toBe(2);
      expect(dim?.height).toBe(2);
      expect(dim?.bpp).toBe(24);
    });

    it('returns null for corrupted or truncated buffers', () => {
      expect(parseBmpDimensions(corruptedBytes)).toBeNull();
    });
  });

  describe('3. Validation Limits & Security Guardrails', () => {
    it('rejects oversized dimension (> 8192px) with BROWSER_MEMORY_ERROR', () => {
      const res = validateBmpBuffer(oversizedBytes);
      expect(res.valid).toBe(false);
      expect(res.error?.code).toBe('BROWSER_MEMORY_ERROR');
      expect(res.error?.message).toContain('too large to process in your browser');
    });

    it('rejects files larger than 50 MB with FILE_TOO_LARGE', async () => {
      const fakeBigFile = new File([''], 'huge.bmp', { type: 'image/bmp' });
      Object.defineProperty(fakeBigFile, 'size', { value: 55 * 1024 * 1024 });

      const res = await validateBmpFile(fakeBigFile);
      expect(res.valid).toBe(false);
      expect(res.error?.code).toBe('FILE_TOO_LARGE');
    });

    it('rejects non-bmp extension with UNSUPPORTED_FORMAT', async () => {
      const file = new File([sample24bitBytes as unknown as BlobPart], 'photo.jpg', { type: 'image/jpeg' });
      const res = await validateBmpFile(file);
      expect(res.valid).toBe(false);
      expect(res.error?.code).toBe('UNSUPPORTED_FORMAT');
    });

    it('enforces maximum batch limit of 20 files', () => {
      const files15 = Array.from({ length: 15 }, () => new File([], 'img.bmp'));
      const files25 = Array.from({ length: 25 }, () => new File([], 'img.bmp'));

      expect(validateFileCount(files15).valid).toBe(true);
      expect(validateFileCount(files25).valid).toBe(false);
    });
  });

  describe('4. BMP → PNG Conversion Flow', () => {
    it('converts 24-bit BMP to valid PNG with accurate metadata and signature', async () => {
      const file = new File([sample24bitBytes as unknown as BlobPart], 'diagram.bmp', { type: 'image/bmp' });
      const stages: string[] = [];

      const result = await convertBmpToPng(file, (progress, stage) => {
        if (stage && !stages.includes(stage)) stages.push(stage);
      });

      expect(result.fileName).toBe('diagram.png');
      expect(result.width).toBe(4);
      expect(result.height).toBe(4);
      expect(result.blob.type).toBe('image/png');
      expect(result.originalSize).toBe(sample24bitBytes.byteLength);
      expect(result.convertedSize).toBeGreaterThan(0);

      const header = new Uint8Array(await result.blob.slice(0, 8).arrayBuffer());
      expect(hasPngMagicBytes(header)).toBe(true);
      expect(stages).toContain('validating');
      expect(stages).toContain('decoding');
      expect(stages).toContain('encoding');
    });

    it('converts top-down BMP to PNG seamlessly', async () => {
      const file = new File([sampleTopdownBytes as unknown as BlobPart], 'scan-topdown.bmp', { type: 'image/bmp' });
      const result = await convertBmpToPng(file);

      expect(result.fileName).toBe('scan-topdown.png');
      expect(result.width).toBe(4);
      expect(result.height).toBe(4);
      expect(result.blob.type).toBe('image/png');
    });

    it('converts 32-bit BMP to PNG', async () => {
      const file = new File([sample32bitBytes as unknown as BlobPart], 'graphic-32.bmp', { type: 'image/bmp' });
      const result = await convertBmpToPng(file);

      expect(result.fileName).toBe('graphic-32.png');
      expect(result.blob.type).toBe('image/png');
    });
  });

  describe('5. ZIP Archive Creation & Collision-Free Naming', () => {
    it('packages multiple converted PNG files into ZIP with unique names', async () => {
      const pngBlob = new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], { type: 'image/png' });
      const usedNames = new Set<string>();

      const name1 = generateUniqueFilename('image.png', usedNames);
      usedNames.add(name1);
      const name2 = generateUniqueFilename('image.png', usedNames);
      usedNames.add(name2);

      expect(name1).toBe('image.png');
      expect(name2).toBe('image (1).png');

      const zipBlob = await createZipBlob([
        { name: name1, blob: pngBlob },
        { name: name2, blob: pngBlob },
      ]);

      expect(zipBlob.type).toBe('application/zip');
      expect(zipBlob.size).toBeGreaterThan(0);
    });
  });

  describe('6. Zero Network Leakage Guarantee', () => {
    it('executes entirely in-memory without initiating fetch or xhr requests', async () => {
      const originalFetch = globalThis.fetch;
      let fetchCalled = false;
      globalThis.fetch = async () => {
        fetchCalled = true;
        throw new Error('fetch should not be called');
      };

      try {
        const file = new File([sample24bitBytes as unknown as BlobPart], 'local.bmp', { type: 'image/bmp' });
        await convertBmpToPng(file);
        expect(fetchCalled).toBe(false);
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });
});
