// Polyfill Promise.try if not supported in runtime
if (typeof (Promise as unknown as { try?: unknown }).try !== 'function') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (Promise as unknown as { try: (fn: (...args: any[]) => any, ...args: any[]) => Promise<any> }).try = function (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    fn: (...args: any[]) => any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ...args: any[]
  ) {
    return new Promise((resolve) => resolve(fn(...args)));
  };
}

// Polyfill Uint8Array.prototype.toHex if not supported in runtime
if (typeof (Uint8Array.prototype as unknown as { toHex?: unknown }).toHex !== 'function') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (Uint8Array.prototype as any).toHex = function (): string {
    return Array.from(this as Uint8Array)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  };
}

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PDFDocument, rgb } from 'pdf-lib';
import {
  validatePdfToJpgFile,
  validateAndParsePageRange,
} from '@/engines/pdf/validation';
import {
  sanitizePdfBaseName,
  mapJpgQualityToNumber,
  convertPdfToJpg,
} from '@/engines/pdf/pdf-to-jpg';
import * as rendererModule from '@/engines/pdf/renderer';
import { loadPdfDocument } from '@/engines/pdf/loader';
import { hasPdfMagicBytes } from '@/engines/shared/validation';

/**
 * Helper to generate a valid PDF buffer with specified page count.
 */
async function createTestPdfBuffer(pageCount = 1): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pageCount; i++) {
    const page = doc.addPage([200, 300]);
    page.drawText(`Test Page ${i + 1}`, {
      x: 20,
      y: 250,
      size: 14,
      color: rgb(0, 0, 0),
    });
  }
  return await doc.save();
}

describe('Tool #18: PDF to JPG Engine', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. PDF Validation & Signature Check', () => {
    it('accepts valid PDF with %PDF- signature', async () => {
      const pdfBytes = await createTestPdfBuffer(1);
      const file = new File([pdfBytes.buffer as ArrayBuffer], 'sample.pdf', {
        type: 'application/pdf',
      });
      const result = await validatePdfToJpgFile(file);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('identifies %PDF- magic bytes correctly', async () => {
      const pdfBytes = await createTestPdfBuffer(1);
      expect(hasPdfMagicBytes(pdfBytes)).toBe(true);

      const fakeJpg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00]);
      expect(hasPdfMagicBytes(fakeJpg)).toBe(false);
    });

    it('rejects non-PDF extensions (e.g. .png, .jpg)', async () => {
      const file = new File(['fake content'], 'image.png', { type: 'image/png' });
      const result = await validatePdfToJpgFile(file);
      expect(result.valid).toBe(false);
      expect(result.error?.code).toBe('UNSUPPORTED_FORMAT');
    });

    it('rejects spoofed files (PDF extension with non-PDF binary header)', async () => {
      const spoofedBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      const file = new File([spoofedBytes.buffer], 'spoofed.pdf', {
        type: 'application/pdf',
      });
      const result = await validatePdfToJpgFile(file);
      expect(result.valid).toBe(false);
      expect(result.error?.message).toContain('not a valid PDF');
    });

    it('rejects empty PDF files (0 bytes)', async () => {
      const file = new File([], 'empty.pdf', { type: 'application/pdf' });
      const result = await validatePdfToJpgFile(file);
      expect(result.valid).toBe(false);
      expect(result.error?.message).toContain('empty');
    });

    it('rejects files larger than 100 MB', async () => {
      const oversizedFile = new File(['a'], 'oversized.pdf', {
        type: 'application/pdf',
      });
      Object.defineProperty(oversizedFile, 'size', {
        value: 101 * 1024 * 1024,
        writable: false,
      });

      const result = await validatePdfToJpgFile(oversizedFile);
      expect(result.valid).toBe(false);
      expect(result.error?.code).toBe('FILE_TOO_LARGE');
    });
  });

  describe('2. Page Range Parsing & Strict Validation', () => {
    const totalPages = 10;

    it('parses single page correctly', () => {
      const res = validateAndParsePageRange('4', totalPages);
      expect(res.valid).toBe(true);
      expect(res.pages).toEqual([4]);
    });

    it('parses page ranges correctly (e.g. 1-4)', () => {
      const res = validateAndParsePageRange('1-4', totalPages);
      expect(res.valid).toBe(true);
      expect(res.pages).toEqual([1, 2, 3, 4]);
    });

    it('parses comma-separated pages and ranges (e.g. 1, 3-5, 8)', () => {
      const res = validateAndParsePageRange('1, 3-5, 8', totalPages);
      expect(res.valid).toBe(true);
      expect(res.pages).toEqual([1, 3, 4, 5, 8]);
    });

    it('deduplicates overlapping page selections and sorts them', () => {
      const res = validateAndParsePageRange('3, 1-4, 2', totalPages);
      expect(res.valid).toBe(true);
      expect(res.pages).toEqual([1, 2, 3, 4]);
    });

    it('rejects page number 0', () => {
      const res = validateAndParsePageRange('0', totalPages);
      expect(res.valid).toBe(false);
      expect(res.error).toContain('out of range');
    });

    it('rejects negative page numbers', () => {
      const res = validateAndParsePageRange('-1', totalPages);
      expect(res.valid).toBe(false);
    });

    it('rejects page numbers greater than document page count', () => {
      const res = validateAndParsePageRange('15', totalPages);
      expect(res.valid).toBe(false);
      expect(res.error).toContain('out of range');
    });

    it('rejects invalid range ordering where start > end (e.g. 5-2)', () => {
      const res = validateAndParsePageRange('5-2', totalPages);
      expect(res.valid).toBe(false);
      expect(res.error).toContain('cannot be greater');
    });

    it('rejects malformed range expressions (e.g. 1--, abc, 1-a)', () => {
      expect(validateAndParsePageRange('abc', totalPages).valid).toBe(false);
      expect(validateAndParsePageRange('1--', totalPages).valid).toBe(false);
      expect(validateAndParsePageRange('1, , 3', totalPages).valid).toBe(false);
    });

    it('rejects empty input string', () => {
      const res = validateAndParsePageRange('   ', totalPages);
      expect(res.valid).toBe(false);
      expect(res.error).toContain('Select at least one page');
    });
  });

  describe('3. Base Name Sanitization & Output Naming', () => {
    it('sanitizes unsafe characters, directory traversal, and null bytes', () => {
      expect(sanitizePdfBaseName('my-doc.pdf')).toBe('my-doc');
      expect(sanitizePdfBaseName('../../etc/passwd.pdf')).toBe('etc-passwd');
      expect(sanitizePdfBaseName('cool\x00file?.pdf')).toBe('coolfile');
      expect(sanitizePdfBaseName('.pdf')).toBe('document');
    });

    it('correctly maps JPG quality levels', () => {
      expect(mapJpgQualityToNumber('high')).toBe(0.9);
      expect(mapJpgQualityToNumber('medium')).toBe(0.8);
      expect(mapJpgQualityToNumber('low')).toBe(0.7);
    });
  });

  describe('4. PDF Loading & Page Count Detection', () => {
    it('loads PDF and correctly identifies page count', async () => {
      const pdfBytes = await createTestPdfBuffer(3);
      const loaded = await loadPdfDocument(pdfBytes.buffer as ArrayBuffer);
      expect(loaded.pageCount).toBe(3);
      expect(loaded.pdfDoc).toBeDefined();
    });

    it('handles unreadable / corrupted PDF data gracefully', async () => {
      const garbageBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x00, 0x01, 0x02]);
      await expect(loadPdfDocument(garbageBytes.buffer)).rejects.toThrow();
    });
  });

  describe('5. Memory & Large Page Limits Protection', () => {
    it('rejects render when calculated dimensions exceed safety limits', async () => {
      const mockPage = {
        getViewport: () => ({ width: 10000, height: 10000 }),
        render: vi.fn(),
        cleanup: vi.fn(),
      };
      const mockPdfDoc = {
        numPages: 1,
        getPage: vi.fn().mockResolvedValue(mockPage),
      };

      await expect(
        rendererModule.renderPdfPageToCanvas(
          mockPdfDoc as unknown as Parameters<typeof rendererModule.renderPdfPageToCanvas>[0],
          { pageNumber: 1, scale: 2 }
        )
      ).rejects.toThrow(/memory/i);
    });
  });

  describe('6. End-to-End PDF to JPG Conversion Flow', () => {
    beforeEach(() => {
      // In Node test environment, mock renderPdfPageToJpg to return mock JPEG blob
      vi.spyOn(rendererModule, 'renderPdfPageToJpg').mockImplementation(
        async (_pdfDoc, options) => {
          const fakeJpgBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
          return {
            blob: new Blob([fakeJpgBytes], { type: 'image/jpeg' }),
            width: Math.floor(600 * (options.scale || 1.5)),
            height: Math.floor(900 * (options.scale || 1.5)),
          };
        }
      );
    });

    it('converts single selected page to single JPG output', async () => {
      const pdfBytes = await createTestPdfBuffer(2);
      const file = new File([pdfBytes.buffer as ArrayBuffer], 'invoice.pdf', {
        type: 'application/pdf',
      });

      const result = await convertPdfToJpg(file, {
        selectedPages: [1],
        scale: 1.5,
        quality: 'high',
      });

      expect(result.originalFileName).toBe('invoice.pdf');
      expect(result.totalPages).toBe(2);
      expect(result.convertedCount).toBe(1);
      expect(result.pages.length).toBe(1);
      expect(result.pages[0].pageNumber).toBe(1);
      expect(result.pages[0].fileName).toBe('invoice-page-1.jpg');
      expect(result.zipBlob).toBeUndefined();
    });

    it('converts multiple selected pages and generates ZIP archive', async () => {
      const pdfBytes = await createTestPdfBuffer(3);
      const file = new File([pdfBytes.buffer as ArrayBuffer], 'presentation.pdf', {
        type: 'application/pdf',
      });

      const result = await convertPdfToJpg(file, {
        selectedPages: [1, 3],
        scale: 1.0,
        quality: 'medium',
      });

      expect(result.convertedCount).toBe(2);
      expect(result.pages.length).toBe(2);
      expect(result.pages[0].fileName).toBe('presentation-page-1.jpg');
      expect(result.pages[1].fileName).toBe('presentation-page-3.jpg');
      expect(result.zipBlob).toBeDefined();
      expect(result.zipFileName).toBe('presentation-jpg-images.zip');
    });

    it('throws error when no valid pages are selected', async () => {
      const pdfBytes = await createTestPdfBuffer(1);
      const file = new File([pdfBytes.buffer as ArrayBuffer], 'test.pdf', {
        type: 'application/pdf',
      });

      await expect(
        convertPdfToJpg(file, {
          selectedPages: [],
        })
      ).rejects.toThrow('Select at least one page');
    });
  });
});
