import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { PDFDocument } from 'pdf-lib';

test.describe('Tool #23: Rotate PDF E2E', () => {
  const sample1PagePdf = path.join(process.cwd(), 'tests/fixtures/sample-1page.pdf');
  const sample3PagesPdf = path.join(process.cwd(), 'tests/fixtures/sample-3pages.pdf');
  const samplePngPath = path.join(process.cwd(), 'tests/fixtures/sample.png');

  test('Test 1: Rotate All Pages by 90° clockwise', async ({ page }) => {
    await page.goto('/tools/rotate-pdf');
    await page.locator('[data-hydrated="true"]').waitFor({ timeout: 10000 });
    await expect(page).toHaveTitle(/Rotate PDF Pages Online/i);
    await expect(page.locator('h1')).toHaveText(/Rotate PDF Pages/i);

    // Upload 3-page PDF
    const fileInput = page.locator('#rotate-pdf-file-input');
    await fileInput.setInputFiles(sample3PagesPdf);

    // Verify file loaded and 3 pages detected
    await expect(page.getByText('sample-3pages.pdf')).toBeVisible();
    await expect(page.getByText('3 pages', { exact: true })).toBeVisible();

    // Default angle is 90°, scope is Rotate All Pages
    const rotateBtn = page.getByRole('button', { name: /Rotate All Pages \(90°\)/i });
    await expect(rotateBtn).toBeEnabled();
    await rotateBtn.click();

    // Verify success state
    await expect(page.getByText('PDF rotated successfully')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('sample-3pages-rotated.pdf')).toBeVisible();

    // Download button
    const downloadBtn = page.getByRole('button', { name: /Download Rotated PDF/i });
    await expect(downloadBtn).toBeVisible();

    // Verify download event and inspect PDF
    const downloadPromise = page.waitForEvent('download');
    await downloadBtn.click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('Convert24 - sample-3pages-rotated.pdf');

    const downloadPath = await download.path();
    expect(downloadPath).not.toBeNull();
    if (downloadPath) {
      const downloadedBytes = fs.readFileSync(downloadPath);
      expect(downloadedBytes.subarray(0, 5).toString('ascii')).toBe('%PDF-');

      const loadedDoc = await PDFDocument.load(downloadedBytes);
      expect(loadedDoc.getPageCount()).toBe(3);
      for (let i = 0; i < 3; i++) {
        expect(loadedDoc.getPage(i).getRotation().angle).toBe(90);
      }
    }
  });

  test('Test 2: Rotate Selected Pages with 180° rotation', async ({ page }) => {
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

    // By default all 3 are selected. Deselect Page 2 and Page 3.
    const page2Card = page.locator('div[role="checkbox"]').filter({ hasText: 'Page 2' });
    await page2Card.click();
    const page3Card = page.locator('div[role="checkbox"]').filter({ hasText: 'Page 3' });
    await page3Card.click();

    // Verify 1 of 3 selected
    await expect(page.getByText(/1 of 3 pages selected/i)).toBeVisible();

    // Click Rotate 1 Page (180°)
    const rotateBtn = page.getByRole('button', { name: /Rotate 1 Page \(180°\)/i });
    await expect(rotateBtn).toBeEnabled();
    await rotateBtn.click();

    // Verify result
    await expect(page.getByText('PDF rotated successfully')).toBeVisible({ timeout: 15000 });

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: /Download Rotated PDF/i }).click();
    const download = await downloadPromise;

    const downloadPath = await download.path();
    if (downloadPath) {
      const downloadedBytes = fs.readFileSync(downloadPath);
      const loadedDoc = await PDFDocument.load(downloadedBytes);
      expect(loadedDoc.getPageCount()).toBe(3);
      expect(loadedDoc.getPage(0).getRotation().angle).toBe(180); // Page 1 rotated
      expect(loadedDoc.getPage(1).getRotation().angle).toBe(0); // Page 2 untouched
      expect(loadedDoc.getPage(2).getRotation().angle).toBe(0); // Page 3 untouched
    }
  });

  test('Test 3: Rejects non-PDF file upload with friendly error message', async ({ page }) => {
    await page.goto('/tools/rotate-pdf');
    await page.locator('[data-hydrated="true"]').waitFor({ timeout: 10000 });

    const fileInput = page.locator('#rotate-pdf-file-input');
    await fileInput.setInputFiles(samplePngPath);

    await expect(
      page.getByText(/This file is not a valid PDF|Please choose a valid PDF document/i)
    ).toBeVisible({ timeout: 5000 });
  });

  test('Test 4: Reset functionality returns to initial upload state', async ({ page }) => {
    await page.goto('/tools/rotate-pdf');
    await page.locator('[data-hydrated="true"]').waitFor({ timeout: 10000 });

    const fileInput = page.locator('#rotate-pdf-file-input');
    await fileInput.setInputFiles(sample1PagePdf);

    await expect(page.getByText('sample-1page.pdf')).toBeVisible();

    // Click remove/trash button
    const removeBtn = page.getByLabel('Remove file');
    await removeBtn.click();

    // Verify upload zone returns
    await expect(page.getByText('Choose a PDF file to rotate')).toBeVisible();
    await expect(page.getByText('sample-1page.pdf')).not.toBeVisible();
  });

  test('Test 5: Mobile viewport displays responsive UI without horizontal overflow', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/tools/rotate-pdf');
    await page.locator('[data-hydrated="true"]').waitFor({ timeout: 10000 });

    const fileInput = page.locator('#rotate-pdf-file-input');
    await fileInput.setInputFiles(sample1PagePdf);

    await expect(page.getByText('sample-1page.pdf')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Rotate All Pages', exact: true })).toBeVisible();

    // Verify no horizontal overflow
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 2);
  });
});
