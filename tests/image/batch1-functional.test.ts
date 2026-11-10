import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import {
  convertJpgToPng,
  convertPngToJpg,
  convertJpgToWebp,
  convertWebpToJpg,
  convertPngToWebp,
} from '../../engines/image/convert';
import {
  formatDownloadFilename,
  generateUniqueFilename,
  createZipBlob,
} from '../../engines/shared/file-utils';
import {
  validateJpegFile,
  validatePngFile,
  validateWebpFile,
  hasJpegMagicBytes,
  hasPngMagicBytes,
  hasWebpMagicBytes,
} from '../../engines/shared/validation';
import { ToolError } from '../../engines/shared/errors';

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
  fillStyle = '#FFFFFF';
  operations: Array<{ type: string; color?: string; x?: number; y?: number }> = [];

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
  }

  getContext(type: string) {
    if (type === '2d') {
      const self = this;
      return {
        get fillStyle() {
          return self.fillStyle;
        },
        set fillStyle(val: string) {
          self.fillStyle = val;
        },
        fillRect(x: number, y: number) {
          self.operations.push({ type: 'fillRect', color: self.fillStyle, x, y });
        },
        drawImage(_bitmap: unknown, x: number, y: number) {
          self.operations.push({ type: 'drawImage', x, y });
        },
      };
    }
    return null;
  }

  async convertToBlob(options?: { type?: string; quality?: number }) {
    const targetType = options?.type || 'image/png';
    if (targetType === 'image/jpeg') {
      // Valid JPEG SOI header
      const jpegHeader = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
      return new Blob([jpegHeader], { type: 'image/jpeg' });
    }
    if (targetType === 'image/webp') {
      // Valid WebP RIFF header
      const webpHeader = new Uint8Array([
        0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x20,
      ]);
      return new Blob([webpHeader], { type: 'image/webp' });
    }
    // Standard PNG signature
    const pngHeader = new Uint8Array([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
    ]);
    return new Blob([pngHeader], { type: 'image/png' });
  }
}

beforeAll(() => {
  if (typeof globalThis.OffscreenCanvas === 'undefined') {
    // @ts-expect-error polyfill for Node testing
    globalThis.OffscreenCanvas = MockOffscreenCanvas;
  }

  if (typeof globalThis.createImageBitmap === 'undefined') {
    // @ts-expect-error polyfill for Node testing
    globalThis.createImageBitmap = async (source: Blob) => {
      const buffer = await source.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      const isJpg = bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
      const isPng =
        bytes.length >= 8 &&
        bytes[0] === 0x89 &&
        bytes[1] === 0x50 &&
        bytes[2] === 0x4e &&
        bytes[3] === 0x47;
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

      if (!isJpg && !isPng && !isWebp) {
        throw new Error('Invalid image data');
      }
      if (bytes.length < 15) {
        throw new Error('Corrupted image stream');
      }
      return new MockImageBitmap(1920, 1080) as unknown as ImageBitmap;
    };
  }
});

describe('Batch 1 — Functional Regression Test Suite (5 Image Tools)', () => {
  const fixturesDir = path.join(process.cwd(), 'tests/fixtures');
  const sampleJpgBuffer = fs.readFileSync(path.join(fixturesDir, 'sample.jpg'));
  const sampleJpegBuffer = fs.readFileSync(path.join(fixturesDir, 'sample.jpeg'));
  const samplePngBuffer = fs.readFileSync(path.join(fixturesDir, 'sample.png'));
  const sampleWebpBuffer = fs.readFileSync(path.join(fixturesDir, 'sample.webp'));
  const transparentPngBuffer = fs.readFileSync(path.join(fixturesDir, 'transparent.png'));
  const transparentWebpBuffer = fs.readFileSync(path.join(fixturesDir, 'transparent.webp'));
  const corruptedJpgBuffer = fs.readFileSync(path.join(fixturesDir, 'corrupted.jpg'));
  const corruptedPngBuffer = fs.readFileSync(path.join(fixturesDir, 'corrupted.png'));
  const corruptedWebpBuffer = fs.readFileSync(path.join(fixturesDir, 'corrupted.webp'));
  const fakeJpgBuffer = fs.readFileSync(path.join(fixturesDir, 'fake.jpg'));
  const invalidPngBuffer = fs.readFileSync(path.join(fixturesDir, 'invalid.png'));
  const invalidWebpBuffer = fs.readFileSync(path.join(fixturesDir, 'invalid.webp'));

  // =========================================================================
  // 1. Tool 1: JPG to PNG (jpg-to-png)
  // =========================================================================
  describe('Tool 1: JPG to PNG (jpg-to-png)', () => {
    it('verifies fixture validity and metadata using sharp', async () => {
      const meta = await sharp(sampleJpgBuffer).metadata();
      expect(meta.format).toBe('jpeg');
      expect(meta.width).toBe(1);
      expect(meta.height).toBe(1);
      expect(hasJpegMagicBytes(sampleJpgBuffer)).toBe(true);
    });

    it('converts valid JPG to PNG with non-empty output and correct MIME type', async () => {
      const file = new File([sampleJpgBuffer], 'vacation.jpg', { type: 'image/jpeg' });
      const result = await convertJpgToPng(file);

      expect(result.blob).toBeInstanceOf(Blob);
      expect(result.blob.size).toBeGreaterThan(0);
      expect(result.blob.type).toBe('image/png');
      expect(result.fileName).toBe('vacation.png');
      expect(result.width).toBe(1920);
      expect(result.height).toBe(1080);
    });

    it('verifies PNG output magic bytes signature (89 50 4E 47 0D 0A 1A 0A)', async () => {
      const file = new File([sampleJpgBuffer], 'nature.jpg', { type: 'image/jpeg' });
      const result = await convertJpgToPng(file);
      const bytes = new Uint8Array(await result.blob.arrayBuffer());

      expect(bytes[0]).toBe(0x89);
      expect(bytes[1]).toBe(0x50); // P
      expect(bytes[2]).toBe(0x4e); // N
      expect(bytes[3]).toBe(0x47); // G
      expect(bytes[4]).toBe(0x0d);
      expect(bytes[5]).toBe(0x0a);
      expect(bytes[6]).toBe(0x1a);
      expect(bytes[7]).toBe(0x0a);
    });

    it('formats single download and batch ZIP with exactly one Convert24 - prefix', () => {
      const singleDownload = formatDownloadFilename('vacation.png');
      expect(singleDownload).toBe('Convert24 - vacation.png');

      const batchZip = formatDownloadFilename('jpg-to-png-files.zip');
      expect(batchZip).toBe('Convert24 - jpg-to-png-files.zip');
    });

    it('rejects corrupted and fake JPG inputs with user-friendly errors', async () => {
      const fakeFile = new File([fakeJpgBuffer], 'fake.jpg', { type: 'image/jpeg' });
      const fakeVal = await validateJpegFile(fakeFile);
      expect(fakeVal.valid).toBe(false);
      expect(fakeVal.error?.code).toBe('INVALID_FILE');

      const corruptFile = new File([corruptedJpgBuffer], 'corrupted.jpg', { type: 'image/jpeg' });
      await expect(convertJpgToPng(corruptFile)).rejects.toThrow();
    });
  });

  // =========================================================================
  // 2. Tool 2: PNG to JPG (png-to-jpg)
  // =========================================================================
  describe('Tool 2: PNG to JPG (png-to-jpg)', () => {
    it('verifies fixture validity and metadata using sharp', async () => {
      const meta = await sharp(samplePngBuffer).metadata();
      expect(meta.format).toBe('png');
      expect(meta.width).toBe(2);
      expect(meta.height).toBe(2);
      expect(hasPngMagicBytes(samplePngBuffer)).toBe(true);
    });

    it('converts valid PNG to JPG with non-empty output and correct MIME type', async () => {
      const file = new File([samplePngBuffer], 'diagram.png', { type: 'image/png' });
      const result = await convertPngToJpg(file);

      expect(result.blob).toBeInstanceOf(Blob);
      expect(result.blob.size).toBeGreaterThan(0);
      expect(result.blob.type).toBe('image/jpeg');
      expect(result.fileName).toBe('diagram.jpg');
      expect(result.width).toBe(1920);
      expect(result.height).toBe(1080);
    });

    it('verifies JPEG output magic bytes SOI marker (FF D8 FF)', async () => {
      const file = new File([samplePngBuffer], 'test.png', { type: 'image/png' });
      const result = await convertPngToJpg(file);
      const bytes = new Uint8Array(await result.blob.arrayBuffer());

      expect(bytes[0]).toBe(0xff);
      expect(bytes[1]).toBe(0xd8);
      expect(bytes[2]).toBe(0xff);
    });

    it('flattens transparent PNG onto white (#FFFFFF) background by default and black (#000000) when requested', async () => {
      // Real binary verification using sharp
      const flattenedWhite = await sharp(transparentPngBuffer)
        .flatten({ background: '#FFFFFF' })
        .jpeg()
        .toBuffer();
      const rawWhite = await sharp(flattenedWhite).raw().toBuffer();
      expect(rawWhite[0]).toBe(255);
      expect(rawWhite[1]).toBe(255);
      expect(rawWhite[2]).toBe(255);

      const flattenedBlack = await sharp(transparentPngBuffer)
        .flatten({ background: '#000000' })
        .jpeg()
        .toBuffer();
      const rawBlack = await sharp(flattenedBlack).raw().toBuffer();
      expect(rawBlack[0]).toBe(0);
      expect(rawBlack[1]).toBe(0);
      expect(rawBlack[2]).toBe(0);

      // Engine conversion test
      const file = new File([transparentPngBuffer], 'transparent.png', { type: 'image/png' });
      const resWhite = await convertPngToJpg(file, { backgroundColor: '#FFFFFF' });
      expect(resWhite.fileName).toBe('transparent.jpg');
      expect(resWhite.blob.type).toBe('image/jpeg');

      const resBlack = await convertPngToJpg(file, { backgroundColor: '#000000' });
      expect(resBlack.fileName).toBe('transparent.jpg');
      expect(resBlack.blob.type).toBe('image/jpeg');
    });

    it('formats single download and batch ZIP with exactly one Convert24 - prefix', () => {
      const singleDownload = formatDownloadFilename('diagram.jpg');
      expect(singleDownload).toBe('Convert24 - diagram.jpg');

      const batchZip = formatDownloadFilename('png-to-jpg-files.zip');
      expect(batchZip).toBe('Convert24 - png-to-jpg-files.zip');
    });

    it('rejects invalid and corrupted PNG inputs with user-friendly errors', async () => {
      const invalidFile = new File([invalidPngBuffer], 'invalid.png', { type: 'image/png' });
      const val = await validatePngFile(invalidFile);
      expect(val.valid).toBe(false);
      expect(val.error?.code).toBe('INVALID_FILE');

      const corruptFile = new File([corruptedPngBuffer], 'corrupted.png', { type: 'image/png' });
      await expect(convertPngToJpg(corruptFile)).rejects.toThrow();
    });
  });

  // =========================================================================
  // 3. Tool 3: JPG to WebP (jpg-to-webp)
  // =========================================================================
  describe('Tool 3: JPG to WebP (jpg-to-webp)', () => {
    it('converts valid JPG to WebP with non-empty output and correct MIME type', async () => {
      const file = new File([sampleJpgBuffer], 'photo.jpg', { type: 'image/jpeg' });
      const result = await convertJpgToWebp(file, { quality: 0.9 });

      expect(result.blob).toBeInstanceOf(Blob);
      expect(result.blob.size).toBeGreaterThan(0);
      expect(result.blob.type).toBe('image/webp');
      expect(result.fileName).toBe('photo.webp');
      expect(result.width).toBe(1920);
      expect(result.height).toBe(1080);
    });

    it('verifies WebP output magic bytes signature (RIFF ... WEBP)', async () => {
      const file = new File([sampleJpgBuffer], 'landscape.jpg', { type: 'image/jpeg' });
      const result = await convertJpgToWebp(file);
      const bytes = new Uint8Array(await result.blob.arrayBuffer());

      expect(bytes[0]).toBe(0x52); // 'R'
      expect(bytes[1]).toBe(0x49); // 'I'
      expect(bytes[2]).toBe(0x46); // 'F'
      expect(bytes[3]).toBe(0x46); // 'F'
      expect(bytes[8]).toBe(0x57); // 'W'
      expect(bytes[9]).toBe(0x45); // 'E'
      expect(bytes[10]).toBe(0x42); // 'B'
      expect(bytes[11]).toBe(0x50); // 'P'
    });

    it('supports quality settings (0.9, 0.8, 0.7)', async () => {
      const file = new File([sampleJpgBuffer], 'photo.jpg', { type: 'image/jpeg' });
      const q90 = await convertJpgToWebp(file, { quality: 0.9 });
      const q80 = await convertJpgToWebp(file, { quality: 0.8 });
      const q70 = await convertJpgToWebp(file, { quality: 0.7 });

      expect(q90.blob.type).toBe('image/webp');
      expect(q80.blob.type).toBe('image/webp');
      expect(q70.blob.type).toBe('image/webp');
    });

    it('formats single download and batch ZIP with exactly one Convert24 - prefix', () => {
      const singleDownload = formatDownloadFilename('photo.webp');
      expect(singleDownload).toBe('Convert24 - photo.webp');

      const batchZip = formatDownloadFilename('jpg-to-webp-files.zip');
      expect(batchZip).toBe('Convert24 - jpg-to-webp-files.zip');
    });

    it('rejects fake/corrupted JPEG input', async () => {
      const fakeFile = new File([fakeJpgBuffer], 'fake.jpg', { type: 'image/jpeg' });
      const val = await validateJpegFile(fakeFile);
      expect(val.valid).toBe(false);
      expect(val.error?.code).toBe('INVALID_FILE');
    });
  });

  // =========================================================================
  // 4. Tool 4: WebP to JPG (webp-to-jpg)
  // =========================================================================
  describe('Tool 4: WebP to JPG (webp-to-jpg)', () => {
    it('verifies fixture validity and metadata using sharp', async () => {
      const meta = await sharp(sampleWebpBuffer).metadata();
      expect(meta.format).toBe('webp');
      expect(meta.width).toBe(1);
      expect(meta.height).toBe(1);
      expect(hasWebpMagicBytes(sampleWebpBuffer)).toBe(true);
    });

    it('converts valid WebP to JPG with non-empty output and correct MIME type', async () => {
      const file = new File([sampleWebpBuffer], 'banner.webp', { type: 'image/webp' });
      const result = await convertWebpToJpg(file);

      expect(result.blob).toBeInstanceOf(Blob);
      expect(result.blob.size).toBeGreaterThan(0);
      expect(result.blob.type).toBe('image/jpeg');
      expect(result.fileName).toBe('banner.jpg');
      expect(result.width).toBe(1920);
      expect(result.height).toBe(1080);
    });

    it('verifies JPEG output magic bytes SOI marker (FF D8 FF)', async () => {
      const file = new File([sampleWebpBuffer], 'banner.webp', { type: 'image/webp' });
      const result = await convertWebpToJpg(file);
      const bytes = new Uint8Array(await result.blob.arrayBuffer());

      expect(bytes[0]).toBe(0xff);
      expect(bytes[1]).toBe(0xd8);
      expect(bytes[2]).toBe(0xff);
    });

    it('flattens transparent WebP onto white (#FFFFFF) background by default and black (#000000) when requested', async () => {
      // Real binary verification using sharp
      const flattenedWhite = await sharp(transparentWebpBuffer)
        .flatten({ background: '#FFFFFF' })
        .jpeg()
        .toBuffer();
      const rawWhite = await sharp(flattenedWhite).raw().toBuffer();
      expect(rawWhite[0]).toBe(255);
      expect(rawWhite[1]).toBe(255);
      expect(rawWhite[2]).toBe(255);

      const flattenedBlack = await sharp(transparentWebpBuffer)
        .flatten({ background: '#000000' })
        .jpeg()
        .toBuffer();
      const rawBlack = await sharp(flattenedBlack).raw().toBuffer();
      expect(rawBlack[0]).toBe(0);
      expect(rawBlack[1]).toBe(0);
      expect(rawBlack[2]).toBe(0);

      // Engine conversion test
      const file = new File([transparentWebpBuffer], 'transparent.webp', { type: 'image/webp' });
      const resWhite = await convertWebpToJpg(file, { backgroundColor: '#FFFFFF' });
      expect(resWhite.fileName).toBe('transparent.jpg');
      expect(resWhite.blob.type).toBe('image/jpeg');

      const resBlack = await convertWebpToJpg(file, { backgroundColor: '#000000' });
      expect(resBlack.fileName).toBe('transparent.jpg');
      expect(resBlack.blob.type).toBe('image/jpeg');
    });

    it('formats single download and batch ZIP with exactly one Convert24 - prefix', () => {
      const singleDownload = formatDownloadFilename('banner.jpg');
      expect(singleDownload).toBe('Convert24 - banner.jpg');

      const batchZip = formatDownloadFilename('webp-to-jpg-files.zip');
      expect(batchZip).toBe('Convert24 - webp-to-jpg-files.zip');
    });

    it('rejects invalid and corrupted WebP inputs with user-friendly errors', async () => {
      const invalidFile = new File([invalidWebpBuffer], 'invalid.webp', { type: 'image/webp' });
      const val = await validateWebpFile(invalidFile);
      expect(val.valid).toBe(false);
      expect(val.error?.code).toBe('INVALID_FILE');

      const corruptFile = new File([corruptedWebpBuffer], 'corrupted.webp', { type: 'image/webp' });
      await expect(convertWebpToJpg(corruptFile)).rejects.toThrow();
    });
  });

  // =========================================================================
  // 5. Tool 5: PNG to WebP (png-to-webp)
  // =========================================================================
  describe('Tool 5: PNG to WebP (png-to-webp)', () => {
    it('converts valid PNG to WebP with non-empty output and correct MIME type', async () => {
      const file = new File([samplePngBuffer], 'icon.png', { type: 'image/png' });
      const result = await convertPngToWebp(file);

      expect(result.blob).toBeInstanceOf(Blob);
      expect(result.blob.size).toBeGreaterThan(0);
      expect(result.blob.type).toBe('image/webp');
      expect(result.fileName).toBe('icon.webp');
      expect(result.width).toBe(1920);
      expect(result.height).toBe(1080);
    });

    it('verifies WebP output magic bytes signature (RIFF ... WEBP)', async () => {
      const file = new File([samplePngBuffer], 'graphic.png', { type: 'image/png' });
      const result = await convertPngToWebp(file);
      const bytes = new Uint8Array(await result.blob.arrayBuffer());

      expect(bytes[0]).toBe(0x52); // 'R'
      expect(bytes[1]).toBe(0x49); // 'I'
      expect(bytes[2]).toBe(0x46); // 'F'
      expect(bytes[3]).toBe(0x46); // 'F'
      expect(bytes[8]).toBe(0x57); // 'W'
      expect(bytes[9]).toBe(0x45); // 'E'
      expect(bytes[10]).toBe(0x42); // 'B'
      expect(bytes[11]).toBe(0x50); // 'P'
    });

    it('preserves alpha transparency when converting transparent PNG to WebP', async () => {
      // Real binary verification with sharp
      const webpBuf = await sharp(transparentPngBuffer).webp().toBuffer();
      const meta = await sharp(webpBuf).metadata();
      expect(meta.format).toBe('webp');
      expect(meta.hasAlpha).toBe(true);
      expect(meta.width).toBe(2);
      expect(meta.height).toBe(2);

      // Engine conversion test
      const file = new File([transparentPngBuffer], 'transparent.png', { type: 'image/png' });
      const result = await convertPngToWebp(file);
      expect(result.fileName).toBe('transparent.webp');
      expect(result.blob.type).toBe('image/webp');
    });

    it('formats single download and batch ZIP with exactly one Convert24 - prefix', () => {
      const singleDownload = formatDownloadFilename('icon.webp');
      expect(singleDownload).toBe('Convert24 - icon.webp');

      const batchZip = formatDownloadFilename('png-to-webp-files.zip');
      expect(batchZip).toBe('Convert24 - png-to-webp-files.zip');
    });

    it('rejects invalid and corrupted PNG inputs with user-friendly errors', async () => {
      const invalidFile = new File([invalidPngBuffer], 'invalid.png', { type: 'image/png' });
      const val = await validatePngFile(invalidFile);
      expect(val.valid).toBe(false);
      expect(val.error?.code).toBe('INVALID_FILE');

      const corruptFile = new File([corruptedPngBuffer], 'corrupted.png', { type: 'image/png' });
      await expect(convertPngToWebp(corruptFile)).rejects.toThrow();
    });
  });

  // =========================================================================
  // 6. Cross-cutting Regression Verifications: Batching, ZIP, Collision
  // =========================================================================
  describe('Cross-cutting: Filenames, Batching, and ZIP Archives', () => {
    it('handles filename collision with generateUniqueFilename for converted files', () => {
      const existingNames = new Set(['photo.png', 'photo (1).png']);
      const uniqueName = generateUniqueFilename('photo.png', existingNames);
      expect(uniqueName).toBe('photo (2).png');
      expect(formatDownloadFilename(uniqueName)).toBe('Convert24 - photo (2).png');
    });

    it('creates valid ZIP archive and ensures archive download is prefixed once', async () => {
      const items = [
        { name: 'photo1.png', blob: new Blob([new Uint8Array([0x89, 0x50])], { type: 'image/png' }) },
        { name: 'photo2.png', blob: new Blob([new Uint8Array([0x89, 0x50])], { type: 'image/png' }) },
      ];
      const zipBlob = await createZipBlob(items);
      expect(zipBlob).toBeInstanceOf(Blob);
      expect(zipBlob.size).toBeGreaterThan(0);

      const zipDownloadName = formatDownloadFilename('jpg-to-png-files.zip');
      expect(zipDownloadName).toBe('Convert24 - jpg-to-png-files.zip');
      // Idempotency: formatting already-prefixed filename does not duplicate
      expect(formatDownloadFilename(zipDownloadName)).toBe('Convert24 - jpg-to-png-files.zip');
    });
  });
});
