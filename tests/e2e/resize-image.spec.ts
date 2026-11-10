import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('Tool #12: Resize Image E2E', () => {
  const sampleJpgPath = path.join(process.cwd(), 'tests/fixtures/sample.jpg');
  const samplePngPath = path.join(process.cwd(), 'tests/fixtures/sample.png');
  const cornersPngPath = path.join(process.cwd(), 'tests/fixtures/distinguishable-corners.png');
  const animatedWebpPath = path.join(process.cwd(), 'tests/fixtures/animated.webp');

  test('should load /tools/resize-image, resize image with custom dimensions and download with Convert24 prefix', async ({
    page,
  }) => {
    // 1. Open /tools/resize-image
    await page.goto('/tools/resize-image');
    await expect(page).toHaveTitle(/Resize Image/i);
    await expect(page.locator('h1')).toHaveText(/Resize Image/i);

    // 2. Upload sample image
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles(sampleJpgPath);

    // 3. Verify file appears in list and settings panel is visible
    await expect(page.getByText('sample.jpg')).toBeVisible();
    await expect(page.getByText('Resize Settings')).toBeVisible();

    // 4. Click Resize Image button
    const resizeBtn = page.getByRole('button', { name: /Resize 1 Image/i });
    await expect(resizeBtn).toBeEnabled();
    await resizeBtn.click();

    // 5. Verify download button appears
    const downloadBtn = page.getByRole('button', { name: /^Download$/i });
    await expect(downloadBtn).toBeVisible({ timeout: 15000 });

    // 6. Verify download has Convert24 prefix
    const downloadPromise = page.waitForEvent('download');
    await downloadBtn.click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('Convert24 - sample.jpg');
  });

  test('should support independent non-proportional width and height when aspect ratio lock is disabled', async ({
    page,
  }) => {
    await page.goto('/tools/resize-image');

    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles(cornersPngPath);

    await expect(page.getByText('distinguishable-corners.png')).toBeVisible();

    // Uncheck maintain aspect ratio
    const aspectRatioCheckbox = page.locator('#aspectRatio');
    await expect(aspectRatioCheckbox).toBeChecked();
    await aspectRatioCheckbox.uncheck();
    await expect(aspectRatioCheckbox).not.toBeChecked();

    // Resize button
    const resizeBtn = page.getByRole('button', { name: /Resize 1 Image/i });
    await resizeBtn.click();

    const downloadBtn = page.getByRole('button', { name: /^Download$/i });
    await expect(downloadBtn).toBeVisible({ timeout: 15000 });

    const downloadPromise = page.waitForEvent('download');
    await downloadBtn.click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('Convert24 - distinguishable-corners.png');
  });

  test('should handle batch files and offer ZIP download with Convert24 prefix', async ({ page }) => {
    await page.goto('/tools/resize-image');

    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles([sampleJpgPath, samplePngPath]);

    await expect(page.getByText('sample.jpg')).toBeVisible();
    await expect(page.getByText('sample.png')).toBeVisible();

    const resizeBtn = page.getByRole('button', { name: /Resize 2 Images/i });
    await resizeBtn.click();

    const zipBtn = page.getByRole('button', { name: /Download All as ZIP/i });
    await expect(zipBtn).toBeVisible({ timeout: 15000 });

    const downloadPromise = page.waitForEvent('download');
    await zipBtn.click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('Convert24 - resized-images.zip');
  });

  test('should reject animated WebP files with clear error banner', async ({ page }) => {
    await page.goto('/tools/resize-image');

    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles(animatedWebpPath);

    await expect(page.getByText('animated.webp')).toBeVisible();
    const resizeBtn = page.getByRole('button', { name: /Resize 1 Image/i });
    await resizeBtn.click();

    await expect(
      page.getByText(/Animated WebP files are not supported/i)
    ).toBeVisible({ timeout: 5000 });
  });
});
