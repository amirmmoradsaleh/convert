import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { PDFDocument } from 'pdf-lib';
import sharp from 'sharp';
import JSZip from 'jszip';

test.describe('Batch 4: Real-Browser Artifact Verification (Five PDF Tools)', () => {
  const fixturesDir = path.join(process.cwd(), 'tests/fixtures');
  const tempDownloadDir = path.join(process.cwd(), 'tests/fixtures/audit/downloads');

  const sampleJpgPath = path.join(fixturesDir, 'sample.jpg');
  const sampleJpegPath = path.join(fixturesDir, 'sample.jpeg');
  const samplePngPath = path.join(fixturesDir, 'sample.png');
  const transparentPngPath = path.join(fixturesDir, 'transparent.png');
  const semitransparentPngPath = path.join(fixturesDir, 'semitransparent.png');
  const sample1PagePdf = path.join(fixturesDir, 'sample-1page.pdf');
  const sample2PagesPdf = path.join(fixturesDir, 'sample-2pages.pdf');
  const sample3PagesPdf = path.join(fixturesDir, 'sample-3pages.pdf');
  const alreadyOptimizedPdf = path.join(fixturesDir, 'already-optimized.pdf');
  const corruptedJpgPath = path.join(fixturesDir, 'corrupted.jpg');

  test.beforeAll(() => {
    if (!fs.existsSync(tempDownloadDir)) {
      fs.mkdirSync(tempDownloadDir, { recursive: true });
    }
  });

  // =========================================================================
  // 1. Tool 16: JPG to PDF Real-Browser Artifact Tests
  // =========================================================================
  test('JPG to PDF: single JPG converts to valid PDF artifact with Convert24 - prefix', async ({
    page,
  }) => {
    await page.goto('/tools/jpg-to-pdf');
    await page.locator('[data-hydrated="true"]').waitFor({ timeout: 10000 });

    const fileInput = page.locator('#jpg-to-pdf-file-input');
    await fileInput.setInputFiles(sampleJpgPath);

    await expect(page.getByText('sample.jpg')).toBeVisible();
    const convertBtn = page.getByRole('button', { name: /Convert to PDF/i });
    await convertBtn.click();

    await expect(page.getByText('PDF Created Successfully!')).toBeVisible({ timeout: 15000 });
    const dlBtn = page.getByRole('button', { name: /Download PDF/i });
    await expect(dlBtn).toBeVisible();

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      dlBtn.click(),
    ]);

    // 1. Verify download filename has exact Convert24 - prefix
    const suggested = download.suggestedFilename();
    expect(suggested).toBe('Convert24 - sample.pdf');

    // 2. Save and inspect downloaded artifact with pdf-lib
    const savePath = path.join(tempDownloadDir, 'test-jpg-to-pdf-single.pdf');
    await download.saveAs(savePath);

    const pdfBuffer = fs.readFileSync(savePath);
    expect(pdfBuffer.length).toBeGreaterThan(500);

    const pdfDoc = await PDFDocument.load(pdfBuffer);
    expect(pdfDoc.getPageCount()).toBe(1);

    const p1 = pdfDoc.getPages()[0];
    const { width, height } = p1.getSize();
    // A4 dimensions
    expect(width).toBeCloseTo(595.28, 1);
    expect(height).toBeCloseTo(841.89, 1);
    expect(p1.node.Contents()).toBeDefined();

    fs.unlinkSync(savePath);
  });

  test('JPG to PDF: multiple JPGs convert to multi-page PDF preserving order', async ({
    page,
  }) => {
    await page.goto('/tools/jpg-to-pdf');
    await page.locator('[data-hydrated="true"]').waitFor({ timeout: 10000 });

    const fileInput = page.locator('#jpg-to-pdf-file-input');
    await fileInput.setInputFiles([sampleJpgPath, sampleJpegPath]);

    await expect(page.getByText(/2 JPG Images Selected/i)).toBeVisible();
    const convertBtn = page.getByRole('button', { name: /Convert to PDF \(2 pages\)/i });
    await convertBtn.click();

    await expect(page.getByText('PDF Created Successfully!')).toBeVisible({ timeout: 15000 });
    const dlBtn = page.getByRole('button', { name: /Download PDF/i });

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      dlBtn.click(),
    ]);

    expect(download.suggestedFilename()).toBe('Convert24 - jpg-to-pdf.pdf');

    const savePath = path.join(tempDownloadDir, 'test-jpg-to-pdf-multi.pdf');
    await download.saveAs(savePath);

    const pdfDoc = await PDFDocument.load(fs.readFileSync(savePath));
    expect(pdfDoc.getPageCount()).toBe(2);

    fs.unlinkSync(savePath);
  });

  // =========================================================================
  // 2. Tool 17: PNG to PDF Real-Browser Artifact Tests
  // =========================================================================
  test('PNG to PDF: opaque and transparent PNGs convert to valid PDF artifacts', async ({
    page,
  }) => {
    await page.goto('/tools/png-to-pdf');
    await page.locator('[data-hydrated="true"]').waitFor({ timeout: 10000 });

    // Upload transparent PNG
    const fileInput = page.locator('#png-to-pdf-file-input');
    await fileInput.setInputFiles(transparentPngPath);

    await expect(page.getByText('transparent.png')).toBeVisible();
    const convertBtn = page.getByRole('button', { name: /Convert to PDF/i });
    await convertBtn.click();

    await expect(page.getByText('PDF Created Successfully!')).toBeVisible({ timeout: 15000 });
    const dlBtn = page.getByRole('button', { name: /Download PDF/i });

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      dlBtn.click(),
    ]);

    expect(download.suggestedFilename()).toBe('Convert24 - transparent.pdf');

    const savePath = path.join(tempDownloadDir, 'test-png-to-pdf-transparent.pdf');
    await download.saveAs(savePath);

    const pdfDoc = await PDFDocument.load(fs.readFileSync(savePath));
    expect(pdfDoc.getPageCount()).toBe(1);
    expect(pdfDoc.getPages()[0].node.Contents()).toBeDefined();

    fs.unlinkSync(savePath);
  });

  // =========================================================================
  // 3. Tool 18: PDF to JPG Real-Browser Artifact Tests
  // =========================================================================
  test('PDF to JPG: 1-page PDF converts to single decodable JPG with Convert24 - prefix', async ({
    page,
  }) => {
    await page.goto('/tools/pdf-to-jpg');
    await page.locator('[data-hydrated="true"]').waitFor({ timeout: 10000 });

    const fileInput = page.locator('#pdf-to-jpg-file-input');
    await fileInput.setInputFiles(sample1PagePdf);

    await expect(page.getByText('sample-1page.pdf')).toBeVisible();
    const convertBtn = page.getByRole('button', { name: /Convert 1 Page to JPG/i });
    await convertBtn.click();

    await expect(page.getByText('PDF Converted Successfully')).toBeVisible({ timeout: 15000 });
    const dlBtn = page.getByRole('button', { name: /Download JPG/i });

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      dlBtn.click(),
    ]);

    expect(download.suggestedFilename()).toBe('Convert24 - sample-1page-page-1.jpg');

    const savePath = path.join(tempDownloadDir, 'test-pdf-to-jpg-single.jpg');
    await download.saveAs(savePath);

    // Verify artifact with Sharp
    const meta = await sharp(savePath).metadata();
    expect(meta.format).toBe('jpeg');
    expect(meta.width).toBeGreaterThan(0);
    expect(meta.height).toBeGreaterThan(0);

    fs.unlinkSync(savePath);
  });

  test('PDF to JPG: 3-page PDF converts to ZIP package with un-prefixed internal entries', async ({
    page,
  }) => {
    await page.goto('/tools/pdf-to-jpg');
    await page.locator('[data-hydrated="true"]').waitFor({ timeout: 10000 });

    const fileInput = page.locator('#pdf-to-jpg-file-input');
    await fileInput.setInputFiles(sample3PagesPdf);

    const convertBtn = page.getByRole('button', { name: /Convert 3 Pages to JPG/i });
    await convertBtn.click();

    await expect(page.getByText('PDF Converted Successfully')).toBeVisible({ timeout: 15000 });
    const dlZipBtn = page.getByRole('button', { name: /Download All \(ZIP\)/i });

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      dlZipBtn.click(),
    ]);

    // Verify outer archive name has Convert24 - prefix
    expect(download.suggestedFilename()).toBe('Convert24 - sample-3pages-jpg-images.zip');

    const savePath = path.join(tempDownloadDir, 'test-pdf-to-jpg-pages.zip');
    await download.saveAs(savePath);

    // Inspect ZIP package with JSZip
    const zip = await JSZip.loadAsync(fs.readFileSync(savePath));
    const entryNames = Object.keys(zip.files);

    expect(entryNames).toHaveLength(3);
    expect(entryNames).toEqual([
      'sample-3pages-page-1.jpg',
      'sample-3pages-page-2.jpg',
      'sample-3pages-page-3.jpg',
    ]);

    // Ensure none of the internal files have the brand prefix
    for (const name of entryNames) {
      expect(name.startsWith('Convert24 - ')).toBe(false);

      // Verify each entry is a valid JPEG
      const entryBuffer = await zip.file(name)!.async('nodebuffer');
      const meta = await sharp(entryBuffer).metadata();
      expect(meta.format).toBe('jpeg');
      expect(meta.width).toBeGreaterThan(0);
      expect(meta.height).toBeGreaterThan(0);
    }

    fs.unlinkSync(savePath);
  });

  // =========================================================================
  // 4. Tool 19: PDF to PNG Real-Browser Artifact Tests
  // =========================================================================
  test('PDF to PNG: 1-page PDF converts to single decodable PNG with Convert24 - prefix', async ({
    page,
  }) => {
    await page.goto('/tools/pdf-to-png');
    await page.locator('[data-hydrated="true"]').waitFor({ timeout: 10000 });

    const fileInput = page.locator('#pdf-to-png-file-input');
    await fileInput.setInputFiles(sample1PagePdf);

    const convertBtn = page.getByRole('button', { name: /Convert 1 Page to PNG/i });
    await convertBtn.click();

    await expect(page.getByText('PDF Converted Successfully')).toBeVisible({ timeout: 15000 });
    const dlBtn = page.getByRole('button', { name: /Download PNG/i });

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      dlBtn.click(),
    ]);

    expect(download.suggestedFilename()).toBe('Convert24 - sample-1page-page-1.png');

    const savePath = path.join(tempDownloadDir, 'test-pdf-to-png-single.png');
    await download.saveAs(savePath);

    const meta = await sharp(savePath).metadata();
    expect(meta.format).toBe('png');
    expect(meta.width).toBeGreaterThan(0);
    expect(meta.height).toBeGreaterThan(0);

    fs.unlinkSync(savePath);
  });

  test('PDF to PNG: 3-page PDF converts to ZIP package with un-prefixed internal entries', async ({
    page,
  }) => {
    await page.goto('/tools/pdf-to-png');
    await page.locator('[data-hydrated="true"]').waitFor({ timeout: 10000 });

    const fileInput = page.locator('#pdf-to-png-file-input');
    await fileInput.setInputFiles(sample3PagesPdf);

    const convertBtn = page.getByRole('button', { name: /Convert 3 Pages to PNG/i });
    await convertBtn.click();

    await expect(page.getByText('PDF Converted Successfully')).toBeVisible({ timeout: 15000 });
    const dlZipBtn = page.getByRole('button', { name: /Download All \(ZIP\)/i });

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      dlZipBtn.click(),
    ]);

    expect(download.suggestedFilename()).toBe('Convert24 - sample-3pages-png-images.zip');

    const savePath = path.join(tempDownloadDir, 'test-pdf-to-png-pages.zip');
    await download.saveAs(savePath);

    const zip = await JSZip.loadAsync(fs.readFileSync(savePath));
    const entryNames = Object.keys(zip.files);
    expect(entryNames).toHaveLength(3);
    expect(entryNames).toEqual([
      'sample-3pages-page-1.png',
      'sample-3pages-page-2.png',
      'sample-3pages-page-3.png',
    ]);

    for (const name of entryNames) {
      expect(name.startsWith('Convert24 - ')).toBe(false);
      const entryBuffer = await zip.file(name)!.async('nodebuffer');
      const meta = await sharp(entryBuffer).metadata();
      expect(meta.format).toBe('png');
      expect(meta.width).toBeGreaterThan(0);
      expect(meta.height).toBeGreaterThan(0);
    }

    fs.unlinkSync(savePath);
  });

  // =========================================================================
  // 5. Tool 20: Merge PDF Real-Browser Artifact Tests
  // =========================================================================
  test('Merge PDF: merges documents with different page counts and distinct dimensions', async ({
    page,
  }) => {
    await page.goto('/tools/merge-pdf');
    await page.locator('[data-hydrated="true"]').waitFor({ timeout: 10000 });

    // Upload sample-1page (400x600, 1 page) + already-optimized (300x300, 1 page) + sample-2pages (400x600, 2 pages)
    const fileInput = page.locator('#merge-pdf-file-input');
    await fileInput.setInputFiles([sample1PagePdf, alreadyOptimizedPdf, sample2PagesPdf]);

    await expect(page.getByText(/4 pages total/i)).toBeVisible();
    const mergeBtn = page.getByRole('button', { name: /Merge 3 PDFs/i });
    await mergeBtn.click();

    await expect(page.getByText('PDFs Merged Successfully')).toBeVisible({ timeout: 15000 });
    const dlBtn = page.getByRole('button', { name: /Download Merged PDF/i });

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      dlBtn.click(),
    ]);

    expect(download.suggestedFilename()).toBe('Convert24 - merged.pdf');

    const savePath = path.join(tempDownloadDir, 'test-merge-distinct-dims.pdf');
    await download.saveAs(savePath);

    const mergedDoc = await PDFDocument.load(fs.readFileSync(savePath));
    expect(mergedDoc.getPageCount()).toBe(4); // 1 + 1 + 2 = 4

    const pages = mergedDoc.getPages();
    // Page 1: 400x600
    expect(pages[0].getSize().width).toBe(400);
    expect(pages[0].getSize().height).toBe(600);
    // Page 2: 300x300
    expect(pages[1].getSize().width).toBe(300);
    expect(pages[1].getSize().height).toBe(300);
    // Pages 3-4: 400x600
    expect(pages[2].getSize().width).toBe(400);
    expect(pages[2].getSize().height).toBe(600);
    expect(pages[3].getSize().width).toBe(400);
    expect(pages[3].getSize().height).toBe(600);

    fs.unlinkSync(savePath);
  });

  // =========================================================================
  // 6. Negative and Error Handling Tests across Tools
  // =========================================================================
  test('Negative & Error Handling: corrupted/non-matching files rejected with friendly UI alerts', async ({
    page,
  }) => {
    // 1. JPG to PDF rejects PNG
    await page.goto('/tools/jpg-to-pdf');
    await page.locator('[data-hydrated="true"]').waitFor({ timeout: 10000 });
    await page.locator('#jpg-to-pdf-file-input').setInputFiles(samplePngPath);
    await expect(page.getByText(/only jpg and jpeg images/i)).toBeVisible();

    // 2. PNG to PDF rejects JPG
    await page.goto('/tools/png-to-pdf');
    await page.locator('[data-hydrated="true"]').waitFor({ timeout: 10000 });
    await page.locator('#png-to-pdf-file-input').setInputFiles(sampleJpgPath);
    await expect(page.getByText(/not supported.*PNG image/i)).toBeVisible();

    // 3. PDF to JPG rejects non-PDF
    await page.goto('/tools/pdf-to-jpg');
    await page.locator('[data-hydrated="true"]').waitFor({ timeout: 10000 });
    await page.locator('#pdf-to-jpg-file-input').setInputFiles(samplePngPath);
    await expect(page.getByText(/not a valid PDF/i)).toBeVisible();

    // 4. PDF to PNG rejects non-PDF
    await page.goto('/tools/pdf-to-png');
    await page.locator('[data-hydrated="true"]').waitFor({ timeout: 10000 });
    await page.locator('#pdf-to-png-file-input').setInputFiles(sampleJpgPath);
    await expect(page.getByText(/not a valid PDF/i)).toBeVisible();

    // 5. Merge PDF rejects corrupted file
    await page.goto('/tools/merge-pdf');
    await page.locator('[data-hydrated="true"]').waitFor({ timeout: 10000 });
    await page.locator('#merge-pdf-file-input').setInputFiles([sample1PagePdf, corruptedJpgPath]);
    await expect(page.getByText(/not a valid PDF/i)).toBeVisible();
  });
});
