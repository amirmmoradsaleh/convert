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
  validateSplitPdfFile,
  parseSplitRanges,
} from '@/engines/pdf/validation';
import { splitPdf, sanitizePdfBaseName } from '@/engines/pdf/split';
import { loadPdfDocument } from '@/engines/pdf/loader';

/**
 * Helper to generate a valid PDF with deterministic text and page count.
 */
async function createTestPdfFile(name: string, pageCount = 1): Promise<File> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pageCount; i++) {
    const page = doc.addPage([300, 400]);
    page.drawText(`${name} - Page ${i + 1}`, {
      x: 20,
      y: 350,
      size: 14,
      color: rgb(0, 0, 0),
    });
  }
  const bytes = await doc.save();
  const safeBuffer = new Uint8Array(bytes).buffer;
  return new File([safeBuffer], name, { type: 'application/pdf' });
}

describe('Tool #21: Split PDF Engine', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. PDF Validation & Limits', () => {
    it('accepts a valid PDF file with %PDF- header', async () => {
      const file = await createTestPdfFile('doc1.pdf', 2);
      const res = await validateSplitPdfFile(file);
      expect(res.valid).toBe(true);
      expect(res.error).toBeUndefined();
    });

    it('rejects a non-PDF file based on extension or MIME', async () => {
      const textFile = new File(['plain text'], 'doc.txt', { type: 'text/plain' });
      const res = await validateSplitPdfFile(textFile);
      expect(res.valid).toBe(false);
      expect(res.error?.code).toBe('UNSUPPORTED_FORMAT');
    });

    it('rejects a fake PDF file with .pdf extension but invalid magic bytes', async () => {
      const fakePdf = new File(['Not a real PDF'], 'fake.pdf', {
        type: 'application/pdf',
      });
      const res = await validateSplitPdfFile(fakePdf);
      expect(res.valid).toBe(false);
      expect(res.error?.code).toBe('INVALID_FILE');
    });

    it('rejects empty 0-byte PDF files', async () => {
      const emptyPdf = new File([], 'empty.pdf', { type: 'application/pdf' });
      const res = await validateSplitPdfFile(emptyPdf);
      expect(res.valid).toBe(false);
      expect(res.error?.code).toBe('INVALID_FILE');
    });

    it('rejects oversized PDF files exceeding 100 MB', async () => {
      const hugeFile = {
        name: 'huge.pdf',
        type: 'application/pdf',
        size: 101 * 1024 * 1024,
        slice: () => new Blob(),
      } as unknown as File;

      const res = await validateSplitPdfFile(hugeFile);
      expect(res.valid).toBe(false);
      expect(res.error?.code).toBe('FILE_TOO_LARGE');
    });
  });

  describe('2. Filename Sanitization & Range Parsing', () => {
    it('sanitizes base filenames cleanly', () => {
      expect(sanitizePdfBaseName('my document.pdf')).toBe('my document');
      expect(sanitizePdfBaseName('report/final:v1.pdf')).toBe('report-final-v1');
      expect(sanitizePdfBaseName('...pdf')).toBe('document');
    });

    it('parses comma-separated single pages and ranges', () => {
      const res = parseSplitRanges('1, 3, 5-7', 10);
      expect(res.valid).toBe(true);
      expect(res.ranges.length).toBe(3);
      expect(res.ranges[0]).toEqual({
        start: 1,
        end: 1,
        pages: [1],
        label: 'Page 1',
      });
      expect(res.ranges[1]).toEqual({
        start: 3,
        end: 3,
        pages: [3],
        label: 'Page 3',
      });
      expect(res.ranges[2]).toEqual({
        start: 5,
        end: 7,
        pages: [5, 6, 7],
        label: 'Pages 5-7',
      });
    });

    it('parses multiline or semicolon-separated ranges', () => {
      const res = parseSplitRanges('1-3\n4-6; 7-10', 10);
      expect(res.valid).toBe(true);
      expect(res.ranges.length).toBe(3);
      expect(res.ranges[0].pages).toEqual([1, 2, 3]);
      expect(res.ranges[1].pages).toEqual([4, 5, 6]);
      expect(res.ranges[2].pages).toEqual([7, 8, 9, 10]);
    });

    it('rejects out of bounds page numbers', () => {
      const res = parseSplitRanges('1-5, 12', 10);
      expect(res.valid).toBe(false);
      expect(res.error).toContain('Page 12 is out of range');
    });

    it('rejects inverted page ranges (e.g. 5-2)', () => {
      const res = parseSplitRanges('5-2', 10);
      expect(res.valid).toBe(false);
      expect(res.error).toContain('cannot be greater than end page');
    });

    it('rejects empty input strings', () => {
      const res = parseSplitRanges('', 10);
      expect(res.valid).toBe(false);
      expect(res.ranges.length).toBe(0);
    });
  });

  describe('3. Split Execution — Mode A: Extract Selected Pages', () => {
    it('extracts specific pages into individual PDFs and creates ZIP', async () => {
      const file = await createTestPdfFile('presentation.pdf', 5);
      const progressSteps: number[] = [];

      const result = await splitPdf(
        file,
        {
          mode: 'extract-pages',
          selectedPages: [1, 3, 5],
        },
        (p) => {
          progressSteps.push(p.progress);
        }
      );

      expect(result.totalPages).toBe(5);
      expect(result.mode).toBe('extract-pages');
      expect(result.items.length).toBe(3);
      expect(result.items[0].fileName).toBe('presentation-page-1.pdf');
      expect(result.items[1].fileName).toBe('presentation-page-3.pdf');
      expect(result.items[2].fileName).toBe('presentation-page-5.pdf');
      expect(result.zipBlob).toBeDefined();
      expect(result.zipFileName).toBe('presentation-split.zip');
      expect(progressSteps).toContain(100);

      // Verify each output PDF has exactly 1 page
      for (const item of result.items) {
        const loaded = await loadPdfDocument(await item.blob.arrayBuffer());
        expect(loaded.pageCount).toBe(1);
      }
    });

    it('sorts and deduplicates selected pages preserving original document order', async () => {
      const file = await createTestPdfFile('doc.pdf', 4);
      // Selected out of order with duplicates: 4, 2, 4, 1
      const result = await splitPdf(file, {
        mode: 'extract-pages',
        selectedPages: [4, 2, 4, 1],
      });

      expect(result.items.length).toBe(3);
      expect(result.items.map((i) => i.pageNumbers[0])).toEqual([1, 2, 4]);
    });

    it('does not create ZIP if only 1 page is extracted', async () => {
      const file = await createTestPdfFile('single.pdf', 3);
      const result = await splitPdf(file, {
        mode: 'extract-pages',
        selectedPages: [2],
      });

      expect(result.items.length).toBe(1);
      expect(result.items[0].fileName).toBe('single-page-2.pdf');
      expect(result.zipBlob).toBeUndefined();
    });
  });

  describe('4. Split Execution — Mode B: Split Every Page', () => {
    it('splits all pages into separate 1-page documents', async () => {
      const file = await createTestPdfFile('book.pdf', 4);
      const result = await splitPdf(file, {
        mode: 'split-all',
      });

      expect(result.totalPages).toBe(4);
      expect(result.items.length).toBe(4);
      expect(result.items.map((i) => i.fileName)).toEqual([
        'book-page-1.pdf',
        'book-page-2.pdf',
        'book-page-3.pdf',
        'book-page-4.pdf',
      ]);
      expect(result.zipBlob).toBeDefined();

      for (const item of result.items) {
        const doc = await PDFDocument.load(await item.blob.arrayBuffer());
        expect(doc.getPageCount()).toBe(1);
      }
    });
  });

  describe('5. Split Execution — Mode C: Split by Ranges', () => {
    it('splits document into multi-page PDF parts by range', async () => {
      const file = await createTestPdfFile('contract.pdf', 6);
      const parsed = parseSplitRanges('1-2, 3-4, 5-6', 6);

      const result = await splitPdf(file, {
        mode: 'split-ranges',
        ranges: parsed.ranges,
      });

      expect(result.items.length).toBe(3);
      expect(result.items[0].fileName).toBe('contract-pages-1-2.pdf');
      expect(result.items[0].pageCount).toBe(2);
      expect(result.items[1].fileName).toBe('contract-pages-3-4.pdf');
      expect(result.items[1].pageCount).toBe(2);
      expect(result.items[2].fileName).toBe('contract-pages-5-6.pdf');
      expect(result.items[2].pageCount).toBe(2);

      // Verify page counts of generated documents
      const docPart1 = await PDFDocument.load(await result.items[0].blob.arrayBuffer());
      expect(docPart1.getPageCount()).toBe(2);
    });

    it('handles mixed single-page and multi-page ranges', async () => {
      const file = await createTestPdfFile('mixed.pdf', 5);
      const parsed = parseSplitRanges('1-3, 5', 5);

      const result = await splitPdf(file, {
        mode: 'split-ranges',
        ranges: parsed.ranges,
      });

      expect(result.items.length).toBe(2);
      expect(result.items[0].fileName).toBe('mixed-pages-1-3.pdf');
      expect(result.items[0].pageCount).toBe(3);
      expect(result.items[1].fileName).toBe('mixed-page-5.pdf');
      expect(result.items[1].pageCount).toBe(1);
    });
  });

  describe('6. Error Handling & Edge Cases', () => {
    it('throws error when no pages are selected in extract-pages mode', async () => {
      const file = await createTestPdfFile('test.pdf', 3);
      await expect(
        splitPdf(file, {
          mode: 'extract-pages',
          selectedPages: [],
        })
      ).rejects.toThrow('Please select at least one page to extract.');
    });

    it('throws error when no valid ranges given in split-ranges mode', async () => {
      const file = await createTestPdfFile('test.pdf', 3);
      await expect(
        splitPdf(file, {
          mode: 'split-ranges',
          ranges: [],
        })
      ).rejects.toThrow('Please specify at least one valid page range');
    });

    it('handles corrupted PDF bytes with ToolError', async () => {
      const corruptData = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37, 0x00, 0xff]);
      const corruptFile = new File([corruptData], 'corrupt.pdf', { type: 'application/pdf' });

      await expect(
        splitPdf(corruptFile, {
          mode: 'split-all',
        })
      ).rejects.toThrow();
    });

    it('handles simulated memory exhaustion gracefully', async () => {
      const file = await createTestPdfFile('memory.pdf', 3);

      vi.spyOn(PDFDocument, 'create').mockImplementationOnce(() => {
        throw new Error('Array buffer allocation failed (out of memory)');
      });

      await expect(
        splitPdf(file, {
          mode: 'split-all',
        })
      ).rejects.toThrow(/memory/i);
    });
  });
});
