import path from 'path';
import { getDb } from '@/lib/db';
import { createAuditLog } from '@/lib/admin/services/audit.service';
import { getStorageProvider } from '@/lib/media/storage';
import {
  validateMediaUpload,
  extractImageDimensions,
  sanitizeFilename,
} from '@/lib/media/validation';
import {
  AdminUserSession,
  MediaAssetItem,
  UpdateMediaInput,
  ListMediaOptions,
} from '@/lib/admin/types';

export interface UploadFileInput {
  buffer: Buffer;
  filename: string;
  mimeType: string;
  size: number;
}

export interface MediaUploadMetadata {
  alt?: string | null;
  title?: string | null;
  caption?: string | null;
  description?: string | null;
}

/**
 * Uploads, validates, extracts dimensions, saves to storage, and persists MediaAsset.
 */
export async function uploadMedia(
  fileInput: UploadFileInput,
  author: AdminUserSession,
  metadata?: MediaUploadMetadata
): Promise<MediaAssetItem> {
  const db = getDb();
  const storage = getStorageProvider();

  // 1. Validation
  const validation = validateMediaUpload(
    fileInput.buffer,
    fileInput.filename,
    fileInput.mimeType
  );

  if (!validation.isValid) {
    throw new Error(validation.error || 'Invalid media upload.');
  }

  // 2. Generate unique, collision-safe filename
  const cleanExt = path.extname(validation.sanitizedFilename).toLowerCase();
  const baseName = path.basename(validation.sanitizedFilename, cleanExt);
  const randomSuffix = Math.random().toString(36).substring(2, 8);
  const uniqueStorageFilename = `${baseName}-${Date.now().toString(36)}-${randomSuffix}${cleanExt}`;

  // 3. Extract dimensions
  const { width, height } = extractImageDimensions(
    fileInput.buffer,
    validation.detectedMimeType
  );

  // 4. Save to storage provider
  const stored = await storage.saveFile(
    fileInput.buffer,
    uniqueStorageFilename,
    validation.detectedMimeType
  );

  // 5. Persist record in database
  const created = await db.mediaAsset.create({
    data: {
      filename: uniqueStorageFilename,
      originalFilename: fileInput.filename,
      mimeType: validation.detectedMimeType,
      size: fileInput.buffer.length,
      width,
      height,
      url: stored.url,
      storagePath: stored.storagePath,
      alt: metadata?.alt?.trim() || null,
      title: metadata?.title?.trim() || baseName.replace(/[-_]/g, ' '),
      caption: metadata?.caption?.trim() || null,
      description: metadata?.description?.trim() || null,
      uploadedById: author.id,
    },
    include: {
      uploadedBy: true,
    },
  });

  // 6. Audit logging
  await createAuditLog({
    userId: author.id,
    action: 'MEDIA_UPLOADED',
    entityType: 'MEDIA_ASSET',
    entityId: created.id,
    metadata: {
      filename: created.filename,
      originalFilename: created.originalFilename,
      size: created.size,
      mimeType: created.mimeType,
      url: created.url,
    },
  });

  return formatMediaAsset(created);
}

/**
 * Lists media assets with search, MIME filter, pagination, and sorting.
 */
export async function listMedia(options?: ListMediaOptions): Promise<{
  assets: MediaAssetItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}> {
  const db = getDb();
  const page = Math.max(1, options?.page || 1);
  const limit = Math.max(1, Math.min(100, options?.limit || 20));
  const skip = (page - 1) * limit;

  const where: any = {};

  if (options?.mimeType && options.mimeType !== 'ALL') {
    where.mimeType = options.mimeType;
  }

  if (options?.search && options.search.trim()) {
    const q = options.search.trim();
    where.OR = [
      { filename: { contains: q } },
      { originalFilename: { contains: q } },
      { title: { contains: q } },
      { alt: { contains: q } },
    ];
  }

  const orderBy: any = {};
  const sortBy = options?.sortBy || 'createdAt';
  const sortOrder = options?.sortOrder || 'desc';
  orderBy[sortBy] = sortOrder;

  const [rawAssets, total] = await Promise.all([
    db.mediaAsset.findMany({
      where,
      orderBy,
      skip,
      take: limit,
      include: { uploadedBy: true },
    }),
    db.mediaAsset.count({ where }),
  ]);

  return {
    assets: rawAssets.map(formatMediaAsset),
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}

/**
 * Retrieves a single media asset by ID.
 */
export async function getMediaById(id: string): Promise<MediaAssetItem | null> {
  const db = getDb();
  const asset = await db.mediaAsset.findUnique({
    where: { id },
    include: { uploadedBy: true },
  });

  if (!asset) return null;
  return formatMediaAsset(asset);
}

/**
 * Updates asset metadata (title, alt, caption, description).
 */
export async function updateMedia(
  id: string,
  input: UpdateMediaInput,
  author: AdminUserSession
): Promise<MediaAssetItem> {
  const db = getDb();
  const existing = await db.mediaAsset.findUnique({ where: { id } });

  if (!existing) {
    throw new Error(`Media asset not found: ${id}`);
  }

  const updated = await db.mediaAsset.update({
    where: { id },
    data: {
      title: input.title !== undefined ? input.title?.trim() || null : existing.title,
      alt: input.alt !== undefined ? input.alt?.trim() || null : existing.alt,
      caption: input.caption !== undefined ? input.caption?.trim() || null : existing.caption,
      description: input.description !== undefined ? input.description?.trim() || null : existing.description,
    },
    include: { uploadedBy: true },
  });

  await createAuditLog({
    userId: author.id,
    action: 'MEDIA_UPDATED',
    entityType: 'MEDIA_ASSET',
    entityId: id,
    metadata: {
      filename: updated.filename,
      title: updated.title,
      alt: updated.alt,
    },
  });

  return formatMediaAsset(updated);
}

/**
 * Dependency Safety Check:
 * Inspects all CMS content to see if an asset URL or filename is in active use.
 */
export async function checkMediaDependencies(
  mediaUrl: string,
  mediaFilename: string
): Promise<string[]> {
  const db = getDb();
  const references: string[] = [];

  try {
    // 1. Check Blog Posts and Blog SEO
    const blogPosts = await db.blogPost.findMany({ include: { seo: true } });
    for (const p of blogPosts) {
      if (
        (p.featuredImage && (p.featuredImage.includes(mediaUrl) || p.featuredImage.includes(mediaFilename))) ||
        (p.content && (p.content.includes(mediaUrl) || p.content.includes(mediaFilename)))
      ) {
        references.push(`Blog Post: "${p.title}" (${p.slug})`);
      }
      if (
        (p.seo?.ogImage && (p.seo.ogImage.includes(mediaUrl) || p.seo.ogImage.includes(mediaFilename))) ||
        (p.seo?.twitterImage && (p.seo.twitterImage.includes(mediaUrl) || p.seo.twitterImage.includes(mediaFilename)))
      ) {
        references.push(`Blog Post SEO: "${p.title}"`);
      }
    }

    // 2. Check Pages (Content Blocks & SEO)
    const pages = await db.page.findMany({ include: { content: true, seo: true } });
    for (const p of pages) {
      if (
        (p.seo?.ogImage && (p.seo.ogImage.includes(mediaUrl) || p.seo.ogImage.includes(mediaFilename))) ||
        (p.seo?.twitterImage && (p.seo.twitterImage.includes(mediaUrl) || p.seo.twitterImage.includes(mediaFilename)))
      ) {
        references.push(`Page SEO: "${p.name}" (${p.slug})`);
      }
      if (p.content?.blocks) {
        const blocksStr = JSON.stringify(p.content.blocks);
        if (blocksStr.includes(mediaUrl) || blocksStr.includes(mediaFilename)) {
          references.push(`Page Content Blocks: "${p.name}" (${p.slug})`);
        }
      }
    }

    // 3. Check Tool Content and Tool SEO
    const toolContents = await db.toolContent.findMany({ include: { seo: true } });
    for (const t of toolContents) {
      if (t.seo?.ogImage && (t.seo.ogImage.includes(mediaUrl) || t.seo.ogImage.includes(mediaFilename))) {
        references.push(`Tool SEO: "${t.toolSlug}"`);
      }
    }

    // 4. Check Global Settings
    const settings = await db.globalSettings.findUnique({ where: { id: 'default' } });
    if (settings) {
      if (settings.defaultOgImage && (settings.defaultOgImage.includes(mediaUrl) || settings.defaultOgImage.includes(mediaFilename))) {
        references.push('Global Settings: Default OpenGraph Image');
      }
      if (settings.defaultTwitterImage && (settings.defaultTwitterImage.includes(mediaUrl) || settings.defaultTwitterImage.includes(mediaFilename))) {
        references.push('Global Settings: Default Twitter Image');
      }
    }
  } catch (err) {
    console.warn('[MediaService] Dependency check warning:', err);
  }

  return references;
}

/**
 * Deletes a media asset after verifying dependency safety.
 * Deletes physical file and database record.
 */
export async function deleteMedia(
  id: string,
  author: AdminUserSession
): Promise<{ success: boolean; deletedFilename: string }> {
  const db = getDb();
  const storage = getStorageProvider();

  const asset = await db.mediaAsset.findUnique({ where: { id } });
  if (!asset) {
    throw new Error(`Media asset not found: ${id}`);
  }

  // 1. Dependency Safety Verification
  const dependencies = await checkMediaDependencies(asset.url, asset.filename);
  if (dependencies.length > 0) {
    throw new Error(
      `Cannot delete media asset because it is currently referenced by: ${dependencies.join(', ')}`
    );
  }

  // 2. Delete physical file via storage provider
  await storage.deleteFile(asset.storagePath);

  // 3. Delete database record
  await db.mediaAsset.delete({ where: { id } });

  // 4. Audit logging
  await createAuditLog({
    userId: author.id,
    action: 'MEDIA_DELETED',
    entityType: 'MEDIA_ASSET',
    entityId: id,
    metadata: {
      filename: asset.filename,
      originalFilename: asset.originalFilename,
      url: asset.url,
    },
  });

  return {
    success: true,
    deletedFilename: asset.filename,
  };
}

function formatMediaAsset(m: any): MediaAssetItem {
  return {
    id: m.id,
    filename: m.filename,
    originalFilename: m.originalFilename || m.filename,
    mimeType: m.mimeType,
    size: m.size,
    width: m.width || null,
    height: m.height || null,
    url: m.url,
    storagePath: m.storagePath,
    alt: m.alt || null,
    title: m.title || null,
    caption: m.caption || null,
    description: m.description || null,
    uploadedById: m.uploadedById || null,
    uploadedBy: m.uploadedBy
      ? {
          id: m.uploadedBy.id,
          name: m.uploadedBy.name,
          email: m.uploadedBy.email,
        }
      : null,
    createdAt: m.createdAt instanceof Date ? m.createdAt.toISOString() : new Date(m.createdAt || Date.now()).toISOString(),
    updatedAt: m.updatedAt instanceof Date ? m.updatedAt.toISOString() : new Date(m.updatedAt || Date.now()).toISOString(),
  };
}
