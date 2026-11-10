import { UniversalContentBlock } from './blocks';
import { GENERAL_FAQS } from '@/lib/faq';

/**
 * Convert24 — Phase 11: Universal Canonical Homepage Contract
 * Provides deterministic, typed specifications and canonical blocks for all homepage sections.
 */
export function getDefaultHomepageBlocks(pageName = 'Free Online File Tools'): UniversalContentBlock[] {
  return [
    {
      id: 'home-hero',
      type: 'hero',
      enabled: true,
      order: 0,
      content: {
        badge: '100% Free & Client-Side Private',
        title: pageName || 'Free Online File Tools',
        description:
          'Convert, compress and manage your files quickly and easily without sending them across the internet.',
        searchPrompt: 'What do you want to do?',
        quickLinks: [
          { label: 'compress pdf', slug: 'compress-pdf' },
          { label: 'jpg to png', slug: 'jpg-to-png' },
          { label: 'merge pdf', slug: 'merge-pdf' },
          { label: 'compress image', slug: 'compress-image' },
          { label: 'resize image', slug: 'resize-image' },
        ],
      },
    },
    {
      id: 'home-popular-tools',
      type: 'popular_tools',
      enabled: true,
      order: 1,
      content: {
        heading: 'Popular tools',
        subheading: 'Frequently used converters and optimizers.',
        exploreText: 'Explore all tools',
        exploreHref: '#explore-hubs',
      },
    },
    {
      id: 'home-hubs',
      type: 'hubs',
      enabled: true,
      order: 2,
      content: {
        heading: 'Explore all tools',
        subheading:
          'Browse our simple discovery hubs to find exactly what you need without clutter.',
        imageHubTitle: 'Image Tools Hub',
        imageHubDescription:
          'Convert between JPG, PNG, WebP, HEIC, SVG, GIF, and BMP. Compress photos, resize dimensions, crop frames, and orient images.',
        imageHubButton: 'Explore image tools',
        imageHubHref: '/image-tools',
        pdfHubTitle: 'PDF Tools Hub',
        pdfHubDescription:
          'Merge multiple documents, split pages, compress file sizes, rotate orientation, delete pages, reorder pages, and convert to images.',
        pdfHubButton: 'Explore PDF tools',
        pdfHubHref: '/pdf-tools',
      },
    },
    {
      id: 'home-features',
      type: 'features',
      enabled: true,
      order: 3,
      content: {
        heading: 'Why Use Convert24',
        subheading: 'Engineered for speed, strict privacy, and hassle-free utility.',
        items: [
          {
            id: 'feat-privacy',
            title: 'Client-Side Privacy',
            description:
              'Files process directly in your browser. No files are uploaded to external cloud servers.',
            icon: 'Lock',
          },
          {
            id: 'feat-free',
            title: '100% Free',
            description:
              'No registrations, no subscriptions, and no watermarks placed on your documents or photos.',
            icon: 'ShieldCheck',
          },
          {
            id: 'feat-fast',
            title: 'Ultra Fast',
            description:
              'Skip remote file upload latency. Local browser execution delivers near-instant conversion.',
            icon: 'Zap',
          },
          {
            id: 'feat-mobile',
            title: 'Mobile Friendly',
            description:
              'Designed mobile-first with touch-friendly controls for smartphones, tablets, and desktops.',
            icon: 'Smartphone',
          },
        ],
      },
    },
    {
      id: 'home-pricing',
      type: 'pricing',
      enabled: true,
      order: 4,
      content: {
        badge: 'Pricing Plans',
        title: 'Always 100% Free. No Hidden Fees.',
        description:
          'Unlike other tools that lock premium features like high-quality compression or batch uploads behind payment walls, all 25 tools on Convert24 are fully free with unlimited conversions, zero registration, and complete browser security.',
        planName: 'Standard plan',
        price: '$0',
        period: '/ forever',
        items: [
          'Unlimited Batch Conversions',
          '50 MB File Size Allowance',
          'Safe Local Browser Processing',
        ],
        buttonText: 'Get Started Instantly',
        buttonHref: '#explore-hubs',
      },
    },
    {
      id: 'home-faq',
      type: 'faq',
      enabled: true,
      order: 5,
      content: {
        heading: 'Frequently Asked Questions',
        items: GENERAL_FAQS,
      },
    },
  ];
}

/**
 * Resolves homepage blocks by merging existing content with the 6 canonical sections.
 * Guarantees that hero, popular_tools, hubs, features, pricing, and faq are ALWAYS present
 * and visually editable on the rendered page, alongside any custom CMS blocks.
 */
export function getCanonicalHomepageBlocks(
  existingBlocks?: UniversalContentBlock[] | null,
  pageName = 'Free Online File Tools'
): UniversalContentBlock[] {
  const defaults = getDefaultHomepageBlocks(pageName);

  if (!Array.isArray(existingBlocks) || existingBlocks.length === 0) {
    return defaults;
  }

  const result: UniversalContentBlock[] = [...existingBlocks];

  // Guarantee all 6 canonical blocks are present for visual editing
  for (const def of defaults) {
    const exists = result.some((b) => b.type === def.type);
    if (!exists) {
      result.push({
        ...def,
        order: result.length,
      });
    }
  }

  return result;
}
