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
  validateJpgToPdfFile,
  validateJpgToPdfBatch,
  JPG_TO_PDF_LIMITS,
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

describe('Tool #16: JPG → PDF Engine & Controller', () => {
  it('should register jpg-to-pdf in Tool Registry with correct metadata', () => {
    const tool = getToolBySlug('jpg-to-pdf');
    expect(tool).toBeDefined();
    expect(tool?.name).toBe('JPG to PDF');
    expect(tool?.category).toBe('image-converter');
    expect(tool?.inputFormats).toEqual(['jpg', 'jpeg']);
    expect(tool?.outputFormats).toEqual(['pdf']);
    expect(tool?.engine).toBe('image-to-pdf');
    expect(tool?.clientSide).toBe(true);

    expect(JPG_TO_PDF_LIMITS.MAX_BATCH_FILES).toBe(20);
    expect(JPG_TO_PDF_LIMITS.MAX_FILE_SIZE).toBe(50 * 1024 * 1024);
    expect(JPG_TO_PDF_LIMITS.ALLOWED_EXTENSIONS).toEqual(['jpg', 'jpeg']);
  });

  describe('Validation', () => {
    it('should validate valid JPEG file (.jpg)', async () => {
      const file = new File([minimalJpgBytes], 'photo.jpg', { type: 'image/jpeg' });
      const result = await validateJpgToPdfFile(file);
      expect(result.valid).toBe(true);
    });

    it('should validate valid JPEG file with .jpeg extension', async () => {
      const file = new File([minimalJpgBytes], 'document.jpeg', { type: 'image/jpeg' });
      const result = await validateJpgToPdfFile(file);
      expect(result.valid).toBe(true);
    });

    it('should reject non-JPG image formats (PNG, WebP, GIF, BMP, SVG, PDF)', async () => {
      const pngFile = new File([minimalPngBytes], 'diagram.png', { type: 'image/png' });
      const webpFile = new File([minimalWebpBytes], 'photo.webp', { type: 'image/webp' });
      const gifFile = new File(['GIF89a...'], 'animation.gif', { type: 'image/gif' });
      const bmpFile = new File(['BM...'], 'bitmap.bmp', { type: 'image/bmp' });
      const svgFile = new File(['<svg></svg>'], 'vector.svg', { type: 'image/svg+xml' });
      const pdfFile = new File(['%PDF-1.4'], 'document.pdf', { type: 'application/pdf' });

      const pngResult = await validateJpgToPdfFile(pngFile);
      expect(pngResult.valid).toBe(false);
      expect(pngResult.error?.code).toBe('UNSUPPORTED_FORMAT');
      expect(pngResult.error?.message).toBe('Only JPG and JPEG images are supported by this tool.');

      const webpResult = await validateJpgToPdfFile(webpFile);
      expect(webpResult.valid).toBe(false);
      expect(webpResult.error?.code).toBe('UNSUPPORTED_FORMAT');

      const gifResult = await validateJpgToPdfFile(gifFile);
      expect(gifResult.valid).toBe(false);

      const bmpResult = await validateJpgToPdfFile(bmpFile);
      expect(bmpResult.valid).toBe(false);

      const svgResult = await validateJpgToPdfFile(svgFile);
      expect(svgResult.valid).toBe(false);

      const pdfResult = await validateJpgToPdfFile(pdfFile);
      expect(pdfResult.valid).toBe(false);
    });

    it('should reject files with spoofed extension and invalid magic bytes', async () => {
      const fakeBytes = new Uint8Array([0x00, 0x01, 0x02, 0x03, 0x04]);
      const file = new File([fakeBytes], 'fake.jpg', { type: 'image/jpeg' });
      const result = await validateJpgToPdfFile(file);
      expect(result.valid).toBe(false);
      expect(result.error?.code).toBe('INVALID_FILE');
      expect(result.error?.message).toBe(
        'This file is not a valid JPG image. Please choose a valid JPG or JPEG file.'
      );
    });

    it('should reject random binary data renamed to .jpg', async () => {
      const randomBytes = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x14]);
      const file = new File([randomBytes], 'archive.jpg', { type: 'image/jpeg' });
      const result = await validateJpgToPdfFile(file);
      expect(result.valid).toBe(false);
      expect(result.error?.code).toBe('INVALID_FILE');
    });

    it('should enforce 50 MB maximum per file limit', async () => {
      const hugeFile = {
        name: 'huge.jpg',
        size: 51 * 1024 * 1024,
        type: 'image/jpeg',
        slice: () => new Blob([minimalJpgBytes]),
      } as unknown as File;

      const result = await validateJpgToPdfFile(hugeFile);
      expect(result.valid).toBe(false);
      expect(result.error?.code).toBe('FILE_TOO_LARGE');
      expect(result.error?.message).toBe('This file is too large. The maximum image size is 50 MB.');
    });

    it('should enforce 20 file batch count limit', () => {
      const dummyFile = new File([minimalJpgBytes], 'test.jpg', { type: 'image/jpeg' });
      const files20 = Array(20).fill(dummyFile);
      const files21 = Array(21).fill(dummyFile);

      expect(validateJpgToPdfBatch(files20).valid).toBe(true);

      const overLimit = validateJpgToPdfBatch(files21);
      expect(overLimit.valid).toBe(false);
      expect(overLimit.error?.code).toBe('INVALID_FILE');
      expect(overLimit.error?.message).toBe('You can convert up to 20 images at a time.');
    });

    it('should reject empty batch', () => {
      const emptyCheck = validateJpgToPdfBatch([]);
      expect(emptyCheck.valid).toBe(false);
      expect(emptyCheck.error?.code).toBe('INVALID_FILE');
      expect(emptyCheck.error?.message).toBe('Please select at least one image.');
    });
  });

  describe('JPEG Header Parsing & Layout', () => {
    it('should parse JPEG dimensions from binary buffer', () => {
      const dims = parseImageDimensionsFromBuffer(minimalJpgBytes);
      expect(dims).toEqual({ width: 1, height: 1 });
    });

    it('should calculate landscape A4 layout for wider JPEG photos in auto orientation', () => {
      const layout = calculatePageLayout(1920, 1080, { orientation: 'auto', margin: 20 });
      expect(layout.pageWidth).toBe(A4_LANDSCAPE_WIDTH);
      expect(layout.pageHeight).toBe(A4_LANDSCAPE_HEIGHT);
      expect(layout.renderedWidth).toBeLessThanOrEqual(A4_LANDSCAPE_WIDTH - 40);
      expect(layout.renderedHeight).toBeLessThanOrEqual(A4_LANDSCAPE_HEIGHT - 40);
      expect(layout.x).toBeGreaterThanOrEqual(20);
      expect(layout.y).toBeGreaterThanOrEqual(20);
    });

    it('should calculate portrait A4 layout for taller JPEG photos in auto orientation', () => {
      const layout = calculatePageLayout(1080, 1920, { orientation: 'auto', margin: 20 });
      expect(layout.pageWidth).toBe(A4_PORTRAIT_WIDTH);
      expect(layout.pageHeight).toBe(A4_PORTRAIT_HEIGHT);
      expect(layout.renderedWidth).toBeLessThanOrEqual(A4_PORTRAIT_WIDTH - 40);
      expect(layout.renderedHeight).toBeLessThanOrEqual(A4_PORTRAIT_HEIGHT - 40);
      expect(layout.x).toBeGreaterThanOrEqual(20);
      expect(layout.y).toBeGreaterThanOrEqual(20);
    });

    it('should honor explicit portrait orientation regardless of photo aspect ratio', () => {
      const layout = calculatePageLayout(1920, 1080, { orientation: 'portrait', margin: 20 });
      expect(layout.pageWidth).toBe(A4_PORTRAIT_WIDTH);
      expect(layout.pageHeight).toBe(A4_PORTRAIT_HEIGHT);
    });

    it('should honor explicit landscape orientation regardless of photo aspect ratio', () => {
      const layout = calculatePageLayout(1080, 1920, { orientation: 'landscape', margin: 20 });
      expect(layout.pageWidth).toBe(A4_LANDSCAPE_WIDTH);
      expect(layout.pageHeight).toBe(A4_LANDSCAPE_HEIGHT);
    });

    it('should preserve aspect ratio and center square images', () => {
      const layout = calculatePageLayout(1200, 1200, { orientation: 'portrait', margin: 20 });
      expect(layout.renderedWidth).toBe(layout.renderedHeight);
      expect(layout.x).toBeCloseTo(20, 1);
    });
  });

  describe('PDF Creation & Page Ordering', () => {
    it('should convert single JPG to one-page PDF with matching filename', async () => {
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

      expect(progressUpdates.length).toBeGreaterThan(0);
      expect(progressUpdates[progressUpdates.length - 1]).toBe(100);
    });

    it('should convert 2 JPGs into a two-page PDF with custom output filename', async () => {
      const file1 = new File([minimalJpgBytes], 'page1.jpg', { type: 'image/jpeg' });
      const file2 = new File([minimalJpgBytes], 'page2.jpeg', { type: 'image/jpeg' });

      const result = await convertImagesToPdf(
        [file1, file2],
        { orientation: 'auto', outputFileName: 'jpg-to-pdf.pdf' }
      );

      expect(result.pageCount).toBe(2);
      expect(result.fileName).toBe('jpg-to-pdf.pdf');
      expect(result.convertedSize).toBeGreaterThan(0);

      const buffer = await result.blob.arrayBuffer();
      const headerStr = new TextDecoder().decode(buffer.slice(0, 5));
      expect(headerStr).toBe('%PDF-');
    });

    it('should convert mixed .jpg and .jpeg files preserving order', async () => {
      const fileA = new File([minimalJpgBytes], 'cover.jpg', { type: 'image/jpeg' });
      const fileB = new File([minimalJpgBytes], 'content.jpeg', { type: 'image/jpeg' });
      const fileC = new File([minimalJpgBytes], 'appendix.jpg', { type: 'image/jpeg' });

      const result = await convertImagesToPdf([fileA, fileB, fileC], {
        orientation: 'auto',
        outputFileName: 'jpg-to-pdf.pdf',
      });

      expect(result.pageCount).toBe(3);
      expect(result.fileName).toBe('jpg-to-pdf.pdf');

      const buffer = await result.blob.arrayBuffer();
      const headerStr = new TextDecoder().decode(buffer.slice(0, 5));
      expect(headerStr).toBe('%PDF-');
    });
  });
});
