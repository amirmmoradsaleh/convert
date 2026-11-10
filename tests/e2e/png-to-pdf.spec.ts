import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('Tool #17: PNG to PDF E2E', () => {
  const samplePngPath = path.join(process.cwd(), 'tests/fixtures/sample.png');
  const transparentPngPath = path.join(process.cwd(), 'tests/fixtures/transparent.png');
  const semitransparentPngPath = path.join(process.cwd(), 'tests/fixtures/semitransparent.png');
  const sampleJpgPath = path.join(process.cwd(), 'tests/fixtures/sample.jpg');

  test('Test 1: Single PNG — load page, upload PNG, generate PDF, verify 1 page & download UI', async ({
    page,
  }) => {
    // 1. Navigate to /tools/png-to-pdf
    await page.goto('/tools/png-to-pdf');
    await page.locator('[data-hydrated="true"]').waitFor({ timeout: 10000 });
    await expect(page).toHaveTitle(/PNG to PDF Converter/i);
    await expect(page.locator('h1')).toHaveText(/Convert PNG to PDF/i);

    // 2. Upload sample.png
    const fileInput = page.locator('#png-to-pdf-file-input');
    await fileInput.setInputFiles(samplePngPath);

    // 3. Verify selected file card
    await expect(page.getByText('sample.png')).toBeVisible();
    await expect(page.getByText(/1 PNG Image Selected/i)).toBeVisible();

    // 4. Click Convert to PDF
    const convertBtn = page.getByRole('button', { name: /Convert to PDF/i });
    await expect(convertBtn).toBeEnabled();
    await convertBtn.click();

    // 5. Verify PDF Creation Success & Download Button
    await expect(page.getByText('PDF Created Successfully!')).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('button', { name: /Download PDF/i })).toBeVisible();
    await expect(page.getByText(/1 page/i)).toBeVisible();
    await expect(page.getByText('sample.pdf')).toBeVisible();
  });

  test('Test 2: Multiple PNGs — upload multiple PNGs, reorder, and combine into multi-page PDF', async ({
    page,
  }) => {
    await page.goto('/tools/png-to-pdf');
    await page.locator('[data-hydrated="true"]').waitFor({ timeout: 10000 });

    // Upload 2 files: sample.png and transparent.png
    const fileInput = page.locator('#png-to-pdf-file-input');
    await fileInput.setInputFiles([samplePngPath, transparentPngPath]);

    // Verify 2 items appear
    await expect(page.getByText(/2 PNG Images Selected/i)).toBeVisible();
    await expect(page.getByText('sample.png')).toBeVisible();
    await expect(page.getByText('transparent.png')).toBeVisible();

    // Reorder: Move sample.png down
    const moveDownBtn = page.getByRole('button', { name: 'Move sample.png down' });
    await expect(moveDownBtn).toBeEnabled();
    await moveDownBtn.click();

    // Convert to PDF
    const convertBtn = page.getByRole('button', { name: /Convert to PDF \(2 pages\)/i });
    await expect(convertBtn).toBeEnabled();
    await convertBtn.click();

    // Verify multi-page PDF creation
    await expect(page.getByText('PDF Created Successfully!')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/2 pages/i)).toBeVisible();
    await expect(page.getByText('png-to-pdf.pdf')).toBeVisible();
    await expect(page.getByRole('button', { name: /Download PDF/i })).toBeVisible();
  });

  test('Test 3: Invalid file — upload JPG, verify rejection and friendly error', async ({ page }) => {
    await page.goto('/tools/png-to-pdf');
    await page.locator('[data-hydrated="true"]').waitFor({ timeout: 10000 });

    const fileInput = page.locator('#png-to-pdf-file-input');
    await fileInput.setInputFiles(sampleJpgPath);

    // Verify rejection error banner
    await expect(
      page.getByText(/This file format is not supported. Please upload a PNG image/i)
    ).toBeVisible({ timeout: 5000 });
  });

  test('Test 4: Transparency — upload transparent PNG and verify conversion completes cleanly', async ({
    page,
  }) => {
    await page.goto('/tools/png-to-pdf');
    await page.locator('[data-hydrated="true"]').waitFor({ timeout: 10000 });

    const fileInput = page.locator('#png-to-pdf-file-input');
    await fileInput.setInputFiles(semitransparentPngPath);

    await expect(page.getByText('semitransparent.png')).toBeVisible();
    const convertBtn = page.getByRole('button', { name: /Convert to PDF/i });
    await expect(convertBtn).toBeEnabled();
    await convertBtn.click();

    await expect(page.getByText('PDF Created Successfully!')).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('button', { name: /Download PDF/i })).toBeVisible();
    await expect(page.getByText('semitransparent.pdf')).toBeVisible();
  });

  test('Test 5: Mobile viewport — render and convert at mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/tools/png-to-pdf');
    await page.locator('[data-hydrated="true"]').waitFor({ timeout: 10000 });

    await expect(page.locator('h1')).toBeVisible();
    const fileInput = page.locator('#png-to-pdf-file-input');
    await fileInput.setInputFiles(samplePngPath);

    await expect(page.getByText('sample.png')).toBeVisible();
    const convertBtn = page.getByRole('button', { name: /Convert to PDF/i });
    await expect(convertBtn).toBeVisible();
    await convertBtn.click();

    await expect(page.getByText('PDF Created Successfully!')).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('button', { name: /Download PDF/i })).toBeVisible();
  });
});
