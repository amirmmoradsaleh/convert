import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { configurePdfJsWorker, PDFJS_WORKER_LOCAL_PATH, loadPdfDocument } from '@/engines/pdf/loader';
import * as pdfjsLib from 'pdfjs-dist';

describe('SEC-01 — Global HTTP Security Headers', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('configures all required security headers for all routes in next.config.ts', async () => {
    const nextConfigModule = await import('../../next.config');
    const nextConfig = nextConfigModule.default;
    expect(nextConfig.headers).toBeTypeOf('function');
    if (!nextConfig.headers) {
      throw new Error('nextConfig.headers is not defined');
    }

    const headersConfig = await nextConfig.headers();
    expect(Array.isArray(headersConfig)).toBe(true);

    const globalRule = headersConfig.find((r) => r.source === '/:path*');
    expect(globalRule).toBeDefined();
    if (!globalRule) {
      throw new Error('Global rule /:path* not found in headers configuration');
    }

    const headersMap = new Map(globalRule.headers.map((h) => [h.key, h.value]));

    // 1. X-Content-Type-Options
    expect(headersMap.get('X-Content-Type-Options')).toBe('nosniff');

    // 2. Referrer-Policy
    expect(headersMap.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');

    // 3. X-Frame-Options
    expect(headersMap.get('X-Frame-Options')).toBe('SAMEORIGIN');

    // 4. Content-Security-Policy
    const csp = headersMap.get('Content-Security-Policy');
    expect(csp).toBeDefined();
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("script-src 'self' 'unsafe-inline'");
    expect(csp).toContain("style-src 'self' 'unsafe-inline'");
    expect(csp).toContain("img-src 'self' data: blob:");
    expect(csp).toContain("font-src 'self' data:");
    expect(csp).toContain("connect-src 'self'");
    expect(csp).toContain("worker-src 'self' blob:");
    expect(csp).toContain("frame-ancestors 'self'");
    expect(csp).toContain("form-action 'self'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("object-src 'none'");

    // Strictly ensure dangerous or loose directives are NOT present
    expect(csp).not.toContain("'unsafe-eval'");
    expect(csp).not.toContain('unpkg.com');
    expect(csp).not.toContain('*');
  });

  it('enforces HSTS only in production environment and excludes includeSubDomains / preload', async () => {
    // Test development environment (no HSTS)
    (process.env as Record<string, string | undefined>).NODE_ENV = 'development';
    const devConfigModule = await import('../../next.config');
    const devConfig = devConfigModule.default;
    if (!devConfig.headers) {
      throw new Error('devConfig.headers is not defined');
    }
    const devHeaders = await devConfig.headers();
    const devGlobal = devHeaders.find((r) => r.source === '/:path*');
    expect(devGlobal).toBeDefined();
    if (!devGlobal) {
      throw new Error('devGlobal rule /:path* not found');
    }
    const devMap = new Map(devGlobal.headers.map((h) => [h.key, h.value]));
    expect(devMap.has('Strict-Transport-Security')).toBe(false);

    // Test production environment (HSTS enabled with exact max-age=31536000)
    vi.resetModules();
    (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
    const prodConfigModule = await import('../../next.config');
    const prodConfig = prodConfigModule.default;
    if (!prodConfig.headers) {
      throw new Error('prodConfig.headers is not defined');
    }
    const prodHeaders = await prodConfig.headers();
    const prodGlobal = prodHeaders.find((r) => r.source === '/:path*');
    expect(prodGlobal).toBeDefined();
    if (!prodGlobal) {
      throw new Error('prodGlobal rule /:path* not found');
    }
    const prodMap = new Map(prodGlobal.headers.map((h) => [h.key, h.value]));
    expect(prodMap.get('Strict-Transport-Security')).toBe('max-age=31536000');
    expect(prodMap.get('Strict-Transport-Security')).not.toContain('includeSubDomains');
    expect(prodMap.get('Strict-Transport-Security')).not.toContain('preload');
  });
});

describe('SEC-02 — Serve PDF.js Worker Locally', () => {
  const rootDir = process.cwd();
  const packageJsonPath = path.join(rootDir, 'node_modules', 'pdfjs-dist', 'package.json');
  const sourceWorkerPath = path.join(rootDir, 'node_modules', 'pdfjs-dist', 'build', 'pdf.worker.min.mjs');
  const publicWorkerPath = path.join(rootDir, 'public', 'vendor', 'pdfjs', 'pdf.worker.min.mjs');

  it('defines a same-origin local worker path and has zero references to unpkg.com', () => {
    expect(PDFJS_WORKER_LOCAL_PATH).toBe('/vendor/pdfjs/pdf.worker.min.mjs');
    expect(PDFJS_WORKER_LOCAL_PATH.startsWith('/')).toBe(true);
    expect(PDFJS_WORKER_LOCAL_PATH).not.toContain('http://');
    expect(PDFJS_WORKER_LOCAL_PATH).not.toContain('https://');
    expect(PDFJS_WORKER_LOCAL_PATH).not.toContain('unpkg.com');

    // Inspect engines/pdf/loader.ts source directly
    const loaderSource = fs.readFileSync(path.join(rootDir, 'engines', 'pdf', 'loader.ts'), 'utf8');
    expect(loaderSource).not.toContain('unpkg.com');
    expect(loaderSource).toContain(PDFJS_WORKER_LOCAL_PATH);
  });

  it('configures PDF.js GlobalWorkerOptions to use the local same-origin path in browser environment', () => {
    const originalWindow = (global as any).window;
    const originalWorkerSrc = pdfjsLib.GlobalWorkerOptions.workerSrc;
    try {
      (global as any).window = {};
      pdfjsLib.GlobalWorkerOptions.workerSrc = '';
      configurePdfJsWorker();
      expect(pdfjsLib.GlobalWorkerOptions.workerSrc).toBe('/vendor/pdfjs/pdf.worker.min.mjs');
    } finally {
      (global as any).window = originalWindow;
      pdfjsLib.GlobalWorkerOptions.workerSrc = originalWorkerSrc;
    }
  });

  it('verifies the local worker file exists, matches package version, and is bit-for-bit identical to installed package', () => {
    expect(fs.existsSync(publicWorkerPath)).toBe(true);
    expect(fs.existsSync(sourceWorkerPath)).toBe(true);

    const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    expect(pkg.version).toBe('6.3.289');

    const sourceBuf = fs.readFileSync(sourceWorkerPath);
    const publicBuf = fs.readFileSync(publicWorkerPath);

    expect(publicBuf.length).toBe(sourceBuf.length);
    const sourceHash = crypto.createHash('sha256').update(sourceBuf).digest('hex');
    const publicHash = crypto.createHash('sha256').update(publicBuf).digest('hex');
    expect(publicHash).toBe(sourceHash);
  });

  it('initializes PDF.js and loads a document successfully using loadPdfDocument', async () => {
    const { PDFDocument, rgb } = await import('pdf-lib');
    const doc = await PDFDocument.create();
    const page = doc.addPage([300, 400]);
    page.drawText('Security Test PDF', { x: 20, y: 350, size: 14, color: rgb(0, 0, 0) });
    const bytes = await doc.save();
    const safeBuffer = new Uint8Array(bytes).buffer;
    const file = new File([safeBuffer], 'test.pdf', { type: 'application/pdf' });

    const loaded = await loadPdfDocument(file);
    expect(loaded).toBeDefined();
    expect(loaded.pageCount).toBe(1);
    expect(loaded.pdfDoc).toBeDefined();
  });
});
