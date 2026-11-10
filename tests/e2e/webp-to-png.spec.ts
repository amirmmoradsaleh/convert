import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('WEBP to PNG Conversion Tool E2E', () => {
  const sampleWebpPath = path.join(process.cwd(), 'tests/fixtures/sample.webp');
  const transparentWebpPath = path.join(process.cwd(), 'tests/fixtures/transparent.webp');
  const invalidWebpPath = path.join(process.cwd(), 'tests/fixtures/invalid.webp');

  test('should load page, upload WEBP, convert to PNG, and provide download', async ({ page }) => {
    // 1. Open /tools/webp-to-png
    await page.goto('/tools/webp-to-png');
    await page.locator('[data-hydrated="true"]').waitFor({ timeout: 10000 });
    await expect(page).toHaveTitle(/Convert WebP to PNG/i);
    await expect(page.locator('h1')).toHaveText('Convert WebP to PNG');

    // 2. Select / Upload valid WEBP file
    const fileInput = page.locator('#webp-file-input');
    await fileInput.setInputFiles(sampleWebpPath);

    // 3. Verify selected file appears in list
    await expect(page.getByText('sample.webp')).toBeVisible();
    await expect(page.getByText('Ready to convert')).toBeVisible();

    // 4. Click Convert to PNG
    const convertBtn = page.getByRole('button', { name: /Convert to PNG/i });
    await expect(convertBtn).toBeEnabled();

    await convertBtn.click();

    // 5. Verify conversion completes successfully
    await expect(page.getByText('PNG Ready')).toBeVisible({ timeout: 10000 });

    // 6. Verify download button appears
    const downloadBtn = page.getByRole('button', { name: /Download converted sample\.png/i });
    await expect(downloadBtn).toBeVisible();

    // 7. Verify output filename reflects .png extension
    await expect(page.getByText('(sample.png)')).toBeVisible();

    // 8. Verify download triggers with .png extension
    const downloadPromise = page.waitForEvent('download');
    await downloadBtn.click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('Convert24 - sample.png');
  });

  test('should convert transparent WebP preserving transparency without flattening', async ({ page }) => {
    await page.goto('/tools/webp-to-png');
    await page.locator('[data-hydrated="true"]').waitFor({ timeout: 10000 });

    const fileInput = page.locator('#webp-file-input');
    await fileInput.setInputFiles(transparentWebpPath);

    await expect(page.getByText('transparent.webp')).toBeVisible();

    // Convert
    const convertBtn = page.getByRole('button', { name: /Convert to PNG/i });
    await convertBtn.click();

    // Verify completion
    await expect(page.getByText('PNG Ready')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('(transparent.png)')).toBeVisible();
  });

  test('should handle batch files and offer ZIP download with webp-to-png-files.zip', async ({ page }) => {
    await page.goto('/tools/webp-to-png');
    await page.locator('[data-hydrated="true"]').waitFor({ timeout: 10000 });

    // Upload multiple files
    const fileInput = page.locator('#webp-file-input');
    await fileInput.setInputFiles([sampleWebpPath, transparentWebpPath]);

    await expect(page.getByText('sample.webp')).toBeVisible();
    await expect(page.getByText('transparent.webp')).toBeVisible();

    // Convert batch
    const convertBtn = page.getByRole('button', { name: /Convert to PNG/i });
    await convertBtn.click();

    // Both should complete and Download All (ZIP) button appears
    const zipBtn = page.getByRole('button', { name: /Download All \(ZIP\)/i });
    await expect(zipBtn).toBeVisible({ timeout: 15000 });

    // Verify ZIP download filename
    const downloadPromise = page.waitForEvent('download');
    await zipBtn.click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('Convert24 - webp-to-png-files.zip');
  });

  test('should validate invalid WebP files and show error message', async ({ page }) => {
    await page.goto('/tools/webp-to-png');
    await page.locator('[data-hydrated="true"]').waitFor({ timeout: 10000 });

    const fileInput = page.locator('#webp-file-input');
    await fileInput.setInputFiles(invalidWebpPath);

    await expect(page.getByText('invalid.webp')).toBeVisible();

    const convertBtn = page.getByRole('button', { name: /Convert to PNG/i });
    await convertBtn.click();

    await expect(page.getByText(/This file is not a valid WebP image/i)).toBeVisible({ timeout: 10000 });
  });

  test('should allow removing individual files and clearing all files', async ({ page }) => {
    await page.goto('/tools/webp-to-png');
    await page.locator('[data-hydrated="true"]').waitFor({ timeout: 10000 });

    const fileInput = page.locator('#webp-file-input');
    await fileInput.setInputFiles([sampleWebpPath, transparentWebpPath]);

    await expect(page.getByText('sample.webp')).toBeVisible();
    await expect(page.getByText('transparent.webp')).toBeVisible();

    // Remove one file
    const removeSampleBtn = page.getByRole('button', { name: /Remove file sample\.webp/i });
    await removeSampleBtn.click();

    await expect(page.getByText('sample.webp')).not.toBeVisible();
    await expect(page.getByText('transparent.webp')).toBeVisible();

    // Clear all
    const clearAllBtn = page.getByRole('button', { name: /Clear All/i });
    await clearAllBtn.click();

    await expect(page.getByText('transparent.webp')).not.toBeVisible();
    await expect(page.getByText(/Choose WebP files/i)).toBeVisible();
  });
});
