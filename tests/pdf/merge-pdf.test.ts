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
  validateMergePdfFile,
  validateMergePdfBatch,
} from '@/engines/pdf/validation';
import { mergePdfs } from '@/engines/pdf/merge';
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

describe('Tool #20: Merge PDF Engine', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. PDF Validation & Limits', () => {
    it('accepts a valid PDF file with %PDF- header', async () => {
      const file = await createTestPdfFile('doc1.pdf', 1);
      const res = await validateMergePdfFile(file);
      expect(res.valid).toBe(true);
      expect(res.error).toBeUndefined();
    });

    it('rejects a non-PDF file based on extension or MIME', async () => {
      const textFile = new File(['hello world'], 'doc.txt', { type: 'text/plain' });
      const res = await validateMergePdfFile(textFile);
      expect(res.valid).toBe(false);
      expect(res.error?.code).toBe('UNSUPPORTED_FORMAT');
    });

    it('rejects a fake PDF file with .pdf extension but invalid magic bytes', async () => {
      const fakePdf = new File(['Not a real PDF content at all'], 'fake.pdf', {
        type: 'application/pdf',
      });
      const res = await validateMergePdfFile(fakePdf);
      expect(res.valid).toBe(false);
      expect(res.error?.code).toBe('INVALID_FILE');
    });

    it('rejects empty 0-byte PDF files', async () => {
      const emptyPdf = new File([], 'empty.pdf', { type: 'application/pdf' });
      const res = await validateMergePdfFile(emptyPdf);
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

      const res = await validateMergePdfFile(hugeFile);
      expect(res.valid).toBe(false);
      expect(res.error?.code).toBe('FILE_TOO_LARGE');
    });
  });

  describe('2. Batch Limits & Safety', () => {
    it('rejects empty file batch', () => {
      const res = validateMergePdfBatch([]);
      expect(res.valid).toBe(false);
      expect(res.error?.code).toBe('INVALID_FILE');
    });

    it('rejects single PDF with clear message to add at least one more', async () => {
      const file1 = await createTestPdfFile('single.pdf', 1);
      const res = validateMergePdfBatch([file1]);
      expect(res.valid).toBe(false);
      expect(res.error?.code).toBe('INVALID_FILE');
      expect(res.error?.message).toContain('Add at least one more PDF to merge');
    });

    it('accepts 2 to 20 valid PDF files', async () => {
      const file1 = await createTestPdfFile('f1.pdf', 1);
      const file2 = await createTestPdfFile('f2.pdf', 1);
      const res = validateMergePdfBatch([file1, file2]);
      expect(res.valid).toBe(true);
    });

    it('rejects batch exceeding 20 PDF files', async () => {
      const fileList: File[] = [];
      for (let i = 0; i < 21; i++) {
        fileList.push({
          name: `doc-${i}.pdf`,
          size: 1000,
          type: 'application/pdf',
        } as unknown as File);
      }
      const res = validateMergePdfBatch(fileList);
      expect(res.valid).toBe(false);
      expect(res.error?.code).toBe('INVALID_FILE');
    });

    it('rejects batch exceeding aggregate limit of 250 MB', () => {
      const file1 = { name: '1.pdf', size: 150 * 1024 * 1024, type: 'application/pdf' } as unknown as File;
      const file2 = { name: '2.pdf', size: 150 * 1024 * 1024, type: 'application/pdf' } as unknown as File;
      const res = validateMergePdfBatch([file1, file2]);
      expect(res.valid).toBe(false);
      expect(res.error?.code).toBe('FILE_TOO_LARGE');
    });
  });

  describe('3. Page Count Detection via loadPdfDocument', () => {
    it('detects exact page count for 1-page PDF', async () => {
      const file = await createTestPdfFile('page1.pdf', 1);
      const loaded = await loadPdfDocument(file);
      expect(loaded.pageCount).toBe(1);
    });

    it('detects exact page count for multi-page PDF', async () => {
      const file = await createTestPdfFile('page3.pdf', 3);
      const loaded = await loadPdfDocument(file);
      expect(loaded.pageCount).toBe(3);
    });
  });

  describe('4. Merge Execution & Page Preservation', () => {
    it('merges 2 PDFs and verifies combined page count', async () => {
      const fileA = await createTestPdfFile('A.pdf', 2);
      const fileB = await createTestPdfFile('B.pdf', 3);

      const progressSteps: number[] = [];
      const result = await mergePdfs([fileA, fileB], {}, (p) => {
        progressSteps.push(p.progress);
      });

      expect(result.pageCount).toBe(5);
      expect(result.fileCount).toBe(2);
      expect(result.fileName).toBe('merged.pdf');
      expect(result.blob.type).toBe('application/pdf');
      expect(result.blob.size).toBeGreaterThan(0);
      expect(progressSteps).toContain(100);

      // Verify the resulting PDF can be loaded and read
      const loaded = await loadPdfDocument(await result.blob.arrayBuffer());
      expect(loaded.pageCount).toBe(5);
    });

    it('merges 3 PDFs with mixed page counts (1, 2, 3 pages = 6 total)', async () => {
      const fileA = await createTestPdfFile('A.pdf', 1);
      const fileB = await createTestPdfFile('B.pdf', 2);
      const fileC = await createTestPdfFile('C.pdf', 3);

      const result = await mergePdfs([fileA, fileB, fileC]);

      expect(result.pageCount).toBe(6);
      expect(result.fileCount).toBe(3);

      const loadedDoc = await PDFDocument.load(await result.blob.arrayBuffer());
      expect(loadedDoc.getPageCount()).toBe(6);
    });

    it('supports duplicate filenames without collision', async () => {
      const file1 = await createTestPdfFile('document.pdf', 1);
      const file2 = await createTestPdfFile('document.pdf', 2);

      const result = await mergePdfs([file1, file2]);
      expect(result.pageCount).toBe(3);
      expect(result.fileCount).toBe(2);
    });

    it('customizes output filename when specified', async () => {
      const fileA = await createTestPdfFile('A.pdf', 1);
      const fileB = await createTestPdfFile('B.pdf', 1);

      const result = await mergePdfs([fileA, fileB], {
        outputFileName: 'my-combined-contract.pdf',
      });
      expect(result.fileName).toBe('my-combined-contract.pdf');
    });
  });

  describe('5. Preservation of Exact User File & Page Order', () => {
    it('preserves exact file sequence [A, B, C]', async () => {
      const docA = await PDFDocument.create();
      docA.addPage([100, 100]).drawText('AAA');
      const bytesA = await docA.save();
      const fileA = new File([new Uint8Array(bytesA).buffer], 'A.pdf', { type: 'application/pdf' });

      const docB = await PDFDocument.create();
      docB.addPage([200, 200]).drawText('BBB');
      const bytesB = await docB.save();
      const fileB = new File([new Uint8Array(bytesB).buffer], 'B.pdf', { type: 'application/pdf' });

      const docC = await PDFDocument.create();
      docC.addPage([300, 300]).drawText('CCC');
      const bytesC = await docC.save();
      const fileC = new File([new Uint8Array(bytesC).buffer], 'C.pdf', { type: 'application/pdf' });

      const result = await mergePdfs([fileA, fileB, fileC]);
      const mergedPdf = await PDFDocument.load(await result.blob.arrayBuffer());
      const pages = mergedPdf.getPages();

      expect(pages.length).toBe(3);
      expect(pages[0].getWidth()).toBe(100);
      expect(pages[1].getWidth()).toBe(200);
      expect(pages[2].getWidth()).toBe(300);
    });

    it('preserves reordered file sequence [C, A, B]', async () => {
      const docA = await PDFDocument.create();
      docA.addPage([100, 100]).drawText('AAA');
      const bytesA = await docA.save();
      const fileA = new File([new Uint8Array(bytesA).buffer], 'A.pdf', { type: 'application/pdf' });

      const docB = await PDFDocument.create();
      docB.addPage([200, 200]).drawText('BBB');
      const bytesB = await docB.save();
      const fileB = new File([new Uint8Array(bytesB).buffer], 'B.pdf', { type: 'application/pdf' });

      const docC = await PDFDocument.create();
      docC.addPage([300, 300]).drawText('CCC');
      const bytesC = await docC.save();
      const fileC = new File([new Uint8Array(bytesC).buffer], 'C.pdf', { type: 'application/pdf' });

      // Reordered list: C, A, B
      const result = await mergePdfs([fileC, fileA, fileB]);
      const mergedPdf = await PDFDocument.load(await result.blob.arrayBuffer());
      const pages = mergedPdf.getPages();

      expect(pages.length).toBe(3);
      expect(pages[0].getWidth()).toBe(300); // C
      expect(pages[1].getWidth()).toBe(100); // A
      expect(pages[2].getWidth()).toBe(200); // B
    });
  });

  describe('6. Error Handling & Edge Cases', () => {
    it('throws PDF_READ_ERROR for corrupted PDF bytes', async () => {
      const validFile = await createTestPdfFile('valid.pdf', 1);
      // Valid signature but corrupt body
      const corruptData = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37, 0x00, 0x00, 0xff]);
      const corruptFile = new File([corruptData], 'corrupt.pdf', { type: 'application/pdf' });

      await expect(mergePdfs([validFile, corruptFile])).rejects.toThrow();
    });

    it('handles simulated memory exhaustion gracefully', async () => {
      const fileA = await createTestPdfFile('A.pdf', 1);
      const fileB = await createTestPdfFile('B.pdf', 1);

      vi.spyOn(PDFDocument, 'create').mockImplementationOnce(() => {
        throw new Error('Array buffer allocation failed (out of memory)');
      });

      await expect(mergePdfs([fileA, fileB])).rejects.toThrow(/memory/i);
    });
  });
});
