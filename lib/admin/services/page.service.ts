import { revalidatePath } from 'next/cache';
import { getDb } from '@/lib/db';
import { CreatePageInput, UpdatePageInput, AdminUserSession } from '../types';
import { createAuditLog } from './audit.service';
import { validatePagePayload } from '../validation';
import { hasPermission } from '../permissions';

export interface BootstrapHomepageResult {
  created: boolean;
  page: any;
  message: string;
}

/**
 * Safely and idempotently initializes the reserved 'home' page record.
 * 1. If 'home' already exists, preserves all existing content, SEO, and revisions.
 * 2. If 'home' is absent, creates the page, content, SEO, and initial revision snapshot.
 * 3. Never overwrites or resets existing CMS data.
 * 4. Fails safely if database persistence is unavailable.
 */
export async function bootstrapHomepage(author?: AdminUserSession): Promise<BootstrapHomepageResult> {
  const db = getDb();

  // 1. Check if homepage already exists
  const existing = await db.page.findUnique({
    where: { slug: 'home' },
    include: {
      content: true,
      seo: true,
    },
  });

  if (existing) {
    return {
      created: false,
      page: existing,
      message: "Homepage record ('home') already exists. Preserved existing content, SEO, and revisions.",
    };
  }

  // 2. Default homepage SEO values aligned with existing public homepage defaults
  const defaultTitle = 'Free Online File Tools – Convert, Compress & Edit Files Free';
  const defaultDesc =
    'Fast, secure, 100% free image and PDF conversion utilities. Convert JPG, PNG, WEBP, HEIC, PDF and compress documents with complete client-side privacy.';

  try {
    const page = await db.page.create({
      data: {
        slug: 'home',
        name: 'Homepage',
        status: 'PUBLISHED',
        publishedAt: new Date(),
        content: {
          create: {
            version: 1,
            isPublished: true,
            blocks: [] as any,
            customCss: null,
          },
        },
        seo: {
          create: {
            seoTitle: defaultTitle,
            metaDescription: defaultDesc,
            canonicalUrl: '/',
            robotsIndex: true,
            robotsFollow: true,
            ogTitle: defaultTitle,
            ogDescription: defaultDesc,
            ogImage: '/images/og-image.png',
            twitterTitle: defaultTitle,
            twitterDescription: defaultDesc,
            twitterImage: '/images/og-image.png',
            schemaType: 'WebSite',
          },
        },
      },
      include: {
        content: true,
        seo: true,
      },
    });

    // Create initial revision snapshot
    await db.pageRevision.create({
      data: {
        pageId: page.id,
        contentSnapshot: { blocks: [], customCss: null },
        seoSnapshot: {
          seoTitle: defaultTitle,
          metaDescription: defaultDesc,
          canonicalUrl: '/',
          robotsIndex: true,
          robotsFollow: true,
          schemaType: 'WebSite',
        },
        authorId: author?.id || null,
        reason: 'Initial homepage bootstrap',
      },
    });

    await createAuditLog({
      userId: author?.id || 'system-bootstrap',
      action: 'PAGE_CREATED',
      entityType: 'PAGE',
      entityId: page.id,
      metadata: { slug: 'home', name: 'Homepage', bootstrap: true },
    });

    return {
      created: true,
      page,
      message: "Homepage record ('home') successfully initialized.",
    };
  } catch (err: unknown) {
    // Concurrent attempt caught by unique constraint
    const recheck = await db.page.findUnique({
      where: { slug: 'home' },
      include: {
        content: true,
        seo: true,
      },
    });

    if (recheck) {
      return {
        created: false,
        page: recheck,
        message: "Homepage record ('home') already exists (concurrent initialization).",
      };
    }

    throw err;
  }
}

export async function getPages(options?: { status?: 'DRAFT' | 'PUBLISHED' }) {
  const db = getDb();
  return db.page.findMany({
    where: options?.status ? { status: options.status } : undefined,
    include: {
      seo: true,
      content: true,
    },
    orderBy: { updatedAt: 'desc' },
  });
}

export async function getPageById(id: string) {
  const db = getDb();
  let page = await db.page.findUnique({
    where: { id },
    include: {
      content: true,
      seo: true,
    },
  });

  if (!page) {
    const slugCandidate = id.startsWith('page-') ? id.replace(/^page-/, '') : id;
    page = await db.page.findUnique({
      where: { slug: slugCandidate },
      include: {
        content: true,
        seo: true,
      },
    });
  }

  return page;
}

export async function getPageBySlug(slug: string, publishedOnly = false) {
  const db = getDb();
  const page = await db.page.findUnique({
    where: { slug },
    include: {
      content: true,
      seo: true,
    },
  });

  if (!page) return null;
  if (publishedOnly && page.status !== 'PUBLISHED') return null;
  return page;
}

export async function createDraftPage(input: CreatePageInput, author: AdminUserSession) {
  const db = getDb();
  const validation = validatePagePayload(input);
  if (!validation.isValid) {
    const errorDetails = validation.report.errors.map((e) => `${e.field}: ${e.message}`).join(', ');
    throw new Error(`Validation failed: ${errorDetails}`);
  }

  const cleanSlug = input.slug.trim().toLowerCase().replace(/[^a-z0-9-_]/g, '-');

  const existing = await db.page.findUnique({
    where: { slug: cleanSlug },
  });
  if (existing) {
    throw new Error(`A page with slug '${cleanSlug}' already exists.`);
  }

  const sanitizedBlocks = validation.sanitizedBlocks.length > 0 ? validation.sanitizedBlocks : input.blocks || [];

  if (input.status === 'PUBLISHED' && !hasPermission(author.role, 'PUBLISH_CONTENT')) {
    throw new Error(`Forbidden: Role '${author.role}' lacks 'PUBLISH_CONTENT' permission to create published pages.`);
  }

  const page = await db.page.create({
    data: {
      slug: cleanSlug,
      name: input.name.trim(),
      status: input.status || 'DRAFT',
      content: {
        create: {
          version: 1,
          isPublished: input.status === 'PUBLISHED',
          blocks: sanitizedBlocks as any,
          customCss: input.customCss || null,
        },
      },
      seo: {
        create: {
          seoTitle: input.seo?.seoTitle || null,
          metaDescription: input.seo?.metaDescription || null,
          canonicalUrl: input.seo?.canonicalUrl || null,
          robotsIndex: input.seo?.robotsIndex !== false,
          robotsFollow: input.seo?.robotsFollow !== false,
          ogTitle: input.seo?.ogTitle || null,
          ogDescription: input.seo?.ogDescription || null,
          ogImage: input.seo?.ogImage || null,
          twitterTitle: input.seo?.twitterTitle || null,
          twitterDescription: input.seo?.twitterDescription || null,
          twitterImage: input.seo?.twitterImage || null,
          schemaType: input.seo?.schemaType || null,
          schemaJson: (input.seo?.schemaJson as any) ?? undefined,
          focusKeyword: input.seo?.focusKeyword || null,
        },
      },
    },
    include: {
      content: true,
      seo: true,
    },
  });

  // Create initial revision
  await db.pageRevision.create({
    data: {
      pageId: page.id,
      contentSnapshot: page.content ? { blocks: page.content.blocks, customCss: page.content.customCss } : {},
      seoSnapshot: page.seo ? { ...page.seo } : null,
      authorId: author.id,
      reason: 'Initial creation',
    },
  });

  await createAuditLog({
    userId: author.id,
    action: 'PAGE_CREATED',
    entityType: 'PAGE',
    entityId: page.id,
    metadata: { slug: page.slug, name: page.name },
  });

  return page;
}

export async function updateDraftPage(
  id: string,
  input: UpdatePageInput,
  author: AdminUserSession
) {
  const db = getDb();
  let existing = await db.page.findUnique({
    where: { id },
    include: { content: true, seo: true },
  });

  if (!existing) {
    const slugCandidate = id.startsWith('page-') ? id.replace(/^page-/, '') : id;
    existing = await db.page.findUnique({
      where: { slug: slugCandidate },
      include: { content: true, seo: true },
    });
  }

  if (!existing) {
    throw new Error(`Page not found: ${id}`);
  }

  const actualPageId = existing.id;

  if (existing.status === 'PUBLISHED' && !hasPermission(author.role, 'PUBLISH_CONTENT')) {
    throw new Error(`Forbidden: Role '${author.role}' lacks 'PUBLISH_CONTENT' permission to modify published pages.`);
  }

  if (input.status === 'PUBLISHED' && !hasPermission(author.role, 'PUBLISH_CONTENT')) {
    throw new Error(`Forbidden: Role '${author.role}' lacks 'PUBLISH_CONTENT' permission to publish pages.`);
  }

  const validation = validatePagePayload(input);
  if (!validation.isValid) {
    const errorDetails = validation.report.errors.map((e) => `${e.field}: ${e.message}`).join(', ');
    throw new Error(`Validation failed: ${errorDetails}`);
  }

  // Update Page details
  const updateData: any = {};
  if (input.name) updateData.name = input.name.trim();
  if (input.status) {
    updateData.status = input.status;
    if (input.status === 'PUBLISHED' && !existing.publishedAt) {
      updateData.publishedAt = new Date();
    }
  }
  if (input.slug) {
    const cleanSlug = input.slug.trim().toLowerCase().replace(/[^a-z0-9-_]/g, '-');
    if (existing.slug === 'home' && cleanSlug !== 'home') {
      throw new Error("Cannot rename the reserved 'home' page slug.");
    }
    if (existing.slug !== 'home' && cleanSlug === 'home') {
      throw new Error("Cannot rename page to the reserved 'home' slug.");
    }
    if (cleanSlug !== existing.slug) {
      const clash = await db.page.findUnique({ where: { slug: cleanSlug } });
      if (clash && clash.id !== actualPageId) {
        throw new Error(`A page with slug '${cleanSlug}' already exists.`);
      }
      updateData.slug = cleanSlug;
    }
  }

  const updatedPage = await db.page.update({
    where: { id: actualPageId },
    data: updateData,
  });

  // Update content if provided
  if (input.blocks || input.customCss !== undefined) {
    const blocksToSave =
      input.blocks !== undefined
        ? validation.sanitizedBlocks.length > 0
          ? validation.sanitizedBlocks
          : input.blocks
        : existing.content?.blocks || [];

    await db.pageContent.upsert({
      where: { pageId: actualPageId },
      create: {
        pageId: actualPageId,
        blocks: blocksToSave as any,
        customCss: input.customCss !== undefined ? input.customCss : null,
        version: 1,
        isPublished: existing.status === 'PUBLISHED',
      },
      update: {
        blocks: blocksToSave as any,
        customCss: input.customCss !== undefined ? input.customCss : existing.content?.customCss || null,
        version: (existing.content?.version || 1) + 1,
      },
    });
  }

  // Update SEO if provided
  if (input.seo) {
    await db.pageSeo.upsert({
      where: { pageId: actualPageId },
      create: {
        pageId: actualPageId,
        seoTitle: input.seo.seoTitle || null,
        metaDescription: input.seo.metaDescription || null,
        canonicalUrl: input.seo.canonicalUrl || null,
        robotsIndex: input.seo.robotsIndex !== false,
        robotsFollow: input.seo.robotsFollow !== false,
        ogTitle: input.seo.ogTitle || null,
        ogDescription: input.seo.ogDescription || null,
        ogImage: input.seo.ogImage || null,
        twitterTitle: input.seo.twitterTitle || null,
        twitterDescription: input.seo.twitterDescription || null,
        twitterImage: input.seo.twitterImage || null,
        schemaType: input.seo.schemaType || null,
        schemaJson: (input.seo.schemaJson as any) ?? undefined,
        focusKeyword: input.seo.focusKeyword || null,
      },
      update: {
        seoTitle: input.seo.seoTitle,
        metaDescription: input.seo.metaDescription,
        canonicalUrl: input.seo.canonicalUrl,
        robotsIndex: input.seo.robotsIndex !== false,
        robotsFollow: input.seo.robotsFollow !== false,
        ogTitle: input.seo.ogTitle,
        ogDescription: input.seo.ogDescription,
        ogImage: input.seo.ogImage,
        twitterTitle: input.seo.twitterTitle,
        twitterDescription: input.seo.twitterDescription,
        twitterImage: input.seo.twitterImage,
        schemaType: input.seo.schemaType,
        schemaJson: (input.seo.schemaJson as any) ?? undefined,
        focusKeyword: input.seo.focusKeyword,
      },
    });
  }

  const fullPage = await getPageById(actualPageId);

  // Snapshot revision
  await db.pageRevision.create({
    data: {
      pageId: actualPageId,
      contentSnapshot: fullPage?.content ? { blocks: fullPage.content.blocks, customCss: fullPage.content.customCss } : {},
      seoSnapshot: fullPage?.seo ? { ...fullPage.seo } : null,
      authorId: author.id,
      reason: input.reason || 'Content update',
    },
  });

  await createAuditLog({
    userId: author.id,
    action: 'PAGE_UPDATED',
    entityType: 'PAGE',
    entityId: actualPageId,
    metadata: { slug: fullPage?.slug, reason: input.reason },
  });

  return fullPage;
}

export async function publishPage(id: string, author: AdminUserSession) {
  const db = getDb();
  let page = await db.page.findUnique({
    where: { id },
    include: { content: true, seo: true },
  });

  if (!page) {
    const slugCandidate = id.startsWith('page-') ? id.replace(/^page-/, '') : id;
    page = await db.page.findUnique({
      where: { slug: slugCandidate },
      include: { content: true, seo: true },
    });
  }

  if (!page) {
    throw new Error(`Page not found: ${id}`);
  }

  const actualPageId = page.id;

  const updated = await db.page.update({
    where: { id: actualPageId },
    data: {
      status: 'PUBLISHED',
      publishedAt: new Date(),
    },
    include: { content: true, seo: true },
  });

  if (page.content) {
    await db.pageContent.update({
      where: { pageId: actualPageId },
      data: { isPublished: true },
    });
  }

  await db.pageRevision.create({
    data: {
      pageId: actualPageId,
      contentSnapshot: updated.content ? { blocks: updated.content.blocks, customCss: updated.content.customCss } : {},
      seoSnapshot: updated.seo ? { ...updated.seo } : null,
      authorId: author.id,
      reason: 'Published page',
    },
  });

  await createAuditLog({
    userId: author.id,
    action: 'PAGE_PUBLISHED',
    entityType: 'PAGE',
    entityId: actualPageId,
    metadata: { slug: updated.slug },
  });

  // Invalidate Next.js route cache
  const targetPath = updated.slug === 'home' ? '/' : `/${updated.slug}`;
  try {
    revalidatePath(targetPath);
  } catch {
    // Safe no-op outside Next.js request context (e.g. CLI or unit test)
  }

  return updated;
}

export async function unpublishPage(id: string, author: AdminUserSession) {
  const db = getDb();
  let page = await db.page.findUnique({ where: { id } });
  if (!page) {
    const slugCandidate = id.startsWith('page-') ? id.replace(/^page-/, '') : id;
    page = await db.page.findUnique({ where: { slug: slugCandidate } });
  }
  if (!page) throw new Error(`Page not found: ${id}`);

  const actualPageId = page.id;

  const updated = await db.page.update({
    where: { id: actualPageId },
    data: {
      status: 'DRAFT',
    },
    include: { content: true, seo: true },
  });

  if (updated.content) {
    await db.pageContent.update({
      where: { pageId: actualPageId },
      data: { isPublished: false },
    });
  }

  await createAuditLog({
    userId: author.id,
    action: 'PAGE_UNPUBLISHED',
    entityType: 'PAGE',
    entityId: actualPageId,
    metadata: { slug: updated.slug },
  });

  // Invalidate Next.js route cache
  const targetPath = updated.slug === 'home' ? '/' : `/${updated.slug}`;
  try {
    revalidatePath(targetPath);
  } catch {
    // Safe no-op outside Next.js request context
  }

  return updated;
}

/**
 * Deletes a page and all dependent content.
 * Prevents deleting the reserved 'home' page.
 */
export async function deletePage(id: string, author: AdminUserSession) {
  const db = getDb();
  let page = await db.page.findUnique({ where: { id } });
  if (!page) {
    const slugCandidate = id.startsWith('page-') ? id.replace(/^page-/, '') : id;
    page = await db.page.findUnique({ where: { slug: slugCandidate } });
  }
  if (!page) {
    throw new Error(`Page not found: ${id}`);
  }

  if (page.slug === 'home') {
    throw new Error("Cannot delete the reserved 'home' page.");
  }

  if (page.status === 'PUBLISHED' && !hasPermission(author.role, 'PUBLISH_CONTENT')) {
    throw new Error(`Forbidden: Role '${author.role}' lacks 'PUBLISH_CONTENT' permission to delete published pages.`);
  }

  const actualPageId = page.id;
  await db.page.delete({ where: { id: actualPageId } });

  await createAuditLog({
    userId: author.id,
    action: 'PAGE_DELETED',
    entityType: 'PAGE',
    entityId: actualPageId,
    metadata: { slug: page.slug, name: page.name },
  });

  // Invalidate route cache
  try {
    revalidatePath(`/${page.slug}`);
  } catch {
    // Safe no-op
  }

  return { success: true, id: actualPageId, slug: page.slug };
}

export async function getPageRevisions(pageId: string) {
  const db = getDb();
  let actualId = pageId;
  const page = await db.page.findUnique({ where: { id: pageId } });
  if (!page) {
    const slugCandidate = pageId.startsWith('page-') ? pageId.replace(/^page-/, '') : pageId;
    const pageBySlug = await db.page.findUnique({ where: { slug: slugCandidate } });
    if (pageBySlug) {
      actualId = pageBySlug.id;
    }
  }

  return db.pageRevision.findMany({
    where: { pageId: actualId },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getPageRevisionById(pageId: string, revisionId: string) {
  const db = getDb();
  let actualId = pageId;
  const page = await db.page.findUnique({ where: { id: pageId } });
  if (!page) {
    const slugCandidate = pageId.startsWith('page-') ? pageId.replace(/^page-/, '') : pageId;
    const pageBySlug = await db.page.findUnique({ where: { slug: slugCandidate } });
    if (pageBySlug) {
      actualId = pageBySlug.id;
    }
  }

  const revision = await db.pageRevision.findUnique({
    where: { id: revisionId },
  });
  if (!revision || (revision.pageId !== actualId && revision.pageId !== pageId)) {
    return null;
  }
  return revision;
}

export async function restorePageRevision(
  pageId: string,
  revisionId: string,
  author: AdminUserSession
) {
  const db = getDb();
  let page = await db.page.findUnique({
    where: { id: pageId },
    include: { content: true, seo: true },
  });
  if (!page) {
    const slugCandidate = pageId.startsWith('page-') ? pageId.replace(/^page-/, '') : pageId;
    page = await db.page.findUnique({
      where: { slug: slugCandidate },
      include: { content: true, seo: true },
    });
  }
  if (!page) throw new Error(`Page not found: ${pageId}`);

  if (page.status === 'PUBLISHED' && !hasPermission(author.role, 'PUBLISH_CONTENT')) {
    throw new Error(`Forbidden: Role '${author.role}' lacks 'PUBLISH_CONTENT' permission to restore revisions on published pages.`);
  }

  const actualPageId = page.id;
  const revision = await getPageRevisionById(actualPageId, revisionId);
  if (!revision) throw new Error(`Revision ${revisionId} not found for page ${pageId}`);

  // Restore content snapshot
  const contentSnapshot = (revision.contentSnapshot || {}) as Record<string, any>;
  const blocks = contentSnapshot.blocks || [];
  const customCss = contentSnapshot.customCss || null;

  await db.pageContent.update({
    where: { pageId: actualPageId },
    data: {
      blocks: blocks as any,
      customCss,
      version: (page.content?.version || 1) + 1,
    },
  });

  // Restore SEO snapshot if present
  if (revision.seoSnapshot) {
    const seoSnapshot = revision.seoSnapshot as Record<string, any>;
    await db.pageSeo.update({
      where: { pageId: actualPageId },
      data: {
        seoTitle: seoSnapshot.seoTitle ?? null,
        metaDescription: seoSnapshot.metaDescription ?? null,
        canonicalUrl: seoSnapshot.canonicalUrl ?? null,
        robotsIndex: seoSnapshot.robotsIndex !== false,
        robotsFollow: seoSnapshot.robotsFollow !== false,
        ogTitle: seoSnapshot.ogTitle ?? null,
        ogDescription: seoSnapshot.ogDescription ?? null,
        ogImage: seoSnapshot.ogImage ?? null,
        twitterTitle: seoSnapshot.twitterTitle ?? null,
        twitterDescription: seoSnapshot.twitterDescription ?? null,
        twitterImage: seoSnapshot.twitterImage ?? null,
        schemaType: seoSnapshot.schemaType ?? null,
        schemaJson: seoSnapshot.schemaJson ?? undefined,
        focusKeyword: seoSnapshot.focusKeyword ?? null,
      },
    });
  }

  // Create a brand new revision snapshot recording the restoration
  const newRevision = await db.pageRevision.create({
    data: {
      pageId: actualPageId,
      contentSnapshot: { blocks, customCss },
      seoSnapshot: revision.seoSnapshot,
      authorId: author.id,
      reason: `Restored from revision ${revisionId}`,
    },
  });

  await createAuditLog({
    userId: author.id,
    action: 'PAGE_REVISION_RESTORED',
    entityType: 'PAGE',
    entityId: actualPageId,
    metadata: {
      restoredRevisionId: revisionId,
      newRevisionId: newRevision.id,
      pageSlug: page.slug,
    },
  });

  return getPageById(actualPageId);
}

export async function previewDraftPage(id: string, author: AdminUserSession) {
  const page = await getPageById(id);
  if (!page) return null;

  await createAuditLog({
    userId: author.id,
    action: 'PAGE_PREVIEWED',
    entityType: 'PAGE',
    entityId: id,
    metadata: { slug: page.slug },
  });

  return page;
}

