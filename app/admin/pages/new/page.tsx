'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Plus, FileText, CheckCircle2 } from 'lucide-react';

export default function AdminNewPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [status, setStatus] = useState<'DRAFT' | 'PUBLISHED'>('DRAFT');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !slug.trim()) {
      setError('Page title and slug are required.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/admin/pages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          slug: slug.trim().toLowerCase().replace(/[^a-z0-9-_]/g, '-'),
          status,
          blocks: [
            {
              id: `blk-${Date.now()}-h1`,
              type: 'heading',
              level: 1,
              text: name.trim(),
            },
            {
              id: `blk-${Date.now()}-p1`,
              type: 'paragraph',
              text: `Welcome to the ${name.trim()} page.`,
            },
          ],
          seo: {
            seoTitle: `${name.trim()} – Free Online File Tools`,
            metaDescription: `Discover ${name.trim()} on FileTools. 100% private, client-side tools.`,
            canonicalUrl: `/${slug.trim().toLowerCase()}`,
            robotsIndex: true,
            robotsFollow: true,
          },
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create page.');
      }

      router.push(`/admin/pages/${data.page.id}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error creating page.';
      setError(msg);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/admin/pages"
          className="p-2 text-[#5E6488] hover:text-[#0F112E] hover:bg-[#F4F3FA] rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#0F112E]">
            Create New Page
          </h1>
          <p className="text-xs sm:text-sm text-[#5E6488]">
            Initialize a new structured page draft with default blocks and SEO metadata.
          </p>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-[#FEF2F2] border border-[#FCA5A5] text-[#991B1B] rounded-xl text-xs sm:text-sm font-medium">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-xl border border-[#E4E2F0] shadow-subtle space-y-6">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#344054] mb-1.5">
              Page Title <span className="text-[#DC2626]">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (!slug) {
                  setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, '-'));
                }
              }}
              placeholder="e.g. Help Center"
              className="w-full px-3.5 py-2 text-sm border border-[#E4E2F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7C3AED]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#344054] mb-1.5">
              URL Slug <span className="text-[#DC2626]">*</span>
            </label>
            <div className="flex items-center">
              <span className="px-3.5 py-2 bg-[#F4F3FA] border border-r-0 border-[#E4E2F0] rounded-l-lg text-sm text-[#5E6488]">
                /
              </span>
              <input
                type="text"
                required
                value={slug}
                onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, '-'))}
                placeholder="help-center"
                className="w-full px-3.5 py-2 text-sm border border-[#E4E2F0] rounded-r-lg focus:outline-none focus:ring-2 focus:ring-[#7C3AED]"
              />
            </div>
            <p className="text-[11px] text-[#94A3B8] mt-1">
              Used in the URL path. Must be unique and contain only letters, numbers, and hyphens.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#344054] mb-1.5">
              Initial Status
            </label>
            <div className="flex items-center gap-4">
              <label className="inline-flex items-center gap-2 text-xs font-medium text-[#0F112E] cursor-pointer">
                <input
                  type="radio"
                  name="status"
                  value="DRAFT"
                  checked={status === 'DRAFT'}
                  onChange={() => setStatus('DRAFT')}
                  className="text-[#7C3AED] focus:ring-[#7C3AED]"
                />
                <span>Draft (Private, not publicly visible)</span>
              </label>

              <label className="inline-flex items-center gap-2 text-xs font-medium text-[#0F112E] cursor-pointer">
                <input
                  type="radio"
                  name="status"
                  value="PUBLISHED"
                  checked={status === 'PUBLISHED'}
                  onChange={() => setStatus('PUBLISHED')}
                  className="text-[#7C3AED] focus:ring-[#7C3AED]"
                />
                <span>Published (Immediately visible to public)</span>
              </label>
            </div>
          </div>
        </div>

        <div className="pt-4 border-t border-[#E4E2F0] flex items-center justify-end gap-3">
          <Link
            href="/admin/pages"
            className="px-4 py-2 text-xs font-semibold text-[#475467] hover:bg-[#F4F3FA] rounded-lg transition-colors"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-semibold text-white bg-[#7C3AED] hover:bg-[#6D28D9] rounded-lg shadow-sm disabled:opacity-50 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>{isSubmitting ? 'Creating Page...' : 'Create & Open Editor'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
