import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { PDFDocument } from 'pdf-lib';

test.describe('Tool #25: Reorder PDF Pages E2E', () => {
  const sample1PagePdf = path.join(process.cwd(), 'tests/fixtures/sample-1page.pdf');
  const sample3PagesPdf = path.join(process.cwd(), 'tests/fixtures/sample-3pages.pdf');
  const samplePngPath = path.join(process.cwd(), 'tests/fixtures/sample.png');

  test('Test 1: Reorder pages using Move Up/Down controls and verify downloaded PDF', async ({
    page,
  }) => {
    await page.goto('/tools/reorder-pdf-pages');
    await page.locator('[data-hydrated="true"]').waitFor({ timeout: 10000 });
    await expect(page).toHaveTitle(/Reorder PDF Pages Online/i);
    await expect(page.locator('h1')).toHaveText(/Reorder PDF Pages/i);

    // Upload 3-page PDF
    const fileInput = page.locator('#reorder-pdf-pages-file-input');
    await fileInput.setInputFiles(sample3PagesPdf);

    // Verify file loaded and 3 pages detected
    await expect(page.getByText('sample-3pages.pdf')).toBeVisible();
    await expect(page.getByText('3 pages', { exact: true })).toBeVisible();

    // Verify initial sequence: 1 -> 2 -> 3
    await expect(page.getByText('1 → 2 → 3')).toBeVisible();

    // Move page 2 up to position 1
    // Find card for page 2
    const page2Card = page.locator('div[aria-label*="Original Page 2"]');
    const moveUpBtn = page2Card.getByRole('button', { name: /Move page 2 earlier/i });
    await moveUpBtn.click();

    // Verify updated sequence: 2 -> 1 -> 3
    await expect(page.getByText('2 → 1 → 3')).toBeVisible();

    // Click Apply New Page Order
    const submitBtn = page.locator('#reorder-pages-submit-btn');
    await expect(submitBtn).toBeEnabled();
    await submitBtn.click();

    // Verify success result UI
    await expect(page.getByText('PDF pages reordered successfully')).toBeVisible({
      timeout: 15000,
    });
    await expect(page.getByText('sample-3pages-reordered.pdf')).toBeVisible();
    await expect(page.getByText('2 → 1 → 3')).toBeVisible();

    // Capture and verify download blob
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: /Download Reordered PDF/i }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('Convert24 - sample-3pages-reordered.pdf');

    const downloadPath = await download.path();
    expect(downloadPath).not.toBeNull();
    if (downloadPath) {
      const downloadedBytes = fs.readFileSync(downloadPath);
      expect(downloadedBytes.subarray(0, 5).toString('ascii')).toBe('%PDF-');

      const loadedDoc = await PDFDocument.load(downloadedBytes);
      expect(loadedDoc.getPageCount()).toBe(3);
    }
  });

  test('Test 2: Reset Order restores the initial page sequence', async ({ page }) => {
    await page.goto('/tools/reorder-pdf-pages');
    await page.locator('[data-hydrated="true"]').waitFor({ timeout: 10000 });

    const fileInput = page.locator('#reorder-pdf-pages-file-input');
    await fileInput.setInputFiles(sample3PagesPdf);
    await expect(page.getByText('sample-3pages.pdf')).toBeVisible();

    // Move page 3 earlier
    const page3Card = page.locator('div[aria-label*="Original Page 3"]');
    await page3Card.getByRole('button', { name: /Move page 3 earlier/i }).click();

    // Verify sequence is now 1 -> 3 -> 2
    await expect(page.getByText('1 → 3 → 2')).toBeVisible();

    // Click Reset Order
    const resetOrderBtn = page.getByRole('button', { name: /Reset Order/i });
    await expect(resetOrderBtn).toBeEnabled();
    await resetOrderBtn.click();

    // Verify sequence is back to 1 -> 2 -> 3
    await expect(page.getByText('1 → 2 → 3')).toBeVisible();
    await expect(resetOrderBtn).toBeDisabled();
  });

  test('Test 3: Single-page PDF shows informational notice', async ({ page }) => {
    await page.goto('/tools/reorder-pdf-pages');
    await page.locator('[data-hydrated="true"]').waitFor({ timeout: 10000 });

    const fileInput = page.locator('#reorder-pdf-pages-file-input');
    await fileInput.setInputFiles(sample1PagePdf);
    await expect(page.getByText('sample-1page.pdf')).toBeVisible();

    // Verify single-page notice
    await expect(
      page.getByText(/This document contains only 1 page. Reordering is not applicable/i)
    ).toBeVisible();
  });

  test('Test 4: Rejects non-PDF file upload with friendly error message', async ({ page }) => {
    await page.goto('/tools/reorder-pdf-pages');
    await page.locator('[data-hydrated="true"]').waitFor({ timeout: 10000 });

    const fileInput = page.locator('#reorder-pdf-pages-file-input');
    await fileInput.setInputFiles(samplePngPath);

    await expect(
      page.getByText(/This file is not a valid PDF|Please choose a valid PDF document/i)
    ).toBeVisible({ timeout: 5000 });
  });

  test('Test 5: Reset / start over returns to initial upload state', async ({ page }) => {
    await page.goto('/tools/reorder-pdf-pages');
    await page.locator('[data-hydrated="true"]').waitFor({ timeout: 10000 });

    const fileInput = page.locator('#reorder-pdf-pages-file-input');
    await fileInput.setInputFiles(sample3PagesPdf);
    await expect(page.getByText('sample-3pages.pdf')).toBeVisible();

    // Click remove/trash button
    const removeBtn = page.getByLabel('Remove file');
    await removeBtn.click();

    // Verify upload zone returns
    await expect(page.getByText('Choose a PDF file to reorder pages')).toBeVisible();
    await expect(page.getByText('sample-3pages.pdf')).not.toBeVisible();
  });

  test('Test 6: Mobile viewport displays responsive UI without horizontal overflow', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/tools/reorder-pdf-pages');
    await page.locator('[data-hydrated="true"]').waitFor({ timeout: 10000 });

    const fileInput = page.locator('#reorder-pdf-pages-file-input');
    await fileInput.setInputFiles(sample3PagesPdf);
    await expect(page.getByText('sample-3pages.pdf')).toBeVisible();

    await expect(page.locator('#reorder-pages-submit-btn')).toBeVisible();

    // Verify no horizontal overflow
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 2);
  });
});
