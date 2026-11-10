import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('SEC-01 & SEC-02 Real Browser E2E Verification', () => {
  test('verifies security headers, local PDF worker serving, and zero unpkg.com network requests on PDF to PNG', async ({ page }) => {
    const networkUrls: string[] = [];
    const cspErrors: string[] = [];

    page.on('request', (req) => {
      networkUrls.push(req.url());
    });

    page.on('console', (msg) => {
      const text = msg.text();
      if (/Content Security Policy/i.test(text) || /violates the following Content Security Policy/i.test(text)) {
        cspErrors.push(text);
      }
    });

    // 1. Navigate to /tools/pdf-to-png
    const response = await page.goto('/tools/pdf-to-png', { waitUntil: 'networkidle' });
    expect(response).not.toBeNull();
    expect(response!.status()).toBe(200);

    // 2. Assert HTTP response headers
    const headers = response!.headers();
    expect(headers['x-content-type-options']).toBe('nosniff');
    expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
    expect(headers['x-frame-options']).toBe('SAMEORIGIN');
    expect(headers['content-security-policy']).toContain("default-src 'self'");
    expect(headers['content-security-policy']).toContain("worker-src 'self' blob:");
    expect(headers['content-security-policy']).not.toContain('unpkg.com');

    // 3. Upload a sample PDF file
    const samplePdf = path.join(process.cwd(), 'tests', 'fixtures', 'sample-1page.pdf');
    const fileInput = page.locator('#pdf-to-png-file-input');
    await fileInput.setInputFiles(samplePdf);

    // Wait for document to load and show conversion button
    const convertBtn = page.getByRole('button', { name: /Convert 1 Page to PNG/i });
    await expect(convertBtn).toBeVisible({ timeout: 10000 });
    await convertBtn.click();

    // Wait for conversion completion
    await expect(page.getByText('PDF Converted Successfully')).toBeVisible({ timeout: 15000 });
    const downloadBtn = page.getByRole('button', { name: /Download PNG/i });
    await expect(downloadBtn).toBeVisible();

    // 4. Assert ZERO requests to unpkg.com were made during the entire lifecycle
    const unpkgRequests = networkUrls.filter((url) => url.includes('unpkg.com'));
    expect(unpkgRequests).toHaveLength(0);

    // 5. Assert local worker was requested from same-origin /vendor/pdfjs/pdf.worker.min.mjs
    const localWorkerRequests = networkUrls.filter((url) => url.includes('/vendor/pdfjs/pdf.worker.min.mjs'));
    expect(localWorkerRequests.length).toBeGreaterThanOrEqual(1);

    // 6. Assert zero CSP violations
    expect(cspErrors).toHaveLength(0);
  });

  test('verifies Merge PDF works cleanly with local worker and no unpkg.com calls', async ({ page }) => {
    const networkUrls: string[] = [];
    const cspErrors: string[] = [];

    page.on('request', (req) => {
      networkUrls.push(req.url());
    });

    page.on('console', (msg) => {
      const text = msg.text();
      if (/Content Security Policy/i.test(text) || /violates the following Content Security Policy/i.test(text)) {
        cspErrors.push(text);
      }
    });

    const response = await page.goto('/tools/merge-pdf', { waitUntil: 'networkidle' });
    expect(response!.status()).toBe(200);

    const pdf1 = path.join(process.cwd(), 'tests', 'fixtures', 'sample-1page.pdf');
    const pdf2 = path.join(process.cwd(), 'tests', 'fixtures', 'sample-2pages.pdf');
    const fileInput = page.locator('#merge-pdf-file-input');
    await fileInput.setInputFiles([pdf1, pdf2]);

    const mergeBtn = page.getByRole('button', { name: /Merge 2 PDFs/i });
    await expect(mergeBtn).toBeVisible({ timeout: 10000 });
    await mergeBtn.click();

    await expect(page.getByText('PDFs Merged Successfully')).toBeVisible({ timeout: 15000 });
    const downloadBtn = page.getByRole('button', { name: /Download Merged PDF/i });
    await expect(downloadBtn).toBeVisible();

    const unpkgRequests = networkUrls.filter((url) => url.includes('unpkg.com'));
    expect(unpkgRequests).toHaveLength(0);

    const localWorkerRequests = networkUrls.filter((url) => url.includes('/vendor/pdfjs/pdf.worker.min.mjs'));
    expect(localWorkerRequests.length).toBeGreaterThanOrEqual(1);

    expect(cspErrors).toHaveLength(0);
  });

  test('verifies public homepage, blog, and admin login render with zero CSP violations', async ({ page }) => {
    const cspErrors: string[] = [];
    page.on('console', (msg) => {
      const text = msg.text();
      if (/Content Security Policy/i.test(text) || /violates the following Content Security Policy/i.test(text)) {
        cspErrors.push(text);
      }
    });

    // Check Homepage
    let res = await page.goto('/', { waitUntil: 'networkidle' });
    expect(res!.status()).toBe(200);
    expect(res!.headers()['content-security-policy']).toBeDefined();

    // Check Blog
    res = await page.goto('/blog', { waitUntil: 'networkidle' });
    expect(res!.status()).toBe(200);
    expect(res!.headers()['content-security-policy']).toBeDefined();

    // Check Admin Login
    res = await page.goto('/admin/login', { waitUntil: 'networkidle' });
    expect(res!.status()).toBe(200);
    expect(res!.headers()['content-security-policy']).toBeDefined();

    expect(cspErrors).toHaveLength(0);
  });
});
