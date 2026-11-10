import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('JPG to WebP Conversion Tool E2E', () => {
  const sampleJpgPath = path.join(process.cwd(), 'tests/fixtures/sample.jpg');
  const sampleJpegPath = path.join(process.cwd(), 'tests/fixtures/sample.jpeg');
  const fakeJpgPath = path.join(process.cwd(), 'tests/fixtures/fake.jpg');

  test('Test 1 — Basic conversion: upload JPG, convert to WebP, and download result', async ({ page }) => {
    // 1. Open /tools/jpg-to-webp
    await page.goto('/tools/jpg-to-webp');
    await page.locator('[data-hydrated="true"]').waitFor({ timeout: 10000 });
    await expect(page).toHaveTitle(/Convert JPG to WebP/i);
    await expect(page.locator('h1')).toHaveText('Convert JPG to WebP');

    // 2. Select / Upload valid JPG file
    const fileInput = page.locator('#jpg-to-webp-file-input');
    await fileInput.setInputFiles(sampleJpgPath);

    // 3. Verify selected file appears in list
    await expect(page.getByText('sample.jpg')).toBeVisible();
    await expect(page.getByText('Ready to convert')).toBeVisible();

    // 4. Verify Convert to WebP button
    const convertBtn = page.getByRole('button', { name: /Convert to WebP/i });
    await expect(convertBtn).toBeEnabled();

    // 5. Convert
    await convertBtn.click();

    // 6 & 7. Wait for completion and verify success
    await expect(page.getByText('WebP Ready')).toBeVisible({ timeout: 10000 });

    // 8. Verify output filename ends with .webp
    await expect(page.getByText('(sample.webp)')).toBeVisible();

    // 9. Verify download button appears
    const downloadBtn = page.locator('[data-testid="download-single-btn"]');
    await expect(downloadBtn).toBeVisible();

    // 10. Download result and check suggestedFilename
    const downloadPromise = page.waitForEvent('download');
    await downloadBtn.click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('Convert24 - sample.webp');
  });

  test('Test 2 — Quality: select Medium 80% quality and verify conversion', async ({ page }) => {
    await page.goto('/tools/jpg-to-webp');
    await page.locator('[data-hydrated="true"]').waitFor({ timeout: 10000 });

    // 1. Upload JPG
    const fileInput = page.locator('#jpg-to-webp-file-input');
    await fileInput.setInputFiles(sampleJpgPath);

    await expect(page.getByText('sample.jpg')).toBeVisible();

    // 2. Select Medium / 80%
    await page.locator('[data-testid="quality-80"]').check({ force: true });

    // 3. Convert
    const convertBtn = page.getByRole('button', { name: /Convert to WebP/i });
    await convertBtn.click();

    // 4. Verify successful result and 80% quality badge
    await expect(page.getByText('WebP Ready')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Quality: 80%')).toBeVisible();
  });

  test('Test 3 — Multi-file: upload multiple JPG/JPEG files, convert, and download ZIP', async ({ page }) => {
    await page.goto('/tools/jpg-to-webp');
    await page.locator('[data-hydrated="true"]').waitFor({ timeout: 10000 });

    // 1. Upload multiple JPG/JPEG files
    const fileInput = page.locator('#jpg-to-webp-file-input');
    await fileInput.setInputFiles([sampleJpgPath, sampleJpegPath]);

    await expect(page.getByText('sample.jpg')).toBeVisible();
    await expect(page.getByText('sample.jpeg')).toBeVisible();

    // 2. Convert
    const convertBtn = page.getByRole('button', { name: /Convert to WebP/i });
    await convertBtn.click();

    // 3. Verify both files completed
    const readyBadges = page.getByText('WebP Ready');
    await expect(readyBadges).toHaveCount(2, { timeout: 15000 });

    // 4. Verify Download All (ZIP) button
    const zipBtn = page.locator('[data-testid="download-all-zip-btn"]');
    await expect(zipBtn).toBeVisible();

    // 5. Verify ZIP filename is jpg-to-webp-files.zip
    const downloadPromise = page.waitForEvent('download');
    await zipBtn.click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('Convert24 - jpg-to-webp-files.zip');
  });

  test('Test 4 — Invalid file: reject corrupted/invalid JPEG and show retry', async ({ page }) => {
    await page.goto('/tools/jpg-to-webp');
    await page.locator('[data-hydrated="true"]').waitFor({ timeout: 10000 });

    // 1. Upload invalid JPEG
    const fileInput = page.locator('#jpg-to-webp-file-input');
    await fileInput.setInputFiles(fakeJpgPath);

    await expect(page.getByText('fake.jpg')).toBeVisible();

    // Convert
    const convertBtn = page.getByRole('button', { name: /Convert to WebP/i });
    await convertBtn.click();

    // 2. Verify validation error
    await expect(page.getByText('This file is not a valid JPEG image.')).toBeVisible({
      timeout: 5000,
    });

    // 3. Verify Retry button is visible
    const retryBtn = page.locator('[data-testid="retry-file-btn"]');
    await expect(retryBtn).toBeVisible();
  });
});
