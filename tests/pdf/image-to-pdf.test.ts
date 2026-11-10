import { describe, it, expect } from 'vitest';
import {
  convertImagesToPdf,
  calculatePageLayout,
  parseImageDimensionsFromBuffer,
  A4_PORTRAIT_WIDTH,
  A4_PORTRAIT_HEIGHT,
  A4_LANDSCAPE_WIDTH,
  A4_LANDSCAPE_HEIGHT,
} from '../../engines/pdf/image-to-pdf';
import {
  validateImageToPdfFile,
  validateImageToPdfBatch,
  IMAGE_TO_PDF_LIMITS,
} from '../../engines/pdf/validation';
import { getToolBySlug } from '../../lib/tools';

const minimalJpgBytes = new Uint8Array([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x01, 0x00, 0x48,
  0x00, 0x48, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43, 0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08,
  0x07, 0x07, 0x07, 0x09, 0x09, 0x08, 0x0a, 0x0c, 0x14, 0x0d, 0x0c, 0x0b, 0x0b, 0x0c, 0x19, 0x12,
  0x13, 0x0f, 0x14, 0x1d, 0x1a, 0x1f, 0x1e, 0x1d, 0x1a, 0x1c, 0x1c, 0x20, 0x24, 0x2e, 0x27, 0x20,
  0x22, 0x2c, 0x23, 0x1c, 0x1c, 0x28, 0x37, 0x29, 0x2c, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1f, 0x27,
  0x39, 0x3d, 0x38, 0x32, 0x3c, 0x2e, 0x33, 0x34, 0x32, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01,
  0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xff, 0xc4, 0x00, 0x1f, 0x00, 0x00, 0x01, 0x05, 0x01, 0x01,
  0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04,
  0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f,
  0x00, 0xbf, 0x00, 0xff, 0xd9,
]);

const minimalPngBytes = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
  0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
  0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae,
  0x42, 0x60, 0x82,
]);

const minimalWebpBytes = new Uint8Array([
  0x52, 0x49, 0x46, 0x46, 0x1a, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x20,
  0x0e, 0x00, 0x00, 0x00, 0xb0, 0x01, 0x00, 0x9d, 0x01, 0x2a, 0x01, 0x00, 0x01, 0x00, 0x00, 0x34,
  0x25, 0xa4,
]);

const animatedWebpBytes = new Uint8Array([
  0x52, 0x49, 0x46, 0x46, 0x30, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x58,
  0x0a, 0x00, 0x00, 0x00, 0x02, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x41, 0x4e,
  0x49, 0x4d, 0x06, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
]);

describe('Image → PDF Engine', () => {
  it('should register image-to-pdf in Tool Registry with correct metadata', () => {
    const tool = getToolBySlug('image-to-pdf');
    expect(tool).toBeDefined();
    expect(tool?.name).toBe('Image to PDF');
    expect(tool?.category).toBe('image-converter');
    expect(tool?.inputFormats).toEqual(['jpg', 'jpeg', 'png', 'webp']);
    expect(tool?.outputFormats).toEqual(['pdf']);
    expect(tool?.clientSide).toBe(true);

    expect(IMAGE_TO_PDF_LIMITS.MAX_BATCH_FILES).toBe(20);
    expect(IMAGE_TO_PDF_LIMITS.MAX_FILE_SIZE).toBe(50 * 1024 * 1024);
  });

  describe('Validation', () => {
    it('should validate valid JPEG file', async () => {
      const file = new File([minimalJpgBytes], 'photo.jpg', { type: 'image/jpeg' });
      const result = await validateImageToPdfFile(file);
      expect(result.valid).toBe(true);
    });

    it('should validate valid PNG file', async () => {
      const file = new File([minimalPngBytes], 'diagram.png', { type: 'image/png' });
      const result = await validateImageToPdfFile(file);
      expect(result.valid).toBe(true);
    });

    it('should validate valid static WebP file', async () => {
      const file = new File([minimalWebpBytes], 'graphic.webp', { type: 'image/webp' });
      const result = await validateImageToPdfFile(file);
      expect(result.valid).toBe(true);
    });

    it('should reject animated WebP file', async () => {
      const file = new File([animatedWebpBytes], 'animation.webp', { type: 'image/webp' });
      const result = await validateImageToPdfFile(file);
      expect(result.valid).toBe(false);
      expect(result.error?.code).toBe('UNSUPPORTED_FORMAT');
    });

    it('should reject invalid magic bytes for JPEG', async () => {
      const fakeBytes = new Uint8Array([0x00, 0x01, 0x02, 0x03]);
      const file = new File([fakeBytes], 'fake.jpg', { type: 'image/jpeg' });
      const result = await validateImageToPdfFile(file);
      expect(result.valid).toBe(false);
      expect(result.error?.code).toBe('INVALID_FILE');
    });

    it('should reject unsupported formats (SVG, BMP, GIF, PDF)', async () => {
      const svgFile = new File(['<svg></svg>'], 'vector.svg', { type: 'image/svg+xml' });
      const bmpFile = new File(['BM...'], 'bitmap.bmp', { type: 'image/bmp' });
      const gifFile = new File(['GIF89a...'], 'graphic.gif', { type: 'image/gif' });
      const pdfFile = new File(['%PDF-1.4'], 'doc.pdf', { type: 'application/pdf' });

      expect((await validateImageToPdfFile(svgFile)).valid).toBe(false);
      expect((await validateImageToPdfFile(bmpFile)).valid).toBe(false);
      expect((await validateImageToPdfFile(gifFile)).valid).toBe(false);
      expect((await validateImageToPdfFile(pdfFile)).valid).toBe(false);
    });

    it('should enforce 50 MB maximum per file limit', async () => {
      const hugeFile = {
        name: 'huge.jpg',
        size: 51 * 1024 * 1024,
        type: 'image/jpeg',
      } as unknown as File;

      const result = await validateImageToPdfFile(hugeFile);
      expect(result.valid).toBe(false);
      expect(result.error?.code).toBe('FILE_TOO_LARGE');
    });

    it('should enforce 20 file batch count limit', () => {
      const dummyFile = new File([minimalJpgBytes], 'test.jpg', { type: 'image/jpeg' });
      const files20 = Array(20).fill(dummyFile);
      const files21 = Array(21).fill(dummyFile);

      expect(validateImageToPdfBatch(files20).valid).toBe(true);

      const overLimit = validateImageToPdfBatch(files21);
      expect(overLimit.valid).toBe(false);
      expect(overLimit.error?.code).toBe('INVALID_FILE');
    });

    it('should reject empty batch', () => {
      const emptyCheck = validateImageToPdfBatch([]);
      expect(emptyCheck.valid).toBe(false);
      expect(emptyCheck.error?.code).toBe('INVALID_FILE');
    });
  });

  describe('Dimensions & Page Layout Calculation', () => {
    it('should parse JPEG dimensions from binary buffer', () => {
      const dims = parseImageDimensionsFromBuffer(minimalJpgBytes);
      expect(dims).toEqual({ width: 1, height: 1 });
    });

    it('should parse PNG dimensions from binary buffer', () => {
      const dims = parseImageDimensionsFromBuffer(minimalPngBytes);
      expect(dims).toEqual({ width: 1, height: 1 });
    });

    it('should calculate landscape A4 layout for wider images in auto orientation', () => {
      const layout = calculatePageLayout(1600, 900, { orientation: 'auto', margin: 20 });
      expect(layout.pageWidth).toBe(A4_LANDSCAPE_WIDTH);
      expect(layout.pageHeight).toBe(A4_LANDSCAPE_HEIGHT);
      expect(layout.renderedWidth).toBeLessThanOrEqual(A4_LANDSCAPE_WIDTH - 40);
      expect(layout.renderedHeight).toBeLessThanOrEqual(A4_LANDSCAPE_HEIGHT - 40);
      // Margins and centering
      expect(layout.x).toBeGreaterThanOrEqual(20);
      expect(layout.y).toBeGreaterThanOrEqual(20);
    });

    it('should calculate portrait A4 layout for taller images in auto orientation', () => {
      const layout = calculatePageLayout(800, 1200, { orientation: 'auto', margin: 20 });
      expect(layout.pageWidth).toBe(A4_PORTRAIT_WIDTH);
      expect(layout.pageHeight).toBe(A4_PORTRAIT_HEIGHT);
      expect(layout.renderedWidth).toBeLessThanOrEqual(A4_PORTRAIT_WIDTH - 40);
      expect(layout.renderedHeight).toBeLessThanOrEqual(A4_PORTRAIT_HEIGHT - 40);
      expect(layout.x).toBeGreaterThanOrEqual(20);
      expect(layout.y).toBeGreaterThanOrEqual(20);
    });

    it('should honor explicit portrait orientation regardless of aspect ratio', () => {
      const layout = calculatePageLayout(1600, 900, { orientation: 'portrait', margin: 20 });
      expect(layout.pageWidth).toBe(A4_PORTRAIT_WIDTH);
      expect(layout.pageHeight).toBe(A4_PORTRAIT_HEIGHT);
    });

    it('should honor explicit landscape orientation regardless of aspect ratio', () => {
      const layout = calculatePageLayout(800, 1200, { orientation: 'landscape', margin: 20 });
      expect(layout.pageWidth).toBe(A4_LANDSCAPE_WIDTH);
      expect(layout.pageHeight).toBe(A4_LANDSCAPE_HEIGHT);
    });

    it('should strictly contain square images inside page margins', () => {
      const layout = calculatePageLayout(1000, 1000, { orientation: 'portrait', margin: 20 });
      const availableWidth = A4_PORTRAIT_WIDTH - 40;
      expect(layout.renderedWidth).toBeCloseTo(availableWidth, 1);
      expect(layout.renderedHeight).toBeCloseTo(availableWidth, 1);
      expect(layout.x).toBeCloseTo(20, 1);
    });
  });

  describe('PDF Document Generation', () => {
    it('should convert single JPEG to valid PDF', async () => {
      const file = new File([minimalJpgBytes], 'photo.jpg', { type: 'image/jpeg' });
      const progressUpdates: number[] = [];

      const result = await convertImagesToPdf([file], { orientation: 'auto' }, (p) => {
        progressUpdates.push(p.progress);
      });

      expect(result.blob).toBeInstanceOf(Blob);
      expect(result.blob.type).toBe('application/pdf');
      expect(result.fileName).toBe('photo.pdf');
      expect(result.pageCount).toBe(1);
      expect(result.convertedSize).toBeGreaterThan(0);

      // Verify PDF header %PDF-
      const buffer = await result.blob.arrayBuffer();
      const headerStr = new TextDecoder().decode(buffer.slice(0, 5));
      expect(headerStr).toBe('%PDF-');

      // Verify progress tracking
      expect(progressUpdates.length).toBeGreaterThan(0);
      expect(progressUpdates[progressUpdates.length - 1]).toBe(100);
    });

    it('should convert single PNG to valid PDF', async () => {
      const file = new File([minimalPngBytes], 'graphic.png', { type: 'image/png' });
      const result = await convertImagesToPdf([file]);

      expect(result.pageCount).toBe(1);
      expect(result.fileName).toBe('graphic.pdf');
      const buffer = await result.blob.arrayBuffer();
      const headerStr = new TextDecoder().decode(buffer.slice(0, 5));
      expect(headerStr).toBe('%PDF-');
    });

    it('should convert multiple mixed images (JPG + PNG + WebP) into one multi-page PDF', async () => {
      const jpgFile = new File([minimalJpgBytes], 'image-1.jpg', { type: 'image/jpeg' });
      const pngFile = new File([minimalPngBytes], 'image-2.png', { type: 'image/png' });
      const webpFile = new File([minimalWebpBytes], 'image-3.webp', { type: 'image/webp' });

      const files = [jpgFile, pngFile, webpFile];
      const result = await convertImagesToPdf(files, { orientation: 'auto' });

      expect(result.pageCount).toBe(3);
      expect(result.fileName).toBe('images-to-pdf.pdf');
      expect(result.convertedSize).toBeGreaterThan(0);

      const buffer = await result.blob.arrayBuffer();
      const headerStr = new TextDecoder().decode(buffer.slice(0, 5));
      expect(headerStr).toBe('%PDF-');
    });
  });
});
