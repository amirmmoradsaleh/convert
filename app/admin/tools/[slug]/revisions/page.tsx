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
  Wrench,
  Check,
  X,
} from 'lucide-react';
import { ToolDefinition } from '@/lib/tools';

interface ToolRevisionItem {
  id: string;
  toolContentId: string;
  toolSlug: string;
  contentSnapshot: {
    customTitle?: string | null;
    customH1?: string | null;
    customDescription?: string | null;
    customIntro?: string | null;
    customValueProp?: string | null;
    customHowTo?: any[];
    customFeatures?: any[];
    customFaq?: any[];
    customRelatedTools?: string[];
    isPublished?: boolean;
  } | null;
  seoSnapshot: any | null;
  authorId: string | null;
  reason: string | null;
  createdAt: string;
}

interface RevisionsPageProps {
  params: Promise<{ slug: string }>;
}

export default function AdminToolRevisions({ params }: RevisionsPageProps) {
  const { slug } = use(params);
  const router = useRouter();

  const [tool, setTool] = useState<ToolDefinition | null>(null);
  const [revisions, setRevisions] = useState<ToolRevisionItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedRevId, setExpandedRevId] = useState<string | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchRevisions = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [toolRes, revsRes] = await Promise.all([
        fetch(`/api/admin/tools/${slug}`),
        fetch(`/api/admin/tools/${slug}/revisions`),
      ]);

      if (!toolRes.ok || !revsRes.ok) throw new Error('Failed to load tool revisions.');

      const toolData = await toolRes.json();
      const revsData = await revsRes.json();

      setTool(toolData.canonical);
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
  }, [slug]);

  const handleRestore = async (revisionId: string) => {
    if (!confirm('Are you sure you want to restore this historical revision? A new revision snapshot will be created.')) {
      return;
    }

    setIsRestoring(true);
    setStatusMessage(null);
    try {
      const res = await fetch(`/api/admin/tools/${slug}/revisions/${revisionId}/restore`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to restore revision.');

      setStatusMessage({
        type: 'success',
        text: 'Revision successfully restored to current draft! You can now review it in the editor.',
      });
      await fetchRevisions();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Restore failed.';
      setStatusMessage({ type: 'error', text: msg });
    } finally {
      setIsRestoring(false);
    }
  };

  if (isLoading) {
    return (
      <div className="py-24 text-center text-xs text-[#5E6488]">
        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-3 text-[#7C3AED]" />
        <span>Loading revision history for {slug}...</span>
      </div>
    );
  }

  if (error || !tool) {
    return (
      <div className="max-w-xl mx-auto p-8 text-center bg-white rounded-xl border border-[#E4E2F0] space-y-4">
        <AlertTriangle className="w-8 h-8 text-[#DC2626] mx-auto" />
        <h2 className="text-base font-bold text-[#0F112E]">Unable to Load Revisions</h2>
        <p className="text-xs text-[#5E6488]">{error || 'Tool not found.'}</p>
        <Link
          href={`/admin/tools/${slug}`}
          className="inline-flex items-center px-4 py-2 text-xs font-semibold text-white bg-[#7C3AED] rounded-lg"
        >
          Return to Editor
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-[#E4E2F0] shadow-subtle">
        <div className="flex items-center gap-3">
          <Link
            href={`/admin/tools/${slug}`}
            className="p-2 text-[#5E6488] hover:text-[#0F112E] hover:bg-[#F4F3FA] rounded-lg transition-colors"
            title="Back to Editor"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-[#0F112E]">Revision History</h1>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#F4F3FA] text-[#475467] font-semibold border border-[#E4E2F0]">
                {revisions.length} {revisions.length === 1 ? 'Snapshot' : 'Snapshots'}
              </span>
            </div>
            <div className="text-xs text-[#5E6488] mt-0.5">
              Tool: <span className="font-semibold text-[#0F112E]">{tool.name}</span> (/tools/{slug})
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={`/admin/tools/${slug}`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#7C3AED] hover:bg-[#6D28D9] rounded-lg transition-colors"
          >
            <span>Open Tool Editor</span>
          </Link>
          <button
            onClick={fetchRevisions}
            className="p-1.5 text-[#5E6488] hover:text-[#0F112E] border border-[#E4E2F0] rounded-lg hover:bg-[#F4F3FA]"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {statusMessage && (
        <div
          className={`p-3 rounded-xl border text-xs flex items-center justify-between ${
            statusMessage.type === 'success'
              ? 'bg-[#ECFDF5] border-[#A7F3D0] text-[#065F46]'
              : 'bg-[#FFF1F2] border-[#FECDD3] text-[#9F1239]'
          }`}
        >
          <div className="flex items-center gap-2">
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-[#10B981] shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 shrink-0" />
            )}
            <span>{statusMessage.text}</span>
          </div>
          <button onClick={() => setStatusMessage(null)} className="opacity-70 hover:opacity-100">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Revisions List */}
      <div className="space-y-4">
        {revisions.length === 0 ? (
          <div className="p-12 text-center bg-white rounded-xl border border-[#E4E2F0] space-y-2">
            <History className="w-8 h-8 text-[#94A3B8] mx-auto" />
            <h3 className="text-sm font-bold text-[#0F112E]">No Revisions Recorded Yet</h3>
            <p className="text-xs text-[#5E6488] max-w-md mx-auto">
              Revisions are automatically captured whenever you save draft updates, publish, or restore content for this tool.
            </p>
          </div>
        ) : (
          revisions.map((rev, index) => {
            const isExpanded = expandedRevId === rev.id;
            const snap = rev.contentSnapshot || {};
            const seoSnap = rev.seoSnapshot || {};
            const date = new Date(rev.createdAt);

            return (
              <div
                key={rev.id}
                className="bg-white rounded-xl border border-[#E4E2F0] shadow-subtle overflow-hidden transition-all"
              >
                {/* Header Row */}
                <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#F4F3FA]/50 border-b border-[#E4E2F0]">
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-full bg-[#F4F0FD] text-[#7C3AED] flex items-center justify-center font-bold text-xs shrink-0">
                      #{revisions.length - index}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-xs text-[#0F112E]">
                          {rev.reason || (index === revisions.length - 1 ? 'Initial Snapshot' : 'Content update')}
                        </span>
                        {index === 0 && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#F4F0FD] text-[#7C3AED]">
                            Latest
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-[#5E6488] mt-0.5">
                        <Clock className="w-3 h-3" />
                        <span>{date.toLocaleDateString()} at {date.toLocaleTimeString()}</span>
                        {rev.authorId && <span>• Author: {rev.authorId}</span>}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center">
                    <button
                      onClick={() => handleRestore(rev.id)}
                      disabled={isRestoring}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#7C3AED] bg-[#F4F0FD] hover:bg-[#D1EBE5] rounded-lg transition-colors disabled:opacity-50"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Restore This Snapshot</span>
                    </button>

                    <button
                      onClick={() => setExpandedRevId(isExpanded ? null : rev.id)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs text-[#5E6488] hover:text-[#0F112E] hover:bg-[#F4F3FA] rounded-lg transition-colors"
                    >
                      <span>{isExpanded ? 'Hide Details' : 'View Snapshot'}</span>
                      {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {/* Expanded Snapshot Inspection */}
                {isExpanded && (
                  <div className="p-5 bg-white space-y-4 text-xs">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Content Overview */}
                      <div className="p-4 bg-[#F4F3FA] rounded-xl border border-[#E4E2F0] space-y-2">
                        <h4 className="font-bold text-[#0F112E] text-xs flex items-center gap-1.5 border-b border-[#E4E2F0] pb-2">
                          <Wrench className="w-3.5 h-3.5 text-[#7C3AED]" />
                          <span>Content Snapshot</span>
                        </h4>
                        <div>
                          <span className="font-semibold text-[#5E6488]">Custom H1:</span>{' '}
                          <span className="text-[#0F112E]">{snap.customH1 || 'Default (none)'}</span>
                        </div>
                        <div>
                          <span className="font-semibold text-[#5E6488]">Custom Title:</span>{' '}
                          <span className="text-[#0F112E]">{snap.customTitle || 'Default (none)'}</span>
                        </div>
                        <div>
                          <span className="font-semibold text-[#5E6488]">How-To Steps:</span>{' '}
                          <span className="text-[#0F112E]">{snap.customHowTo?.length || 0} custom steps</span>
                        </div>
                        <div>
                          <span className="font-semibold text-[#5E6488]">Features:</span>{' '}
                          <span className="text-[#0F112E]">{snap.customFeatures?.length || 0} custom features</span>
                        </div>
                        <div>
                          <span className="font-semibold text-[#5E6488]">FAQ Items:</span>{' '}
                          <span className="text-[#0F112E]">{snap.customFaq?.length || 0} custom questions</span>
                        </div>
                        <div>
                          <span className="font-semibold text-[#5E6488]">Related Tools:</span>{' '}
                          <span className="text-[#0F112E]">
                            {snap.customRelatedTools?.length ? snap.customRelatedTools.join(', ') : 'Default'}
                          </span>
                        </div>
                      </div>

                      {/* SEO Overview */}
                      <div className="p-4 bg-[#F4F3FA] rounded-xl border border-[#E4E2F0] space-y-2">
                        <h4 className="font-bold text-[#0F112E] text-xs flex items-center gap-1.5 border-b border-[#E4E2F0] pb-2">
                          <Globe className="w-3.5 h-3.5 text-[#7C3AED]" />
                          <span>SEO Snapshot</span>
                        </h4>
                        <div>
                          <span className="font-semibold text-[#5E6488]">SEO Title:</span>{' '}
                          <span className="text-[#0F112E]">{seoSnap.seoTitle || 'Default'}</span>
                        </div>
                        <div>
                          <span className="font-semibold text-[#5E6488]">Meta Description:</span>{' '}
                          <span className="text-[#0F112E] line-clamp-2">{seoSnap.metaDescription || 'Default'}</span>
                        </div>
                        <div>
                          <span className="font-semibold text-[#5E6488]">Canonical URL:</span>{' '}
                          <span className="font-mono text-[#0F112E]">{seoSnap.canonicalUrl || 'Default'}</span>
                        </div>
                        <div>
                          <span className="font-semibold text-[#5E6488]">Robots:</span>{' '}
                          <span className="font-mono text-[#0F112E]">
                            {seoSnap.robotsIndex !== false ? 'index' : 'noindex'}, {seoSnap.robotsFollow !== false ? 'follow' : 'nofollow'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
