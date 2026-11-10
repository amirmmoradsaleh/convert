import { test, expect } from '@playwright/test';
import path from 'path';
import { PDFDocument } from 'pdf-lib';

test.describe('Tool #21: Split PDF E2E', () => {
  const sample1PagePdf = path.join(process.cwd(), 'tests/fixtures/sample-1page.pdf');
  const sample3PagesPdf = path.join(process.cwd(), 'tests/fixtures/sample-3pages.pdf');
  const samplePngPath = path.join(process.cwd(), 'tests/fixtures/sample.png');

  test('Test 1: Mode A — Extract selected pages (Pages 1 & 3 from 3-page PDF)', async ({
    page,
  }) => {
    await page.goto('/tools/split-pdf');
    await page.locator('[data-hydrated="true"]').waitFor({ timeout: 10000 });
    await expect(page).toHaveTitle(/Split PDF Online/i);
    await expect(page.locator('h1')).toHaveText(/Split PDF/i);

    // Upload 3-page PDF
    const fileInput = page.locator('#split-pdf-file-input');
    await fileInput.setInputFiles(sample3PagesPdf);

    // Verify file loaded and 3 pages detected
    await expect(page.getByText('sample-3pages.pdf')).toBeVisible();
    await expect(page.getByText('3 pages', { exact: true })).toBeVisible();

    // Mode A is active by default. Deselect Page 2.
    // Locate the checkbox / card for Page 2 and click it
    const page2Card = page.locator('div[role="checkbox"]').filter({ hasText: 'Page 2' });
    await page2Card.click();

    // Verify 2 pages selected
    await expect(page.getByText(/2 of 3 pages selected/i)).toBeVisible();

    // Click Split PDF
    const splitBtn = page.getByRole('button', { name: /^Split PDF$/i });
    await expect(splitBtn).toBeEnabled();
    await splitBtn.click();

    // Verify Result UI
    await expect(page.getByText('PDF Split Complete!')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('sample-3pages-page-1.pdf')).toBeVisible();
    await expect(page.getByText('sample-3pages-page-3.pdf')).toBeVisible();
    await expect(page.getByRole('button', { name: /Download All as ZIP/i })).toBeVisible();

    // Capture and verify download blob
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: /Download All as ZIP/i }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('Convert24 - sample-3pages-split.zip');
  });

  test('Test 2: Mode B — Split every page into individual documents', async ({
    page,
  }) => {
    await page.goto('/tools/split-pdf');
    await page.locator('[data-hydrated="true"]').waitFor({ timeout: 10000 });

    const fileInput = page.locator('#split-pdf-file-input');
    await fileInput.setInputFiles(sample3PagesPdf);
    await expect(page.getByText('sample-3pages.pdf')).toBeVisible();

    // Switch to Split Every Page mode
    const modeBtn = page.getByRole('button', { name: /Split Every Page/i });
    await modeBtn.click();

    // Verify description
    await expect(page.getByText(/Split into 3 separate PDF documents/i)).toBeVisible();

    // Click Split PDF
    const splitBtn = page.getByRole('button', { name: /^Split PDF$/i });
    await splitBtn.click();

    // Verify 3 output files
    await expect(page.getByText('PDF Split Complete!')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('sample-3pages-page-1.pdf')).toBeVisible();
    await expect(page.getByText('sample-3pages-page-2.pdf')).toBeVisible();
    await expect(page.getByText('sample-3pages-page-3.pdf')).toBeVisible();
  });

  test('Test 3: Mode C — Split by custom page ranges (1-2, 3)', async ({
    page,
  }) => {
    await page.goto('/tools/split-pdf');
    await page.locator('[data-hydrated="true"]').waitFor({ timeout: 10000 });

    const fileInput = page.locator('#split-pdf-file-input');
    await fileInput.setInputFiles(sample3PagesPdf);
    await expect(page.getByText('sample-3pages.pdf')).toBeVisible();

    // Switch to Split by Ranges mode
    const modeBtn = page.getByRole('button', { name: /Split by Ranges/i });
    await modeBtn.click();

    // Enter custom range
    const rangeInput = page.locator('#range-input');
    await rangeInput.fill('1-2, 3');

    // Verify parsed chips
    await expect(page.getByText(/Part 1:/i)).toBeVisible();
    await expect(page.getByText(/Pages 1-2/i)).toBeVisible();
    await expect(page.getByText(/Part 2:/i)).toBeVisible();
    await expect(page.getByText(/Page 3/i)).toBeVisible();

    // Click Split PDF
    const splitBtn = page.getByRole('button', { name: /^Split PDF$/i });
    await splitBtn.click();

    // Verify Result UI
    await expect(page.getByText('PDF Split Complete!')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('sample-3pages-pages-1-2.pdf')).toBeVisible();
    await expect(page.getByText('sample-3pages-page-3.pdf')).toBeVisible();

    // Verify individual download button
    const singleDownloadPromise = page.waitForEvent('download');
    const firstDownloadBtn = page
      .getByRole('button', { name: /^Download$/i })
      .first();
    await firstDownloadBtn.click();
    const download = await singleDownloadPromise;
    expect(download.suggestedFilename()).toBe('Convert24 - sample-3pages-pages-1-2.pdf');

    const downloadStream = await download.createReadStream();
    if (downloadStream) {
      const chunks: Buffer[] = [];
      for await (const chunk of downloadStream) {
        chunks.push(Buffer.from(chunk));
      }
      const downloadedBuffer = Buffer.concat(chunks);
      const loadedDoc = await PDFDocument.load(downloadedBuffer);
      expect(loadedDoc.getPageCount()).toBe(2);
    }
  });

  test('Test 4: Rejects non-PDF file upload with clear error message', async ({
    page,
  }) => {
    await page.goto('/tools/split-pdf');
    await page.locator('[data-hydrated="true"]').waitFor({ timeout: 10000 });

    const fileInput = page.locator('#split-pdf-file-input');
    await fileInput.setInputFiles(samplePngPath);

    await expect(page.locator('div[role="alert"]').filter({ hasText: /not a valid PDF/i })).toBeVisible();
    await expect(page.getByText(/not a valid PDF/i)).toBeVisible();
  });

  test('Test 5: Handles multi-file upload by taking first file and informing user', async ({
    page,
  }) => {
    await page.goto('/tools/split-pdf');
    await page.locator('[data-hydrated="true"]').waitFor({ timeout: 10000 });

    const fileInput = page.locator('#split-pdf-file-input');
    await fileInput.setInputFiles([sample1PagePdf, sample3PagesPdf]);

    await expect(
      page.getByText(/Split PDF works with one PDF at a time/i)
    ).toBeVisible();
    await expect(page.getByText('sample-1page.pdf')).toBeVisible();
  });
});
