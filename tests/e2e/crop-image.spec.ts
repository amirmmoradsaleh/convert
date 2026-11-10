import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('Tool #13: Crop Image E2E', () => {
  const sampleJpgPath = path.join(process.cwd(), 'tests/fixtures/sample.jpg');
  const cornersPngPath = path.join(process.cwd(), 'tests/fixtures/distinguishable-corners.png');
  const animatedWebpPath = path.join(process.cwd(), 'tests/fixtures/animated.webp');
  const corruptedJpgPath = path.join(process.cwd(), 'tests/fixtures/corrupted.jpg');

  test('should load /tools/crop-image, upload image, perform crop and download with Convert24 prefix', async ({
    page,
  }) => {
    // 1. Open /tools/crop-image
    await page.goto('/tools/crop-image');
    await expect(page).toHaveTitle(/Crop Image/i);
    await expect(page.locator('h1')).toHaveText(/Crop Image/i);

    // 2. Upload image
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles(cornersPngPath);

    // 3. Verify crop editor appears with aspect ratio options
    await expect(page.getByText('Aspect Ratio:', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'FREE', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: '1:1', exact: true })).toBeVisible();

    // 4. Click Crop Image
    const cropBtn = page.getByRole('button', { name: /Crop Image/i });
    await expect(cropBtn).toBeEnabled();
    await cropBtn.click();

    // 5. Verify success state appears
    await expect(page.getByText(/Image Cropped Successfully/i)).toBeVisible({ timeout: 15000 });
    const downloadBtn = page.getByRole('button', { name: /Download Cropped Image/i });
    await expect(downloadBtn).toBeVisible();

    // 6. Verify download has Convert24 prefix and -cropped suffix
    const downloadPromise = page.waitForEvent('download');
    await downloadBtn.click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('Convert24 - distinguishable-corners-cropped.png');
  });

  test('should support selecting 1:1 square aspect ratio preset', async ({ page }) => {
    await page.goto('/tools/crop-image');

    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles(cornersPngPath);

    await expect(page.getByText('Aspect Ratio:', { exact: true })).toBeVisible();

    // Select 1:1 aspect ratio
    const squareBtn = page.getByRole('button', { name: '1:1', exact: true });
    await squareBtn.click();

    // Execute crop
    const cropBtn = page.getByRole('button', { name: /Crop Image/i });
    await cropBtn.click();

    await expect(page.getByText(/Image Cropped Successfully/i)).toBeVisible({ timeout: 15000 });
    const downloadBtn = page.getByRole('button', { name: /Download Cropped Image/i });
    await expect(downloadBtn).toBeVisible();
  });

  test('should reject invalid or corrupted WebP files with clear error banner', async ({ page }) => {
    await page.goto('/tools/crop-image');

    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles(animatedWebpPath);

    await expect(
      page.getByText(/couldn't decode this image/i)
    ).toBeVisible({ timeout: 5000 });
  });

  test('should reject corrupted image file with error banner', async ({ page }) => {
    await page.goto('/tools/crop-image');

    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles(corruptedJpgPath);

    await expect(
      page.getByText(/couldn't decode this image/i)
    ).toBeVisible({ timeout: 5000 });
  });
});
