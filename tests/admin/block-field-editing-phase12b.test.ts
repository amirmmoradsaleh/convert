import { describe, it, expect } from 'vitest';
import { normalizeBlock, UniversalContentBlock } from '../../lib/cms/blocks';
import { validateAndSanitizeBlock, isSafeUrl, sanitizeRichTextHtml } from '../../lib/admin/validation';

describe('Phase 12.1-B: Complete CMS Block Field Editing & Normalization', () => {
  describe('CTA Block Field Coverage and Persistence', () => {
    it('normalizes legacy CTA blocks with only label and href without losing fields', () => {
      const legacyBlock = {
        id: 'cta-legacy',
        type: 'cta',
        label: 'Get Started',
        href: '/tools',
        variant: 'primary',
      };

      const normalized = normalizeBlock(legacyBlock);
      expect(normalized.type).toBe('cta');
      expect(normalized.content?.label).toBe('Get Started');
      expect(normalized.content?.buttonText).toBe('Get Started');
      expect(normalized.content?.href).toBe('/tools');
      expect(normalized.content?.variant).toBe('primary');
      expect(normalized.content?.title).toBeUndefined();
      expect(normalized.content?.description).toBeUndefined();
    });

    it('preserves full CTA card fields: title, description, primary button, and secondary button', () => {
      const fullCtaBlock = {
        id: 'cta-full-1',
        type: 'cta',
        order: 1,
        enabled: true,
        content: {
          title: 'Need more file processing?',
          description: 'Convert24 offers dozens of free, fast, private online conversion and PDF tools.',
          buttonText: 'Explore More Converters',
          label: 'Explore More Converters',
          href: '/#explore-hubs',
          variant: 'primary',
          secondaryLabel: 'Learn More',
          secondaryHref: '/about',
        },
      };

      const normalized = normalizeBlock(fullCtaBlock);
      expect(normalized.content?.title).toBe('Need more file processing?');
      expect(normalized.content?.description).toContain('Convert24 offers dozens');
      expect(normalized.content?.buttonText).toBe('Explore More Converters');
      expect(normalized.content?.label).toBe('Explore More Converters');
      expect(normalized.content?.href).toBe('/#explore-hubs');
      expect(normalized.content?.variant).toBe('primary');
      expect(normalized.content?.secondaryLabel).toBe('Learn More');
      expect(normalized.content?.secondaryHref).toBe('/about');

      // Root properties should also be mirrored for backward-compatibility
      expect(normalized.title).toBe('Need more file processing?');
      expect(normalized.description).toBe(fullCtaBlock.content.description);
      expect(normalized.buttonText).toBe('Explore More Converters');
      expect(normalized.secondaryLabel).toBe('Learn More');
      expect(normalized.secondaryHref).toBe('/about');
    });

    it('partial updates preserve existing fields without data loss', () => {
      const originalBlock: UniversalContentBlock = {
        id: 'cta-edit',
        type: 'cta',
        order: 2,
        enabled: true,
        content: {
          title: 'Initial Title',
          description: 'Initial Description',
          buttonText: 'Initial Button',
          href: '/initial',
          variant: 'secondary',
          secondaryLabel: 'Initial Secondary',
          secondaryHref: '/initial-secondary',
        },
      };

      // Simulating drawer editing where title and description are changed
      const updatedContent = {
        ...originalBlock.content,
        title: 'Updated Card Title',
        description: 'Updated Subtitle Description',
      };

      const savedBlock: UniversalContentBlock = {
        ...originalBlock,
        content: updatedContent,
        ...updatedContent,
      };

      const normalized = normalizeBlock(savedBlock);
      expect(normalized.content?.title).toBe('Updated Card Title');
      expect(normalized.content?.description).toBe('Updated Subtitle Description');
      // Existing button fields remain completely preserved
      expect(normalized.content?.buttonText).toBe('Initial Button');
      expect(normalized.content?.href).toBe('/initial');
      expect(normalized.content?.variant).toBe('secondary');
      expect(normalized.content?.secondaryLabel).toBe('Initial Secondary');
      expect(normalized.content?.secondaryHref).toBe('/initial-secondary');
    });

    it('validates safe and unsafe URLs on CTA buttons', () => {
      const validCta = {
        id: 'cta-val-1',
        type: 'cta',
        content: {
          title: 'Convert Now',
          href: '/tools/compress-pdf',
          secondaryHref: 'https://convert24.com/privacy',
        },
      };
      const validResult = validateAndSanitizeBlock(validCta);
      expect(validResult.isValid).toBe(true);

      const unsafePrimaryCta = {
        id: 'cta-val-2',
        type: 'cta',
        content: {
          title: 'Exploit Title',
          href: 'javascript:alert(document.domain)',
        },
      };
      const unsafePrimaryResult = validateAndSanitizeBlock(unsafePrimaryCta);
      expect(unsafePrimaryResult.isValid).toBe(false);
      expect(unsafePrimaryResult.error).toContain('Unsafe URL detected in cta');

      const unsafeSecondaryCta = {
        id: 'cta-val-3',
        type: 'cta',
        content: {
          title: 'Safe Primary, Unsafe Secondary',
          href: '/safe-url',
          secondaryHref: 'javascript:evil()',
        },
      };
      const unsafeSecondaryResult = validateAndSanitizeBlock(unsafeSecondaryCta);
      expect(unsafeSecondaryResult.isValid).toBe(false);
      expect(unsafeSecondaryResult.error).toContain('Unsafe secondary URL detected in cta');
    });
  });

  describe('Newly Exposed Blocks: Formats, Tech Specs, Benefits, Spacer', () => {
    it('normalizes and validates supported_formats block completely', () => {
      const formatBlock = {
        id: 'fmt-1',
        type: 'supported_formats',
        content: {
          heading: 'Supported Conversion Formats',
          description: 'We support all major image, document, and audio formats.',
          inputFormats: ['pdf', 'docx', 'png', 'jpg'],
          outputFormats: ['pdf', 'png', 'webp'],
          notes: 'Max file size 100MB per file.',
        },
      };

      const normalized = normalizeBlock(formatBlock);
      expect(normalized.content?.heading).toBe('Supported Conversion Formats');
      expect(normalized.content?.description).toContain('We support all major');
      expect(normalized.content?.inputFormats).toEqual(['pdf', 'docx', 'png', 'jpg']);
      expect(normalized.content?.outputFormats).toEqual(['pdf', 'png', 'webp']);
      expect(normalized.content?.notes).toBe('Max file size 100MB per file.');

      const validation = validateAndSanitizeBlock(formatBlock);
      expect(validation.isValid).toBe(true);
      expect(validation.block.content.inputFormats).toHaveLength(4);
    });

    it('normalizes and validates technical_details block with specs and limitations', () => {
      const techBlock = {
        id: 'tech-1',
        type: 'technical_details',
        content: {
          heading: 'Technical Specifications & Device Limits',
          description: 'Client-side processing specifications for high-performance conversions.',
          specs: [
            { label: 'Engine', value: 'WebAssembly + Rust', notes: 'Native speed' },
            { label: 'Memory Limit', value: '2GB Allocated RAM' },
          ],
          limitations: [
            'Password-protected files must be unlocked prior to processing.',
            'Safari on iOS may limit memory allocations to 1GB.',
          ],
        },
      };

      const normalized = normalizeBlock(techBlock);
      expect(normalized.content?.heading).toBe('Technical Specifications & Device Limits');
      expect(normalized.content?.specs).toHaveLength(2);
      expect(normalized.content?.specs[0].label).toBe('Engine');
      expect(normalized.content?.specs[0].value).toBe('WebAssembly + Rust');
      expect(normalized.content?.limitations).toHaveLength(2);

      const validation = validateAndSanitizeBlock(techBlock);
      expect(validation.isValid).toBe(true);
    });

    it('normalizes and validates benefits_trust badge cards', () => {
      const benefitsBlock = {
        id: 'trust-1',
        type: 'benefits_trust',
        content: {
          items: [
            { id: 'b1', title: '100% Private', description: 'Processed on-device in temporary memory.' },
            { id: 'b2', title: 'Zero Cloud Storage', description: 'No file copies remain on servers.' },
            { id: 'b3', title: 'Lightning Fast', description: 'WASM native compiled performance.' },
          ],
        },
      };

      const normalized = normalizeBlock(benefitsBlock);
      expect(normalized.content?.items).toHaveLength(3);
      expect(normalized.content?.items[0].title).toBe('100% Private');

      const validation = validateAndSanitizeBlock(benefitsBlock);
      expect(validation.isValid).toBe(true);
    });

    it('normalizes and validates vertical spacer block', () => {
      const spacerBlock = {
        id: 'spacer-1',
        type: 'spacer',
        content: {
          height: 48,
        },
      };

      const normalized = normalizeBlock(spacerBlock);
      expect(normalized.content?.height).toBe(48);
      expect(normalized.height).toBe(48);

      const validation = validateAndSanitizeBlock(spacerBlock);
      expect(validation.isValid).toBe(true);
    });
  });

  describe('Repeatable Block Item Operations & Reordering', () => {
    it('supports repeatable card additions, deletions, and moves on features', () => {
      const featuresBlock = {
        id: 'feat-1',
        type: 'features',
        content: {
          heading: 'Key Benefits',
          subheading: 'Why users love our converters',
          items: [
            { id: 'f1', title: 'Feature 1', description: 'Desc 1', icon: 'ShieldCheck' },
            { id: 'f2', title: 'Feature 2', description: 'Desc 2', icon: 'Zap' },
          ],
        },
      };

      // Add item
      const added = {
        ...featuresBlock,
        content: {
          ...featuresBlock.content,
          items: [
            ...featuresBlock.content.items,
            { id: 'f3', title: 'Feature 3', description: 'Desc 3', icon: 'Cpu' },
          ],
        },
      };
      expect(added.content.items).toHaveLength(3);

      // Reorder items: move Feature 3 up
      const reorderedItems = [...added.content.items];
      const temp = reorderedItems[1];
      reorderedItems[1] = reorderedItems[2];
      reorderedItems[2] = temp;

      expect(reorderedItems[1].id).toBe('f3');
      expect(reorderedItems[2].id).toBe('f2');

      // Remove item
      const filtered = reorderedItems.filter((item) => item.id !== 'f1');
      expect(filtered).toHaveLength(2);
      expect(filtered[0].id).toBe('f3');
      expect(filtered[1].id).toBe('f2');
    });

    it('supports multi-item FAQ with section heading and Q&A items', () => {
      const multiFaq = {
        id: 'faq-multi',
        type: 'faq',
        content: {
          heading: 'Frequently Asked Questions About Conversion',
          items: [
            { question: 'Is it really free?', answer: 'Yes, 100% free with no hidden fees.' },
            { question: 'Are files uploaded?', answer: 'No, files remain on your device.' },
          ],
        },
      };

      const normalized = normalizeBlock(multiFaq);
      expect(normalized.content?.heading).toBe('Frequently Asked Questions About Conversion');
      expect(normalized.content?.items).toHaveLength(2);
      expect(normalized.content?.items[0].question).toBe('Is it really free?');
      expect(normalized.content?.items[1].answer).toContain('remain on your device');
    });
  });

  describe('Intro Block & HTML Sanitization', () => {
    it('supports heading, text, and sanitizes custom HTML on intro blocks', () => {
      const introBlock = {
        id: 'intro-1',
        type: 'intro',
        content: {
          heading: 'PDF Converter Pro',
          text: 'Plain text description fallback.',
          html: '<p>Trusted by millions. <script>alert("xss")</script><a href="https://example.com" onclick="steal()">Click here</a></p>',
        },
      };

      const validation = validateAndSanitizeBlock(introBlock);
      expect(validation.isValid).toBe(true);
      // Script tags must be stripped
      expect(validation.block.content.html).not.toContain('<script>');
      expect(validation.block.content.html).not.toContain('onclick');
      expect(validation.block.content.html).toContain('Trusted by millions.');
    });
  });

  describe('Universal URL Safety across All Block Types', () => {
    it('detects unsafe URLs in pricing buttonHref', () => {
      const unsafePricing = {
        id: 'prc-unsafe',
        type: 'pricing',
        content: {
          title: 'Free Plan',
          buttonHref: 'javascript:void(0)',
        },
      };
      const result = validateAndSanitizeBlock(unsafePricing);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Unsafe button URL detected in pricing');
    });

    it('detects unsafe URLs in popular_tools exploreHref', () => {
      const unsafePop = {
        id: 'pop-unsafe',
        type: 'popular_tools',
        content: {
          heading: 'Popular Tools',
          exploreHref: 'data:text/html,<script>evil()</script>',
        },
      };
      const result = validateAndSanitizeBlock(unsafePop);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Unsafe explore URL detected');
    });

    it('detects unsafe URLs in hubs imageHubHref & pdfHubHref', () => {
      const unsafeHub = {
        id: 'hub-unsafe',
        type: 'hubs',
        content: {
          heading: 'Hubs',
          imageHubHref: 'vbscript:run()',
        },
      };
      const result = validateAndSanitizeBlock(unsafeHub);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Unsafe image hub URL detected');
    });
  });

  describe('Backward Compatibility for Unknown Root Properties', () => {
    it('does not crash or discard arbitrary unknown root properties during normalization', () => {
      const customBlock = {
        id: 'custom-blk-1',
        type: 'custom_banner',
        arbitraryField: 'custom-data',
        numericValue: 42,
        nestedConfig: { theme: 'dark', responsive: true },
        content: {
          bannerText: 'Special Announcement',
        },
      };

      const normalized = normalizeBlock(customBlock);
      expect(normalized.id).toBe('custom-blk-1');
      expect(normalized.type).toBe('paragraph');
      expect(normalized.content?.bannerText).toBe('Special Announcement');
      expect((normalized as any).arbitraryField).toBe('custom-data');
      expect((normalized as any).numericValue).toBe(42);
      expect((normalized as any).nestedConfig).toEqual({ theme: 'dark', responsive: true });
    });
  });
});
