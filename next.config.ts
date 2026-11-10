import type { NextConfig } from 'next';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

function ensurePdfWorker(): void {
  try {
    const src = path.join(process.cwd(), 'node_modules', 'pdfjs-dist', 'build', 'pdf.worker.min.mjs');
    const destDir = path.join(process.cwd(), 'public', 'vendor', 'pdfjs');
    const dest = path.join(destDir, 'pdf.worker.min.mjs');

    if (!fs.existsSync(src)) return;

    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }

    if (fs.existsSync(dest)) {
      const srcHash = crypto.createHash('sha256').update(fs.readFileSync(src)).digest('hex');
      const destHash = crypto.createHash('sha256').update(fs.readFileSync(dest)).digest('hex');
      if (srcHash === destHash) return;
    }

    fs.copyFileSync(src, dest);
  } catch {
    // Non-fatal if read-only filesystem or build step handles it
  }
}

ensurePdfWorker();

function sanitizeEnvVar(value?: string, prefix?: string): string | undefined {
  if (!value) return undefined;
  let val = value.trim();
  if (prefix && val.startsWith(prefix)) {
    val = val.substring(prefix.length).trim();
  }
  if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
    val = val.substring(1, val.length - 1).trim();
  }
  return val || undefined;
}

if (process.env.DATABASE_URL) {
  process.env.DATABASE_URL = sanitizeEnvVar(process.env.DATABASE_URL, 'DATABASE_URL=') || process.env.DATABASE_URL;
}

if (process.env.ADMIN_JWT_SECRET) {
  process.env.ADMIN_JWT_SECRET = sanitizeEnvVar(process.env.ADMIN_JWT_SECRET, 'JWT_SECRET=') || process.env.ADMIN_JWT_SECRET;
}

if (process.argv.includes('build')) {
  (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    const isProd = process.env.NODE_ENV === 'production';
    const securityHeaders = [
      {
        key: 'X-Content-Type-Options',
        value: 'nosniff',
      },
      {
        key: 'Referrer-Policy',
        value: 'strict-origin-when-cross-origin',
      },
      {
        key: 'X-Frame-Options',
        value: 'SAMEORIGIN',
      },
      {
        key: 'Content-Security-Policy',
        value: [
          "default-src 'self'",
          "script-src 'self' 'unsafe-inline'",
          "style-src 'self' 'unsafe-inline'",
          "img-src 'self' data: blob:",
          "font-src 'self' data:",
          "connect-src 'self'",
          "worker-src 'self' blob:",
          "frame-ancestors 'self'",
          "form-action 'self'",
          "base-uri 'self'",
          "object-src 'none'",
        ].join('; '),
      },
    ];

    if (isProd) {
      securityHeaders.push({
        key: 'Strict-Transport-Security',
        value: 'max-age=31536000',
      });
    }

    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
