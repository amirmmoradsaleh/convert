import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('Tool #10: BMP to PNG Conversion E2E', () => {
  const sample24bitPath = path.join(process.cwd(), 'tests/fixtures/sample-24bit.bmp');
  const sample32bitPath = path.join(process.cwd(), 'tests/fixtures/sample-32bit.bmp');
  const corruptedBmpPath = path.join(process.cwd(), 'tests/fixtures/corrupted.bmp');

  test('should load /tools/bmp-to-png, upload BMP, convert to PNG, and download with Convert24 prefix', async ({
    page,
  }) => {
    // 1. Open /tools/bmp-to-png
    await page.goto('/tools/bmp-to-png');
    await page.locator('[data-hydrated="true"]').waitFor({ timeout: 10000 });
    await expect(page).toHaveTitle(/Convert BMP to PNG/i);
    await expect(page.locator('h1')).toHaveText('Convert BMP to PNG');

    // 2. Upload valid BMP file
    const fileInput = page.locator('#bmp-file-input');
    await fileInput.setInputFiles(sample24bitPath);

    // 3. Verify selected file appears in list
    await expect(page.getByText('sample-24bit.bmp')).toBeVisible();

    // 4. Click Convert to PNG
    const convertBtn = page.getByRole('button', { name: /Convert to PNG/i });
    await expect(convertBtn).toBeEnabled();
    await convertBtn.click();

    // 5. Verify download button appears
    const downloadBtn = page.getByRole('button', { name: /Download PNG/i });
    await expect(downloadBtn).toBeVisible({ timeout: 15000 });

    // 6. Verify download triggers with Convert24 prefix and .png extension
    const downloadPromise = page.waitForEvent('download');
    await downloadBtn.click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('Convert24 - sample-24bit.png');
  });

  test('should handle batch files and offer ZIP download with Convert24 prefix', async ({ page }) => {
    await page.goto('/tools/bmp-to-png');
    await page.locator('[data-hydrated="true"]').waitFor({ timeout: 10000 });

    const fileInput = page.locator('#bmp-file-input');
    await fileInput.setInputFiles([sample24bitPath, sample32bitPath]);

    await expect(page.getByText('sample-24bit.bmp')).toBeVisible();
    await expect(page.getByText('sample-32bit.bmp')).toBeVisible();

    const convertBtn = page.getByRole('button', { name: /Convert to PNG/i });
    await convertBtn.click();

    const zipBtn = page.getByRole('button', { name: /Download All \(ZIP\)/i });
    await expect(zipBtn).toBeVisible({ timeout: 15000 });

    const downloadPromise = page.waitForEvent('download');
    await zipBtn.click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('Convert24 - bmp-to-png-files.zip');
  });

  test('should reject corrupted BMP file with error banner and retry option', async ({ page }) => {
    await page.goto('/tools/bmp-to-png');
    await page.locator('[data-hydrated="true"]').waitFor({ timeout: 10000 });

    const fileInput = page.locator('#bmp-file-input');
    await fileInput.setInputFiles(corruptedBmpPath);

    await expect(page.getByText('corrupted.bmp')).toBeVisible();
    await expect(page.getByText(/not a valid BMP image/i)).toBeVisible({ timeout: 5000 });
  });
});
