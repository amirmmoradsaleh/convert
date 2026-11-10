import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

function sha256(filePath: string): string {
  const buf = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(buf).digest('hex');
}

test.describe('Tool #11: Compress Image E2E', () => {
  const sampleJpgPath = path.join(process.cwd(), 'tests/fixtures/sample.jpg');
  const samplePngPath = path.join(process.cwd(), 'tests/fixtures/sample.png');
  const sampleWebpPath = path.join(process.cwd(), 'tests/fixtures/sample.webp');
  const animatedWebpPath = path.join(process.cwd(), 'tests/fixtures/animated.webp');
  const corruptedJpgPath = path.join(process.cwd(), 'tests/fixtures/corrupted.jpg');
  const smallJpgPath = path.join(process.cwd(), 'tests/fixtures/small-100kb.jpg');
  const smallWebpPath = path.join(process.cwd(), 'tests/fixtures/small-100kb.webp');

  test('should load /tools/compress-image, adjust quality, upload JPG, compress and download', async ({ page }) => {
    // 1. Open /tools/compress-image
    await page.goto('/tools/compress-image');
    await expect(page).toHaveTitle(/Compress Image/i);
    await expect(page.locator('h1')).toHaveText(/Compress Images Online|Compress Image/i);

    // 2. Upload valid JPG file
    const fileInput = page.locator('#compress-file-input');
    await fileInput.setInputFiles(sampleJpgPath);

    // 3. Verify selected file appears in list with quality controls
    await expect(page.getByText('sample.jpg')).toBeVisible();
    await expect(page.locator('#compress-quality-slider')).toBeVisible();
    await expect(page.getByText('80%', { exact: true })).toBeVisible();

    // 4. Click Compress Image
    const compressBtn = page.locator('#compress-submit-btn');
    await expect(compressBtn).toBeEnabled();
    await compressBtn.click();

    // 5. Verify compression completes
    await expect(page.locator('#compress-download-btn-0')).toBeVisible({ timeout: 15000 });

    // 6. Verify download triggers with original filename and extension
    const downloadPromise = page.waitForEvent('download');
    await page.locator('#compress-download-btn-0').click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('Convert24 - sample.jpg');
  });

  test('should compress PNG with lossless optimization and preserve PNG format', async ({ page }) => {
    await page.goto('/tools/compress-image');

    const fileInput = page.locator('#compress-file-input');
    await fileInput.setInputFiles(samplePngPath);

    await expect(page.getByText('sample.png')).toBeVisible();

    const compressBtn = page.locator('#compress-submit-btn');
    await expect(compressBtn).toBeEnabled();
    await compressBtn.click();

    await expect(page.locator('#compress-download-btn-0')).toBeVisible({ timeout: 15000 });

    const downloadPromise = page.waitForEvent('download');
    await page.locator('#compress-download-btn-0').click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('Convert24 - sample.png');
  });

  test('should reject animated WebP files with clear error message', async ({ page }) => {
    await page.goto('/tools/compress-image');

    const fileInput = page.locator('#compress-file-input');
    await fileInput.setInputFiles(animatedWebpPath);

    await expect(page.getByText('animated.webp')).toBeVisible();
    await expect(
      page.getByText('Animated WebP files are not supported by this compression tool.')
    ).toBeVisible({ timeout: 5000 });
  });

  test('should reject corrupted JPG file with error message', async ({ page }) => {
    await page.goto('/tools/compress-image');
    await page.locator('[data-hydrated="true"]').waitFor({ timeout: 10000 });

    const fileInput = page.locator('#compress-file-input');
    await fileInput.setInputFiles(corruptedJpgPath);

    await expect(page.getByText('corrupted.jpg')).toBeVisible();
    const compressBtn = page.locator('#compress-submit-btn');
    await compressBtn.click();

    await expect(page.getByText(/not a valid|failed to decode|couldn't compress/i)).toBeVisible({
      timeout: 5000,
    });
  });

  test('should support batch compression and ZIP download', async ({ page }) => {
    await page.goto('/tools/compress-image');

    const fileInput = page.locator('#compress-file-input');
    await fileInput.setInputFiles([sampleJpgPath, sampleWebpPath]);

    await expect(page.getByText('sample.jpg')).toBeVisible();
    await expect(page.getByText('sample.webp')).toBeVisible();

    const compressBtn = page.locator('#compress-submit-btn');
    await compressBtn.click();

    await expect(page.locator('#compress-download-all-zip-btn')).toBeVisible({ timeout: 15000 });

    const downloadPromise = page.waitForEvent('download');
    await page.locator('#compress-download-all-zip-btn').click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.zip$/i);
  });

  test('should retain original bytes and display "No size reduction (original kept)" when JPEG encoded result is larger than input', async ({
    page,
  }) => {
    await page.goto('/tools/compress-image');

    const fileInput = page.locator('#compress-file-input');
    await fileInput.setInputFiles(smallJpgPath);

    await expect(page.getByText('small-100kb.jpg')).toBeVisible();
    await expect(page.locator('#compress-quality-slider')).toHaveValue('80');

    const compressBtn = page.locator('#compress-submit-btn');
    await compressBtn.click();

    await expect(page.locator('#compress-download-btn-0')).toBeVisible({ timeout: 15000 });

    // Verify UI explicitly reports original kept with no size reduction
    await expect(page.getByText('No size reduction (original kept)')).toBeVisible();

    // Verify downloaded file is byte-identical to original input
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.locator('#compress-download-btn-0').click(),
    ]);

    expect(download.suggestedFilename()).toBe('Convert24 - small-100kb.jpg');
    const dlPath = path.join(process.cwd(), 'tests/fixtures/audit/test-dl-jpeg-retained.jpg');
    await download.saveAs(dlPath);

    const originalStats = fs.statSync(smallJpgPath);
    const dlStats = fs.statSync(dlPath);
    expect(dlStats.size).toBe(originalStats.size);
    expect(sha256(dlPath)).toBe(sha256(smallJpgPath));

    fs.unlinkSync(dlPath);
  });

  test('should retain original bytes and display "No size reduction (original kept)" when WebP encoded result is larger than input', async ({
    page,
  }) => {
    await page.goto('/tools/compress-image');

    const fileInput = page.locator('#compress-file-input');
    await fileInput.setInputFiles(smallWebpPath);

    await expect(page.getByText('small-100kb.webp')).toBeVisible();
    await expect(page.locator('#compress-quality-slider')).toHaveValue('80');

    const compressBtn = page.locator('#compress-submit-btn');
    await compressBtn.click();

    await expect(page.locator('#compress-download-btn-0')).toBeVisible({ timeout: 15000 });

    await expect(page.getByText('No size reduction (original kept)')).toBeVisible();

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.locator('#compress-download-btn-0').click(),
    ]);

    expect(download.suggestedFilename()).toBe('Convert24 - small-100kb.webp');
    const dlPath = path.join(process.cwd(), 'tests/fixtures/audit/test-dl-webp-retained.webp');
    await download.saveAs(dlPath);

    const originalStats = fs.statSync(smallWebpPath);
    const dlStats = fs.statSync(dlPath);
    expect(dlStats.size).toBe(originalStats.size);
    expect(sha256(dlPath)).toBe(sha256(smallWebpPath));

    fs.unlinkSync(dlPath);
  });

  test('should download newly encoded smaller result when compression actually reduces file size', async ({
    page,
  }) => {
    await page.goto('/tools/compress-image');

    const fileInput = page.locator('#compress-file-input');
    await fileInput.setInputFiles(smallJpgPath);

    await expect(page.getByText('small-100kb.jpg')).toBeVisible();

    // Set slider to 20% (high compression)
    await page.locator('#compress-quality-slider').fill('20');
    await expect(page.getByText('20%', { exact: true })).toBeVisible();

    const compressBtn = page.locator('#compress-submit-btn');
    await compressBtn.click();

    await expect(page.locator('#compress-download-btn-0')).toBeVisible({ timeout: 15000 });

    // Verify UI reports positive savings
    await expect(page.locator('.flex-shrink-0.md\\:w-56').getByText(/Saved/i)).toBeVisible();

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.locator('#compress-download-btn-0').click(),
    ]);

    expect(download.suggestedFilename()).toBe('Convert24 - small-100kb.jpg');
    const dlPath = path.join(process.cwd(), 'tests/fixtures/audit/test-dl-smaller.jpg');
    await download.saveAs(dlPath);

    const originalStats = fs.statSync(smallJpgPath);
    const dlStats = fs.statSync(dlPath);
    // Output must be strictly smaller and not byte-identical to original
    expect(dlStats.size).toBeLessThan(originalStats.size);
    expect(sha256(dlPath)).not.toBe(sha256(smallJpgPath));

    fs.unlinkSync(dlPath);
  });

  test('should display concise PNG explanation that quality slider does not control lossy PNG compression', async ({
    page,
  }) => {
    await page.goto('/tools/compress-image');

    // 1. Upload PNG
    const fileInput = page.locator('#compress-file-input');
    await fileInput.setInputFiles(samplePngPath);

    await expect(page.getByText('sample.png')).toBeVisible();

    // 2. Verify format notice and item notice
    await expect(
      page.getByText(/the quality slider does not control lossy PNG compression/i)
    ).toBeVisible();
    await expect(
      page.getByText('Lossless optimization (slider does not affect PNG)')
    ).toBeVisible();

    // 3. Compress PNG and verify optimal retention
    const compressBtn = page.locator('#compress-submit-btn');
    await compressBtn.click();

    await expect(page.locator('#compress-download-btn-0')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Original kept (already optimal)')).toBeVisible();

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.locator('#compress-download-btn-0').click(),
    ]);

    expect(download.suggestedFilename()).toBe('Convert24 - sample.png');
  });
});
