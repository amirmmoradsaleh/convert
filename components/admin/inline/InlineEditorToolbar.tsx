'use client';

import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Eye,
  Pencil,
  Save,
  Globe,
  History,
  Undo2,
  Check,
  AlertCircle,
  Loader2,
  ExternalLink,
  Search,
} from 'lucide-react';
import { AdminUserSession } from '@/lib/admin/types';

interface InlineEditorToolbarProps {
  slug: string;
  previewUrl?: string;
  isEditing: boolean;
  isDirty: boolean;
  isPublished: boolean;
  isPreviewMode: boolean;
  onToggleEdit: () => void;
  onSaveDraft: () => Promise<void>;
  onPublish: () => Promise<void>;
  onDiscard: () => void;
  onOpenRevisions: () => void;
  onOpenSeo?: () => void;
  onOpenSharedSettings?: () => void;
  hasSeoOverride?: boolean;
  isSaving: boolean;
  isPublishing: boolean;
  feedbackMessage?: { type: 'success' | 'error' | 'warning'; text: string } | null;
}

export function InlineEditorToolbar({
  slug,
  previewUrl,
  isEditing,
  isDirty,
  isPublished,
  isPreviewMode,
  onToggleEdit,
  onSaveDraft,
  onPublish,
  onDiscard,
  onOpenRevisions,
  onOpenSeo,
  onOpenSharedSettings,
  hasSeoOverride = false,
  isSaving,
  isPublishing,
  feedbackMessage,
}: InlineEditorToolbarProps) {
  const [currentUser, setCurrentUser] = useState<AdminUserSession | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [authChecked, setAuthChecked] = useState(false);

  // Authenticate strictly with the server on mount
  useEffect(() => {
    let isMounted = true;
    async function checkAuth() {
      try {
        const res = await fetch('/api/admin/auth/me');
        if (res.ok) {
          const data = await res.json();
          if (isMounted && data.user) {
            setCurrentUser(data.user);
            setPermissions(data.permissions || []);
          }
        }
      } catch {
        // Public visitors will fail this call silently
      } finally {
        if (isMounted) {
          setAuthChecked(true);
        }
      }
    }
    checkAuth();
    return () => {
      isMounted = false;
    };
  }, []);

  // Public visitors or unauthorized users see NOTHING:
  // Zero toolbar DOM elements, zero clutter, zero draft exposure
  if (!authChecked || !currentUser || !permissions.includes('EDIT_CONTENT')) {
    return null;
  }

  const canPublish = permissions.includes('PUBLISH_CONTENT');

  return (
    <>
      {/* Feedback Toast Notification */}
      {feedbackMessage && (
        <div className="fixed bottom-24 right-6 z-50 animate-in fade-in slide-in-from-bottom-4 duration-200">
          <div
            className={`px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2.5 text-xs font-bold border ${
              feedbackMessage.type === 'success'
                ? 'bg-emerald-600 text-white border-emerald-500 shadow-emerald-200'
                : feedbackMessage.type === 'warning'
                ? 'bg-amber-600 text-white border-amber-500 shadow-amber-200'
                : 'bg-red-600 text-white border-red-500 shadow-red-200'
            }`}
          >
            {feedbackMessage.type === 'success' ? (
              <Check className="w-4 h-4 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
            )}
            <span>{feedbackMessage.text}</span>
          </div>
        </div>
      )}

      {/* Floating Unobtrusive Admin Control Dock */}
      <aside
        aria-label="Admin Inline Content Editor Toolbar"
        className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 max-w-4xl w-[94vw] sm:w-auto"
      >
        <div className="bg-[#0F112E] text-white p-2 sm:p-2.5 rounded-2xl shadow-2xl border border-white/10 flex flex-wrap items-center justify-between gap-2 sm:gap-4 backdrop-blur-md">
          {/* User & Status Identity */}
          <div className="flex items-center gap-2 pl-2">
            <span className="w-6 h-6 rounded-lg bg-[#7C3AED] flex items-center justify-center text-white">
              <ShieldCheck className="w-3.5 h-3.5" />
            </span>
            <div className="hidden sm:block text-left">
              <p className="text-xs font-bold leading-none">{currentUser.name}</p>
              <p className="text-[10px] text-white/60 capitalize leading-tight mt-0.5">
                {currentUser.role.toLowerCase().replace('_', ' ')}
              </p>
            </div>
            <div className="h-4 w-px bg-white/10 mx-1 hidden sm:block" />
            {/* Status Pill */}
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide flex items-center gap-1 ${
                isPublished
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${isPublished ? 'bg-emerald-400' : 'bg-amber-400'}`} />
              {isPublished ? 'Published' : 'Draft'}
            </span>
            {isDirty && (
              <span className="hidden md:inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#7C3AED]/40 text-purple-200 border border-purple-400/30 animate-pulse">
                Unsaved Edits
              </span>
            )}
          </div>

          {/* Mode Switcher Toggle */}
          <div className="bg-white/10 p-0.5 rounded-xl flex items-center text-xs font-bold">
            <button
              type="button"
              onClick={onToggleEdit}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                !isEditing ? 'bg-white text-[#0F112E] shadow-sm' : 'text-white/70 hover:text-white'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>View Mode</span>
            </button>
            <button
              type="button"
              onClick={onToggleEdit}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                isEditing ? 'bg-[#7C3AED] text-white shadow-sm' : 'text-white/70 hover:text-white'
              }`}
            >
              <Pencil className="w-3.5 h-3.5" />
              <span>Edit Mode</span>
            </button>
          </div>

          {/* Actions in Edit Mode */}
          {isEditing && (
            <div className="flex items-center gap-1.5">
              {/* Save Draft */}
              <button
                type="button"
                disabled={isSaving || !isDirty}
                onClick={onSaveDraft}
                className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shadow-sm ${
                  isDirty
                    ? 'bg-white text-[#0F112E] hover:bg-slate-100 cursor-pointer'
                    : 'bg-white/10 text-white/40 cursor-not-allowed'
                }`}
              >
                {isSaving ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Save className="w-3.5 h-3.5 text-[#7C3AED]" />
                )}
                <span>Save Draft</span>
              </button>

              {/* Publish Action (Protected by RBAC) */}
              {canPublish && (
                <button
                  type="button"
                  disabled={isPublishing || isDirty}
                  onClick={onPublish}
                  title={isDirty ? 'Please save your draft before publishing' : 'Publish current draft to live site'}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shadow-sm ${
                    !isDirty
                      ? 'bg-emerald-600 text-white hover:bg-emerald-500 cursor-pointer'
                      : 'bg-white/10 text-white/40 cursor-not-allowed'
                  }`}
                >
                  {isPublishing ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Globe className="w-3.5 h-3.5" />
                  )}
                  <span>Publish</span>
                </button>
              )}

              {/* SEO Settings Drawer Toggle */}
              {onOpenSeo && (
                <button
                  type="button"
                  onClick={onOpenSeo}
                  title="Configure search engine & social share metadata"
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    hasSeoOverride
                      ? 'bg-purple-500/30 text-purple-200 border border-purple-400/40 hover:bg-purple-500/40 cursor-pointer'
                      : 'text-white/80 hover:text-white hover:bg-white/10 cursor-pointer'
                  }`}
                >
                  <Search className="w-3.5 h-3.5 text-indigo-300" />
                  <span>SEO</span>
                  {hasSeoOverride && (
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-300" />
                  )}
                </button>
              )}

              {/* Shared Site Configuration */}
              {onOpenSharedSettings && (
                <button
                  type="button"
                  onClick={onOpenSharedSettings}
                  title="Configure global shared site settings (brand, header, footer)"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-white/80 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                >
                  <Globe className="w-3.5 h-3.5 text-blue-300" />
                  <span>Site Config</span>
                </button>
              )}

              {/* Revisions History Drawer */}
              <button
                type="button"
                onClick={onOpenRevisions}
                title="View revision snapshots and rollback"
                className="p-2 rounded-xl text-white/80 hover:text-white hover:bg-white/10 transition-colors"
                aria-label="View revision history"
              >
                <History className="w-4 h-4" />
              </button>

              {/* Discard in-memory changes */}
              {isDirty && (
                <button
                  type="button"
                  onClick={onDiscard}
                  title="Discard unsaved edits in current session"
                  className="p-2 rounded-xl text-red-300 hover:text-red-200 hover:bg-white/10 transition-colors"
                  aria-label="Discard unsaved changes"
                >
                  <Undo2 className="w-4 h-4" />
                </button>
              )}
            </div>
          )}

          {/* Preview Direct Link */}
          {!isPreviewMode && (
            <a
              href={previewUrl || `/tools/${slug}?preview=true`}
              target="_blank"
              rel="noopener noreferrer"
              title="Open draft preview in new window (noindex protected)"
              className="hidden lg:inline-flex items-center gap-1 text-[11px] font-bold text-white/70 hover:text-white hover:underline pr-2"
            >
              <span>Preview Link</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      </aside>
    </>
  );
}
