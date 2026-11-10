import type { Metadata } from 'next';
import { getDb } from '@/lib/db';
import { BlogPostItem } from '@/lib/admin/types';
import { getAllArticles, getArticleBySlug, BlogArticle } from '@/content/blog/articles';
import { siteConfig, createArticleSchema, createBreadcrumbSchema } from '@/lib/seo';
import { isSafeUrl } from '@/lib/admin/validation';

export interface ResolvedBlogList {
  posts: BlogPostItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Public Blog Resolver — Lists published posts.
 * Strictly enforces that DRAFT posts, unpublished posts, and future scheduled posts
 * are NEVER returned to public visitors.
 * Falls back gracefully to static articles when database has no published posts.
 */
export async function getPublishedPosts(options?: {
  categorySlug?: string;
  tagSlug?: string;
  search?: string;
  page?: number;
  limit?: number;
}): Promise<ResolvedBlogList> {
  const db = getDb();
  const page = Math.max(1, options?.page || 1);
  const limit = Math.max(1, Math.min(100, options?.limit || 10));
  const skip = (page - 1) * limit;

  const now = new Date();
  const where: any = {
    status: 'PUBLISHED',
    publishedAt: { lte: now },
  };

  if (options?.categorySlug) {
    where.category = { slug: options.categorySlug };
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

  try {
    const [rawPosts, dbTotal] = await Promise.all([
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

    if (dbTotal > 0 || options?.categorySlug || options?.tagSlug || options?.search) {
      const posts: BlogPostItem[] = rawPosts.map((p: any) => formatBlogPost(p));
      return {
        posts,
        total: dbTotal,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(dbTotal / limit)),
      };
    }
  } catch (err) {
    console.warn('[BlogResolver] Error querying published posts from DB, using fallback:', err);
  }

  // Graceful fallback to static articles
  const staticArticles = getAllArticles();
  let filtered = [...staticArticles];

  if (options?.search) {
    const q = options.search.toLowerCase();
    filtered = filtered.filter(
      (a) =>
        a.title.toLowerCase().includes(q) ||
        a.description.toLowerCase().includes(q) ||
        a.content.some((p) => p.toLowerCase().includes(q))
    );
  }

  const total = filtered.length;
  const pagedArticles = filtered.slice(skip, skip + limit);
  const posts = pagedArticles.map(convertStaticArticleToBlogPost);

  return {
    posts,
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}

/**
 * Public Blog Resolver — Resolves single published post by slug.
 * Strictly guarantees draft isolation.
 */
export async function getPublishedPostBySlug(slug: string): Promise<BlogPostItem | null> {
  const db = getDb();
  const now = new Date(Date.now() + 60 * 1000);

  try {
    const post = await db.blogPost.findUnique({
      where: { slug },
      include: {
        author: true,
        category: true,
        tags: { include: { tag: true } },
        seo: true,
      },
    });

    if (post && post.status === 'PUBLISHED' && post.publishedAt && new Date(post.publishedAt) <= now) {
      return formatBlogPost(post);
    }
  } catch (err) {
    console.warn('[BlogResolver] Error resolving post by slug from DB:', err);
  }

  // Check static fallback articles
  const staticArticle = getArticleBySlug(slug);
  if (staticArticle) {
    return convertStaticArticleToBlogPost(staticArticle);
  }

  return null;
}

/**
 * Admin Preview Resolver — Returns post by ID regardless of draft status.
 * Used exclusively by authenticated admin preview route.
 */
export async function getPreviewPostById(id: string): Promise<BlogPostItem | null> {
  const db = getDb();
  const post = await db.blogPost.findUnique({
    where: { id },
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
 * Builds Next.js App Router Metadata for /blog/[slug].
 */
export async function buildBlogPostMetadata(slug: string, defaultMeta: Metadata): Promise<Metadata> {
  const post = await getPublishedPostBySlug(slug);
  if (!post) return defaultMeta;

  const canonicalUrl = post.seo?.canonicalUrl || `${siteConfig.url}/blog/${post.slug}`;
  const title = post.seo?.seoTitle || post.title;
  const description = post.seo?.metaDescription || post.excerpt || `${post.title} — FileTools Guide`;
  const ogImage = post.seo?.ogImage || post.featuredImage || siteConfig.ogImage;
  const twitterImage = post.seo?.twitterImage || ogImage;

  return {
    ...defaultMeta,
    title,
    description,
    alternates: {
      canonical: canonicalUrl,
    },
    robots: {
      index: post.seo?.robotsIndex !== false,
      follow: post.seo?.robotsFollow !== false,
    },
    openGraph: {
      ...defaultMeta.openGraph,
      title: post.seo?.ogTitle || title,
      description: post.seo?.ogDescription || description,
      url: canonicalUrl,
      type: 'article',
      publishedTime: post.publishedAt || undefined,
      modifiedTime: post.updatedAt || undefined,
      authors: post.author?.name ? [post.author.name] : undefined,
      images: ogImage ? [{ url: ogImage, alt: post.featuredImageAlt || title }] : (defaultMeta.openGraph?.images as any),
    },
    twitter: {
      ...defaultMeta.twitter,
      title: post.seo?.twitterTitle || title,
      description: post.seo?.twitterDescription || description,
      images: twitterImage ? [twitterImage] : (defaultMeta.twitter?.images as any),
    },
  };
}

/**
 * Generates Schema.org Article and Breadcrumb JSON-LD for a published blog post.
 */
export async function getBlogPostJsonLd(slug: string): Promise<{ articleSchema: Record<string, any>; breadcrumbSchema: Record<string, any> } | null> {
  const post = await getPublishedPostBySlug(slug);
  if (!post) return null;

  const articleUrl = post.seo?.canonicalUrl || `${siteConfig.url}/blog/${post.slug}`;

  // Custom Schema Override if present
  if (post.seo?.schemaJson && typeof post.seo.schemaJson === 'object') {
    const breadcrumbSchema = createBreadcrumbSchema([
      { name: 'Home', url: siteConfig.url },
      { name: 'Blog', url: `${siteConfig.url}/blog` },
      { name: post.title, url: articleUrl },
    ]);
    return {
      articleSchema: post.seo.schemaJson as Record<string, any>,
      breadcrumbSchema,
    };
  }

  const articleSchema = createArticleSchema(
    post.title,
    post.excerpt || post.title,
    articleUrl,
    post.publishedAt || post.createdAt
  );

  if (post.featuredImage) {
    (articleSchema as any).image = [post.featuredImage];
  }

  if (post.author?.name) {
    (articleSchema as any).author = {
      '@type': 'Person',
      name: post.author.name,
    };
  }

  const breadcrumbSchema = createBreadcrumbSchema([
    { name: 'Home', url: siteConfig.url },
    { name: 'Blog', url: `${siteConfig.url}/blog` },
    { name: post.title, url: articleUrl },
  ]);

  return { articleSchema, breadcrumbSchema };
}

// Helpers
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
    publishedAt: p.publishedAt ? new Date(p.publishedAt).toISOString() : null,
    scheduledFor: p.scheduledFor ? new Date(p.scheduledFor).toISOString() : null,
    authorId: p.authorId || null,
    author: p.author ? { id: p.author.id, name: p.author.name, email: p.author.email, role: p.author.role } : null,
    categoryId: p.categoryId || null,
    category: p.category ? { id: p.category.id, slug: p.category.slug, name: p.category.name, description: p.category.description } : null,
    tags: p.tags?.map((pt: any) => ({
      postId: pt.postId,
      tagId: pt.tagId,
      tag: pt.tag ? { id: pt.tag.id, slug: pt.tag.slug, name: pt.tag.name } : null,
    })) || [],
    seo: p.seo || null,
    createdAt: p.createdAt ? new Date(p.createdAt).toISOString() : new Date().toISOString(),
    updatedAt: p.updatedAt ? new Date(p.updatedAt).toISOString() : new Date().toISOString(),
  };
}

function convertStaticArticleToBlogPost(a: BlogArticle): BlogPostItem {
  const contentMarkdown = Array.isArray(a.content) ? a.content.join('\n\n') : String(a.content);
  return {
    id: `static-${a.slug}`,
    slug: a.slug,
    title: a.title,
    excerpt: a.description,
    content: contentMarkdown,
    featuredImage: null,
    featuredImageAlt: null,
    readingTime: a.readingTime,
    status: 'PUBLISHED',
    publishedAt: new Date(a.publishedAt).toISOString(),
    scheduledFor: null,
    authorId: null,
    author: { id: 'static-author', name: a.author, email: 'author@filetools.local' },
    categoryId: null,
    category: null,
    tags: [],
    seo: {
      seoTitle: a.title,
      metaDescription: a.description,
      canonicalUrl: `${siteConfig.url}/blog/${a.slug}`,
      robotsIndex: true,
      robotsFollow: true,
      ogTitle: a.title,
      ogDescription: a.description,
      ogImage: null,
      twitterTitle: a.title,
      twitterDescription: a.description,
      twitterImage: null,
      schemaType: 'Article',
      schemaJson: null,
      focusKeyword: null,
    },
    createdAt: new Date(a.publishedAt).toISOString(),
    updatedAt: new Date(a.publishedAt).toISOString(),
  };
}
