'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  BookOpen,
  Plus,
  AlertTriangle,
  FolderPlus,
} from 'lucide-react';
import { BlogCategoryItem } from '@/lib/admin/types';

export default function NewBlogPostPage() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [excerpt, setExcerpt] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [categories, setCategories] = useState<BlogCategoryItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadCategories() {
      try {
        const res = await fetch('/api/admin/blog/categories');
        if (res.ok) {
          const data = await res.json();
          setCategories(data.categories || []);
        }
      } catch {
        // Ignore
      }
    }
    loadCategories();
  }, []);

  const handleTitleChange = (val: string) => {
    setTitle(val);
    const autoSlug = val
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9-_]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
    setSlug(autoSlug);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Title is required.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/admin/blog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          slug: slug.trim() || undefined,
          excerpt: excerpt.trim() || null,
          content: '## Introduction\n\nStart writing your article content here...',
          categoryId: categoryId || null,
          status: 'DRAFT',
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create blog post draft.');
      }

      const data = await res.json();
      router.push(`/admin/blog/${data.post.id}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error creating draft.';
      setError(msg);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/admin/blog"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-[#5E6488] hover:text-[#0F112E] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Blog Directory</span>
        </Link>
      </div>

      <div className="bg-white border border-[#E4E2F0] rounded-xl shadow-xs p-6 md:p-8 space-y-6">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-[#0F172A]">Create New Blog Post</h1>
          <p className="text-sm text-[#5E6488] mt-1">
            Initialize an article draft. You can format the full Markdown content, SEO metadata, and publication schedule on the editor screen.
          </p>
        </div>

        {error && (
          <div className="p-4 rounded-lg bg-[#FEF2F2] border border-[#FECACA] text-[#991B1B] text-sm flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="post-title" className="block text-xs font-semibold uppercase tracking-wider text-[#475569] mb-1.5">
              Article Title *
            </label>
            <input
              id="post-title"
              type="text"
              required
              value={title}
              onChange={(e) => handleTitleChange(e.target.value)}
              placeholder="e.g. 5 Essential Tips for Merging, Compressing, and Organizing PDFs"
              className="w-full px-3.5 py-2.5 border border-[#E4E2F0] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#7C3AED]"
            />
          </div>

          <div>
            <label htmlFor="post-slug" className="block text-xs font-semibold uppercase tracking-wider text-[#475569] mb-1.5">
              URL Slug *
            </label>
            <div className="flex items-center">
              <span className="inline-flex items-center px-3 py-2.5 rounded-l-lg border border-r-0 border-[#E4E2F0] bg-[#F4F3FA] text-xs text-[#5E6488] font-mono">
                /blog/
              </span>
              <input
                id="post-slug"
                type="text"
                required
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="essential-tips-for-managing-pdf-documents"
                className="flex-1 px-3.5 py-2.5 border border-[#E4E2F0] rounded-r-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#7C3AED]"
              />
            </div>
            <p className="text-xs text-[#94A3B8] mt-1">
              URL-friendly identifier. Must be unique across all articles.
            </p>
          </div>

          <div>
            <label htmlFor="post-category" className="block text-xs font-semibold uppercase tracking-wider text-[#475569] mb-1.5">
              Category
            </label>
            <select
              id="post-category"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full px-3.5 py-2.5 border border-[#E4E2F0] rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#7C3AED]"
            >
              <option value="">Select a Category (Optional)</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="post-excerpt" className="block text-xs font-semibold uppercase tracking-wider text-[#475569] mb-1.5">
              Short Summary / Excerpt
            </label>
            <textarea
              id="post-excerpt"
              rows={3}
              value={excerpt}
              onChange={(e) => setExcerpt(e.target.value)}
              placeholder="A brief 1-2 sentence overview of the article shown on cards and social share previews..."
              className="w-full px-3.5 py-2.5 border border-[#E4E2F0] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#7C3AED]"
            />
          </div>

          <div className="pt-4 border-t border-[#E4E2F0] flex items-center justify-end gap-3">
            <Link
              href="/admin/blog"
              className="px-4 py-2 rounded-lg border border-[#E4E2F0] text-sm font-medium text-[#475569] hover:bg-[#F4F3FA]"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-1.5 px-5 py-2 rounded-lg bg-[#7C3AED] text-white text-sm font-medium hover:bg-[#6D28D9] disabled:opacity-50 transition-colors shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>{isSubmitting ? 'Creating Draft...' : 'Create & Open Editor'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
