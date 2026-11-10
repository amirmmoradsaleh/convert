import { getDb } from '@/lib/db';
import {
  AdminUserSession,
  CMS_BACKUP_FORMAT_IDENTIFIER,
  CMS_BACKUP_CURRENT_VERSION,
  CMS_BACKUP_MAX_PAYLOAD_SIZE,
  CmsBackupFile,
  CmsBackupData,
  CmsBackupPage,
  CmsBackupTool,
  CmsBackupBlogPost,
  CmsBackupBlogCategory,
  CmsBackupBlogTag,
  CmsBackupNavigationItem,
  CmsBackupSiteSettings,
  CmsBackupFormatContent,
  CmsBackupMediaReference,
  CmsBackupPreviewResult,
  CmsBackupRestoreResult,
  CmsBackupSectionSummary,
  CmsBackupItemDetail,
} from '@/lib/admin/types';
import {
  validateAndSanitizeBlock,
  validatePagePayload,
  validateToolPayload,
  validateBlogPostPayload,
  validateCategoryPayload,
  validateTagPayload,
  validateSettingsPayload,
  validateSeo,
  isSafeUrl,
  sanitizeCustomCss,
} from '@/lib/admin/validation';
import { getToolBySlug } from '@/lib/tools';
import { createAuditLog } from '@/lib/admin/services/audit.service';
import { getGlobalSettings } from '@/lib/admin/services/settings.service';
import { MAX_CONTAINER_DEPTH } from '@/lib/cms/container-contract';

// ---------------------------------------------------------------------------
// Deep Content Comparison Helpers (to distinguish toUpdate vs toSkip)
// ---------------------------------------------------------------------------

function areBlocksEqual(a?: any[] | null, b?: any[] | null): boolean {
  const normA = Array.isArray(a) ? a : [];
  const normB = Array.isArray(b) ? b : [];
  return JSON.stringify(normA) === JSON.stringify(normB);
}

function areSeoEqual(incoming?: any | null, existing?: any | null, includeTwitter = true): boolean {
  if (!incoming && !existing) return true;
  if (!incoming || !existing) return false;

  if ((incoming.seoTitle ?? null) !== (existing.seoTitle ?? null)) return false;
  if ((incoming.metaDescription ?? null) !== (existing.metaDescription ?? null)) return false;
  if ((incoming.canonicalUrl ?? null) !== (existing.canonicalUrl ?? null)) return false;
  if (Boolean(incoming.robotsIndex ?? true) !== Boolean(existing.robotsIndex ?? true)) return false;
  if (Boolean(incoming.robotsFollow ?? true) !== Boolean(existing.robotsFollow ?? true)) return false;
  if ((incoming.ogTitle ?? null) !== (existing.ogTitle ?? null)) return false;
  if ((incoming.ogDescription ?? null) !== (existing.ogDescription ?? null)) return false;
  if ((incoming.ogImage ?? null) !== (existing.ogImage ?? null)) return false;
  if ((incoming.schemaType ?? null) !== (existing.schemaType ?? null)) return false;
  if ((incoming.focusKeyword ?? null) !== (existing.focusKeyword ?? null)) return false;

  if (includeTwitter) {
    if ((incoming.twitterTitle ?? null) !== (existing.twitterTitle ?? null)) return false;
    if ((incoming.twitterDescription ?? null) !== (existing.twitterDescription ?? null)) return false;
    if ((incoming.twitterImage ?? null) !== (existing.twitterImage ?? null)) return false;
  }

  return true;
}

function isPageUnchanged(incoming: CmsBackupPage, existing: any, sanitizedBlocks: any[]): boolean {
  if (!existing) return false;
  if (incoming.name !== existing.name) return false;
  const inStatus = incoming.status || 'DRAFT';
  if (inStatus !== existing.status) return false;

  const exContent = existing.content;
  if (!exContent) return false;
  const inPublished = Boolean(incoming.content?.isPublished ?? (inStatus === 'PUBLISHED'));
  const exPublished = Boolean(exContent.isPublished);
  if (inPublished !== exPublished) return false;

  if (!areBlocksEqual(sanitizedBlocks, exContent.blocks)) return false;

  const inCss = incoming.content?.customCss ? sanitizeCustomCss(incoming.content.customCss) : null;
  const exCss = exContent.customCss ? sanitizeCustomCss(exContent.customCss) : null;
  if (inCss !== exCss) return false;

  if (!areSeoEqual(incoming.seo, existing.seo, true)) return false;

  return true;
}

function isToolContentUnchanged(incoming: CmsBackupTool, existing: any, sanitized: any): boolean {
  if (!existing) return false;
  if ((sanitized.customTitle ?? null) !== (existing.customTitle ?? null)) return false;
  if ((sanitized.customH1 ?? null) !== (existing.customH1 ?? null)) return false;
  if ((sanitized.customDescription ?? null) !== (existing.customDescription ?? null)) return false;
  if ((sanitized.customIntro ?? null) !== (existing.customIntro ?? null)) return false;
  if ((sanitized.customValueProp ?? null) !== (existing.customValueProp ?? null)) return false;
  if (Boolean(incoming.isPublished) !== Boolean(existing.isPublished)) return false;

  if (JSON.stringify(sanitized.customHowTo || null) !== JSON.stringify(existing.customHowTo || null)) return false;
  if (JSON.stringify(sanitized.customFeatures || null) !== JSON.stringify(existing.customFeatures || null)) return false;
  if (JSON.stringify(sanitized.customFaq || null) !== JSON.stringify(existing.customFaq || null)) return false;
  if (JSON.stringify(sanitized.customRelatedTools || null) !== JSON.stringify(existing.customRelatedTools || null)) return false;
  if (!areBlocksEqual(sanitized.blocks, existing.blocks)) return false;

  if (!areSeoEqual(incoming.seo, existing.seo, false)) return false;

  return true;
}

function isCategoryUnchanged(cat: CmsBackupBlogCategory, existing: any): boolean {
  if (!existing) return false;
  return cat.name === existing.name && (cat.description ?? null) === (existing.description ?? null);
}

function isTagUnchanged(tag: CmsBackupBlogTag, existing: any): boolean {
  if (!existing) return false;
  return tag.name === existing.name;
}

function isBlogPostUnchanged(incoming: CmsBackupBlogPost, existing: any, sanitizedContent: string): boolean {
  if (!existing) return false;
  if (incoming.title !== existing.title) return false;
  if ((incoming.excerpt ?? null) !== (existing.excerpt ?? null)) return false;
  if (sanitizedContent !== existing.content) return false;
  if ((incoming.featuredImage ?? null) !== (existing.featuredImage ?? null)) return false;
  if ((incoming.featuredImageAlt ?? null) !== (existing.featuredImageAlt ?? null)) return false;
  if ((incoming.status || 'DRAFT') !== existing.status) return false;
  if ((incoming.categorySlug ?? null) !== (existing.category?.slug ?? null)) return false;

  const inTags = (incoming.tagSlugs || []).slice().sort();
  const exTags = ((existing.tags || []).map((t: any) => t.tag?.slug).filter(Boolean) as string[]).slice().sort();
  if (JSON.stringify(inTags) !== JSON.stringify(exTags)) return false;

  if (!areSeoEqual(incoming.seo, existing.seo, true)) return false;

  return true;
}

function isFormatContentUnchanged(incoming: CmsBackupFormatContent, existing: any): boolean {
  if (!existing) return false;
  if ((incoming.customTitle ?? null) !== (existing.customTitle ?? null)) return false;
  if ((incoming.customDescription ?? null) !== (existing.customDescription ?? null)) return false;
  if ((incoming.customDetails ?? null) !== (existing.customDetails ?? null)) return false;
  if ((incoming.customBestFor ?? null) !== (existing.customBestFor ?? null)) return false;
  if (JSON.stringify(incoming.customPros ?? null) !== JSON.stringify(existing.customPros ?? null)) return false;
  if (JSON.stringify(incoming.customCons ?? null) !== JSON.stringify(existing.customCons ?? null)) return false;
  return true;
}

function isMediaReferenceUnchanged(incoming: CmsBackupMediaReference, existing: any): boolean {
  if (!existing) return false;
  if ((incoming.originalFilename ?? null) !== (existing.originalFilename ?? null)) return false;
  if (incoming.mimeType !== existing.mimeType) return false;
  if (incoming.size !== existing.size) return false;
  if ((incoming.width ?? null) !== (existing.width ?? null)) return false;
  if ((incoming.height ?? null) !== (existing.height ?? null)) return false;
  if (incoming.url !== existing.url) return false;
  if ((incoming.alt ?? null) !== (existing.alt ?? null)) return false;
  if ((incoming.title ?? null) !== (existing.title ?? null)) return false;
  if ((incoming.caption ?? null) !== (existing.caption ?? null)) return false;
  if ((incoming.description ?? null) !== (existing.description ?? null)) return false;
  return true;
}

function isSiteSettingsUnchanged(sanitized: any, existingSettings: any): boolean {
  if (!existingSettings) return false;
  if ((sanitized.siteName ?? '') !== (existingSettings.siteName ?? '')) return false;
  if ((sanitized.siteUrl ?? '') !== (existingSettings.siteUrl ?? '')) return false;
  if ((sanitized.headerTagline ?? null) !== (existingSettings.headerTagline ?? null)) return false;
  if ((sanitized.headerCtaLabel ?? null) !== (existingSettings.headerCtaLabel ?? null)) return false;
  if ((sanitized.headerCtaLink ?? null) !== (existingSettings.headerCtaLink ?? null)) return false;
  if (Boolean(sanitized.headerCtaVisible) !== Boolean(existingSettings.headerCtaVisible)) return false;
  if ((sanitized.footerDescription ?? null) !== (existingSettings.footerDescription ?? null)) return false;
  if ((sanitized.copyrightText ?? null) !== (existingSettings.copyrightText ?? null)) return false;
  if ((sanitized.trustText ?? null) !== (existingSettings.trustText ?? null)) return false;

  const inNav = (sanitized.headerNav || []).map((n: any) => ({
    label: n.label,
    href: n.href,
    visible: n.visible !== false,
  }));
  const exNav = (existingSettings.headerNav || []).map((n: any) => ({
    label: n.label,
    href: n.href,
    visible: n.visible !== false,
  }));
  if (JSON.stringify(inNav) !== JSON.stringify(exNav)) return false;

  return true;
}

// ---------------------------------------------------------------------------
// Export Engine
// ---------------------------------------------------------------------------

/**
 * Exports all allowlisted CMS content and settings into a standardized versioned JSON structure.
 * Strictly excludes user accounts, passwords, sessions, secrets, logs, and binary media bytes.
 */
export async function exportCmsBackup(author: AdminUserSession): Promise<CmsBackupFile> {
  const db = getDb();

  // 1. Fetch CMS Pages with content and SEO
  const rawPages = await db.page.findMany({
    include: { content: true, seo: true },
    orderBy: { createdAt: 'asc' },
  });

  const pages: CmsBackupPage[] = rawPages.map((p: any) => ({
    slug: p.slug,
    name: p.name,
    status: p.status,
    publishedAt: p.publishedAt ? new Date(p.publishedAt).toISOString() : null,
    content: {
      version: p.content?.version ?? 1,
      isPublished: p.content?.isPublished ?? false,
      blocks: Array.isArray(p.content?.blocks) ? p.content.blocks : [],
      customCss: p.content?.customCss ?? null,
    },
    seo: p.seo
      ? {
          seoTitle: p.seo.seoTitle ?? null,
          metaDescription: p.seo.metaDescription ?? null,
          canonicalUrl: p.seo.canonicalUrl ?? null,
          robotsIndex: p.seo.robotsIndex ?? true,
          robotsFollow: p.seo.robotsFollow ?? true,
          ogTitle: p.seo.ogTitle ?? null,
          ogDescription: p.seo.ogDescription ?? null,
          ogImage: p.seo.ogImage ?? null,
          twitterTitle: p.seo.twitterTitle ?? null,
          twitterDescription: p.seo.twitterDescription ?? null,
          twitterImage: p.seo.twitterImage ?? null,
          schemaType: p.seo.schemaType ?? null,
          schemaJson: p.seo.schemaJson ?? null,
          focusKeyword: p.seo.focusKeyword ?? null,
        }
      : null,
  }));

  // 2. Fetch Tool Content with SEO
  const rawTools = await db.toolContent.findMany({
    include: { seo: true },
  });

  const toolContent: CmsBackupTool[] = rawTools.map((t: any) => ({
    toolSlug: t.toolSlug,
    customTitle: t.customTitle ?? null,
    customH1: t.customH1 ?? null,
    customDescription: t.customDescription ?? null,
    customIntro: t.customIntro ?? null,
    customValueProp: t.customValueProp ?? null,
    customHowTo: t.customHowTo ?? null,
    customFeatures: t.customFeatures ?? null,
    customFaq: t.customFaq ?? null,
    customRelatedTools: t.customRelatedTools ?? null,
    blocks: Array.isArray(t.blocks) ? t.blocks : null,
    isPublished: t.isPublished ?? false,
    seo: t.seo
      ? {
          seoTitle: t.seo.seoTitle ?? null,
          metaDescription: t.seo.metaDescription ?? null,
          canonicalUrl: t.seo.canonicalUrl ?? null,
          robotsIndex: t.seo.robotsIndex ?? true,
          robotsFollow: t.seo.robotsFollow ?? true,
          ogTitle: t.seo.ogTitle ?? null,
          ogDescription: t.seo.ogDescription ?? null,
          ogImage: t.seo.ogImage ?? null,
          schemaType: t.seo.schemaType ?? null,
          schemaJson: t.seo.schemaJson ?? null,
          focusKeyword: t.seo.focusKeyword ?? null,
        }
      : null,
  }));

  // 3. Fetch Blog Posts with categories, tags, and SEO
  const rawPosts = await db.blogPost.findMany({
    include: { category: true, tags: { include: { tag: true } }, seo: true },
    orderBy: { createdAt: 'asc' },
  });

  const blogPosts: CmsBackupBlogPost[] = rawPosts.map((bp: any) => ({
    slug: bp.slug,
    title: bp.title,
    excerpt: bp.excerpt ?? null,
    content: bp.content ?? '',
    featuredImage: bp.featuredImage ?? null,
    featuredImageAlt: bp.featuredImageAlt ?? null,
    readingTime: bp.readingTime ?? null,
    status: bp.status,
    publishedAt: bp.publishedAt ? new Date(bp.publishedAt).toISOString() : null,
    scheduledFor: bp.scheduledFor ? new Date(bp.scheduledFor).toISOString() : null,
    categorySlug: bp.category?.slug ?? null,
    tagSlugs: Array.isArray(bp.tags)
      ? bp.tags.map((t: any) => t.tag?.slug).filter(Boolean)
      : [],
    seo: bp.seo
      ? {
          seoTitle: bp.seo.seoTitle ?? null,
          metaDescription: bp.seo.metaDescription ?? null,
          canonicalUrl: bp.seo.canonicalUrl ?? null,
          robotsIndex: bp.seo.robotsIndex ?? true,
          robotsFollow: bp.seo.robotsFollow ?? true,
          ogTitle: bp.seo.ogTitle ?? null,
          ogDescription: bp.seo.ogDescription ?? null,
          ogImage: bp.seo.ogImage ?? null,
          twitterTitle: bp.seo.twitterTitle ?? null,
          twitterDescription: bp.seo.twitterDescription ?? null,
          twitterImage: bp.seo.twitterImage ?? null,
          schemaType: bp.seo.schemaType ?? null,
          schemaJson: bp.seo.schemaJson ?? null,
          focusKeyword: bp.seo.focusKeyword ?? null,
        }
      : null,
  }));

  // 4. Fetch Blog Taxonomy (Categories & Tags)
  const rawCategories = await db.blogCategory.findMany({
    orderBy: { name: 'asc' },
  });
  const categories: CmsBackupBlogCategory[] = rawCategories.map((c: any) => ({
    slug: c.slug,
    name: c.name,
    description: c.description ?? null,
  }));

  const rawTags = await db.blogTag.findMany({
    orderBy: { name: 'asc' },
  });
  const tags: CmsBackupBlogTag[] = rawTags.map((t: any) => ({
    slug: t.slug,
    name: t.name,
  }));

  // 5. Fetch Site Settings (Global, Navigation, Footer) via settings service for full persistence fidelity
  const liveSettings = await getGlobalSettings();
  const rawNavItems = await db.navigationItem.findMany({
    orderBy: { order: 'asc' },
  });

  const navigation: CmsBackupNavigationItem[] = (
    rawNavItems.length > 0 ? rawNavItems : (liveSettings.headerNav || [])
  ).map((n: any, idx: number) => ({
    menu: n.menu ?? 'header',
    label: n.label,
    destination: n.destination || n.href || '/',
    order: typeof n.order === 'number' ? n.order : idx,
    visible: n.visible !== false,
    icon: n.icon ?? null,
    isExternal: n.isExternal ?? false,
    openNewTab: n.openNewTab ?? false,
  }));

  const siteSettings: CmsBackupSiteSettings = {
    global: {
      siteName: liveSettings.siteName || 'Convert24',
      siteUrl: liveSettings.siteUrl || 'https://convert24.net',
      defaultSeoTitle: liveSettings.defaultSeoTitle ?? null,
      defaultMetaDescription: liveSettings.defaultMetaDescription ?? null,
      defaultOgImage: liveSettings.defaultOgImage ?? null,
      defaultTwitterImage: liveSettings.defaultTwitterImage ?? null,
      googleAnalyticsId: liveSettings.googleAnalyticsId ?? null,
      googleAdSenseId: liveSettings.googleAdSenseId ?? null,
      socialLinks: liveSettings.socialLinks ?? null,
      headerTagline: liveSettings.headerTagline ?? null,
      headerCtaLabel: liveSettings.headerCtaLabel ?? null,
      headerCtaLink: liveSettings.headerCtaLink ?? null,
      headerCtaVisible: liveSettings.headerCtaVisible ?? false,
    },
    navigation,
    footer: {
      brandDescription: liveSettings.footerDescription ?? null,
      copyrightText: liveSettings.copyrightText ?? null,
      trustText: liveSettings.trustText ?? null,
      linksJson: liveSettings.footerGroups ?? null,
    },
  };

  // 6. Fetch Format Content
  const rawFormats = await db.formatContent.findMany();
  const formatContents: CmsBackupFormatContent[] = rawFormats.map((f: any) => ({
    formatSlug: f.formatSlug,
    customTitle: f.customTitle ?? null,
    customDescription: f.customDescription ?? null,
    customDetails: f.customDetails ?? null,
    customBestFor: f.customBestFor ?? null,
    customPros: f.customPros ?? null,
    customCons: f.customCons ?? null,
  }));

  // 7. Fetch Media References (Metadata Only)
  const rawMedia = await db.mediaAsset.findMany({
    orderBy: { createdAt: 'asc' },
  });
  const mediaReferences: CmsBackupMediaReference[] = rawMedia.map((m: any) => ({
    filename: m.filename,
    originalFilename: m.originalFilename ?? null,
    mimeType: m.mimeType,
    size: m.size ?? 0,
    width: m.width ?? null,
    height: m.height ?? null,
    url: m.url,
    alt: m.alt ?? null,
    title: m.title ?? null,
    caption: m.caption ?? null,
    description: m.description ?? null,
  }));

  const backupData: CmsBackupData = {
    pages,
    toolContent,
    blogPosts,
    blogTaxonomy: {
      categories,
      tags,
    },
    siteSettings,
    formatContents,
    mediaReferences,
  };

  const backupFile: CmsBackupFile = {
    exportFormat: CMS_BACKUP_FORMAT_IDENTIFIER,
    formatVersion: CMS_BACKUP_CURRENT_VERSION,
    exportedAt: new Date().toISOString(),
    exportedBy: {
      id: author.id,
      email: author.email,
      name: author.name,
    },
    site: {
      name: siteSettings.global.siteName || 'Convert24',
      url: siteSettings.global.siteUrl || 'https://convert24.net',
    },
    data: backupData,
  };

  // 8. Record Audit Log for Export (stores counts only, never payload or credentials)
  await createAuditLog({
    userId: author.id,
    action: 'CMS_BACKUP_EXPORT',
    entityType: 'BACKUP',
    entityId: null,
    metadata: {
      exportedPages: pages.length,
      exportedTools: toolContent.length,
      exportedBlogPosts: blogPosts.length,
      exportedCategories: categories.length,
      exportedTags: tags.length,
      exportedMediaReferences: mediaReferences.length,
      formatVersion: CMS_BACKUP_CURRENT_VERSION,
      userEmail: author.email,
    },
  });

  return backupFile;
}

// ---------------------------------------------------------------------------
// Validation & Preview Engine (Zero-write guarantee)
// ---------------------------------------------------------------------------

/**
 * Validates a backup JSON payload without altering database state.
 * Performs deep recursive block validation, depth checks, duplicate-key checks,
 * missing-reference detection, and content comparison for accurate create vs update vs skip counts.
 */
export async function validateAndPreviewBackup(rawInput: unknown): Promise<CmsBackupPreviewResult> {
  const blockingErrors: string[] = [];
  const globalWarnings: string[] = [];

  const defaultSummary = (): CmsBackupSectionSummary => ({
    total: 0,
    toCreate: 0,
    toUpdate: 0,
    toSkip: 0,
    errors: [],
    warnings: [],
    details: [],
  });

  const summary = {
    pages: defaultSummary(),
    toolContent: defaultSummary(),
    blogPosts: defaultSummary(),
    blogTaxonomy: defaultSummary(),
    siteSettings: defaultSummary(),
    formatContents: defaultSummary(),
    mediaReferences: defaultSummary(),
  };

  // 1. Initial Type & Format Checks
  if (!rawInput || typeof rawInput !== 'object') {
    blockingErrors.push('Backup payload must be a valid JSON object.');
    return buildPreviewResult(false, '', 0, blockingErrors, globalWarnings, summary);
  }

  const payload = rawInput as Partial<CmsBackupFile>;

  if (payload.exportFormat !== CMS_BACKUP_FORMAT_IDENTIFIER) {
    blockingErrors.push(
      `Unsupported backup format '${String(payload.exportFormat || 'unknown')}'. Expected '${CMS_BACKUP_FORMAT_IDENTIFIER}'.`
    );
  }

  if (payload.formatVersion !== CMS_BACKUP_CURRENT_VERSION) {
    blockingErrors.push(
      `Unsupported backup version '${String(payload.formatVersion || 'unknown')}'. Supported version is ${CMS_BACKUP_CURRENT_VERSION}.`
    );
  }

  if (!payload.data || typeof payload.data !== 'object') {
    blockingErrors.push("Backup file is missing the required 'data' object.");
    return buildPreviewResult(false, payload.exportFormat || '', payload.formatVersion || 0, blockingErrors, globalWarnings, summary, payload);
  }

  const data = payload.data;
  const db = getDb();

  // Known taxonomy and media sets for cross-reference validation
  const backupCatSlugs = new Set<string>();
  if (Array.isArray(data.blogTaxonomy?.categories)) {
    data.blogTaxonomy.categories.forEach((c) => c?.slug && backupCatSlugs.add(c.slug.trim()));
  }
  const backupTagSlugs = new Set<string>();
  if (Array.isArray(data.blogTaxonomy?.tags)) {
    data.blogTaxonomy.tags.forEach((t) => t?.slug && backupTagSlugs.add(t.slug.trim()));
  }
  const backupMediaFilenames = new Set<string>();
  if (Array.isArray(data.mediaReferences)) {
    data.mediaReferences.forEach((m) => m?.filename && backupMediaFilenames.add(m.filename.trim()));
  }

  // 2. Validate Pages
  if (data.pages !== undefined) {
    if (!Array.isArray(data.pages)) {
      summary.pages.errors.push("'pages' section must be an array.");
      blockingErrors.push("'pages' section must be an array.");
    } else {
      summary.pages.total = data.pages.length;
      const seenPageSlugs = new Set<string>();

      for (let i = 0; i < data.pages.length; i++) {
        const page = data.pages[i];
        if (!page || typeof page !== 'object') {
          summary.pages.errors.push(`Page [${i}] is malformed.`);
          blockingErrors.push(`Page [${i}] is malformed.`);
          continue;
        }

        const slug = String(page.slug || '').trim();
        const name = String(page.name || slug || `Page ${i + 1}`).trim();

        if (!slug) {
          summary.pages.errors.push(`Page [${i}] is missing a slug.`);
          blockingErrors.push(`Page [${i}] is missing a slug.`);
          continue;
        }

        // Check duplicate keys in payload
        if (seenPageSlugs.has(slug)) {
          const err = `Duplicate page slug '${slug}' found in backup payload.`;
          summary.pages.errors.push(err);
          blockingErrors.push(err);
          summary.pages.details.push({
            key: slug,
            title: name,
            action: 'skip',
            status: 'error',
            reason: err,
          });
          continue;
        }
        seenPageSlugs.add(slug);

        // Validate page payload structure and nested blocks
        const pageVal = validatePagePayload({
          slug,
          name,
          blocks: page.content?.blocks,
          customCss: page.content?.customCss || undefined,
          seo: page.seo || undefined,
        });

        let itemStatus: 'valid' | 'warning' | 'error' = 'valid';
        let itemReason: string | undefined;

        if (!pageVal.isValid) {
          const firstErr = pageVal.report.errors[0]?.message || 'Validation error in page.';
          summary.pages.errors.push(`Page '${slug}': ${firstErr}`);
          blockingErrors.push(`Page '${slug}': ${firstErr}`);
          itemStatus = 'error';
          itemReason = firstErr;
        } else if (pageVal.report.warnings.length > 0) {
          itemStatus = 'warning';
          itemReason = pageVal.report.warnings[0].message;
          summary.pages.warnings.push(`Page '${slug}': ${itemReason}`);
        }

        // Check if page exists in DB and perform content comparison
        const existing = await db.page.findUnique({
          where: { slug },
          include: { content: true, seo: true },
        });

        let action: 'create' | 'update' | 'skip';
        if (itemStatus === 'error') {
          action = 'skip';
        } else if (!existing) {
          action = 'create';
          summary.pages.toCreate++;
        } else {
          const unchanged = isPageUnchanged(page, existing, pageVal.sanitizedBlocks);
          if (unchanged) {
            action = 'skip';
            itemReason = 'Unchanged (matches current database record)';
            summary.pages.toSkip++;
          } else {
            action = 'update';
            summary.pages.toUpdate++;
          }
        }

        summary.pages.details.push({
          key: slug,
          title: name,
          action,
          status: itemStatus,
          reason: itemReason,
        });
      }
    }
  }

  // 3. Validate Tool Content
  if (data.toolContent !== undefined) {
    if (!Array.isArray(data.toolContent)) {
      summary.toolContent.errors.push("'toolContent' section must be an array.");
      blockingErrors.push("'toolContent' section must be an array.");
    } else {
      summary.toolContent.total = data.toolContent.length;
      const seenToolSlugs = new Set<string>();

      for (let i = 0; i < data.toolContent.length; i++) {
        const tc = data.toolContent[i];
        if (!tc || typeof tc !== 'object') {
          summary.toolContent.errors.push(`ToolContent [${i}] is malformed.`);
          blockingErrors.push(`ToolContent [${i}] is malformed.`);
          continue;
        }

        const slug = String(tc.toolSlug || '').trim();
        if (!slug) {
          summary.toolContent.errors.push(`ToolContent [${i}] is missing 'toolSlug'.`);
          blockingErrors.push(`ToolContent [${i}] is missing 'toolSlug'.`);
          continue;
        }

        if (seenToolSlugs.has(slug)) {
          const err = `Duplicate tool slug '${slug}' found in backup payload.`;
          summary.toolContent.errors.push(err);
          blockingErrors.push(err);
          summary.toolContent.details.push({
            key: slug,
            title: slug,
            action: 'skip',
            status: 'error',
            reason: err,
          });
          continue;
        }
        seenToolSlugs.add(slug);

        const canonical = getToolBySlug(slug);
        if (!canonical) {
          const err = `Tool slug '${slug}' is not recognized in the canonical registry.`;
          summary.toolContent.errors.push(err);
          blockingErrors.push(err);
          summary.toolContent.details.push({
            key: slug,
            title: slug,
            action: 'skip',
            status: 'error',
            reason: err,
          });
          continue;
        }

        const toolVal = validateToolPayload(slug, {
          customTitle: tc.customTitle,
          customH1: tc.customH1,
          customDescription: tc.customDescription,
          customIntro: tc.customIntro,
          customValueProp: tc.customValueProp,
          customHowTo: tc.customHowTo,
          customFeatures: tc.customFeatures,
          customFaq: tc.customFaq,
          customRelatedTools: tc.customRelatedTools,
          blocks: tc.blocks,
          seo: tc.seo || undefined,
        });

        let itemStatus: 'valid' | 'warning' | 'error' = 'valid';
        let itemReason: string | undefined;

        if (!toolVal.isValid) {
          const firstErr = toolVal.report.errors[0]?.message || 'Validation error in tool.';
          summary.toolContent.errors.push(`Tool '${slug}': ${firstErr}`);
          blockingErrors.push(`Tool '${slug}': ${firstErr}`);
          itemStatus = 'error';
          itemReason = firstErr;
        } else if (toolVal.report.warnings.length > 0) {
          itemStatus = 'warning';
          itemReason = toolVal.report.warnings[0].message;
          summary.toolContent.warnings.push(`Tool '${slug}': ${itemReason}`);
        }

        const existing = await db.toolContent.findUnique({
          where: { toolSlug: slug },
          include: { seo: true },
        });

        let action: 'create' | 'update' | 'skip';
        if (itemStatus === 'error') {
          action = 'skip';
        } else if (!existing) {
          action = 'create';
          summary.toolContent.toCreate++;
        } else {
          const unchanged = isToolContentUnchanged(tc, existing, toolVal.sanitized);
          if (unchanged) {
            action = 'skip';
            itemReason = 'Unchanged (matches current database record)';
            summary.toolContent.toSkip++;
          } else {
            action = 'update';
            summary.toolContent.toUpdate++;
          }
        }

        summary.toolContent.details.push({
          key: slug,
          title: tc.customTitle || canonical.name || slug,
          action,
          status: itemStatus,
          reason: itemReason,
        });
      }
    }
  }

  // 4. Validate Blog Taxonomy
  if (data.blogTaxonomy !== undefined) {
    if (typeof data.blogTaxonomy !== 'object' || data.blogTaxonomy === null) {
      summary.blogTaxonomy.errors.push("'blogTaxonomy' section must be an object.");
      blockingErrors.push("'blogTaxonomy' section must be an object.");
    } else {
      const cats = Array.isArray(data.blogTaxonomy.categories) ? data.blogTaxonomy.categories : [];
      const tags = Array.isArray(data.blogTaxonomy.tags) ? data.blogTaxonomy.tags : [];
      summary.blogTaxonomy.total = cats.length + tags.length;

      const seenCatSlugs = new Set<string>();
      for (const cat of cats) {
        const slug = String(cat?.slug || '').trim();
        if (seenCatSlugs.has(slug)) {
          const err = `Duplicate category slug '${slug}' found in taxonomy.`;
          summary.blogTaxonomy.errors.push(err);
          blockingErrors.push(err);
          continue;
        }
        if (slug) seenCatSlugs.add(slug);

        const catVal = validateCategoryPayload(cat);
        let itemStatus: 'valid' | 'warning' | 'error' = 'valid';
        let itemReason: string | undefined;

        if (!catVal.isValid) {
          itemStatus = 'error';
          itemReason = catVal.report.errors[0]?.message || 'Invalid category.';
          summary.blogTaxonomy.errors.push(`Category '${cat.slug || cat.name}': ${itemReason}`);
          blockingErrors.push(`Category '${cat.slug || cat.name}': ${itemReason}`);
        }

        const existing = cat.slug ? await db.blogCategory.findUnique({ where: { slug: cat.slug } }) : null;

        let action: 'create' | 'update' | 'skip';
        if (itemStatus === 'error') {
          action = 'skip';
        } else if (!existing) {
          action = 'create';
          summary.blogTaxonomy.toCreate++;
        } else {
          const unchanged = isCategoryUnchanged(cat, existing);
          if (unchanged) {
            action = 'skip';
            itemReason = 'Unchanged (matches database)';
            summary.blogTaxonomy.toSkip++;
          } else {
            action = 'update';
            summary.blogTaxonomy.toUpdate++;
          }
        }

        summary.blogTaxonomy.details.push({
          key: `cat:${cat.slug || cat.name}`,
          title: cat.name || cat.slug,
          action,
          status: itemStatus,
          reason: itemReason,
        });
      }

      const seenTagSlugs = new Set<string>();
      for (const tag of tags) {
        const slug = String(tag?.slug || '').trim();
        if (seenTagSlugs.has(slug)) {
          const err = `Duplicate tag slug '${slug}' found in taxonomy.`;
          summary.blogTaxonomy.errors.push(err);
          blockingErrors.push(err);
          continue;
        }
        if (slug) seenTagSlugs.add(slug);

        const tagVal = validateTagPayload(tag);
        let itemStatus: 'valid' | 'warning' | 'error' = 'valid';
        let itemReason: string | undefined;

        if (!tagVal.isValid) {
          itemStatus = 'error';
          itemReason = tagVal.report.errors[0]?.message || 'Invalid tag.';
          summary.blogTaxonomy.errors.push(`Tag '${tag.slug || tag.name}': ${itemReason}`);
          blockingErrors.push(`Tag '${tag.slug || tag.name}': ${itemReason}`);
        }

        const existing = tag.slug ? await db.blogTag.findUnique({ where: { slug: tag.slug } }) : null;

        let action: 'create' | 'update' | 'skip';
        if (itemStatus === 'error') {
          action = 'skip';
        } else if (!existing) {
          action = 'create';
          summary.blogTaxonomy.toCreate++;
        } else {
          const unchanged = isTagUnchanged(tag, existing);
          if (unchanged) {
            action = 'skip';
            itemReason = 'Unchanged (matches database)';
            summary.blogTaxonomy.toSkip++;
          } else {
            action = 'update';
            summary.blogTaxonomy.toUpdate++;
          }
        }

        summary.blogTaxonomy.details.push({
          key: `tag:${tag.slug || tag.name}`,
          title: tag.name || tag.slug,
          action,
          status: itemStatus,
          reason: itemReason,
        });
      }
    }
  }

  // 5. Validate Blog Posts
  if (data.blogPosts !== undefined) {
    if (!Array.isArray(data.blogPosts)) {
      summary.blogPosts.errors.push("'blogPosts' section must be an array.");
      blockingErrors.push("'blogPosts' section must be an array.");
    } else {
      summary.blogPosts.total = data.blogPosts.length;
      const seenPostSlugs = new Set<string>();

      for (let i = 0; i < data.blogPosts.length; i++) {
        const bp = data.blogPosts[i];
        if (!bp || typeof bp !== 'object') {
          summary.blogPosts.errors.push(`BlogPost [${i}] is malformed.`);
          blockingErrors.push(`BlogPost [${i}] is malformed.`);
          continue;
        }

        const slug = String(bp.slug || '').trim();
        const title = String(bp.title || slug || `Post ${i + 1}`).trim();

        if (seenPostSlugs.has(slug)) {
          const err = `Duplicate blog post slug '${slug}' found in backup payload.`;
          summary.blogPosts.errors.push(err);
          blockingErrors.push(err);
          summary.blogPosts.details.push({
            key: slug,
            title,
            action: 'skip',
            status: 'error',
            reason: err,
          });
          continue;
        }
        if (slug) seenPostSlugs.add(slug);

        const bpVal = validateBlogPostPayload({
          title,
          slug,
          excerpt: bp.excerpt,
          content: bp.content,
          featuredImage: bp.featuredImage,
          featuredImageAlt: bp.featuredImageAlt,
          status: bp.status,
          scheduledFor: bp.scheduledFor,
          seo: bp.seo || undefined,
        });

        let itemStatus: 'valid' | 'warning' | 'error' = 'valid';
        let itemReason: string | undefined;

        if (!bpVal.isValid) {
          itemStatus = 'error';
          itemReason = bpVal.report.errors[0]?.message || 'Validation error in blog post.';
          summary.blogPosts.errors.push(`Post '${slug}': ${itemReason}`);
          blockingErrors.push(`Post '${slug}': ${itemReason}`);
        } else if (bpVal.report.warnings.length > 0) {
          itemStatus = 'warning';
          itemReason = bpVal.report.warnings[0].message;
          summary.blogPosts.warnings.push(`Post '${slug}': ${itemReason}`);
        }

        // Check related entities (category & tags) existence
        if (bp.categorySlug) {
          const catExistsInDb = await db.blogCategory.findUnique({ where: { slug: bp.categorySlug } });
          if (!catExistsInDb && !backupCatSlugs.has(bp.categorySlug)) {
            const warn = `Post '${slug}' references category '${bp.categorySlug}' which does not exist in database or backup taxonomy and will be unlinked.`;
            summary.blogPosts.warnings.push(warn);
            globalWarnings.push(warn);
          }
        }

        if (Array.isArray(bp.tagSlugs)) {
          for (const tSlug of bp.tagSlugs) {
            const tagExistsInDb = await db.blogTag.findUnique({ where: { slug: tSlug } });
            if (!tagExistsInDb && !backupTagSlugs.has(tSlug)) {
              const warn = `Post '${slug}' references tag '${tSlug}' which does not exist in database or backup taxonomy and will be omitted.`;
              summary.blogPosts.warnings.push(warn);
              globalWarnings.push(warn);
            }
          }
        }

        const existing = slug
          ? await db.blogPost.findUnique({
              where: { slug },
              include: { category: true, tags: { include: { tag: true } }, seo: true },
            })
          : null;

        let action: 'create' | 'update' | 'skip';
        if (itemStatus === 'error') {
          action = 'skip';
        } else if (!existing) {
          action = 'create';
          summary.blogPosts.toCreate++;
        } else {
          const unchanged = isBlogPostUnchanged(bp, existing, bpVal.sanitized.content);
          if (unchanged) {
            action = 'skip';
            itemReason = 'Unchanged (matches current database record)';
            summary.blogPosts.toSkip++;
          } else {
            action = 'update';
            summary.blogPosts.toUpdate++;
          }
        }

        summary.blogPosts.details.push({
          key: slug,
          title,
          action,
          status: itemStatus,
          reason: itemReason,
        });
      }
    }
  }

  // 6. Validate Site Settings
  if (data.siteSettings !== undefined) {
    if (typeof data.siteSettings !== 'object' || data.siteSettings === null) {
      summary.siteSettings.errors.push("'siteSettings' section must be an object.");
      blockingErrors.push("'siteSettings' section must be an object.");
    } else {
      summary.siteSettings.total = 1;
      const setVal = validateSettingsPayload({
        ...data.siteSettings.global,
        headerNav: data.siteSettings.navigation,
        footerDescription: data.siteSettings.footer?.brandDescription,
        copyrightText: data.siteSettings.footer?.copyrightText,
        trustText: data.siteSettings.footer?.trustText,
        footerGroups: Array.isArray(data.siteSettings.footer?.linksJson)
          ? data.siteSettings.footer.linksJson
          : undefined,
      });

      let itemStatus: 'valid' | 'warning' | 'error' = 'valid';
      let itemReason: string | undefined;

      if (!setVal.isValid) {
        itemStatus = 'error';
        itemReason = setVal.report.errors[0]?.message || 'Invalid settings configuration.';
        summary.siteSettings.errors.push(itemReason);
        blockingErrors.push(`Settings: ${itemReason}`);
      }

      const existingSettings = await getGlobalSettings();
      let action: 'create' | 'update' | 'skip';

      if (itemStatus === 'error') {
        action = 'skip';
      } else {
        const unchanged = isSiteSettingsUnchanged(setVal.sanitized, existingSettings);
        if (unchanged) {
          action = 'skip';
          itemReason = 'Unchanged (matches current database settings)';
          summary.siteSettings.toSkip = 1;
        } else {
          action = 'update';
          summary.siteSettings.toUpdate = 1;
        }
      }

      summary.siteSettings.details.push({
        key: 'site-settings',
        title: data.siteSettings.global?.siteName || 'Global Site Settings',
        action,
        status: itemStatus,
        reason: itemReason,
      });
    }
  }

  // 7. Validate Format Content
  if (data.formatContents !== undefined) {
    if (!Array.isArray(data.formatContents)) {
      summary.formatContents.errors.push("'formatContents' section must be an array.");
      blockingErrors.push("'formatContents' section must be an array.");
    } else {
      summary.formatContents.total = data.formatContents.length;
      const seenFormatSlugs = new Set<string>();

      for (const fc of data.formatContents) {
        const slug = String(fc.formatSlug || '').trim();
        if (!slug) {
          summary.formatContents.errors.push("Format item missing 'formatSlug'.");
          blockingErrors.push("Format item missing 'formatSlug'.");
          continue;
        }

        if (seenFormatSlugs.has(slug)) {
          const err = `Duplicate format slug '${slug}' found in backup payload.`;
          summary.formatContents.errors.push(err);
          blockingErrors.push(err);
          continue;
        }
        seenFormatSlugs.add(slug);

        const existing = await db.formatContent.findUnique({ where: { formatSlug: slug } });
        let action: 'create' | 'update' | 'skip';
        let reason: string | undefined;

        if (!existing) {
          action = 'create';
          summary.formatContents.toCreate++;
        } else {
          const unchanged = isFormatContentUnchanged(fc, existing);
          if (unchanged) {
            action = 'skip';
            reason = 'Unchanged (matches database)';
            summary.formatContents.toSkip++;
          } else {
            action = 'update';
            summary.formatContents.toUpdate++;
          }
        }

        summary.formatContents.details.push({
          key: slug,
          title: fc.customTitle || slug.toUpperCase(),
          action,
          status: 'valid',
          reason,
        });
      }
    }
  }

  // 8. Validate Media References
  if (data.mediaReferences !== undefined) {
    if (!Array.isArray(data.mediaReferences)) {
      summary.mediaReferences.errors.push("'mediaReferences' section must be an array.");
      blockingErrors.push("'mediaReferences' section must be an array.");
    } else {
      summary.mediaReferences.total = data.mediaReferences.length;
      const seenMediaFilenames = new Set<string>();

      for (const m of data.mediaReferences) {
        const filename = String(m.filename || '').trim();
        const url = String(m.url || '').trim();

        if (!filename || !url) {
          summary.mediaReferences.errors.push('Media item missing filename or URL.');
          blockingErrors.push('Media item missing filename or URL.');
          continue;
        }

        if (seenMediaFilenames.has(filename)) {
          const err = `Duplicate media filename '${filename}' found in backup payload.`;
          summary.mediaReferences.errors.push(err);
          blockingErrors.push(err);
          continue;
        }
        seenMediaFilenames.add(filename);

        if (!isSafeUrl(url)) {
          const err = `Media '${filename}' has unsafe URL '${url}'.`;
          summary.mediaReferences.errors.push(err);
          blockingErrors.push(err);
          summary.mediaReferences.details.push({
            key: filename,
            title: m.title || filename,
            action: 'skip',
            status: 'error',
            reason: err,
          });
          continue;
        }

        const existing = await db.mediaAsset.findUnique({ where: { filename } });
        let action: 'create' | 'update' | 'skip';
        let reason: string | undefined;

        if (!existing) {
          action = 'create';
          summary.mediaReferences.toCreate++;
        } else {
          const unchanged = isMediaReferenceUnchanged(m, existing);
          if (unchanged) {
            action = 'skip';
            reason = 'Unchanged (matches database)';
            summary.mediaReferences.toSkip++;
          } else {
            action = 'update';
            summary.mediaReferences.toUpdate++;
          }
        }

        summary.mediaReferences.details.push({
          key: filename,
          title: m.title || filename,
          action,
          status: 'valid',
          reason,
        });
      }
    }
  }

  return buildPreviewResult(
    blockingErrors.length === 0,
    payload.exportFormat || '',
    payload.formatVersion || 0,
    blockingErrors,
    globalWarnings,
    summary,
    payload
  );
}

function buildPreviewResult(
  isValid: boolean,
  exportFormat: string,
  formatVersion: number,
  blockingErrors: string[],
  warnings: string[],
  summary: CmsBackupPreviewResult['summary'],
  payload?: Partial<CmsBackupFile>
): CmsBackupPreviewResult {
  const sections = Object.values(summary);
  const totalRecords = sections.reduce((acc, s) => acc + s.total, 0);
  const toCreate = sections.reduce((acc, s) => acc + s.toCreate, 0);
  const toUpdate = sections.reduce((acc, s) => acc + s.toUpdate, 0);
  const toSkip = sections.reduce((acc, s) => acc + s.toSkip, 0);
  const totalErrors = blockingErrors.length;
  const totalWarnings = warnings.length + sections.reduce((acc, s) => acc + s.warnings.length, 0);

  return {
    isValid,
    exportFormat,
    formatVersion,
    exportedAt: payload?.exportedAt,
    exportedBy: payload?.exportedBy,
    site: payload?.site,
    summary,
    totals: {
      totalRecords,
      toCreate,
      toUpdate,
      toSkip,
      totalErrors,
      totalWarnings,
    },
    blockingErrors,
    warnings,
  };
}

// ---------------------------------------------------------------------------
// Restore Engine (Transactional Dependency-Ordered Merge)
// ---------------------------------------------------------------------------

/**
 * Restores CMS content from an allowlisted, pre-validated backup inside a single database transaction.
 * Preserves non-destructive merge semantics and dependency ordering.
 */
export async function restoreCmsBackup(
  rawInput: unknown,
  author: AdminUserSession
): Promise<CmsBackupRestoreResult> {
  const startTime = Date.now();

  // 1. Mandatory Pre-Validation Phase (ABORTS WITHOUT WRITES IF INVALID)
  const preview = await validateAndPreviewBackup(rawInput);
  if (!preview.isValid) {
    return {
      success: false,
      message: `Restore aborted: validation failed with ${preview.blockingErrors.length} blocking error(s). No changes were made.`,
      durationMs: Date.now() - startTime,
      restored: {
        pages: { created: 0, updated: 0, skipped: 0 },
        toolContent: { created: 0, updated: 0, skipped: 0 },
        blogPosts: { created: 0, updated: 0, skipped: 0 },
        blogCategories: { created: 0, updated: 0, skipped: 0 },
        blogTags: { created: 0, updated: 0, skipped: 0 },
        siteSettings: { updated: false, navigationCount: 0, footerUpdated: false, skipped: true },
        formatContents: { created: 0, updated: 0, skipped: 0 },
        mediaReferences: { created: 0, updated: 0, skipped: 0 },
      },
      skippedCount: preview.totals.toSkip,
      failedCount: preview.blockingErrors.length,
      errors: preview.blockingErrors,
    };
  }

  const payload = rawInput as CmsBackupFile;
  const data = payload.data;
  const db = getDb();

  const counts = {
    pages: { created: 0, updated: 0, skipped: 0 },
    toolContent: { created: 0, updated: 0, skipped: 0 },
    blogPosts: { created: 0, updated: 0, skipped: 0 },
    blogCategories: { created: 0, updated: 0, skipped: 0 },
    blogTags: { created: 0, updated: 0, skipped: 0 },
    siteSettings: { updated: false, navigationCount: 0, footerUpdated: false, skipped: false },
    formatContents: { created: 0, updated: 0, skipped: 0 },
    mediaReferences: { created: 0, updated: 0, skipped: 0 },
  };

  try {
    // 2. Transactional Dependency-Ordered Execution
    await db.$transaction(async (tx: any) => {
      // Step A: Restore Blog Taxonomy (Categories & Tags) first
      if (data.blogTaxonomy) {
        if (Array.isArray(data.blogTaxonomy.categories)) {
          for (const cat of data.blogTaxonomy.categories) {
            const catVal = validateCategoryPayload(cat);
            if (!catVal.isValid) continue;

            const existing = await tx.blogCategory.findUnique({ where: { slug: catVal.sanitized.slug } });
            if (existing && isCategoryUnchanged(cat, existing)) {
              counts.blogCategories.skipped++;
              continue;
            }

            await tx.blogCategory.upsert({
              where: { slug: catVal.sanitized.slug },
              create: {
                slug: catVal.sanitized.slug,
                name: catVal.sanitized.name,
                description: catVal.sanitized.description,
              },
              update: {
                name: catVal.sanitized.name,
                description: catVal.sanitized.description,
              },
            });

            if (existing) counts.blogCategories.updated++;
            else counts.blogCategories.created++;
          }
        }

        if (Array.isArray(data.blogTaxonomy.tags)) {
          for (const tag of data.blogTaxonomy.tags) {
            const tagVal = validateTagPayload(tag);
            if (!tagVal.isValid) continue;

            const existing = await tx.blogTag.findUnique({ where: { slug: tagVal.sanitized.slug } });
            if (existing && isTagUnchanged(tag, existing)) {
              counts.blogTags.skipped++;
              continue;
            }

            await tx.blogTag.upsert({
              where: { slug: tagVal.sanitized.slug },
              create: {
                slug: tagVal.sanitized.slug,
                name: tagVal.sanitized.name,
              },
              update: {
                name: tagVal.sanitized.name,
              },
            });

            if (existing) counts.blogTags.updated++;
            else counts.blogTags.created++;
          }
        }
      }

      // Step B: Restore Site Settings (Global, Navigation, Footer)
      if (data.siteSettings) {
        const settingsVal = validateSettingsPayload({
          ...data.siteSettings.global,
          headerNav: data.siteSettings.navigation,
          footerDescription: data.siteSettings.footer?.brandDescription,
          copyrightText: data.siteSettings.footer?.copyrightText,
          trustText: data.siteSettings.footer?.trustText,
          footerGroups: Array.isArray(data.siteSettings.footer?.linksJson)
            ? data.siteSettings.footer.linksJson
            : undefined,
        });

        if (settingsVal.isValid) {
          const existingSettings = await getGlobalSettings();
          const unchanged = isSiteSettingsUnchanged(settingsVal.sanitized, existingSettings);

          if (unchanged) {
            counts.siteSettings.skipped = true;
          } else {
            // Bundle header & footer metadata into socialLinks JSONB for universal Prisma compatibility
            const socialLinksData: Record<string, any> = {
              ...(settingsVal.sanitized.socialLinks || {}),
              __header: {
                siteLogo: settingsVal.sanitized.siteLogo,
                headerTagline: settingsVal.sanitized.headerTagline,
                headerCtaLabel: settingsVal.sanitized.headerCtaLabel,
                headerCtaLink: settingsVal.sanitized.headerCtaLink,
                headerCtaVisible: settingsVal.sanitized.headerCtaVisible,
                headerNav: settingsVal.sanitized.headerNav,
              },
              __footer: {
                brandDescription: settingsVal.sanitized.footerDescription,
                copyrightText: settingsVal.sanitized.copyrightText,
                trustText: settingsVal.sanitized.trustText,
                groups: settingsVal.sanitized.footerGroups,
              },
            };

            // Only pass valid GlobalSettings columns defined in Prisma schema
            await tx.globalSettings.upsert({
              where: { id: 'default' },
              create: {
                id: 'default',
                siteName: settingsVal.sanitized.siteName || 'Convert24',
                siteUrl: settingsVal.sanitized.siteUrl || 'https://convert24.net',
                defaultSeoTitle: settingsVal.sanitized.defaultSeoTitle,
                defaultMetaDescription: settingsVal.sanitized.defaultMetaDescription,
                defaultOgImage: settingsVal.sanitized.defaultOgImage,
                defaultTwitterImage: settingsVal.sanitized.defaultTwitterImage,
                googleAnalyticsId: settingsVal.sanitized.googleAnalyticsId,
                googleAdSenseId: settingsVal.sanitized.googleAdSenseId,
                socialLinks: socialLinksData as any,
              },
              update: {
                ...(settingsVal.sanitized.siteName ? { siteName: settingsVal.sanitized.siteName } : {}),
                ...(settingsVal.sanitized.siteUrl ? { siteUrl: settingsVal.sanitized.siteUrl } : {}),
                defaultSeoTitle: settingsVal.sanitized.defaultSeoTitle,
                defaultMetaDescription: settingsVal.sanitized.defaultMetaDescription,
                defaultOgImage: settingsVal.sanitized.defaultOgImage,
                defaultTwitterImage: settingsVal.sanitized.defaultTwitterImage,
                googleAnalyticsId: settingsVal.sanitized.googleAnalyticsId,
                googleAdSenseId: settingsVal.sanitized.googleAdSenseId,
                socialLinks: socialLinksData as any,
              },
            });
            counts.siteSettings.updated = true;

            // Header Navigation Items
            if (Array.isArray(settingsVal.sanitized.headerNav)) {
              await tx.navigationItem.deleteMany({ where: { menu: 'header' } });
              for (const nav of settingsVal.sanitized.headerNav) {
                await tx.navigationItem.create({
                  data: {
                    menu: 'header',
                    label: nav.label,
                    destination: nav.href,
                    order: nav.order ?? 0,
                    visible: nav.visible !== false,
                    icon: null,
                    isExternal: Boolean(nav.isExternal),
                    openNewTab: Boolean(nav.openNewTab),
                  },
                });
                counts.siteSettings.navigationCount++;
              }
            }

            // Footer Settings
            await tx.footerSettings.upsert({
              where: { id: 'default' },
              create: {
                id: 'default',
                brandDescription: settingsVal.sanitized.footerDescription,
                copyrightText: settingsVal.sanitized.copyrightText,
                trustText: settingsVal.sanitized.trustText,
                linksJson: settingsVal.sanitized.footerGroups || [],
              },
              update: {
                brandDescription: settingsVal.sanitized.footerDescription,
                copyrightText: settingsVal.sanitized.copyrightText,
                trustText: settingsVal.sanitized.trustText,
                linksJson: settingsVal.sanitized.footerGroups || [],
              },
            });
            counts.siteSettings.footerUpdated = true;
          }
        }
      }

      // Step C: Restore Media References (Metadata Only)
      if (Array.isArray(data.mediaReferences)) {
        for (const m of data.mediaReferences) {
          if (!m.filename || !m.url || !isSafeUrl(m.url)) continue;

          const existing = await tx.mediaAsset.findUnique({ where: { filename: m.filename } });
          if (existing && isMediaReferenceUnchanged(m, existing)) {
            counts.mediaReferences.skipped++;
            continue;
          }

          await tx.mediaAsset.upsert({
            where: { filename: m.filename },
            create: {
              filename: m.filename,
              originalFilename: m.originalFilename || m.filename,
              mimeType: m.mimeType || 'image/png',
              size: m.size || 0,
              width: m.width || null,
              height: m.height || null,
              url: m.url,
              storagePath: '',
              alt: m.alt || null,
              title: m.title || null,
              caption: m.caption || null,
              description: m.description || null,
              uploadedById: author.id,
            },
            update: {
              originalFilename: m.originalFilename || m.filename,
              mimeType: m.mimeType || 'image/png',
              size: m.size || 0,
              width: m.width || null,
              height: m.height || null,
              url: m.url,
              alt: m.alt || null,
              title: m.title || null,
              caption: m.caption || null,
              description: m.description || null,
            },
          });

          if (existing) counts.mediaReferences.updated++;
          else counts.mediaReferences.created++;
        }
      }

      // Step D: Restore CMS Pages
      if (Array.isArray(data.pages)) {
        for (const p of data.pages) {
          const pageVal = validatePagePayload({
            slug: p.slug,
            name: p.name,
            blocks: p.content?.blocks,
            customCss: p.content?.customCss || undefined,
            seo: p.seo || undefined,
          });

          if (!pageVal.isValid) continue;

          const existingPage = await tx.page.findUnique({
            where: { slug: p.slug },
            include: { content: true, seo: true },
          });

          if (existingPage && isPageUnchanged(p, existingPage, pageVal.sanitizedBlocks)) {
            counts.pages.skipped++;
            continue;
          }

          const page = await tx.page.upsert({
            where: { slug: p.slug },
            create: {
              slug: p.slug,
              name: p.name,
              status: p.status || 'DRAFT',
              publishedAt: p.status === 'PUBLISHED' ? (p.publishedAt ? new Date(p.publishedAt) : new Date()) : null,
            },
            update: {
              name: p.name,
              status: p.status || 'DRAFT',
              publishedAt: p.status === 'PUBLISHED' ? (p.publishedAt ? new Date(p.publishedAt) : new Date()) : null,
            },
          });

          // Upsert PageContent
          await tx.pageContent.upsert({
            where: { pageId: page.id },
            create: {
              pageId: page.id,
              version: p.content?.version ?? 1,
              isPublished: p.content?.isPublished ?? (p.status === 'PUBLISHED'),
              blocks: pageVal.sanitizedBlocks,
              customCss: pageVal.sanitizedBlocks ? p.content?.customCss || null : null,
            },
            update: {
              version: p.content?.version ?? 1,
              isPublished: p.content?.isPublished ?? (p.status === 'PUBLISHED'),
              blocks: pageVal.sanitizedBlocks,
              customCss: p.content?.customCss ? sanitizeCustomCss(p.content.customCss) : null,
            },
          });

          // Upsert PageSeo
          if (p.seo) {
            await tx.pageSeo.upsert({
              where: { pageId: page.id },
              create: {
                pageId: page.id,
                seoTitle: p.seo.seoTitle ?? null,
                metaDescription: p.seo.metaDescription ?? null,
                canonicalUrl: p.seo.canonicalUrl ?? null,
                robotsIndex: p.seo.robotsIndex ?? true,
                robotsFollow: p.seo.robotsFollow ?? true,
                ogTitle: p.seo.ogTitle ?? null,
                ogDescription: p.seo.ogDescription ?? null,
                ogImage: p.seo.ogImage ?? null,
                twitterTitle: p.seo.twitterTitle ?? null,
                twitterDescription: p.seo.twitterDescription ?? null,
                twitterImage: p.seo.twitterImage ?? null,
                schemaType: p.seo.schemaType ?? null,
                schemaJson: p.seo.schemaJson ?? null,
                focusKeyword: p.seo.focusKeyword ?? null,
              },
              update: {
                seoTitle: p.seo.seoTitle ?? null,
                metaDescription: p.seo.metaDescription ?? null,
                canonicalUrl: p.seo.canonicalUrl ?? null,
                robotsIndex: p.seo.robotsIndex ?? true,
                robotsFollow: p.seo.robotsFollow ?? true,
                ogTitle: p.seo.ogTitle ?? null,
                ogDescription: p.seo.ogDescription ?? null,
                ogImage: p.seo.ogImage ?? null,
                twitterTitle: p.seo.twitterTitle ?? null,
                twitterDescription: p.seo.twitterDescription ?? null,
                twitterImage: p.seo.twitterImage ?? null,
                schemaType: p.seo.schemaType ?? null,
                schemaJson: p.seo.schemaJson ?? null,
                focusKeyword: p.seo.focusKeyword ?? null,
              },
            });
          }

          if (existingPage) counts.pages.updated++;
          else counts.pages.created++;
        }
      }

      // Step E: Restore Tool Content
      if (Array.isArray(data.toolContent)) {
        for (const t of data.toolContent) {
          const canonical = getToolBySlug(t.toolSlug);
          if (!canonical) continue;

          const toolVal = validateToolPayload(t.toolSlug, {
            customTitle: t.customTitle,
            customH1: t.customH1,
            customDescription: t.customDescription,
            customIntro: t.customIntro,
            customValueProp: t.customValueProp,
            customHowTo: t.customHowTo,
            customFeatures: t.customFeatures,
            customFaq: t.customFaq,
            customRelatedTools: t.customRelatedTools,
            blocks: t.blocks,
            seo: t.seo || undefined,
          });

          if (!toolVal.isValid) continue;

          const existingTool = await tx.toolContent.findUnique({
            where: { toolSlug: t.toolSlug },
            include: { seo: true },
          });

          if (existingTool && isToolContentUnchanged(t, existingTool, toolVal.sanitized)) {
            counts.toolContent.skipped++;
            continue;
          }

          const tool = await tx.toolContent.upsert({
            where: { toolSlug: t.toolSlug },
            create: {
              toolSlug: t.toolSlug,
              customTitle: toolVal.sanitized.customTitle,
              customH1: toolVal.sanitized.customH1,
              customDescription: toolVal.sanitized.customDescription,
              customIntro: toolVal.sanitized.customIntro,
              customValueProp: toolVal.sanitized.customValueProp,
              customHowTo: toolVal.sanitized.customHowTo,
              customFeatures: toolVal.sanitized.customFeatures,
              customFaq: toolVal.sanitized.customFaq,
              customRelatedTools: toolVal.sanitized.customRelatedTools,
              blocks: toolVal.sanitized.blocks,
              isPublished: t.isPublished ?? false,
            },
            update: {
              customTitle: toolVal.sanitized.customTitle,
              customH1: toolVal.sanitized.customH1,
              customDescription: toolVal.sanitized.customDescription,
              customIntro: toolVal.sanitized.customIntro,
              customValueProp: toolVal.sanitized.customValueProp,
              customHowTo: toolVal.sanitized.customHowTo,
              customFeatures: toolVal.sanitized.customFeatures,
              customFaq: toolVal.sanitized.customFaq,
              customRelatedTools: toolVal.sanitized.customRelatedTools,
              blocks: toolVal.sanitized.blocks,
              isPublished: t.isPublished ?? false,
            },
          });

          // In Prisma ToolSeo schema, only og/robots/canonical fields exist (no twitterTitle/Image)
          if (t.seo) {
            await tx.toolSeo.upsert({
              where: { toolContentId: tool.id },
              create: {
                toolContentId: tool.id,
                seoTitle: t.seo.seoTitle ?? null,
                metaDescription: t.seo.metaDescription ?? null,
                canonicalUrl: t.seo.canonicalUrl ?? null,
                robotsIndex: t.seo.robotsIndex ?? true,
                robotsFollow: t.seo.robotsFollow ?? true,
                ogTitle: t.seo.ogTitle ?? null,
                ogDescription: t.seo.ogDescription ?? null,
                ogImage: t.seo.ogImage ?? null,
                schemaType: t.seo.schemaType ?? null,
                schemaJson: t.seo.schemaJson ?? null,
                focusKeyword: t.seo.focusKeyword ?? null,
              },
              update: {
                seoTitle: t.seo.seoTitle ?? null,
                metaDescription: t.seo.metaDescription ?? null,
                canonicalUrl: t.seo.canonicalUrl ?? null,
                robotsIndex: t.seo.robotsIndex ?? true,
                robotsFollow: t.seo.robotsFollow ?? true,
                ogTitle: t.seo.ogTitle ?? null,
                ogDescription: t.seo.ogDescription ?? null,
                ogImage: t.seo.ogImage ?? null,
                schemaType: t.seo.schemaType ?? null,
                schemaJson: t.seo.schemaJson ?? null,
                focusKeyword: t.seo.focusKeyword ?? null,
              },
            });
          }

          if (existingTool) counts.toolContent.updated++;
          else counts.toolContent.created++;
        }
      }

      // Step F: Restore Blog Posts
      if (Array.isArray(data.blogPosts)) {
        for (const bp of data.blogPosts) {
          const bpVal = validateBlogPostPayload({
            title: bp.title,
            slug: bp.slug,
            excerpt: bp.excerpt,
            content: bp.content,
            featuredImage: bp.featuredImage,
            featuredImageAlt: bp.featuredImageAlt,
            status: bp.status,
            scheduledFor: bp.scheduledFor,
            seo: bp.seo || undefined,
          });

          if (!bpVal.isValid) continue;

          // Connect category by categorySlug
          let categoryId: string | null = null;
          if (bp.categorySlug) {
            const cat = await tx.blogCategory.findUnique({ where: { slug: bp.categorySlug } });
            if (cat) categoryId = cat.id;
          }

          const existingPost = await tx.blogPost.findUnique({
            where: { slug: bp.slug },
            include: { category: true, tags: { include: { tag: true } }, seo: true },
          });

          if (existingPost && isBlogPostUnchanged(bp, existingPost, bpVal.sanitized.content)) {
            counts.blogPosts.skipped++;
            continue;
          }

          const post = await tx.blogPost.upsert({
            where: { slug: bp.slug },
            create: {
              slug: bp.slug,
              title: bpVal.sanitized.title,
              excerpt: bpVal.sanitized.excerpt,
              content: bpVal.sanitized.content,
              featuredImage: bpVal.sanitized.featuredImage,
              featuredImageAlt: bpVal.sanitized.featuredImageAlt,
              status: bp.status || 'DRAFT',
              publishedAt: bp.status === 'PUBLISHED' ? (bp.publishedAt ? new Date(bp.publishedAt) : new Date()) : null,
              scheduledFor: bp.scheduledFor ? new Date(bp.scheduledFor) : null,
              categoryId,
              authorId: author.id,
            },
            update: {
              title: bpVal.sanitized.title,
              excerpt: bpVal.sanitized.excerpt,
              content: bpVal.sanitized.content,
              featuredImage: bpVal.sanitized.featuredImage,
              featuredImageAlt: bpVal.sanitized.featuredImageAlt,
              status: bp.status || 'DRAFT',
              publishedAt: bp.status === 'PUBLISHED' ? (bp.publishedAt ? new Date(bp.publishedAt) : new Date()) : null,
              scheduledFor: bp.scheduledFor ? new Date(bp.scheduledFor) : null,
              categoryId,
            },
          });

          // Connect tags by tagSlugs
          if (Array.isArray(bp.tagSlugs)) {
            await tx.postTag.deleteMany({ where: { postId: post.id } });
            for (const tagSlug of bp.tagSlugs) {
              const tag = await tx.blogTag.findUnique({ where: { slug: tagSlug } });
              if (tag) {
                await tx.postTag.create({
                  data: {
                    postId: post.id,
                    tagId: tag.id,
                  },
                });
              }
            }
          }

          // Upsert PostSeo
          if (bp.seo) {
            await tx.postSeo.upsert({
              where: { postId: post.id },
              create: {
                postId: post.id,
                seoTitle: bp.seo.seoTitle ?? null,
                metaDescription: bp.seo.metaDescription ?? null,
                canonicalUrl: bp.seo.canonicalUrl ?? null,
                robotsIndex: bp.seo.robotsIndex ?? true,
                robotsFollow: bp.seo.robotsFollow ?? true,
                ogTitle: bp.seo.ogTitle ?? null,
                ogDescription: bp.seo.ogDescription ?? null,
                ogImage: bp.seo.ogImage ?? null,
                twitterTitle: bp.seo.twitterTitle ?? null,
                twitterDescription: bp.seo.twitterDescription ?? null,
                twitterImage: bp.seo.twitterImage ?? null,
                schemaType: bp.seo.schemaType ?? null,
                schemaJson: bp.seo.schemaJson ?? null,
                focusKeyword: bp.seo.focusKeyword ?? null,
              },
              update: {
                seoTitle: bp.seo.seoTitle ?? null,
                metaDescription: bp.seo.metaDescription ?? null,
                canonicalUrl: bp.seo.canonicalUrl ?? null,
                robotsIndex: bp.seo.robotsIndex ?? true,
                robotsFollow: bp.seo.robotsFollow ?? true,
                ogTitle: bp.seo.ogTitle ?? null,
                ogDescription: bp.seo.ogDescription ?? null,
                ogImage: bp.seo.ogImage ?? null,
                twitterTitle: bp.seo.twitterTitle ?? null,
                twitterDescription: bp.seo.twitterDescription ?? null,
                twitterImage: bp.seo.twitterImage ?? null,
                schemaType: bp.seo.schemaType ?? null,
                schemaJson: bp.seo.schemaJson ?? null,
                focusKeyword: bp.seo.focusKeyword ?? null,
              },
            });
          }

          if (existingPost) counts.blogPosts.updated++;
          else counts.blogPosts.created++;
        }
      }

      // Step G: Restore Format Content
      if (Array.isArray(data.formatContents)) {
        for (const fc of data.formatContents) {
          if (!fc.formatSlug) continue;

          const existing = await tx.formatContent.findUnique({ where: { formatSlug: fc.formatSlug } });
          if (existing && isFormatContentUnchanged(fc, existing)) {
            counts.formatContents.skipped++;
            continue;
          }

          await tx.formatContent.upsert({
            where: { formatSlug: fc.formatSlug },
            create: {
              formatSlug: fc.formatSlug,
              customTitle: fc.customTitle ?? null,
              customDescription: fc.customDescription ?? null,
              customDetails: fc.customDetails ?? null,
              customBestFor: fc.customBestFor ?? null,
              customPros: fc.customPros ?? null,
              customCons: fc.customCons ?? null,
            },
            update: {
              customTitle: fc.customTitle ?? null,
              customDescription: fc.customDescription ?? null,
              customDetails: fc.customDetails ?? null,
              customBestFor: fc.customBestFor ?? null,
              customPros: fc.customPros ?? null,
              customCons: fc.customCons ?? null,
            },
          });

          if (existing) counts.formatContents.updated++;
          else counts.formatContents.created++;
        }
      }
    });

    const durationMs = Date.now() - startTime;
    const totalSkipped =
      counts.pages.skipped +
      counts.toolContent.skipped +
      counts.blogPosts.skipped +
      counts.blogCategories.skipped +
      counts.blogTags.skipped +
      counts.formatContents.skipped +
      counts.mediaReferences.skipped +
      (counts.siteSettings.skipped ? 1 : 0);

    // 3. Record Audit Log for Successful Restore (item counts only, never backup payload or secrets)
    const auditLog = await createAuditLog({
      userId: author.id,
      action: 'CMS_BACKUP_RESTORE',
      entityType: 'BACKUP',
      entityId: null,
      metadata: {
        restoredPages: counts.pages,
        restoredTools: counts.toolContent,
        restoredBlogPosts: counts.blogPosts,
        restoredCategories: counts.blogCategories,
        restoredTags: counts.blogTags,
        restoredMediaReferences: counts.mediaReferences,
        siteSettingsUpdated: counts.siteSettings.updated,
        totalSkipped,
        durationMs,
        userEmail: author.email,
      },
    });

    return {
      success: true,
      message: 'CMS content restored successfully inside database transaction.',
      durationMs,
      auditLogId: auditLog.id,
      restored: counts,
      skippedCount: totalSkipped,
      failedCount: 0,
    };
  } catch (err: any) {
    const durationMs = Date.now() - startTime;
    console.error('[CMS Restore] Database transaction failed:', err);

    return {
      success: false,
      message: `Restore failed: ${err.message || 'Database transaction rolled back.'}`,
      durationMs,
      restored: counts,
      skippedCount: preview.totals.toSkip,
      failedCount: preview.totals.totalRecords,
      errors: [err.message || 'Database transaction error'],
    };
  }
}
