'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  X,
  Upload,
  Search,
  Filter,
  Check,
  Trash2,
  AlertTriangle,
  RefreshCw,
  FolderOpen,
} from 'lucide-react';
import { MediaAssetItem } from '@/lib/admin/types';
import MediaGrid from './MediaGrid';

interface MediaPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (asset: MediaAssetItem | null) => void;
  currentUrl?: string | null;
  title?: string;
}

export default function MediaPickerModal({
  isOpen,
  onClose,
  onSelect,
  currentUrl,
  title = 'Select Media Asset',
}: MediaPickerModalProps) {
  const [activeTab, setActiveTab] = useState<'browse' | 'upload'>('browse');

  // Browse state
  const [assets, setAssets] = useState<MediaAssetItem[]>([]);
  const [selectedAsset, setSelectedAsset] = useState<MediaAssetItem | null>(null);
  const [search, setSearch] = useState('');
  const [mimeFilter, setMimeFilter] = useState('ALL');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Upload state
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [altText, setAltText] = useState('');
  const [assetTitle, setAssetTitle] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const fetchAssets = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      if (mimeFilter !== 'ALL') params.set('mimeType', mimeFilter);
      params.set('page', page.toString());
      params.set('limit', '15');

      const res = await fetch(`/api/admin/media?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to load media assets.');
      const data = await res.json();
      setAssets(data.assets || []);
      setTotalPages(data.totalPages || 1);

      // If currentUrl matches an asset, auto-select it initially
      if (currentUrl && !selectedAsset) {
        const matching = (data.assets || []).find((a: MediaAssetItem) => a.url === currentUrl);
        if (matching) setSelectedAsset(matching);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error fetching media.';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [search, mimeFilter, page, currentUrl, selectedAsset]);

  useEffect(() => {
    if (isOpen) {
      fetchAssets();
    }
  }, [isOpen, fetchAssets]);

  if (!isOpen) return null;

  const handleSelectAsset = (asset: MediaAssetItem) => {
    setSelectedAsset(asset);
  };

  const handleConfirmSelection = () => {
    if (selectedAsset) {
      onSelect(selectedAsset);
      onClose();
    }
  };

  const handleClearSelection = () => {
    onSelect(null);
    onClose();
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
      if (altText.trim()) formData.append('alt', altText.trim());
      if (assetTitle.trim()) formData.append('title', assetTitle.trim());

      const res = await fetch('/api/admin/media', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to upload media file.');
      }

      const data = await res.json();
      const uploaded: MediaAssetItem = data.asset;

      // Reset upload form
      setUploadFile(null);
      setAltText('');
      setAssetTitle('');
      setIsUploading(false);

      // Select immediately and close
      onSelect(uploaded);
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error uploading media file.';
      setUploadError(msg);
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl border border-[#E4E2F0] w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-[#E4E2F0] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FolderOpen className="w-5 h-5 text-[#7C3AED]" />
            <h2 className="text-base font-bold text-[#0F172A]">{title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-[#5E6488] hover:text-[#0F172A] hover:bg-[#F4F3FA] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Tabs */}
        <div className="px-6 pt-3 border-b border-[#E4E2F0] flex items-center justify-between bg-[#F4F3FA]">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('browse')}
              className={`px-4 py-2 text-xs font-semibold rounded-t-lg transition-colors border-b-2 ${
                activeTab === 'browse'
                  ? 'border-[#7C3AED] text-[#7C3AED] bg-white'
                  : 'border-transparent text-[#5E6488] hover:text-[#0F172A]'
              }`}
            >
              Browse Library
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('upload')}
              className={`px-4 py-2 text-xs font-semibold rounded-t-lg transition-colors border-b-2 ${
                activeTab === 'upload'
                  ? 'border-[#7C3AED] text-[#7C3AED] bg-white'
                  : 'border-transparent text-[#5E6488] hover:text-[#0F172A]'
              }`}
            >
              Upload New
            </button>
          </div>

          {currentUrl && (
            <button
              type="button"
              onClick={handleClearSelection}
              className="inline-flex items-center gap-1 text-xs text-[#DC2626] hover:underline pb-2 font-medium"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Remove Current Image</span>
            </button>
          )}
        </div>

        {/* Modal Body */}
        <div className="p-6 flex-1 overflow-y-auto">
          {activeTab === 'browse' && (
            <div className="space-y-4">
              {/* Search & Filter Bar */}
              <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-[#94A3B8] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search by filename or title..."
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setPage(1);
                    }}
                    className="w-full pl-9 pr-4 py-1.5 border border-[#E4E2F0] rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#7C3AED]"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <select
                    value={mimeFilter}
                    onChange={(e) => {
                      setMimeFilter(e.target.value);
                      setPage(1);
                    }}
                    className="py-1.5 px-2.5 border border-[#E4E2F0] rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[#7C3AED]"
                  >
                    <option value="ALL">All Formats</option>
                    <option value="image/jpeg">JPEG</option>
                    <option value="image/png">PNG</option>
                    <option value="image/webp">WebP</option>
                    <option value="image/gif">GIF</option>
                    <option value="image/svg+xml">SVG</option>
                  </select>

                  <button
                    type="button"
                    onClick={() => fetchAssets()}
                    className="p-1.5 rounded-lg border border-[#E4E2F0] text-[#475569] hover:bg-[#F4F3FA]"
                    title="Refresh"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </div>

              {error && (
                <div className="p-3 bg-red-50 text-red-700 text-xs rounded-lg flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Grid */}
              <MediaGrid
                assets={assets}
                selectedId={selectedAsset?.id}
                onSelect={handleSelectAsset}
                isLoading={isLoading}
              />

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-4 border-t border-[#E4E2F0] text-xs text-[#5E6488]">
                  <span>
                    Page {page} of {totalPages}
                  </span>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      className="px-2.5 py-1 border border-[#E4E2F0] rounded-md disabled:opacity-40 hover:bg-[#F4F3FA]"
                    >
                      Previous
                    </button>
                    <button
                      type="button"
                      disabled={page >= totalPages}
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      className="px-2.5 py-1 border border-[#E4E2F0] rounded-md disabled:opacity-40 hover:bg-[#F4F3FA]"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'upload' && (
            <form onSubmit={handleUploadSubmit} className="space-y-4 max-w-xl mx-auto py-4">
              {uploadError && (
                <div className="p-3 bg-red-50 text-red-700 text-xs rounded-lg flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{uploadError}</span>
                </div>
              )}

              {/* Dropzone */}
              <div
                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                  uploadFile
                    ? 'border-[#7C3AED] bg-[#F4F0FD]'
                    : 'border-[#E4E2F0] hover:border-[#7C3AED] bg-[#F4F3FA]'
                }`}
                onClick={() => document.getElementById('modal-file-input')?.click()}
              >
                <input
                  id="modal-file-input"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) {
                      setUploadFile(f);
                      if (!assetTitle) setAssetTitle(f.name.replace(/\.[^/.]+$/, ''));
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
                      Click to browse or drop an image here
                    </p>
                    <p className="text-[11px] text-[#5E6488] mt-1">
                      JPEG, PNG, WebP, GIF, or SVG (max 10 MB)
                    </p>
                  </div>
                )}
              </div>

              {/* Title & Alt inputs */}
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-[#475569] mb-1">
                    Image Title (Optional)
                  </label>
                  <input
                    type="text"
                    value={assetTitle}
                    onChange={(e) => setAssetTitle(e.target.value)}
                    placeholder="e.g. Compression Diagram"
                    className="w-full px-3 py-1.5 border border-[#E4E2F0] rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#7C3AED]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#475569] mb-1">
                    Alt Text (Accessibility)
                  </label>
                  <input
                    type="text"
                    value={altText}
                    onChange={(e) => setAltText(e.target.value)}
                    placeholder="e.g. Visual graph comparing WebP and PNG file sizes"
                    className="w-full px-3 py-1.5 border border-[#E4E2F0] rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#7C3AED]"
                  />
                </div>
              </div>

              <div className="pt-3">
                <button
                  type="submit"
                  disabled={!uploadFile || isUploading}
                  className="w-full py-2.5 px-4 bg-[#7C3AED] hover:bg-[#6D28D9] disabled:opacity-50 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 shadow-sm"
                >
                  {isUploading ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Uploading Asset...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-3.5 h-3.5" />
                      <span>Upload & Select</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Modal Footer */}
        {activeTab === 'browse' && (
          <div className="px-6 py-3.5 border-t border-[#E4E2F0] bg-[#F4F3FA] flex items-center justify-between">
            <div className="text-xs text-[#5E6488]">
              {selectedAsset ? (
                <span>
                  Selected: <strong>{selectedAsset.title || selectedAsset.filename}</strong>
                </span>
              ) : (
                <span>Select an image to use</span>
              )}
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-1.5 border border-[#E4E2F0] rounded-lg text-xs font-medium text-[#475569] hover:bg-white"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!selectedAsset}
                onClick={handleConfirmSelection}
                className="px-4 py-1.5 bg-[#7C3AED] hover:bg-[#6D28D9] disabled:opacity-40 text-white rounded-lg text-xs font-semibold flex items-center gap-1 shadow-sm"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Use Selected Asset</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
