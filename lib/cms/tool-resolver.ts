import type { Metadata } from 'next';
import { getToolBySlug, ToolDefinition } from '@/lib/tools';
import { getMergedTool } from '@/lib/admin/services/tool.service';
import { getDb } from '@/lib/db';
import { siteConfig } from '@/lib/seo';
import { buildCanonicalUrl } from '@/lib/cms/unified-content';

/**
 * Public Tool Resolver.
 * Returns the resolved tool definition for public pages.
 * Strictly verifies the slug is in the canonical 25-tool registry.
 * Falls back safely to canonical code registry if no published CMS override exists.
 * Draft CMS overrides are NEVER returned to public visitors.
 */
export async function getPublishedTool(slug: string): Promise<ToolDefinition | null> {
  return getMergedTool(slug, { preview: false });
}

/**
 * Admin Preview Tool Resolver.
 * Returns the resolved tool definition incorporating draft CMS content.
 */
export async function getPreviewTool(slug: string): Promise<ToolDefinition | null> {
  return getMergedTool(slug, { preview: true });
}

/**
 * Builds Next.js App Router Metadata for /tools/[slug]
 * Merging CMS SEO overrides over canonical defaults.
 */
export async function buildToolMetadata(
  slug: string,
  defaultMeta: Metadata
): Promise<Metadata> {
  const canonical = getToolBySlug(slug);
  if (!canonical) return defaultMeta;

  try {
    const db = getDb();
    const override = await db.toolContent.findUnique({
      where: { toolSlug: slug },
      include: { seo: true },
    });

    if (!override || !override.isPublished || !override.seo) {
      return defaultMeta;
    }

    const seo = override.seo;
    const isNonEmpty = (v?: string | null): v is string => typeof v === 'string' && v.trim().length > 0;
    const title =
      (isNonEmpty(seo.seoTitle) ? seo.seoTitle.trim() : null) ||
      (isNonEmpty(override.customTitle) ? override.customTitle.trim() : null) ||
      (defaultMeta.title as string);
    const description =
      (isNonEmpty(seo.metaDescription) ? seo.metaDescription.trim() : null) ||
      (isNonEmpty(override.customDescription) ? override.customDescription.trim() : null) ||
      (defaultMeta.description as string);
    const canonicalUrl = buildCanonicalUrl(seo.canonicalUrl, `/tools/${slug}`);

    return {
      ...defaultMeta,
      title,
      description,
      alternates: {
        canonical: canonicalUrl,
      },
      robots: {
        index: seo.robotsIndex !== false,
        follow: seo.robotsFollow !== false,
      },
      openGraph: {
        ...defaultMeta.openGraph,
        title: seo.ogTitle || title,
        description: seo.ogDescription || description,
        url: canonicalUrl,
        images: seo.ogImage ? [{ url: seo.ogImage }] : (defaultMeta.openGraph?.images as any),
      },
      twitter: {
        ...defaultMeta.twitter,
        title: seo.twitterTitle || title,
        description: seo.twitterDescription || description,
        images: seo.twitterImage ? [seo.twitterImage] : (defaultMeta.twitter?.images as any),
      },
    };
  } catch {
    return defaultMeta;
  }
}

/**
 * Retrieves custom JSON-LD schema or generates FAQ schema for published tools.
 */
export async function getToolJsonLd(slug: string): Promise<Record<string, any> | null> {
  try {
    const db = getDb();
    const override = await db.toolContent.findUnique({
      where: { toolSlug: slug },
      include: { seo: true },
    });

    if (!override || !override.isPublished) return null;

    if (override.seo?.schemaJson) {
      return override.seo.schemaJson as Record<string, any>;
    }

    return null;
  } catch {
    return null;
  }
}
