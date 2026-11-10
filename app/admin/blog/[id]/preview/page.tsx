'use client';

import React, { useEffect, useState, use } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Calendar,
  Clock,
  Eye,
  Edit,
  AlertCircle,
  RefreshCw,
  FolderPlus,
} from 'lucide-react';
import Container from '@/components/layout/Container';
import Breadcrumbs from '@/components/seo/Breadcrumbs';
import { BlogPostItem } from '@/lib/admin/types';
import BlogContentRenderer from '@/components/blog/BlogContentRenderer';
import { isSafeUrl } from '@/lib/admin/validation';

interface BlogPreviewProps {
  params: Promise<{ id: string }>;
}

export default function BlogDraftPreviewPage({ params }: BlogPreviewProps) {
  const { id } = use(params);
  const [post, setPost] = useState<BlogPostItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadDraft() {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/admin/blog/${id}/preview`);
        if (!res.ok) throw new Error('Failed to load draft preview.');
        const data = await res.json();
        setPost(data.post);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Error loading preview.';
        setError(msg);
      } finally {
        setIsLoading(false);
      }
    }
    loadDraft();
  }, [id]);

  if (isLoading) {
    return (
      <div className="p-16 text-center text-[#5E6488]">
        <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 text-[#7C3AED]" />
        <p className="text-sm font-medium">Generating draft preview...</p>
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="p-8 bg-white border border-[#E4E2F0] rounded-xl text-center space-y-4 max-w-lg mx-auto mt-10">
        <AlertCircle className="w-8 h-8 text-[#DC2626] mx-auto" />
        <h2 className="text-lg font-bold text-[#1E293B]">Preview Unavailable</h2>
        <p className="text-sm text-[#5E6488]">{error || 'Article not found.'}</p>
        <Link
          href="/admin/blog"
          className="inline-block px-4 py-2 rounded-lg bg-[#7C3AED] text-white text-xs font-semibold"
        >
          Return to Blog Directory
        </Link>
      </div>
    );
  }

  const breadcrumbs = [
    { name: 'Blog', href: '/blog' },
    { name: post.title },
  ];

  return (
    <div className="space-y-6">
      {/* Draft Preview Mode Banner */}
      <div className="bg-[#FEF3C7] border border-[#F59E0B] rounded-xl p-4 text-[#92400E] flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-2.5">
          <Eye className="w-5 h-5 shrink-0 text-[#B45309]" />
          <div>
            <div className="font-bold text-sm">Draft Preview Mode</div>
            <div className="text-xs text-[#B45309]">
              Viewing draft overrides for: <span className="font-semibold">{post.title}</span> ({post.status})
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={`/admin/blog/${id}`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-[#F59E0B] text-xs font-semibold text-[#92400E] hover:bg-[#FFFBEB]"
          >
            <Edit className="w-3.5 h-3.5" />
            <span>Back to Editor</span>
          </Link>
          <Link
            href="/admin/blog"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#92400E] text-white text-xs font-semibold hover:bg-[#78350F]"
          >
            <span>Exit Preview</span>
          </Link>
        </div>
      </div>

      {/* Render Canvas (Matching Public Article View) */}
      <div className="bg-white border border-[#E4E2F0] rounded-2xl shadow-subtle p-6 md:p-12">
        <Container>
          <Breadcrumbs items={breadcrumbs} />

          <div className="max-w-3xl mx-auto mt-6">
            <Link
              href="/admin/blog"
              className="inline-flex items-center text-xs font-semibold text-[#7C3AED] hover:underline mb-6"
            >
              <ArrowLeft className="w-3.5 h-3.5 mr-1" />
              <span>Back to all guides</span>
            </Link>

            <header className="space-y-4 mb-8">
              {post.category && (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#F4F0FD] text-[#7C3AED]">
                  <FolderPlus className="w-3.5 h-3.5" />
                  <span>{post.category.name}</span>
                </div>
              )}

              <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-[#0F112E] tracking-tight leading-tight">
                {post.title}
              </h1>

              {post.excerpt && (
                <p className="text-lg text-[#5E6488] leading-relaxed">
                  {post.excerpt}
                </p>
              )}

              <div className="flex flex-wrap items-center gap-4 text-sm text-[#5E6488] pt-2 border-b border-[#E4E2F0] pb-4">
                <span>By {post.author?.name || 'FileTools Editorial'}</span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  <time>{post.publishedAt ? new Date(post.publishedAt).toLocaleDateString() : 'Draft'}</time>
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  <span>{post.readingTime || '3 min read'}</span>
                </span>
              </div>
            </header>

            {post.featuredImage && isSafeUrl(post.featuredImage) && (
              <div className="mb-8 rounded-xl overflow-hidden aspect-video border border-[#E4E2F0] bg-[#F4F3FA]">
                <img
                  src={post.featuredImage}
                  alt={post.featuredImageAlt || post.title}
                  className="w-full h-full object-cover"
                />
              </div>
            )}

            {/* Content Display */}
            <div className="max-w-none">
              <BlogContentRenderer content={post.content} />
            </div>

            {/* Tags */}
            {post.tags && post.tags.length > 0 && (
              <div className="mt-8 pt-6 border-t border-[#E4E2F0] flex flex-wrap gap-2">
                {post.tags.map((t) => (
                  <span key={t.tagId} className="text-xs px-2.5 py-1 rounded-full bg-[#F4F3FA] text-[#475569] font-medium">
                    #{t.tag?.name || 'tag'}
                  </span>
                ))}
              </div>
            )}
          </div>
        </Container>
      </div>
    </div>
  );
}
