import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('SVG to PNG Conversion Tool E2E', () => {
  const sampleSvgPath = path.join(process.cwd(), 'tests/fixtures/sample.svg');
  const unsafeScriptSvgPath = path.join(process.cwd(), 'tests/fixtures/unsafe-script.svg');

  test('should load /tools/svg-to-png, upload SVG, rasterize to PNG, and download', async ({ page }) => {
    // 1. Open /tools/svg-to-png
    await page.goto('/tools/svg-to-png');
    await page.locator('[data-hydrated="true"]').waitFor({ timeout: 10000 });
    await expect(page).toHaveTitle(/Convert SVG to PNG/i);
    await expect(page.locator('h1')).toHaveText('Convert SVG to PNG');

    // 2. Upload valid SVG file
    const fileInput = page.locator('#svg-file-input');
    await fileInput.setInputFiles(sampleSvgPath);

    // 3. Verify selected file appears in list
    await expect(page.getByText('sample.svg')).toBeVisible();

    // 4. Click Convert to PNG
    const convertBtn = page.getByRole('button', { name: /Convert to PNG/i });
    await expect(convertBtn).toBeEnabled();
    await convertBtn.click();

    // 5. Verify conversion completes
    await expect(page.getByText('Converted', { exact: true })).toBeVisible({ timeout: 15000 });

    // 6. Verify single download button appears
    const downloadBtn = page.getByRole('button', { name: 'Download', exact: true });
    await expect(downloadBtn).toBeVisible();

    // 7. Verify download triggers with .png extension and Convert24 prefix
    const downloadPromise = page.waitForEvent('download');
    await downloadBtn.click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('Convert24 - sample.png');
  });

  test('should handle batch files and offer ZIP download with Convert24 prefix', async ({ page }) => {
    const withDimensionsSvgPath = path.join(process.cwd(), 'tests/fixtures/with-dimensions.svg');
    await page.goto('/tools/svg-to-png');
    await page.locator('[data-hydrated="true"]').waitFor({ timeout: 10000 });

    const fileInput = page.locator('#svg-file-input');
    await fileInput.setInputFiles([sampleSvgPath, withDimensionsSvgPath]);

    await expect(page.getByText('sample.svg')).toBeVisible();
    await expect(page.getByText('with-dimensions.svg')).toBeVisible();

    const convertBtn = page.getByRole('button', { name: /Convert to PNG/i });
    await convertBtn.click();

    const zipBtn = page.getByRole('button', { name: /Download All \(ZIP\)/i });
    await expect(zipBtn).toBeVisible({ timeout: 15000 });

    const downloadPromise = page.waitForEvent('download');
    await zipBtn.click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('Convert24 - svg-to-png-converted.zip');
  });

  test('should reject unsafe SVG containing script tags', async ({ page }) => {
    await page.goto('/tools/svg-to-png');
    await page.locator('[data-hydrated="true"]').waitFor({ timeout: 10000 });

    const fileInput = page.locator('#svg-file-input');
    await fileInput.setInputFiles(unsafeScriptSvgPath);

    await expect(page.getByText('unsafe-script.svg')).toBeVisible();
    await expect(page.getByText(/unsupported or unsafe content/i)).toBeVisible({ timeout: 5000 });
  });
});
