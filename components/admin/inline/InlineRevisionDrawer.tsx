'use client';

import React, { useState, useEffect } from 'react';
import { X, History, RotateCcw, Check, AlertCircle, Clock } from 'lucide-react';

interface InlineRevisionDrawerProps {
  slug: string;
  pageId?: string;
  entityType?: 'tool' | 'page' | 'blog';
  isOpen: boolean;
  onClose: () => void;
  onRevisionRestored: () => void;
}

export function InlineRevisionDrawer({
  slug,
  pageId,
  entityType = 'tool',
  isOpen,
  onClose,
  onRevisionRestored,
}: InlineRevisionDrawerProps) {
  const [revisions, setRevisions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadRevisions();
    }
  }, [isOpen, slug, pageId, entityType]);

  const loadRevisions = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const targetId = pageId || slug;
      let url = `/api/admin/tools/${slug}/revisions`;
      if (entityType === 'page') {
        url = `/api/admin/pages/${targetId}/revisions`;
      } else if (entityType === 'blog') {
        url = `/api/admin/blog/${targetId}/revisions`;
      }

      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setRevisions(Array.isArray(data) ? data : data.revisions || []);
      } else {
        setMessage({ type: 'error', text: 'Failed to load revision history.' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Network error loading revisions.' });
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async (revisionId: string) => {
    const confirmed = window.confirm(
      'Are you sure you want to restore this revision? Your current draft will be replaced with this snapshot for review.'
    );
    if (!confirmed) return;

    setRestoringId(revisionId);
    setMessage(null);
    try {
      const targetId = pageId || slug;
      let restoreUrl = `/api/admin/tools/${slug}/revisions/${revisionId}/restore`;
      if (entityType === 'page') {
        restoreUrl = `/api/admin/pages/${targetId}/revisions/${revisionId}/restore`;
      } else if (entityType === 'blog') {
        restoreUrl = `/api/admin/blog/${targetId}/revisions/${revisionId}/restore`;
      }

      const res = await fetch(restoreUrl, {
        method: 'POST',
      });
      if (res.ok) {
        setMessage({ type: 'success', text: 'Revision restored to draft successfully.' });
        onRevisionRestored();
        setTimeout(() => {
          onClose();
        }, 1200);
      } else {
        const err = await res.json();
        setMessage({ type: 'error', text: err.error || 'Failed to restore revision.' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Network error restoring revision.' });
    } finally {
      setRestoringId(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 overflow-hidden pointer-events-none"
      role="dialog"
      aria-modal="true"
      aria-labelledby="revision-drawer-title"
    >
      <div className="absolute inset-0 overflow-hidden">
        <div className="pointer-events-auto fixed inset-y-0 right-0 flex max-w-full pl-10">
          <div className="w-screen max-w-md bg-white border-l border-[#E4E2F0] shadow-2xl flex flex-col h-full animate-in slide-in-from-right duration-200">
            {/* Header */}
            <div className="p-5 border-b border-[#E4E2F0] bg-[#FAF9FF] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-white border border-[#E4E2F0] flex items-center justify-center shadow-sm">
                  <History className="w-5 h-5 text-[#7C3AED]" />
                </div>
                <div>
                  <h3 id="revision-drawer-title" className="text-base font-bold text-[#0F112E]">
                    Revision History
                  </h3>
                  <p className="text-xs text-[#5E6488]">
                    {entityType === 'blog' ? 'Article' : entityType === 'page' ? 'Page' : 'Tool'}: {slug}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-xl text-[#5E6488] hover:text-[#0F112E] hover:bg-slate-100 transition-colors"
                aria-label="Close revisions drawer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Notifications */}
            {message && (
              <div
                className={`p-3.5 mx-5 mt-4 rounded-xl text-xs font-semibold flex items-center gap-2 ${
                  message.type === 'success'
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-red-50 text-red-800 border border-red-200'
                }`}
              >
                {message.type === 'success' ? (
                  <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
                )}
                <span>{message.text}</span>
              </div>
            )}

            {/* Revisions List */}
            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              {loading ? (
                <div className="py-12 text-center text-sm text-[#5E6488] space-y-2">
                  <Clock className="w-6 h-6 text-[#7C3AED] animate-spin mx-auto" />
                  <p>Loading historical snapshots...</p>
                </div>
              ) : revisions.length === 0 ? (
                <div className="py-12 text-center text-sm text-[#5E6488]">
                  No prior revisions recorded for this {entityType === 'blog' ? 'article' : entityType === 'page' ? 'page' : 'tool'} yet.
                </div>
              ) : (
                revisions.map((rev, idx) => (
                  <div
                    key={rev.id || idx}
                    className="p-4 bg-white border border-[#E4E2F0] rounded-2xl hover:border-[#7C3AED]/40 transition-colors shadow-sm space-y-2.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-[#7C3AED]">
                        {idx === 0 ? 'Current Snapshot' : `Revision #${revisions.length - idx}`}
                      </span>
                      <span className="text-[11px] text-[#5E6488]">
                        {new Date(rev.createdAt).toLocaleString()}
                      </span>
                    </div>

                    <p className="text-xs text-[#0F112E] font-medium">
                      Reason: <span className="text-[#5E6488]">{rev.reason || 'Content update'}</span>
                    </p>

                    {rev.authorId && (
                      <p className="text-[11px] text-[#5E6488]">
                        Author ID: <code className="bg-slate-100 px-1 py-0.5 rounded">{rev.authorId}</code>
                      </p>
                    )}

                    <div className="pt-2 border-t border-[#E4E2F0] flex items-center justify-between">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          rev.contentSnapshot?.isPublished
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}
                      >
                        {rev.contentSnapshot?.isPublished ? 'Published' : 'Draft'}
                      </span>

                      {idx > 0 && (
                        <button
                          type="button"
                          disabled={restoringId === rev.id}
                          onClick={() => handleRestore(rev.id)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-[#F4F0FD] text-[#7C3AED] hover:bg-[#7C3AED] hover:text-white transition-colors"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>{restoringId === rev.id ? 'Restoring...' : 'Restore'}</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
