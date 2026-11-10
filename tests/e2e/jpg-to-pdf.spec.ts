import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('Tool #16: JPG to PDF E2E', () => {
  const sampleJpgPath = path.join(process.cwd(), 'tests/fixtures/sample.jpg');
  const sampleJpegPath = path.join(process.cwd(), 'tests/fixtures/sample.jpeg');
  const samplePngPath = path.join(process.cwd(), 'tests/fixtures/sample.png');

  test('Test 1: Single JPG — load page, upload JPG, generate PDF, verify 1 page & download UI', async ({
    page,
  }) => {
    // 1. Navigate to /tools/jpg-to-pdf
    await page.goto('/tools/jpg-to-pdf');
    await page.locator('[data-hydrated="true"]').waitFor({ timeout: 10000 });
    await expect(page).toHaveTitle(/JPG to PDF Converter/i);
    await expect(page.locator('h1')).toHaveText(/Convert JPG to PDF/i);

    // 2. Upload sample.jpg
    const fileInput = page.locator('#jpg-to-pdf-file-input');
    await fileInput.setInputFiles(sampleJpgPath);

    // 3. Verify selected file card
    await expect(page.getByText('sample.jpg')).toBeVisible();
    await expect(page.getByText(/1 JPG Image Selected/i)).toBeVisible();

    // 4. Click Convert to PDF
    const convertBtn = page.getByRole('button', { name: /Convert to PDF/i });
    await expect(convertBtn).toBeEnabled();
    await convertBtn.click();

    // 5. Verify PDF Creation Success & Download Button
    await expect(page.getByText('PDF Created Successfully!')).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('button', { name: /Download PDF/i })).toBeVisible();
    await expect(page.getByText(/1 page/i)).toBeVisible();
    await expect(page.getByText('sample.pdf')).toBeVisible();
  });

  test('Test 2: Multiple JPGs — upload multiple JPGs, reorder, and combine into multi-page PDF', async ({
    page,
  }) => {
    await page.goto('/tools/jpg-to-pdf');
    await page.locator('[data-hydrated="true"]').waitFor({ timeout: 10000 });

    // Upload 2 files: sample.jpg and sample.jpeg
    const fileInput = page.locator('#jpg-to-pdf-file-input');
    await fileInput.setInputFiles([sampleJpgPath, sampleJpegPath]);

    // Verify 2 items appear
    await expect(page.getByText(/2 JPG Images Selected/i)).toBeVisible();
    await expect(page.getByText('sample.jpg')).toBeVisible();
    await expect(page.getByText('sample.jpeg')).toBeVisible();

    // Reorder: Move sample.jpg down
    const moveDownBtn = page.getByRole('button', { name: 'Move sample.jpg down' });
    await expect(moveDownBtn).toBeEnabled();
    await moveDownBtn.click();

    // Convert to PDF
    const convertBtn = page.getByRole('button', { name: /Convert to PDF \(2 pages\)/i });
    await expect(convertBtn).toBeEnabled();
    await convertBtn.click();

    // Verify multi-page PDF creation
    await expect(page.getByText('PDF Created Successfully!')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/2 pages/i)).toBeVisible();
    await expect(page.getByText('jpg-to-pdf.pdf')).toBeVisible();
    await expect(page.getByRole('button', { name: /Download PDF/i })).toBeVisible();
  });

  test('Test 3: Invalid file — upload PNG, verify rejection and friendly error', async ({ page }) => {
    await page.goto('/tools/jpg-to-pdf');
    await page.locator('[data-hydrated="true"]').waitFor({ timeout: 10000 });

    const fileInput = page.locator('#jpg-to-pdf-file-input');
    await fileInput.setInputFiles(samplePngPath);

    // Verify rejection error banner
    await expect(
      page.getByText(/Only JPG and JPEG images are supported by this tool/i)
    ).toBeVisible({ timeout: 5000 });
  });

  test('Test 4: Mobile viewport — render and convert at mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/tools/jpg-to-pdf');
    await page.locator('[data-hydrated="true"]').waitFor({ timeout: 10000 });

    await expect(page.locator('h1')).toBeVisible();
    const fileInput = page.locator('#jpg-to-pdf-file-input');
    await fileInput.setInputFiles(sampleJpgPath);

    await expect(page.getByText('sample.jpg')).toBeVisible();
    const convertBtn = page.getByRole('button', { name: /Convert to PDF/i });
    await expect(convertBtn).toBeVisible();
    await convertBtn.click();

    await expect(page.getByText('PDF Created Successfully!')).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('button', { name: /Download PDF/i })).toBeVisible();
  });
});
