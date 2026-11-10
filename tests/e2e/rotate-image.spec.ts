import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('Tool #14: Rotate Image E2E', () => {
  const sampleJpgPath = path.join(process.cwd(), 'tests/fixtures/sample.jpg');
  const samplePngPath = path.join(process.cwd(), 'tests/fixtures/sample.png');
  const cornersPngPath = path.join(process.cwd(), 'tests/fixtures/distinguishable-corners.png');
  const corruptedJpgPath = path.join(process.cwd(), 'tests/fixtures/corrupted.jpg');

  test('should load /tools/rotate-image, upload image, rotate 90° and download with Convert24 prefix', async ({
    page,
  }) => {
    // 1. Open /tools/rotate-image
    await page.goto('/tools/rotate-image');
    await expect(page).toHaveTitle(/Rotate Image/i);
    await expect(page.locator('h1')).toHaveText(/Rotate Images Online|Rotate Image/i);

    // 2. Upload image
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles(cornersPngPath);

    // 3. Verify file appears with rotation controls (defaults to 90°)
    await expect(page.getByText('distinguishable-corners.png')).toBeVisible();
    await expect(page.getByText('Rotation Angle (90°)')).toBeVisible();

    // 4. Click Rotate Image (90°)
    const rotateBtn = page.getByRole('button', { name: /Rotate Image \(90°\)/i });
    await expect(rotateBtn).toBeEnabled();
    await rotateBtn.click();

    // 5. Verify download button appears
    const downloadLink = page.getByRole('link', { name: /Download Rotated Image/i });
    await expect(downloadLink).toBeVisible({ timeout: 15000 });

    // 6. Verify download has Convert24 prefix and -rotated suffix
    const downloadPromise = page.waitForEvent('download');
    await downloadLink.click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('Convert24 - distinguishable-corners-rotated.png');
  });

  test('should support selecting 180° upside-down rotation angle', async ({ page }) => {
    await page.goto('/tools/rotate-image');

    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles(cornersPngPath);

    await expect(page.getByText('distinguishable-corners.png')).toBeVisible();

    // From default 90°, click +90° to reach 180° rotation
    const rotateRightBtn = page.getByRole('button', { name: '+90° (Right)' });
    await rotateRightBtn.click();
    await expect(page.getByText('Rotation Angle (180°)')).toBeVisible();

    // Execute rotation
    const rotateBtn = page.getByRole('button', { name: /Rotate Image \(180°\)/i });
    await rotateBtn.click();

    const downloadLink = page.getByRole('link', { name: /Download Rotated Image/i });
    await expect(downloadLink).toBeVisible({ timeout: 15000 });
  });

  test('should handle batch files and offer ZIP download with Convert24 prefix', async ({ page }) => {
    await page.goto('/tools/rotate-image');

    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles([sampleJpgPath, samplePngPath]);

    await expect(page.getByText('sample.jpg')).toBeVisible();
    await expect(page.getByText('sample.png')).toBeVisible();

    const rotateBtn = page.getByRole('button', { name: /Rotate Images/i });
    await rotateBtn.click();

    const zipBtn = page.getByRole('button', { name: /Download All \(ZIP\)/i });
    await expect(zipBtn).toBeVisible({ timeout: 15000 });

    const downloadPromise = page.waitForEvent('download');
    await zipBtn.click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^Convert24 - rotated-images-\d+\.zip$/);
  });

  test('should fail safely on corrupted file without exposing a misleading download', async ({ page }) => {
    await page.goto('/tools/rotate-image');

    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles(corruptedJpgPath);

    await expect(page.getByText('corrupted.jpg')).toBeVisible();

    const rotateBtn = page.getByRole('button', { name: /Rotate Image/i });
    await rotateBtn.click();

    // Verify item indicates failure or error banner
    await expect(page.getByText(/Failed|not a valid|couldn't rotate/i)).toBeVisible({ timeout: 5000 });
    // Verify Download Rotated Image button is NOT rendered
    await expect(page.getByRole('link', { name: /Download Rotated Image/i })).not.toBeVisible();
  });
});
