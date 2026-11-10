import { describe, it, expect } from 'vitest';
import {
  normalizeBlock,
  duplicateBlock,
  UniversalContentBlock,
} from '../../lib/cms/blocks';
import {
  sanitizeCustomHtml,
  validateAndSanitizeBlock,
} from '../../lib/admin/validation';
import {
  serializeBlockPayload,
  deserializeBlockPayload,
  checkBlockDestinationCompatibility,
  getBlockLabel,
} from '../../lib/cms/block-clipboard';

describe('Phase 12.1-D: Custom HTML CMS Block Architecture & Security', () => {
  describe('Block System & Type Normalization', () => {
    it('normalizes custom_html blocks preserving content.html and mirroring to root', () => {
      const rawBlock: UniversalContentBlock = {
        id: 'block-html-1',
        type: 'custom_html',
        order: 1,
        enabled: true,
        content: {
          html: '<div class="banner"><h3>Special Offer</h3><p>Use code SAVE20</p></div>',
          caption: 'Promotional announcement banner',
        },
      };

      const normalized = normalizeBlock(rawBlock);

      expect(normalized.type).toBe('custom_html');
      expect(normalized.id).toBe('block-html-1');
      expect(normalized.content.html).toContain('Special Offer');
      expect(normalized.content.caption).toBe('Promotional announcement banner');
      expect((normalized as any).html).toContain('Special Offer');
      expect((normalized as any).caption).toBe('Promotional announcement banner');
    });

    it('handles legacy flat custom_html structure by nesting into content object', () => {
      const legacyBlock: any = {
        id: 'legacy-html-2',
        type: 'custom_html',
        order: 2,
        enabled: true,
        html: '<section class="info-box"><h4>Quick Tip</h4></section>',
        caption: 'Tip box',
      };

      const normalized = normalizeBlock(legacyBlock);

      expect(normalized.content.html).toBe('<section class="info-box"><h4>Quick Tip</h4></section>');
      expect(normalized.content.caption).toBe('Tip box');
    });

    it('duplicates custom_html blocks with fresh identifiers and preserved content', () => {
      const original: UniversalContentBlock = {
        id: 'orig-html-123',
        type: 'custom_html',
        order: 5,
        enabled: true,
        content: {
          html: '<div class="p-4 bg-emerald-50 rounded">Success Alert</div>',
          caption: 'Duplication test',
        },
      };

      const duplicated = duplicateBlock(original);

      expect(duplicated.id).not.toBe(original.id);
      expect(duplicated.id).toMatch(/^blk-[a-z0-9]+$/);
      expect(duplicated.type).toBe('custom_html');
      expect(duplicated.content.html).toBe(original.content.html);
      expect(duplicated.content.caption).toBe(original.content.caption);
    });

    it('returns human-readable label "Custom HTML" in getBlockLabel', () => {
      expect(getBlockLabel('custom_html')).toBe('Custom HTML');
    });
  });

  describe('HTML Sanitization (sanitizeCustomHtml)', () => {
    it('preserves safe structural and semantic HTML tags and styling', () => {
      const safeInput = `
        <div class="max-w-2xl mx-auto p-6 bg-slate-50 border border-slate-200 rounded-2xl shadow-sm">
          <h2 class="text-2xl font-bold text-slate-900 mb-3">Enterprise Conversion Hub</h2>
          <p class="text-sm text-slate-600 leading-relaxed">
            High performance browser conversion engine supporting <strong>25+ formats</strong>.
          </p>
          <ul class="mt-4 space-y-2 list-disc list-inside">
            <li class="text-xs text-slate-700">Zero cloud uploads</li>
            <li class="text-xs text-slate-700">Client-side WebAssembly execution</li>
          </ul>
          <div class="mt-6">
            <a href="https://example.com/pricing" class="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-semibold" target="_blank" rel="noopener">
              View Plans
            </a>
          </div>
        </div>
      `;

      const sanitized = sanitizeCustomHtml(safeInput);

      expect(sanitized).toContain('<div class="max-w-2xl');
      expect(sanitized).toContain('Enterprise Conversion Hub');
      expect(sanitized).toContain('<strong>25+ formats</strong>');
      expect(sanitized).toContain('Zero cloud uploads');
      expect(sanitized).toContain('href="https://example.com/pricing"');
    });

    it('strips <script> tags and enclosed executable code completely', () => {
      const malicious = '<p>Normal text</p><script>alert("XSS Attack!");</script><span>Trailing text</span>';
      const result = sanitizeCustomHtml(malicious);

      expect(result).not.toContain('<script');
      expect(result).not.toContain('</script>');
      expect(result).not.toContain('alert');
      expect(result).toContain('<p>Normal text</p>');
      expect(result).toContain('<span>Trailing text</span>');
    });

    it('prevents nested/recursive tag evasion attacks (<scr<script>ipt>)', () => {
      const evasion = '<p>Hello</p><scr<script>ipt>alert(document.cookie)</script>World';
      const result = sanitizeCustomHtml(evasion);

      expect(result).not.toContain('<script');
      expect(result).not.toContain('alert');
      expect(result).not.toContain('document.cookie');
    });

    it('strips dangerous embedded elements: iframe, object, embed, applet, form, input, button', () => {
      const maliciousEmbeds = `
        <div>Content</div>
        <iframe src="https://evil.com/phish"></iframe>
        <object data="malicious.swf"></object>
        <embed src="exploit.pdf"></embed>
        <form action="/api/admin/delete" method="POST">
          <input type="text" name="data" value="bad" />
          <button type="submit">Submit</button>
        </form>
      `;

      const result = sanitizeCustomHtml(maliciousEmbeds);

      expect(result).not.toContain('<iframe');
      expect(result).not.toContain('<object');
      expect(result).not.toContain('<embed');
      expect(result).not.toContain('<form');
      expect(result).not.toContain('<input');
      expect(result).not.toContain('<button');
      expect(result).toContain('<div>Content</div>');
    });

    it('strips style tags to prevent layout hijacking and CSS exfiltration', () => {
      const stylePayload = '<style>body { display: none !important; }</style><p>Content</p>';
      const result = sanitizeCustomHtml(stylePayload);

      expect(result).not.toContain('<style');
      expect(result).not.toContain('display: none');
      expect(result).toContain('<p>Content</p>');
    });

    it('strips HTML comments and CDATA sections', () => {
      const commentPayload = '<div><!-- Hidden comment with secrets --><p>Clean</p></div>';
      const result = sanitizeCustomHtml(commentPayload);

      expect(result).not.toContain('Hidden comment');
      expect(result).toContain('<p>Clean</p>');
    });

    it('strips inline event handlers (onclick, onload, onerror, etc.)', () => {
      const eventHandlers = `
        <div onclick="doEvil()" onmouseover="stealTokens()">Hover me</div>
        <img src="/images/logo.png" onerror="alert(1)" onload="evilLoad()" alt="Logo" />
        <a href="#" onfocus="stealFocus()">Link</a>
      `;

      const result = sanitizeCustomHtml(eventHandlers);

      expect(result).not.toContain('onclick');
      expect(result).not.toContain('onmouseover');
      expect(result).not.toContain('onerror');
      expect(result).not.toContain('onload');
      expect(result).not.toContain('onfocus');
      expect(result).not.toContain('doEvil');
      expect(result).not.toContain('stealTokens');
      expect(result).toContain('alt="Logo"');
      expect(result).toContain('src="/images/logo.png"');
    });

    it('neutralizes javascript:, vbscript:, and data: schemes in href and src attributes', () => {
      const unsafeUrls = `
        <a href="javascript:alert(1)">Click for free gift</a>
        <a href="JAVASCRIPT:alert(2)">Uppercase scheme</a>
        <a href="vbscript:msgbox(1)">VBScript link</a>
        <a href="data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==">Data URI</a>
        <a href="/valid-internal-page">Safe Internal</a>
        <a href="https://example.com/safe">Safe External</a>
      `;

      const result = sanitizeCustomHtml(unsafeUrls);

      expect(result).not.toContain('javascript:alert(1)');
      expect(result).not.toContain('JAVASCRIPT:alert(2)');
      expect(result).not.toContain('vbscript:msgbox(1)');
      expect(result).not.toContain('data:text/html');
      expect(result).toContain('href="#"');
      expect(result).toContain('href="/valid-internal-page"');
      expect(result).toContain('href="https://example.com/safe"');
    });

    it('neutralizes entity-encoded javascript schemes (e.g. &#106;avascript:)', () => {
      const encodedPayload = '<a href="&#106;avascript:alert(document.domain)">Encoded JS</a>';
      const result = sanitizeCustomHtml(encodedPayload);

      expect(result).not.toContain('javascript');
      expect(result).not.toContain('alert');
      expect(result).toContain('href="#"');
    });
  });

  describe('Validation Service Integration (validateAndSanitizeBlock)', () => {
    it('accepts valid custom_html blocks and sanitizes them', () => {
      const block: UniversalContentBlock = {
        id: 'valid-html-1',
        type: 'custom_html',
        order: 1,
        enabled: true,
        content: {
          html: '<div class="card"><h4>Card Title</h4><p>Details here.</p></div>',
          caption: 'Informational card',
        },
      };

      const result = validateAndSanitizeBlock(block);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.sanitizedBlock.type).toBe('custom_html');
      expect(result.sanitizedBlock.content.html).toContain('Card Title');
      expect(result.sanitizedBlock.content.caption).toBe('Informational card');
    });

    it('sanitizes malicious markup embedded in custom_html during block validation', () => {
      const maliciousBlock: UniversalContentBlock = {
        id: 'mal-html-1',
        type: 'custom_html',
        order: 2,
        enabled: true,
        content: {
          html: '<div>Safe</div><script>document.location="http://evil.com"</script>',
          caption: 'Bad block',
        },
      };

      const result = validateAndSanitizeBlock(maliciousBlock);

      expect(result.isValid).toBe(true);
      expect(result.sanitizedBlock.content.html).not.toContain('<script');
      expect(result.sanitizedBlock.content.html).not.toContain('evil.com');
      expect(result.sanitizedBlock.content.html).toContain('Safe');
    });

    it('rejects custom_html blocks exceeding 200,000 characters', () => {
      const hugeBlock: UniversalContentBlock = {
        id: 'huge-html-1',
        type: 'custom_html',
        order: 3,
        enabled: true,
        content: {
          html: '<div>' + 'A'.repeat(200005) + '</div>',
        },
      };

      const result = validateAndSanitizeBlock(hugeBlock);

      expect(result.isValid).toBe(false);
      expect(result.errors.some((err) => err.includes('200KB'))).toBe(true);
    });

    it('rejects custom_html blocks where html content is not a string', () => {
      const invalidTypeBlock: any = {
        id: 'invalid-type-1',
        type: 'custom_html',
        order: 4,
        enabled: true,
        content: {
          html: 12345,
        },
      };

      const result = validateAndSanitizeBlock(invalidTypeBlock);

      expect(result.isValid).toBe(false);
      expect(result.errors.some((err) => err.includes('must be a string'))).toBe(true);
    });
  });

  describe('Cross-Page Copy & Paste Universal Compatibility', () => {
    it('confirms custom_html is universally compatible with page, home, and tool destinations', () => {
      const homeCheck = checkBlockDestinationCompatibility('custom_html', 'home');
      const pageCheck = checkBlockDestinationCompatibility('custom_html', 'page');
      const toolCheck = checkBlockDestinationCompatibility('custom_html', 'tool');

      expect(homeCheck.compatible).toBe(true);
      expect(pageCheck.compatible).toBe(true);
      expect(toolCheck.compatible).toBe(true);
    });

    it('round-trip serializes and deserializes custom_html block payloads across page boundaries', () => {
      const sourceBlock: UniversalContentBlock = {
        id: 'source-html-999',
        type: 'custom_html',
        order: 4,
        enabled: true,
        content: {
          html: '<aside class="p-4 bg-amber-50 border-amber-200"><strong>Note:</strong> Fast and secure.</aside>',
          caption: 'Callout note',
        },
      };

      // 1. Serialize from source page
      const serialized = serializeBlockPayload(sourceBlock);

      expect(serialized.format).toBe('convert24/cms-block');
      expect(serialized.type).toBe('custom_html');
      expect(serialized.content.html).toContain('Fast and secure.');
      expect(serialized.metadata?.sourceType).toBe('custom_html');

      // 2. Deserialize onto a different destination page (e.g. tool landing page)
      const deserialized = deserializeBlockPayload(serialized, 'tool', 7);

      expect(deserialized.success).toBe(true);
      expect(deserialized.block).toBeDefined();

      const pastedBlock = deserialized.block!;
      expect(pastedBlock.id).not.toBe('source-html-999');
      expect(pastedBlock.type).toBe('custom_html');
      expect(pastedBlock.order).toBe(7);
      expect(pastedBlock.content.html).toBe(sourceBlock.content.html);
      expect(pastedBlock.content.caption).toBe(sourceBlock.content.caption);
    });
  });
});
