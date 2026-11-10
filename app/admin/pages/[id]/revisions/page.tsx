'use client';

import React, { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  History,
  RotateCcw,
  CheckCircle2,
  Clock,
  Layers,
  Globe,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';

interface RevisionItem {
  id: string;
  pageId: string;
  contentSnapshot: {
    blocks?: any[];
    customCss?: string | null;
  } | null;
  seoSnapshot: any | null;
  authorId: string | null;
  reason: string | null;
  createdAt: string;
}

interface PageData {
  id: string;
  name: string;
  slug: string;
  status: string;
}

interface RevisionsPageProps {
  params: Promise<{ id: string }>;
}

export default function AdminPageRevisions({ params }: RevisionsPageProps) {
  const { id } = use(params);
  const router = useRouter();

  const [page, setPage] = useState<PageData | null>(null);
  const [revisions, setRevisions] = useState<RevisionItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedRevId, setExpandedRevId] = useState<string | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const fetchRevisions = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [pageRes, revsRes] = await Promise.all([
        fetch(`/api/admin/pages/${id}`),
        fetch(`/api/admin/pages/${id}/revisions`),
      ]);

      if (!pageRes.ok || !revsRes.ok) throw new Error('Failed to load revisions.');

      const pageData = await pageRes.json();
      const revsData = await revsRes.json();

      setPage(pageData.page);
      setRevisions(revsData.revisions || []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error loading revision history.';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRevisions();
  }, [id]);

  const handleRestore = async (revisionId: string) => {
    const confirmed = window.confirm(
      'Are you sure you want to restore this revision? This will create a new revision snapshot with the restored content.'
    );
    if (!confirmed) return;

    setIsRestoring(true);
    setStatusMessage(null);
    try {
      const res = await fetch(`/api/admin/pages/${id}/revisions/${revisionId}/restore`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to restore revision.');

      setStatusMessage('Revision successfully restored! A new version snapshot was recorded.');
      await fetchRevisions();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error restoring revision.';
      alert(msg);
    } finally {
      setIsRestoring(false);
    }
  };

  if (isLoading) {
    return (
      <div className="py-24 text-center text-xs text-[#5E6488]">
        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-3 text-[#7C3AED]" />
        <span>Loading revision history...</span>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-16">
      {/* Top Header */}
      <div className="flex items-center justify-between pb-4 border-b border-[#E4E2F0]">
        <div className="flex items-center gap-3">
          <Link
            href={`/admin/pages/${id}`}
            className="p-2 text-[#5E6488] hover:text-[#0F112E] hover:bg-[#F4F3FA] rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[#0F112E]">
              Revision History
            </h1>
            <p className="text-xs text-[#5E6488] mt-0.5">
              Audited snapshots for <span className="font-semibold text-[#0F112E]">{page?.name}</span> (/{page?.slug})
            </p>
          </div>
        </div>

        <Link
          href={`/admin/pages/${id}`}
          className="px-3.5 py-1.5 text-xs font-semibold text-[#7C3AED] bg-[#F4F0FD] hover:bg-[#D5EAE6] rounded-lg transition-colors"
        >
          Return to Editor
        </Link>
      </div>

      {statusMessage && (
        <div className="p-4 bg-[#F4F0FD] border border-[#BCE1D9] text-[#7C3AED] rounded-xl text-xs sm:text-sm font-medium flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#7C3AED]" />
            <span>{statusMessage}</span>
          </div>
          <button onClick={() => setStatusMessage(null)}>✕</button>
        </div>
      )}

      {error && (
        <div className="p-4 bg-[#FEF2F2] border border-[#FCA5A5] text-[#991B1B] rounded-xl text-xs sm:text-sm font-medium">
          {error}
        </div>
      )}

      {revisions.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-xl border border-[#E4E2F0] text-xs text-[#5E6488]">
          No revisions recorded yet for this page.
        </div>
      ) : (
        <div className="space-y-3">
          {revisions.map((rev, index) => {
            const isExpanded = expandedRevId === rev.id;
            const blockCount = rev.contentSnapshot?.blocks?.length || 0;
            const isLatest = index === 0;

            return (
              <div
                key={rev.id}
                className={`bg-white rounded-xl border transition-all ${
                  isLatest ? 'border-[#7C3AED] shadow-sm' : 'border-[#E4E2F0]'
                }`}
              >
                <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <History className="w-4 h-4 text-[#7C3AED]" />
                      <span className="text-sm font-bold text-[#0F112E]">
                        {rev.reason || 'Content update'}
                      </span>
                      {isLatest && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#F4F0FD] text-[#7C3AED]">
                          Current Version
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-[#5E6488]">
                      <span>{new Date(rev.createdAt).toLocaleString()}</span>
                      <span>•</span>
                      <span className="font-mono text-[11px]">{rev.id}</span>
                      <span>•</span>
                      <span>{blockCount} {blockCount === 1 ? 'block' : 'blocks'}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setExpandedRevId(isExpanded ? null : rev.id)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-[#5E6488] hover:text-[#0F112E] bg-[#F4F3FA] hover:bg-[#F4F3FA] rounded-lg transition-colors"
                    >
                      <span>{isExpanded ? 'Hide Details' : 'Inspect'}</span>
                      {isExpanded ? (
                        <ChevronUp className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5" />
                      )}
                    </button>

                    {!isLatest && (
                      <button
                        onClick={() => handleRestore(rev.id)}
                        disabled={isRestoring}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-[#7C3AED] bg-[#F4F0FD] hover:bg-[#D0EBE5] rounded-lg disabled:opacity-50 transition-colors"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Restore This Version</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Expanded Snapshot Inspection Details */}
                {isExpanded && (
                  <div className="p-4 bg-[#F4F3FA] border-t border-[#E4E2F0] rounded-b-xl space-y-4 text-xs">
                    <div>
                      <h4 className="font-bold text-[#0F112E] mb-2 flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5 text-[#7C3AED]" />
                        <span>Content Blocks Snapshot ({blockCount})</span>
                      </h4>
                      {blockCount === 0 ? (
                        <p className="text-[#94A3B8] italic">No blocks recorded in this snapshot.</p>
                      ) : (
                        <div className="space-y-1.5 pl-2 border-l-2 border-[#E4E2F0]">
                          {rev.contentSnapshot?.blocks?.map((b: any, bIdx: number) => (
                            <div key={b.id || bIdx} className="text-[#475467]">
                              <span className="font-bold uppercase text-[10px] bg-white px-1.5 py-0.5 rounded border border-[#E4E2F0] mr-2">
                                {b.type}
                              </span>
                              <span>
                                {b.text || b.title || b.question || b.label || b.html || b.src || 'Block item'}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {rev.seoSnapshot && (
                      <div className="pt-2 border-t border-[#E4E2F0]">
                        <h4 className="font-bold text-[#0F112E] mb-2 flex items-center gap-1.5">
                          <Globe className="w-3.5 h-3.5 text-[#7C3AED]" />
                          <span>SEO Metadata Snapshot</span>
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[#475467]">
                          <div>
                            <span className="font-semibold text-[#0F112E]">Title:</span>{' '}
                            {rev.seoSnapshot.seoTitle || '<None>'}
                          </div>
                          <div>
                            <span className="font-semibold text-[#0F112E]">Canonical:</span>{' '}
                            {rev.seoSnapshot.canonicalUrl || '<None>'}
                          </div>
                          <div className="sm:col-span-2">
                            <span className="font-semibold text-[#0F112E]">Description:</span>{' '}
                            {rev.seoSnapshot.metaDescription || '<None>'}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
