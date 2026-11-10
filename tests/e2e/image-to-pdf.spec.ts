import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('Image to PDF Tool E2E', () => {
  const sampleJpgPath = path.join(process.cwd(), 'tests/fixtures/sample.jpg');
  const samplePngPath = path.join(process.cwd(), 'tests/fixtures/sample.png');
  const sampleWebpPath = path.join(process.cwd(), 'tests/fixtures/sample.webp');
  const fakeJpgPath = path.join(process.cwd(), 'tests/fixtures/fake.jpg');

  test('should load page, upload single JPG, generate PDF, and show download UI', async ({ page }) => {
    // 1. Open /tools/image-to-pdf
    await page.goto('/tools/image-to-pdf');
    await page.locator('[data-hydrated="true"]').waitFor({ timeout: 10000 });
    await expect(page).toHaveTitle(/Image to PDF Converter/i);
    await expect(page.locator('h1')).toHaveText(/Convert Images to PDF/i);

    // 2. Upload valid JPG file
    const fileInput = page.locator('#image-to-pdf-file-input');
    await fileInput.setInputFiles(sampleJpgPath);

    // 3. Verify selected file appears
    await expect(page.getByText('sample.jpg')).toBeVisible();
    await expect(page.getByText(/1 Image Selected/i)).toBeVisible();

    // 4. Click Convert to PDF
    const convertBtn = page.getByRole('button', { name: /Convert to PDF/i });
    await expect(convertBtn).toBeEnabled();
    await convertBtn.click();

    // 5. Verify PDF creation succeeds
    await expect(page.getByText('PDF Created Successfully!')).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('button', { name: /Download PDF/i })).toBeVisible();
    await expect(page.getByText(/1 page/i)).toBeVisible();
  });

  test('should combine multiple images (JPG + PNG + WebP), allow reordering, and create unified multi-page PDF', async ({
    page,
  }) => {
    await page.goto('/tools/image-to-pdf');
    await page.locator('[data-hydrated="true"]').waitFor({ timeout: 10000 });

    // Upload 3 files (JPG, PNG, WebP)
    const fileInput = page.locator('#image-to-pdf-file-input');
    await fileInput.setInputFiles([sampleJpgPath, samplePngPath, sampleWebpPath]);

    // Verify 3 items appear
    await expect(page.getByText(/3 Images Selected/i)).toBeVisible();
    await expect(page.getByText('sample.jpg')).toBeVisible();
    await expect(page.getByText('sample.png')).toBeVisible();
    await expect(page.getByText('sample.webp')).toBeVisible();

    // Reorder: Move sample.jpg down (moving 1st item down)
    const moveDownBtn = page.getByRole('button', { name: 'Move sample.jpg down' });
    await expect(moveDownBtn).toBeEnabled();
    await moveDownBtn.click();

    // Convert to PDF
    const convertBtn = page.getByRole('button', { name: /Convert to PDF \(3 pages\)/i });
    await expect(convertBtn).toBeEnabled();
    await convertBtn.click();

    // Result should show 3 pages combined
    await expect(page.getByText('PDF Created Successfully!')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/3 pages/i)).toBeVisible();
    await expect(page.getByText('images-to-pdf.pdf')).toBeVisible();
    await expect(page.getByRole('button', { name: /Download PDF/i })).toBeVisible();
  });

  test('should show friendly error on unsupported or corrupt files', async ({ page }) => {
    await page.goto('/tools/image-to-pdf');
    await page.locator('[data-hydrated="true"]').waitFor({ timeout: 10000 });

    const fileInput = page.locator('#image-to-pdf-file-input');
    await fileInput.setInputFiles(fakeJpgPath);

    // Verify error banner appears
    await expect(
      page.getByText(/We couldn't read this image|Invalid file format/i)
    ).toBeVisible({ timeout: 5000 });
  });

  test('should render properly and be usable on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/tools/image-to-pdf');
    await page.locator('[data-hydrated="true"]').waitFor({ timeout: 10000 });

    await expect(page.locator('h1')).toBeVisible();
    const fileInput = page.locator('#image-to-pdf-file-input');
    await fileInput.setInputFiles(sampleJpgPath);

    await expect(page.getByText('sample.jpg')).toBeVisible();
    const convertBtn = page.getByRole('button', { name: /Convert to PDF/i });
    await expect(convertBtn).toBeVisible();
  });
});
