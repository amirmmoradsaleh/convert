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
  validateReorderPdfPagesFile,
  REORDER_PDF_PAGES_LIMITS,
} from '@/engines/pdf/validation';
import {
  reorderPdfPages,
  reorderPdfPagesBytes,
  validatePageOrder,
} from '@/engines/pdf/reorder-pages';
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
    page.drawText(`Unique Identifier: PAGE_${i + 1}`, {
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

describe('Tool #25: Reorder PDF Pages Engine', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. PDF Validation & Limits', () => {
    it('accepts a valid PDF file with %PDF- header', async () => {
      const file = await createTestPdfFile('document.pdf', 3);
      const res = await validateReorderPdfPagesFile(file);
      expect(res.valid).toBe(true);
      expect(res.error).toBeUndefined();
    });

    it('rejects a non-PDF file based on extension and MIME', async () => {
      const textFile = new File(['plain text data'], 'doc.txt', { type: 'text/plain' });
      const res = await validateReorderPdfPagesFile(textFile);
      expect(res.valid).toBe(false);
      expect(res.error?.code).toBe('UNSUPPORTED_FORMAT');
    });

    it('rejects a fake PDF file with .pdf extension but invalid magic bytes', async () => {
      const fakePdf = new File(['Not a real PDF structure'], 'fake.pdf', {
        type: 'application/pdf',
      });
      const res = await validateReorderPdfPagesFile(fakePdf);
      expect(res.valid).toBe(false);
      expect(res.error?.code).toBe('INVALID_FILE');
    });

    it('rejects empty 0-byte PDF files', async () => {
      const emptyPdf = new File([], 'empty.pdf', { type: 'application/pdf' });
      const res = await validateReorderPdfPagesFile(emptyPdf);
      expect(res.valid).toBe(false);
      expect(res.error?.code).toBe('INVALID_FILE');
    });

    it('rejects oversized PDF files exceeding 100 MB', async () => {
      const hugeFile = {
        name: 'huge.pdf',
        size: REORDER_PDF_PAGES_LIMITS.MAX_FILE_SIZE + 1024,
        type: 'application/pdf',
        slice: vi.fn(),
      } as unknown as File;
      const res = await validateReorderPdfPagesFile(hugeFile);
      expect(res.valid).toBe(false);
      expect(res.error?.code).toBe('FILE_TOO_LARGE');
    });
  });

  describe('2. Order Integrity Validation', () => {
    it('accepts valid permutations of page indices', () => {
      expect(validatePageOrder([1, 2, 3], 3).valid).toBe(true);
      expect(validatePageOrder([3, 1, 2], 3).valid).toBe(true);
      expect(validatePageOrder([2, 1], 2).valid).toBe(true);
      expect(validatePageOrder([1], 1).valid).toBe(true);
      expect(validatePageOrder([4, 2, 1, 3], 4).valid).toBe(true);
    });

    it('rejects duplicate page indices', () => {
      const res = validatePageOrder([1, 1, 3], 3);
      expect(res.valid).toBe(false);
      expect(res.error).toMatch(/duplicate page number/i);
    });

    it('rejects missing page indices', () => {
      const res = validatePageOrder([1, 2, 4], 3);
      expect(res.valid).toBe(false);
      expect(res.error).toMatch(/out of bounds/i);
    });

    it('rejects out-of-range and negative indices', () => {
      expect(validatePageOrder([0, 1, 2], 3).valid).toBe(false);
      expect(validatePageOrder([-1, 2, 3], 3).valid).toBe(false);
      expect(validatePageOrder([1, 2, 99], 3).valid).toBe(false);
    });

    it('rejects array with mismatched length', () => {
      const res = validatePageOrder([1, 2], 3);
      expect(res.valid).toBe(false);
      expect(res.error).toMatch(/length/i);
    });

    it('rejects non-integer and malformed values', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(validatePageOrder([1, 2.5, 3] as any, 3).valid).toBe(false);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(validatePageOrder(['1', 2, 3] as any, 3).valid).toBe(false);
    });
  });

  describe('3. Core Reordering Functionality & Fidelity', () => {
    it('reorders pages in arbitrary custom sequence ([3, 1, 2])', async () => {
      const file = await createTestPdfFile('doc.pdf', 3);
      const result = await reorderPdfPages(file, {
        newPageOrder: [3, 1, 2],
      });

      expect(result.fileName).toBe('doc-reordered.pdf');
      expect(result.pageCount).toBe(3);
      expect(result.originalPageOrder).toEqual([1, 2, 3]);
      expect(result.newPageOrder).toEqual([3, 1, 2]);
      expect(result.isOrderChanged).toBe(true);

      const outputDoc = await PDFDocument.load(await result.blob.arrayBuffer());
      expect(outputDoc.getPageCount()).toBe(3);
      expect(outputDoc.getPage(0).getWidth()).toBe(400);
      expect(outputDoc.getPage(0).getHeight()).toBe(600);
    });

    it('reverses the page order ([3, 2, 1])', async () => {
      const file = await createTestPdfFile('report.pdf', 3);
      const result = await reorderPdfPages(file, {
        newPageOrder: [3, 2, 1],
      });

      expect(result.newPageOrder).toEqual([3, 2, 1]);
      expect(result.isOrderChanged).toBe(true);

      const outputDoc = await PDFDocument.load(await result.blob.arrayBuffer());
      expect(outputDoc.getPageCount()).toBe(3);
    });

    it('handles unchanged page order safely ([1, 2, 3])', async () => {
      const file = await createTestPdfFile('report.pdf', 3);
      const result = await reorderPdfPages(file, {
        newPageOrder: [1, 2, 3],
      });

      expect(result.isOrderChanged).toBe(false);
      const outputDoc = await PDFDocument.load(await result.blob.arrayBuffer());
      expect(outputDoc.getPageCount()).toBe(3);
    });

    it('moves first page to the last position ([2, 3, 1])', async () => {
      const file = await createTestPdfFile('report.pdf', 3);
      const result = await reorderPdfPages(file, {
        newPageOrder: [2, 3, 1],
      });

      expect(result.newPageOrder).toEqual([2, 3, 1]);
      const outputDoc = await PDFDocument.load(await result.blob.arrayBuffer());
      expect(outputDoc.getPageCount()).toBe(3);
    });

    it('moves last page to the first position ([3, 1, 2])', async () => {
      const file = await createTestPdfFile('report.pdf', 3);
      const result = await reorderPdfPages(file, {
        newPageOrder: [3, 1, 2],
      });

      expect(result.newPageOrder).toEqual([3, 1, 2]);
      const outputDoc = await PDFDocument.load(await result.blob.arrayBuffer());
      expect(outputDoc.getPageCount()).toBe(3);
    });

    it('preserves existing page rotation and dimensions across rearranged pages', async () => {
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

      // Swap page 1 and page 3 -> new order [3, 2, 1]
      const result = await reorderPdfPages(file, { newPageOrder: [3, 2, 1] });
      const outputDoc = await PDFDocument.load(await result.blob.arrayBuffer());
      expect(outputDoc.getPageCount()).toBe(3);

      // New Page 1 (original Page 3)
      expect(outputDoc.getPage(0).getWidth()).toBe(500);
      expect(outputDoc.getPage(0).getHeight()).toBe(700);
      expect(outputDoc.getPage(0).getRotation().angle).toBe(180);

      // New Page 2 (original Page 2)
      expect(outputDoc.getPage(1).getWidth()).toBe(400);
      expect(outputDoc.getPage(1).getHeight()).toBe(600);
      expect(outputDoc.getPage(1).getRotation().angle).toBe(0);

      // New Page 3 (original Page 1)
      expect(outputDoc.getPage(2).getWidth()).toBe(300);
      expect(outputDoc.getPage(2).getHeight()).toBe(500);
      expect(outputDoc.getPage(2).getRotation().angle).toBe(90);
    });

    it('reports progress stages via onProgress callback', async () => {
      const file = await createTestPdfFile('progress.pdf', 3);
      const stages: string[] = [];

      await reorderPdfPages(file, { newPageOrder: [2, 1, 3] }, (prog) => {
        stages.push(prog.stage);
      });

      expect(stages).toContain('reading');
      expect(stages).toContain('loading');
      expect(stages).toContain('preparing');
      expect(stages).toContain('reordering');
      expect(stages).toContain('generating');
      expect(stages).toContain('validating');
      expect(stages).toContain('completed');
    });
  });

  describe('4. Edge Cases & Output Safety', () => {
    it('handles single-page PDF with order [1]', async () => {
      const file = await createTestPdfFile('single.pdf', 1);
      const result = await reorderPdfPages(file, { newPageOrder: [1] });
      expect(result.pageCount).toBe(1);
      expect(result.isOrderChanged).toBe(false);

      const outputDoc = await PDFDocument.load(await result.blob.arrayBuffer());
      expect(outputDoc.getPageCount()).toBe(1);
    });

    it('handles two-page PDF with swapped order [2, 1]', async () => {
      const file = await createTestPdfFile('two-page.pdf', 2);
      const result = await reorderPdfPages(file, { newPageOrder: [2, 1] });
      expect(result.pageCount).toBe(2);
      expect(result.newPageOrder).toEqual([2, 1]);

      const outputDoc = await PDFDocument.load(await result.blob.arrayBuffer());
      expect(outputDoc.getPageCount()).toBe(2);
    });

    it('rejects corrupted PDF data cleanly in reorderPdfPagesBytes', async () => {
      const corruptedBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x00, 0xff, 0xaa]);
      await expect(
        reorderPdfPagesBytes(corruptedBytes, 'corrupt.pdf', { newPageOrder: [1] })
      ).rejects.toThrow();
    });

    it('sanitizes unsafe filenames into safe output names', () => {
      expect(sanitizePdfBaseName('my/path\\doc:name?.pdf')).toBe('my-path-doc-name');
      expect(sanitizePdfBaseName('../../../secret.pdf')).toBe('secret');
      expect(sanitizePdfBaseName('normal.pdf')).toBe('normal');
    });
  });
});
