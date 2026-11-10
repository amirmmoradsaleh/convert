import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('Tool #9: GIF to PNG Conversion E2E', () => {
  const sample89aPath = path.join(process.cwd(), 'tests/fixtures/sample-89a.gif');
  const sampleAnimatedPath = path.join(process.cwd(), 'tests/fixtures/sample-animated.gif');
  const corruptedPath = path.join(process.cwd(), 'tests/fixtures/corrupted.gif');

  test('should load /tools/gif-to-png, upload GIF, convert first frame to PNG, and download', async ({ page }) => {
    // 1. Open /tools/gif-to-png
    await page.goto('/tools/gif-to-png');
    await page.locator('[data-hydrated="true"]').waitFor({ timeout: 10000 });
    await expect(page).toHaveTitle(/GIF to PNG/i);
    await expect(page.locator('h1')).toHaveText('Convert GIF to PNG');

    // 2. Check note is present
    await expect(page.getByText(/Animated GIF files are converted using the first frame/i).first()).toBeVisible();

    // 3. Upload valid GIF file
    const fileInput = page.locator('#gif-file-input');
    await fileInput.setInputFiles(sample89aPath);

    // 4. Verify selected file appears in list
    await expect(page.getByText('sample-89a.gif')).toBeVisible();

    // 5. Click Convert to PNG
    const convertBtn = page.getByRole('button', { name: /Convert to PNG/i });
    await expect(convertBtn).toBeEnabled();
    await convertBtn.click();

    // 6. Verify conversion completes
    await expect(page.getByText('First frame', { exact: true })).toBeVisible({ timeout: 15000 });

    // 7. Verify single download button appears
    const downloadBtn = page.getByRole('button', { name: /Download PNG/i });
    await expect(downloadBtn).toBeVisible();

    // 8. Verify download triggers with .png extension
    const downloadPromise = page.waitForEvent('download');
    await downloadBtn.click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('Convert24 - sample-89a.png');
  });

  test('should convert animated GIF extracting first frame', async ({ page }) => {
    await page.goto('/tools/gif-to-png');
    await page.locator('[data-hydrated="true"]').waitFor({ timeout: 10000 });

    const fileInput = page.locator('#gif-file-input');
    await fileInput.setInputFiles(sampleAnimatedPath);

    await expect(page.getByText('sample-animated.gif')).toBeVisible();

    const convertBtn = page.getByRole('button', { name: /Convert to PNG/i });
    await expect(convertBtn).toBeEnabled();
    await convertBtn.click();

    await expect(page.getByText('First frame', { exact: true })).toBeVisible({ timeout: 15000 });
    const downloadBtn = page.getByRole('button', { name: /Download PNG/i });
    await expect(downloadBtn).toBeVisible();

    const downloadPromise = page.waitForEvent('download');
    await downloadBtn.click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('Convert24 - sample-animated.png');
  });

  test('should handle batch files and offer ZIP download with Convert24 prefix', async ({ page }) => {
    const sample87aPath = path.join(process.cwd(), 'tests/fixtures/sample-87a.gif');
    await page.goto('/tools/gif-to-png');
    await page.locator('[data-hydrated="true"]').waitFor({ timeout: 10000 });

    const fileInput = page.locator('#gif-file-input');
    await fileInput.setInputFiles([sample89aPath, sample87aPath]);

    await expect(page.getByText('sample-89a.gif')).toBeVisible();
    await expect(page.getByText('sample-87a.gif')).toBeVisible();

    const convertBtn = page.getByRole('button', { name: /Convert to PNG/i });
    await convertBtn.click();

    const zipBtn = page.getByRole('button', { name: /Download All \(ZIP\)/i });
    await expect(zipBtn).toBeVisible({ timeout: 15000 });

    const downloadPromise = page.waitForEvent('download');
    await zipBtn.click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('Convert24 - gif-to-png-files.zip');
  });

  test('should reject corrupted GIF files with clear error message', async ({ page }) => {
    await page.goto('/tools/gif-to-png');
    await page.locator('[data-hydrated="true"]').waitFor({ timeout: 10000 });

    const fileInput = page.locator('#gif-file-input');
    await fileInput.setInputFiles(corruptedPath);

    await expect(page.getByText('corrupted.gif')).toBeVisible();
    await expect(page.getByText(/not a valid GIF image/i)).toBeVisible({ timeout: 5000 });
  });
});
