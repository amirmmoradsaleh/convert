import { getDb } from '@/lib/db';
import {
  BlogPostItem,
  CreateBlogPostInput,
  UpdateBlogPostInput,
  ListBlogPostsOptions,
  BlogCategoryItem,
  BlogTagItem,
  BlogPostRevisionItem,
  AdminUserSession,
} from '../types';
import { createAuditLog } from './audit.service';
import {
  validateBlogPostPayload,
  validateCategoryPayload,
  validateTagPayload,
  isSafeUrl,
} from '../validation';
import { hasPermission } from '../permissions';

/**
 * Calculates estimated reading time based on standard 200 words per minute.
 */
export function calculateReadingTime(content: string): string {
  if (!content || typeof content !== 'string') return '1 min read';
  const plainText = content
    .replace(/!\[.*?\]\(((?:[^()]|\([^()]*\))*)\)/g, ' ')
    .replace(/\[([^\]]+)\]\(((?:[^()]|\([^()]*\))*)\)/g, ' $1 ')
    .replace(/<[^>]*>/g, ' ');
  const words = plainText.trim().split(/\s+/).filter(Boolean).length;
  const minutes = Math.max(1, Math.ceil(words / 200));
  return `${minutes} min read`;
}

/**
 * Normalizes title or raw slug into a URL-safe lowercase slug.
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-_]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Lists blog posts with optional filters, search, and pagination.
 */
export async function listPosts(options?: ListBlogPostsOptions): Promise<{
  posts: BlogPostItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}> {
  const db = getDb();
  const page = Math.max(1, options?.page || 1);
  const limit = Math.max(1, Math.min(100, options?.limit || 10));
  const skip = (page - 1) * limit;

  const where: any = {};

  if (options?.status) {
    where.status = options.status;
  }

  if (options?.publishedOnly) {
    where.status = 'PUBLISHED';
    where.publishedAt = { lte: new Date() };
  }

  if (options?.categoryId) {
    where.categoryId = options.categoryId;
  }

  if (options?.categorySlug) {
    where.category = { slug: options.categorySlug };
  }

  if (options?.tagId) {
    where.tags = { some: { tagId: options.tagId } };
  }

  if (options?.tagSlug) {
    where.tags = { some: { tag: { slug: options.tagSlug } } };
  }

  if (options?.search) {
    const q = options.search.trim();
    if (q) {
      where.OR = [
        { title: { contains: q } },
        { excerpt: { contains: q } },
        { content: { contains: q } },
      ];
    }
  }

  const [rawPosts, total] = await Promise.all([
    db.blogPost.findMany({
      where,
      include: {
        author: true,
        category: true,
        tags: { include: { tag: true } },
        seo: true,
      },
      orderBy: { publishedAt: 'desc' },
      take: limit,
      skip,
    }),
    db.blogPost.count({ where }),
  ]);

  const posts: BlogPostItem[] = rawPosts.map((p: any) => formatBlogPost(p));
  const totalPages = Math.max(1, Math.ceil(total / limit));

  return { posts, total, page, limit, totalPages };
}

/**
 * Fetches single blog post by unique ID.
 */
export async function getPostById(id: string): Promise<BlogPostItem | null> {
  const db = getDb();
  let post = await db.blogPost.findUnique({
    where: { id },
    include: {
      author: true,
      category: true,
      tags: { include: { tag: true } },
      seo: true,
      revisions: {
        include: { author: true },
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  if (!post) {
    post = await db.blogPost.findUnique({
      where: { slug: id },
      include: {
        author: true,
        category: true,
        tags: { include: { tag: true } },
        seo: true,
        revisions: {
          include: { author: true },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
  }

  if (!post) return null;
  return formatBlogPost(post);
}

/**
 * Fetches single blog post by unique slug.
 */
export async function getPostBySlug(slug: string): Promise<BlogPostItem | null> {
  const db = getDb();
  const post = await db.blogPost.findUnique({
    where: { slug },
    include: {
      author: true,
      category: true,
      tags: { include: { tag: true } },
      seo: true,
    },
  });

  if (!post) return null;
  return formatBlogPost(post);
}

/**
 * Creates a new draft blog post.
 */
export async function createDraft(
  input: CreateBlogPostInput,
  author: AdminUserSession
): Promise<BlogPostItem> {
  const db = getDb();

  const validation = validateBlogPostPayload(input);
  if (!validation.isValid) {
    const details = validation.report.errors.map((e) => `${e.field}: ${e.message}`).join(', ');
    throw new Error(`Validation failed: ${details}`);
  }

  // Derive unique slug
  let candidateSlug = validation.sanitized.slug || slugify(validation.sanitized.title);
  if (!candidateSlug) {
    candidateSlug = `post-${Date.now()}`;
  }

  const existingSlug = await db.blogPost.findUnique({ where: { slug: candidateSlug } });
  if (existingSlug) {
    candidateSlug = `${candidateSlug}-${Date.now().toString(36)}`;
  }

  const readingTime = calculateReadingTime(validation.sanitized.content);
  const status = input.status || 'DRAFT';

  if ((status === 'PUBLISHED' || status === 'SCHEDULED') && !hasPermission(author.role, 'PUBLISH_CONTENT')) {
    throw new Error(`Forbidden: Role '${author.role}' lacks 'PUBLISH_CONTENT' permission to publish or schedule blog posts.`);
  }

  const publishedAt = status === 'PUBLISHED' ? (input.publishedAt ? new Date(input.publishedAt) : new Date()) : null;
  const scheduledFor = input.scheduledFor ? new Date(input.scheduledFor) : null;

  const tagData = Array.isArray(input.tagIds)
    ? input.tagIds.map((tagId) => ({ tagId }))
    : [];

  const created = await db.blogPost.create({
    data: {
      slug: candidateSlug,
      title: validation.sanitized.title,
      excerpt: validation.sanitized.excerpt,
      content: validation.sanitized.content,
      featuredImage: validation.sanitized.featuredImage,
      featuredImageAlt: validation.sanitized.featuredImageAlt,
      readingTime,
      status,
      publishedAt,
      scheduledFor,
      authorId: author.id,
      categoryId: input.categoryId || null,
      tags: tagData.length > 0 ? { create: tagData } : undefined,
      seo: input.seo
        ? {
            create: {
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
              schemaType: input.seo.schemaType || 'Article',
              schemaJson: (input.seo.schemaJson as any) ?? undefined,
              focusKeyword: input.seo.focusKeyword || null,
            },
          }
        : undefined,
    },
    include: {
      author: true,
      category: true,
      tags: { include: { tag: true } },
      seo: true,
    },
  });

  // Snapshot initial revision
  await createRevisionSnapshot(created.id, author.id, 'Initial draft creation');

  await createAuditLog({
    userId: author.id,
    action: 'BLOG_POST_CREATED',
    entityType: 'BLOG_POST',
    entityId: created.id,
    metadata: { title: created.title, slug: created.slug, status: created.status },
  });

  return formatBlogPost(created);
}

/**
 * Updates an existing draft blog post.
 */
export async function updateDraft(
  id: string,
  input: UpdateBlogPostInput,
  author: AdminUserSession
): Promise<BlogPostItem> {
  const db = getDb();
  let existing = await db.blogPost.findUnique({
    where: { id },
    include: { seo: true, tags: true },
  });

  if (!existing) {
    existing = await db.blogPost.findUnique({
      where: { slug: id },
      include: { seo: true, tags: true },
    });
  }

  if (!existing) {
    throw new Error(`BlogPost not found: ${id}`);
  }

  const postId = existing.id;

  // Enforce publication authorization: users lacking PUBLISH_CONTENT cannot mutate published or scheduled blog posts
  if ((existing.status === 'PUBLISHED' || existing.status === 'SCHEDULED') && !hasPermission(author.role, 'PUBLISH_CONTENT')) {
    throw new Error(`Forbidden: Role '${author.role}' lacks 'PUBLISH_CONTENT' permission to modify published or scheduled blog posts.`);
  }

  // Enforce publication authorization: users lacking PUBLISH_CONTENT cannot transition a draft to published or scheduled
  if ((input.status === 'PUBLISHED' || input.status === 'SCHEDULED') && !hasPermission(author.role, 'PUBLISH_CONTENT')) {
    throw new Error(`Forbidden: Role '${author.role}' lacks 'PUBLISH_CONTENT' permission to publish or schedule blog posts.`);
  }

  const validation = validateBlogPostPayload({
    title: input.title !== undefined ? input.title : existing.title,
    slug: input.slug !== undefined ? input.slug : existing.slug,
    excerpt: input.excerpt !== undefined ? input.excerpt : existing.excerpt,
    content: input.content !== undefined ? input.content : existing.content,
    featuredImage: input.featuredImage !== undefined ? input.featuredImage : existing.featuredImage,
    featuredImageAlt: input.featuredImageAlt !== undefined ? input.featuredImageAlt : existing.featuredImageAlt,
    status: input.status !== undefined ? input.status : existing.status,
    scheduledFor: input.scheduledFor !== undefined ? input.scheduledFor : existing.scheduledFor,
    seo: input.seo,
  });

  if (!validation.isValid) {
    const details = validation.report.errors.map((e) => `${e.field}: ${e.message}`).join(', ');
    throw new Error(`Validation failed: ${details}`);
  }

  // Slug collision check
  let targetSlug = existing.slug;
  if (input.slug) {
    const candidate = slugify(input.slug);
    if (candidate !== existing.slug) {
      const collision = await db.blogPost.findUnique({ where: { slug: candidate } });
      if (collision && collision.id !== id) {
        throw new Error(`A post with slug '${candidate}' already exists.`);
      }
      targetSlug = candidate;
    }
  }

  const newContent = input.content !== undefined ? validation.sanitized.content : existing.content;
  const readingTime = calculateReadingTime(newContent);

  const updateData: any = {
    title: input.title !== undefined ? validation.sanitized.title : existing.title,
    slug: targetSlug,
    excerpt: input.excerpt !== undefined ? validation.sanitized.excerpt : existing.excerpt,
    content: newContent,
    featuredImage: input.featuredImage !== undefined ? validation.sanitized.featuredImage : existing.featuredImage,
    featuredImageAlt: input.featuredImageAlt !== undefined ? validation.sanitized.featuredImageAlt : existing.featuredImageAlt,
    readingTime,
    status: input.status !== undefined ? input.status : existing.status,
    categoryId: input.categoryId !== undefined ? input.categoryId : existing.categoryId,
  };

  if (input.publishedAt !== undefined) {
    updateData.publishedAt = input.publishedAt ? new Date(input.publishedAt) : null;
  } else if (input.status === 'PUBLISHED' && !existing.publishedAt) {
    updateData.publishedAt = new Date();
  }
  if (input.scheduledFor !== undefined) {
    updateData.scheduledFor = input.scheduledFor ? new Date(input.scheduledFor) : null;
  }

  // Handle SEO
  if (input.seo) {
    updateData.seo = {
      upsert: {
        create: {
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
          schemaType: input.seo.schemaType || 'Article',
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
      },
    };
  }

  // Handle tags
  if (input.tagIds) {
    updateData.tags = {
      deleteMany: {},
      create: input.tagIds.map((tagId) => ({ tagId })),
    };
  }

  const updated = await db.blogPost.update({
    where: { id: postId },
    data: updateData,
    include: {
      author: true,
      category: true,
      tags: { include: { tag: true } },
      seo: true,
    },
  });

  // Snapshot revision
  await createRevisionSnapshot(postId, author.id, input.reason || 'Content update');

  await createAuditLog({
    userId: author.id,
    action: 'BLOG_POST_UPDATED',
    entityType: 'BLOG_POST',
    entityId: postId,
    metadata: { title: updated.title, slug: updated.slug, status: updated.status },
  });

  return formatBlogPost(updated);
}

/**
 * Deletes a blog post and its associated metadata/tags/revisions.
 */
export async function deletePost(id: string, author: AdminUserSession): Promise<void> {
  const db = getDb();
  let existing = await db.blogPost.findUnique({ where: { id } });
  if (!existing) {
    existing = await db.blogPost.findUnique({ where: { slug: id } });
  }
  if (!existing) {
    throw new Error(`BlogPost not found: ${id}`);
  }

  if ((existing.status === 'PUBLISHED' || existing.status === 'SCHEDULED') && !hasPermission(author.role, 'PUBLISH_CONTENT')) {
    throw new Error(`Forbidden: Role '${author.role}' lacks 'PUBLISH_CONTENT' permission to delete published blog posts.`);
  }

  const postId = existing.id;
  await db.blogPost.delete({ where: { id: postId } });

  await createAuditLog({
    userId: author.id,
    action: 'BLOG_POST_DELETED',
    entityType: 'BLOG_POST',
    entityId: postId,
    metadata: { title: existing.title, slug: existing.slug },
  });
}

/**
 * Publishes a blog post immediately.
 */
export async function publishPost(id: string, author: AdminUserSession): Promise<BlogPostItem> {
  const db = getDb();
  let existing = await db.blogPost.findUnique({ where: { id } });
  if (!existing) {
    existing = await db.blogPost.findUnique({ where: { slug: id } });
  }
  if (!existing) {
    throw new Error(`BlogPost not found: ${id}`);
  }

  const postId = existing.id;
  const publishedAt = existing.publishedAt || new Date();

  const updated = await db.blogPost.update({
    where: { id: postId },
    data: {
      status: 'PUBLISHED',
      publishedAt,
      scheduledFor: null,
    },
    include: {
      author: true,
      category: true,
      tags: { include: { tag: true } },
      seo: true,
    },
  });

  await createRevisionSnapshot(id, author.id, 'Published post');

  await createAuditLog({
    userId: author.id,
    action: 'BLOG_POST_PUBLISHED',
    entityType: 'BLOG_POST',
    entityId: id,
    metadata: { title: updated.title, slug: updated.slug },
  });

  return formatBlogPost(updated);
}

/**
 * Unpublishes a blog post, moving it back to draft state.
 */
export async function unpublishPost(id: string, author: AdminUserSession): Promise<BlogPostItem> {
  const db = getDb();
  let existing = await db.blogPost.findUnique({ where: { id } });
  if (!existing) {
    existing = await db.blogPost.findUnique({ where: { slug: id } });
  }
  if (!existing) {
    throw new Error(`BlogPost not found: ${id}`);
  }

  const postId = existing.id;
  const updated = await db.blogPost.update({
    where: { id: postId },
    data: {
      status: 'DRAFT',
    },
    include: {
      author: true,
      category: true,
      tags: { include: { tag: true } },
      seo: true,
    },
  });

  await createRevisionSnapshot(postId, author.id, 'Unpublished post');

  await createAuditLog({
    userId: author.id,
    action: 'BLOG_POST_UNPUBLISHED',
    entityType: 'BLOG_POST',
    entityId: postId,
    metadata: { title: updated.title, slug: updated.slug },
  });

  return formatBlogPost(updated);
}

/**
 * Schedules a blog post for future publishing.
 */
export async function schedulePost(
  id: string,
  scheduledFor: Date | string,
  author: AdminUserSession
): Promise<BlogPostItem> {
  const db = getDb();
  const existing = await db.blogPost.findUnique({ where: { id } });
  if (!existing) {
    throw new Error(`BlogPost not found: ${id}`);
  }

  const targetDate = new Date(scheduledFor);
  if (isNaN(targetDate.getTime())) {
    throw new Error('Invalid scheduled publication date.');
  }

  const updated = await db.blogPost.update({
    where: { id },
    data: {
      status: 'SCHEDULED',
      scheduledFor: targetDate,
      publishedAt: targetDate,
    },
    include: {
      author: true,
      category: true,
      tags: { include: { tag: true } },
      seo: true,
    },
  });

  await createRevisionSnapshot(id, author.id, `Scheduled publication for ${targetDate.toISOString()}`);

  await createAuditLog({
    userId: author.id,
    action: 'BLOG_POST_SCHEDULED',
    entityType: 'BLOG_POST',
    entityId: id,
    metadata: { title: updated.title, scheduledFor: targetDate.toISOString() },
  });

  return formatBlogPost(updated);
}

// ==========================================
// CATEGORIES & TAGS MANAGEMENT
// ==========================================

export async function listCategories(): Promise<BlogCategoryItem[]> {
  const db = getDb();
  const categories = await db.blogCategory.findMany({
    include: { _count: { select: { posts: true } } },
    orderBy: { name: 'asc' },
  });

  return categories.map((c: any) => ({
    id: c.id,
    slug: c.slug,
    name: c.name,
    description: c.description || null,
    postCount: c._count?.posts || 0,
    createdAt: c.createdAt ? new Date(c.createdAt).toISOString() : undefined,
    updatedAt: c.updatedAt ? new Date(c.updatedAt).toISOString() : undefined,
  }));
}

export async function createCategory(
  input: { name: string; slug?: string; description?: string | null },
  author?: AdminUserSession
): Promise<BlogCategoryItem> {
  const db = getDb();
  const validation = validateCategoryPayload(input);
  if (!validation.isValid) {
    throw new Error(validation.report.errors.map((e) => e.message).join(', '));
  }

  const existing = await db.blogCategory.findUnique({ where: { slug: validation.sanitized.slug } });
  if (existing) {
    throw new Error(`Category with slug '${validation.sanitized.slug}' already exists.`);
  }

  const created = await db.blogCategory.create({
    data: {
      name: validation.sanitized.name,
      slug: validation.sanitized.slug,
      description: validation.sanitized.description,
    },
  });

  if (author) {
    await createAuditLog({
      userId: author.id,
      action: 'BLOG_CATEGORY_CREATED',
      entityType: 'BLOG_CATEGORY',
      entityId: created.id,
      metadata: { name: created.name, slug: created.slug },
    });
  }

  return {
    id: created.id,
    slug: created.slug,
    name: created.name,
    description: created.description,
    postCount: 0,
  };
}

export async function deleteCategory(id: string, author: AdminUserSession): Promise<void> {
  const db = getDb();
  const category = await db.blogCategory.findUnique({
    where: { id },
    include: { _count: { select: { posts: true } } },
  });
  if (!category) {
    throw new Error(`Category not found: ${id}`);
  }

  await db.blogCategory.delete({ where: { id } });

  await createAuditLog({
    userId: author.id,
    action: 'BLOG_CATEGORY_DELETED',
    entityType: 'BLOG_CATEGORY',
    entityId: id,
    metadata: { name: category.name, slug: category.slug },
  });
}

export async function listTags(): Promise<BlogTagItem[]> {
  const db = getDb();
  const tags = await db.blogTag.findMany({
    include: { _count: { select: { posts: true } } },
    orderBy: { name: 'asc' },
  });

  return tags.map((t: any) => ({
    id: t.id,
    slug: t.slug,
    name: t.name,
    postCount: t._count?.posts || 0,
    createdAt: t.createdAt ? new Date(t.createdAt).toISOString() : undefined,
    updatedAt: t.updatedAt ? new Date(t.updatedAt).toISOString() : undefined,
  }));
}

export async function createTag(
  input: { name: string; slug?: string },
  author?: AdminUserSession
): Promise<BlogTagItem> {
  const db = getDb();
  const validation = validateTagPayload(input);
  if (!validation.isValid) {
    throw new Error(validation.report.errors.map((e) => e.message).join(', '));
  }

  const existing = await db.blogTag.findUnique({ where: { slug: validation.sanitized.slug } });
  if (existing) {
    throw new Error(`Tag with slug '${validation.sanitized.slug}' already exists.`);
  }

  const created = await db.blogTag.create({
    data: {
      name: validation.sanitized.name,
      slug: validation.sanitized.slug,
    },
  });

  if (author) {
    await createAuditLog({
      userId: author.id,
      action: 'BLOG_TAG_CREATED',
      entityType: 'BLOG_TAG',
      entityId: created.id,
      metadata: { name: created.name, slug: created.slug },
    });
  }

  return {
    id: created.id,
    slug: created.slug,
    name: created.name,
    postCount: 0,
  };
}

export async function deleteTag(id: string, author: AdminUserSession): Promise<void> {
  const db = getDb();
  const tag = await db.blogTag.findUnique({ where: { id } });
  if (!tag) {
    throw new Error(`Tag not found: ${id}`);
  }

  await db.blogTag.delete({ where: { id } });

  await createAuditLog({
    userId: author.id,
    action: 'BLOG_TAG_DELETED',
    entityType: 'BLOG_TAG',
    entityId: id,
    metadata: { name: tag.name, slug: tag.slug },
  });
}

// ==========================================
// REVISION HISTORY & ROLLBACK
// ==========================================

export async function listRevisions(postId: string): Promise<BlogPostRevisionItem[]> {
  const db = getDb();
  let post = await db.blogPost.findUnique({ where: { id: postId } });
  if (!post) {
    post = await db.blogPost.findUnique({ where: { slug: postId } });
  }
  const actualPostId = post ? post.id : postId;

  const revisions = await db.postRevision.findMany({
    where: { postId: actualPostId },
    include: { author: true },
    orderBy: { createdAt: 'desc' },
  });

  return revisions.map((r: any) => ({
    id: r.id,
    postId: r.postId,
    contentSnapshot: r.contentSnapshot,
    seoSnapshot: r.seoSnapshot || null,
    authorId: r.authorId || null,
    author: r.author ? { id: r.author.id, name: r.author.name, email: r.author.email } : null,
    reason: r.reason || null,
    createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : new Date(r.createdAt).toISOString(),
  }));
}

export async function getRevision(revisionId: string): Promise<BlogPostRevisionItem | null> {
  const db = getDb();
  const revision = await db.postRevision.findUnique({
    where: { id: revisionId },
    include: { author: true },
  });
  if (!revision) return null;
  return {
    id: revision.id,
    postId: revision.postId,
    contentSnapshot: revision.contentSnapshot,
    seoSnapshot: revision.seoSnapshot || null,
    authorId: revision.authorId || null,
    author: revision.author ? { id: revision.author.id, name: revision.author.name, email: revision.author.email } : null,
    reason: revision.reason || null,
    createdAt: revision.createdAt instanceof Date ? revision.createdAt.toISOString() : new Date(revision.createdAt).toISOString(),
  };
}

export async function restoreRevision(
  postId: string,
  revisionId: string,
  author: AdminUserSession
): Promise<BlogPostItem> {
  const db = getDb();
  let post = await db.blogPost.findUnique({ where: { id: postId } });
  if (!post) {
    post = await db.blogPost.findUnique({ where: { slug: postId } });
  }
  if (!post) {
    throw new Error(`BlogPost not found: ${postId}`);
  }
  const actualPostId = post.id;

  if ((post.status === 'PUBLISHED' || post.status === 'SCHEDULED') && !hasPermission(author.role, 'PUBLISH_CONTENT')) {
    throw new Error(`Forbidden: Role '${author.role}' lacks 'PUBLISH_CONTENT' permission to restore revisions on published posts.`);
  }

  const revision = await db.postRevision.findUnique({ where: { id: revisionId } });
  if (!revision || (revision.postId !== actualPostId && revision.postId !== postId)) {
    throw new Error(`Revision '${revisionId}' not found for post '${postId}'.`);
  }

  const snapshot = revision.contentSnapshot as any;
  const seoSnapshot = revision.seoSnapshot as any;

  const readingTime = calculateReadingTime(snapshot.content || '');

  const updated = await db.blogPost.update({
    where: { id: actualPostId },
    data: {
      title: snapshot.title,
      slug: snapshot.slug,
      excerpt: snapshot.excerpt,
      content: snapshot.content,
      featuredImage: snapshot.featuredImage,
      featuredImageAlt: snapshot.featuredImageAlt,
      readingTime,
      categoryId: snapshot.categoryId || null,
      seo: seoSnapshot
        ? {
            upsert: {
              create: { ...seoSnapshot },
              update: { ...seoSnapshot },
            },
          }
        : undefined,
    },
    include: {
      author: true,
      category: true,
      tags: { include: { tag: true } },
      seo: true,
    },
  });

  // Create snapshot recording the restoration
  await createRevisionSnapshot(actualPostId, author.id, `Restored from revision ${revisionId.slice(0, 8)}`);

  await createAuditLog({
    userId: author.id,
    action: 'BLOG_POST_REVISION_RESTORED',
    entityType: 'BLOG_POST',
    entityId: actualPostId,
    metadata: { restoredRevisionId: revisionId, title: updated.title },
  });

  return formatBlogPost(updated);
}

// ==========================================
// HELPERS
// ==========================================

async function createRevisionSnapshot(postId: string, authorId?: string | null, reason?: string) {
  const db = getDb();
  const post = await db.blogPost.findUnique({
    where: { id: postId },
    include: { seo: true, tags: true },
  });
  if (!post) return;

  const contentSnapshot = {
    title: post.title,
    slug: post.slug,
    excerpt: post.excerpt,
    content: post.content,
    featuredImage: post.featuredImage,
    featuredImageAlt: post.featuredImageAlt,
    categoryId: post.categoryId,
    tagIds: post.tags?.map((t: any) => t.tagId) || [],
  };

  const seoSnapshot = post.seo
    ? {
        seoTitle: post.seo.seoTitle,
        metaDescription: post.seo.metaDescription,
        canonicalUrl: post.seo.canonicalUrl,
        robotsIndex: post.seo.robotsIndex,
        robotsFollow: post.seo.robotsFollow,
        ogTitle: post.seo.ogTitle,
        ogDescription: post.seo.ogDescription,
        ogImage: post.seo.ogImage,
        twitterTitle: post.seo.twitterTitle,
        twitterDescription: post.seo.twitterDescription,
        twitterImage: post.seo.twitterImage,
        schemaType: post.seo.schemaType,
        schemaJson: post.seo.schemaJson,
        focusKeyword: post.seo.focusKeyword,
      }
    : null;

  await db.postRevision.create({
    data: {
      postId,
      contentSnapshot,
      seoSnapshot: (seoSnapshot as any) ?? undefined,
      authorId: authorId || null,
      reason: reason || 'Revision snapshot',
    },
  });
}

function formatBlogPost(p: any): BlogPostItem {
  return {
    id: p.id,
    slug: p.slug,
    title: p.title,
    excerpt: p.excerpt || null,
    content: p.content || '',
    featuredImage: isSafeUrl(p.featuredImage) ? p.featuredImage : null,
    featuredImageAlt: p.featuredImageAlt || null,
    readingTime: p.readingTime || '1 min read',
    status: p.status,
    publishedAt: p.publishedAt instanceof Date ? p.publishedAt.toISOString() : p.publishedAt ? new Date(p.publishedAt).toISOString() : null,
    scheduledFor: p.scheduledFor instanceof Date ? p.scheduledFor.toISOString() : p.scheduledFor ? new Date(p.scheduledFor).toISOString() : null,
    authorId: p.authorId || null,
    author: p.author ? { id: p.author.id, name: p.author.name, email: p.author.email, role: p.author.role } : null,
    categoryId: p.categoryId || null,
    category: p.category ? { id: p.category.id, slug: p.category.slug, name: p.category.name, description: p.category.description } : null,
    tags: p.tags?.map((pt: any) => ({
      postId: pt.postId,
      tagId: pt.tagId,
      tag: pt.tag ? { id: pt.tag.id, slug: pt.tag.slug, name: pt.tag.name } : null,
    })) || [],
    seo: p.seo
      ? {
          seoTitle: p.seo.seoTitle || null,
          metaDescription: p.seo.metaDescription || null,
          canonicalUrl: p.seo.canonicalUrl || null,
          robotsIndex: p.seo.robotsIndex !== false,
          robotsFollow: p.seo.robotsFollow !== false,
          ogTitle: p.seo.ogTitle || null,
          ogDescription: p.seo.ogDescription || null,
          ogImage: p.seo.ogImage || null,
          twitterTitle: p.seo.twitterTitle || null,
          twitterDescription: p.seo.twitterDescription || null,
          twitterImage: p.seo.twitterImage || null,
          schemaType: p.seo.schemaType || 'Article',
          schemaJson: p.seo.schemaJson || null,
          focusKeyword: p.seo.focusKeyword || null,
        }
      : null,
    createdAt: p.createdAt instanceof Date ? p.createdAt.toISOString() : new Date(p.createdAt || Date.now()).toISOString(),
    updatedAt: p.updatedAt instanceof Date ? p.updatedAt.toISOString() : new Date(p.updatedAt || Date.now()).toISOString(),
  };
}

// Aliases for consistent naming across Phase 04 tests and consumers
export const createBlogDraft = createDraft;
export const updateBlogDraft = updateDraft;
export const publishBlogPost = publishPost;
export const unpublishBlogPost = unpublishPost;
export const scheduleBlogPost = schedulePost;
export const getBlogPostById = getPostById;
export const getBlogPostBySlug = getPostBySlug;
export const deleteBlogPost = deletePost;
export const getBlogRevisions = listRevisions;
export const restorePostRevision = restoreRevision;

