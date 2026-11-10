'use client';

import React, { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, CheckCircle2, Clock, Eye, AlertCircle, RefreshCw } from 'lucide-react';
import Container from '@/components/layout/Container';
import Breadcrumbs from '@/components/seo/Breadcrumbs';
import { CmsBlockRenderer } from '@/lib/cms/page-resolver';

interface PreviewProps {
  params: Promise<{ id: string }>;
}

export default function AdminPagePreview({ params }: PreviewProps) {
  const { id } = use(params);
  const router = useRouter();

  const [page, setPage] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);

  useEffect(() => {
    async function loadDraft() {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/admin/pages/${id}/preview`);
        if (!res.ok) throw new Error('Failed to load draft preview.');
        const data = await res.json();
        setPage(data.page);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Error loading draft preview.';
        setError(msg);
      } finally {
        setIsLoading(false);
      }
    }
    loadDraft();
  }, [id]);

  const handlePublish = async () => {
    setIsPublishing(true);
    try {
      const res = await fetch(`/api/admin/pages/${id}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'publish' }),
      });
      if (!res.ok) throw new Error('Failed to publish page.');
      const data = await res.json();
      setPage(data.page);
      alert('Page published successfully!');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error publishing page.';
      alert(msg);
    } finally {
      setIsPublishing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="py-24 text-center text-xs text-[#5E6488]">
        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-3 text-[#7C3AED]" />
        <span>Loading draft preview...</span>
      </div>
    );
  }

  if (error || !page) {
    return (
      <div className="max-w-xl mx-auto p-8 text-center bg-white rounded-xl border border-[#E4E2F0] space-y-4">
        <AlertCircle className="w-8 h-8 text-[#DC2626] mx-auto" />
        <h2 className="text-lg font-bold text-[#0F112E]">Unable to Preview Draft</h2>
        <p className="text-xs text-[#5E6488]">{error || 'Page not found.'}</p>
        <Link
          href={`/admin/pages/${id}`}
          className="inline-flex items-center px-4 py-2 text-xs font-semibold text-white bg-[#7C3AED] rounded-lg"
        >
          Return to Editor
        </Link>
      </div>
    );
  }

  const blocks = Array.isArray(page.content?.blocks) ? page.content.blocks : [];

  return (
    <div className="space-y-6">
      {/* Top Preview Banner */}
      <div className="sticky top-0 z-40 bg-[#0F112E] text-white px-4 py-3 rounded-xl shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Eye className="w-4 h-4 text-[#2DD4BF]" />
          <span className="text-xs font-bold uppercase tracking-wider text-[#2DD4BF]">
            Admin Preview Mode
          </span>
          <span className="text-xs text-[#94A3B8]">|</span>
          <span className="text-xs font-medium text-[#E4E2F0]">
            Viewing Draft Content for: <span className="font-semibold text-white">{page.name}</span> (/{page.slug})
          </span>
          <span
            className={`ml-2 px-2 py-0.5 rounded text-[10px] font-bold ${
              page.status === 'PUBLISHED'
                ? 'bg-[#F4F0FD] text-[#7C3AED]'
                : 'bg-[#FFFBEB] text-[#B45309]'
            }`}
          >
            {page.status}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={`/admin/pages/${id}`}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-[#E4E2F0] hover:text-white bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Editor</span>
          </Link>

          {page.status !== 'PUBLISHED' && (
            <button
              onClick={handlePublish}
              disabled={isPublishing}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-[#0E7490] hover:bg-[#155E75] rounded-lg shadow-sm transition-all"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{isPublishing ? 'Publishing...' : 'Publish Draft'}</span>
            </button>
          )}

          {page.status === 'PUBLISHED' && (
            <Link
              href={`/${page.slug === 'home' ? '' : page.slug}`}
              target="_blank"
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-[#7C3AED] hover:bg-[#6D28D9] rounded-lg transition-all"
            >
              <span>View Live Public Page</span>
            </Link>
          )}
        </div>
      </div>

      {/* Rendered Page Preview Canvas */}
      <div className="bg-white rounded-2xl border border-[#E4E2F0] shadow-subtle p-6 sm:p-10 min-h-[600px]">
        <div className="max-w-3xl mx-auto space-y-8">
          <Breadcrumbs items={[{ name: page.name }]} />

          {blocks.length === 0 ? (
            <div className="py-16 text-center text-xs text-[#5E6488]">
              This draft page does not have any content blocks yet.
            </div>
          ) : (
            <CmsBlockRenderer blocks={blocks} />
          )}
        </div>
      </div>
    </div>
  );
}
