import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { PDFDocument } from 'pdf-lib';

test.describe('Tool #22: Compress PDF E2E', () => {
  const compressiblePdf = path.join(process.cwd(), 'tests/fixtures/compressible.pdf');
  const alreadyOptimizedPdf = path.join(process.cwd(), 'tests/fixtures/already-optimized.pdf');
  const samplePngPath = path.join(process.cwd(), 'tests/fixtures/sample.png');

  test('Test 1: Compress PDF with genuine size reduction', async ({ page }) => {
    await page.goto('/tools/compress-pdf');
    await page.locator('[data-hydrated="true"]').waitFor({ timeout: 10000 });
    await expect(page).toHaveTitle(/Compress PDF Online/i);
    await expect(page.locator('h1')).toHaveText(/Compress PDF Files/i);

    // Upload compressible PDF
    const fileInput = page.locator('#compress-pdf-file-input');
    await fileInput.setInputFiles(compressiblePdf);

    // Verify file loaded and page count detected
    await expect(page.getByText('compressible.pdf')).toBeVisible();
    await expect(page.getByText('5 pages', { exact: true })).toBeVisible();

    // Click Compress PDF button
    const compressBtn = page.getByRole('button', { name: /^Compress PDF$/i });
    await expect(compressBtn).toBeEnabled();
    await compressBtn.click();

    // Verify success state
    await expect(page.getByText('PDF compressed successfully')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Original', { exact: true })).toBeVisible();
    await expect(page.getByText('Compressed', { exact: true })).toBeVisible();
    await expect(page.getByText('Reduced by', { exact: true })).toBeVisible();

    // Verify download button
    const downloadBtn = page.getByRole('button', { name: /Download Compressed PDF/i });
    await expect(downloadBtn).toBeVisible();

    // Verify download event and semantic PDF properties
    const downloadPromise = page.waitForEvent('download');
    await downloadBtn.click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('Convert24 - compressible-compressed.pdf');

    // Semantic output verification:
    const downloadPath = await download.path();
    expect(downloadPath).not.toBeNull();
    if (downloadPath) {
      const downloadedBytes = fs.readFileSync(downloadPath);
      const originalBytes = fs.readFileSync(compressiblePdf);

      // Verify reduction
      expect(downloadedBytes.length).toBeLessThan(originalBytes.length);

      // Verify PDF signature
      const header = downloadedBytes.subarray(0, 5).toString('ascii');
      expect(header).toBe('%PDF-');

      // Verify document readability and integrity
      const loadedDoc = await PDFDocument.load(downloadedBytes);
      expect(loadedDoc.getPageCount()).toBe(5);

      const firstPage = loadedDoc.getPage(0);
      expect(firstPage.getWidth()).toBe(500);
      expect(firstPage.getHeight()).toBe(700);
    }
  });

  test('Test 2: No-reduction handling when PDF cannot be further reduced', async ({ page }) => {
    await page.goto('/tools/compress-pdf');
    await page.locator('[data-hydrated="true"]').waitFor({ timeout: 10000 });

    const fileInput = page.locator('#compress-pdf-file-input');
    await fileInput.setInputFiles(alreadyOptimizedPdf);

    await expect(page.getByText('already-optimized.pdf')).toBeVisible();
    await expect(page.getByText('1 page', { exact: true })).toBeVisible();

    const compressBtn = page.getByRole('button', { name: /^Compress PDF$/i });
    await compressBtn.click();

    // Verify no-reduction messaging
    await expect(page.getByText('The PDF could not be reduced further')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/The original file is already optimized/i)).toBeVisible();
    await expect(page.getByText(/Your original PDF will be kept unchanged/i)).toBeVisible();

    // Should NOT show "Reduced by"
    await expect(page.getByText('Reduced by', { exact: true })).not.toBeVisible();

    // Download button offers the original file
    const downloadBtn = page.getByRole('button', { name: /Download Original PDF/i });
    await expect(downloadBtn).toBeVisible();

    const downloadPromise = page.waitForEvent('download');
    await downloadBtn.click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('Convert24 - already-optimized.pdf');
  });

  test('Test 3: Rejects non-PDF file upload with friendly error message', async ({ page }) => {
    await page.goto('/tools/compress-pdf');
    await page.locator('[data-hydrated="true"]').waitFor({ timeout: 10000 });

    const fileInput = page.locator('#compress-pdf-file-input');
    await fileInput.setInputFiles(samplePngPath);

    // Verify error banner
    const alert = page.getByRole('alert').filter({ hasText: /valid PDF/i });
    await expect(alert).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/This file is not a valid PDF/i)).toBeVisible();
  });

  test('Test 4: Reset functionality returns to initial upload state', async ({ page }) => {
    await page.goto('/tools/compress-pdf');
    await page.locator('[data-hydrated="true"]').waitFor({ timeout: 10000 });

    const fileInput = page.locator('#compress-pdf-file-input');
    await fileInput.setInputFiles(alreadyOptimizedPdf);

    const compressBtn = page.getByRole('button', { name: /^Compress PDF$/i });
    await compressBtn.click();

    await expect(page.getByText('The PDF could not be reduced further')).toBeVisible({ timeout: 15000 });

    // Click Compress another PDF
    const resetBtn = page.getByRole('button', { name: /Compress another PDF/i });
    await resetBtn.click();

    // Should be back to upload screen
    await expect(page.getByText('Choose a PDF file to compress')).toBeVisible();
  });

  test('Test 5: Mobile viewport displays responsive UI without horizontal overflow', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/tools/compress-pdf');
    await page.locator('[data-hydrated="true"]').waitFor({ timeout: 10000 });

    const fileInput = page.locator('#compress-pdf-file-input');
    await fileInput.setInputFiles(compressiblePdf);

    await expect(page.getByText('compressible.pdf')).toBeVisible();

    const compressBtn = page.getByRole('button', { name: /^Compress PDF$/i });
    await expect(compressBtn).toBeVisible();
    await compressBtn.click();

    await expect(page.getByText('PDF compressed successfully')).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('button', { name: /Download Compressed PDF/i })).toBeVisible();
  });

  test('Test 6: Allows selecting compression quality levels (40%, 50%, 60%, 70%, 80%, 90%) with 70% default', async ({
    page,
  }) => {
    await page.goto('/tools/compress-pdf');
    await page.locator('[data-hydrated="true"]').waitFor({ timeout: 10000 });

    const fileInput = page.locator('#compress-pdf-file-input');
    await fileInput.setInputFiles(compressiblePdf);

    await expect(page.getByText('compressible.pdf')).toBeVisible();

    // Verify Compression Quality section is visible
    await expect(page.getByText('Compression Quality')).toBeVisible();

    // Verify 70% is selected by default
    const defaultRadio = page.locator('#compress-pdf-quality-70');
    await expect(defaultRadio).toBeVisible();
    await expect(defaultRadio).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByText('70% Quality')).toBeVisible();

    // Verify all 6 options exist
    for (const q of [40, 50, 60, 70, 80, 90]) {
      await expect(page.locator(`#compress-pdf-quality-${q}`)).toBeVisible();
    }

    // Select 40% (strongest compression)
    const quality40Btn = page.locator('#compress-pdf-quality-40');
    await quality40Btn.click();
    await expect(quality40Btn).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByText('40% Quality')).toBeVisible();

    // Click Compress PDF
    const compressBtn = page.getByRole('button', { name: /^Compress PDF$/i });
    await compressBtn.click();

    // Verify compression completes with quality badge
    await expect(page.getByText('PDF compressed successfully')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Compression Quality: 40%')).toBeVisible();
    await expect(page.getByRole('button', { name: /Download Compressed PDF/i })).toBeVisible();
  });

  test('Test 7: Real image-heavy PDF produces different output file sizes for 40% vs 90% quality tiers in E2E', async ({
    page,
  }) => {
    // Generate image-heavy fixture
    const imageHeavyPath = path.join(process.cwd(), 'tests/fixtures/e2e-image-heavy.pdf');
    const doc = await PDFDocument.create();
    const w = 250, h = 250;
    const raw = new Uint8Array(w * h * 4);
    for (let i = 0; i < w * h; i++) {
      const x = i % w;
      const y = Math.floor(i / w);
      raw[i * 4] = Math.floor((Math.sin(x / 15) + 1) * 127);
      raw[i * 4 + 1] = Math.floor((Math.cos(y / 15) + 1) * 127);
      raw[i * 4 + 2] = (x * 5 + y * 9) % 256;
      raw[i * 4 + 3] = 255;
    }
    const jpegJs = (await import('jpeg-js')).default;
    const encodedJpg = jpegJs.encode({ data: raw, width: w, height: h }, 95);
    const embeddedImg = await doc.embedJpg(encodedJpg.data);
    const p = doc.addPage([500, 500]);
    p.drawImage(embeddedImg, { x: 50, y: 50, width: 400, height: 400 });
    const bytes = await doc.save();
    fs.writeFileSync(imageHeavyPath, bytes);

    try {
      // 1. Run at 40% quality
      await page.goto('/tools/compress-pdf');
      await page.locator('[data-hydrated="true"]').waitFor({ timeout: 10000 });
      await page.locator('#compress-pdf-file-input').setInputFiles(imageHeavyPath);
      await expect(page.getByText('e2e-image-heavy.pdf')).toBeVisible();

      // Select 40%
      await page.locator('#compress-pdf-quality-40').click();
      await page.getByRole('button', { name: /^Compress PDF$/i }).click();
      await expect(page.getByText('PDF compressed successfully')).toBeVisible({ timeout: 15000 });
      await expect(page.getByText('Compression Quality: 40%')).toBeVisible();

      const dlPromise40 = page.waitForEvent('download');
      await page.getByRole('button', { name: /Download Compressed PDF/i }).click();
      const download40 = await dlPromise40;
      const path40 = await download40.path();
      expect(path40).not.toBeNull();
      const bytes40 = fs.readFileSync(path40!);

      // 2. Run at 90% quality
      await page.goto('/tools/compress-pdf');
      await page.locator('[data-hydrated="true"]').waitFor({ timeout: 10000 });
      await page.locator('#compress-pdf-file-input').setInputFiles(imageHeavyPath);
      await expect(page.getByText('e2e-image-heavy.pdf')).toBeVisible();

      // Select 90%
      await page.locator('#compress-pdf-quality-90').click();
      await page.getByRole('button', { name: /^Compress PDF$/i }).click();
      await expect(page.getByText('PDF compressed successfully')).toBeVisible({ timeout: 15000 });
      await expect(page.getByText('Compression Quality: 90%')).toBeVisible();

      const dlPromise90 = page.waitForEvent('download');
      await page.getByRole('button', { name: /Download Compressed PDF/i }).click();
      const download90 = await dlPromise90;
      const path90 = await download90.path();
      expect(path90).not.toBeNull();
      const bytes90 = fs.readFileSync(path90!);

      // Verify that 40% quality yields significantly smaller output than 90% quality
      expect(bytes40.length).toBeLessThan(bytes90.length);

      // Verify both downloaded PDFs are valid documents
      const doc40 = await PDFDocument.load(bytes40);
      const doc90 = await PDFDocument.load(bytes90);
      expect(doc40.getPageCount()).toBe(1);
      expect(doc90.getPageCount()).toBe(1);
    } finally {
      if (fs.existsSync(imageHeavyPath)) {
        fs.unlinkSync(imageHeavyPath);
      }
    }
  });
});
