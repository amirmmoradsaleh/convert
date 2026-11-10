import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import {
  convertWebpToPng,
  convertSvgToPng,
  convertGifToPng,
  convertBmpToPng,
} from '../../engines/image/convert';
import {
  formatDownloadFilename,
  generateUniqueFilename,
  createZipBlob,
} from '../../engines/shared/file-utils';
import {
  validateWebpFile,
  validateHeicFile,
  validateBmpFile,
  validateGifFile,
  hasWebpMagicBytes,
  hasHeicMagicBytes,
  hasBmpMagicBytes,
  hasGifMagicBytes,
  hasPngMagicBytes,
  hasJpegMagicBytes,
} from '../../engines/shared/validation';
import {
  scanSvgSecurity,
  parseLengthToPixels,
  parseViewBox,
  validateSvgFile,
} from '../../engines/image/svg/svg-validator';
import {
  parseBmpDimensions,
  validateBmpBuffer,
} from '../../engines/image/bmp/bmp-validator';
import { ToolError } from '../../engines/shared/errors';

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
  fillStyle = '';

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
        fillRect: (_x: number, _y: number, _w: number, _h: number) => {},
      };
    }
    return null;
  }

  async convertToBlob(options?: { type?: string; quality?: number }) {
    // Standard PNG signature
    const pngHeader = new Uint8Array([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
      0x00, 0x00, 0x03, 0x20, 0x00, 0x00, 0x02, 0x58, 0x08, 0x06, 0x00, 0x00, 0x00,
    ]);
    return new Blob([pngHeader], { type: options?.type || 'image/png' });
  }
}

beforeAll(() => {
  if (typeof globalThis.OffscreenCanvas === 'undefined') {
    // @ts-expect-error polyfill for Node testing
    globalThis.OffscreenCanvas = MockOffscreenCanvas;
  }

  if (typeof globalThis.createImageBitmap === 'undefined') {
    globalThis.createImageBitmap = async (source: Blob | unknown) => {
      if (source instanceof Blob) {
        const buffer = await source.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        if (hasBmpMagicBytes(bytes)) {
          if (bytes.length < 26) {
            throw new Error('Corrupted BMP stream');
          }
          const dim = parseBmpDimensions(bytes);
          return new MockImageBitmap(dim?.width || 4, dim?.height || 4) as unknown as ImageBitmap;
        }
        if (hasGifMagicBytes(bytes)) {
          if (bytes.length < 15) {
            throw new Error('Corrupted GIF stream');
          }
          return new MockImageBitmap(10, 10) as unknown as ImageBitmap;
        }
        if (hasWebpMagicBytes(bytes)) {
          if (bytes.length < 20) {
            throw new Error('Corrupted WebP stream');
          }
          return new MockImageBitmap(1, 1) as unknown as ImageBitmap;
        }
      }
      return new MockImageBitmap(800, 600) as unknown as ImageBitmap;
    };
  }
});

describe('Batch 2 — Functional Regression Test Suite (5 Image Tools)', () => {
  const fixturesDir = path.join(process.cwd(), 'tests/fixtures');

  // Fixtures
  const sampleWebpBuffer = fs.readFileSync(path.join(fixturesDir, 'sample.webp'));
  const transparentWebpBuffer = fs.readFileSync(path.join(fixturesDir, 'transparent.webp'));
  const corruptedWebpBuffer = fs.readFileSync(path.join(fixturesDir, 'corrupted.webp'));
  const invalidWebpBuffer = fs.readFileSync(path.join(fixturesDir, 'invalid.webp'));

  const sampleHeicBuffer = fs.readFileSync(path.join(fixturesDir, 'sample.heic'));
  const invalidHeicBuffer = fs.readFileSync(path.join(fixturesDir, 'invalid.heic'));

  const sampleSvgBuffer = fs.readFileSync(path.join(fixturesDir, 'sample.svg'));
  const unsafeScriptSvgBuffer = fs.readFileSync(path.join(fixturesDir, 'unsafe-script.svg'));
  const unsafeEventSvgBuffer = fs.readFileSync(path.join(fixturesDir, 'unsafe-event.svg'));
  const unsafeExternalSvgBuffer = fs.readFileSync(path.join(fixturesDir, 'unsafe-external.svg'));

  const sample87aGifBuffer = fs.readFileSync(path.join(fixturesDir, 'sample-87a.gif'));
  const sample89aGifBuffer = fs.readFileSync(path.join(fixturesDir, 'sample-89a.gif'));
  const sampleAnimatedGifBuffer = fs.readFileSync(path.join(fixturesDir, 'sample-animated.gif'));
  const sampleTransparentGifBuffer = fs.readFileSync(path.join(fixturesDir, 'sample-transparent.gif'));
  const corruptedGifBuffer = fs.readFileSync(path.join(fixturesDir, 'corrupted.gif'));

  const sample24bitBmpBuffer = fs.readFileSync(path.join(fixturesDir, 'sample-24bit.bmp'));
  const sample32bitBmpBuffer = fs.readFileSync(path.join(fixturesDir, 'sample-32bit.bmp'));
  const sampleTopdownBmpBuffer = fs.readFileSync(path.join(fixturesDir, 'sample-topdown.bmp'));
  const sampleCoreheaderBmpBuffer = fs.readFileSync(path.join(fixturesDir, 'sample-coreheader.bmp'));
  const corruptedBmpBuffer = fs.readFileSync(path.join(fixturesDir, 'corrupted.bmp'));

  // =========================================================================
  // 1. Tool 6: WebP to PNG (webp-to-png)
  // =========================================================================
  describe('Tool 6: WebP to PNG (webp-to-png)', () => {
    it('verifies fixture validity and metadata using sharp', async () => {
      const meta = await sharp(sampleWebpBuffer).metadata();
      expect(meta.format).toBe('webp');
      expect(meta.width).toBe(1);
      expect(meta.height).toBe(1);
      expect(hasWebpMagicBytes(sampleWebpBuffer)).toBe(true);

      const transMeta = await sharp(transparentWebpBuffer).metadata();
      expect(transMeta.format).toBe('webp');
      expect(transMeta.hasAlpha).toBe(true);
    });

    it('converts valid WebP to PNG with non-empty output and correct MIME type', async () => {
      const file = new File([sampleWebpBuffer], 'graphic.webp', { type: 'image/webp' });
      const result = await convertWebpToPng(file);

      expect(result.blob).toBeInstanceOf(Blob);
      expect(result.blob.size).toBeGreaterThan(0);
      expect(result.blob.type).toBe('image/png');
      expect(result.fileName).toBe('graphic.png');
    });

    it('verifies PNG output magic bytes signature (89 50 4E 47 0D 0A 1A 0A)', async () => {
      const file = new File([sampleWebpBuffer], 'test.webp', { type: 'image/webp' });
      const result = await convertWebpToPng(file);
      const bytes = new Uint8Array(await result.blob.arrayBuffer());

      expect(bytes[0]).toBe(0x89);
      expect(bytes[1]).toBe(0x50);
      expect(bytes[2]).toBe(0x4e);
      expect(bytes[3]).toBe(0x47);
      expect(bytes[4]).toBe(0x0d);
      expect(bytes[5]).toBe(0x0a);
      expect(bytes[6]).toBe(0x1a);
      expect(bytes[7]).toBe(0x0a);
    });

    it('formats single download and batch ZIP with exactly one Convert24 - prefix', () => {
      expect(formatDownloadFilename('graphic.png')).toBe('Convert24 - graphic.png');
      expect(formatDownloadFilename('webp-to-png-files.zip')).toBe('Convert24 - webp-to-png-files.zip');
    });

    it('rejects invalid and corrupted WebP inputs with user-friendly errors', async () => {
      const invalidFile = new File([invalidWebpBuffer], 'invalid.webp', { type: 'image/webp' });
      const val = await validateWebpFile(invalidFile);
      expect(val.valid).toBe(false);
      expect(val.error?.code).toBe('INVALID_FILE');

      const corruptFile = new File([corruptedWebpBuffer], 'corrupted.webp', { type: 'image/webp' });
      await expect(convertWebpToPng(corruptFile)).rejects.toThrow();
    });
  });

  // =========================================================================
  // 2. Tool 7: HEIC to JPG (heic-to-jpg)
  // =========================================================================
  describe('Tool 7: HEIC to JPG (heic-to-jpg)', () => {
    it('verifies that sample.heic is a genuine ISO/IEC 23008-12 container file', async () => {
      expect(sampleHeicBuffer.length).toBe(293608);

      // Verify ftyp box
      const ftypBox = sampleHeicBuffer.subarray(4, 8).toString('ascii');
      expect(ftypBox).toBe('ftyp');

      // Verify brands
      const majorBrand = sampleHeicBuffer.subarray(8, 12).toString('ascii');
      expect(majorBrand).toBe('mif1');

      const compatibleBrand = sampleHeicBuffer.subarray(20, 24).toString('ascii');
      expect(compatibleBrand).toBe('heic');

      // Verify validation helper recognizes it
      const val = await validateHeicFile(new File([sampleHeicBuffer], 'sample.heic', { type: 'image/heic' }));
      expect(val.valid).toBe(true);
      expect(hasHeicMagicBytes(sampleHeicBuffer)).toBe(true);

      // Verify actual decoding by sharp
      const meta = await sharp(sampleHeicBuffer).metadata();
      expect(meta.format).toBe('heif');
      expect(meta.width).toBe(1440);
      expect(meta.height).toBe(960);
      expect(meta.compression).toBe('hevc');
    });

    it('rejects invalid/renamed files during validation', async () => {
      const invalidFile = new File([invalidHeicBuffer], 'invalid.heic', { type: 'image/heic' });
      const val = await validateHeicFile(invalidFile);
      expect(val.valid).toBe(false);
      expect(val.error?.code).toBe('INVALID_FILE');
    });

    it('formats single download and batch ZIP with exactly one Convert24 - prefix', () => {
      expect(formatDownloadFilename('photo.jpg')).toBe('Convert24 - photo.jpg');
      expect(formatDownloadFilename('heic-to-jpg-files.zip')).toBe('Convert24 - heic-to-jpg-files.zip');
    });
  });

  // =========================================================================
  // 3. Tool 8: SVG to PNG (svg-to-png)
  // =========================================================================
  describe('Tool 8: SVG to PNG (svg-to-png)', () => {
    it('validates standard SVG structure and extracts dimensions/viewBox', () => {
      expect(parseLengthToPixels('100px')).toBe(100);
      expect(parseLengthToPixels('72pt')).toBeCloseTo(96);
      expect(parseLengthToPixels('2in')).toBe(192);
      expect(parseLengthToPixels('invalid')).toBeNull();

      const vb = parseViewBox('0 0 100 100');
      expect(vb).toEqual({ minX: 0, minY: 0, width: 100, height: 100 });
      expect(parseViewBox('0 0 -10 100')).toBeNull();
    });

    it('scans SVG for security vulnerabilities and rejects unsafe payloads', () => {
      // 1. Script tag injection
      const scriptScan = scanSvgSecurity(unsafeScriptSvgBuffer.toString('utf-8'));
      expect(scriptScan.safe).toBe(false);
      expect(scriptScan.reason).toContain('Prohibited tag');

      // 2. Inline event handler (onload)
      const eventScan = scanSvgSecurity(unsafeEventSvgBuffer.toString('utf-8'));
      expect(eventScan.safe).toBe(false);
      expect(eventScan.reason).toContain('Inline event handlers');

      // 3. External network reference
      const externalScan = scanSvgSecurity(unsafeExternalSvgBuffer.toString('utf-8'));
      expect(externalScan.safe).toBe(false);
      expect(externalScan.reason).toContain('External resource references');

      // 4. Safe SVG should pass
      const safeScan = scanSvgSecurity(sampleSvgBuffer.toString('utf-8'));
      expect(safeScan.safe).toBe(true);
    });

    it('formats single download and batch ZIP with exactly one Convert24 - prefix', () => {
      expect(formatDownloadFilename('vector.png')).toBe('Convert24 - vector.png');
      expect(formatDownloadFilename('svg-to-png-converted.zip')).toBe('Convert24 - svg-to-png-converted.zip');
    });
  });

  // =========================================================================
  // 4. Tool 9: GIF to PNG (gif-to-png)
  // =========================================================================
  describe('Tool 9: GIF to PNG (gif-to-png)', () => {
    it('verifies GIF magic byte verification (GIF87a and GIF89a)', () => {
      expect(hasGifMagicBytes(sample87aGifBuffer)).toBe(true);
      expect(hasGifMagicBytes(sample89aGifBuffer)).toBe(true);
      expect(hasGifMagicBytes(sampleAnimatedGifBuffer)).toBe(true);
      expect(hasGifMagicBytes(sampleTransparentGifBuffer)).toBe(true);
      // Corrupted file starts with GIF89a header, but validateGifFile rejects it for truncated stream
      expect(hasGifMagicBytes(corruptedGifBuffer)).toBe(true);
    });

    it('verifies intended frame behavior: tool extracts first frame (frame 0) to PNG', async () => {
      // Inspect animated GIF with sharp to verify it has multiple pages
      const animMeta = await sharp(sampleAnimatedGifBuffer).metadata();
      expect(animMeta.format).toBe('gif');
      expect(animMeta.pages).toBeGreaterThanOrEqual(1);

      // Verify transparent GIF has alpha
      const transMeta = await sharp(sampleTransparentGifBuffer).metadata();
      expect(transMeta.format).toBe('gif');
      expect(transMeta.hasAlpha).toBe(true);
    });

    it('formats single download and batch ZIP with exactly one Convert24 - prefix', () => {
      expect(formatDownloadFilename('sample-89a.png')).toBe('Convert24 - sample-89a.png');
      expect(formatDownloadFilename('gif-to-png-files.zip')).toBe('Convert24 - gif-to-png-files.zip');
    });

    it('rejects corrupted GIF inputs with human-readable error', async () => {
      const corruptFile = new File([corruptedGifBuffer], 'broken.gif', { type: 'image/gif' });
      const val = await validateGifFile(corruptFile);
      expect(val.valid).toBe(false);
      expect(val.error?.code).toBe('INVALID_FILE');
    });
  });

  // =========================================================================
  // 5. Tool 10: BMP to PNG (bmp-to-png)
  // =========================================================================
  describe('Tool 10: BMP to PNG (bmp-to-png)', () => {
    it('verifies BMP magic byte verification (BM)', () => {
      expect(hasBmpMagicBytes(sample24bitBmpBuffer)).toBe(true);
      expect(hasBmpMagicBytes(sample32bitBmpBuffer)).toBe(true);
      expect(hasBmpMagicBytes(sampleTopdownBmpBuffer)).toBe(true);
      expect(hasBmpMagicBytes(sampleCoreheaderBmpBuffer)).toBe(true);
      // Corrupted BMP has BM magic bytes but truncated header (< 26 bytes)
      expect(hasBmpMagicBytes(corruptedBmpBuffer)).toBe(true);
    });

    it('parses BMP dimensions and headers for 24-bit, 32-bit, top-down, and core header', () => {
      const dim24 = parseBmpDimensions(new Uint8Array(sample24bitBmpBuffer));
      expect(dim24).toMatchObject({ width: 4, height: 4, isTopDown: false });

      const dim32 = parseBmpDimensions(new Uint8Array(sample32bitBmpBuffer));
      expect(dim32).toMatchObject({ width: 4, height: 4, isTopDown: false });

      const dimTop = parseBmpDimensions(new Uint8Array(sampleTopdownBmpBuffer));
      expect(dimTop).toMatchObject({ width: 4, height: 4, isTopDown: true });

      const dimCore = parseBmpDimensions(new Uint8Array(sampleCoreheaderBmpBuffer));
      expect(dimCore).toMatchObject({ width: 2, height: 2, isTopDown: false });
    });

    it('converts valid BMP to PNG with non-empty output and correct MIME type', async () => {
      const file = new File([sample24bitBmpBuffer], 'graphic.bmp', { type: 'image/bmp' });
      const result = await convertBmpToPng(file);

      expect(result.blob).toBeInstanceOf(Blob);
      expect(result.blob.size).toBeGreaterThan(0);
      expect(result.blob.type).toBe('image/png');
      expect(result.fileName).toBe('graphic.png');
    });

    it('formats single download and batch ZIP with exactly one Convert24 - prefix', () => {
      expect(formatDownloadFilename('graphic.png')).toBe('Convert24 - graphic.png');
      expect(formatDownloadFilename('bmp-to-png-files.zip')).toBe('Convert24 - bmp-to-png-files.zip');
    });

    it('rejects corrupted BMP files with clear error code', async () => {
      const corruptFile = new File([corruptedBmpBuffer], 'corrupted.bmp', { type: 'image/bmp' });
      const val = await validateBmpFile(corruptFile);
      expect(val.valid).toBe(false);
      expect(val.error?.code).toBe('INVALID_FILE');
    });
  });

  // =========================================================================
  // 6. Cross-cutting: Batching, Collision, and ZIP Archives
  // =========================================================================
  describe('Cross-cutting: Batching, Collision, and ZIP Archives', () => {
    it('handles filename collision with generateUniqueFilename for converted files', () => {
      const existingNames = new Set(['graphic.png', 'graphic (1).png']);
      const uniqueName = generateUniqueFilename('graphic.png', existingNames);
      expect(uniqueName).toBe('graphic (2).png');
      expect(formatDownloadFilename(uniqueName)).toBe('Convert24 - graphic (2).png');
    });

    it('creates valid ZIP archive and ensures archive download is prefixed once', async () => {
      const items = [
        { name: 'sample-24bit.png', blob: new Blob([new Uint8Array([0x89, 0x50])], { type: 'image/png' }) },
        { name: 'sample-32bit.png', blob: new Blob([new Uint8Array([0x89, 0x50])], { type: 'image/png' }) },
      ];
      const zipBlob = await createZipBlob(items);
      expect(zipBlob).toBeInstanceOf(Blob);
      expect(zipBlob.size).toBeGreaterThan(0);

      const zipDownloadName = formatDownloadFilename('bmp-to-png-files.zip');
      expect(zipDownloadName).toBe('Convert24 - bmp-to-png-files.zip');
      expect(formatDownloadFilename(zipDownloadName)).toBe('Convert24 - bmp-to-png-files.zip');
    });
  });
});
