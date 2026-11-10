import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('PNG to JPG Conversion Tool E2E', () => {
  const samplePngPath = path.join(process.cwd(), 'tests/fixtures/sample.png');
  const transparentPngPath = path.join(process.cwd(), 'tests/fixtures/transparent.png');
  const invalidPngPath = path.join(process.cwd(), 'tests/fixtures/invalid.png');

  test('should load page, upload PNG, convert to JPG, and provide download', async ({ page }) => {
    // 1. Open /tools/png-to-jpg
    await page.goto('/tools/png-to-jpg');
    await page.locator('[data-hydrated="true"]').waitFor({ timeout: 10000 });
    await expect(page).toHaveTitle(/Convert PNG to JPG/i);
    await expect(page.locator('h1')).toHaveText('Convert PNG to JPG');

    // 2. Select / Upload valid PNG file
    const fileInput = page.locator('#png-file-input');
    await fileInput.setInputFiles(samplePngPath);

    // 3. Verify selected file appears in list
    await expect(page.getByText('sample.png')).toBeVisible();
    await expect(page.getByText('Ready to convert')).toBeVisible();

    // 4. Verify Options are visible
    await expect(page.getByText('JPG Output Options')).toBeVisible();
    await expect(page.getByText('Quality', { exact: true })).toBeVisible();
    await expect(page.getByText('Background', { exact: true })).toBeVisible();

    // 5. Click Convert to JPG
    const convertBtn = page.getByRole('button', { name: /Convert to JPG/i });
    await expect(convertBtn).toBeEnabled();

    // Setup download listener before clicking download later
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
    await page.goto('/tools/png-to-jpg');
    await page.locator('[data-hydrated="true"]').waitFor({ timeout: 10000 });

    const fileInput = page.locator('#png-file-input');
    await fileInput.setInputFiles(transparentPngPath);

    await expect(page.getByText('transparent.png')).toBeVisible();

    // Select Medium 80% quality
    await page.locator('[data-testid="quality-80"]').check({ force: true });

    // Select Black background
    await page.locator('[data-testid="bg-black"]').check({ force: true });

    // Convert
    const convertBtn = page.getByRole('button', { name: /Convert to JPG/i });
    await convertBtn.click();

    // Verify completion with options summarized
    await expect(page.getByText('JPG Ready')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('80% quality')).toBeVisible();
    await expect(page.getByText('Black bg')).toBeVisible();
  });

  test('should handle batch files and offer ZIP download with png-to-jpg-files.zip', async ({ page }) => {
    await page.goto('/tools/png-to-jpg');
    await page.locator('[data-hydrated="true"]').waitFor({ timeout: 10000 });

    // Upload multiple files
    const fileInput = page.locator('#png-file-input');
    await fileInput.setInputFiles([samplePngPath, transparentPngPath]);

    await expect(page.getByText('sample.png')).toBeVisible();
    await expect(page.getByText('transparent.png')).toBeVisible();

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
    expect(download.suggestedFilename()).toBe('Convert24 - png-to-jpg-files.zip');
  });

  test('should gracefully reject invalid PNG file and provide retry', async ({ page }) => {
    await page.goto('/tools/png-to-jpg');
    await page.locator('[data-hydrated="true"]').waitFor({ timeout: 10000 });

    const fileInput = page.locator('#png-file-input');
    await fileInput.setInputFiles(invalidPngPath);

    const convertBtn = page.getByRole('button', { name: /Convert to JPG/i });
    await convertBtn.click();

    // Friendly error should be displayed
    await expect(page.getByText('This file is not a valid PNG image.')).toBeVisible({
      timeout: 5000,
    });

    // Retry button should be available
    await expect(page.getByRole('button', { name: /Retry/i })).toBeVisible();
  });
});
