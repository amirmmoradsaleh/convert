'use client';

import React, { useState, useRef } from 'react';
import {
  Archive,
  Download,
  Upload,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  FileText,
  Wrench,
  BookOpen,
  Settings,
  Image as ImageIcon,
  ShieldAlert,
  Loader2,
  RefreshCw,
  Info,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import {
  CmsBackupPreviewResult,
  CmsBackupRestoreResult,
  CMS_BACKUP_MAX_PAYLOAD_SIZE,
} from '@/lib/admin/types';

export default function AdminBackupPage() {
  const [activeTab, setActiveTab] = useState<'export' | 'restore'>('export');

  // Export State
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  // Restore State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [previewResult, setPreviewResult] = useState<CmsBackupPreviewResult | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  // Confirmation Modal State
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isConfirmedCheckbox, setIsConfirmedCheckbox] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreResult, setRestoreResult] = useState<CmsBackupRestoreResult | null>(null);
  const [restoreError, setRestoreError] = useState<string | null>(null);

  // Collapsible section details state
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle Export Download
  const handleExport = async () => {
    setIsExporting(true);
    setExportError(null);

    try {
      const res = await fetch('/api/admin/backup/export');
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to export CMS backup.');
      }

      const blob = await res.blob();
      const contentDisposition = res.headers.get('content-disposition');
      let filename = `convert24-cms-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="?([^"]+)"?/);
        if (match && match[1]) filename = match[1];
      }

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      setExportError(err.message || 'An error occurred during export.');
    } finally {
      setIsExporting(false);
    }
  };

  // Handle File Selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.json')) {
      setPreviewError('Please select a valid JSON backup file (.json).');
      return;
    }

    if (file.size > CMS_BACKUP_MAX_PAYLOAD_SIZE) {
      setPreviewError('File exceeds the maximum allowed size of 10MB.');
      return;
    }

    setSelectedFile(file);
    setPreviewResult(null);
    setRestoreResult(null);
    setPreviewError(null);
    setRestoreError(null);

    const reader = new FileReader();
    reader.onload = async (evt) => {
      const content = evt.target?.result as string;
      setFileContent(content);
      await runPreview(content);
    };
    reader.onerror = () => {
      setPreviewError('Failed to read the selected file.');
    };
    reader.readAsText(file);
  };

  // Run Preview Validation API
  const runPreview = async (content: string) => {
    setIsPreviewLoading(true);
    setPreviewError(null);

    try {
      const res = await fetch('/api/admin/backup/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: content,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to validate backup file.');
      }

      setPreviewResult(data as CmsBackupPreviewResult);
    } catch (err: any) {
      setPreviewError(err.message || 'Error validating backup.');
    } finally {
      setIsPreviewLoading(false);
    }
  };

  // Handle Restore Execution
  const handleRestore = async () => {
    if (!fileContent || !previewResult?.isValid) return;

    setIsRestoring(true);
    setRestoreError(null);

    try {
      const parsedBackup = JSON.parse(fileContent);

      const res = await fetch('/api/admin/backup/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          backup: parsedBackup,
          confirm: true,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || data.message || 'Failed to restore CMS backup.');
      }

      setRestoreResult(data as CmsBackupRestoreResult);
      setIsConfirmModalOpen(false);
    } catch (err: any) {
      setRestoreError(err.message || 'Error restoring backup.');
    } finally {
      setIsRestoring(false);
    }
  };

  const toggleSection = (sectionKey: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [sectionKey]: !prev[sectionKey],
    }));
  };

  const resetRestore = () => {
    setSelectedFile(null);
    setFileContent(null);
    setPreviewResult(null);
    setPreviewError(null);
    setRestoreResult(null);
    setRestoreError(null);
    setIsConfirmedCheckbox(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-[#0F112E] flex items-center gap-2.5">
          <Archive className="w-6 h-6 text-[#7C3AED]" />
          CMS Backup & Restore
        </h1>
        <p className="text-xs sm:text-sm text-[#5E6488] mt-0.5">
          Export versioned snapshots of your CMS content and safely restore them with validation preview, dependency ordering, and atomic transactions.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[#E4E2F0]">
        <button
          onClick={() => setActiveTab('export')}
          className={`flex items-center gap-2 px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'export'
              ? 'border-[#7C3AED] text-[#7C3AED]'
              : 'border-transparent text-[#5E6488] hover:text-[#0F112E] hover:border-[#E4E2F0]'
          }`}
        >
          <Download className="w-4 h-4" />
          Export CMS Content
        </button>
        <button
          onClick={() => setActiveTab('restore')}
          className={`flex items-center gap-2 px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'restore'
              ? 'border-[#7C3AED] text-[#7C3AED]'
              : 'border-transparent text-[#5E6488] hover:text-[#0F112E] hover:border-[#E4E2F0]'
          }`}
        >
          <Upload className="w-4 h-4" />
          Restore from Backup
        </button>
      </div>

      {/* TAB 1: EXPORT */}
      {activeTab === 'export' && (
        <div className="space-y-6">
          {exportError && (
            <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm flex items-start gap-2.5">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-red-600" />
              <div>
                <p className="font-semibold">Export Failed</p>
                <p className="text-xs mt-0.5">{exportError}</p>
              </div>
            </div>
          )}

          <div className="bg-white rounded-xl border border-[#E4E2F0] shadow-xs p-6 space-y-6">
            <div>
              <h2 className="text-base font-semibold text-[#0F112E]">Export CMS Snapshot</h2>
              <p className="text-xs text-[#5E6488] mt-1">
                Download a complete, portable JSON snapshot of all published and draft CMS content.
              </p>
            </div>

            {/* Scope Information Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-lg bg-[#F4F3FA] border border-[#E4E2F0] space-y-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  What Is Included
                </div>
                <ul className="text-xs text-[#475569] space-y-1 list-disc list-inside">
                  <li>Homepage and standard CMS pages</li>
                  <li>All blocks (Container, Custom HTML, Rich Text, CTA, etc.)</li>
                  <li>Tool customized content (How-To steps, FAQs, features)</li>
                  <li>Blog articles, categories, and tags</li>
                  <li>Global site settings, Header navigation, and Footer settings</li>
                  <li>Media library references (metadata & safe URLs)</li>
                </ul>
              </div>

              <div className="p-4 rounded-lg bg-[#F4F3FA] border border-[#E4E2F0] space-y-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-amber-700">
                  <ShieldAlert className="w-4 h-4 text-amber-600" />
                  What Is Strictly Excluded
                </div>
                <ul className="text-xs text-[#475569] space-y-1 list-disc list-inside">
                  <li>Admin user accounts, emails, and names</li>
                  <li>Passwords, password hashes, and reset tokens</li>
                  <li>Active login sessions and JWT secrets</li>
                  <li>System audit logs and operational history</li>
                  <li>Raw binary media files (only metadata URLs are included)</li>
                </ul>
              </div>
            </div>

            <div className="pt-2">
              <button
                onClick={handleExport}
                disabled={isExporting}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#7C3AED] text-white text-sm font-medium hover:bg-[#6D28D9] disabled:opacity-50 transition-colors shadow-xs"
              >
                {isExporting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Generating Snapshot...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    Export CMS Backup (.json)
                  </>
                )}
              </button>
              <p className="text-[11px] text-[#94A3B8] mt-2">
                Format: <code className="font-mono text-[#475569]">convert24-cms-backup (v1)</code>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: RESTORE */}
      {activeTab === 'restore' && (
        <div className="space-y-6">
          {/* File Upload Box */}
          <div className="bg-white rounded-xl border border-[#E4E2F0] shadow-xs p-6 space-y-4">
            <h2 className="text-base font-semibold text-[#0F112E]">Select Backup File</h2>
            <p className="text-xs text-[#5E6488]">
              Upload a previously exported Convert24 CMS backup JSON file (maximum 10MB).
            </p>

            <div className="flex items-center gap-4">
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                onChange={handleFileChange}
                className="text-xs text-[#475569] file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-[#F4F0FD] file:text-[#7C3AED] hover:file:bg-[#D5EFEA] file:cursor-pointer"
              />
              {selectedFile && (
                <button
                  onClick={resetRestore}
                  className="text-xs text-[#5E6488] hover:text-[#0F112E] underline"
                >
                  Clear
                </button>
              )}
            </div>

            {selectedFile && (
              <div className="text-xs text-[#5E6488] pt-1">
                Selected: <span className="font-medium text-[#0F112E]">{selectedFile.name}</span> ({(selectedFile.size / 1024).toFixed(1)} KB)
              </div>
            )}
          </div>

          {/* Loading Preview */}
          {isPreviewLoading && (
            <div className="p-8 rounded-xl bg-white border border-[#E4E2F0] flex flex-col items-center justify-center space-y-2">
              <Loader2 className="w-6 h-6 animate-spin text-[#7C3AED]" />
              <p className="text-xs font-medium text-[#475569]">Validating backup and computing planned actions...</p>
            </div>
          )}

          {/* Preview Error */}
          {previewError && (
            <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm flex items-start gap-2.5">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-red-600" />
              <div>
                <p className="font-semibold">Validation Error</p>
                <p className="text-xs mt-0.5">{previewError}</p>
              </div>
            </div>
          )}

          {/* Restore Success Result */}
          {restoreResult && (
            <div className="p-6 rounded-xl bg-emerald-50 border border-emerald-200 space-y-4">
              <div className="flex items-center gap-2.5 text-emerald-800 font-semibold text-base">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                CMS Content Restored Successfully
              </div>
              <p className="text-xs text-emerald-700">
                Completed in {restoreResult.durationMs}ms within an atomic database transaction.
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                <div className="p-3 rounded-lg bg-white border border-emerald-200">
                  <span className="text-[11px] text-[#5E6488] block">Pages</span>
                  <span className="text-sm font-semibold text-[#0F112E]">
                    +{restoreResult.restored.pages.created} / ~{restoreResult.restored.pages.updated}
                  </span>
                </div>
                <div className="p-3 rounded-lg bg-white border border-emerald-200">
                  <span className="text-[11px] text-[#5E6488] block">Tools</span>
                  <span className="text-sm font-semibold text-[#0F112E]">
                    +{restoreResult.restored.toolContent.created} / ~{restoreResult.restored.toolContent.updated}
                  </span>
                </div>
                <div className="p-3 rounded-lg bg-white border border-emerald-200">
                  <span className="text-[11px] text-[#5E6488] block">Blog Posts</span>
                  <span className="text-sm font-semibold text-[#0F112E]">
                    +{restoreResult.restored.blogPosts.created} / ~{restoreResult.restored.blogPosts.updated}
                  </span>
                </div>
                <div className="p-3 rounded-lg bg-white border border-emerald-200">
                  <span className="text-[11px] text-[#5E6488] block">Media Refs</span>
                  <span className="text-sm font-semibold text-[#0F112E]">
                    +{restoreResult.restored.mediaReferences.created} / ~{restoreResult.restored.mediaReferences.updated}
                  </span>
                </div>
              </div>

              <div className="pt-2">
                <button
                  onClick={resetRestore}
                  className="px-4 py-2 rounded-lg bg-emerald-700 text-white text-xs font-medium hover:bg-emerald-800 transition-colors"
                >
                  Done / Reset
                </button>
              </div>
            </div>
          )}

          {/* Validation & Preview Report Panel */}
          {previewResult && !restoreResult && (
            <div className="bg-white rounded-xl border border-[#E4E2F0] shadow-xs p-6 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-[#E4E2F0]">
                <div>
                  <h2 className="text-base font-semibold text-[#0F112E] flex items-center gap-2">
                    Backup Preview & Planned Changes
                    {previewResult.isValid ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                        Ready to Restore
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-red-100 text-red-800">
                        Invalid (Blocked)
                      </span>
                    )}
                  </h2>
                  <p className="text-xs text-[#5E6488] mt-0.5">
                    Exported {previewResult.exportedAt ? new Date(previewResult.exportedAt).toLocaleString() : 'N/A'}
                    {previewResult.exportedBy ? ` by ${previewResult.exportedBy.name || previewResult.exportedBy.email}` : ''}
                  </p>
                </div>

                {previewResult.isValid && (
                  <button
                    onClick={() => setIsConfirmModalOpen(true)}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#7C3AED] text-white text-sm font-medium hover:bg-[#6D28D9] transition-colors shadow-xs"
                  >
                    <Upload className="w-4 h-4" />
                    Restore Content...
                  </button>
                )}
              </div>

              {/* Blocking Errors Banner */}
              {previewResult.blockingErrors.length > 0 && (
                <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs space-y-1.5">
                  <div className="flex items-center gap-2 font-semibold text-sm text-red-800">
                    <AlertCircle className="w-4 h-4 text-red-600" />
                    Restore Blocked: {previewResult.blockingErrors.length} Issue(s) Detected
                  </div>
                  <ul className="list-disc list-inside space-y-0.5 pl-1">
                    {previewResult.blockingErrors.map((err, idx) => (
                      <li key={idx}>{err}</li>
                    ))}
                  </ul>
                  <p className="text-[11px] text-red-600 pt-1">
                    To maintain database integrity, no changes can be applied while validation errors exist.
                  </p>
                </div>
              )}

              {/* Warnings Banner */}
              {previewResult.warnings.length > 0 && (
                <div className="p-3.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs space-y-1">
                  <div className="flex items-center gap-1.5 font-semibold text-amber-900">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    Non-blocking Warnings ({previewResult.warnings.length})
                  </div>
                  <ul className="list-disc list-inside space-y-0.5 pl-1 text-[11px]">
                    {previewResult.warnings.map((w, idx) => (
                      <li key={idx}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Summary Metrics Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-lg bg-[#F4F3FA] border border-[#E4E2F0]">
                  <span className="text-xs text-[#5E6488] block">Total Records</span>
                  <span className="text-lg font-bold text-[#0F112E]">{previewResult.totals.totalRecords}</span>
                </div>
                <div className="p-3.5 rounded-lg bg-emerald-50/70 border border-emerald-100">
                  <span className="text-xs text-emerald-800 block">To Create (New)</span>
                  <span className="text-lg font-bold text-emerald-700">+{previewResult.totals.toCreate}</span>
                </div>
                <div className="p-3.5 rounded-lg bg-blue-50/70 border border-blue-100">
                  <span className="text-xs text-blue-800 block">To Update (Existing)</span>
                  <span className="text-lg font-bold text-blue-700">~{previewResult.totals.toUpdate}</span>
                </div>
                <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200">
                  <span className="text-xs text-[#5E6488] block">Unchanged (To Skip)</span>
                  <span className="text-lg font-bold text-[#5E6488]">{previewResult.totals.toSkip}</span>
                </div>
              </div>

              {/* Section Breakdown & Details */}
              <div className="space-y-3 pt-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-[#5E6488]">
                  Section Breakdown
                </h3>

                {/* Section List */}
                {[
                  { key: 'pages', label: 'CMS Pages', icon: FileText, summary: previewResult.summary.pages },
                  { key: 'toolContent', label: 'Tool Content', icon: Wrench, summary: previewResult.summary.toolContent },
                  { key: 'blogPosts', label: 'Blog Posts', icon: BookOpen, summary: previewResult.summary.blogPosts },
                  { key: 'blogTaxonomy', label: 'Blog Categories & Tags', icon: BookOpen, summary: previewResult.summary.blogTaxonomy },
                  { key: 'siteSettings', label: 'Site Settings & Navigation', icon: Settings, summary: previewResult.summary.siteSettings },
                  { key: 'formatContents', label: 'Format Content Guides', icon: FileText, summary: previewResult.summary.formatContents },
                  { key: 'mediaReferences', label: 'Media References', icon: ImageIcon, summary: previewResult.summary.mediaReferences },
                ].map((section) => {
                  const Icon = section.icon;
                  const isExpanded = !!expandedSections[section.key];

                  return (
                    <div key={section.key} className="border border-[#E4E2F0] rounded-lg overflow-hidden">
                      <button
                        onClick={() => toggleSection(section.key)}
                        className="w-full flex items-center justify-between p-3.5 bg-white hover:bg-[#F4F3FA] transition-colors text-left"
                      >
                        <div className="flex items-center gap-3">
                          <Icon className="w-4 h-4 text-[#7C3AED]" />
                          <span className="text-xs font-semibold text-[#0F112E]">{section.label}</span>
                          <span className="text-[11px] text-[#94A3B8]">({section.summary.total} items)</span>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-2 text-xs">
                            {section.summary.toCreate > 0 && (
                              <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-medium text-[10px]">
                                +{section.summary.toCreate} new
                              </span>
                            )}
                            {section.summary.toUpdate > 0 && (
                              <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 font-medium text-[10px]">
                                ~{section.summary.toUpdate} update
                              </span>
                            )}
                            {section.summary.toSkip > 0 && (
                              <span className="px-1.5 py-0.5 rounded bg-slate-100 text-[#5E6488] font-medium text-[10px]">
                                {section.summary.toSkip} unchanged
                              </span>
                            )}
                          </div>
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4 text-[#94A3B8]" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-[#94A3B8]" />
                          )}
                        </div>
                      </button>

                      {isExpanded && section.summary.details.length > 0 && (
                        <div className="border-t border-[#E4E2F0] p-3 bg-[#F4F3FA] space-y-1.5 max-h-60 overflow-y-auto">
                          {section.summary.details.map((item, idx) => (
                            <div
                              key={idx}
                              className="flex items-center justify-between text-xs py-1 px-2 rounded bg-white border border-[#E4E2F0]"
                            >
                              <div className="flex items-center gap-2 truncate">
                                <span className="font-mono text-[11px] text-[#5E6488]">{item.key}</span>
                                <span className="text-[#0F112E] truncate">({item.title})</span>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                {item.reason && (
                                  <span
                                    className={`text-[10px] truncate max-w-xs ${
                                      item.status === 'error'
                                        ? 'text-red-700 font-medium'
                                        : item.status === 'warning'
                                        ? 'text-amber-700'
                                        : 'text-[#5E6488]'
                                    }`}
                                  >
                                    {item.reason}
                                  </span>
                                )}
                                <span
                                  className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                    item.status === 'error'
                                      ? 'bg-red-100 text-red-800'
                                      : item.action === 'create'
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : item.action === 'update'
                                      ? 'bg-blue-100 text-blue-800'
                                      : 'bg-slate-100 text-[#5E6488]'
                                  }`}
                                >
                                  {item.status === 'error'
                                    ? 'ERROR'
                                    : item.action === 'skip'
                                    ? 'UNCHANGED'
                                    : item.action.toUpperCase()}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* CONFIRMATION MODAL */}
      {isConfirmModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 animate-fadeIn">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 space-y-5">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0 text-amber-600">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[#0F112E]">Confirm CMS Restore</h3>
                <p className="text-xs text-[#5E6488] mt-0.5">
                  Review the consequences before updating database records.
                </p>
              </div>
            </div>

            <div className="text-xs text-[#475569] space-y-2 bg-[#F4F3FA] p-3.5 rounded-lg border border-[#E4E2F0]">
              <p>
                <strong>Non-destructive merge:</strong> Items in the database not included in this backup will be safely preserved.
              </p>
              <p>
                <strong>Atomic Transaction:</strong> If an unexpected error occurs during restore, all database updates will be completely rolled back.
              </p>
              <p>
                <strong>Overwrites:</strong> Matches will overwrite existing titles, block content, and settings with the backup snapshot.
              </p>
            </div>

            {restoreError && (
              <div className="p-3 rounded-lg bg-red-50 text-red-700 text-xs border border-red-200">
                {restoreError}
              </div>
            )}

            <label className="flex items-start gap-2.5 text-xs text-[#0F112E] cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isConfirmedCheckbox}
                onChange={(e) => setIsConfirmedCheckbox(e.target.checked)}
                className="mt-0.5 rounded border-gray-300 text-[#7C3AED] focus:ring-[#7C3AED]"
              />
              <span>
                I understand that this action will update the active CMS content and database settings.
              </span>
            </label>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsConfirmModalOpen(false)}
                disabled={isRestoring}
                className="px-4 py-2 text-xs font-medium text-[#5E6488] hover:text-[#0F112E] transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRestore}
                disabled={!isConfirmedCheckbox || isRestoring}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#7C3AED] text-white text-xs font-medium hover:bg-[#6D28D9] disabled:opacity-50 transition-colors shadow-xs"
              >
                {isRestoring ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Restoring CMS...
                  </>
                ) : (
                  'Apply Restore'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
