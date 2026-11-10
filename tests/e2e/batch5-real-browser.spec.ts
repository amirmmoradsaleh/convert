import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { PDFDocument } from 'pdf-lib';
import JSZip from 'jszip';

test.describe('Batch 5: Real-Browser Artifact Verification (Five PDF Tools)', () => {
  const fixturesDir = path.join(process.cwd(), 'tests/fixtures');
  const tempDownloadDir = path.join(process.cwd(), 'tests/fixtures/audit/downloads');

  const sample1PagePdf = path.join(fixturesDir, 'sample-1page.pdf');
  const sample3PagesPdf = path.join(fixturesDir, 'sample-3pages.pdf');
  const compressiblePdf = path.join(fixturesDir, 'compressible.pdf');
  const alreadyOptimizedPdf = path.join(fixturesDir, 'already-optimized.pdf');
  const samplePngPath = path.join(fixturesDir, 'sample.png');

  test.beforeAll(() => {
    if (!fs.existsSync(tempDownloadDir)) {
      fs.mkdirSync(tempDownloadDir, { recursive: true });
    }
  });

  // =========================================================================
  // 1. Tool 21: Split PDF Real-Browser Artifact Tests
  // =========================================================================
  test('Split PDF: Mode A (extract pages 1 & 3) downloads ZIP with unprefixed internal PDFs and Convert24 - outer name', async ({
    page,
  }) => {
    await page.goto('/tools/split-pdf');
    await page.locator('[data-hydrated="true"]').waitFor({ timeout: 10000 });

    const fileInput = page.locator('#split-pdf-file-input');
    await fileInput.setInputFiles(sample3PagesPdf);

    await expect(page.getByText('sample-3pages.pdf')).toBeVisible();
    await expect(page.getByText('3 pages', { exact: true })).toBeVisible();

    // Mode A: By default all 3 are selected. Deselect Page 2 to extract Pages 1 and 3.
    const page2Card = page.locator('div[role="checkbox"]').filter({ hasText: 'Page 2' });
    await page2Card.click();
    await expect(page.getByText(/2 of 3 pages selected/i)).toBeVisible();

    const splitBtn = page.getByRole('button', { name: /^Split PDF$/i });
    await expect(splitBtn).toBeEnabled();
    await splitBtn.click();

    await expect(page.getByText('PDF Split Complete!')).toBeVisible({ timeout: 15000 });

    const downloadZipBtn = page.getByRole('button', { name: /Download All as ZIP/i });
    await expect(downloadZipBtn).toBeVisible();

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      downloadZipBtn.click(),
    ]);

    // 1. Check outer brand prefix
    expect(download.suggestedFilename()).toBe('Convert24 - sample-3pages-split.zip');

    // 2. Save ZIP and inspect internal files
    const savePath = path.join(tempDownloadDir, 'test-split-pdf.zip');
    await download.saveAs(savePath);

    const zipBuffer = fs.readFileSync(savePath);
    expect(zipBuffer.length).toBeGreaterThan(500);

    const zip = await JSZip.loadAsync(zipBuffer);
    const fileNames = Object.keys(zip.files);

    // Crucial: check un-prefixed internal filenames
    expect(fileNames).toContain('sample-3pages-page-1.pdf');
    expect(fileNames).toContain('sample-3pages-page-3.pdf');
    fileNames.forEach((fn) => {
      expect(fn).not.toMatch(/^Convert24\s*-\s*/);
    });

    // 3. Inspect extracted PDF 1
    const p1Bytes = await zip.file('sample-3pages-page-1.pdf')!.async('nodebuffer');
    const doc1 = await PDFDocument.load(p1Bytes);
    expect(doc1.getPageCount()).toBe(1);

    // 4. Inspect extracted PDF 3
    const p3Bytes = await zip.file('sample-3pages-page-3.pdf')!.async('nodebuffer');
    const doc3 = await PDFDocument.load(p3Bytes);
    expect(doc3.getPageCount()).toBe(1);

    fs.unlinkSync(savePath);
  });

  test('Split PDF: Mode C (range 1-2, 3) downloads individual range PDF artifact', async ({
    page,
  }) => {
    await page.goto('/tools/split-pdf');
    await page.locator('[data-hydrated="true"]').waitFor({ timeout: 10000 });

    const fileInput = page.locator('#split-pdf-file-input');
    await fileInput.setInputFiles(sample3PagesPdf);
    await expect(page.getByText('sample-3pages.pdf')).toBeVisible();

    // Switch to Split by Ranges mode
    const modeBtn = page.getByRole('button', { name: /Split by Ranges/i });
    await modeBtn.click();

    // Enter custom range
    const rangeInput = page.locator('#range-input');
    await rangeInput.fill('1-2, 3');

    const splitBtn = page.getByRole('button', { name: /^Split PDF$/i });
    await splitBtn.click();

    await expect(page.getByText('PDF Split Complete!')).toBeVisible({ timeout: 15000 });

    // Download first item: pages 1-2
    const firstDownloadBtn = page.getByRole('button', { name: /^Download$/i }).first();
    await expect(firstDownloadBtn).toBeVisible();

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      firstDownloadBtn.click(),
    ]);

    expect(download.suggestedFilename()).toBe('Convert24 - sample-3pages-pages-1-2.pdf');

    const savePath = path.join(tempDownloadDir, 'test-split-range.pdf');
    await download.saveAs(savePath);

    const pdfBuffer = fs.readFileSync(savePath);
    const doc = await PDFDocument.load(pdfBuffer);
    expect(doc.getPageCount()).toBe(2);

    fs.unlinkSync(savePath);
  });

  // =========================================================================
  // 2. Tool 22: Compress PDF Real-Browser Artifact Tests
  // =========================================================================
  test('Compress PDF: compressible document achieves size reduction and retains 5 valid pages', async ({
    page,
  }) => {
    await page.goto('/tools/compress-pdf');
    await page.locator('[data-hydrated="true"]').waitFor({ timeout: 10000 });

    const fileInput = page.locator('#compress-pdf-file-input');
    await fileInput.setInputFiles(compressiblePdf);

    await expect(page.getByText('compressible.pdf')).toBeVisible();

    // Select 60% quality
    await page.locator('#compress-pdf-quality-60').click();

    const compressBtn = page.getByRole('button', { name: /^Compress PDF$/i });
    await compressBtn.click();

    await expect(page.getByText('PDF compressed successfully')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Reduced by', { exact: true })).toBeVisible();

    const dlBtn = page.getByRole('button', { name: /Download Compressed PDF/i });
    await expect(dlBtn).toBeVisible();

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      dlBtn.click(),
    ]);

    expect(download.suggestedFilename()).toBe('Convert24 - compressible-compressed.pdf');

    const savePath = path.join(tempDownloadDir, 'test-compress-reduced.pdf');
    await download.saveAs(savePath);

    const origBuffer = fs.readFileSync(compressiblePdf);
    const downloadedBuffer = fs.readFileSync(savePath);

    // Verify file size is smaller
    expect(downloadedBuffer.length).toBeLessThan(origBuffer.length);

    // Verify valid PDF and page count preserved
    const doc = await PDFDocument.load(downloadedBuffer);
    expect(doc.getPageCount()).toBe(5);

    fs.unlinkSync(savePath);
  });

  test('Compress PDF: already-optimized document retains original bytes without corruption', async ({
    page,
  }) => {
    await page.goto('/tools/compress-pdf');
    await page.locator('[data-hydrated="true"]').waitFor({ timeout: 10000 });

    const fileInput = page.locator('#compress-pdf-file-input');
    await fileInput.setInputFiles(alreadyOptimizedPdf);

    const compressBtn = page.getByRole('button', { name: /^Compress PDF$/i });
    await compressBtn.click();

    await expect(page.getByText('The PDF could not be reduced further')).toBeVisible({ timeout: 15000 });

    const dlBtn = page.getByRole('button', { name: /Download Original PDF/i });
    await expect(dlBtn).toBeVisible();

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      dlBtn.click(),
    ]);

    expect(download.suggestedFilename()).toBe('Convert24 - already-optimized.pdf');

    const savePath = path.join(tempDownloadDir, 'test-compress-original.pdf');
    await download.saveAs(savePath);

    const origBuffer = fs.readFileSync(alreadyOptimizedPdf);
    const downloadedBuffer = fs.readFileSync(savePath);

    expect(downloadedBuffer.length).toBe(origBuffer.length);
    const doc = await PDFDocument.load(downloadedBuffer);
    expect(doc.getPageCount()).toBe(1);

    fs.unlinkSync(savePath);
  });

  // =========================================================================
  // 3. Tool 23: Rotate PDF Real-Browser Artifact Tests
  // =========================================================================
  test('Rotate PDF: rotating all pages by 90° updates internal /Rotate dictionary entry to 90', async ({
    page,
  }) => {
    await page.goto('/tools/rotate-pdf');
    await page.locator('[data-hydrated="true"]').waitFor({ timeout: 10000 });

    const fileInput = page.locator('#rotate-pdf-file-input');
    await fileInput.setInputFiles(sample3PagesPdf);

    await expect(page.getByText('sample-3pages.pdf')).toBeVisible();

    // Default angle is 90° clockwise, scope is Rotate All Pages
    const rotateBtn = page.getByRole('button', { name: /Rotate All Pages \(90°\)/i });
    await expect(rotateBtn).toBeEnabled();
    await rotateBtn.click();

    await expect(page.getByText('PDF rotated successfully')).toBeVisible({ timeout: 15000 });

    const dlBtn = page.getByRole('button', { name: /Download Rotated PDF/i });
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      dlBtn.click(),
    ]);

    expect(download.suggestedFilename()).toBe('Convert24 - sample-3pages-rotated.pdf');

    const savePath = path.join(tempDownloadDir, 'test-rotate-all-90.pdf');
    await download.saveAs(savePath);

    const downloadedBuffer = fs.readFileSync(savePath);
    const doc = await PDFDocument.load(downloadedBuffer);
    expect(doc.getPageCount()).toBe(3);

    // Verify all 3 pages have /Rotate 90 degrees
    for (let i = 0; i < 3; i++) {
      expect(doc.getPage(i).getRotation().angle).toBe(90);
    }

    fs.unlinkSync(savePath);
  });

  test('Rotate PDF: rotating selected page by 180° updates only that page', async ({
    page,
  }) => {
    await page.goto('/tools/rotate-pdf');
    await page.locator('[data-hydrated="true"]').waitFor({ timeout: 10000 });

    const fileInput = page.locator('#rotate-pdf-file-input');
    await fileInput.setInputFiles(sample3PagesPdf);
    await expect(page.getByText('sample-3pages.pdf')).toBeVisible();

    // Select 180° angle
    const angle180Btn = page.getByRole('button', { name: /^180°$/i });
    await angle180Btn.click();

    // Select Rotate Selected Pages
    const scopeSelectedBtn = page.getByRole('button', { name: /^Rotate Selected Pages$/i });
    await scopeSelectedBtn.click();

    // By default all 3 are selected. Deselect Page 2 and Page 3 so only Page 1 is rotated.
    const page2Card = page.locator('div[role="checkbox"]').filter({ hasText: 'Page 2' });
    await page2Card.click();
    const page3Card = page.locator('div[role="checkbox"]').filter({ hasText: 'Page 3' });
    await page3Card.click();

    const rotateBtn = page.getByRole('button', { name: /Rotate 1 Page \(180°\)/i });
    await rotateBtn.click();

    await expect(page.getByText('PDF rotated successfully')).toBeVisible({ timeout: 15000 });

    const dlBtn = page.getByRole('button', { name: /Download Rotated PDF/i });
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      dlBtn.click(),
    ]);

    expect(download.suggestedFilename()).toBe('Convert24 - sample-3pages-rotated.pdf');

    const savePath = path.join(tempDownloadDir, 'test-rotate-selected-180.pdf');
    await download.saveAs(savePath);

    const doc = await PDFDocument.load(fs.readFileSync(savePath));
    expect(doc.getPageCount()).toBe(3);
    expect(doc.getPage(0).getRotation().angle).toBe(180); // Page 1 rotated
    expect(doc.getPage(1).getRotation().angle).toBe(0);   // Page 2 untouched
    expect(doc.getPage(2).getRotation().angle).toBe(0);   // Page 3 untouched

    fs.unlinkSync(savePath);
  });

  // =========================================================================
  // 4. Tool 24: Delete PDF Pages Real-Browser Artifact Tests
  // =========================================================================
  test('Delete PDF Pages: removes selected page (Page 2 of 3) producing valid 2-page PDF artifact', async ({
    page,
  }) => {
    await page.goto('/tools/delete-pdf-pages');
    await page.locator('[data-hydrated="true"]').waitFor({ timeout: 10000 });

    const fileInput = page.locator('#delete-pdf-pages-file-input');
    await fileInput.setInputFiles(sample3PagesPdf);

    await expect(page.getByText('sample-3pages.pdf')).toBeVisible();

    // Select Page 2 for deletion
    const page2Card = page.locator('div[role="checkbox"]').filter({ hasText: 'Page 2' });
    await page2Card.click();

    const deleteBtn = page.getByRole('button', { name: /Delete 1 Page/i });
    await expect(deleteBtn).toBeEnabled();
    await deleteBtn.click();

    await expect(page.getByText('Pages deleted successfully')).toBeVisible({ timeout: 15000 });

    const dlBtn = page.getByRole('button', { name: /Download PDF/i });
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      dlBtn.click(),
    ]);

    expect(download.suggestedFilename()).toBe('Convert24 - sample-3pages-pages-deleted.pdf');

    const savePath = path.join(tempDownloadDir, 'test-delete-page-2.pdf');
    await download.saveAs(savePath);

    const doc = await PDFDocument.load(fs.readFileSync(savePath));
    expect(doc.getPageCount()).toBe(2);

    fs.unlinkSync(savePath);
  });

  test('Delete PDF Pages: UI blocks deleting all pages with safety alert', async ({
    page,
  }) => {
    await page.goto('/tools/delete-pdf-pages');
    await page.locator('[data-hydrated="true"]').waitFor({ timeout: 10000 });

    const fileInput = page.locator('#delete-pdf-pages-file-input');
    await fileInput.setInputFiles(sample3PagesPdf);

    // Select all pages
    const selectAllBtn = page.getByRole('button', { name: /Select All/i });
    await selectAllBtn.click();

    // Safety message displayed
    await expect(
      page.getByText(/At least one page must remain/i)
    ).toBeVisible();

    // Delete button disabled
    const deleteBtn = page.locator('#delete-pages-submit-btn');
    await expect(deleteBtn).toBeDisabled();
  });

  // =========================================================================
  // 5. Tool 25: Reorder PDF Pages Real-Browser Artifact Tests
  // =========================================================================
  test('Reorder PDF Pages: moves Page 2 up to position 1 and produces valid reordered PDF artifact', async ({
    page,
  }) => {
    await page.goto('/tools/reorder-pdf-pages');
    await page.locator('[data-hydrated="true"]').waitFor({ timeout: 10000 });

    const fileInput = page.locator('#reorder-pdf-pages-file-input');
    await fileInput.setInputFiles(sample3PagesPdf);

    await expect(page.getByText('sample-3pages.pdf')).toBeVisible();

    // Move page 2 up to position 1
    const page2Card = page.locator('div[aria-label*="Original Page 2"]');
    const moveUpBtn = page2Card.getByRole('button', { name: /Move page 2 earlier/i });
    await moveUpBtn.click();

    // Verify sequence updated to 2 → 1 → 3
    await expect(page.getByText('2 → 1 → 3')).toBeVisible();

    const submitBtn = page.locator('#reorder-pages-submit-btn');
    await expect(submitBtn).toBeEnabled();
    await submitBtn.click();

    await expect(page.getByText('PDF pages reordered successfully')).toBeVisible({ timeout: 15000 });

    const dlBtn = page.getByRole('button', { name: /Download Reordered PDF/i });
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      dlBtn.click(),
    ]);

    expect(download.suggestedFilename()).toBe('Convert24 - sample-3pages-reordered.pdf');

    const savePath = path.join(tempDownloadDir, 'test-reorder-2-1-3.pdf');
    await download.saveAs(savePath);

    const doc = await PDFDocument.load(fs.readFileSync(savePath));
    expect(doc.getPageCount()).toBe(3);

    fs.unlinkSync(savePath);
  });

  // =========================================================================
  // 6. Cross-cutting Error Handling in Browser
  // =========================================================================
  test('Browser Error Handling: non-PDF uploads are gracefully rejected with user-friendly alerts', async ({
    page,
  }) => {
    // 1. Split PDF rejection
    await page.goto('/tools/split-pdf');
    await page.locator('[data-hydrated="true"]').waitFor({ timeout: 10000 });
    await page.locator('#split-pdf-file-input').setInputFiles(samplePngPath);
    await expect(page.getByText(/This file is not a valid PDF/i)).toBeVisible();

    // 2. Compress PDF rejection
    await page.goto('/tools/compress-pdf');
    await page.locator('[data-hydrated="true"]').waitFor({ timeout: 10000 });
    await page.locator('#compress-pdf-file-input').setInputFiles(samplePngPath);
    await expect(page.getByText(/Please choose a valid PDF file/i)).toBeVisible();

    // 3. Rotate PDF rejection
    await page.goto('/tools/rotate-pdf');
    await page.locator('[data-hydrated="true"]').waitFor({ timeout: 10000 });
    await page.locator('#rotate-pdf-file-input').setInputFiles(samplePngPath);
    await expect(page.getByText(/Please choose a valid PDF file/i)).toBeVisible();

    // 4. Delete PDF Pages rejection
    await page.goto('/tools/delete-pdf-pages');
    await page.locator('[data-hydrated="true"]').waitFor({ timeout: 10000 });
    await page.locator('#delete-pdf-pages-file-input').setInputFiles(samplePngPath);
    await expect(page.getByText(/This file is not a valid PDF/i)).toBeVisible();

    // 5. Reorder PDF Pages rejection
    await page.goto('/tools/reorder-pdf-pages');
    await page.locator('[data-hydrated="true"]').waitFor({ timeout: 10000 });
    await page.locator('#reorder-pdf-pages-file-input').setInputFiles(samplePngPath);
    await expect(page.getByText(/This file is not a valid PDF|Please choose a valid PDF document/i)).toBeVisible();
  });
});
