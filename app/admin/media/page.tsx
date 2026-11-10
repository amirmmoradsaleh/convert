'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  ImageIcon,
  Upload,
  Search,
  Filter,
  RefreshCw,
  Trash2,
  Save,
  Copy,
  Check,
  X,
  ExternalLink,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  FileText,
  User,
} from 'lucide-react';
import { MediaAssetItem } from '@/lib/admin/types';
import MediaGrid, { formatFileSize, getMimeBadgeColor, getMimeShortLabel } from '@/components/admin/media/MediaGrid';

export default function AdminMediaPage() {
  const [assets, setAssets] = useState<MediaAssetItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [mimeFilter, setMimeFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState<'createdAt' | 'size' | 'filename'>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Upload modal / area state
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadAlt, setUploadAlt] = useState('');
  const [uploadTitle, setUploadTitle] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Asset detail modal state
  const [selectedAsset, setSelectedAsset] = useState<MediaAssetItem | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editAlt, setEditAlt] = useState('');
  const [editCaption, setEditCaption] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [copiedUrl, setCopiedUrl] = useState(false);

  const fetchAssets = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      if (mimeFilter !== 'ALL') params.set('mimeType', mimeFilter);
      params.set('page', page.toString());
      params.set('limit', '20');
      params.set('sortBy', sortBy);
      params.set('sortOrder', sortOrder);

      const res = await fetch(`/api/admin/media?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to load media assets.');
      const data = await res.json();
      setAssets(data.assets || []);
      setTotalPages(data.totalPages || 1);
      setTotalCount(data.total || 0);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error fetching media.';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [search, mimeFilter, page, sortBy, sortOrder]);

  useEffect(() => {
    fetchAssets();
  }, [fetchAssets]);

  const handleOpenDetail = (asset: MediaAssetItem) => {
    setSelectedAsset(asset);
    setEditTitle(asset.title || '');
    setEditAlt(asset.alt || '');
    setEditCaption(asset.caption || '');
    setEditDescription(asset.description || '');
    setDetailError(null);
    setCopiedUrl(false);
  };

  const handleSaveMetadata = async () => {
    if (!selectedAsset) return;
    setIsSaving(true);
    setDetailError(null);
    try {
      const res = await fetch(`/api/admin/media/${selectedAsset.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editTitle,
          alt: editAlt,
          caption: editCaption,
          description: editDescription,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to update metadata.');
      }

      const data = await res.json();
      setSelectedAsset(data.asset);
      setSuccessMsg('Asset metadata saved successfully.');
      fetchAssets();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error saving metadata.';
      setDetailError(msg);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteAsset = async () => {
    if (!selectedAsset) return;
    if (!window.confirm(`Are you sure you want to permanently delete "${selectedAsset.filename}"?`)) {
      return;
    }

    setIsDeleting(true);
    setDetailError(null);

    try {
      const res = await fetch(`/api/admin/media/${selectedAsset.id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to delete asset.');
      }

      setSuccessMsg(`Asset "${selectedAsset.filename}" deleted.`);
      setSelectedAsset(null);
      fetchAssets();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error deleting asset.';
      setDetailError(msg);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile) {
      setUploadError('Please select a file to upload.');
      return;
    }

    setIsUploading(true);
    setUploadError(null);

    try {
      const formData = new FormData();
      formData.append('file', uploadFile);
      if (uploadAlt.trim()) formData.append('alt', uploadAlt.trim());
      if (uploadTitle.trim()) formData.append('title', uploadTitle.trim());

      const res = await fetch('/api/admin/media', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to upload media file.');
      }

      setSuccessMsg('Asset uploaded successfully.');
      setIsUploadOpen(false);
      setUploadFile(null);
      setUploadAlt('');
      setUploadTitle('');
      fetchAssets();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error uploading media file.';
      setUploadError(msg);
    } finally {
      setIsUploading(false);
    }
  };

  const handleCopyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-[#0F172A]">Media Library</h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-[#F4F3FA] text-[#475569] border border-[#E4E2F0]">
              {totalCount} Assets
            </span>
          </div>
          <p className="text-sm text-[#5E6488] mt-1">
            Upload, organize, and manage image assets for Page CMS, Tool CMS, and Blog articles.
          </p>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
          <button
            type="button"
            onClick={() => fetchAssets()}
            className="p-2.5 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg border border-[#E4E2F0] bg-white text-[#475569] hover:bg-[#F4F3FA] transition-colors"
            title="Refresh assets"
            aria-label="Refresh media list"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <button
            type="button"
            onClick={() => setIsUploadOpen(true)}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 min-h-[44px] rounded-lg bg-[#7C3AED] text-white text-sm font-medium hover:bg-[#6D28D9] shadow-xs transition-colors flex-1 sm:flex-initial"
          >
            <Upload className="w-4 h-4" />
            <span>Upload Asset</span>
          </button>
        </div>
      </div>

      {/* Global Alerts */}
      {successMsg && (
        <div className="p-4 rounded-lg bg-[#F0FDF4] border border-[#BBF7D0] text-[#166534] text-sm flex items-center justify-between animate-fadeIn">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessMsg(null)}
            className="text-[#166534] hover:opacity-75"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-lg bg-[#FEF2F2] border border-[#FECACA] text-[#991B1B] text-sm flex items-center justify-between animate-fadeIn">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-[#991B1B] hover:opacity-75"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Filters & Search Row */}
      <div className="p-4 bg-white border border-[#E4E2F0] rounded-xl shadow-xs flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-[#94A3B8] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search assets by filename, title, or alt text..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full pl-9 pr-4 py-2.5 min-h-[44px] border border-[#E4E2F0] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#7C3AED]"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 w-full md:w-auto">
          {/* MIME Filter */}
          <div className="flex items-center gap-1.5 text-xs text-[#5E6488] flex-1 sm:flex-initial min-w-[130px]">
            <Filter className="w-3.5 h-3.5 shrink-0" />
            <span className="shrink-0">Format:</span>
            <select
              value={mimeFilter}
              onChange={(e) => {
                setMimeFilter(e.target.value);
                setPage(1);
              }}
              className="w-full sm:w-auto py-2 px-2.5 min-h-[40px] border border-[#E4E2F0] rounded-lg text-xs font-medium text-[#1E293B] bg-white focus:outline-none focus:ring-2 focus:ring-[#7C3AED]"
            >
              <option value="ALL">All Formats</option>
              <option value="image/jpeg">JPEG (.jpg)</option>
              <option value="image/png">PNG (.png)</option>
              <option value="image/webp">WebP (.webp)</option>
              <option value="image/gif">GIF (.gif)</option>
              <option value="image/svg+xml">SVG (.svg)</option>
            </select>
          </div>

          {/* Sort Order */}
          <div className="flex items-center gap-1.5 text-xs text-[#5E6488] flex-1 sm:flex-initial min-w-[130px]">
            <span className="shrink-0">Sort:</span>
            <select
              value={`${sortBy}-${sortOrder}`}
              onChange={(e) => {
                const [sb, so] = e.target.value.split('-');
                setSortBy(sb as any);
                setSortOrder(so as any);
                setPage(1);
              }}
              className="w-full sm:w-auto py-2 px-2.5 min-h-[40px] border border-[#E4E2F0] rounded-lg text-xs font-medium text-[#1E293B] bg-white focus:outline-none focus:ring-2 focus:ring-[#7C3AED]"
            >
              <option value="createdAt-desc">Newest First</option>
              <option value="createdAt-asc">Oldest First</option>
              <option value="size-desc">Largest Size</option>
              <option value="size-asc">Smallest Size</option>
              <option value="filename-asc">Filename A-Z</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Grid View */}
      <div className="bg-white border border-[#E4E2F0] rounded-xl shadow-xs p-5">
        <MediaGrid
          assets={assets}
          onSelect={handleOpenDetail}
          onViewDetails={handleOpenDetail}
          isLoading={isLoading}
        />

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-6 mt-6 border-t border-[#E4E2F0] text-xs text-[#5E6488]">
            <span>
              Showing page {page} of {totalPages} ({totalCount} total assets)
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1.5 border border-[#E4E2F0] rounded-lg disabled:opacity-40 hover:bg-[#F4F3FA] font-medium"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="px-3 py-1.5 border border-[#E4E2F0] rounded-lg disabled:opacity-40 hover:bg-[#F4F3FA] font-medium"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Upload Modal */}
      {isUploadOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl border border-[#E4E2F0] w-full max-w-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-[#E4E2F0] flex items-center justify-between">
              <h2 className="text-base font-bold text-[#0F172A]">Upload Media Asset</h2>
              <button
                type="button"
                onClick={() => setIsUploadOpen(false)}
                className="p-1 rounded-lg text-[#5E6488] hover:text-[#0F172A] hover:bg-[#F4F3FA]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUploadSubmit} className="p-6 space-y-4">
              {uploadError && (
                <div className="p-3 bg-red-50 text-red-700 text-xs rounded-lg flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{uploadError}</span>
                </div>
              )}

              {/* Drag/Drop Zone */}
              <div
                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                  uploadFile
                    ? 'border-[#7C3AED] bg-[#F4F0FD]'
                    : 'border-[#E4E2F0] hover:border-[#7C3AED] bg-[#F4F3FA]'
                }`}
                onClick={() => document.getElementById('admin-file-picker')?.click()}
              >
                <input
                  id="admin-file-picker"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) {
                      setUploadFile(f);
                      if (!uploadTitle) setUploadTitle(f.name.replace(/\.[^/.]+$/, ''));
                    }
                  }}
                  className="hidden"
                />

                <Upload className="w-8 h-8 text-[#7C3AED] mx-auto mb-2" />
                {uploadFile ? (
                  <div>
                    <p className="text-xs font-bold text-[#0F172A]">{uploadFile.name}</p>
                    <p className="text-[11px] text-[#5E6488] mt-0.5">
                      {(uploadFile.size / 1024).toFixed(1)} KB • Click to change file
                    </p>
                  </div>
                ) : (
                  <div>
                    <p className="text-xs font-semibold text-[#0F172A]">
                      Click to browse or drag and drop an image
                    </p>
                    <p className="text-[11px] text-[#5E6488] mt-1">
                      JPEG, PNG, WebP, GIF, or SVG (max 10 MB)
                    </p>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#475569] mb-1">
                  Title (Optional)
                </label>
                <input
                  type="text"
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  placeholder="e.g. Hero Banner 2026"
                  className="w-full px-3 py-2 border border-[#E4E2F0] rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#7C3AED]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#475569] mb-1">
                  Alt Text (Accessibility)
                </label>
                <input
                  type="text"
                  value={uploadAlt}
                  onChange={(e) => setUploadAlt(e.target.value)}
                  placeholder="e.g. Diagram explaining lossy compression"
                  className="w-full px-3 py-2 border border-[#E4E2F0] rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#7C3AED]"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsUploadOpen(false)}
                  className="flex-1 py-2 px-4 border border-[#E4E2F0] rounded-lg text-xs font-medium text-[#475569] hover:bg-[#F4F3FA]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!uploadFile || isUploading}
                  className="flex-1 py-2 px-4 bg-[#7C3AED] hover:bg-[#6D28D9] disabled:opacity-50 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 shadow-sm"
                >
                  {isUploading ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Uploading...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-3.5 h-3.5" />
                      <span>Confirm Upload</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Asset Detail Drawer / Modal */}
      {selectedAsset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl border border-[#E4E2F0] w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 border-b border-[#E4E2F0] flex items-center justify-between">
              <h2 className="text-base font-bold text-[#0F172A] truncate max-w-md">
                {selectedAsset.title || selectedAsset.filename}
              </h2>
              <button
                type="button"
                onClick={() => setSelectedAsset(null)}
                className="p-1 rounded-lg text-[#5E6488] hover:text-[#0F172A] hover:bg-[#F4F3FA]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content Body */}
            <div className="p-6 flex-1 overflow-y-auto space-y-5">
              {detailError && (
                <div className="p-3.5 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span className="leading-relaxed">{detailError}</span>
                </div>
              )}

              {/* Preview Box */}
              <div className="bg-[#F4F3FA] border border-[#E4E2F0] rounded-xl p-4 flex flex-col items-center justify-center max-h-64 overflow-hidden relative">
                <img
                  src={selectedAsset.url}
                  alt={selectedAsset.alt || selectedAsset.title || selectedAsset.filename}
                  className="max-h-56 max-w-full object-contain"
                />
                <a
                  href={selectedAsset.url}
                  target="_blank"
                  rel="noreferrer"
                  className="absolute top-3 right-3 p-1.5 bg-black/60 hover:bg-black text-white rounded-md text-xs inline-flex items-center gap-1 shadow-sm"
                  title="Open full size in new tab"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>

              {/* File Specs Bar */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div className="p-2.5 rounded-lg bg-[#F4F3FA] border border-[#E4E2F0]">
                  <span className="text-[#5E6488] block text-[10px] uppercase font-bold">Format</span>
                  <span className="font-semibold text-[#1E293B]">
                    {getMimeShortLabel(selectedAsset.mimeType)}
                  </span>
                </div>
                <div className="p-2.5 rounded-lg bg-[#F4F3FA] border border-[#E4E2F0]">
                  <span className="text-[#5E6488] block text-[10px] uppercase font-bold">Dimensions</span>
                  <span className="font-semibold text-[#1E293B]">
                    {selectedAsset.width && selectedAsset.height
                      ? `${selectedAsset.width} × ${selectedAsset.height}`
                      : 'Vector / Scalable'}
                  </span>
                </div>
                <div className="p-2.5 rounded-lg bg-[#F4F3FA] border border-[#E4E2F0]">
                  <span className="text-[#5E6488] block text-[10px] uppercase font-bold">File Size</span>
                  <span className="font-semibold text-[#1E293B]">
                    {formatFileSize(selectedAsset.size)}
                  </span>
                </div>
                <div className="p-2.5 rounded-lg bg-[#F4F3FA] border border-[#E4E2F0]">
                  <span className="text-[#5E6488] block text-[10px] uppercase font-bold">Uploaded</span>
                  <span className="font-semibold text-[#1E293B]">
                    {new Date(selectedAsset.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>

              {/* Public URL Box */}
              <div>
                <label className="block text-xs font-semibold text-[#475569] mb-1">
                  Public Asset URL
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={selectedAsset.url}
                    className="flex-1 px-3 py-1.5 border border-[#E4E2F0] rounded-lg text-xs font-mono bg-[#F4F3FA] text-[#334155] focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => handleCopyUrl(selectedAsset.url)}
                    className="px-3 py-1.5 border border-[#E4E2F0] rounded-lg text-xs font-medium text-[#475569] hover:bg-[#F4F3FA] flex items-center gap-1 shrink-0"
                  >
                    {copiedUrl ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="text-emerald-600">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy URL</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Editable Metadata Form */}
              <div className="space-y-3 pt-2 border-t border-[#E4E2F0]">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#475569]">
                  Metadata & SEO Settings
                </h3>

                <div>
                  <label className="block text-xs font-medium text-[#475569] mb-1">
                    Display Title
                  </label>
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    placeholder="e.g. Lossless vs Lossy Chart"
                    className="w-full px-3 py-1.5 border border-[#E4E2F0] rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#7C3AED]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#475569] mb-1">
                    Alt Text (Accessibility & Screen Readers)
                  </label>
                  <input
                    type="text"
                    value={editAlt}
                    onChange={(e) => setEditAlt(e.target.value)}
                    placeholder="e.g. Detailed bar chart comparing image format compression ratios"
                    className="w-full px-3 py-1.5 border border-[#E4E2F0] rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#7C3AED]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#475569] mb-1">
                    Caption (Optional)
                  </label>
                  <input
                    type="text"
                    value={editCaption}
                    onChange={(e) => setEditCaption(e.target.value)}
                    placeholder="e.g. Source: WebP format specification tests"
                    className="w-full px-3 py-1.5 border border-[#E4E2F0] rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#7C3AED]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#475569] mb-1">
                    Description (Internal Notes)
                  </label>
                  <textarea
                    rows={2}
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    placeholder="Internal reference notes..."
                    className="w-full px-3 py-1.5 border border-[#E4E2F0] rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#7C3AED]"
                  />
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3.5 border-t border-[#E4E2F0] bg-[#F4F3FA] flex items-center justify-between">
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleDeleteAsset}
                className="px-3.5 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isDeleting ? 'Deleting...' : 'Delete Asset'}</span>
              </button>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedAsset(null)}
                  className="px-4 py-1.5 border border-[#E4E2F0] rounded-lg text-xs font-medium text-[#475569] hover:bg-white"
                >
                  Close
                </button>
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={handleSaveMetadata}
                  className="px-4 py-1.5 bg-[#7C3AED] hover:bg-[#6D28D9] disabled:opacity-50 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{isSaving ? 'Saving...' : 'Save Changes'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
