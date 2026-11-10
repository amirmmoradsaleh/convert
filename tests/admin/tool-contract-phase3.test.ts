import { describe, it, expect } from 'vitest';
import {
  TOOL_CONTENT_CONTRACT_VERSION,
  TOOL_SEMANTIC_SECTIONS,
  CANONICAL_TOOL_BLOCK_ORDER,
  validateToolIntroBlock,
  validateToolHowToBlock,
  validateToolFeaturesBlock,
  validateToolSupportedFormatsBlock,
  validateToolUseCasesBlock,
  validateToolTechnicalDetailsBlock,
  validateToolPrivacyBlock,
  validateToolFaqBlock,
  validateToolRelatedToolsBlock,
  generateCanonicalToolContract,
  normalizeToolContractBlocks,
  sortToolBlocks,
} from '@/lib/cms/tool-contract';
import {
  resolveUnifiedSeo,
  buildCanonicalUrl,
  buildPageStructuredData,
  safeSerializeJsonLd,
  BLOCK_REGISTRY,
  getBlockDefinition,
  createDefaultBlock,
} from '@/lib/cms/unified-content';
import { normalizeBlock } from '@/lib/cms/blocks';
import { getToolBySlug, getAllTools } from '@/lib/tools';
import { siteConfig } from '@/lib/seo';

describe('Phase 3 — Stable Tool Content Contract & SEO Blueprint', () => {
  const sampleTool = getToolBySlug('jpg-to-png')!;

  // --------------------------------------------------------------------------
  // 1. Contract Specifications & Semantic Sections
  // --------------------------------------------------------------------------
  describe('1. Tool Content Contract Specification', () => {
    it('defines contract version 1.0.0', () => {
      expect(TOOL_CONTENT_CONTRACT_VERSION).toBe('1.0.0');
    });

    it('contains all 9 required semantic sections', () => {
      const required = [
        'intro',
        'how_to_use',
        'features',
        'supported_formats',
        'use_cases',
        'technical_details',
        'privacy_note',
        'faq',
        'related_tools',
      ];
      for (const section of required) {
        expect(TOOL_SEMANTIC_SECTIONS).toContain(section);
      }
      expect(TOOL_SEMANTIC_SECTIONS.length).toBe(9);
    });

    it('defines deterministic ordering indices for all block types', () => {
      expect(CANONICAL_TOOL_BLOCK_ORDER.hero).toBe(0);
      expect(CANONICAL_TOOL_BLOCK_ORDER.benefits_trust).toBe(1);
      expect(CANONICAL_TOOL_BLOCK_ORDER.intro).toBe(2);
      expect(CANONICAL_TOOL_BLOCK_ORDER.how_to_use).toBe(3);
      expect(CANONICAL_TOOL_BLOCK_ORDER.supported_formats).toBe(4);
      expect(CANONICAL_TOOL_BLOCK_ORDER.features).toBe(5);
      expect(CANONICAL_TOOL_BLOCK_ORDER.technical_details).toBe(6);
      expect(CANONICAL_TOOL_BLOCK_ORDER.privacy_note).toBe(7);
      expect(CANONICAL_TOOL_BLOCK_ORDER.use_cases).toBe(8);
      expect(CANONICAL_TOOL_BLOCK_ORDER.faq).toBe(9);
      expect(CANONICAL_TOOL_BLOCK_ORDER.related_tools).toBe(10);
      expect(CANONICAL_TOOL_BLOCK_ORDER.cta).toBe(11);
    });
  });

  // --------------------------------------------------------------------------
  // 2. Validation of Each Semantic Section
  // --------------------------------------------------------------------------
  describe('2. Semantic Section Validators', () => {
    it('validates and sanitizes Section 1: Intro block', () => {
      const hostile = {
        heading: 'Intro <script>alert("xss")</script>',
        text: 'Clean description text',
        html: '<p>Paragraph <script>bad()</script><b>bold</b></p>',
      };
      const res = validateToolIntroBlock(hostile, sampleTool);
      expect(res.valid).toBe(true);
      expect(res.sanitizedContent.heading).toBe('Intro');
      expect(res.sanitizedContent.text).toBe('Clean description text');
      expect(res.sanitizedContent.html).not.toContain('<script>');
      expect(res.sanitizedContent.html).toContain('<b>bold</b>');
    });

    it('falls back safely for Intro when content is empty', () => {
      const res = validateToolIntroBlock({}, sampleTool);
      expect(res.valid).toBe(true);
      expect(res.sanitizedContent.heading).toBe(`About ${sampleTool.name}`);
      expect(res.sanitizedContent.text).toBe(sampleTool.intro);
    });

    it('validates Section 2: How-To instructions and step items', () => {
      const raw = {
        heading: 'Custom Steps',
        items: [
          { title: 'Step One', description: 'Do first thing' },
          { title: 'Step Two', description: 'Do second thing' },
        ],
      };
      const res = validateToolHowToBlock(raw, sampleTool);
      expect(res.valid).toBe(true);
      expect(res.sanitizedContent.items.length).toBe(2);
      expect(res.sanitizedContent.items[0].title).toBe('Step One');
    });

    it('validates Section 3: Features block', () => {
      const raw = {
        heading: 'Powerful Features',
        items: [
          { title: 'Zero Uploads', description: 'Processes locally' },
          { title: 'Instant', description: 'Under 100ms' },
        ],
      };
      const res = validateToolFeaturesBlock(raw, sampleTool);
      expect(res.valid).toBe(true);
      expect(res.sanitizedContent.items.length).toBe(2);
    });

    it('validates Section 4: Supported Formats block', () => {
      const raw = {
        inputFormats: ['jpg', 'jpeg'],
        outputFormats: ['png'],
      };
      const res = validateToolSupportedFormatsBlock(raw, sampleTool);
      expect(res.valid).toBe(true);
      expect(res.sanitizedContent.inputFormats).toEqual(['JPG', 'JPEG']);
      expect(res.sanitizedContent.outputFormats).toEqual(['PNG']);
    });

    it('validates Section 5: Use Cases block', () => {
      const raw = {
        items: [
          { title: 'Web Publishing', description: 'Converting photos for blog images' },
        ],
      };
      const res = validateToolUseCasesBlock(raw, sampleTool);
      expect(res.valid).toBe(true);
      expect(res.sanitizedContent.items.length).toBe(1);
    });

    it('validates Section 6: Technical Details & Limitations block', () => {
      const res = validateToolTechnicalDetailsBlock({}, sampleTool);
      expect(res.valid).toBe(true);
      expect(res.sanitizedContent.specs.length).toBeGreaterThan(0);
      expect(res.sanitizedContent.limitations?.length).toBeGreaterThan(0);
    });

    it('validates Section 7: Privacy & Processing Information block', () => {
      const res = validateToolPrivacyBlock({}, sampleTool);
      expect(res.valid).toBe(true);
      expect(res.sanitizedContent.title).toBeTruthy();
      expect(res.sanitizedContent.bullets?.length).toBeGreaterThan(0);
    });

    it('validates Section 8: FAQ block and rejects empty items', () => {
      const raw = {
        items: [
          { question: 'Is it free?', answer: 'Yes, 100% free.' },
          { question: '', answer: 'invalid' },
        ],
      };
      const res = validateToolFaqBlock(raw, sampleTool);
      expect(res.valid).toBe(true);
      expect(res.sanitizedContent.items.length).toBe(1);
      expect(res.sanitizedContent.items[0].question).toBe('Is it free?');
    });

    it('validates Section 9: Related Tools and strictly discards invalid slugs', () => {
      const raw = {
        slugs: ['compress-image', 'fake-nonexistent-tool', 'png-to-jpg', 'malicious/injection'],
      };
      const res = validateToolRelatedToolsBlock(raw, sampleTool);
      expect(res.valid).toBe(true);
      expect(res.sanitizedContent.slugs).toContain('compress-image');
      expect(res.sanitizedContent.slugs).toContain('png-to-jpg');
      expect(res.sanitizedContent.slugs).not.toContain('fake-nonexistent-tool');
      expect(res.sanitizedContent.slugs).not.toContain('malicious/injection');
      expect(res.sanitizedContent.slugs).not.toContain(sampleTool.slug);
    });
  });

  // --------------------------------------------------------------------------
  // 3. Full Canonical Tool Contract Generation & Ordering
  // --------------------------------------------------------------------------
  describe('3. Canonical Tool Contract Generation & Ordering', () => {
    it('generates the complete contract for any registered tool without errors', () => {
      const blocks = generateCanonicalToolContract('jpg-to-png');
      expect(blocks.length).toBeGreaterThanOrEqual(8);

      const blockTypes = blocks.map((b) => b.type);
      expect(blockTypes).toContain('hero');
      expect(blockTypes).toContain('benefits_trust');
      expect(blockTypes).toContain('intro');
      expect(blockTypes).toContain('how_to_use');
      expect(blockTypes).toContain('supported_formats');
      expect(blockTypes).toContain('features');
      expect(blockTypes).toContain('technical_details');
      expect(blockTypes).toContain('privacy_note');
      expect(blockTypes).toContain('faq');
      expect(blockTypes).toContain('related_tools');
    });

    it('enforces deterministic ascending order of sections', () => {
      const blocks = generateCanonicalToolContract('jpg-to-png');
      for (let i = 0; i < blocks.length - 1; i++) {
        expect(blocks[i].order).toBeLessThanOrEqual(blocks[i + 1].order);
      }
    });

    it('downgrades user-submitted H1 heading blocks to H2 to prevent competing H1s', () => {
      const hostileBlocks = [
        {
          id: 'b1',
          type: 'heading',
          content: { level: 1, text: 'Competing H1 Tag' },
        },
      ];
      const normalized = normalizeToolContractBlocks(hostileBlocks, sampleTool);
      expect(normalized[0].content.level).toBe(2);
    });

    it('fails safely and gracefully on malformed or null blocks', () => {
      const malformed = [null, undefined, 42, 'string', {}, { type: 'unknown_dummy_block' }];
      const normalized = normalizeToolContractBlocks(malformed, sampleTool);
      expect(Array.isArray(normalized)).toBe(true);
      expect(normalized.length).toBe(2); // Non-object primitives dropped, 2 objects safely normalized
      expect(normalized[0].type).toBe('paragraph');
      expect(normalized[1].type).toBe('paragraph');
    });
  });

  // --------------------------------------------------------------------------
  // 4. Advanced SEO Rules, Precedence, and Safe Serialization
  // --------------------------------------------------------------------------
  describe('4. SEO Fallbacks, Precedence & Canonical Validation', () => {
    it('protects against empty string overrides unintentionally wiping out valid metadata', () => {
      const resolved = resolveUnifiedSeo({
        pageType: 'tool',
        slug: 'jpg-to-png',
        pageSeo: {
          seoTitle: '   ',
          metaDescription: '',
          ogTitle: '   ',
          ogDescription: '',
        },
        typeDefaults: {
          title: 'Canonical JPG to PNG Title',
          description: 'Canonical JPG to PNG Description',
        },
      });

      expect(resolved.title).toBe('Canonical JPG to PNG Title');
      expect(resolved.description).toBe('Canonical JPG to PNG Description');
      expect(resolved.openGraph?.title).toBe('Canonical JPG to PNG Title');
      expect(resolved.openGraph?.description).toBe('Canonical JPG to PNG Description');
    });

    it('protects draft preview pages with strict noindex, nofollow robots directives', () => {
      const resolved = resolveUnifiedSeo({
        pageType: 'tool',
        slug: 'jpg-to-png',
        preview: true,
        pageSeo: {
          robotsIndex: true, // Attempt to index
          robotsFollow: true,
        },
      });

      expect((resolved.robots as any)?.index).toBe(false);
      expect((resolved.robots as any)?.follow).toBe(false);
      expect((resolved.robots as any)?.googleBot?.index).toBe(false);
      expect((resolved.robots as any)?.googleBot?.follow).toBe(false);
    });

    it('strictly normalizes canonical URLs to configured site origin and rejects unsafe schemes', () => {
      expect(buildCanonicalUrl('javascript:alert(1)', '/tools/jpg-to-png')).toBe(
        `${siteConfig.url}/tools/jpg-to-png`
      );
      expect(buildCanonicalUrl('data:text/html,bad', '/tools/jpg-to-png')).toBe(
        `${siteConfig.url}/tools/jpg-to-png`
      );
      expect(buildCanonicalUrl('vbscript:msgbox(1)', '/tools/jpg-to-png')).toBe(
        `${siteConfig.url}/tools/jpg-to-png`
      );
      expect(buildCanonicalUrl('file:///etc/passwd', '/tools/jpg-to-png')).toBe(
        `${siteConfig.url}/tools/jpg-to-png`
      );
      expect(buildCanonicalUrl('/tools/jpg-to-png/')).toBe(
        `${siteConfig.url}/tools/jpg-to-png`
      );
    });

    it('generates structured data matching page types', () => {
      // 1. Tool page -> WebApplication
      const toolSchema = buildPageStructuredData({
        pageType: 'tool',
        slug: 'jpg-to-png',
        name: 'JPG to PNG',
        description: 'Convert JPG to PNG',
      });
      expect(toolSchema['@type']).toBe('WebApplication');
      expect(toolSchema.applicationCategory).toBe('UtilityApplication');

      // 2. Blog page -> BlogPosting
      const blogSchema = buildPageStructuredData({
        pageType: 'blog',
        slug: 'test-article',
        name: 'Sample Article',
      });
      expect(blogSchema['@type']).toBe('BlogPosting');

      // 3. Category / Format -> CollectionPage
      const formatSchema = buildPageStructuredData({
        pageType: 'format',
        slug: 'png',
        name: 'PNG Format Guide',
      });
      expect(formatSchema['@type']).toBe('CollectionPage');

      // 4. Home -> WebSite
      const homeSchema = buildPageStructuredData({
        pageType: 'home',
        slug: '',
        name: 'Convert24',
      });
      expect(homeSchema['@type']).toBe('WebSite');
    });

    it('safely serializes JSON-LD stripping script tags and HTML injection tokens', () => {
      const hostileData = {
        name: 'Safe Tool <script>alert("hack")</script>',
        tag: '</script><script>alert("pwned")</script>',
      };
      const serialized = safeSerializeJsonLd(hostileData);
      expect(serialized).not.toBeNull();
      expect(serialized).not.toContain('<script>');
      expect(serialized).not.toContain('</script>');
      expect(serialized).toContain('\\u003c');
      expect(serialized).toContain('\\u003e');
    });
  });

  // --------------------------------------------------------------------------
  // 5. Block Registry Expansion
  // --------------------------------------------------------------------------
  describe('5. Block Registry Expansion', () => {
    it('includes supported_formats and technical_details in BLOCK_REGISTRY', () => {
      expect(BLOCK_REGISTRY.supported_formats).toBeDefined();
      expect(BLOCK_REGISTRY.technical_details).toBeDefined();

      const formatDef = getBlockDefinition('supported_formats');
      expect(formatDef.category).toBe('conversion');

      const techDef = getBlockDefinition('technical_details');
      expect(techDef.category).toBe('conversion');
    });

    it('creates default blocks with proper type and content structure', () => {
      const formatBlock = createDefaultBlock('supported_formats', 4);
      expect(formatBlock.type).toBe('supported_formats');
      expect(formatBlock.order).toBe(4);
      expect(formatBlock.content.inputFormats).toBeDefined();

      const techBlock = createDefaultBlock('technical_details', 6);
      expect(techBlock.type).toBe('technical_details');
      expect(techBlock.order).toBe(6);
      expect(techBlock.content.specs).toBeDefined();
    });
  });
});
