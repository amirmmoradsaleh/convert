import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Calendar, Clock, ArrowRight, BookOpen, Search, FolderPlus, Tag as TagIcon } from 'lucide-react';
import Container from '@/components/layout/Container';
import Breadcrumbs from '@/components/seo/Breadcrumbs';
import { getPublishedPosts } from '@/lib/cms/blog-resolver';
import { listCategories } from '@/lib/admin/services/blog.service';
import { isSafeUrl } from '@/lib/admin/validation';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Guides & Tutorials – File Conversion, Compression & Format Tips',
  description: 'In-depth guides on image compression, PDF management, file format optimization, and client-side browser performance.',
};

interface BlogIndexPageProps {
  searchParams: Promise<{
    category?: string;
    tag?: string;
    q?: string;
    page?: string;
  }>;
}

export default async function BlogIndexPage({ searchParams }: BlogIndexPageProps) {
  const resolvedParams = await searchParams;
  const categorySlug = resolvedParams.category || undefined;
  const tagSlug = resolvedParams.tag || undefined;
  const search = resolvedParams.q || undefined;
  const page = parseInt(resolvedParams.page || '1', 10);

  const [{ posts, total, totalPages }, categories] = await Promise.all([
    getPublishedPosts({
      categorySlug,
      tagSlug,
      search,
      page,
      limit: 10,
    }),
    listCategories().catch(() => []),
  ]);

  return (
    <div className="py-8 md:py-12 space-y-8">
      <Container>
        <Breadcrumbs items={[{ name: 'Blog' }]} />

        {/* Hero Section */}
        <div className="max-w-3xl mb-8">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider bg-[#F0F7F8] text-[#124A57] mb-3">
            <BookOpen className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Articles & Insights</span>
          </div>
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-[#17202A] tracking-tight mb-3">
            Guides & Best Practices
          </h1>
          <p className="text-base md:text-lg text-[#667085] leading-relaxed">
            Technical guides, format deep dives, and practical advice on optimizing images and managing digital documents effectively.
          </p>
        </div>

        {/* Filters & Search Row */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 pb-6 border-b border-[#E5E7EB]">
          {/* Category Tabs */}
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/blog"
              className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${
                !categorySlug && !tagSlug
                  ? 'bg-[#124A57] text-white'
                  : 'bg-[#F1F5F9] text-[#475569] hover:bg-[#E2E8F0]'
              }`}
            >
              All Articles
            </Link>
            {categories.map((cat) => {
              const isActive = categorySlug === cat.slug;
              return (
                <Link
                  key={cat.id}
                  href={`/blog?category=${cat.slug}`}
                  className={`inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${
                    isActive
                      ? 'bg-[#124A57] text-white'
                      : 'bg-[#F1F5F9] text-[#475569] hover:bg-[#E2E8F0]'
                  }`}
                >
                  <FolderPlus className="w-3 h-3" />
                  <span>{cat.name}</span>
                </Link>
              );
            })}
          </div>

          {/* Search Form */}
          <form method="GET" action="/blog" className="relative w-full md:w-72">
            {categorySlug && <input type="hidden" name="category" value={categorySlug} />}
            <Search className="w-4 h-4 text-[#94A3B8] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              name="q"
              defaultValue={search || ''}
              placeholder="Search guides..."
              className="w-full pl-9 pr-3 py-1.5 text-xs border border-[#CBD5E1] rounded-full focus:outline-none focus:ring-2 focus:ring-[#124A57] bg-white"
            />
          </form>
        </div>

        {/* Posts Grid */}
        {posts.length === 0 ? (
          <div className="text-center py-16 bg-white border border-[#E5E7EB] rounded-2xl p-8 space-y-3">
            <BookOpen className="w-10 h-10 text-[#94A3B8] mx-auto" />
            <h3 className="text-lg font-bold text-[#17202A]">No Guides Found</h3>
            <p className="text-sm text-[#667085] max-w-sm mx-auto">
              No published articles matched your search or category filter.
            </p>
            <Link
              href="/blog"
              className="inline-block mt-2 text-xs font-semibold text-[#124A57] hover:underline"
            >
              View all articles
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {posts.map((article) => (
              <article
                key={article.slug}
                className="flex flex-col justify-between p-6 bg-[#FFFFFF] border border-[#E5E7EB] rounded-2xl hover:border-[#124A57]/40 hover:shadow-subtle transition-all overflow-hidden"
              >
                <div>
                  {article.featuredImage && isSafeUrl(article.featuredImage) && (
                    <div className="mb-4 -mx-6 -mt-6 aspect-video overflow-hidden bg-[#F8FAFC]">
                      <img
                        src={article.featuredImage}
                        alt={article.featuredImageAlt || article.title}
                        className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                      />
                    </div>
                  )}

                  <div className="flex items-center gap-3 text-xs text-[#667085] mb-3">
                    {article.category && (
                      <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-[#E6F4F1] text-[#124A57] font-semibold">
                        {article.category.name}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" aria-hidden="true" />
                      <time dateTime={article.publishedAt || undefined}>
                        {article.publishedAt ? new Date(article.publishedAt).toLocaleDateString() : 'Recent'}
                      </time>
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>{article.readingTime || '4 min read'}</span>
                    </span>
                  </div>

                  <h2 className="text-xl font-bold text-[#17202A] hover:text-[#124A57] transition-colors mb-2">
                    <Link href={`/blog/${article.slug}`}>
                      {article.title}
                    </Link>
                  </h2>

                  <p className="text-sm text-[#667085] leading-relaxed line-clamp-3 mb-6">
                    {article.excerpt}
                  </p>
                </div>

                <div className="pt-4 border-t border-[#E5E7EB]/60 flex items-center justify-between">
                  <span className="text-xs text-[#667085]">{article.author?.name || 'FileTools Editorial'}</span>
                  <Link
                    href={`/blog/${article.slug}`}
                    className="inline-flex items-center text-xs font-semibold text-[#124A57] hover:underline"
                  >
                    <span>Read article</span>
                    <ArrowRight className="w-3.5 h-3.5 ml-1" aria-hidden="true" />
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 pt-8">
            {page > 1 && (
              <Link
                href={`/blog?page=${page - 1}${categorySlug ? `&category=${categorySlug}` : ''}${search ? `&q=${encodeURIComponent(search)}` : ''}`}
                className="px-4 py-2 text-xs font-semibold border border-[#CBD5E1] rounded-lg bg-white hover:bg-[#F8FAFC]"
              >
                Previous
              </Link>
            )}
            <span className="text-xs text-[#64748B] px-3">
              Page {page} of {totalPages}
            </span>
            {page < totalPages && (
              <Link
                href={`/blog?page=${page + 1}${categorySlug ? `&category=${categorySlug}` : ''}${search ? `&q=${encodeURIComponent(search)}` : ''}`}
                className="px-4 py-2 text-xs font-semibold border border-[#CBD5E1] rounded-lg bg-white hover:bg-[#F8FAFC]"
              >
                Next
              </Link>
            )}
          </div>
        )}
      </Container>
    </div>
  );
}
