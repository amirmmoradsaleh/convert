import { getDb } from '@/lib/db';
import { getToolBySlug, getAllTools, ToolDefinition } from '@/lib/tools';
import { isBatch1Tool, getBatch1ToolBlocks } from '@/lib/cms/tool-blocks-batch1';
import { UpdateToolContentInput, AdminUserSession } from '../types';
import { createAuditLog } from './audit.service';
import { validateToolPayload } from '../validation';

export interface MergedToolResult {
  tool: ToolDefinition;
  isCmsOverride: boolean;
  isPublished: boolean;
  seoOverride?: any;
}

/**
 * Public & Admin Content Resolver for Tools.
 * Merges published CMS overrides over canonical registry definitions.
 * When preview=true (admin preview only), merges draft overrides.
 * Returns null if slug is not in the canonical 25-tool registry.
 */
export async function getMergedTool(
  slug: string,
  options?: { preview?: boolean }
): Promise<ToolDefinition | null> {
  const canonical = getToolBySlug(slug);
  if (!canonical) return null;

  try {
    const db = getDb();
    const override = await db.toolContent.findUnique({
      where: { toolSlug: slug },
      include: { seo: true },
    });

    const isPreview = options?.preview === true;
    if (override) {
      if (!override.isPublished && !isPreview) {
        return canonical;
      }

      // Overlay CMS overrides with clean partial precedence
      const customHowTo = Array.isArray(override.customHowTo) && override.customHowTo.length > 0
        ? (override.customHowTo as any)
        : canonical.howTo;

      const customFeatures = Array.isArray(override.customFeatures) && override.customFeatures.length > 0
        ? (override.customFeatures as any)
        : canonical.features;

      const customFaq = Array.isArray(override.customFaq) && override.customFaq.length > 0
        ? (override.customFaq as any)
        : canonical.faq;

      const customRelatedTools = Array.isArray(override.customRelatedTools) && override.customRelatedTools.length > 0
        ? (override.customRelatedTools as any)
        : canonical.relatedTools;

      const mergedTitle = override.seo?.seoTitle || override.customTitle || canonical.title;
      const mergedDesc = override.seo?.metaDescription || override.customDescription || canonical.description;
      const customBlocks = override.blocks ? (override.blocks as any[]) : getBatch1ToolBlocks(slug) || undefined;

      return {
        ...canonical,
        title: mergedTitle,
        description: mergedDesc,
        h1: override.customH1 || canonical.h1,
        intro: override.customIntro || canonical.intro,
        valueProposition: override.customValueProp || canonical.valueProposition,
        howTo: customHowTo,
        features: customFeatures,
        faq: customFaq,
        relatedTools: customRelatedTools,
        blocks: customBlocks,
      };
    }

    // When no DB override exists, Batch 1 tools default to structured blocks
    const batch1Blocks = getBatch1ToolBlocks(slug);
    if (batch1Blocks) {
      return {
        ...canonical,
        blocks: batch1Blocks,
      };
    }

    return canonical;
  } catch {
    return canonical;
  }
}

/**
 * Retrieves full CMS tool details including canonical definition and SEO.
 */
export async function getToolContentBySlug(slug: string) {
  const canonical = getToolBySlug(slug);
  if (!canonical) return null;

  const db = getDb();
  const override = await db.toolContent.findUnique({
    where: { toolSlug: slug },
    include: { seo: true },
  });

  if (!override) {
    const batch1Blocks = getBatch1ToolBlocks(slug);
    if (batch1Blocks) {
      return {
        canonical,
        override: {
          id: `tc-b1-${slug}`,
          toolSlug: slug,
          customTitle: null,
          customH1: null,
          customIntro: null,
          customDescription: null,
          customValueProp: null,
          customHowTo: null,
          customFeatures: null,
          customFaq: null,
          customRelatedTools: null,
          blocks: batch1Blocks,
          isPublished: true,
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
          updatedAt: new Date('2026-01-01T00:00:00.000Z'),
          seo: {
            seoTitle: canonical.title,
            metaDescription: canonical.description,
            canonicalUrl: `/tools/${slug}`,
            robotsIndex: true,
            robotsFollow: true,
          },
        } as any,
      };
    }
  }

  return {
    canonical,
    override: override || null,
  };
}

/**
 * Returns all 25 canonical tools mapped with their current CMS override status.
 */
export async function getAllToolContents() {
  const canonicalTools = getAllTools();
  const db = getDb();
  const overrides = await db.toolContent.findMany({
    include: { seo: true },
  });
  const overridesBySlug = new Map(overrides.map((o: any) => [o.toolSlug, o]));

  return canonicalTools.map((t) => {
    const override = overridesBySlug.get(t.slug);
    const isB1 = isBatch1Tool(t.slug);
    return {
      slug: t.slug,
      name: t.name,
      category: t.category,
      inputFormats: t.inputFormats,
      outputFormats: t.outputFormats,
      hasCmsOverride: Boolean(override) || isB1,
      isPublished: override ? override.isPublished : (isB1 ? true : false),
      customTitle: override?.customTitle || null,
      customH1: override?.customH1 || null,
      updatedAt: override?.updatedAt || null,
    };
  });
}

/**
 * Saves draft tool content and SEO, validating input and recording a revision snapshot.
 */
export async function upsertToolContent(
  slug: string,
  input: UpdateToolContentInput,
  author: AdminUserSession
) {
  const canonical = getToolBySlug(slug);
  if (!canonical) {
    throw new Error(`Tool with slug '${slug}' not found in canonical tool registry.`);
  }

  // Validate server-side
  const validation = validateToolPayload(slug, input);
  if (!validation.isValid) {
    const errorDetails = validation.report.errors.map((e) => `${e.field}: ${e.message}`).join(', ');
    throw new Error(`Validation failed: ${errorDetails}`);
  }

  const sanitized = validation.sanitized;
  const db = getDb();

  // Optimistic concurrency check: prevent silent overwrite of newer changes
  if (input.expectedUpdatedAt) {
    const existing = await db.toolContent.findUnique({
      where: { toolSlug: slug },
    });
    if (existing && existing.updatedAt) {
      const existingTime = new Date(existing.updatedAt).getTime();
      const expectedTime = new Date(input.expectedUpdatedAt).getTime();
      if (existingTime > expectedTime) {
        throw new Error(
          `CONCURRENT_MODIFICATION: Content for '${slug}' has been updated by another user since you loaded it. Please reload to review the latest changes.`
        );
      }
    }
  }

  const updated = await db.toolContent.upsert({
    where: { toolSlug: slug },
    create: {
      toolSlug: slug,
      customTitle: sanitized.customTitle ?? null,
      customH1: sanitized.customH1 ?? null,
      customDescription: sanitized.customDescription ?? null,
      customIntro: sanitized.customIntro ?? null,
      customValueProp: sanitized.customValueProp ?? null,
      customHowTo: (sanitized.customHowTo as any) ?? undefined,
      customFeatures: (sanitized.customFeatures as any) ?? undefined,
      customFaq: (sanitized.customFaq as any) ?? undefined,
      customRelatedTools: (sanitized.customRelatedTools as any) ?? undefined,
      blocks: (sanitized.blocks as any) ?? undefined,
      isPublished: input.isPublished !== undefined ? input.isPublished : false,
      seo: input.seo
        ? {
            create: {
              seoTitle: input.seo.seoTitle ?? null,
              metaDescription: input.seo.metaDescription ?? null,
              canonicalUrl: input.seo.canonicalUrl ?? null,
              robotsIndex: input.seo.robotsIndex !== false,
              robotsFollow: input.seo.robotsFollow !== false,
              ogTitle: input.seo.ogTitle ?? null,
              ogDescription: input.seo.ogDescription ?? null,
              ogImage: input.seo.ogImage ?? null,
              schemaType: input.seo.schemaType ?? null,
              schemaJson: (input.seo.schemaJson as any) ?? undefined,
              focusKeyword: input.seo.focusKeyword ?? null,
            },
          }
        : undefined,
    },
    update: {
      customTitle: sanitized.customTitle !== undefined ? sanitized.customTitle : undefined,
      customH1: sanitized.customH1 !== undefined ? sanitized.customH1 : undefined,
      customDescription: sanitized.customDescription !== undefined ? sanitized.customDescription : undefined,
      customIntro: sanitized.customIntro !== undefined ? sanitized.customIntro : undefined,
      customValueProp: sanitized.customValueProp !== undefined ? sanitized.customValueProp : undefined,
      customHowTo: sanitized.customHowTo !== undefined ? (sanitized.customHowTo as any) : undefined,
      customFeatures: sanitized.customFeatures !== undefined ? (sanitized.customFeatures as any) : undefined,
      customFaq: sanitized.customFaq !== undefined ? (sanitized.customFaq as any) : undefined,
      customRelatedTools: sanitized.customRelatedTools !== undefined ? (sanitized.customRelatedTools as any) : undefined,
      blocks: sanitized.blocks !== undefined ? (sanitized.blocks as any) : undefined,
      isPublished: input.isPublished !== undefined ? input.isPublished : undefined,
      seo: input.seo
        ? {
            upsert: {
              create: {
                seoTitle: input.seo.seoTitle ?? null,
                metaDescription: input.seo.metaDescription ?? null,
                canonicalUrl: input.seo.canonicalUrl ?? null,
                robotsIndex: input.seo.robotsIndex !== false,
                robotsFollow: input.seo.robotsFollow !== false,
                ogTitle: input.seo.ogTitle ?? null,
                ogDescription: input.seo.ogDescription ?? null,
                ogImage: input.seo.ogImage ?? null,
                schemaType: input.seo.schemaType ?? null,
                schemaJson: (input.seo.schemaJson as any) ?? undefined,
                focusKeyword: input.seo.focusKeyword ?? null,
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
                schemaType: input.seo.schemaType,
                schemaJson: (input.seo.schemaJson as any) ?? undefined,
                focusKeyword: input.seo.focusKeyword,
              },
            },
          }
        : undefined,
    },
    include: { seo: true },
  });

  // Snapshot revision
  await db.toolRevision.create({
    data: {
      toolContentId: updated.id,
      toolSlug: slug,
      contentSnapshot: {
        customTitle: updated.customTitle,
        customH1: updated.customH1,
        customDescription: updated.customDescription,
        customIntro: updated.customIntro,
        customValueProp: updated.customValueProp,
        customHowTo: updated.customHowTo,
        customFeatures: updated.customFeatures,
        customFaq: updated.customFaq,
        customRelatedTools: updated.customRelatedTools,
        blocks: (updated as any).blocks || [],
        isPublished: updated.isPublished,
      },
      seoSnapshot: updated.seo ? { ...updated.seo } : null,
      authorId: author.id,
      reason: input.reason || 'Tool draft update',
    },
  });

  await createAuditLog({
    userId: author.id,
    action: 'TOOL_CONTENT_UPDATED',
    entityType: 'TOOL',
    entityId: slug,
    metadata: { toolSlug: slug, isPublished: updated.isPublished, reason: input.reason },
  });

  return updated;
}

/**
 * Publishes tool content, making it visible to public visitors.
 */
export async function publishTool(slug: string, author: AdminUserSession) {
  const canonical = getToolBySlug(slug);
  if (!canonical) {
    throw new Error(`Tool with slug '${slug}' not found in canonical registry.`);
  }

  const db = getDb();
  const existing = await db.toolContent.findUnique({
    where: { toolSlug: slug },
    include: { seo: true },
  });

  if (!existing) {
    throw new Error(`No CMS content saved for tool '${slug}' to publish.`);
  }

  const updated = await (db as any).toolContent.update({
    where: { toolSlug: slug },
    data: {
      isPublished: true,
    },
    include: { seo: true },
  });

  // Snapshot published revision
  await (db as any).toolRevision.create({
    data: {
      toolContentId: updated.id,
      toolSlug: slug,
      contentSnapshot: {
        customTitle: updated.customTitle,
        customH1: updated.customH1,
        customDescription: updated.customDescription,
        customIntro: updated.customIntro,
        customValueProp: updated.customValueProp,
        customHowTo: updated.customHowTo,
        customFeatures: updated.customFeatures,
        customFaq: updated.customFaq,
        customRelatedTools: updated.customRelatedTools,
        blocks: (updated as any).blocks || [],
        isPublished: true,
      },
      seoSnapshot: (updated.seo as any) ?? undefined,
      authorId: author.id,
      reason: 'Published tool',
    },
  });

  await createAuditLog({
    userId: author.id,
    action: 'TOOL_PUBLISHED',
    entityType: 'TOOL',
    entityId: slug,
    metadata: { toolSlug: slug },
  });

  return updated;
}

/**
 * Unpublishes tool content, immediately reverting public visitors to canonical registry defaults.
 */
export async function unpublishTool(slug: string, author: AdminUserSession) {
  const canonical = getToolBySlug(slug);
  if (!canonical) {
    throw new Error(`Tool with slug '${slug}' not found in canonical registry.`);
  }

  const db = getDb();
  const existing = await db.toolContent.findUnique({
    where: { toolSlug: slug },
    include: { seo: true },
  });

  if (!existing) {
    throw new Error(`Tool content for '${slug}' does not exist.`);
  }

  const updated = await (db as any).toolContent.update({
    where: { toolSlug: slug },
    data: {
      isPublished: false,
    },
    include: { seo: true },
  });

  // Snapshot unpublish revision
  await (db as any).toolRevision.create({
    data: {
      toolContentId: updated.id,
      toolSlug: slug,
      contentSnapshot: {
        customTitle: updated.customTitle,
        customH1: updated.customH1,
        customDescription: updated.customDescription,
        customIntro: updated.customIntro,
        customValueProp: updated.customValueProp,
        customHowTo: updated.customHowTo,
        customFeatures: updated.customFeatures,
        customFaq: updated.customFaq,
        customRelatedTools: updated.customRelatedTools,
        blocks: (updated as any).blocks || [],
        isPublished: false,
      },
      seoSnapshot: (updated.seo as any) ?? undefined,
      authorId: author.id,
      reason: 'Unpublished tool',
    },
  });

  await createAuditLog({
    userId: author.id,
    action: 'TOOL_UNPUBLISHED',
    entityType: 'TOOL',
    entityId: slug,
    metadata: { toolSlug: slug },
  });

  return updated;
}

/**
 * Returns chronological revision history for a tool.
 */
export async function getToolRevisions(slug: string) {
  const canonical = getToolBySlug(slug);
  if (!canonical) return [];

  const db = getDb();
  return db.toolRevision.findMany({
    where: { toolSlug: slug },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Returns a specific revision snapshot.
 */
export async function getToolRevisionById(slug: string, revisionId: string) {
  const canonical = getToolBySlug(slug);
  if (!canonical) return null;

  const db = getDb();
  const revision = await db.toolRevision.findUnique({
    where: { id: revisionId },
  });

  if (!revision || revision.toolSlug !== slug) {
    return null;
  }
  return revision;
}

/**
 * Restores a historical tool revision, updating current draft state while preserving historical immutability.
 */
export async function restoreToolRevision(
  slug: string,
  revisionId: string,
  author: AdminUserSession
) {
  const canonical = getToolBySlug(slug);
  if (!canonical) {
    throw new Error(`Tool with slug '${slug}' not found in canonical registry.`);
  }

  const db = getDb();
  const revision = await getToolRevisionById(slug, revisionId);
  if (!revision) {
    throw new Error(`Revision ${revisionId} not found for tool ${slug}.`);
  }

  const snap = (revision.contentSnapshot || {}) as Record<string, any>;
  const seoSnap = (revision.seoSnapshot || null) as Record<string, any> | null;

  // Update toolContent with snapshot data
  const updated = await db.toolContent.upsert({
    where: { toolSlug: slug },
    create: {
      toolSlug: slug,
      customTitle: snap.customTitle ?? null,
      customH1: snap.customH1 ?? null,
      customDescription: snap.customDescription ?? null,
      customIntro: snap.customIntro ?? null,
      customValueProp: snap.customValueProp ?? null,
      customHowTo: snap.customHowTo ?? undefined,
      customFeatures: snap.customFeatures ?? undefined,
      customFaq: snap.customFaq ?? undefined,
      customRelatedTools: snap.customRelatedTools ?? undefined,
      blocks: snap.blocks ?? undefined,
      isPublished: false, // restoring reverts to draft for safe review
    },
    update: {
      customTitle: snap.customTitle ?? null,
      customH1: snap.customH1 ?? null,
      customDescription: snap.customDescription ?? null,
      customIntro: snap.customIntro ?? null,
      customValueProp: snap.customValueProp ?? null,
      customHowTo: snap.customHowTo ?? undefined,
      customFeatures: snap.customFeatures ?? undefined,
      customFaq: snap.customFaq ?? undefined,
      customRelatedTools: snap.customRelatedTools ?? undefined,
      blocks: snap.blocks ?? undefined,
      isPublished: false,
    },
    include: { seo: true },
  });

  // Restore SEO if present in snapshot
  if (seoSnap) {
    await (db as any).toolSeo.upsert({
      where: { toolContentId: updated.id },
      create: {
        toolContentId: updated.id,
        seoTitle: seoSnap.seoTitle ?? null,
        metaDescription: seoSnap.metaDescription ?? null,
        canonicalUrl: seoSnap.canonicalUrl ?? null,
        robotsIndex: seoSnap.robotsIndex !== false,
        robotsFollow: seoSnap.robotsFollow !== false,
        ogTitle: seoSnap.ogTitle ?? null,
        ogDescription: seoSnap.ogDescription ?? null,
        ogImage: seoSnap.ogImage ?? null,
        schemaType: seoSnap.schemaType ?? null,
        schemaJson: (seoSnap.schemaJson as any) ?? undefined,
        focusKeyword: seoSnap.focusKeyword ?? null,
      },
      update: {
        seoTitle: seoSnap.seoTitle ?? null,
        metaDescription: seoSnap.metaDescription ?? null,
        canonicalUrl: seoSnap.canonicalUrl ?? null,
        robotsIndex: seoSnap.robotsIndex !== false,
        robotsFollow: seoSnap.robotsFollow !== false,
        ogTitle: seoSnap.ogTitle ?? null,
        ogDescription: seoSnap.ogDescription ?? null,
        ogImage: seoSnap.ogImage ?? null,
        schemaType: seoSnap.schemaType ?? null,
        schemaJson: (seoSnap.schemaJson as any) ?? undefined,
        focusKeyword: seoSnap.focusKeyword ?? null,
      },
    });
  }

  // Create a brand new revision documenting the restore action
  await (db as any).toolRevision.create({
    data: {
      toolContentId: updated.id,
      toolSlug: slug,
      contentSnapshot: snap,
      seoSnapshot: (seoSnap as any) ?? undefined,
      authorId: author.id,
      reason: `Restored from revision ${revisionId}`,
    },
  });

  await createAuditLog({
    userId: author.id,
    action: 'TOOL_REVISION_RESTORED',
    entityType: 'TOOL',
    entityId: slug,
    metadata: { toolSlug: slug, restoredRevisionId: revisionId },
  });

  return getToolContentBySlug(slug);
}
