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
  validatePdfToPngFile,
  validateAndParsePageRange,
} from '@/engines/pdf/validation';
import {
  sanitizePdfBaseName,
  convertPdfToPng,
} from '@/engines/pdf/pdf-to-png';
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

describe('Tool #19: PDF to PNG Engine', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. PDF Validation & Signature Check', () => {
    it('accepts valid PDF with %PDF- signature', async () => {
      const pdfBytes = await createTestPdfBuffer(1);
      const file = new File([pdfBytes.buffer as ArrayBuffer], 'sample.pdf', {
        type: 'application/pdf',
      });
      const result = await validatePdfToPngFile(file);
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
      const result = await validatePdfToPngFile(file);
      expect(result.valid).toBe(false);
      expect(result.error?.code).toBe('UNSUPPORTED_FORMAT');
    });

    it('rejects spoofed files (PDF extension with non-PDF binary header)', async () => {
      const spoofedBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      const file = new File([spoofedBytes.buffer], 'spoofed.pdf', {
        type: 'application/pdf',
      });
      const result = await validatePdfToPngFile(file);
      expect(result.valid).toBe(false);
      expect(result.error?.message).toContain('not a valid PDF');
    });

    it('rejects empty PDF files (0 bytes)', async () => {
      const file = new File([], 'empty.pdf', { type: 'application/pdf' });
      const result = await validatePdfToPngFile(file);
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

      const result = await validatePdfToPngFile(oversizedFile);
      expect(result.valid).toBe(false);
      expect(result.error?.code).toBe('FILE_TOO_LARGE');
    });
  });

  describe('2. Page Range Parsing & Selection', () => {
    const totalPages = 12;

    it('parses single page correctly', () => {
      const res = validateAndParsePageRange('3', totalPages);
      expect(res.valid).toBe(true);
      expect(res.pages).toEqual([3]);
    });

    it('parses page ranges correctly (e.g. 1-5)', () => {
      const res = validateAndParsePageRange('1-5', totalPages);
      expect(res.valid).toBe(true);
      expect(res.pages).toEqual([1, 2, 3, 4, 5]);
    });

    it('parses comma-separated pages and ranges (e.g. 2, 4-7, 10)', () => {
      const res = validateAndParsePageRange('2, 4-7, 10', totalPages);
      expect(res.valid).toBe(true);
      expect(res.pages).toEqual([2, 4, 5, 6, 7, 10]);
    });

    it('deduplicates overlapping page selections and sorts them', () => {
      const res = validateAndParsePageRange('3, 1-4, 2', totalPages);
      expect(res.valid).toBe(true);
      expect(res.pages).toEqual([1, 2, 3, 4]);
    });

    it('rejects page numbers greater than document page count', () => {
      const res = validateAndParsePageRange('15', totalPages);
      expect(res.valid).toBe(false);
      expect(res.error).toContain('out of range');
    });

    it('rejects invalid range ordering where start > end (e.g. 8-4)', () => {
      const res = validateAndParsePageRange('8-4', totalPages);
      expect(res.valid).toBe(false);
      expect(res.error).toContain('cannot be greater');
    });

    it('rejects empty input string', () => {
      const res = validateAndParsePageRange('   ', totalPages);
      expect(res.valid).toBe(false);
      expect(res.error).toContain('Select at least one page');
    });
  });

  describe('3. Base Name Sanitization & Output Naming', () => {
    it('sanitizes unsafe characters, directory traversal, and null bytes', () => {
      expect(sanitizePdfBaseName('annual-report.pdf')).toBe('annual-report');
      expect(sanitizePdfBaseName('../../etc/shadow.pdf')).toBe('etc-shadow');
      expect(sanitizePdfBaseName('report\x00file?.pdf')).toBe('reportfile');
      expect(sanitizePdfBaseName('.pdf')).toBe('document');
    });
  });

  describe('4. PDF Loading & Page Count Detection', () => {
    it('loads PDF and correctly identifies page count', async () => {
      const pdfBytes = await createTestPdfBuffer(4);
      const loaded = await loadPdfDocument(pdfBytes.buffer as ArrayBuffer);
      expect(loaded.pageCount).toBe(4);
      expect(loaded.pdfDoc).toBeDefined();
    });

    it('handles unreadable / corrupted PDF data gracefully', async () => {
      const garbageBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x00, 0x01, 0x02]);
      await expect(loadPdfDocument(garbageBytes.buffer)).rejects.toThrow();
    });
  });

  describe('5. Memory & Large Page Limits Protection', () => {
    it('rejects render when calculated dimensions exceed safety limits (8192 max dimension / 67M pixels)', async () => {
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

  describe('6. End-to-End PDF to PNG Conversion Flow', () => {
    beforeEach(() => {
      // In Node test environment, mock renderPdfPageToPng to return mock PNG blob
      vi.spyOn(rendererModule, 'renderPdfPageToPng').mockImplementation(
        async (_pdfDoc, options) => {
          const fakePngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
          return {
            blob: new Blob([fakePngBytes], { type: 'image/png' }),
            width: Math.floor(600 * (options.scale || 1.5)),
            height: Math.floor(900 * (options.scale || 1.5)),
          };
        }
      );
    });

    it('converts single selected page to single lossless PNG output', async () => {
      const pdfBytes = await createTestPdfBuffer(2);
      const file = new File([pdfBytes.buffer as ArrayBuffer], 'diagram.pdf', {
        type: 'application/pdf',
      });

      const result = await convertPdfToPng(file, {
        selectedPages: [1],
        scale: 1.5,
      });

      expect(result.originalFileName).toBe('diagram.pdf');
      expect(result.totalPages).toBe(2);
      expect(result.convertedCount).toBe(1);
      expect(result.pages.length).toBe(1);
      expect(result.pages[0].pageNumber).toBe(1);
      expect(result.pages[0].fileName).toBe('diagram-page-1.png');
      expect(result.pages[0].blob.type).toBe('image/png');
      expect(result.zipBlob).toBeUndefined();
    });

    it('converts multiple selected pages and generates ZIP archive', async () => {
      const pdfBytes = await createTestPdfBuffer(3);
      const file = new File([pdfBytes.buffer as ArrayBuffer], 'slides.pdf', {
        type: 'application/pdf',
      });

      const result = await convertPdfToPng(file, {
        selectedPages: [1, 2, 3],
        scale: 2.0,
      });

      expect(result.convertedCount).toBe(3);
      expect(result.pages.length).toBe(3);
      expect(result.pages[0].fileName).toBe('slides-page-1.png');
      expect(result.pages[1].fileName).toBe('slides-page-2.png');
      expect(result.pages[2].fileName).toBe('slides-page-3.png');
      expect(result.zipBlob).toBeDefined();
      expect(result.zipFileName).toBe('slides-png-images.zip');
    });

    it('throws error when no valid pages are selected', async () => {
      const pdfBytes = await createTestPdfBuffer(1);
      const file = new File([pdfBytes.buffer as ArrayBuffer], 'test.pdf', {
        type: 'application/pdf',
      });

      await expect(
        convertPdfToPng(file, {
          selectedPages: [],
        })
      ).rejects.toThrow('Select at least one page');
    });
  });
});
