import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  serializeBlockPayload,
  deserializeBlockPayload,
  checkBlockDestinationCompatibility,
  copyBlockToClipboard,
  pasteBlockFromClipboard,
  getClipboardState,
  clearBlockClipboard,
  BLOCK_CLIPBOARD_FORMAT,
  BLOCK_CLIPBOARD_VERSION,
  CLIPBOARD_STORAGE_KEY,
  CLIPBOARD_EVENT_NAME,
  getBlockLabel,
} from '../../lib/cms/block-clipboard';
import { UniversalContentBlock } from '../../lib/cms/blocks';

describe('Phase 12.1-C: Cross-Page CMS Block Copy & Paste', () => {
  beforeEach(() => {
    // Clear storage before each test
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.clear();
    }
    vi.restoreAllMocks();
  });

  describe('Block Serialization & Metadata Stripping', () => {
    it('serializes a CMS block into a versioned convert24/cms-block payload', () => {
      const sourceBlock: UniversalContentBlock = {
        id: 'block-12345',
        type: 'cta',
        order: 3,
        enabled: true,
        content: {
          title: 'Specialized Online Converter',
          description: 'Browser-based file conversion tools with 100% privacy.',
          buttonText: 'Try Converter',
          label: 'Try Converter',
          href: '/tools/jpg-to-png',
          variant: 'primary',
          secondaryLabel: 'All Tools',
          secondaryHref: '/#explore-hubs',
        },
      };

      const payload = serializeBlockPayload(sourceBlock);

      expect(payload.format).toBe(BLOCK_CLIPBOARD_FORMAT);
      expect(payload.version).toBe(BLOCK_CLIPBOARD_VERSION);
      expect(payload.type).toBe('cta');
      expect(payload.content?.title).toBe('Specialized Online Converter');
      expect(payload.metadata?.copiedAt).toBeDefined();
      expect(payload.metadata?.sourceType).toBe('cta');
    });

    it('strips existing database identifiers, page IDs, and audit timestamps from payload', () => {
      const sourceBlockWithDbProps: any = {
        id: 'orig-db-uuid-8899',
        pageId: 'page-about-c24',
        authorId: 'user-admin-1',
        revisionId: 'rev-001',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-02T00:00:00Z',
        type: 'feature',
        order: 5,
        enabled: true,
        content: {
          id: 'nested-should-be-removed',
          pageId: 'page-nested',
          title: 'Local Browser Sandboxing',
          description: 'Data never leaves your browser.',
          icon: 'ShieldCheck',
        },
      };

      const payload = serializeBlockPayload(sourceBlockWithDbProps);

      expect((payload as any).id).toBeUndefined();
      expect((payload as any).pageId).toBeUndefined();
      expect((payload as any).authorId).toBeUndefined();
      expect((payload as any).revisionId).toBeUndefined();
      expect(payload.content.id).toBeUndefined();
      expect(payload.content.pageId).toBeUndefined();
      expect(payload.type).toBe('feature');
      expect(payload.content?.title).toBe('Local Browser Sandboxing');
    });

    it('handles legacy root-level block properties by normalizing them into content', () => {
      const legacyBlock: any = {
        id: 'legacy-head-1',
        type: 'heading',
        text: 'Legacy Heading Text',
        level: 2,
        order: 1,
      };

      const payload = serializeBlockPayload(legacyBlock);
      expect(payload.content?.text).toBe('Legacy Heading Text');
      expect(payload.content?.level).toBe(2);
      expect((payload as any).id).toBeUndefined();
    });
  });

  describe('Block Deserialization & Fresh Instance Generation', () => {
    it('deserializes a valid payload, generating a fresh unique block ID', () => {
      const sourceBlock: UniversalContentBlock = {
        id: 'orig-id-1',
        type: 'faq',
        order: 2,
        enabled: true,
        content: {
          question: 'Is my data secure?',
          answer: 'All processing takes place in your local browser sandbox.',
        },
      };

      const payload = serializeBlockPayload(sourceBlock);
      const res = deserializeBlockPayload(payload, 'page', 4);

      expect(res.success).toBe(true);
      expect(res.block).toBeDefined();

      const deserialized = res.block!;
      expect(deserialized.id).toBeDefined();
      expect(deserialized.id).not.toBe('orig-id-1');
      expect(deserialized.id.startsWith('blk-')).toBe(true);
      expect(deserialized.type).toBe('faq');
      expect(deserialized.order).toBe(4);
      expect(deserialized.enabled).toBe(true);
      expect(deserialized.content?.question).toBe('Is my data secure?');
      expect(deserialized.content?.answer).toContain('local browser sandbox');
    });

    it('creates an independent deep-clone so mutating the pasted block does not affect source', () => {
      const sourceBlock: UniversalContentBlock = {
        id: 'faq-list-1',
        type: 'faq',
        enabled: true,
        order: 1,
        content: {
          heading: 'Original FAQ Heading',
          items: [
            { id: 'q1', question: 'Question 1', answer: 'Answer 1' },
            { id: 'q2', question: 'Question 2', answer: 'Answer 2' },
          ],
        },
      };

      const payload = serializeBlockPayload(sourceBlock);
      const res = deserializeBlockPayload(payload, 'page', 1);
      expect(res.success).toBe(true);
      const pasted = res.block!;

      // Mutate pasted block
      pasted.content.heading = 'Pasted Mutated Heading';
      pasted.content.items[0].question = 'Mutated Question 1';

      // Original block should remain unaffected
      expect(sourceBlock.content.heading).toBe('Original FAQ Heading');
      expect(sourceBlock.content.items[0].question).toBe('Question 1');
    });

    it('rejects payloads with wrong format or unsupported version', () => {
      const invalidFormat = {
        format: 'unsupported/random-format',
        version: 1,
        type: 'paragraph',
        content: { text: 'Hello' },
      };

      const resFormat = deserializeBlockPayload(invalidFormat as any, 'page');
      expect(resFormat.success).toBe(false);
      expect(resFormat.error).toMatch(/unrecognized clipboard format/i);

      const invalidVersion = {
        format: BLOCK_CLIPBOARD_FORMAT,
        version: 999,
        type: 'paragraph',
        content: { text: 'Hello' },
      };

      const resVersion = deserializeBlockPayload(invalidVersion as any, 'page');
      expect(resVersion.success).toBe(false);
      expect(resVersion.error).toMatch(/unsupported clipboard payload version/i);
    });

    it('rejects corrupted payloads missing block data or block type', () => {
      const resNull = deserializeBlockPayload(null, 'page');
      expect(resNull.success).toBe(false);
      expect(resNull.error).toMatch(/empty or not a valid object/i);

      const resEmpty = deserializeBlockPayload({}, 'page');
      expect(resEmpty.success).toBe(false);

      const resMissingType = deserializeBlockPayload(
        { format: BLOCK_CLIPBOARD_FORMAT, version: 1, type: '' as any },
        'page'
      );
      expect(resMissingType.success).toBe(false);
      expect(resMissingType.error).toMatch(/missing/i);
    });
  });

  describe('Destination Compatibility Validation', () => {
    it('allows universal content blocks on all page destinations (page, home, tool)', () => {
      const universalTypes = [
        'cta',
        'heading',
        'paragraph',
        'rich_text',
        'faq',
        'feature',
        'image',
        'link',
        'section',
      ];

      for (const type of universalTypes) {
        expect(checkBlockDestinationCompatibility(type, 'page').compatible).toBe(true);
        expect(checkBlockDestinationCompatibility(type, 'home').compatible).toBe(true);
        expect(checkBlockDestinationCompatibility(type, 'tool').compatible).toBe(true);
      }
    });

    it('disallows homepage-specific hubs and popular tools blocks on standard pages and tool pages', () => {
      const pageHubs = checkBlockDestinationCompatibility('hubs', 'page');
      expect(pageHubs.compatible).toBe(false);
      expect(pageHubs.reason).toContain('homepage tool directory');

      const toolHubs = checkBlockDestinationCompatibility('hubs', 'tool');
      expect(toolHubs.compatible).toBe(false);

      const pagePopular = checkBlockDestinationCompatibility('popular_tools', 'page');
      expect(pagePopular.compatible).toBe(false);

      const toolPopular = checkBlockDestinationCompatibility('popular_tools', 'tool');
      expect(toolPopular.compatible).toBe(false);
    });

    it('disallows pricing block on tool pages', () => {
      const toolPricing = checkBlockDestinationCompatibility('pricing', 'tool');
      expect(toolPricing.compatible).toBe(false);
      expect(toolPricing.reason).toContain('pricing tables');

      // But pricing is allowed on standard pages and homepage
      expect(checkBlockDestinationCompatibility('pricing', 'page').compatible).toBe(true);
      expect(checkBlockDestinationCompatibility('pricing', 'home').compatible).toBe(true);
    });

    it('disallows duplicate hero blocks on homepage', () => {
      const homeHero = checkBlockDestinationCompatibility('hero', 'home');
      expect(homeHero.compatible).toBe(false);
      expect(homeHero.reason).toContain('already contains a primary Hero');
    });

    it('returns compatibility error when attempting to deserialize an incompatible block', () => {
      const hubsPayload = serializeBlockPayload({
        id: 'hubs-1',
        type: 'hubs',
        enabled: true,
        order: 0,
        content: { heading: 'Explore All Hubs' },
      });

      const res = deserializeBlockPayload(hubsPayload, 'tool');
      expect(res.success).toBe(false);
      expect(res.error).toMatch(/specific to the homepage tool directory/i);
    });
  });

  describe('Security Sanitization & URL Safety during Paste', () => {
    it('sanitizes malicious script tags and inline event handlers in rich_text blocks during paste', () => {
      const maliciousBlock: UniversalContentBlock = {
        id: 'xss-blk',
        type: 'rich_text',
        enabled: true,
        order: 0,
        content: {
          html: '<p>Valid text</p><script>alert("pwned")</script><img src="x" onerror="stealCookies()"><a href="javascript:alert(1)">Click</a>',
        },
      };

      const payload = serializeBlockPayload(maliciousBlock);
      const res = deserializeBlockPayload(payload, 'page', 0);
      expect(res.success).toBe(true);
      const pasted = res.block!;

      expect(pasted.content.html).not.toContain('<script>');
      expect(pasted.content.html).not.toContain('stealCookies');
      expect(pasted.content.html).not.toContain('javascript:');
      expect(pasted.content.html).toContain('Valid text');
    });

    it('sanitizes javascript: and data: URLs in CTA buttons and link blocks', () => {
      const unsafeCta: UniversalContentBlock = {
        id: 'cta-unsafe',
        type: 'cta',
        enabled: true,
        order: 0,
        content: {
          title: 'Unsafe CTA',
          href: 'javascript:document.location="https://attacker.com"',
          secondaryHref: 'data:text/html,<script>alert(1)</script>',
        },
      };

      const payload = serializeBlockPayload(unsafeCta);
      const res = deserializeBlockPayload(payload, 'page', 0);
      expect(res.success).toBe(false);
      expect(res.error).toMatch(/unsafe/i);
    });

    it('preserves valid absolute and relative URLs in links and CTAs', () => {
      const safeCta: UniversalContentBlock = {
        id: 'cta-safe',
        type: 'cta',
        enabled: true,
        order: 0,
        content: {
          title: 'Safe CTA',
          href: '/tools/merge-pdf',
          secondaryHref: 'https://convert24.local/about',
        },
      };

      const payload = serializeBlockPayload(safeCta);
      const res = deserializeBlockPayload(payload, 'page', 0);
      expect(res.success).toBe(true);
      const pasted = res.block!;

      expect(pasted.content.href).toBe('/tools/merge-pdf');
      expect(pasted.content.secondaryHref).toBe('https://convert24.local/about');
    });
  });

  describe('Clipboard Fallback & Session Synchronization', () => {
    it('successfully copies to sessionStorage and updates clipboard state', async () => {
      // Mock sessionStorage
      const store: Record<string, string> = {};
      const mockStorage = {
        getItem: (k: string) => store[k] || null,
        setItem: (k: string, v: string) => {
          store[k] = v;
        },
        removeItem: (k: string) => {
          delete store[k];
        },
        clear: () => {
          Object.keys(store).forEach((k) => delete store[k]);
        },
      };
      if (typeof window === 'undefined') {
        Object.defineProperty(global, 'window', {
          value: { ...global, dispatchEvent: vi.fn() },
          writable: true,
        });
      } else if (!window.dispatchEvent) {
        (window as any).dispatchEvent = vi.fn();
      }
      Object.defineProperty(window, 'sessionStorage', { value: mockStorage, writable: true });

      const blockToCopy: UniversalContentBlock = {
        id: 'b-99',
        type: 'cta',
        enabled: true,
        order: 0,
        content: { title: 'Copy me' },
      };

      const copyRes = await copyBlockToClipboard(blockToCopy);
      expect(copyRes.success).toBe(true);

      const state = getClipboardState();
      expect(state.hasContent).toBe(true);
      expect(state.type).toBe('cta');
      expect(state.label).toBe('Call to Action');
    });

    it('pastes successfully from sessionStorage when navigator.clipboard is unavailable', async () => {
      const blockToCopy: UniversalContentBlock = {
        id: 'b-fallback-1',
        type: 'feature',
        enabled: true,
        order: 0,
        content: { title: 'Fallback Feature', description: 'Works without permissions' },
      };

      if (typeof window === 'undefined') {
        Object.defineProperty(global, 'window', {
          value: { ...global, dispatchEvent: vi.fn() },
          writable: true,
        });
      } else if (!window.dispatchEvent) {
        (window as any).dispatchEvent = vi.fn();
      }

      // Set navigator.clipboard to throw permission error
      Object.defineProperty(window, 'navigator', {
        value: {
          clipboard: {
            writeText: vi.fn().mockRejectedValue(new Error('Permission denied')),
            readText: vi.fn().mockRejectedValue(new Error('Permission denied')),
          },
        },
        writable: true,
      });

      const copyRes = await copyBlockToClipboard(blockToCopy);
      expect(copyRes.success).toBe(true);
      expect(copyRes.message).toContain('copied');

      // Paste should succeed using session storage fallback
      const pasteRes = await pasteBlockFromClipboard('page', 2);
      expect(pasteRes.success).toBe(true);
      expect(pasteRes.block).toBeDefined();
      expect(pasteRes.block?.type).toBe('feature');
      expect(pasteRes.block?.content?.title).toBe('Fallback Feature');
      expect(pasteRes.block?.id).not.toBe('b-fallback-1');
    });

    it('returns empty error when clipboard is empty', async () => {
      clearBlockClipboard();
      const state = getClipboardState();
      expect(state.hasContent).toBe(false);

      const pasteRes = await pasteBlockFromClipboard('page', 0);
      expect(pasteRes.success).toBe(false);
      expect(pasteRes.error).toContain('Clipboard is empty');
    });
  });
});
