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
  validateDeletePdfPagesFile,
  DELETE_PDF_PAGES_LIMITS,
} from '@/engines/pdf/validation';
import {
  deletePdfPages,
  deletePdfPagesBytes,
} from '@/engines/pdf/delete-pages';
import { sanitizePdfBaseName } from '@/engines/pdf/utils';

/**
 * Helper to generate a valid PDF with deterministic text and page count.
 */
async function createTestPdfFile(name: string, pageCount = 1): Promise<File> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pageCount; i++) {
    const page = doc.addPage([400, 600]);
    page.drawText(`${name} - Page ${i + 1}`, {
      x: 30,
      y: 550,
      size: 16,
      color: rgb(0, 0, 0),
    });
    page.drawText(`Vector line on page ${i + 1}`, {
      x: 30,
      y: 500,
      size: 12,
      color: rgb(0.2, 0.2, 0.2),
    });
  }
  const bytes = await doc.save();
  const safeBuffer = new Uint8Array(bytes).buffer;
  return new File([safeBuffer], name, { type: 'application/pdf' });
}

describe('Tool #24: Delete PDF Pages Engine', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. PDF Validation & Limits', () => {
    it('accepts a valid PDF file with %PDF- header', async () => {
      const file = await createTestPdfFile('document.pdf', 3);
      const res = await validateDeletePdfPagesFile(file);
      expect(res.valid).toBe(true);
      expect(res.error).toBeUndefined();
    });

    it('rejects a non-PDF file based on extension and MIME', async () => {
      const textFile = new File(['plain text data'], 'doc.txt', { type: 'text/plain' });
      const res = await validateDeletePdfPagesFile(textFile);
      expect(res.valid).toBe(false);
      expect(res.error?.code).toBe('UNSUPPORTED_FORMAT');
    });

    it('rejects a fake PDF file with .pdf extension but invalid magic bytes', async () => {
      const fakePdf = new File(['Not a real PDF structure'], 'fake.pdf', {
        type: 'application/pdf',
      });
      const res = await validateDeletePdfPagesFile(fakePdf);
      expect(res.valid).toBe(false);
      expect(res.error?.code).toBe('INVALID_FILE');
    });

    it('rejects empty 0-byte PDF files', async () => {
      const emptyPdf = new File([], 'empty.pdf', { type: 'application/pdf' });
      const res = await validateDeletePdfPagesFile(emptyPdf);
      expect(res.valid).toBe(false);
      expect(res.error?.code).toBe('INVALID_FILE');
    });

    it('rejects oversized PDF files exceeding 100 MB', async () => {
      const hugeFile = {
        name: 'huge.pdf',
        size: DELETE_PDF_PAGES_LIMITS.MAX_FILE_SIZE + 1024,
        type: 'application/pdf',
        slice: vi.fn(),
      } as unknown as File;
      const res = await validateDeletePdfPagesFile(hugeFile);
      expect(res.valid).toBe(false);
      expect(res.error?.code).toBe('FILE_TOO_LARGE');
    });
  });

  describe('2. Core Deletion Functionality & Preservation', () => {
    it('deletes a single middle page (page 2 of 3) and preserves remaining order and count', async () => {
      const file = await createTestPdfFile('report.pdf', 3);
      const result = await deletePdfPages(file, { pagesToDelete: [2] });

      expect(result.fileName).toBe('report-pages-deleted.pdf');
      expect(result.originalPageCount).toBe(3);
      expect(result.pageCount).toBe(2);
      expect(result.deletedPageCount).toBe(1);
      expect(result.deletedPages).toEqual([2]);
      expect(result.remainingPages).toEqual([1, 3]);

      // Inspect output document
      const outputBuffer = await result.blob.arrayBuffer();
      const outputDoc = await PDFDocument.load(outputBuffer);
      expect(outputDoc.getPageCount()).toBe(2);

      // Verify dimensions preserved
      expect(outputDoc.getPage(0).getWidth()).toBe(400);
      expect(outputDoc.getPage(0).getHeight()).toBe(600);
      expect(outputDoc.getPage(1).getWidth()).toBe(400);
      expect(outputDoc.getPage(1).getHeight()).toBe(600);
    });

    it('deletes the first page (page 1 of 3)', async () => {
      const file = await createTestPdfFile('doc.pdf', 3);
      const result = await deletePdfPages(file, { pagesToDelete: [1] });

      expect(result.pageCount).toBe(2);
      expect(result.deletedPages).toEqual([1]);
      expect(result.remainingPages).toEqual([2, 3]);

      const outputDoc = await PDFDocument.load(await result.blob.arrayBuffer());
      expect(outputDoc.getPageCount()).toBe(2);
    });

    it('deletes the last page (page 3 of 3)', async () => {
      const file = await createTestPdfFile('doc.pdf', 3);
      const result = await deletePdfPages(file, { pagesToDelete: [3] });

      expect(result.pageCount).toBe(2);
      expect(result.deletedPages).toEqual([3]);
      expect(result.remainingPages).toEqual([1, 2]);

      const outputDoc = await PDFDocument.load(await result.blob.arrayBuffer());
      expect(outputDoc.getPageCount()).toBe(2);
    });

    it('deletes multiple non-contiguous pages (pages 2 and 4 of 5)', async () => {
      const file = await createTestPdfFile('large.pdf', 5);
      const result = await deletePdfPages(file, { pagesToDelete: [2, 4] });

      expect(result.originalPageCount).toBe(5);
      expect(result.pageCount).toBe(3);
      expect(result.deletedPageCount).toBe(2);
      expect(result.deletedPages).toEqual([2, 4]);
      expect(result.remainingPages).toEqual([1, 3, 5]);

      const outputDoc = await PDFDocument.load(await result.blob.arrayBuffer());
      expect(outputDoc.getPageCount()).toBe(3);
    });

    it('deletes contiguous pages (pages 2 and 3 of 4)', async () => {
      const file = await createTestPdfFile('four-page.pdf', 4);
      const result = await deletePdfPages(file, { pagesToDelete: [2, 3] });

      expect(result.pageCount).toBe(2);
      expect(result.remainingPages).toEqual([1, 4]);

      const outputDoc = await PDFDocument.load(await result.blob.arrayBuffer());
      expect(outputDoc.getPageCount()).toBe(2);
    });

    it('preserves existing page rotation and dimensions on remaining pages', async () => {
      const doc = await PDFDocument.create();
      const p1 = doc.addPage([300, 500]);
      p1.setRotation({ type: 'degrees', angle: 90 } as unknown as import('pdf-lib').Rotation);
      const _p2 = doc.addPage([400, 600]);
      const p3 = doc.addPage([500, 700]);
      p3.setRotation({ type: 'degrees', angle: 180 } as unknown as import('pdf-lib').Rotation);

      const bytes = await doc.save();
      const file = new File([new Uint8Array(bytes).buffer], 'rotated-doc.pdf', {
        type: 'application/pdf',
      });

      // Delete page 2
      const result = await deletePdfPages(file, { pagesToDelete: [2] });
      const outputDoc = await PDFDocument.load(await result.blob.arrayBuffer());
      expect(outputDoc.getPageCount()).toBe(2);

      // Remaining page 1 (was original page 1)
      expect(outputDoc.getPage(0).getWidth()).toBe(300);
      expect(outputDoc.getPage(0).getHeight()).toBe(500);
      expect(outputDoc.getPage(0).getRotation().angle).toBe(90);

      // Remaining page 2 (was original page 3)
      expect(outputDoc.getPage(1).getWidth()).toBe(500);
      expect(outputDoc.getPage(1).getHeight()).toBe(700);
      expect(outputDoc.getPage(1).getRotation().angle).toBe(180);
    });

    it('reports progress stages via onProgress callback', async () => {
      const file = await createTestPdfFile('progress.pdf', 3);
      const stages: string[] = [];

      await deletePdfPages(file, { pagesToDelete: [2] }, (prog) => {
        stages.push(prog.stage);
      });

      expect(stages).toContain('reading');
      expect(stages).toContain('loading');
      expect(stages).toContain('preparing');
      expect(stages).toContain('deleting');
      expect(stages).toContain('generating');
      expect(stages).toContain('validating');
      expect(stages).toContain('completed');
    });
  });

  describe('3. Safety Rules & Zero-Page Protection', () => {
    it('blocks deleting all pages of a document', async () => {
      const file = await createTestPdfFile('multi.pdf', 3);
      await expect(
        deletePdfPages(file, { pagesToDelete: [1, 2, 3] })
      ).rejects.toThrow(/at least one page must remain/i);
    });

    it('blocks deleting the only page of a single-page document', async () => {
      const file = await createTestPdfFile('single.pdf', 1);
      await expect(
        deletePdfPages(file, { pagesToDelete: [1] })
      ).rejects.toThrow(/single-page pdf cannot have its only page deleted/i);
    });

    it('rejects empty selection of pages to delete', async () => {
      const file = await createTestPdfFile('doc.pdf', 2);
      await expect(
        deletePdfPages(file, { pagesToDelete: [] })
      ).rejects.toThrow(/select at least one page to delete/i);
    });

    it('ignores out-of-range page numbers and throws if no valid pages remain to delete', async () => {
      const file = await createTestPdfFile('doc.pdf', 2);
      await expect(
        deletePdfPages(file, { pagesToDelete: [99, 100] })
      ).rejects.toThrow(/select at least one page to delete/i);
    });

    it('rejects corrupted PDF data cleanly in deletePdfPagesBytes', async () => {
      const corruptedBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x00, 0xff, 0xaa]);
      await expect(
        deletePdfPagesBytes(corruptedBytes, 'corrupt.pdf', { pagesToDelete: [1] })
      ).rejects.toThrow();
    });

    it('sanitizes unsafe filenames into safe output names', () => {
      expect(sanitizePdfBaseName('my/path\\doc:name?.pdf')).toBe('my-path-doc-name');
      expect(sanitizePdfBaseName('../../../secret.pdf')).toBe('secret');
      expect(sanitizePdfBaseName('normal.pdf')).toBe('normal');
    });
  });
});
