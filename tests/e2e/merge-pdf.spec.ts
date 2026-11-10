import { test, expect } from '@playwright/test';
import path from 'path';
import { PDFDocument } from 'pdf-lib';

test.describe('Tool #20: Merge PDF E2E', () => {
  const sample1PagePdf = path.join(process.cwd(), 'tests/fixtures/sample-1page.pdf');
  const sample2PagesPdf = path.join(process.cwd(), 'tests/fixtures/sample-2pages.pdf');
  const sample3PagesPdf = path.join(process.cwd(), 'tests/fixtures/sample-3pages.pdf');
  const samplePngPath = path.join(process.cwd(), 'tests/fixtures/sample.png');

  test('Test 1: Merge two PDFs — upload 1-page & 3-page PDFs, merge, verify 4 pages & download UI', async ({
    page,
  }) => {
    await page.goto('/tools/merge-pdf');
    await page.locator('[data-hydrated="true"]').waitFor({ timeout: 10000 });
    await expect(page).toHaveTitle(/Merge PDF Files Online/i);
    await expect(page.locator('h1')).toHaveText(/Merge PDF Files/i);

    // Upload 2 PDFs
    const fileInput = page.locator('#merge-pdf-file-input');
    await fileInput.setInputFiles([sample1PagePdf, sample3PagesPdf]);

    // Verify files listed and page counts detected
    await expect(page.getByText('sample-1page.pdf')).toBeVisible();
    await expect(page.getByText('1 page', { exact: true })).toBeVisible();
    await expect(page.getByText('sample-3pages.pdf')).toBeVisible();
    await expect(page.getByText('3 pages', { exact: true })).toBeVisible();
    await expect(page.getByText(/4 pages total/i)).toBeVisible();

    // Click Merge button
    const mergeBtn = page.getByRole('button', { name: /Merge 2 PDFs/i });
    await expect(mergeBtn).toBeEnabled();
    await mergeBtn.click();

    // Verify Result UI
    await expect(page.getByText('PDFs Merged Successfully')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('4 pages', { exact: true }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /Download Merged PDF/i })).toBeVisible();

    // Capture and verify download blob semantically
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: /Download Merged PDF/i }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('Convert24 - merged.pdf');

    const downloadStream = await download.createReadStream();
    if (downloadStream) {
      const chunks: Buffer[] = [];
      for await (const chunk of downloadStream) {
        chunks.push(Buffer.from(chunk));
      }
      const downloadedBuffer = Buffer.concat(chunks);
      const loadedDoc = await PDFDocument.load(downloadedBuffer);
      expect(loadedDoc.getPageCount()).toBe(4);
    }
  });

  test('Test 2: Merge three PDFs — upload 1-page, 2-page, and 3-page PDFs, verify 6 total pages', async ({
    page,
  }) => {
    await page.goto('/tools/merge-pdf');
    await page.locator('[data-hydrated="true"]').waitFor({ timeout: 10000 });

    const fileInput = page.locator('#merge-pdf-file-input');
    await fileInput.setInputFiles([sample1PagePdf, sample2PagesPdf, sample3PagesPdf]);

    await expect(page.getByText('sample-1page.pdf')).toBeVisible();
    await expect(page.getByText('sample-2pages.pdf')).toBeVisible();
    await expect(page.getByText('sample-3pages.pdf')).toBeVisible();
    await expect(page.getByText(/6 pages total/i)).toBeVisible();

    const mergeBtn = page.getByRole('button', { name: /Merge 3 PDFs/i });
    await expect(mergeBtn).toBeEnabled();
    await mergeBtn.click();

    await expect(page.getByText('PDFs Merged Successfully')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('6 pages', { exact: true }).first()).toBeVisible();
  });

  test('Test 3: File Reordering — move items up and down, verify order preservation', async ({
    page,
  }) => {
    await page.goto('/tools/merge-pdf');
    await page.locator('[data-hydrated="true"]').waitFor({ timeout: 10000 });

    const fileInput = page.locator('#merge-pdf-file-input');
    await fileInput.setInputFiles([sample1PagePdf, sample2PagesPdf, sample3PagesPdf]);

    await expect(page.getByText('sample-1page.pdf')).toBeVisible();

    // Move first item down
    const moveDownFirst = page.getByRole('button', { name: 'Move sample-1page.pdf down' });
    await moveDownFirst.click();

    // Now sample-2pages.pdf should be first, sample-1page.pdf second, sample-3pages.pdf third
    const mergeBtn = page.getByRole('button', { name: /Merge 3 PDFs/i });
    await mergeBtn.click();

    await expect(page.getByText('PDFs Merged Successfully')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('6 pages', { exact: true }).first()).toBeVisible();
  });

  test('Test 4: Remove file — upload 3 PDFs, remove 1, verify remaining 2 are merged', async ({
    page,
  }) => {
    await page.goto('/tools/merge-pdf');
    await page.locator('[data-hydrated="true"]').waitFor({ timeout: 10000 });

    const fileInput = page.locator('#merge-pdf-file-input');
    await fileInput.setInputFiles([sample1PagePdf, sample2PagesPdf, sample3PagesPdf]);

    await expect(page.getByText(/6 pages total/i)).toBeVisible();

    // Remove the 3-page PDF
    const removeBtn = page.getByRole('button', { name: 'Remove sample-3pages.pdf' });
    await removeBtn.click();

    await expect(page.getByText('sample-3pages.pdf')).not.toBeVisible();
    await expect(page.getByText(/3 pages total/i)).toBeVisible();

    const mergeBtn = page.getByRole('button', { name: /Merge 2 PDFs/i });
    await mergeBtn.click();

    await expect(page.getByText('PDFs Merged Successfully')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('3 pages', { exact: true }).first()).toBeVisible();
  });

  test('Test 5: Single file state — show add more notice when only 1 PDF uploaded', async ({
    page,
  }) => {
    await page.goto('/tools/merge-pdf');
    await page.locator('[data-hydrated="true"]').waitFor({ timeout: 10000 });

    const fileInput = page.locator('#merge-pdf-file-input');
    await fileInput.setInputFiles([sample1PagePdf]);

    await expect(page.getByText('Add at least one more PDF to merge.')).toBeVisible();
    const mergeBtn = page.getByRole('button', { name: /Merge 1 PDFs|Merge 1 PDF/i });
    await expect(mergeBtn).toBeDisabled();
  });

  test('Test 6: Invalid file — reject non-PDF file and show friendly error', async ({
    page,
  }) => {
    await page.goto('/tools/merge-pdf');
    await page.locator('[data-hydrated="true"]').waitFor({ timeout: 10000 });

    const fileInput = page.locator('#merge-pdf-file-input');
    await fileInput.setInputFiles([samplePngPath]);

    await expect(
      page.locator('[role="alert"]').filter({ hasText: /PDF/i })
    ).toBeVisible();
    await expect(page.getByText(/not a valid PDF/i)).toBeVisible();
  });

  test('Test 7: Mobile viewport — render and merge cleanly at mobile size', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/tools/merge-pdf');
    await page.locator('[data-hydrated="true"]').waitFor({ timeout: 10000 });

    const fileInput = page.locator('#merge-pdf-file-input');
    await fileInput.setInputFiles([sample1PagePdf, sample2PagesPdf]);

    await expect(page.getByText('sample-1page.pdf')).toBeVisible();
    await expect(page.getByText('sample-2pages.pdf')).toBeVisible();

    const mergeBtn = page.getByRole('button', { name: /Merge 2 PDFs/i });
    await expect(mergeBtn).toBeEnabled();
    await mergeBtn.click();

    await expect(page.getByText('PDFs Merged Successfully')).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('button', { name: /Download Merged PDF/i })).toBeVisible();
  });
});
