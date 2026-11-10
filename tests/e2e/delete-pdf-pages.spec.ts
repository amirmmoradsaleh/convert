import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { PDFDocument } from 'pdf-lib';

test.describe('Tool #24: Delete PDF Pages E2E', () => {
  const sample1PagePdf = path.join(process.cwd(), 'tests/fixtures/sample-1page.pdf');
  const sample3PagesPdf = path.join(process.cwd(), 'tests/fixtures/sample-3pages.pdf');
  const samplePngPath = path.join(process.cwd(), 'tests/fixtures/sample.png');

  test('Test 1: Delete middle page (Page 2 of 3) and verify resulting 2-page PDF download', async ({
    page,
  }) => {
    await page.goto('/tools/delete-pdf-pages');
    await page.locator('[data-hydrated="true"]').waitFor({ timeout: 10000 });
    await expect(page).toHaveTitle(/Delete PDF Pages Online/i);
    await expect(page.locator('h1')).toHaveText(/Delete Pages from PDF/i);

    // Upload 3-page PDF
    const fileInput = page.locator('#delete-pdf-pages-file-input');
    await fileInput.setInputFiles(sample3PagesPdf);

    // Verify file loaded and 3 pages detected
    await expect(page.getByText('sample-3pages.pdf')).toBeVisible();
    await expect(page.getByText('3 pages', { exact: true })).toBeVisible();

    // Verify initial count: 0 selected, 3 remain
    await expect(page.getByText(/0 pages selected for deletion/i)).toBeVisible();
    await expect(page.getByText(/3 pages will remain/i)).toBeVisible();

    // Mark Page 2 for deletion by clicking its card
    const page2Card = page.locator('div[role="checkbox"]').filter({ hasText: 'Page 2' });
    await page2Card.click();

    // Verify updated count: 1 page to delete, 2 remain
    await expect(page.getByText(/1 page selected for deletion/i)).toBeVisible();
    await expect(page.getByText(/2 pages will remain/i)).toBeVisible();

    // Click Delete 1 Page button
    const deleteBtn = page.getByRole('button', { name: /Delete 1 Page/i });
    await expect(deleteBtn).toBeEnabled();
    await deleteBtn.click();

    // Verify success result UI
    await expect(page.getByText('Pages deleted successfully')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('sample-3pages-pages-deleted.pdf')).toBeVisible();
    await expect(page.getByText(/Remaining Pages:/i)).toBeVisible();
    await expect(page.getByText('2 of 3')).toBeVisible();

    // Capture and verify download blob
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: /Download PDF/i }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('Convert24 - sample-3pages-pages-deleted.pdf');

    const downloadPath = await download.path();
    expect(downloadPath).not.toBeNull();
    if (downloadPath) {
      const downloadedBytes = fs.readFileSync(downloadPath);
      expect(downloadedBytes.subarray(0, 5).toString('ascii')).toBe('%PDF-');

      const loadedDoc = await PDFDocument.load(downloadedBytes);
      expect(loadedDoc.getPageCount()).toBe(2);
    }
  });

  test('Test 2: Select All triggers safety warning and blocks deleting all pages', async ({
    page,
  }) => {
    await page.goto('/tools/delete-pdf-pages');
    await page.locator('[data-hydrated="true"]').waitFor({ timeout: 10000 });

    const fileInput = page.locator('#delete-pdf-pages-file-input');
    await fileInput.setInputFiles(sample3PagesPdf);
    await expect(page.getByText('sample-3pages.pdf')).toBeVisible();

    // Click Select All
    const selectAllBtn = page.getByRole('button', { name: /Select All/i });
    await selectAllBtn.click();

    // Verify safety warning appears
    await expect(
      page.getByText(/At least one page must remain in the PDF. You cannot delete all pages/i)
    ).toBeVisible();

    // Verify Delete button is disabled
    const deleteBtn = page.locator('#delete-pages-submit-btn');
    await expect(deleteBtn).toBeDisabled();

    // Click Clear Selection
    const clearBtn = page.getByRole('button', { name: /Clear Selection/i });
    await clearBtn.click();

    // Verify 0 selected
    await expect(page.getByText(/0 pages selected for deletion/i)).toBeVisible();
  });

  test('Test 3: Single-page PDF blocks deletion with safety message', async ({ page }) => {
    await page.goto('/tools/delete-pdf-pages');
    await page.locator('[data-hydrated="true"]').waitFor({ timeout: 10000 });

    const fileInput = page.locator('#delete-pdf-pages-file-input');
    await fileInput.setInputFiles(sample1PagePdf);
    await expect(page.getByText('sample-1page.pdf')).toBeVisible();

    // Verify single-page safety message
    await expect(
      page.getByText(/A single-page PDF cannot have its only page deleted/i)
    ).toBeVisible();

    // Verify action button is disabled
    const actionBtn = page.locator('#delete-pages-submit-btn');
    await expect(actionBtn).toBeDisabled();
  });

  test('Test 4: Rejects non-PDF file upload with clear error message', async ({ page }) => {
    await page.goto('/tools/delete-pdf-pages');
    await page.locator('[data-hydrated="true"]').waitFor({ timeout: 10000 });

    const fileInput = page.locator('#delete-pdf-pages-file-input');
    await fileInput.setInputFiles(samplePngPath);

    await expect(
      page.getByText(/This file is not a valid PDF|Please choose a valid PDF document/i)
    ).toBeVisible({ timeout: 5000 });
  });

  test('Test 5: Reset / start over returns to initial upload state', async ({ page }) => {
    await page.goto('/tools/delete-pdf-pages');
    await page.locator('[data-hydrated="true"]').waitFor({ timeout: 10000 });

    const fileInput = page.locator('#delete-pdf-pages-file-input');
    await fileInput.setInputFiles(sample3PagesPdf);
    await expect(page.getByText('sample-3pages.pdf')).toBeVisible();

    // Click remove/trash button
    const removeBtn = page.getByLabel('Remove file');
    await removeBtn.click();

    // Verify upload zone returns
    await expect(page.getByText('Choose a PDF file to delete pages')).toBeVisible();
    await expect(page.getByText('sample-3pages.pdf')).not.toBeVisible();
  });

  test('Test 6: Mobile viewport displays responsive UI without horizontal overflow', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/tools/delete-pdf-pages');
    await page.locator('[data-hydrated="true"]').waitFor({ timeout: 10000 });

    const fileInput = page.locator('#delete-pdf-pages-file-input');
    await fileInput.setInputFiles(sample3PagesPdf);
    await expect(page.getByText('sample-3pages.pdf')).toBeVisible();

    // Select page 1 for deletion
    const page1Card = page.locator('div[role="checkbox"]').filter({ hasText: 'Page 1' });
    await page1Card.click();

    await expect(page.getByRole('button', { name: /Delete 1 Page/i })).toBeVisible();

    // Verify no horizontal overflow
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 2);
  });
});
