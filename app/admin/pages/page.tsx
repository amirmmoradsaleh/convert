'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  FileText,
  Plus,
  ExternalLink,
  CheckCircle2,
  Clock,
  RefreshCw,
  Search,
  Check,
  X,
} from 'lucide-react';

interface PageItem {
  id: string;
  slug: string;
  name: string;
  status: 'DRAFT' | 'PUBLISHED';
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  seo?: {
    seoTitle?: string;
    metaDescription?: string;
  } | null;
}

export default function AdminPagesPage() {
  const [pages, setPages] = useState<PageItem[]>([]);
  const [filter, setFilter] = useState<'ALL' | 'PUBLISHED' | 'DRAFT'>('ALL');
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // New page modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newSlug, setNewSlug] = useState('');
  const [newName, setNewName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const fetchPages = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const url = filter === 'ALL' ? '/api/admin/pages' : `/api/admin/pages?status=${filter}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to load pages.');
      const data = await res.json();
      setPages(data.pages || []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error loading pages.';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPages();
  }, [filter]);

  const handleTogglePublish = async (page: PageItem) => {
    const action = page.status === 'PUBLISHED' ? 'unpublish' : 'publish';
    try {
      const res = await fetch(`/api/admin/pages/${page.id}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) throw new Error(`Failed to ${action} page.`);
      await fetchPages();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : `Failed to update status.`;
      alert(msg);
    }
  };

  const handleCreatePage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSlug || !newName) return;
    setIsCreating(true);

    try {
      const res = await fetch('/api/admin/pages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: newSlug,
          name: newName,
          status: 'DRAFT',
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create page.');

      setShowCreateModal(false);
      setNewSlug('');
      setNewName('');
      await fetchPages();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error creating page.';
      alert(msg);
    } finally {
      setIsCreating(false);
    }
  };

  const [isBootstrapping, setIsBootstrapping] = useState(false);

  const handleBootstrapHomepage = async () => {
    setIsBootstrapping(true);
    try {
      const res = await fetch('/api/admin/pages/bootstrap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to initialize homepage.');
      await fetchPages();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error initializing homepage.';
      alert(msg);
    } finally {
      setIsBootstrapping(false);
    }
  };

  const hasHomepage = pages.some((p) => p.slug === 'home');

  const filteredPages = pages.filter((p) => {
    const matchSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.slug.toLowerCase().includes(search.toLowerCase());
    return matchSearch;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#0F112E]">
            Pages CMS
          </h1>
          <p className="text-xs sm:text-sm text-[#5E6488] mt-0.5">
            Manage public pages, status, versioning, and SEO metadata.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {!hasHomepage && !isLoading && (
            <button
              onClick={handleBootstrapHomepage}
              disabled={isBootstrapping}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#7C3AED] hover:bg-[#6D28D9] rounded-lg shadow-sm transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isBootstrapping ? 'animate-spin' : ''}`} />
              <span>{isBootstrapping ? 'Initializing...' : 'Initialize Homepage (/)'}</span>
            </button>
          )}

          <Link
            href="/admin/pages/new"
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#7C3AED] hover:bg-[#6D28D9] rounded-lg shadow-sm transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Create New Page</span>
          </Link>
        </div>
      </div>

      {/* Actionable Error Alert */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl flex items-center justify-between gap-3 text-xs font-medium">
          <div className="flex items-center gap-2">
            <X className="w-4 h-4 text-red-600 flex-shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={fetchPages}
            className="px-3 py-1 bg-red-600 text-white rounded-lg hover:bg-red-700 font-semibold transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* Missing Homepage Warning Banner */}
      {!hasHomepage && !isLoading && !error && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
          <div className="space-y-1">
            <p className="font-bold">Reserved Homepage Record ('home') Not Initialized</p>
            <p className="text-amber-700">
              The public homepage at <span className="font-mono">/</span> uses hardcoded defaults until initialized. Click below to safely create the CMS entry without overwriting live settings.
            </p>
          </div>
          <button
            onClick={handleBootstrapHomepage}
            disabled={isBootstrapping}
            className="px-4 py-2 bg-amber-700 text-white font-bold rounded-lg hover:bg-amber-800 transition-colors whitespace-nowrap shadow-sm disabled:opacity-50"
          >
            {isBootstrapping ? 'Initializing...' : 'Initialize Homepage'}
          </button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-[#E4E2F0] shadow-subtle flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 p-1 bg-[#F4F3FA] rounded-lg">
          {(['ALL', 'PUBLISHED', 'DRAFT'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                filter === tab
                  ? 'bg-white text-[#0F112E] shadow-xs'
                  : 'text-[#5E6488] hover:text-[#0F112E]'
              }`}
            >
              {tab.charAt(0) + tab.slice(1).toLowerCase()}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-[#94A3B8] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search pages by name or slug..."
            className="w-full pl-9 pr-3 py-1.5 text-xs border border-[#E4E2F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7C3AED]"
          />
        </div>
      </div>

      {/* Pages Table */}
      <div className="bg-white rounded-xl border border-[#E4E2F0] shadow-subtle overflow-hidden">
        {isLoading ? (
          <div className="py-16 text-center text-xs text-[#5E6488]">
            <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-[#7C3AED]" />
            <span>Loading pages...</span>
          </div>
        ) : filteredPages.length === 0 ? (
          <div className="py-16 text-center text-xs text-[#5E6488] space-y-2">
            <p>No pages found matching criteria.</p>
            {!hasHomepage && (
              <button
                onClick={handleBootstrapHomepage}
                disabled={isBootstrapping}
                className="mt-2 px-4 py-2 bg-[#7C3AED] text-white font-semibold rounded-lg hover:bg-[#6D28D9] transition-colors"
              >
                Initialize Default Homepage
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F4F3FA] border-b border-[#E4E2F0] text-[#5E6488] uppercase font-semibold">
                <tr>
                  <th className="px-5 py-3.5">Page Name</th>
                  <th className="px-5 py-3.5">Public Slug</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5">Last Updated</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E4E2F0]">
                {filteredPages.map((page) => (
                  <tr key={page.id} className="hover:bg-[#F4F3FA] transition-colors">
                    <td className="px-5 py-3.5 font-semibold text-[#0F112E]">
                      {page.slug === 'home' ? (
                        <div className="flex items-center gap-2">
                          <span>{page.name}</span>
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-[#EFF6FF] text-[#1D4ED8] border border-[#BFDBFE]">
                            Homepage (/)
                          </span>
                        </div>
                      ) : (
                        page.name
                      )}
                    </td>
                    <td className="px-5 py-3.5 font-mono text-[11px] text-[#5E6488]">
                      /{page.slug === 'home' ? '' : page.slug}
                    </td>
                    <td className="px-5 py-3.5">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          page.status === 'PUBLISHED'
                            ? 'bg-[#F4F0FD] text-[#7C3AED]'
                            : 'bg-[#FFFBEB] text-[#B45309]'
                        }`}
                      >
                        {page.status === 'PUBLISHED' ? (
                          <>
                            <CheckCircle2 className="w-3 h-3 text-[#7C3AED]" />
                            Published
                          </>
                        ) : (
                          <>
                            <Clock className="w-3 h-3 text-[#B45309]" />
                            Draft
                          </>
                        )}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-[#5E6488]">
                      {new Date(page.updatedAt).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-3.5 text-right space-x-1.5 whitespace-nowrap">
                      <Link
                        href={`/admin/pages/${page.id}`}
                        className="px-2.5 py-1 text-[11px] font-semibold text-[#7C3AED] bg-[#F4F0FD] hover:bg-[#D5EAE6] rounded transition-colors inline-block"
                      >
                        Edit
                      </Link>

                      <Link
                        href={`/admin/pages/${page.id}/preview`}
                        className="px-2 py-1 text-[11px] font-medium text-[#475467] bg-[#F4F3FA] hover:bg-[#E4E2F0] rounded transition-colors inline-block"
                      >
                        Preview
                      </Link>

                      <Link
                        href={`/admin/pages/${page.id}/revisions`}
                        className="px-2 py-1 text-[11px] font-medium text-[#475467] bg-[#F4F3FA] hover:bg-[#E4E2F0] rounded transition-colors inline-block"
                      >
                        Revisions
                      </Link>

                      <button
                        onClick={() => handleTogglePublish(page)}
                        className={`px-2 py-1 rounded text-[11px] font-semibold transition-colors ${
                          page.status === 'PUBLISHED'
                            ? 'bg-[#FEF2F2] text-[#DC2626] hover:bg-[#FEE2E2]'
                            : 'bg-[#F4F0FD] text-[#7C3AED] hover:bg-[#CDE1E5]'
                        }`}
                      >
                        {page.status === 'PUBLISHED' ? 'Unpublish' : 'Publish'}
                      </button>

                      <Link
                        href={`/${page.slug === 'home' ? '' : page.slug}`}
                        target="_blank"
                        className="inline-flex items-center gap-1 p-1 text-[#5E6488] hover:text-[#7C3AED] rounded"
                        title="View public page"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-[#E4E2F0] space-y-4 animate-fadeIn">
            <div className="flex items-center justify-between pb-3 border-b border-[#E4E2F0]">
              <h3 className="text-base font-bold text-[#0F112E]">Create New Page</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-[#94A3B8] hover:text-[#0F112E]"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreatePage} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#475467] mb-1">
                  Page Title
                </label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => {
                    setNewName(e.target.value);
                    if (!newSlug) {
                      setNewSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, '-'));
                    }
                  }}
                  placeholder="e.g. Help Center"
                  className="w-full px-3 py-2 text-sm border border-[#E4E2F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7C3AED]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#475467] mb-1">
                  URL Slug
                </label>
                <div className="flex items-center">
                  <span className="px-3 py-2 bg-[#F4F3FA] border border-r-0 border-[#E4E2F0] rounded-l-lg text-xs text-[#5E6488]">
                    /
                  </span>
                  <input
                    type="text"
                    required
                    value={newSlug}
                    onChange={(e) => setNewSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, '-'))}
                    placeholder="help-center"
                    className="w-full px-3 py-2 text-sm border border-[#E4E2F0] rounded-r-lg focus:outline-none focus:ring-2 focus:ring-[#7C3AED]"
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-xs font-medium text-[#475467] hover:bg-[#F4F3FA] rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  className="px-4 py-2 text-xs font-semibold text-white bg-[#7C3AED] hover:bg-[#6D28D9] rounded-lg disabled:opacity-50"
                >
                  {isCreating ? 'Creating...' : 'Create Draft'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
