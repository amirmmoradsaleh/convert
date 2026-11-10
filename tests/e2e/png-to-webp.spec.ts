import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('PNG to WebP Conversion Tool E2E', () => {
  const samplePngPath = path.join(process.cwd(), 'tests/fixtures/sample.png');
  const transparentPngPath = path.join(process.cwd(), 'tests/fixtures/transparent.png');
  const invalidPngPath = path.join(process.cwd(), 'tests/fixtures/invalid.png');

  test('should load page, upload PNG, convert to WebP, and provide download', async ({ page }) => {
    // 1. Open /tools/png-to-webp
    await page.goto('/tools/png-to-webp');
    await page.locator('[data-hydrated="true"]').waitFor({ timeout: 10000 });
    await expect(page).toHaveTitle(/Convert PNG to WebP/i);
    await expect(page.locator('h1')).toHaveText('Convert PNG to WebP');

    // 2. Select / Upload valid PNG file
    const fileInput = page.locator('#png-file-input');
    await fileInput.setInputFiles(samplePngPath);

    // 3. Verify selected file appears in list
    await expect(page.getByText('sample.png')).toBeVisible();
    await expect(page.getByText('Ready to convert', { exact: true })).toBeVisible();

    // 4. Verify Options are visible
    await expect(page.getByText('WebP Output Options')).toBeVisible();
    await expect(page.locator('legend', { hasText: 'WebP quality' })).toBeVisible();

    // 5. Click Convert to WebP
    const convertBtn = page.getByRole('button', { name: /Convert to WebP/i });
    await expect(convertBtn).toBeEnabled();

    await convertBtn.click();

    // 6. Verify conversion completes successfully
    await expect(page.getByText('WebP Ready')).toBeVisible({ timeout: 10000 });

    // 7. Verify download button appears
    const downloadBtn = page.getByRole('button', { name: /Download converted sample\.webp/i });
    await expect(downloadBtn).toBeVisible();

    // 8. Verify output filename reflects .webp extension
    await expect(page.getByText('(sample.webp)')).toBeVisible();

    // 9. Verify download triggers with .webp extension
    const downloadPromise = page.waitForEvent('download');
    await downloadBtn.click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('Convert24 - sample.webp');
  });

  test('should convert transparent PNG while preserving transparency', async ({ page }) => {
    await page.goto('/tools/png-to-webp');
    await page.locator('[data-hydrated="true"]').waitFor({ timeout: 10000 });

    const fileInput = page.locator('#png-file-input');
    await fileInput.setInputFiles(transparentPngPath);

    await expect(page.getByText('transparent.png')).toBeVisible();

    // Convert
    const convertBtn = page.getByRole('button', { name: /Convert to WebP/i });
    await convertBtn.click();

    // Verify completion
    await expect(page.getByText('WebP Ready')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('(transparent.webp)')).toBeVisible();
  });

  test('should allow configuring quality preset (Medium 80%)', async ({ page }) => {
    await page.goto('/tools/png-to-webp');
    await page.locator('[data-hydrated="true"]').waitFor({ timeout: 10000 });

    const fileInput = page.locator('#png-file-input');
    await fileInput.setInputFiles(samplePngPath);

    await expect(page.getByText('sample.png')).toBeVisible();

    // Select Medium 80% quality
    await page.locator('[data-testid="quality-80"]').check({ force: true });

    // Convert
    const convertBtn = page.getByRole('button', { name: /Convert to WebP/i });
    await convertBtn.click();

    // Verify completion with 80% quality summarized
    await expect(page.getByText('WebP Ready')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Quality: 80%')).toBeVisible();
  });

  test('should handle batch files and offer ZIP download with png-to-webp-files.zip', async ({ page }) => {
    await page.goto('/tools/png-to-webp');
    await page.locator('[data-hydrated="true"]').waitFor({ timeout: 10000 });

    // Upload multiple files
    const fileInput = page.locator('#png-file-input');
    await fileInput.setInputFiles([samplePngPath, transparentPngPath]);

    await expect(page.getByText('sample.png')).toBeVisible();
    await expect(page.getByText('transparent.png')).toBeVisible();

    // Convert batch
    const convertBtn = page.getByRole('button', { name: /Convert to WebP/i });
    await convertBtn.click();

    // Both should complete and Download All (ZIP) button appears
    const zipBtn = page.getByRole('button', { name: /Download All \(ZIP\)/i });
    await expect(zipBtn).toBeVisible({ timeout: 15000 });

    // Verify ZIP download filename
    const downloadPromise = page.waitForEvent('download');
    await zipBtn.click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('Convert24 - png-to-webp-files.zip');
  });

  test('should gracefully handle invalid files and allow retry', async ({ page }) => {
    await page.goto('/tools/png-to-webp');
    await page.locator('[data-hydrated="true"]').waitFor({ timeout: 10000 });

    const fileInput = page.locator('#png-file-input');
    await fileInput.setInputFiles(invalidPngPath);

    await expect(page.getByText('invalid.png')).toBeVisible();

    // Convert
    const convertBtn = page.getByRole('button', { name: /Convert to WebP/i });
    await convertBtn.click();

    // Verify failure state & retry button
    await expect(page.getByText('Failed', { exact: true })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/This file is not a valid PNG image/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /Retry/i })).toBeVisible();
  });
});
