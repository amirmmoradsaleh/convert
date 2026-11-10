'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  BookOpen,
  Plus,
  Search,
  Filter,
  RefreshCw,
  Edit,
  Eye,
  History,
  Trash2,
  CheckCircle2,
  Clock,
  Calendar,
  AlertTriangle,
  FolderPlus,
  Tag,
  ArrowRight,
} from 'lucide-react';
import { BlogPostItem, BlogCategoryItem } from '@/lib/admin/types';

export default function AdminBlogPage() {
  const [posts, setPosts] = useState<BlogPostItem[]>([]);
  const [categories, setCategories] = useState<BlogCategoryItem[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const fetchCategories = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/blog/categories');
      if (res.ok) {
        const data = await res.json();
        setCategories(data.categories || []);
      }
    } catch {
      // Ignore category load error
    }
  }, []);

  const fetchPosts = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'ALL') params.set('status', statusFilter);
      if (categoryFilter !== 'ALL') params.set('categoryId', categoryFilter);
      if (search.trim()) params.set('search', search.trim());
      params.set('page', page.toString());
      params.set('limit', '10');

      const res = await fetch(`/api/admin/blog?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to load blog posts.');
      const data = await res.json();
      setPosts(data.posts || []);
      setTotalPages(data.totalPages || 1);
      setTotalCount(data.total || 0);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error loading blog posts.';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, categoryFilter, search, page]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  const handlePublishToggle = async (post: BlogPostItem) => {
    const isPub = post.status === 'PUBLISHED';
    const action = isPub ? 'unpublish' : 'publish';
    if (!window.confirm(`Are you sure you want to ${action} "${post.title}"?`)) {
      return;
    }

    setActionLoadingId(post.id);
    try {
      const endpoint = `/api/admin/blog/${post.id}/${action}`;
      const res = await fetch(endpoint, { method: 'POST' });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || `Failed to ${action} post.`);
      }
      setActionSuccess(`Post successfully ${isPub ? 'unpublished' : 'published'}.`);
      setTimeout(() => setActionSuccess(null), 4000);
      await fetchPosts();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Action failed.';
      setError(msg);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDelete = async (post: BlogPostItem) => {
    if (!window.confirm(`Are you sure you want to permanently delete "${post.title}"? This cannot be undone.`)) {
      return;
    }

    setActionLoadingId(post.id);
    try {
      const res = await fetch(`/api/admin/blog/${post.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to delete post.');
      }
      setActionSuccess(`Post "${post.title}" deleted.`);
      setTimeout(() => setActionSuccess(null), 4000);
      await fetchPosts();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete post.';
      setError(msg);
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-[#0F112E]">Blog CMS Directory</h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full font-medium bg-[#F4F0FD] text-[#7C3AED]">
              {totalCount} {totalCount === 1 ? 'Post' : 'Posts'}
            </span>
          </div>
          <p className="text-sm text-[#5E6488] mt-1">
            Manage articles, categories, publication statuses, SEO metadata, and revision snapshots.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => fetchPosts()}
            className="p-2 rounded-lg border border-[#E4E2F0] bg-white text-[#475569] hover:bg-[#F4F3FA] transition-colors"
            title="Refresh list"
            aria-label="Refresh posts"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <Link
            href="/admin/blog/new"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#7C3AED] text-white text-sm font-medium hover:bg-[#6D28D9] shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Create New Post</span>
          </Link>
        </div>
      </div>

      {actionSuccess && (
        <div className="p-4 rounded-lg bg-[#F0FDF4] border border-[#BBF7D0] text-[#166534] text-sm flex items-center gap-2 animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-lg bg-[#FEF2F2] border border-[#FECACA] text-[#991B1B] text-sm flex items-center gap-2 animate-fadeIn">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Filters & Search */}
      <div className="p-4 bg-white border border-[#E4E2F0] rounded-xl shadow-xs flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-[#94A3B8] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search posts by title, excerpt, or keywords..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full pl-9 pr-4 py-2 border border-[#E4E2F0] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#7C3AED]"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Status Filter */}
          <div className="flex items-center gap-1.5 text-xs text-[#5E6488]">
            <Filter className="w-3.5 h-3.5" />
            <span>Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="py-1.5 px-2.5 border border-[#E4E2F0] rounded-lg text-xs font-medium text-[#1E293B] bg-white focus:outline-none focus:ring-2 focus:ring-[#7C3AED]"
            >
              <option value="ALL">All Statuses</option>
              <option value="PUBLISHED">Published</option>
              <option value="DRAFT">Drafts</option>
              <option value="SCHEDULED">Scheduled</option>
            </select>
          </div>

          {/* Category Filter */}
          {categories.length > 0 && (
            <div className="flex items-center gap-1.5 text-xs text-[#5E6488]">
              <span>Category:</span>
              <select
                value={categoryFilter}
                onChange={(e) => {
                  setCategoryFilter(e.target.value);
                  setPage(1);
                }}
                className="py-1.5 px-2.5 border border-[#E4E2F0] rounded-lg text-xs font-medium text-[#1E293B] bg-white focus:outline-none focus:ring-2 focus:ring-[#7C3AED]"
              >
                <option value="ALL">All Categories</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Posts Table */}
      <div className="bg-white border border-[#E4E2F0] rounded-xl shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-[#5E6488]">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-[#7C3AED]" />
            <p className="text-sm">Loading articles...</p>
          </div>
        ) : posts.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <BookOpen className="w-10 h-10 text-[#94A3B8] mx-auto" />
            <h3 className="text-base font-semibold text-[#1E293B]">No Blog Posts Found</h3>
            <p className="text-sm text-[#5E6488] max-w-md mx-auto">
              {search || statusFilter !== 'ALL' || categoryFilter !== 'ALL'
                ? 'No posts match the current search filters. Try adjusting your criteria.'
                : 'Get started by creating your first article to publish technical guides and updates.'}
            </p>
            <Link
              href="/admin/blog/new"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#7C3AED] text-white text-xs font-medium hover:bg-[#6D28D9] mt-2"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Post</span>
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-[#334155]">
              <thead className="bg-[#F4F3FA] border-b border-[#E4E2F0] text-xs uppercase font-semibold text-[#5E6488]">
                <tr>
                  <th className="py-3 px-4">Post Title & Slug</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Published Date</th>
                  <th className="py-3 px-4">Author</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E4E2F0]">
                {posts.map((post) => {
                  const isPub = post.status === 'PUBLISHED';
                  const isScheduled = post.status === 'SCHEDULED';

                  return (
                    <tr key={post.id} className="hover:bg-[#F4F3FA]/80 transition-colors">
                      <td className="py-3.5 px-4 max-w-xs">
                        <Link
                          href={`/admin/blog/${post.id}`}
                          className="font-semibold text-[#0F172A] hover:text-[#7C3AED] line-clamp-1"
                        >
                          {post.title}
                        </Link>
                        <div className="text-xs text-[#94A3B8] font-mono mt-0.5 line-clamp-1">
                          /blog/{post.slug}
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        {post.category ? (
                          <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-[#F4F3FA] text-[#475569] font-medium">
                            <FolderPlus className="w-3 h-3 text-[#5E6488]" />
                            {post.category.name}
                          </span>
                        ) : (
                          <span className="text-xs text-[#94A3B8]">—</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        {isPub ? (
                          <span className="inline-flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full font-medium bg-[#DCFCE7] text-[#166534]">
                            <CheckCircle2 className="w-3 h-3" />
                            Published
                          </span>
                        ) : isScheduled ? (
                          <span className="inline-flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full font-medium bg-[#FEF3C7] text-[#92400E]">
                            <Calendar className="w-3 h-3" />
                            Scheduled
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full font-medium bg-[#F4F3FA] text-[#475569]">
                            <Clock className="w-3 h-3" />
                            Draft
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-xs text-[#5E6488]">
                        {post.publishedAt ? new Date(post.publishedAt).toLocaleDateString() : '—'}
                      </td>

                      <td className="py-3.5 px-4 text-xs text-[#5E6488]">
                        {post.author?.name || 'Admin'}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Link
                            href={`/admin/blog/${post.id}`}
                            className="p-1.5 text-[#475569] hover:text-[#7C3AED] hover:bg-[#F4F3FA] rounded-lg transition-colors"
                            title="Edit Post"
                            aria-label={`Edit ${post.title}`}
                          >
                            <Edit className="w-4 h-4" />
                          </Link>

                          <Link
                            href={`/admin/blog/${post.id}/preview`}
                            className="p-1.5 text-[#475569] hover:text-[#0284C7] hover:bg-[#F4F3FA] rounded-lg transition-colors"
                            title="Preview Draft"
                            aria-label={`Preview ${post.title}`}
                          >
                            <Eye className="w-4 h-4" />
                          </Link>

                          <Link
                            href={`/admin/blog/${post.id}/revisions`}
                            className="p-1.5 text-[#475569] hover:text-[#6366F1] hover:bg-[#F4F3FA] rounded-lg transition-colors"
                            title="Revision History"
                            aria-label={`Revisions for ${post.title}`}
                          >
                            <History className="w-4 h-4" />
                          </Link>

                          <button
                            onClick={() => handlePublishToggle(post)}
                            disabled={actionLoadingId === post.id}
                            className={`text-xs px-2.5 py-1 rounded font-medium transition-colors ${
                              isPub
                                ? 'bg-[#FEF2F2] text-[#991B1B] hover:bg-[#FEE2E2]'
                                : 'bg-[#F4F0FD] text-[#7C3AED] hover:bg-[#D1EAE5]'
                            }`}
                          >
                            {actionLoadingId === post.id ? '...' : isPub ? 'Unpublish' : 'Publish'}
                          </button>

                          <button
                            onClick={() => handleDelete(post)}
                            disabled={actionLoadingId === post.id}
                            className="p-1.5 text-[#94A3B8] hover:text-[#DC2626] hover:bg-[#FEE2E2] rounded-lg transition-colors"
                            title="Delete Post"
                            aria-label={`Delete ${post.title}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-[#E4E2F0] flex items-center justify-between text-xs text-[#5E6488]">
            <span>
              Page {page} of {totalPages} ({totalCount} total)
            </span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-3 py-1.5 rounded border border-[#E4E2F0] bg-white disabled:opacity-50 hover:bg-[#F4F3FA]"
              >
                Previous
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="px-3 py-1.5 rounded border border-[#E4E2F0] bg-white disabled:opacity-50 hover:bg-[#F4F3FA]"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
