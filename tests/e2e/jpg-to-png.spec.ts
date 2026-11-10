import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('JPG to PNG Conversion Tool E2E', () => {
  const sampleJpgPath = path.join(process.cwd(), 'tests/fixtures/sample.jpg');
  const sampleJpegPath = path.join(process.cwd(), 'tests/fixtures/sample.jpeg');
  const fakeJpgPath = path.join(process.cwd(), 'tests/fixtures/fake.jpg');

  test('should load page, upload JPG, convert to PNG, and provide download', async ({ page }) => {
    page.on('console', (msg) => console.log(`[BROWSER CONSOLE] ${msg.type()}: ${msg.text()}`));
    page.on('pageerror', (err) => console.log(`[BROWSER ERROR] ${err.message}`));

    // 1. Open /tools/jpg-to-png
    await page.goto('/tools/jpg-to-png');
    await page.locator('[data-hydrated="true"]').waitFor({ timeout: 10000 });
    await expect(page).toHaveTitle(/Convert JPG to PNG/i);
    await expect(page.locator('h1')).toHaveText(/Convert JPG to PNG/i);

    // 2. Select / Upload valid JPG file
    const fileInput = page.locator('#jpg-file-input');
    await fileInput.setInputFiles(sampleJpgPath);

    // 3. Verify selected file appears in list
    await expect(page.getByText('sample.jpg')).toBeVisible();
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

    // 8. Verify download triggers with Convert24 prefix and .png extension
    const downloadPromise = page.waitForEvent('download');
    await downloadBtn.click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('Convert24 - sample.png');
  });

  test('should handle batch files and offer ZIP download', async ({ page }) => {
    await page.goto('/tools/jpg-to-png');
    await page.locator('[data-hydrated="true"]').waitFor({ timeout: 10000 });

    // Upload two files
    const fileInput = page.locator('#jpg-file-input');
    await fileInput.setInputFiles([sampleJpgPath, sampleJpegPath]);

    await expect(page.getByText('sample.jpg')).toBeVisible();
    await expect(page.getByText('sample.jpeg')).toBeVisible();

    // Convert
    const convertBtn = page.getByRole('button', { name: /Convert to PNG/i });
    await convertBtn.click();

    // Both should complete
    const zipBtn = page.getByRole('button', { name: /Download All \(ZIP\)/i });
    await expect(zipBtn).toBeVisible({
      timeout: 15000,
    });

    const downloadPromise = page.waitForEvent('download');
    await zipBtn.click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('Convert24 - jpg-to-png-files.zip');
  });

  test('should gracefully reject invalid JPEG file', async ({ page }) => {
    await page.goto('/tools/jpg-to-png');
    await page.locator('[data-hydrated="true"]').waitFor({ timeout: 10000 });

    const fileInput = page.locator('#jpg-file-input');
    await fileInput.setInputFiles(fakeJpgPath);

    const convertBtn = page.getByRole('button', { name: /Convert to PNG/i });
    await convertBtn.click();

    // Friendly error should be displayed
    await expect(page.getByText('This file is not a valid JPEG image.')).toBeVisible({
      timeout: 5000,
    });
    // Retry button should be available
    await expect(page.getByRole('button', { name: /Retry/i })).toBeVisible();
  });
});
