'use client';

import React, { useEffect, useState, use } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  History,
  RotateCcw,
  CheckCircle2,
  Calendar,
  User,
  Eye,
  X,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import { BlogPostRevisionItem, BlogPostItem } from '@/lib/admin/types';

interface BlogRevisionsProps {
  params: Promise<{ id: string }>;
}

export default function BlogRevisionsPage({ params }: BlogRevisionsProps) {
  const { id } = use(params);

  const [post, setPost] = useState<BlogPostItem | null>(null);
  const [revisions, setRevisions] = useState<BlogPostRevisionItem[]>([]);
  const [selectedRevision, setSelectedRevision] = useState<BlogPostRevisionItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRestoring, setIsRestoring] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fetchRevisions = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [postRes, revRes] = await Promise.all([
        fetch(`/api/admin/blog/${id}`),
        fetch(`/api/admin/blog/${id}/revisions`),
      ]);

      if (!postRes.ok) throw new Error('Failed to load post.');
      const postData = await postRes.json();
      setPost(postData.post);

      if (!revRes.ok) throw new Error('Failed to load revisions.');
      const revData = await revRes.json();
      setRevisions(revData.revisions || []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error loading revisions.';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRevisions();
  }, [id]);

  const handleRestore = async (revisionId: string) => {
    if (!window.confirm('Are you sure you want to restore this revision? Your current draft will be overwritten with the snapshot content.')) {
      return;
    }

    setIsRestoring(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await fetch(`/api/admin/blog/${id}/revisions/${revisionId}`, {
        method: 'POST',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to restore revision.');
      }

      setSuccessMsg('Revision successfully restored to current draft.');
      setSelectedRevision(null);
      await fetchRevisions();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error restoring revision.';
      setError(msg);
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#E4E2F0]">
        <div>
          <div className="flex items-center gap-2 text-xs text-[#5E6488] mb-1">
            <Link href={`/admin/blog/${id}`} className="hover:text-[#0F112E] flex items-center gap-1">
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Editor</span>
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-[#0F172A]">Revision History</h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full font-medium bg-[#F4F0FD] text-[#7C3AED]">
              {revisions.length} {revisions.length === 1 ? 'Snapshot' : 'Snapshots'}
            </span>
          </div>
          {post && (
            <p className="text-sm text-[#5E6488] mt-1">
              Article: <span className="font-semibold text-[#0F172A]">{post.title}</span> (/blog/{post.slug})
            </p>
          )}
        </div>

        <Link
          href={`/admin/blog/${id}`}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#7C3AED] text-white text-xs font-semibold hover:bg-[#6D28D9] shadow-xs"
        >
          <span>Return to Editor</span>
        </Link>
      </div>

      {successMsg && (
        <div className="p-3.5 rounded-lg bg-[#F0FDF4] border border-[#BBF7D0] text-[#166534] text-xs font-medium flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {error && (
        <div className="p-3.5 rounded-lg bg-[#FEF2F2] border border-[#FECACA] text-[#991B1B] text-xs font-medium flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Revisions List */}
      <div className="bg-white border border-[#E4E2F0] rounded-xl shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-[#5E6488]">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-[#7C3AED]" />
            <p className="text-sm">Loading revision timeline...</p>
          </div>
        ) : revisions.length === 0 ? (
          <div className="p-12 text-center text-[#5E6488] space-y-2">
            <History className="w-8 h-8 text-[#94A3B8] mx-auto" />
            <p className="text-sm font-semibold text-[#1E293B]">No Revisions Recorded</p>
            <p className="text-xs text-[#5E6488]">Revision snapshots are automatically created whenever drafts are saved or published.</p>
          </div>
        ) : (
          <div className="divide-y divide-[#E4E2F0]">
            {revisions.map((rev, index) => {
              const date = new Date(rev.createdAt);
              const isLatest = index === 0;

              return (
                <div
                  key={rev.id}
                  className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-[#F4F3FA] transition-colors"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-[#0F172A]">
                        {rev.reason || 'Content update'}
                      </span>
                      {isLatest && (
                        <span className="text-[10px] px-2 py-0.5 rounded font-bold uppercase bg-[#DCFCE7] text-[#166534]">
                          Current State
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-[#5E6488]">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        <time dateTime={rev.createdAt}>{date.toLocaleString()}</time>
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <User className="w-3.5 h-3.5" />
                        <span>{rev.author?.name || 'Administrator'}</span>
                      </span>
                      <span>•</span>
                      <span className="font-mono text-[11px] text-[#94A3B8]">
                        ID: {rev.id.slice(0, 10)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => setSelectedRevision(rev)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E4E2F0] bg-white text-xs font-semibold text-[#475569] hover:bg-[#F4F3FA]"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>View Snapshot</span>
                    </button>

                    <button
                      onClick={() => handleRestore(rev.id)}
                      disabled={isRestoring}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E4E2F0] bg-white text-xs font-semibold text-[#7C3AED] hover:bg-[#F4F0FD] disabled:opacity-50"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Restore</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Snapshot Modal */}
      {selectedRevision && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[80vh] flex flex-col">
            <div className="p-4 border-b border-[#E4E2F0] flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base text-[#0F172A]">Content Snapshot</h3>
                <p className="text-xs text-[#5E6488]">
                  Captured {new Date(selectedRevision.createdAt).toLocaleString()} by {selectedRevision.author?.name || 'Admin'}
                </p>
              </div>
              <button
                onClick={() => setSelectedRevision(null)}
                className="p-1 rounded-lg text-[#94A3B8] hover:text-[#0F172A]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 text-xs font-mono text-[#334155] bg-[#F4F3FA]">
              <div>
                <span className="font-bold text-[#0F172A]">Title:</span> {selectedRevision.contentSnapshot?.title}
              </div>
              <div>
                <span className="font-bold text-[#0F172A]">Slug:</span> {selectedRevision.contentSnapshot?.slug}
              </div>
              <div>
                <span className="font-bold text-[#0F172A]">Excerpt:</span> {selectedRevision.contentSnapshot?.excerpt || '—'}
              </div>
              <div>
                <span className="font-bold text-[#0F172A]">Content Preview:</span>
                <pre className="mt-1 p-3 bg-white border border-[#E4E2F0] rounded text-[11px] overflow-x-auto whitespace-pre-wrap">
                  {selectedRevision.contentSnapshot?.content || ''}
                </pre>
              </div>
              {selectedRevision.seoSnapshot && (
                <div>
                  <span className="font-bold text-[#0F172A]">SEO Title:</span> {selectedRevision.seoSnapshot.seoTitle || '—'}
                </div>
              )}
            </div>

            <div className="p-4 border-t border-[#E4E2F0] flex items-center justify-end gap-2 bg-white">
              <button
                onClick={() => setSelectedRevision(null)}
                className="px-4 py-2 rounded-lg border border-[#E4E2F0] text-xs font-semibold text-[#475569] hover:bg-[#F4F3FA]"
              >
                Close
              </button>
              <button
                onClick={() => handleRestore(selectedRevision.id)}
                disabled={isRestoring}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#7C3AED] text-white text-xs font-semibold hover:bg-[#6D28D9]"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Restore This Snapshot</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
