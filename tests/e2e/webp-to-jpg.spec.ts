import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('WEBP to JPG Conversion Tool E2E', () => {
  const sampleWebpPath = path.join(process.cwd(), 'tests/fixtures/sample.webp');
  const transparentWebpPath = path.join(process.cwd(), 'tests/fixtures/transparent.webp');
  const invalidWebpPath = path.join(process.cwd(), 'tests/fixtures/invalid.webp');

  test('should load page, upload WEBP, convert to JPG, and provide download', async ({ page }) => {
    // 1. Open /tools/webp-to-jpg
    await page.goto('/tools/webp-to-jpg');
    await page.locator('[data-hydrated="true"]').waitFor({ timeout: 10000 });
    await expect(page).toHaveTitle(/Convert WEBP to JPG/i);
    await expect(page.locator('h1')).toHaveText('Convert WEBP to JPG');

    // 2. Select / Upload valid WEBP file
    const fileInput = page.locator('#webp-file-input');
    await fileInput.setInputFiles(sampleWebpPath);

    // 3. Verify selected file appears in list
    await expect(page.getByText('sample.webp')).toBeVisible();
    await expect(page.getByText('Ready to convert')).toBeVisible();

    // 4. Verify Options are visible
    await expect(page.getByText('JPG Output Options')).toBeVisible();
    await expect(page.locator('legend', { hasText: 'JPG quality' })).toBeVisible();
    await expect(page.locator('legend', { hasText: 'Background' })).toBeVisible();

    // 5. Click Convert to JPG
    const convertBtn = page.getByRole('button', { name: /Convert to JPG/i });
    await expect(convertBtn).toBeEnabled();

    await convertBtn.click();

    // 6. Verify conversion completes successfully
    await expect(page.getByText('JPG Ready')).toBeVisible({ timeout: 10000 });

    // 7. Verify download button appears
    const downloadBtn = page.getByRole('button', { name: /Download converted sample\.jpg/i });
    await expect(downloadBtn).toBeVisible();

    // 8. Verify output filename reflects .jpg extension
    await expect(page.getByText('(sample.jpg)')).toBeVisible();

    // 9. Verify download triggers with .jpg extension
    const downloadPromise = page.waitForEvent('download');
    await downloadBtn.click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('Convert24 - sample.jpg');
  });

  test('should allow configuring quality and background color', async ({ page }) => {
    await page.goto('/tools/webp-to-jpg');
    await page.locator('[data-hydrated="true"]').waitFor({ timeout: 10000 });

    const fileInput = page.locator('#webp-file-input');
    await fileInput.setInputFiles(transparentWebpPath);

    await expect(page.getByText('transparent.webp')).toBeVisible();

    // Select Medium 80% quality
    await page.locator('[data-testid="quality-80"]').check({ force: true });

    // Select Black background
    await page.locator('[data-testid="bg-black"]').check({ force: true });

    // Convert
    const convertBtn = page.getByRole('button', { name: /Convert to JPG/i });
    await convertBtn.click();

    // Verify completion with options summarized
    await expect(page.getByText('JPG Ready')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Quality: 80%')).toBeVisible();
    await expect(page.getByText('Background: Black')).toBeVisible();
  });

  test('should handle batch files and offer ZIP download with webp-to-jpg-files.zip', async ({ page }) => {
    await page.goto('/tools/webp-to-jpg');
    await page.locator('[data-hydrated="true"]').waitFor({ timeout: 10000 });

    // Upload multiple files
    const fileInput = page.locator('#webp-file-input');
    await fileInput.setInputFiles([sampleWebpPath, transparentWebpPath]);

    await expect(page.getByText('sample.webp')).toBeVisible();
    await expect(page.getByText('transparent.webp')).toBeVisible();

    // Convert batch
    const convertBtn = page.getByRole('button', { name: /Convert to JPG/i });
    await convertBtn.click();

    // Both should complete and Download All (ZIP) button appears
    const zipBtn = page.getByRole('button', { name: /Download All \(ZIP\)/i });
    await expect(zipBtn).toBeVisible({ timeout: 15000 });

    // Verify ZIP download filename
    const downloadPromise = page.waitForEvent('download');
    await zipBtn.click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('Convert24 - webp-to-jpg-files.zip');
  });

  test('should gracefully reject invalid WEBP file and provide retry', async ({ page }) => {
    await page.goto('/tools/webp-to-jpg');
    await page.locator('[data-hydrated="true"]').waitFor({ timeout: 10000 });

    const fileInput = page.locator('#webp-file-input');
    await fileInput.setInputFiles(invalidWebpPath);

    const convertBtn = page.getByRole('button', { name: /Convert to JPG/i });
    await convertBtn.click();

    // Friendly error should be displayed
    await expect(page.getByText(/not a valid WebP image/i)).toBeVisible({
      timeout: 5000,
    });

    // Retry button should be available
    await expect(page.getByRole('button', { name: /Retry/i })).toBeVisible();
  });
});
