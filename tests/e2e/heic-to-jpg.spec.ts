import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('HEIC to JPG Conversion Tool E2E', () => {
  const sampleHeicPath = path.join(process.cwd(), 'tests/fixtures/sample.heic');
  const invalidHeicPath = path.join(process.cwd(), 'tests/fixtures/invalid.heic');

  test('should load page, upload HEIC, convert to JPG, and provide download', async ({ page }) => {
    // 1. Open /tools/heic-to-jpg
    await page.goto('/tools/heic-to-jpg');
    await page.locator('[data-hydrated="true"]').waitFor({ timeout: 10000 });
    await expect(page).toHaveTitle(/Convert HEIC to JPG/i);
    await expect(page.locator('h1')).toHaveText('Convert HEIC to JPG');

    // 2. Select / Upload valid HEIC file
    const fileInput = page.locator('#heic-file-input');
    await fileInput.setInputFiles(sampleHeicPath);

    // 3. Verify selected file appears in list
    await expect(page.getByText('sample.heic')).toBeVisible();

    // 4. Click Convert to JPG
    const convertBtn = page.getByRole('button', { name: /Convert to JPG/i });
    await expect(convertBtn).toBeEnabled();
    await convertBtn.click();

    // 5. Verify conversion completes or gives expected result
    await expect(page.locator('text=Done')).toBeVisible({ timeout: 15000 });

    // 6. Verify single download button appears
    const downloadBtn = page.getByRole('button', { name: /Download converted JPG for sample\.heic/i });
    await expect(downloadBtn).toBeVisible();

    // 7. Verify download triggers with .jpg extension
    const downloadPromise = page.waitForEvent('download');
    await downloadBtn.click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('Convert24 - sample.jpg');
  });

  test('should allow changing quality preset before conversion', async ({ page }) => {
    await page.goto('/tools/heic-to-jpg');
    await page.locator('[data-hydrated="true"]').waitFor({ timeout: 10000 });

    const fileInput = page.locator('#heic-file-input');
    await fileInput.setInputFiles(sampleHeicPath);

    // Select Medium (80%) quality
    const mediumRadio = page.getByRole('radio', { name: /Medium \(80%\)/i });
    await mediumRadio.click();
    await expect(mediumRadio).toHaveAttribute('aria-checked', 'true');

    // Convert
    const convertBtn = page.getByRole('button', { name: /Convert to JPG/i });
    await convertBtn.click();

    await expect(page.locator('text=Done')).toBeVisible({ timeout: 15000 });
  });

  test('should handle invalid non-HEIC files and show rejection', async ({ page }) => {
    await page.goto('/tools/heic-to-jpg');
    await page.locator('[data-hydrated="true"]').waitFor({ timeout: 10000 });

    const fileInput = page.locator('#heic-file-input');
    await fileInput.setInputFiles(invalidHeicPath);

    await expect(page.getByText('invalid.heic')).toBeVisible();
    await expect(page.getByText(/not a valid HEIC image/i)).toBeVisible({ timeout: 5000 });
  });
});
