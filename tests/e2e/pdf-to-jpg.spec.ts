import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('Tool #18: PDF to JPG E2E', () => {
  const sample1PagePdf = path.join(process.cwd(), 'tests/fixtures/sample-1page.pdf');
  const sample3PagesPdf = path.join(process.cwd(), 'tests/fixtures/sample-3pages.pdf');
  const samplePngPath = path.join(process.cwd(), 'tests/fixtures/sample.png');

  test('Test 1: Single page — load page, upload one-page PDF, convert, verify 1 JPG result & download UI', async ({
    page,
  }) => {
    await page.goto('/tools/pdf-to-jpg');
    await page.locator('[data-hydrated="true"]').waitFor({ timeout: 10000 });
    await expect(page).toHaveTitle(/PDF to JPG Converter/i);
    await expect(page.locator('h1')).toHaveText(/Convert PDF to JPG/i);

    // Upload 1-page PDF
    const fileInput = page.locator('#pdf-to-jpg-file-input');
    await fileInput.setInputFiles(sample1PagePdf);

    // Verify file overview
    await expect(page.getByText('sample-1page.pdf')).toBeVisible();
    await expect(page.getByText('1 page', { exact: true })).toBeVisible();

    // Click Convert
    const convertBtn = page.getByRole('button', { name: /Convert 1 Page to JPG/i });
    await expect(convertBtn).toBeEnabled();
    await convertBtn.click();

    // Verify Result UI
    await expect(page.getByText('PDF Converted Successfully')).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('button', { name: /Download JPG/i })).toBeVisible();
    await expect(page.getByText('sample-1page-page-1.jpg')).toBeVisible();
  });

  test('Test 2: Multiple pages — upload 3-page PDF, select all, convert, verify 3 JPG results', async ({
    page,
  }) => {
    await page.goto('/tools/pdf-to-jpg');
    await page.locator('[data-hydrated="true"]').waitFor({ timeout: 10000 });

    const fileInput = page.locator('#pdf-to-jpg-file-input');
    await fileInput.setInputFiles(sample3PagesPdf);

    // Verify 3 pages detected
    await expect(page.getByText('sample-3pages.pdf')).toBeVisible();
    await expect(page.getByText('3 pages', { exact: true })).toBeVisible();
    await expect(page.getByText(/3 of 3 selected/i)).toBeVisible();

    // Click Convert
    const convertBtn = page.getByRole('button', { name: /Convert 3 Pages to JPG/i });
    await expect(convertBtn).toBeEnabled();
    await convertBtn.click();

    // Verify results
    await expect(page.getByText('PDF Converted Successfully')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('sample-3pages-page-1.jpg')).toBeVisible();
    await expect(page.getByText('sample-3pages-page-2.jpg')).toBeVisible();
    await expect(page.getByText('sample-3pages-page-3.jpg')).toBeVisible();
    await expect(page.getByRole('button', { name: /Download All \(ZIP\)/i })).toBeVisible();
  });

  test('Test 3: Page selection — upload 3-page PDF, select only Page 2, convert, verify single page result', async ({
    page,
  }) => {
    await page.goto('/tools/pdf-to-jpg');
    await page.locator('[data-hydrated="true"]').waitFor({ timeout: 10000 });

    const fileInput = page.locator('#pdf-to-jpg-file-input');
    await fileInput.setInputFiles(sample3PagesPdf);

    await expect(page.getByText('sample-3pages.pdf')).toBeVisible();

    // Clear all, then select Page 2
    const clearAllBtn = page.getByRole('button', { name: /Clear All/i });
    await clearAllBtn.click();
    await expect(page.getByText(/0 of 3 selected/i)).toBeVisible();

    // Click on Page 2 card
    const page2Card = page.getByRole('button', { name: /Page 2 of 3/i });
    await page2Card.click();
    await expect(page.getByText(/1 of 3 selected/i)).toBeVisible();

    // Convert
    const convertBtn = page.getByRole('button', { name: /Convert 1 Page to JPG/i });
    await convertBtn.click();

    // Verify only page 2 was generated
    await expect(page.getByText('PDF Converted Successfully')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('sample-3pages-page-2.jpg')).toBeVisible();
    await expect(page.getByText('sample-3pages-page-1.jpg')).not.toBeVisible();
    await expect(page.getByText('sample-3pages-page-3.jpg')).not.toBeVisible();
  });

  test('Test 4: Invalid file — upload PNG, verify rejection and friendly error', async ({
    page,
  }) => {
    await page.goto('/tools/pdf-to-jpg');
    await page.locator('[data-hydrated="true"]').waitFor({ timeout: 10000 });

    const fileInput = page.locator('#pdf-to-jpg-file-input');
    await fileInput.setInputFiles(samplePngPath);

    // Verify error message appears
    await expect(page.getByText(/not a valid PDF/i)).toBeVisible({ timeout: 5000 });
  });

  test('Test 5: Mobile viewport — render and convert at mobile viewport', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/tools/pdf-to-jpg');
    await page.locator('[data-hydrated="true"]').waitFor({ timeout: 10000 });

    const fileInput = page.locator('#pdf-to-jpg-file-input');
    await fileInput.setInputFiles(sample1PagePdf);

    await expect(page.getByText('sample-1page.pdf')).toBeVisible();

    const convertBtn = page.getByRole('button', { name: /Convert 1 Page to JPG/i });
    await convertBtn.click();

    await expect(page.getByText('PDF Converted Successfully')).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('button', { name: /Download JPG/i })).toBeVisible();
  });

  test('Test 6: Download All ZIP button available for multi-page results', async ({
    page,
  }) => {
    await page.goto('/tools/pdf-to-jpg');
    await page.locator('[data-hydrated="true"]').waitFor({ timeout: 10000 });

    const fileInput = page.locator('#pdf-to-jpg-file-input');
    await fileInput.setInputFiles(sample3PagesPdf);

    const convertBtn = page.getByRole('button', { name: /Convert 3 Pages to JPG/i });
    await convertBtn.click();

    await expect(page.getByText('PDF Converted Successfully')).toBeVisible({ timeout: 15000 });
    const downloadAllBtn = page.getByRole('button', { name: /Download All \(ZIP\)/i });
    await expect(downloadAllBtn).toBeVisible();
    await expect(downloadAllBtn).toBeEnabled();
  });
});
