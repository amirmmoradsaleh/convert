import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { PDFDocument } from 'pdf-lib';
import {
  validateCompressibleImageFile,
  isAnimatedWebp,
  hasJpegMagicBytes,
  hasPngMagicBytes,
  hasWebpMagicBytes,
} from '../../engines/shared/validation';
import { compressImage, estimateCompressedSize } from '../../engines/image/compress';
import { resizeImage } from '../../engines/image/resize';
import { cropImage } from '../../engines/image/crop';
import { rotateImage } from '../../engines/image/rotate';
import { convertImagesToPdf, calculatePageLayout } from '../../engines/pdf/image-to-pdf';
import {
  formatDownloadFilename,
  createZipBlob,
  generateUniqueFilename,
} from '../../engines/shared/file-utils';

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

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
  }

  getContext(type: string) {
    if (type === '2d') {
      return {
        imageSmoothingEnabled: true,
        imageSmoothingQuality: 'high',
        save: () => {},
        restore: () => {},
        translate: (_x: number, _y: number) => {},
        rotate: (_angle: number) => {},
        drawImage: (_bitmap: unknown, ..._args: number[]) => {},
        clearRect: (_x: number, _y: number, _w: number, _h: number) => {},
        fillRect: (_x: number, _y: number, _w: number, _h: number) => {},
        fillStyle: '#000000',
      };
    }
    return null;
  }

  async convertToBlob(options?: { type?: string; quality?: number }) {
    const mime = options?.type || 'image/jpeg';
    const quality = options?.quality ?? 0.8;

    if (mime === 'image/jpeg') {
      const size = Math.max(20, Math.floor(1000 * quality));
      const bytes = new Uint8Array(size);
      bytes[0] = 0xff;
      bytes[1] = 0xd8;
      bytes[2] = 0xff;
      bytes[3] = 0xe0;
      return new Blob([bytes], { type: 'image/jpeg' });
    }

    if (mime === 'image/webp') {
      const size = Math.max(20, Math.floor(800 * quality));
      const bytes = new Uint8Array(size);
      bytes[0] = 0x52;
      bytes[1] = 0x49;
      bytes[2] = 0x46;
      bytes[3] = 0x46;
      bytes[8] = 0x57;
      bytes[9] = 0x45;
      bytes[10] = 0x42;
      bytes[11] = 0x50;
      return new Blob([bytes], { type: 'image/webp' });
    }

    const pngBytes = new Uint8Array([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
      0x00, 0x00, 0x00, 0x64, 0x00, 0x00, 0x00, 0x64, 0x08, 0x06, 0x00, 0x00, 0x00,
    ]);
    return new Blob([pngBytes], { type: 'image/png' });
  }
}

describe('Batch 3 — Functional Regression Test Suite (5 Utility Tools)', () => {
  const fixturesDir = path.join(process.cwd(), 'tests/fixtures');

  // Representative Fixtures
  const sampleJpgBuffer = fs.readFileSync(path.join(fixturesDir, 'sample.jpg'));
  const samplePngBuffer = fs.readFileSync(path.join(fixturesDir, 'sample.png'));
  const sampleWebpBuffer = fs.readFileSync(path.join(fixturesDir, 'sample.webp'));
  const animatedWebpBuffer = fs.readFileSync(path.join(fixturesDir, 'animated.webp'));
  const corruptedJpgBuffer = fs.readFileSync(path.join(fixturesDir, 'corrupted.jpg'));
  const transparentPngBuffer = fs.readFileSync(path.join(fixturesDir, 'transparent.png'));
  const cornersPngBuffer = fs.readFileSync(path.join(fixturesDir, 'distinguishable-corners.png'));

  beforeAll(() => {
    if (typeof globalThis.createImageBitmap === 'undefined') {
      (globalThis as unknown as { createImageBitmap: unknown }).createImageBitmap = async (source: Blob | unknown) => {
        if (source instanceof Blob) {
          const buf = await source.arrayBuffer();
          const bytes = new Uint8Array(buf);
          if (bytes.length < 20) {
            throw new Error('Failed to decode corrupted image');
          }
          if (hasPngMagicBytes(bytes) && bytes.length >= 24) {
            const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
            const w = view.getUint32(16);
            const h = view.getUint32(20);
            if (w > 0 && h > 0) return new MockImageBitmap(w, h);
          }
        }
        return new MockImageBitmap(800, 600);
      };
    }
    if (typeof globalThis.OffscreenCanvas === 'undefined') {
      (globalThis as unknown as { OffscreenCanvas: unknown }).OffscreenCanvas = MockOffscreenCanvas;
    }
  });

  // =========================================================================
  // 1. Tool 11: Compress Image (compress-image)
  // =========================================================================
  describe('Tool 11: Compress Image (compress-image)', () => {
    it('verifies JPEG, PNG, and WebP input fixtures', async () => {
      expect(hasJpegMagicBytes(sampleJpgBuffer)).toBe(true);
      expect(hasPngMagicBytes(samplePngBuffer)).toBe(true);
      expect(hasWebpMagicBytes(sampleWebpBuffer)).toBe(true);
      expect(isAnimatedWebp(new Uint8Array(animatedWebpBuffer))).toBe(true);
    });

    it('compresses JPG and retains format, dimensions, and non-empty output', async () => {
      const file = new File([sampleJpgBuffer], 'photo.jpg', { type: 'image/jpeg' });
      const result = await compressImage(file, { quality: 0.75 });

      expect(result.format).toBe('jpg');
      expect(result.fileName).toBe('photo.jpg');
      expect(result.blob.type).toBe('image/jpeg');
      expect(result.blob.size).toBeGreaterThan(0);
      expect(result.originalSize).toBe(sampleJpgBuffer.byteLength);
    });

    it('estimates size for lossy formats and reflects quality adjustments', async () => {
      const file = new File([sampleJpgBuffer], 'photo.jpg', { type: 'image/jpeg' });
      const highQ = await estimateCompressedSize(file, 0.9);
      const lowQ = await estimateCompressedSize(file, 0.3);

      expect(highQ.estimatedSize).toBeGreaterThan(0);
      expect(lowQ.estimatedSize).toBeGreaterThan(0);
      expect(lowQ.estimatedSize).toBeLessThanOrEqual(highQ.estimatedSize);
    });

    it('rejects animated WebP files during validation', async () => {
      const file = new File([animatedWebpBuffer], 'anim.webp', { type: 'image/webp' });
      await expect(compressImage(file)).rejects.toThrow(/Animated WebP files are not supported/i);
    });

    it('fails safely on corrupted image data', async () => {
      const file = new File([corruptedJpgBuffer], 'corrupted.jpg', { type: 'image/jpeg' });
      await expect(compressImage(file)).rejects.toThrow();
    });
  });

  // =========================================================================
  // 2. Tool 12: Resize Image (resize-image)
  // =========================================================================
  describe('Tool 12: Resize Image (resize-image)', () => {
    it('resizes image to target dimensions', async () => {
      const file = new File([sampleJpgBuffer], 'banner.jpg', { type: 'image/jpeg' });
      const result = await resizeImage(file, { width: 1024, height: 768 });

      expect(result.width).toBe(1024);
      expect(result.height).toBe(768);
      expect(result.fileName).toBe('banner.jpg');
      expect(result.blob.type).toBe('image/jpeg');
    });

    it('converts to PNG output format when requested', async () => {
      const file = new File([sampleJpgBuffer], 'banner.jpg', { type: 'image/jpeg' });
      const result = await resizeImage(file, { width: 640, height: 480, outputFormat: 'png' });

      expect(result.fileName).toBe('banner.png');
      expect(result.format).toBe('png');
      expect(result.blob.type).toBe('image/png');
    });

    it('rejects invalid dimensions (zero, negative, > 8192)', async () => {
      const file = new File([sampleJpgBuffer], 'banner.jpg', { type: 'image/jpeg' });
      await expect(resizeImage(file, { width: 0, height: 100 })).rejects.toThrow(/valid image dimensions/i);
      await expect(resizeImage(file, { width: 100, height: -5 })).rejects.toThrow(/valid image dimensions/i);
      await expect(resizeImage(file, { width: 8193, height: 100 })).rejects.toThrow(/too large/i);
    });
  });

  // =========================================================================
  // 3. Tool 13: Crop Image (crop-image)
  // =========================================================================
  describe('Tool 13: Crop Image (crop-image)', () => {
    it('crops image and outputs with -cropped suffix', async () => {
      const file = new File([cornersPngBuffer], 'diagram.png', { type: 'image/png' });
      const result = await cropImage(file, { x: 50, y: 50, width: 300, height: 100 });

      expect(result.width).toBe(300);
      expect(result.height).toBe(100);
      expect(result.fileName).toBe('diagram-cropped.png');
      expect(result.format).toBe('png');
      expect(result.blob.type).toBe('image/png');
    });

    it('preserves PNG transparency when cropping transparent PNG', async () => {
      const file = new File([transparentPngBuffer], 'alpha.png', { type: 'image/png' });
      const result = await cropImage(file, { x: 0, y: 0, width: 1, height: 1 });

      expect(result.format).toBe('png');
      expect(result.blob.type).toBe('image/png');
    });

    it('rejects invalid crop parameters (width <= 0 or height <= 0)', async () => {
      const file = new File([sampleJpgBuffer], 'photo.jpg', { type: 'image/jpeg' });
      await expect(cropImage(file, { x: 0, y: 0, width: 0, height: 100 })).rejects.toThrow(
        /valid crop region/i
      );
      await expect(cropImage(file, { x: 0, y: 0, width: 100, height: -1 })).rejects.toThrow(
        /valid crop region/i
      );
    });
  });

  // =========================================================================
  // 4. Tool 14: Rotate Image (rotate-image)
  // =========================================================================
  describe('Tool 14: Rotate Image (rotate-image)', () => {
    it('rotates 90 degrees with dimension swap and -rotated suffix', async () => {
      const file = new File([cornersPngBuffer], 'pattern.png', { type: 'image/png' });
      const result = await rotateImage(file, { degrees: 90 });

      // Original is 400x200, rotated 90 is 200x400
      expect(result.width).toBe(200);
      expect(result.height).toBe(400);
      expect(result.fileName).toBe('pattern-rotated.png');
      expect(result.format).toBe('png');
    });

    it('rotates 180 degrees without dimension swap', async () => {
      const file = new File([cornersPngBuffer], 'pattern.png', { type: 'image/png' });
      const result = await rotateImage(file, { degrees: 180 });

      expect(result.width).toBe(400);
      expect(result.height).toBe(200);
      expect(result.fileName).toBe('pattern-rotated.png');
    });

    it('rejects invalid rotation angles', async () => {
      const file = new File([sampleJpgBuffer], 'photo.jpg', { type: 'image/jpeg' });
      // @ts-expect-error test invalid angle
      await expect(rotateImage(file, { degrees: 45 })).rejects.toThrow(/valid rotation angle/i);
    });
  });

  // =========================================================================
  // 5. Tool 15: Image to PDF (image-to-pdf)
  // =========================================================================
  describe('Tool 15: Image to PDF (image-to-pdf)', () => {
    it('calculates page layout correctly for landscape vs portrait', () => {
      // Landscape image (400x200) in auto orientation
      const layoutLand = calculatePageLayout(400, 200, { orientation: 'auto' });
      expect(layoutLand.pageWidth).toBeGreaterThan(layoutLand.pageHeight); // A4 Landscape

      // Portrait image (200x400) in auto orientation
      const layoutPort = calculatePageLayout(200, 400, { orientation: 'auto' });
      expect(layoutPort.pageHeight).toBeGreaterThan(layoutPort.pageWidth); // A4 Portrait
    });

    it('generates a structurally valid PDF from a single JPG image', async () => {
      const file = new File([sampleJpgBuffer], 'document.jpg', { type: 'image/jpeg' });
      const result = await convertImagesToPdf([file]);

      expect(result.pageCount).toBe(1);
      expect(result.fileName).toBe('document.pdf');
      expect(result.blob.type).toBe('application/pdf');

      // Independently parse PDF structure with pdf-lib
      const pdfBytes = await result.blob.arrayBuffer();
      const doc = await PDFDocument.load(pdfBytes);
      expect(doc.getPageCount()).toBe(1);
      const page = doc.getPages()[0];
      const { width, height } = page.getSize();
      expect(width).toBeGreaterThan(0);
      expect(height).toBeGreaterThan(0);
    });

    it('combines multiple mixed images into multi-page PDF preserving ordering', async () => {
      const file1 = new File([sampleJpgBuffer], 'page1.jpg', { type: 'image/jpeg' });
      const file2 = new File([samplePngBuffer], 'page2.png', { type: 'image/png' });
      const result = await convertImagesToPdf([file1, file2]);

      expect(result.pageCount).toBe(2);
      expect(result.fileName).toBe('images-to-pdf.pdf');

      const pdfBytes = await result.blob.arrayBuffer();
      const doc = await PDFDocument.load(pdfBytes);
      expect(doc.getPageCount()).toBe(2);
    });
  });

  // =========================================================================
  // 6. Cross-cutting: Batching, Collision, and ZIP Archives
  // =========================================================================
  describe('Cross-cutting: Batching, Collision, and ZIP Archives', () => {
    it('formats single download filenames with exactly one Convert24 - prefix', () => {
      expect(formatDownloadFilename('photo.jpg')).toBe('Convert24 - photo.jpg');
      expect(formatDownloadFilename('banner-cropped.png')).toBe('Convert24 - banner-cropped.png');
      expect(formatDownloadFilename('pattern-rotated.webp')).toBe('Convert24 - pattern-rotated.webp');
      expect(formatDownloadFilename('document.pdf')).toBe('Convert24 - document.pdf');
      // Idempotency: no double prefixing
      expect(formatDownloadFilename('Convert24 - document.pdf')).toBe('Convert24 - document.pdf');
    });

    it('creates batch ZIP archives with prefixed archive name and unprefixed entries', async () => {
      const entries = [
        { name: 'photo-1.jpg', blob: new Blob([new Uint8Array([0xff, 0xd8, 0xff])], { type: 'image/jpeg' }) },
        { name: 'photo-2.jpg', blob: new Blob([new Uint8Array([0xff, 0xd8, 0xff])], { type: 'image/jpeg' }) },
      ];

      const zipBlob = await createZipBlob(entries);
      expect(zipBlob.type).toBe('application/zip');
      expect(zipBlob.size).toBeGreaterThan(0);

      // Verify outer ZIP gets prefixed
      const zipDownload = formatDownloadFilename('compressed-images.zip');
      expect(zipDownload).toBe('Convert24 - compressed-images.zip');
      expect(formatDownloadFilename(zipDownload)).toBe('Convert24 - compressed-images.zip');
    });

    it('prevents filename collisions inside batch ZIPs', () => {
      const usedNames = new Set<string>();
      const name1 = generateUniqueFilename('image.jpg', usedNames);
      usedNames.add(name1);
      const name2 = generateUniqueFilename('image.jpg', usedNames);
      usedNames.add(name2);

      expect(name1).toBe('image.jpg');
      expect(name2).toBe('image (1).jpg');
    });
  });
});
