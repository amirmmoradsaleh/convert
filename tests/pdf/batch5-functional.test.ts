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
import fs from 'fs';
import path from 'path';
import JSZip from 'jszip';
import { PDFDocument, degrees } from 'pdf-lib';

import {
  splitPdf,
  sanitizePdfBaseName as sanitizeSplitPdfBaseName,
} from '../../engines/pdf/split';
import {
  compressPdf,
  normalizePdfCompressionQuality,
  ALLOWED_PDF_COMPRESSION_QUALITIES,
} from '../../engines/pdf/compress';
import {
  rotatePdf,
  rotatePdfBytes,
} from '../../engines/pdf/rotate';
import {
  deletePdfPagesBytes,
  deletePdfPages,
} from '../../engines/pdf/delete-pages';
import {
  reorderPdfPagesBytes,
  reorderPdfPages,
  validatePageOrder,
} from '../../engines/pdf/reorder-pages';
import {
  validateSplitPdfFile,
  validateCompressPdfFile,
  validateRotatePdfFile,
  validateDeletePdfPagesFile,
  validateReorderPdfPagesFile,
  parseSplitRanges,
} from '../../engines/pdf/validation';
import {
  formatDownloadFilename,
  createZipBlob,
} from '../../engines/shared/file-utils';
import { ToolError } from '../../engines/shared/errors';

describe('Batch 5 — Functional Regression Test Suite (Five PDF Tools)', () => {
  const fixturesDir = path.join(process.cwd(), 'tests/fixtures');

  // Input fixtures
  const sample1PagePdfBuffer = fs.readFileSync(path.join(fixturesDir, 'sample-1page.pdf'));
  const sample2PagesPdfBuffer = fs.readFileSync(path.join(fixturesDir, 'sample-2pages.pdf'));
  const sample3PagesPdfBuffer = fs.readFileSync(path.join(fixturesDir, 'sample-3pages.pdf'));
  const compressiblePdfBuffer = fs.readFileSync(path.join(fixturesDir, 'compressible.pdf'));
  const alreadyOptimizedPdfBuffer = fs.readFileSync(path.join(fixturesDir, 'already-optimized.pdf'));
  const realUiPdfBuffer = fs.readFileSync(path.join(fixturesDir, 'real-ui-test.pdf'));
  const samplePngBuffer = fs.readFileSync(path.join(fixturesDir, 'sample.png'));
  const corruptedJpgBuffer = fs.readFileSync(path.join(fixturesDir, 'corrupted.jpg'));

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // =========================================================================
  // 1. Tool 21: Split PDF (split-pdf)
  // =========================================================================
  describe('Tool 21: Split PDF', () => {
    it('Mode A: extracts selected pages (pages 1 and 3) into separate 1-page PDF documents', async () => {
      const file = new File([sample3PagesPdfBuffer], 'sample-3pages.pdf', { type: 'application/pdf' });
      const result = await splitPdf(file, {
        mode: 'extract-pages',
        selectedPages: [1, 3],
      });

      expect(result.originalFileName).toBe('sample-3pages.pdf');
      expect(result.totalPages).toBe(3);
      expect(result.mode).toBe('extract-pages');
      expect(result.items).toHaveLength(2);

      // Verify item 1 (Page 1)
      expect(result.items[0].fileName).toBe('sample-3pages-page-1.pdf');
      expect(result.items[0].pageCount).toBe(1);
      expect(result.items[0].pageNumbers).toEqual([1]);
      const pdf1Bytes = await result.items[0].blob.arrayBuffer();
      const doc1 = await PDFDocument.load(pdf1Bytes);
      expect(doc1.getPageCount()).toBe(1);

      // Verify item 2 (Page 3)
      expect(result.items[1].fileName).toBe('sample-3pages-page-3.pdf');
      expect(result.items[1].pageCount).toBe(1);
      expect(result.items[1].pageNumbers).toEqual([3]);
      const pdf2Bytes = await result.items[1].blob.arrayBuffer();
      const doc2 = await PDFDocument.load(pdf2Bytes);
      expect(doc2.getPageCount()).toBe(1);

      // When multiple items produced, verify ZIP is generated
      expect(result.zipBlob).toBeDefined();
      expect(result.zipFileName).toBe('sample-3pages-split.zip');
    });

    it('Mode B: splits all pages into individual 1-page documents', async () => {
      const file = new File([sample3PagesPdfBuffer], 'sample-3pages.pdf', { type: 'application/pdf' });
      const result = await splitPdf(file, {
        mode: 'split-all',
      });

      expect(result.items).toHaveLength(3);
      for (let i = 0; i < 3; i++) {
        expect(result.items[i].fileName).toBe(`sample-3pages-page-${i + 1}.pdf`);
        expect(result.items[i].pageCount).toBe(1);
        const doc = await PDFDocument.load(await result.items[i].blob.arrayBuffer());
        expect(doc.getPageCount()).toBe(1);
      }
    });

    it('Mode C: splits by custom page ranges (e.g. 1-2, 3)', async () => {
      const parsedRanges = parseSplitRanges('1-2, 3', 3);
      expect(parsedRanges.valid).toBe(true);

      const file = new File([sample3PagesPdfBuffer], 'sample-3pages.pdf', { type: 'application/pdf' });
      const result = await splitPdf(file, {
        mode: 'split-ranges',
        ranges: parsedRanges.ranges,
      });

      expect(result.items).toHaveLength(2);

      // First chunk: pages 1-2
      expect(result.items[0].fileName).toBe('sample-3pages-pages-1-2.pdf');
      expect(result.items[0].pageCount).toBe(2);
      const doc1 = await PDFDocument.load(await result.items[0].blob.arrayBuffer());
      expect(doc1.getPageCount()).toBe(2);

      // Second chunk: page 3
      expect(result.items[1].fileName).toBe('sample-3pages-page-3.pdf');
      expect(result.items[1].pageCount).toBe(1);
      const doc2 = await PDFDocument.load(await result.items[1].blob.arrayBuffer());
      expect(doc2.getPageCount()).toBe(1);
    });

    it('packages multiple files into ZIP with un-prefixed internal filenames', async () => {
      const file = new File([sample2PagesPdfBuffer], 'sample-2pages.pdf', { type: 'application/pdf' });
      const result = await splitPdf(file, {
        mode: 'split-all',
      });

      expect(result.zipBlob).toBeDefined();
      const zipBuffer = await result.zipBlob!.arrayBuffer();
      const zip = await JSZip.loadAsync(zipBuffer);
      const entryNames = Object.keys(zip.files);

      expect(entryNames).toContain('sample-2pages-page-1.pdf');
      expect(entryNames).toContain('sample-2pages-page-2.pdf');
      // Crucial: entries inside zip must NOT have "Convert24 - " prefix
      entryNames.forEach((name) => {
        expect(name).not.toMatch(/^Convert24\s*-\s*/);
      });
    });

    it('rejects empty page selection in extract-pages mode', async () => {
      const file = new File([sample3PagesPdfBuffer], 'sample-3pages.pdf', { type: 'application/pdf' });
      await expect(
        splitPdf(file, {
          mode: 'extract-pages',
          selectedPages: [],
        })
      ).rejects.toThrow(/Please select at least one page/i);
    });

    it('rejects corrupted file, empty file, and non-PDF file upload', async () => {
      const corruptedFile = new File([corruptedJpgBuffer], 'corrupted.pdf', { type: 'application/pdf' });
      await expect(splitPdf(corruptedFile, { mode: 'split-all' })).rejects.toThrow(
        /not a valid PDF/i
      );

      const emptyFile = new File([], 'empty.pdf', { type: 'application/pdf' });
      await expect(splitPdf(emptyFile, { mode: 'split-all' })).rejects.toThrow(
        /empty/i
      );

      const nonPdfFile = new File([samplePngBuffer], 'sample.png', { type: 'image/png' });
      await expect(splitPdf(nonPdfFile, { mode: 'split-all' })).rejects.toThrow(
        /not a valid PDF/i
      );
    });
  });

  // =========================================================================
  // 2. Tool 22: Compress PDF (compress-pdf)
  // =========================================================================
  describe('Tool 22: Compress PDF', () => {
    it('compresses a compressible PDF and reduces file size', async () => {
      const file = new File([compressiblePdfBuffer], 'compressible.pdf', { type: 'application/pdf' });
      const result = await compressPdf(file, { quality: 70 });

      expect(result.originalFileName).toBe('compressible.pdf');
      expect(result.originalSize).toBe(compressiblePdfBuffer.length);
      expect(result.isReduced).toBe(true);
      expect(result.reductionPercent).toBeGreaterThan(0);
      expect(result.resultSize).toBeLessThan(result.originalSize);
      expect(result.isOriginalKept).toBe(false);
      expect(result.resultFileName).toBe('compressible-compressed.pdf');

      // Verify output PDF is valid and preserves page count & readability
      const outBuffer = await result.resultBlob.arrayBuffer();
      const loadedDoc = await PDFDocument.load(outBuffer);
      expect(loadedDoc.getPageCount()).toBe(5);
    });

    it('compresses across multiple quality presets with monotonic or distinct behavior', async () => {
      const file = new File([realUiPdfBuffer], 'real-ui-test.pdf', { type: 'application/pdf' });

      const res40 = await compressPdf(file, { quality: 40 });
      const res90 = await compressPdf(file, { quality: 90 });

      expect(res40.isReduced).toBe(true);
      expect(res90.isReduced).toBe(true);
      // 40% quality should produce equal or smaller output than 90% quality
      expect(res40.resultSize).toBeLessThanOrEqual(res90.resultSize);

      // Both outputs preserve page count
      const doc40 = await PDFDocument.load(await res40.resultBlob.arrayBuffer());
      const doc90 = await PDFDocument.load(await res90.resultBlob.arrayBuffer());
      expect(doc40.getPageCount()).toBe(1);
      expect(doc90.getPageCount()).toBe(1);
    });

    it('safely retains original file when no size reduction can be achieved', async () => {
      const file = new File([alreadyOptimizedPdfBuffer], 'already-optimized.pdf', {
        type: 'application/pdf',
      });
      const result = await compressPdf(file, { quality: 90 });

      expect(result.isReduced).toBe(false);
      expect(result.isOriginalKept).toBe(true);
      expect(result.reductionPercent).toBe(0);
      expect(result.resultSize).toBe(alreadyOptimizedPdfBuffer.length);
      expect(result.resultFileName).toBe('already-optimized.pdf');
      // Returned blob should equal the input file
      expect(result.resultBlob.size).toBe(file.size);
    });

    it('preserves exact page dimensions and page count across compression', async () => {
      const file = new File([compressiblePdfBuffer], 'compressible.pdf', { type: 'application/pdf' });
      const origDoc = await PDFDocument.load(compressiblePdfBuffer);
      const origCount = origDoc.getPageCount();

      const result = await compressPdf(file, { quality: 60 });
      const outDoc = await PDFDocument.load(await result.resultBlob.arrayBuffer());

      expect(outDoc.getPageCount()).toBe(origCount);
      for (let i = 0; i < origCount; i++) {
        const origPage = origDoc.getPage(i);
        const outPage = outDoc.getPage(i);
        expect(Math.abs(outPage.getWidth() - origPage.getWidth())).toBeLessThanOrEqual(1.0);
        expect(Math.abs(outPage.getHeight() - origPage.getHeight())).toBeLessThanOrEqual(1.0);
      }
    });

    it('rejects corrupted file, empty file, and non-PDF file upload', async () => {
      const corruptedFile = new File([corruptedJpgBuffer], 'corrupted.pdf', { type: 'application/pdf' });
      await expect(compressPdf(corruptedFile)).rejects.toThrow(/not a valid PDF/i);

      const emptyFile = new File([], 'empty.pdf', { type: 'application/pdf' });
      await expect(compressPdf(emptyFile)).rejects.toThrow(/empty/i);

      const nonPdfFile = new File([samplePngBuffer], 'sample.png', { type: 'image/png' });
      await expect(compressPdf(nonPdfFile)).rejects.toThrow(/not a valid PDF/i);
    });
  });

  // =========================================================================
  // 3. Tool 23: Rotate PDF (rotate-pdf)
  // =========================================================================
  describe('Tool 23: Rotate PDF', () => {
    it('rotates all pages by 90 degrees clockwise and updates PDF rotation metadata', async () => {
      const file = new File([sample3PagesPdfBuffer], 'sample-3pages.pdf', { type: 'application/pdf' });
      const result = await rotatePdf(file, {
        degrees: 90,
        scope: 'all',
      });

      expect(result.pageCount).toBe(3);
      expect(result.rotatedPageCount).toBe(3);
      expect(result.degrees).toBe(90);
      expect(result.fileName).toBe('sample-3pages-rotated.pdf');

      // Verify real PDF internal /Rotate attribute
      const loadedDoc = await PDFDocument.load(await result.blob.arrayBuffer());
      expect(loadedDoc.getPageCount()).toBe(3);
      for (let i = 0; i < 3; i++) {
        expect(loadedDoc.getPage(i).getRotation().angle).toBe(90);
      }
    });

    it('rotates all pages by 180 and 270 degrees', async () => {
      const file180 = new File([sample2PagesPdfBuffer], 'sample-2pages.pdf', { type: 'application/pdf' });
      const res180 = await rotatePdf(file180, { degrees: 180, scope: 'all' });
      const doc180 = await PDFDocument.load(await res180.blob.arrayBuffer());
      expect(doc180.getPage(0).getRotation().angle).toBe(180);
      expect(doc180.getPage(1).getRotation().angle).toBe(180);

      const file270 = new File([sample2PagesPdfBuffer], 'sample-2pages.pdf', { type: 'application/pdf' });
      const res270 = await rotatePdf(file270, { degrees: 270, scope: 'all' });
      const doc270 = await PDFDocument.load(await res270.blob.arrayBuffer());
      expect(doc270.getPage(0).getRotation().angle).toBe(270);
      expect(doc270.getPage(1).getRotation().angle).toBe(270);
    });

    it('rotates only selected pages (e.g. Page 2 of 3) while keeping other pages untouched', async () => {
      const file = new File([sample3PagesPdfBuffer], 'sample-3pages.pdf', { type: 'application/pdf' });
      const result = await rotatePdf(file, {
        degrees: 180,
        scope: 'selected',
        pages: [2],
      });

      expect(result.pageCount).toBe(3);
      expect(result.rotatedPageCount).toBe(1);

      const loadedDoc = await PDFDocument.load(await result.blob.arrayBuffer());
      expect(loadedDoc.getPage(0).getRotation().angle).toBe(0);   // Page 1 untouched
      expect(loadedDoc.getPage(1).getRotation().angle).toBe(180); // Page 2 rotated
      expect(loadedDoc.getPage(2).getRotation().angle).toBe(0);   // Page 3 untouched
    });

    it('handles cumulative rotation and 360-degree wrap-around cleanly', async () => {
      // 1. Rotate by 270 degrees
      const file = new File([sample1PagePdfBuffer], 'sample-1page.pdf', { type: 'application/pdf' });
      const res1 = await rotatePdf(file, { degrees: 270, scope: 'all' });
      const doc1 = await PDFDocument.load(await res1.blob.arrayBuffer());
      expect(doc1.getPage(0).getRotation().angle).toBe(270);

      // 2. Rotate the output by another 90 degrees -> should wrap cleanly to 0 degrees
      const file2 = new File([await res1.blob.arrayBuffer()], 'sample-1page-270.pdf', {
        type: 'application/pdf',
      });
      const res2 = await rotatePdf(file2, { degrees: 90, scope: 'all' });
      const doc2 = await PDFDocument.load(await res2.blob.arrayBuffer());
      expect(doc2.getPage(0).getRotation().angle).toBe(0);
    });

    it('rejects invalid rotation angle or empty selected pages', async () => {
      const file = new File([sample1PagePdfBuffer], 'sample-1page.pdf', { type: 'application/pdf' });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await expect(rotatePdf(file, { degrees: 45 as any })).rejects.toThrow(
        /Invalid rotation angle/i
      );

      await expect(
        rotatePdf(file, { degrees: 90, scope: 'selected', pages: [] })
      ).rejects.toThrow(/Please select at least one page/i);
    });

    it('rejects corrupted file, empty file, and non-PDF file upload', async () => {
      const corruptedFile = new File([corruptedJpgBuffer], 'corrupted.pdf', { type: 'application/pdf' });
      await expect(rotatePdf(corruptedFile)).rejects.toThrow(/not a valid PDF/i);

      const emptyFile = new File([], 'empty.pdf', { type: 'application/pdf' });
      await expect(rotatePdf(emptyFile)).rejects.toThrow(/empty/i);

      const nonPdfFile = new File([samplePngBuffer], 'sample.png', { type: 'image/png' });
      await expect(rotatePdf(nonPdfFile)).rejects.toThrow(/not a valid PDF/i);
    });
  });

  // =========================================================================
  // 4. Tool 24: Delete PDF Pages (delete-pdf-pages)
  // =========================================================================
  describe('Tool 24: Delete PDF Pages', () => {
    it('deletes middle page (Page 2 of 3) and verifies surviving 2 pages in original order', async () => {
      const file = new File([sample3PagesPdfBuffer], 'sample-3pages.pdf', { type: 'application/pdf' });
      const result = await deletePdfPages(file, {
        pagesToDelete: [2],
      });

      expect(result.originalFileName).toBe('sample-3pages.pdf');
      expect(result.originalPageCount).toBe(3);
      expect(result.pageCount).toBe(2);
      expect(result.deletedPageCount).toBe(1);
      expect(result.deletedPages).toEqual([2]);
      expect(result.remainingPages).toEqual([1, 3]);
      expect(result.resultFileName).toBe('sample-3pages-pages-deleted.pdf');

      const loadedDoc = await PDFDocument.load(await result.blob.arrayBuffer());
      expect(loadedDoc.getPageCount()).toBe(2);
    });

    it('deletes first page (Page 1) and last page (Page 3) individually', async () => {
      const file1 = new File([sample3PagesPdfBuffer], 'sample-3pages.pdf', { type: 'application/pdf' });
      const res1 = await deletePdfPages(file1, { pagesToDelete: [1] });
      expect(res1.remainingPages).toEqual([2, 3]);
      const doc1 = await PDFDocument.load(await res1.blob.arrayBuffer());
      expect(doc1.getPageCount()).toBe(2);

      const file3 = new File([sample3PagesPdfBuffer], 'sample-3pages.pdf', { type: 'application/pdf' });
      const res3 = await deletePdfPages(file3, { pagesToDelete: [3] });
      expect(res3.remainingPages).toEqual([1, 2]);
      const doc3 = await PDFDocument.load(await res3.blob.arrayBuffer());
      expect(doc3.getPageCount()).toBe(2);
    });

    it('deletes multiple pages (Pages 1 & 2 of 3) leaving single surviving page', async () => {
      const file = new File([sample3PagesPdfBuffer], 'sample-3pages.pdf', { type: 'application/pdf' });
      const result = await deletePdfPages(file, { pagesToDelete: [1, 2] });
      expect(result.pageCount).toBe(1);
      expect(result.remainingPages).toEqual([3]);
      const doc = await PDFDocument.load(await result.blob.arrayBuffer());
      expect(doc.getPageCount()).toBe(1);
    });

    it('blocks attempting to delete all pages with a clear safety error', async () => {
      const file = new File([sample3PagesPdfBuffer], 'sample-3pages.pdf', { type: 'application/pdf' });
      await expect(
        deletePdfPages(file, { pagesToDelete: [1, 2, 3] })
      ).rejects.toThrow(/At least one page must remain in the PDF/i);
    });

    it('blocks deleting page from a single-page PDF', async () => {
      const file = new File([sample1PagePdfBuffer], 'sample-1page.pdf', { type: 'application/pdf' });
      await expect(
        deletePdfPages(file, { pagesToDelete: [1] })
      ).rejects.toThrow(/single-page PDF cannot have its only page deleted/i);
    });

    it('rejects corrupted file, empty file, and non-PDF file upload', async () => {
      const corruptedFile = new File([corruptedJpgBuffer], 'corrupted.pdf', { type: 'application/pdf' });
      await expect(deletePdfPages(corruptedFile, { pagesToDelete: [1] })).rejects.toThrow(
        /not a valid PDF/i
      );

      const emptyFile = new File([], 'empty.pdf', { type: 'application/pdf' });
      await expect(deletePdfPages(emptyFile, { pagesToDelete: [1] })).rejects.toThrow(
        /empty/i
      );

      const nonPdfFile = new File([samplePngBuffer], 'sample.png', { type: 'image/png' });
      await expect(deletePdfPages(nonPdfFile, { pagesToDelete: [1] })).rejects.toThrow(
        /not a valid PDF/i
      );
    });
  });

  // =========================================================================
  // 5. Tool 25: Reorder PDF Pages (reorder-pdf-pages)
  // =========================================================================
  describe('Tool 25: Reorder PDF Pages', () => {
    it('reorders pages into reverse order [3, 2, 1] and verifies page sequence', async () => {
      const file = new File([sample3PagesPdfBuffer], 'sample-3pages.pdf', { type: 'application/pdf' });
      const result = await reorderPdfPages(file, {
        newPageOrder: [3, 2, 1],
      });

      expect(result.originalFileName).toBe('sample-3pages.pdf');
      expect(result.pageCount).toBe(3);
      expect(result.originalPageOrder).toEqual([1, 2, 3]);
      expect(result.newPageOrder).toEqual([3, 2, 1]);
      expect(result.isOrderChanged).toBe(true);
      expect(result.resultFileName).toBe('sample-3pages-reordered.pdf');

      const loadedDoc = await PDFDocument.load(await result.blob.arrayBuffer());
      expect(loadedDoc.getPageCount()).toBe(3);
    });

    it('reorders pages by swapping adjacent pages [2, 1, 3] and moving end to beginning [3, 1, 2]', async () => {
      const file = new File([sample3PagesPdfBuffer], 'sample-3pages.pdf', { type: 'application/pdf' });

      // Swap [2, 1, 3]
      const resSwap = await reorderPdfPages(file, { newPageOrder: [2, 1, 3] });
      expect(resSwap.newPageOrder).toEqual([2, 1, 3]);
      expect(resSwap.isOrderChanged).toBe(true);
      const docSwap = await PDFDocument.load(await resSwap.blob.arrayBuffer());
      expect(docSwap.getPageCount()).toBe(3);

      // Move end to beginning [3, 1, 2]
      const resMove = await reorderPdfPages(file, { newPageOrder: [3, 1, 2] });
      expect(resMove.newPageOrder).toEqual([3, 1, 2]);
      expect(resMove.isOrderChanged).toBe(true);
      const docMove = await PDFDocument.load(await resMove.blob.arrayBuffer());
      expect(docMove.getPageCount()).toBe(3);
    });

    it('preserves page orientation and dimensions when pages are rearranged', async () => {
      // Create a 2-page document where Page 1 has 90° rotation and [400, 600] dimension, Page 2 has 0° and [500, 700]
      const customDoc = await PDFDocument.create();
      const p1 = customDoc.addPage([400, 600]);
      p1.setRotation(degrees(90));
      const p2 = customDoc.addPage([500, 700]);
      p2.setRotation(degrees(0));
      const customBytes = await customDoc.save();

      const file = new File([customBytes], 'custom-order.pdf', { type: 'application/pdf' });
      const result = await reorderPdfPages(file, { newPageOrder: [2, 1] });

      const outDoc = await PDFDocument.load(await result.blob.arrayBuffer());
      expect(outDoc.getPageCount()).toBe(2);

      // New Page 1 was original Page 2
      expect(outDoc.getPage(0).getWidth()).toBe(500);
      expect(outDoc.getPage(0).getHeight()).toBe(700);
      expect(outDoc.getPage(0).getRotation().angle).toBe(0);

      // New Page 2 was original Page 1
      expect(outDoc.getPage(1).getWidth()).toBe(400);
      expect(outDoc.getPage(1).getHeight()).toBe(600);
      expect(outDoc.getPage(1).getRotation().angle).toBe(90);
    });

    it('rejects invalid page orders (duplicate, missing, or out of range pages)', async () => {
      const vDup = validatePageOrder([1, 1, 2], 3);
      expect(vDup.valid).toBe(false);
      expect(vDup.error).toMatch(/Duplicate page number/i);

      const vMissing = validatePageOrder([1, 2], 3);
      expect(vMissing.valid).toBe(false);
      expect(vMissing.error).toMatch(/must match document page count/i);

      const vBounds = validatePageOrder([1, 2, 5], 3);
      expect(vBounds.valid).toBe(false);
      expect(vBounds.error).toMatch(/out of bounds/i);

      const file = new File([sample3PagesPdfBuffer], 'sample-3pages.pdf', { type: 'application/pdf' });
      await expect(reorderPdfPages(file, { newPageOrder: [1, 1, 2] })).rejects.toThrow(
        /Duplicate page number/i
      );
    });

    it('rejects corrupted file, empty file, and non-PDF file upload', async () => {
      const corruptedFile = new File([corruptedJpgBuffer], 'corrupted.pdf', { type: 'application/pdf' });
      await expect(reorderPdfPages(corruptedFile, { newPageOrder: [1] })).rejects.toThrow(
        /not a valid PDF/i
      );

      const emptyFile = new File([], 'empty.pdf', { type: 'application/pdf' });
      await expect(reorderPdfPages(emptyFile, { newPageOrder: [1] })).rejects.toThrow(
        /empty/i
      );

      const nonPdfFile = new File([samplePngBuffer], 'sample.png', { type: 'image/png' });
      await expect(reorderPdfPages(nonPdfFile, { newPageOrder: [1] })).rejects.toThrow(
        /not a valid PDF/i
      );
    });
  });

  // =========================================================================
  // 6. Cross-Cutting Download Conventions & Branding
  // =========================================================================
  describe('Download Conventions & Convert24 Branding Prefix', () => {
    it('correctly adds "Convert24 - " prefix to individual downloaded PDFs', () => {
      expect(formatDownloadFilename('document-split.pdf')).toBe('Convert24 - document-split.pdf');
      expect(formatDownloadFilename('compressed.pdf')).toBe('Convert24 - compressed.pdf');
      expect(formatDownloadFilename('rotated.pdf')).toBe('Convert24 - rotated.pdf');
      expect(formatDownloadFilename('pages-deleted.pdf')).toBe('Convert24 - pages-deleted.pdf');
      expect(formatDownloadFilename('reordered.pdf')).toBe('Convert24 - reordered.pdf');
    });

    it('is idempotent and prevents duplicate prefixes', () => {
      expect(formatDownloadFilename('Convert24 - output.pdf')).toBe('Convert24 - output.pdf');
      expect(formatDownloadFilename('Convert24  -  output.pdf')).toBe('Convert24 - output.pdf');
      expect(formatDownloadFilename('Convert24 - Convert24 - output.pdf')).toBe('Convert24 - output.pdf');
    });

    it('formats ZIP downloads with prefix while internal ZIP entries stay un-prefixed', async () => {
      const zipFileName = formatDownloadFilename('sample-3pages-split.zip');
      expect(zipFileName).toBe('Convert24 - sample-3pages-split.zip');

      const zipBlob = await createZipBlob([
        { name: 'sample-3pages-page-1.pdf', blob: new Blob([sample1PagePdfBuffer]) },
        { name: 'sample-3pages-page-2.pdf', blob: new Blob([sample1PagePdfBuffer]) },
      ]);

      const zip = await JSZip.loadAsync(await zipBlob.arrayBuffer());
      const keys = Object.keys(zip.files);
      expect(keys).toEqual(['sample-3pages-page-1.pdf', 'sample-3pages-page-2.pdf']);
      keys.forEach((key) => {
        expect(key.startsWith('Convert24 - ')).toBe(false);
      });
    });
  });
});
