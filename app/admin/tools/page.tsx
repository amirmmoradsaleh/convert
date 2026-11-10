'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Wrench,
  ExternalLink,
  CheckCircle2,
  Clock,
  RefreshCw,
  Search,
  Sparkles,
  Edit,
  Eye,
  History,
  Check,
  X,
  ArrowRight,
  Filter,
} from 'lucide-react';

interface ToolItem {
  slug: string;
  name: string;
  category: string;
  inputFormats: string[];
  outputFormats: string[];
  hasCmsOverride: boolean;
  isPublished: boolean;
  customTitle: string | null;
  customH1: string | null;
  updatedAt: string | null;
}

export default function AdminToolsPage() {
  const [tools, setTools] = useState<ToolItem[]>([]);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PUBLISHED' | 'DRAFT' | 'DEFAULT'>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [togglingSlug, setTogglingSlug] = useState<string | null>(null);

  const fetchTools = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/tools');
      if (!res.ok) throw new Error('Failed to load tools.');
      const data = await res.json();
      setTools(data.tools || []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error loading tools.';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTools();
  }, []);

  const handleTogglePublish = async (tool: ToolItem) => {
    setTogglingSlug(tool.slug);
    setActionSuccess(null);
    try {
      const endpoint = tool.isPublished
        ? `/api/admin/tools/${tool.slug}/unpublish`
        : `/api/admin/tools/${tool.slug}/publish`;

      const res = await fetch(endpoint, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update publishing status.');

      setActionSuccess(
        tool.isPublished
          ? `Unpublished '${tool.name}'. Public page now uses canonical defaults.`
          : `Published '${tool.name}' with CMS overrides active.`
      );
      await fetchTools();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Action failed.';
      alert(msg);
    } finally {
      setTogglingSlug(null);
    }
  };

  const categories = ['ALL', 'image-converter', 'image-utility', 'pdf-converter', 'pdf-utility'];

  const filteredTools = tools.filter((t) => {
    // Status filter
    if (statusFilter === 'PUBLISHED' && (!t.hasCmsOverride || !t.isPublished)) return false;
    if (statusFilter === 'DRAFT' && (!t.hasCmsOverride || t.isPublished)) return false;
    if (statusFilter === 'DEFAULT' && t.hasCmsOverride) return false;

    // Category filter
    if (categoryFilter !== 'ALL' && t.category !== categoryFilter) return false;

    // Search filter
    const query = search.toLowerCase();
    const matchSearch =
      t.name.toLowerCase().includes(query) ||
      t.slug.toLowerCase().includes(query) ||
      t.category.toLowerCase().includes(query) ||
      (t.customTitle && t.customTitle.toLowerCase().includes(query));

    return matchSearch;
  });

  const publishedCount = tools.filter((t) => t.hasCmsOverride && t.isPublished).length;
  const draftCount = tools.filter((t) => t.hasCmsOverride && !t.isPublished).length;
  const defaultCount = tools.filter((t) => !t.hasCmsOverride).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#0F112E] flex items-center gap-2">
            <span>Tools CMS Directory</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#F4F0FD] text-[#7C3AED] font-semibold border border-[#B3E0D8]">
              25 Canonical Tools
            </span>
          </h1>
          <p className="text-xs sm:text-sm text-[#5E6488] mt-0.5">
            Manage visible content, H1 headers, how-to steps, features, FAQs, and advanced SEO overrides for all 25 canonical tools.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchTools}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-[#475467] bg-white border border-[#E4E2F0] rounded-lg hover:bg-[#F4F3FA] transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {actionSuccess && (
        <div className="p-3 bg-[#ECFDF5] border border-[#A7F3D0] rounded-xl text-xs text-[#065F46] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#10B981] shrink-0" />
            <span>{actionSuccess}</span>
          </div>
          <button onClick={() => setActionSuccess(null)} className="text-[#065F46] hover:text-[#047857]">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div
          onClick={() => setStatusFilter('ALL')}
          className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
            statusFilter === 'ALL'
              ? 'bg-[#7C3AED] text-white border-[#7C3AED] shadow-sm'
              : 'bg-white text-[#0F112E] border-[#E4E2F0] hover:border-[#E4E2F0]'
          }`}
        >
          <div className="text-[11px] font-medium opacity-80 uppercase tracking-wider">Total Tools</div>
          <div className="text-xl font-bold mt-1">{tools.length || 25}</div>
        </div>

        <div
          onClick={() => setStatusFilter('PUBLISHED')}
          className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
            statusFilter === 'PUBLISHED'
              ? 'bg-[#7C3AED] text-white border-[#7C3AED] shadow-sm'
              : 'bg-white text-[#0F112E] border-[#E4E2F0] hover:border-[#E4E2F0]'
          }`}
        >
          <div className="text-[11px] font-medium opacity-80 uppercase tracking-wider flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-[#10B981] inline-block" />
            <span>Published CMS</span>
          </div>
          <div className="text-xl font-bold mt-1 text-[#10B981]">{publishedCount}</div>
        </div>

        <div
          onClick={() => setStatusFilter('DRAFT')}
          className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
            statusFilter === 'DRAFT'
              ? 'bg-[#7C3AED] text-white border-[#7C3AED] shadow-sm'
              : 'bg-white text-[#0F112E] border-[#E4E2F0] hover:border-[#E4E2F0]'
          }`}
        >
          <div className="text-[11px] font-medium opacity-80 uppercase tracking-wider flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-[#F59E0B] inline-block" />
            <span>Draft Overrides</span>
          </div>
          <div className="text-xl font-bold mt-1 text-[#F59E0B]">{draftCount}</div>
        </div>

        <div
          onClick={() => setStatusFilter('DEFAULT')}
          className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
            statusFilter === 'DEFAULT'
              ? 'bg-[#7C3AED] text-white border-[#7C3AED] shadow-sm'
              : 'bg-white text-[#0F112E] border-[#E4E2F0] hover:border-[#E4E2F0]'
          }`}
        >
          <div className="text-[11px] font-medium opacity-80 uppercase tracking-wider flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-[#5E6488] inline-block" />
            <span>Code Default</span>
          </div>
          <div className="text-xl font-bold mt-1 text-[#5E6488]">{defaultCount}</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-[#E4E2F0] shadow-subtle flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Category Pills */}
        <div className="flex flex-wrap items-center gap-1.5 p-1 bg-[#F4F3FA] rounded-lg">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                categoryFilter === cat
                  ? 'bg-white text-[#0F112E] shadow-xs'
                  : 'text-[#5E6488] hover:text-[#0F112E]'
              }`}
            >
              {cat === 'ALL' ? 'All Categories' : cat}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-[#94A3B8] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, slug, category..."
            className="w-full pl-9 pr-3 py-1.5 text-xs border border-[#E4E2F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7C3AED]"
          />
        </div>
      </div>

      {/* Tools Table */}
      <div className="bg-white rounded-xl border border-[#E4E2F0] shadow-subtle overflow-hidden">
        {isLoading ? (
          <div className="py-20 text-center text-xs text-[#5E6488]">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-[#7C3AED]" />
            <span>Loading 25 canonical tools...</span>
          </div>
        ) : error ? (
          <div className="py-16 text-center text-xs text-[#E11D48]">{error}</div>
        ) : filteredTools.length === 0 ? (
          <div className="py-16 text-center text-xs text-[#5E6488]">
            No tools found matching the selected filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F4F3FA] border-b border-[#E4E2F0] text-[#5E6488] uppercase font-semibold">
                <tr>
                  <th className="px-5 py-3.5">Tool & Identity</th>
                  <th className="px-5 py-3.5">Category</th>
                  <th className="px-5 py-3.5">Formats</th>
                  <th className="px-5 py-3.5">CMS Status</th>
                  <th className="px-5 py-3.5">Last Updated</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E4E2F0]">
                {filteredTools.map((tool) => (
                  <tr key={tool.slug} className="hover:bg-[#F4F3FA] transition-colors">
                    {/* Tool & Slug */}
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-[#F4F0FD] text-[#7C3AED] flex items-center justify-center shrink-0">
                          <Wrench className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="font-semibold text-sm text-[#0F112E]">{tool.name}</div>
                          <div className="font-mono text-[11px] text-[#5E6488]">/tools/{tool.slug}</div>
                        </div>
                      </div>
                    </td>

                    {/* Category */}
                    <td className="px-5 py-3.5">
                      <span className="px-2 py-0.5 bg-[#F4F3FA] text-[#475467] rounded text-[10px] font-medium">
                        {tool.category}
                      </span>
                    </td>

                    {/* Formats */}
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-1 font-mono text-[11px] text-[#475467]">
                        <span className="px-1.5 py-0.5 bg-[#F4F3FA] border border-[#E4E2F0] rounded uppercase">
                          {tool.inputFormats.join(', ')}
                        </span>
                        <ArrowRight className="w-3 h-3 text-[#94A3B8]" />
                        <span className="px-1.5 py-0.5 bg-[#F4F3FA] border border-[#E4E2F0] rounded uppercase">
                          {tool.outputFormats.join(', ')}
                        </span>
                      </div>
                    </td>

                    {/* CMS Status */}
                    <td className="px-5 py-3.5">
                      {tool.hasCmsOverride && tool.isPublished ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[#ECFDF5] text-[#065F46] border border-[#A7F3D0]">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]" />
                          Published CMS
                        </span>
                      ) : tool.hasCmsOverride && !tool.isPublished ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[#FFFBEB] text-[#92400E] border border-[#FDE68A]">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#F59E0B]" />
                          Draft Saved
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-[#F4F3FA] text-[#5E6488] border border-[#E4E2F0]">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#94A3B8]" />
                          Code Default
                        </span>
                      )}
                    </td>

                    {/* Last Updated */}
                    <td className="px-5 py-3.5 text-[11px] text-[#5E6488]">
                      {tool.updatedAt ? new Date(tool.updatedAt).toLocaleDateString() : 'Canonical Default'}
                    </td>

                    {/* Actions */}
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {/* Edit Button */}
                        <Link
                          href={`/admin/tools/${tool.slug}`}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-[#7C3AED] bg-[#F4F0FD] hover:bg-[#D1EBE5] rounded-md transition-colors"
                        >
                          <Edit className="w-3 h-3" />
                          <span>Edit</span>
                        </Link>

                        {/* Preview Button */}
                        <Link
                          href={`/admin/tools/${tool.slug}/preview`}
                          className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-[#475467] hover:bg-[#F4F3FA] rounded-md transition-colors"
                          title="Preview draft content"
                        >
                          <Eye className="w-3 h-3" />
                          <span>Preview</span>
                        </Link>

                        {/* Revisions Button */}
                        <Link
                          href={`/admin/tools/${tool.slug}/revisions`}
                          className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-[#475467] hover:bg-[#F4F3FA] rounded-md transition-colors"
                          title="View revision history"
                        >
                          <History className="w-3 h-3" />
                          <span>Revisions</span>
                        </Link>

                        {/* Toggle Publish Quick Action if override exists */}
                        {tool.hasCmsOverride && (
                          <button
                            onClick={() => handleTogglePublish(tool)}
                            disabled={togglingSlug === tool.slug}
                            className={`px-2 py-1 text-[11px] font-semibold rounded-md transition-colors disabled:opacity-50 ${
                              tool.isPublished
                                ? 'text-[#92400E] hover:bg-[#FEF3C7]'
                                : 'text-[#065F46] hover:bg-[#D1FAE5]'
                            }`}
                          >
                            {togglingSlug === tool.slug
                              ? '...'
                              : tool.isPublished
                              ? 'Unpublish'
                              : 'Publish'}
                          </button>
                        )}

                        {/* Public Link */}
                        <Link
                          href={`/tools/${tool.slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1 text-[#94A3B8] hover:text-[#0F112E] transition-colors"
                          title="View public live page"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
