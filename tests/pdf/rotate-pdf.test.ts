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
  validateRotatePdfFile,
  ROTATE_PDF_LIMITS,
} from '@/engines/pdf/validation';
import { rotatePdf, rotatePdfBytes } from '@/engines/pdf/rotate';
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

describe('Tool #23: Rotate PDF Engine', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. PDF Validation & Limits', () => {
    it('accepts a valid PDF file with %PDF- header', async () => {
      const file = await createTestPdfFile('document.pdf', 2);
      const res = await validateRotatePdfFile(file);
      expect(res.valid).toBe(true);
      expect(res.error).toBeUndefined();
    });

    it('rejects a non-PDF file based on extension and MIME', async () => {
      const textFile = new File(['plain text data'], 'doc.txt', { type: 'text/plain' });
      const res = await validateRotatePdfFile(textFile);
      expect(res.valid).toBe(false);
      expect(res.error?.code).toBe('UNSUPPORTED_FORMAT');
    });

    it('rejects a fake PDF file with .pdf extension but invalid magic bytes', async () => {
      const fakePdf = new File(['Not a real PDF structure'], 'fake.pdf', {
        type: 'application/pdf',
      });
      const res = await validateRotatePdfFile(fakePdf);
      expect(res.valid).toBe(false);
      expect(res.error?.code).toBe('INVALID_FILE');
    });

    it('rejects empty 0-byte PDF files', async () => {
      const emptyPdf = new File([], 'empty.pdf', { type: 'application/pdf' });
      const res = await validateRotatePdfFile(emptyPdf);
      expect(res.valid).toBe(false);
      expect(res.error?.code).toBe('INVALID_FILE');
    });

    it('rejects oversized PDF files exceeding 100 MB', async () => {
      const hugeFile = {
        name: 'huge.pdf',
        size: ROTATE_PDF_LIMITS.MAX_FILE_SIZE + 1024,
        type: 'application/pdf',
        slice: vi.fn(),
      } as unknown as File;
      const res = await validateRotatePdfFile(hugeFile);
      expect(res.valid).toBe(false);
      expect(res.error?.code).toBe('FILE_TOO_LARGE');
    });
  });

  describe('2. Core Rotation Functionality', () => {
    it('rotates all pages by 90° clockwise', async () => {
      const file = await createTestPdfFile('doc.pdf', 3);
      const result = await rotatePdf(file, { angle: 90, scope: 'all' });

      expect(result.fileName).toBe('doc-rotated.pdf');
      expect(result.pageCount).toBe(3);
      expect(result.rotatedPageCount).toBe(3);
      expect(result.angle).toBe(90);

      // Verify rotation in output document
      const outputBuffer = await result.blob.arrayBuffer();
      const outputDoc = await PDFDocument.load(outputBuffer);
      expect(outputDoc.getPageCount()).toBe(3);

      for (let i = 0; i < 3; i++) {
        const page = outputDoc.getPage(i);
        expect(page.getRotation().angle).toBe(90);
        // Dimensions preserved
        expect(page.getWidth()).toBe(400);
        expect(page.getHeight()).toBe(600);
      }
    });

    it('rotates all pages by 180°', async () => {
      const file = await createTestPdfFile('presentation.pdf', 2);
      const result = await rotatePdf(file, { angle: 180, scope: 'all' });

      expect(result.angle).toBe(180);
      const outputDoc = await PDFDocument.load(await result.blob.arrayBuffer());
      expect(outputDoc.getPage(0).getRotation().angle).toBe(180);
      expect(outputDoc.getPage(1).getRotation().angle).toBe(180);
    });

    it('rotates all pages by 270° clockwise', async () => {
      const file = await createTestPdfFile('landscape.pdf', 1);
      const result = await rotatePdf(file, { angle: 270, scope: 'all' });

      expect(result.angle).toBe(270);
      const outputDoc = await PDFDocument.load(await result.blob.arrayBuffer());
      expect(outputDoc.getPage(0).getRotation().angle).toBe(270);
    });

    it('rotates only selected pages (e.g. page 2 of 3)', async () => {
      const file = await createTestPdfFile('multi.pdf', 3);
      const result = await rotatePdf(file, {
        angle: 90,
        scope: 'selected',
        selectedPages: [2],
      });

      expect(result.rotatedPageCount).toBe(1);
      expect(result.pageCount).toBe(3);

      const outputDoc = await PDFDocument.load(await result.blob.arrayBuffer());
      expect(outputDoc.getPage(0).getRotation().angle).toBe(0); // page 1 untouched
      expect(outputDoc.getPage(1).getRotation().angle).toBe(90); // page 2 rotated
      expect(outputDoc.getPage(2).getRotation().angle).toBe(0); // page 3 untouched
    });

    it('rotates mixed selected pages (e.g. pages 1 and 3 of 4)', async () => {
      const file = await createTestPdfFile('report.pdf', 4);
      const result = await rotatePdf(file, {
        angle: 180,
        scope: 'selected',
        selectedPages: [1, 3],
      });

      expect(result.rotatedPageCount).toBe(2);

      const outputDoc = await PDFDocument.load(await result.blob.arrayBuffer());
      expect(outputDoc.getPage(0).getRotation().angle).toBe(180); // page 1
      expect(outputDoc.getPage(1).getRotation().angle).toBe(0); // page 2
      expect(outputDoc.getPage(2).getRotation().angle).toBe(180); // page 3
      expect(outputDoc.getPage(3).getRotation().angle).toBe(0); // page 4
    });

    it('cumulatively rotates a page that already has an existing rotation angle', async () => {
      // Create a doc with an existing 90° rotation
      const doc = await PDFDocument.create();
      const p = doc.addPage([300, 500]);
      p.setRotation({ type: 'degrees', angle: 90 } as unknown as import('pdf-lib').Rotation);
      const bytes = await doc.save();
      const file = new File([new Uint8Array(bytes).buffer], 'pre-rotated.pdf', {
        type: 'application/pdf',
      });

      // Rotate by 90° clockwise -> should become 180°
      const result = await rotatePdf(file, { angle: 90, scope: 'all' });
      const outputDoc = await PDFDocument.load(await result.blob.arrayBuffer());
      expect(outputDoc.getPage(0).getRotation().angle).toBe(180);
    });

    it('preserves page count, order, and dimensions with zero rasterization', async () => {
      const file = await createTestPdfFile('fidelity-test.pdf', 5);
      const result = await rotatePdf(file, { angle: 90, scope: 'all' });

      const outputDoc = await PDFDocument.load(await result.blob.arrayBuffer());
      expect(outputDoc.getPageCount()).toBe(5);

      for (let i = 0; i < 5; i++) {
        const page = outputDoc.getPage(i);
        expect(page.getWidth()).toBe(400);
        expect(page.getHeight()).toBe(600);
        expect(page.getRotation().angle).toBe(90);
      }
    });

    it('reports progress updates through onProgress callback', async () => {
      const file = await createTestPdfFile('progress.pdf', 2);
      const progressUpdates: number[] = [];

      await rotatePdf(file, { angle: 90, scope: 'all' }, (prog) => {
        progressUpdates.push(prog.progress);
      });

      expect(progressUpdates.length).toBeGreaterThan(0);
      expect(progressUpdates[progressUpdates.length - 1]).toBe(100);
    });
  });

  describe('3. Error Handling & Edge Cases', () => {
    it('rejects when scope is selected but no pages are provided', async () => {
      const file = await createTestPdfFile('empty-selection.pdf', 2);
      await expect(
        rotatePdf(file, { angle: 90, scope: 'selected', selectedPages: [] })
      ).rejects.toThrow(/select at least one page/i);
    });

    it('rejects invalid rotation angles', async () => {
      const file = await createTestPdfFile('invalid-angle.pdf', 1);
      await expect(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        rotatePdf(file, { angle: 45 as any, scope: 'all' })
      ).rejects.toThrow(/invalid rotation angle/i);
    });

    it('rejects corrupted PDF data cleanly in rotatePdfBytes', async () => {
      const corruptedBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x00, 0xff, 0xaa]); // %PDF- with garbage
      await expect(
        rotatePdfBytes(corruptedBytes, 'corrupt.pdf', { angle: 90, scope: 'all' })
      ).rejects.toThrow();
    });

    it('sanitizes unsafe filenames into safe output names', () => {
      expect(sanitizePdfBaseName('my/path\\doc:name?.pdf')).toBe('my-path-doc-name');
      expect(sanitizePdfBaseName('../../../secret.pdf')).toBe('secret');
      expect(sanitizePdfBaseName('normal.pdf')).toBe('normal');
    });
  });
});
