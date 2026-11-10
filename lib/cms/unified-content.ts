import type { Metadata } from 'next';
import { siteConfig, defaultMetadata } from '@/lib/seo';
import { getDb } from '@/lib/db';
import { getToolBySlug, ToolDefinition, getAllTools } from '@/lib/tools';
import { getFormatBySlug, FormatDefinition, getAllFormats } from '@/lib/formats';
import { getArticleBySlug, getAllArticles, BlogArticle } from '@/content/blog/articles';
import {
  ContentBlockType,
  UniversalContentBlock,
  normalizeBlock,
  normalizeBlocksList,
} from './blocks';
import { isSafeUrl, sanitizeRichTextHtml, validateJsonLd } from '@/lib/admin/validation';

export type PageType =
  | 'home'
  | 'tool'
  | 'category'
  | 'format'
  | 'static'
  | 'blog'
  | 'custom';

export type SourceModel = 'page' | 'tool' | 'format' | 'blog' | 'static';

export interface UnifiedSeoData {
  seoTitle?: string | null;
  metaDescription?: string | null;
  canonicalUrl?: string | null;
  robotsIndex?: boolean;
  robotsFollow?: boolean;
  ogTitle?: string | null;
  ogDescription?: string | null;
  ogImage?: string | null;
  ogType?: 'website' | 'article';
  twitterTitle?: string | null;
  twitterDescription?: string | null;
  twitterImage?: string | null;
  twitterCard?: 'summary' | 'summary_large_image';
  schemaType?: string | null;
  schemaJson?: Record<string, any> | null;
  focusKeyword?: string | null;
}

export interface UnifiedContentPage {
  id: string;
  slug: string;
  pageType: PageType;
  name: string;
  status: 'DRAFT' | 'PUBLISHED';
  publishedAt: Date | null;
  updatedAt?: Date | null;
  blocks: UniversalContentBlock[];
  seo: UnifiedSeoData | null;
  sourceModel: SourceModel;
  isOverridden: boolean;
  customCss?: string | null;
}

export interface BlockDefinition {
  type: ContentBlockType;
  label: string;
  category: 'layout' | 'typography' | 'media' | 'conversion' | 'seo';
  description: string;
  iconName: string;
  defaultContent: Record<string, any>;
  defaultSettings?: Record<string, any>;
}

/**
 * Canonical block registry defining all supported universal content blocks.
 */
export const BLOCK_REGISTRY: Record<ContentBlockType, BlockDefinition> = {
  hero: {
    type: 'hero',
    label: 'Hero Section',
    category: 'layout',
    description: 'Prominent header banner with headline, description, and action target.',
    iconName: 'Layout',
    defaultContent: {
      title: 'Fast & Secure File Utilities',
      description: 'Convert and edit documents directly in your browser with 100% privacy.',
    },
  },
  section: {
    type: 'section',
    label: 'Section Container',
    category: 'layout',
    description: 'Structural container grouping related content blocks with an optional title.',
    iconName: 'Box',
    defaultContent: {
      title: 'Section Title',
      description: 'Optional introductory explanation for this section.',
    },
  },
  heading: {
    type: 'heading',
    label: 'Heading',
    category: 'typography',
    description: 'Hierarchical title tag (H1, H2, or H3) for semantic structure.',
    iconName: 'Heading',
    defaultContent: {
      level: 2,
      text: 'Section Heading',
    },
  },
  paragraph: {
    type: 'paragraph',
    label: 'Paragraph',
    category: 'typography',
    description: 'Clean standard body text paragraph.',
    iconName: 'Pilcrow',
    defaultContent: {
      text: 'Write clear and informative content here.',
    },
  },
  rich_text: {
    type: 'rich_text',
    label: 'Rich Text (HTML)',
    category: 'typography',
    description: 'Sanitized HTML body supporting bold, lists, links, and paragraphs.',
    iconName: 'FileText',
    defaultContent: {
      html: '<p>Formatted content with <strong>bold</strong> accents and clean markup.</p>',
    },
  },
  image: {
    type: 'image',
    label: 'Image Asset',
    category: 'media',
    description: 'Responsive image with alt text, aspect ratio, and optional caption.',
    iconName: 'Image',
    defaultContent: {
      src: '',
      alt: 'Descriptive alternative text',
      caption: '',
    },
  },
  link: {
    type: 'link',
    label: 'Text Link',
    category: 'conversion',
    description: 'Hyperlink to internal routes or external verified resources.',
    iconName: 'Link',
    defaultContent: {
      text: 'Learn more',
      href: '/',
      isExternal: false,
    },
  },
  cta: {
    type: 'cta',
    label: 'Call to Action Button',
    category: 'conversion',
    description: 'High-contrast conversion button directing visitors to a tool or action.',
    iconName: 'MousePointerClick',
    defaultContent: {
      label: 'Get Started Now',
      href: '/tools/jpg-to-png',
      variant: 'primary',
    },
  },
  feature: {
    type: 'feature',
    label: 'Feature Item',
    category: 'conversion',
    description: 'Individual benefit card with icon, title, and concise explanation.',
    iconName: 'Star',
    defaultContent: {
      title: 'Instant Processing',
      description: 'Zero queue times and instantaneous browser-based execution.',
      icon: 'Zap',
    },
  },
  features: {
    type: 'features',
    label: 'Features Grid',
    category: 'conversion',
    description: 'Multi-column grid showcasing core platform advantages and technical specs.',
    iconName: 'Grid',
    defaultContent: {
      heading: 'Key Benefits',
      items: [
        { title: '100% Private', description: 'Files never leave your local hardware.' },
        { title: 'Blazing Fast', description: 'Zero upload lag powered by modern WebAssembly.' },
      ],
    },
  },
  how_to_use: {
    type: 'how_to_use',
    label: 'How It Works (Steps)',
    category: 'conversion',
    description: 'Step-by-step numbered guide for using the tool or service.',
    iconName: 'ListOrdered',
    defaultContent: {
      heading: 'How to Convert in 3 Simple Steps',
      steps: [
        { title: 'Select Your File', description: 'Drag and drop your file into the tool zone.' },
        { title: 'Choose Options', description: 'Configure compression or quality levels.' },
        { title: 'Download Result', description: 'Save the converted document instantly.' },
      ],
    },
  },
  how_to: {
    type: 'how_to',
    label: 'How-To Instruction',
    category: 'conversion',
    description: 'Alternate step-by-step format for tool guides and tutorial articles.',
    iconName: 'HelpCircle',
    defaultContent: {
      heading: 'Step-by-Step Instructions',
      steps: [],
    },
  },
  related_tools: {
    type: 'related_tools',
    label: 'Related Tools Carousel',
    category: 'conversion',
    description: 'Curated list of complementary file conversion utilities.',
    iconName: 'Share2',
    defaultContent: {
      heading: 'You May Also Need',
      toolSlugs: ['jpg-to-png', 'compress-image', 'merge-pdf'],
    },
  },
  benefits_trust: {
    type: 'benefits_trust',
    label: 'Trust & Privacy Highlights',
    category: 'conversion',
    description: 'Standard security trust badges (client-side privacy, free, instant).',
    iconName: 'ShieldCheck',
    defaultContent: {
      title: 'Why Users Trust FileTools',
      highlights: [
        { icon: 'Lock', title: 'Zero Cloud Uploads', description: '100% client-side privacy.' },
        { icon: 'Zap', title: 'Lightning Fast', description: 'Runs right inside your browser.' },
        { icon: 'Sparkles', title: '100% Free Forever', description: 'No subscriptions or limits.' },
      ],
    },
  },
  intro: {
    type: 'intro',
    label: 'Introductory Overview',
    category: 'typography',
    description: 'Editorial overview section introducing format or tool capabilities.',
    iconName: 'BookOpen',
    defaultContent: {
      heading: 'About This Tool',
      text: 'Detailed overview highlighting technical context and everyday applications.',
    },
  },
  faq: {
    type: 'faq',
    label: 'Frequently Asked Questions',
    category: 'seo',
    description: 'Accordion FAQ items supporting structured data schema generation.',
    iconName: 'HelpCircle',
    defaultContent: {
      question: 'Is my file safe when using this tool?',
      answer: 'Yes! All file conversions happen entirely in your browser. Files are never uploaded to our servers.',
    },
  },
  tool_ref: {
    type: 'tool_ref',
    label: 'Tool Reference Card',
    category: 'conversion',
    description: 'Interactive launcher card embedding or linking to a specific tool.',
    iconName: 'Wrench',
    defaultContent: {
      toolSlug: 'jpg-to-png',
    },
  },
  cards: {
    type: 'cards',
    label: 'Card Grid',
    category: 'layout',
    description: 'Flexible multi-column card layout for content, formats, or links.',
    iconName: 'CreditCard',
    defaultContent: {
      items: [],
    },
  },
  privacy_note: {
    type: 'privacy_note',
    label: 'Privacy & Security Guarantee',
    category: 'seo',
    description: 'Dedicated client-side confidentiality statement.',
    iconName: 'Shield',
    defaultContent: {
      title: 'Your Privacy Is Guaranteed',
      description: 'Convert24 uses client-side WebAssembly to process files locally. No data is stored, cached, or seen by anyone.',
    },
  },
  use_cases: {
    type: 'use_cases',
    label: 'Practical Use Cases',
    category: 'conversion',
    description: 'Real-world scenarios and workflows where this tool is indispensable.',
    iconName: 'Briefcase',
    defaultContent: {
      heading: 'Common Use Cases',
      items: [],
    },
  },
  supported_formats: {
    type: 'supported_formats',
    label: 'Supported Input & Output Formats',
    category: 'conversion',
    description: 'Lists supported file extensions and conversion capabilities.',
    iconName: 'FileCheck',
    defaultContent: {
      heading: 'Supported File Formats',
      description: 'Review compatible input extensions and output target specifications.',
      inputFormats: ['JPG', 'JPEG'],
      outputFormats: ['PNG'],
      notes: 'Converts locally in browser memory without file uploads.',
    },
  },
  technical_details: {
    type: 'technical_details',
    label: 'Technical Details & Limitations',
    category: 'conversion',
    description: 'Technical specifications, file size boundaries, and browser capabilities.',
    iconName: 'Cpu',
    defaultContent: {
      heading: 'Technical Details & Limitations',
      description: 'Architecture specifications, processing constraints, and device requirements.',
      specs: [
        { label: 'Processing Mode', value: '100% Client-Side WebAssembly & Canvas' },
        { label: 'Max File Size', value: 'Subject to available client device RAM' },
      ],
      limitations: [
        'Conversion speed depends on local device processor performance and RAM.',
      ],
    },
  },
  spacer: {
    type: 'spacer',
    label: 'Spacer / Divider',
    category: 'layout',
    description: 'Configurable whitespace separator between sections.',
    iconName: 'Minus',
    defaultContent: {
      height: 32,
    },
  },
  popular_tools: {
    type: 'popular_tools',
    label: 'Popular Tools Grid',
    category: 'conversion',
    description: 'Curated showcase of high-converting file transformation utilities.',
    iconName: 'Wrench',
    defaultContent: {
      title: 'Popular Conversion Tools',
      subtitle: 'Fast, secure, and completely free in-browser file converters.',
      tools: [],
    },
  },
  hubs: {
    type: 'hubs',
    label: 'Format Hubs Section',
    category: 'layout',
    description: 'Explore conversion categories organized by document and media formats.',
    iconName: 'FolderOpen',
    defaultContent: {
      title: 'Explore All Tools & Formats',
      subtitle: 'Browse specialized converters organized by document and image type.',
    },
  },
  pricing: {
    type: 'pricing',
    label: 'Free & Transparent Guarantee',
    category: 'conversion',
    description: '100% free pricing guarantee and client-side benefits banner.',
    iconName: 'Sparkles',
    defaultContent: {
      title: '100% Free Forever. No Hidden Fees.',
      description: 'Convert24 is funded by optional donations and ethical sponsorships. No subscriptions, credit cards, or limits.',
      features: [
        'Unlimited conversions per day',
        'No file size restrictions within device memory',
        'No account required',
        'Zero queue waiting times',
      ],
    },
  },
  container: {
    type: 'container',
    label: 'Container / Grid',
    category: 'layout',
    description: 'Multi-column layout container supporting nested child content blocks.',
    iconName: 'LayoutGrid',
    defaultContent: {
      blocks: [],
    },
    defaultSettings: {
      layout: 'grid',
      columns: 2,
      gap: 'md',
    },
  },
  custom_html: {
    type: 'custom_html',
    label: 'Custom HTML Block',
    category: 'layout',
    description: 'Render custom HTML elements with sanitized and scoped styling.',
    iconName: 'Code',
    defaultContent: {
      html: '<div>Custom HTML content</div>',
    },
  },
};

export function getBlockDefinition(type: ContentBlockType): BlockDefinition {
  return (
    BLOCK_REGISTRY[type] || {
      type,
      label: type,
      category: 'typography',
      description: 'Generic block component.',
      iconName: 'Box',
      defaultContent: {},
    }
  );
}

export function createDefaultBlock(type: ContentBlockType, order = 0): UniversalContentBlock {
  const def = getBlockDefinition(type);
  return normalizeBlock(
    {
      id: `blk-${Math.random().toString(36).substring(2, 9)}`,
      type,
      enabled: true,
      order,
      content: JSON.parse(JSON.stringify(def.defaultContent)),
      settings: JSON.parse(JSON.stringify(def.defaultSettings || {})),
    },
    order
  );
}

/**
 * Normalizes and formats a safe canonical URL.
 * Guarantees public site origin consistency and rejects unsafe schemes.
 */
export function buildCanonicalUrl(pathOrUrl?: string | null, fallbackPath = '/'): string {
  const base = siteConfig.url.replace(/\/+$/, '');
  const cleanFallback = fallbackPath.startsWith('/') ? fallbackPath : `/${fallbackPath}`;

  if (!pathOrUrl || typeof pathOrUrl !== 'string') {
    return cleanFallback === '/' ? base : `${base}${cleanFallback}`.replace(/\/+$/, '');
  }

  const trimmed = pathOrUrl.trim();
  if (!trimmed) {
    return cleanFallback === '/' ? base : `${base}${cleanFallback}`.replace(/\/+$/, '');
  }

  // Reject unsafe schemes explicitly (javascript:, data:, vbscript:, file:, ftp:, blob:)
  if (/^(javascript|data|vbscript|file|ftp|blob):/i.test(trimmed)) {
    return cleanFallback === '/' ? base : `${base}${cleanFallback}`.replace(/\/+$/, '');
  }

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    if (!isSafeUrl(trimmed)) {
      return cleanFallback === '/' ? base : `${base}${cleanFallback}`.replace(/\/+$/, '');
    }
    return trimmed.replace(/\/+$/, '');
  }

  const cleanPath = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  if (cleanPath === '/') {
    return base;
  }
  return `${base}${cleanPath}`.replace(/\/+$/, '');
}

/**
 * Resolves unified SEO metadata using the 3-tier fallback architecture:
 * Tier 1: Page-specific override (from database record)
 * Tier 2: Type-specific canonical defaults (from tool/format/article registry)
 * Tier 3: Site-wide defaults (from siteConfig / defaultMetadata)
 *
 * Rules:
 * - Empty string overrides do not erase valid legacy or site defaults.
 * - Draft previews are strictly protected and cannot be indexed.
 * - Canonical URLs are guaranteed safe and origin-consistent.
 */
export function resolveUnifiedSeo(options: {
  pageType: PageType;
  slug: string;
  preview?: boolean;
  pageSeo?: UnifiedSeoData | null;
  typeDefaults?: {
    title?: string;
    description?: string;
    canonicalPath?: string;
    ogImage?: string;
    ogType?: 'website' | 'article';
    schemaType?: string;
    schemaJson?: Record<string, any>;
  };
  siteDefaults?: Metadata;
}): Metadata {
  const { pageType, slug, preview = false, pageSeo, typeDefaults, siteDefaults = defaultMetadata } = options;

  const isNonEmpty = (v?: string | null): v is string => typeof v === 'string' && v.trim().length > 0;

  // 1. Resolve Title
  const title =
    (isNonEmpty(pageSeo?.seoTitle) ? pageSeo.seoTitle.trim() : null) ||
    (isNonEmpty(typeDefaults?.title) ? typeDefaults.title.trim() : null) ||
    (isNonEmpty(siteDefaults.title as string) ? (siteDefaults.title as string).trim() : null) ||
    `${siteConfig.name} – Convert & Edit Files`;

  // 2. Resolve Meta Description
  const description =
    (isNonEmpty(pageSeo?.metaDescription) ? pageSeo.metaDescription.trim() : null) ||
    (isNonEmpty(typeDefaults?.description) ? typeDefaults.description.trim() : null) ||
    (isNonEmpty(siteDefaults.description as string) ? (siteDefaults.description as string).trim() : null) ||
    siteConfig.description;

  // 3. Resolve Canonical URL
  const fallbackPath =
    typeDefaults?.canonicalPath ||
    (pageType === 'home'
      ? '/'
      : pageType === 'tool'
      ? `/tools/${slug}`
      : pageType === 'format'
      ? `/formats/${slug}`
      : pageType === 'blog'
      ? `/blog/${slug}`
      : `/${slug}`);

  const canonicalUrl = buildCanonicalUrl(pageSeo?.canonicalUrl, fallbackPath);

  // 4. Resolve Robots Directives
  // Protected Rule: Draft previews MUST NEVER be indexed by search engines
  const index = preview ? false : pageSeo?.robotsIndex !== false;
  const follow = preview ? false : pageSeo?.robotsFollow !== false;

  // 5. Resolve Open Graph
  const ogTitle = (isNonEmpty(pageSeo?.ogTitle) ? pageSeo.ogTitle.trim() : null) || title;
  const ogDescription = (isNonEmpty(pageSeo?.ogDescription) ? pageSeo.ogDescription.trim() : null) || description;
  const ogType = pageSeo?.ogType || typeDefaults?.ogType || 'website';
  const ogImage =
    isNonEmpty(pageSeo?.ogImage) && isSafeUrl(pageSeo.ogImage)
      ? pageSeo.ogImage
      : typeDefaults?.ogImage || siteConfig.ogImage;

  // 6. Resolve Twitter Card
  const twitterTitle = (isNonEmpty(pageSeo?.twitterTitle) ? pageSeo.twitterTitle.trim() : null) || title;
  const twitterDescription = (isNonEmpty(pageSeo?.twitterDescription) ? pageSeo.twitterDescription.trim() : null) || description;
  const twitterCard = pageSeo?.twitterCard || 'summary_large_image';
  const twitterImage =
    isNonEmpty(pageSeo?.twitterImage) && isSafeUrl(pageSeo.twitterImage)
      ? pageSeo.twitterImage
      : ogImage;

  return {
    ...siteDefaults,
    title,
    description,
    alternates: {
      canonical: canonicalUrl,
    },
    robots: {
      index,
      follow,
      googleBot: {
        index,
        follow,
        'max-video-preview': -1,
        'max-image-preview': 'large',
        'max-snippet': -1,
      },
    },
    openGraph: {
      type: ogType,
      locale: 'en_US',
      url: canonicalUrl,
      siteName: siteConfig.name,
      title: ogTitle,
      description: ogDescription,
      images: ogImage ? [{ url: ogImage }] : (siteDefaults.openGraph?.images as any),
    },
    twitter: {
      card: twitterCard,
      title: twitterTitle,
      description: twitterDescription,
      images: twitterImage ? [twitterImage] : (siteDefaults.twitter?.images as any),
    },
  };
}

/**
 * Generates Schema.org structured data matching page type:
 * - SoftwareApplication / WebApplication for tools
 * - BlogPosting / Article for blog posts
 * - CollectionPage / WebPage for format or category pages
 * - WebSite / Organization for homepage or root
 */
export function buildPageStructuredData(options: {
  pageType: PageType;
  slug: string;
  name: string;
  description?: string;
  seo?: UnifiedSeoData | null;
  canonicalData?: any;
}): Record<string, any> {
  const { pageType, slug, name, description = '', seo, canonicalData } = options;

  if (seo?.schemaJson && typeof seo.schemaJson === 'object' && Object.keys(seo.schemaJson).length > 0) {
    return {
      '@context': 'https://schema.org',
      ...seo.schemaJson,
    };
  }

  const pageUrl = buildCanonicalUrl(
    seo?.canonicalUrl,
    pageType === 'home'
      ? '/'
      : pageType === 'tool'
      ? `/tools/${slug}`
      : pageType === 'format'
      ? `/formats/${slug}`
      : pageType === 'blog'
      ? `/blog/${slug}`
      : `/${slug}`
  );

  switch (pageType) {
    case 'tool':
      return {
        '@context': 'https://schema.org',
        '@type': 'WebApplication',
        name,
        description: seo?.metaDescription || description || siteConfig.description,
        url: pageUrl,
        applicationCategory: 'UtilityApplication',
        operatingSystem: 'All (Web Browser)',
        browserRequirements: 'Requires JavaScript and WebAssembly support',
        offers: {
          '@type': 'Offer',
          price: '0',
          priceCurrency: 'USD',
        },
      };

    case 'blog':
      return {
        '@context': 'https://schema.org',
        '@type': 'BlogPosting',
        headline: seo?.seoTitle || name,
        description: seo?.metaDescription || description,
        url: pageUrl,
        datePublished: canonicalData?.publishedAt || canonicalData?.date || new Date('2026-01-01').toISOString(),
        dateModified: canonicalData?.updatedAt || canonicalData?.publishedAt || new Date('2026-01-01').toISOString(),
        author: {
          '@type': 'Organization',
          name: siteConfig.name,
          url: siteConfig.url,
        },
        publisher: {
          '@type': 'Organization',
          name: siteConfig.name,
          url: siteConfig.url,
        },
        mainEntityOfPage: {
          '@type': 'WebPage',
          '@id': pageUrl,
        },
      };

    case 'format':
    case 'category':
      return {
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name,
        description: seo?.metaDescription || description,
        url: pageUrl,
        isPartOf: {
          '@type': 'WebSite',
          name: siteConfig.name,
          url: siteConfig.url,
        },
      };

    case 'home':
    default:
      return {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: siteConfig.name,
        url: siteConfig.url,
        description: siteConfig.description,
        potentialAction: {
          '@type': 'SearchAction',
          target: `${siteConfig.url}/?q={search_term_string}`,
          'query-input': 'required name=search_term_string',
        },
      };
  }
}

/**
 * Safely serializes a structured JSON-LD schema into a JSON string,
 * strictly stripping potential HTML/script injection tags.
 */
export function safeSerializeJsonLd(schema: unknown): string | null {
  if (!schema) return null;

  try {
    const raw = typeof schema === 'string' ? schema : JSON.stringify(schema);
    const sanitized = raw
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/</g, '\\u003c')
      .replace(/>/g, '\\u003e')
      .replace(/&/g, '\\u0026');

    return sanitized;
  } catch {
    return null;
  }
}

/**
 * Resolves any public or preview page into the standard UnifiedContentPage structure.
 * Guaranteed safe fallback: if database override is absent or in draft state (during public requests),
 * resolves seamlessly to the canonical static/code definition.
 */
export async function resolveUnifiedContent(options: {
  pageType: PageType;
  slug: string;
  preview?: boolean;
}): Promise<UnifiedContentPage | null> {
  const { pageType, slug, preview = false } = options;
  const db = getDb();

  // 1. Tool Page Resolver
  if (pageType === 'tool') {
    const canonicalTool = getToolBySlug(slug);
    if (!canonicalTool) return null;

    try {
      const override = await db.toolContent.findUnique({
        where: { toolSlug: slug },
        include: { seo: true },
      });

      if (override && (override.isPublished || preview)) {
        const blocks = normalizeBlocksList(override.blocks as any[]);
        return {
          id: override.id,
          slug,
          pageType: 'tool',
          name: override.customTitle || canonicalTool.name || canonicalTool.title,
          status: override.isPublished ? 'PUBLISHED' : 'DRAFT',
          publishedAt: override.isPublished ? override.createdAt : null,
          updatedAt: override.updatedAt,
          blocks,
          seo: override.seo
            ? {
                seoTitle: override.seo.seoTitle,
                metaDescription: override.seo.metaDescription,
                canonicalUrl: override.seo.canonicalUrl,
                robotsIndex: override.seo.robotsIndex,
                robotsFollow: override.seo.robotsFollow,
                ogTitle: override.seo.ogTitle,
                ogDescription: override.seo.ogDescription,
                ogImage: override.seo.ogImage,
                schemaType: override.seo.schemaType,
                schemaJson: override.seo.schemaJson as any,
                focusKeyword: override.seo.focusKeyword,
              }
            : null,
          sourceModel: 'tool',
          isOverridden: true,
        };
      }
    } catch {
      // Continue to canonical fallback on DB error
    }

    // Canonical Fallback
    return {
      id: `canonical-tool-${slug}`,
      slug,
      pageType: 'tool',
      name: canonicalTool.name || canonicalTool.title,
      status: 'PUBLISHED',
      publishedAt: new Date('2026-01-01'),
      blocks: [],
      seo: {
        seoTitle: canonicalTool.title,
        metaDescription: canonicalTool.description,
        canonicalUrl: `${siteConfig.url}/tools/${slug}`,
        robotsIndex: true,
        robotsFollow: true,
      },
      sourceModel: 'tool',
      isOverridden: false,
    };
  }

  // 2. Format Page Resolver
  if (pageType === 'format') {
    const canonicalFormat = getFormatBySlug(slug);
    if (!canonicalFormat) return null;

    try {
      const override = await (db as any).formatContent?.findUnique({
        where: { formatSlug: slug },
      });

      if (override) {
        return {
          id: override.id,
          slug,
          pageType: 'format',
          name: override.customTitle || canonicalFormat.title,
          status: 'PUBLISHED',
          publishedAt: override.updatedAt,
          updatedAt: override.updatedAt,
          blocks: [],
          seo: {
            seoTitle: override.customTitle || canonicalFormat.title,
            metaDescription: override.customDescription || canonicalFormat.description,
            canonicalUrl: `${siteConfig.url}/formats/${slug}`,
            robotsIndex: true,
            robotsFollow: true,
          },
          sourceModel: 'format',
          isOverridden: true,
        };
      }
    } catch {
      // Fall through to canonical fallback
    }

    return {
      id: `canonical-format-${slug}`,
      slug,
      pageType: 'format',
      name: canonicalFormat.title,
      status: 'PUBLISHED',
      publishedAt: new Date('2026-01-01'),
      blocks: [],
      seo: {
        seoTitle: canonicalFormat.title,
        metaDescription: canonicalFormat.description,
        canonicalUrl: `${siteConfig.url}/formats/${slug}`,
        robotsIndex: true,
        robotsFollow: true,
      },
      sourceModel: 'format',
      isOverridden: false,
    };
  }

  // 3. Blog Post Resolver
  if (pageType === 'blog') {
    try {
      const post = await db.blogPost.findUnique({
        where: { slug },
        include: { seo: true, author: true },
      });

      if (post && (post.status === 'PUBLISHED' || preview)) {
        return {
          id: post.id,
          slug: post.slug,
          pageType: 'blog',
          name: post.title,
          status: post.status as 'DRAFT' | 'PUBLISHED',
          publishedAt: post.publishedAt,
          updatedAt: post.updatedAt,
          blocks: [
            normalizeBlock({
              id: `blk-post-${post.id}-rich`,
              type: 'rich_text',
              enabled: true,
              order: 0,
              content: { html: post.content },
            }),
          ],
          seo: post.seo
            ? {
                seoTitle: post.seo.seoTitle || post.title,
                metaDescription: post.seo.metaDescription || post.excerpt,
                canonicalUrl: post.seo.canonicalUrl,
                robotsIndex: post.seo.robotsIndex,
                robotsFollow: post.seo.robotsFollow,
                ogTitle: post.seo.ogTitle,
                ogDescription: post.seo.ogDescription,
                ogImage: post.seo.ogImage || post.featuredImage,
                ogType: 'article',
                schemaType: post.seo.schemaType || 'Article',
                schemaJson: post.seo.schemaJson as any,
                focusKeyword: post.seo.focusKeyword,
              }
            : null,
          sourceModel: 'blog',
          isOverridden: true,
        };
      }
    } catch {
      // Fall through to static article fallback
    }

    const staticArticle = getArticleBySlug(slug);
    if (!staticArticle) return null;

    return {
      id: `static-article-${staticArticle.slug}`,
      slug: staticArticle.slug,
      pageType: 'blog',
      name: staticArticle.title,
      status: 'PUBLISHED',
      publishedAt: new Date(staticArticle.publishedAt),
      blocks: [
        normalizeBlock({
          id: `blk-static-${staticArticle.slug}`,
          type: 'rich_text',
          enabled: true,
          order: 0,
          content: { html: staticArticle.content.map((p) => `<p>${p}</p>`).join('') },
        }),
      ],
      seo: {
        seoTitle: staticArticle.title,
        metaDescription: staticArticle.description,
        canonicalUrl: `${siteConfig.url}/blog/${staticArticle.slug}`,
        ogType: 'article',
        robotsIndex: true,
        robotsFollow: true,
      },
      sourceModel: 'blog',
      isOverridden: false,
    };
  }

  // 4. Standard Page (Home, Category, Static Informational)
  try {
    const page = await db.page.findUnique({
      where: { slug },
      include: { content: true, seo: true },
    });

    if (page && (page.status === 'PUBLISHED' || preview)) {
      const rawBlocks = (page.content?.blocks as any[]) || [];
      const blocks = normalizeBlocksList(rawBlocks);

      return {
        id: page.id,
        slug: page.slug,
        pageType,
        name: page.name,
        status: page.status as 'DRAFT' | 'PUBLISHED',
        publishedAt: page.publishedAt,
        updatedAt: page.updatedAt,
        blocks,
        customCss: page.content?.customCss,
        seo: page.seo
          ? {
              seoTitle: page.seo.seoTitle,
              metaDescription: page.seo.metaDescription,
              canonicalUrl: page.seo.canonicalUrl,
              robotsIndex: page.seo.robotsIndex,
              robotsFollow: page.seo.robotsFollow,
              ogTitle: page.seo.ogTitle,
              ogDescription: page.seo.ogDescription,
              ogImage: page.seo.ogImage,
              twitterTitle: page.seo.twitterTitle,
              twitterDescription: page.seo.twitterDescription,
              twitterImage: page.seo.twitterImage,
              schemaType: page.seo.schemaType,
              schemaJson: page.seo.schemaJson as any,
              focusKeyword: page.seo.focusKeyword,
            }
          : null,
        sourceModel: 'page',
        isOverridden: true,
      };
    }
  } catch {
    // Continue to static fallback
  }

  // Fallback for known static pages
  const staticNames: Record<string, string> = {
    home: 'Home',
    about: 'About Us',
    terms: 'Terms of Service',
    privacy: 'Privacy Policy',
    contact: 'Contact Us',
    'image-tools': 'Free Online Image Tools',
    'pdf-tools': 'Free Online PDF Tools',
  };

  const name = staticNames[slug] || slug;
  return {
    id: `static-page-${slug}`,
    slug,
    pageType,
    name,
    status: 'PUBLISHED',
    publishedAt: new Date('2026-01-01'),
    blocks: [],
    seo: {
      seoTitle: `${name} | ${siteConfig.name}`,
      metaDescription: siteConfig.description,
      canonicalUrl: slug === 'home' ? siteConfig.url : `${siteConfig.url}/${slug}`,
      robotsIndex: true,
      robotsFollow: true,
    },
    sourceModel: 'static',
    isOverridden: false,
  };
}
