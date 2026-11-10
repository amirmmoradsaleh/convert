'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  UploadCloud,
  AlertCircle,
  Trash2,
  Download,
  Archive,
  Plus,
  RefreshCw,
  Sliders,
  Maximize2,
} from 'lucide-react';
import { formatBytes, triggerBlobDownload, createZipBlob } from '@/engines/shared/file-utils';
import { resizeImage, ImageResizeOptions, ResizeImageResult } from '@/engines/image/resize';
import type { WorkerProgressStage } from '@/engines/image/worker/worker-types';
import ProgressBar from './ProgressBar';

export interface ResizeFileItem {
  id: string;
  file: File;
  previewUrl?: string;
  originalWidth: number;
  originalHeight: number;
  targetWidth: number;
  targetHeight: number;
  status: 'pending' | 'validating' | 'processing' | 'completed' | 'failed';
  stage?: WorkerProgressStage;
  progress: number;
  errorMessage?: string;
  resultBlob?: Blob;
  resultUrl?: string;
  resultFileName?: string;
  originalSize?: number;
  convertedSize?: number;
  format?: 'jpg' | 'png' | 'webp';
  width?: number;
  height?: number;
}

const STAGE_LABELS: Record<WorkerProgressStage, string> = {
  validating: 'Validating image...',
  reading: 'Reading file data...',
  decoding: 'Decoding image...',
  encoding: 'Resizing & encoding...',
  finalizing: 'Finalizing...',
};

const MAX_BATCH_FILES = 20;

export function ResizeImageController() {
  const [isHydrated, setIsHydrated] = useState(false);
  const [files, setFiles] = useState<ResizeFileItem[]>([]);
  
  // Resize global options
  const [targetWidth, setTargetWidth] = useState<number>(800);
  const [targetHeight, setTargetHeight] = useState<number>(600);
  const [maintainAspectRatio, setMaintainAspectRatio] = useState<boolean>(true);
  const [outputFormat, setOutputFormat] = useState<'original' | 'jpg' | 'png' | 'webp'>('original');
  const [quality, setQuality] = useState<number>(0.9); // 0.7, 0.8, 0.9

  const [isResizing, setIsResizing] = useState(false);
  const [isZipping, setIsZipping] = useState(false);
  const [globalMessage, setGlobalMessage] = useState<{ type: 'error' | 'info'; text: string } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const addMoreInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  // Clean up object URLs on unmount
  useEffect(() => {
    return () => {
      files.forEach((item) => {
        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
        if (item.resultUrl) URL.revokeObjectURL(item.resultUrl);
      });
    };
  }, [files]);

  const loadImageDimensions = async (file: File): Promise<{ width: number; height: number }> => {
    return new Promise((resolve) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const w = img.naturalWidth || img.width || 800;
        const h = img.naturalHeight || img.height || 600;
        URL.revokeObjectURL(url);
        resolve({ width: w, height: h });
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve({ width: 800, height: 600 });
      };
      img.src = url;
    });
  };

  const handleFilesAdded = useCallback(
    async (incomingFiles: File[]) => {
      setGlobalMessage(null);
      if (incomingFiles.length === 0) return;

      const currentCount = files.length;
      if (currentCount + incomingFiles.length > MAX_BATCH_FILES) {
        setGlobalMessage({
          type: 'error',
          text: `You can resize up to ${MAX_BATCH_FILES} files at a time.`,
        });
      }

      const allowedIncoming = incomingFiles.slice(
        0,
        Math.max(0, MAX_BATCH_FILES - currentCount)
      );

      const newItems: ResizeFileItem[] = [];

      for (const file of allowedIncoming) {
        const id = `${file.name}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
        const previewUrl = URL.createObjectURL(file);
        const dims = await loadImageDimensions(file);

        // Calculate initial target dimensions (default to original dimensions or 800 max)
        const initW = dims.width;
        const initH = dims.height;

        newItems.push({
          id,
          file,
          previewUrl,
          originalWidth: dims.width,
          originalHeight: dims.height,
          targetWidth: initW,
          targetHeight: initH,
          status: 'pending',
          progress: 0,
        });
      }

      setFiles((prev) => {
        const updated = [...prev, ...newItems];
        // If this is the first file added, initialize global targetWidth and targetHeight to its dimensions
        if (prev.length === 0 && newItems.length > 0) {
          setTargetWidth(newItems[0].originalWidth);
          setTargetHeight(newItems[0].originalHeight);
        }
        return updated;
      });
    },
    [files.length]
  );

  const handleWidthChange = (val: number) => {
    const w = Math.max(1, Math.min(8192, Math.round(val || 1)));
    setTargetWidth(w);
    if (maintainAspectRatio && files.length > 0) {
      // Base aspect ratio on the first file or global ratio
      const first = files[0];
      if (first.originalWidth > 0 && first.originalHeight > 0) {
        const ratio = first.originalHeight / first.originalWidth;
        const h = Math.max(1, Math.min(8192, Math.round(w * ratio)));
        setTargetHeight(h);
      }
    }
  };

  const handleHeightChange = (val: number) => {
    const h = Math.max(1, Math.min(8192, Math.round(val || 1)));
    setTargetHeight(h);
    if (maintainAspectRatio && files.length > 0) {
      const first = files[0];
      if (first.originalWidth > 0 && first.originalHeight > 0) {
        const ratio = first.originalWidth / first.originalHeight;
        const w = Math.max(1, Math.min(8192, Math.round(h * ratio)));
        setTargetWidth(w);
      }
    }
  };

  const handleRemoveFile = (id: string) => {
    setFiles((prev) => {
      const target = prev.find((f) => f.id === id);
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      if (target?.resultUrl) URL.revokeObjectURL(target.resultUrl);
      return prev.filter((f) => f.id !== id);
    });
  };

  const handleClearAll = () => {
    files.forEach((item) => {
      if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
      if (item.resultUrl) URL.revokeObjectURL(item.resultUrl);
    });
    setFiles([]);
    setGlobalMessage(null);
  };

  const handleRunResize = async () => {
    if (files.length === 0 || isResizing) return;
    setIsResizing(true);
    setGlobalMessage(null);

    const pendingOrFailed = files.filter(
      (f) => f.status === 'pending' || f.status === 'failed' || f.status === 'completed'
    );

    for (const item of pendingOrFailed) {
      // Update item status to validating
      setFiles((prev) =>
        prev.map((f) =>
          f.id === item.id
            ? { ...f, status: 'validating', progress: 10, stage: 'validating', errorMessage: undefined }
            : f
        )
      );

      try {
        // Calculate file-specific dimensions if aspect ratio maintained
        const w = targetWidth;
        let h = targetHeight;
        if (maintainAspectRatio && item.originalWidth > 0 && item.originalHeight > 0) {
          const ratio = item.originalHeight / item.originalWidth;
          h = Math.max(1, Math.min(8192, Math.round(w * ratio)));
        }

        const options: ImageResizeOptions = {
          width: w,
          height: h,
          outputFormat,
          quality,
        };

        const result: ResizeImageResult = await resizeImage(
          item.file,
          options,
          (progress, stage) => {
            setFiles((prev) =>
              prev.map((f) =>
                f.id === item.id
                  ? {
                      ...f,
                      status: 'processing',
                      progress,
                      stage: stage || 'encoding',
                    }
                  : f
              )
            );
          }
        );

        const resultUrl = URL.createObjectURL(result.blob);

        setFiles((prev) =>
          prev.map((f) =>
            f.id === item.id
              ? {
                  ...f,
                  status: 'completed',
                  progress: 100,
                  resultBlob: result.blob,
                  resultUrl,
                  resultFileName: result.fileName,
                  originalSize: result.originalSize,
                  convertedSize: result.convertedSize,
                  format: result.format,
                  width: result.width,
                  height: result.height,
                }
              : f
          )
        );
      } catch (err: unknown) {
        const errorMsg =
          err instanceof Error
            ? err.message
            : "We couldn't resize this image. Please try again.";
        setFiles((prev) =>
          prev.map((f) =>
            f.id === item.id
              ? {
                  ...f,
                  status: 'failed',
                  progress: 0,
                  errorMessage: errorMsg,
                }
              : f
          )
        );
      }
    }

    setIsResizing(false);
  };

  const handleDownloadSingle = (item: ResizeFileItem) => {
    if (!item.resultBlob || !item.resultFileName) return;
    triggerBlobDownload(item.resultBlob, item.resultFileName);
  };

  const handleDownloadAllZip = async () => {
    const completedItems = files.filter((f) => f.status === 'completed' && f.resultBlob && f.resultFileName);
    if (completedItems.length === 0) return;

    setIsZipping(true);
    try {
      const zipEntries = completedItems.map((item) => ({
        name: item.resultFileName!,
        blob: item.resultBlob!,
      }));
      const zipBlob = await createZipBlob(zipEntries);
      triggerBlobDownload(zipBlob, 'resized-images.zip');
    } catch {
      setGlobalMessage({
        type: 'error',
        text: 'Failed to create ZIP archive. Please download images individually.',
      });
    } finally {
      setIsZipping(false);
    }
  };

  const completedCount = files.filter((f) => f.status === 'completed').length;
  const hasCompletedFiles = completedCount > 0;

  if (!isHydrated) {
    return <div className="p-8 text-center text-[#5E6488]">Loading resize tool...</div>;
  }

  return (
    <div className="space-y-6">
      {globalMessage && (
        <div
          className={`p-4 rounded-xl border flex items-start gap-3 ${
            globalMessage.type === 'error'
              ? 'bg-[#FEF2F2] border-[#F87171] text-[#991B1B]'
              : 'bg-[#EFF6FF] border-[#93C5FD] text-[#1E40AF]'
          }`}
        >
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <div className="text-sm font-medium">{globalMessage.text}</div>
        </div>
      )}

      {/* Upload Zone */}
      {files.length === 0 ? (
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
              handleFilesAdded(Array.from(e.dataTransfer.files));
            }
          }}
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-[#D0D5DD] hover:border-[#7C3AED] bg-[#F4F3FA] hover:bg-[#F1F5F9] rounded-2xl p-10 md:p-14 text-center cursor-pointer transition-all group shadow-subtle"
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
            className="hidden"
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                handleFilesAdded(Array.from(e.target.files));
                e.target.value = '';
              }
            }}
          />
          <div className="w-16 h-16 bg-[#E2E8F0] group-hover:bg-[#7C3AED] text-[#7C3AED] group-hover:text-[#FFFFFF] rounded-full flex items-center justify-center mx-auto mb-4 transition-colors">
            <UploadCloud className="w-8 h-8" />
          </div>
          <h3 className="text-lg md:text-xl font-semibold text-[#0F112E] mb-2">
            Drag & drop images here, or browse
          </h3>
          <p className="text-sm text-[#5E6488] max-w-md mx-auto mb-6">
            Supports JPG, JPEG, PNG, and WebP images up to 50 MB each. Process up to 20 files at once.
          </p>
          <button
            type="button"
            className="px-6 py-3 bg-[#7C3AED] hover:bg-[#0E3A44] text-white font-medium rounded-xl shadow-sm transition-colors"
          >
            Select Images
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Global Options Panel */}
          <div className="bg-white border border-[#E4E2F0] rounded-2xl p-6 shadow-subtle space-y-6">
            <div className="flex items-center justify-between border-b border-[#E4E2F0] pb-4">
              <div className="flex items-center gap-2">
                <Sliders className="w-5 h-5 text-[#7C3AED]" />
                <h3 className="font-semibold text-lg text-[#0F112E]">Resize Settings</h3>
              </div>
              <button
                type="button"
                onClick={handleClearAll}
                className="text-sm text-[#DC2626] hover:text-[#B91C1C] font-medium flex items-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" />
                Clear All
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Width */}
              <div>
                <label className="block text-xs font-semibold text-[#344054] uppercase tracking-wider mb-2">
                  Width (Pixels)
                </label>
                <input
                  type="number"
                  min="1"
                  max="8192"
                  value={targetWidth}
                  onChange={(e) => handleWidthChange(parseInt(e.target.value) || 100)}
                  className="w-full px-4 py-2.5 bg-[#F4F3FA] border border-[#D0D5DD] rounded-xl text-sm font-medium text-[#0F112E] focus:outline-none focus:ring-2 focus:ring-[#7C3AED]"
                />
              </div>

              {/* Height */}
              <div>
                <label className="block text-xs font-semibold text-[#344054] uppercase tracking-wider mb-2">
                  Height (Pixels)
                </label>
                <input
                  type="number"
                  min="1"
                  max="8192"
                  value={targetHeight}
                  onChange={(e) => handleHeightChange(parseInt(e.target.value) || 100)}
                  className="w-full px-4 py-2.5 bg-[#F4F3FA] border border-[#D0D5DD] rounded-xl text-sm font-medium text-[#0F112E] focus:outline-none focus:ring-2 focus:ring-[#7C3AED]"
                />
              </div>

              {/* Output Format */}
              <div>
                <label className="block text-xs font-semibold text-[#344054] uppercase tracking-wider mb-2">
                  Output Format
                </label>
                <select
                  value={outputFormat}
                  onChange={(e) => setOutputFormat(e.target.value as 'original' | 'jpg' | 'png' | 'webp')}
                  className="w-full px-4 py-2.5 bg-[#F4F3FA] border border-[#D0D5DD] rounded-xl text-sm font-medium text-[#0F112E] focus:outline-none focus:ring-2 focus:ring-[#7C3AED]"
                >
                  <option value="original">Original Format</option>
                  <option value="jpg">JPG / JPEG</option>
                  <option value="png">PNG</option>
                  <option value="webp">WebP</option>
                </select>
              </div>

              {/* Quality (if JPG or WEBP) */}
              {(outputFormat === 'jpg' || outputFormat === 'webp' || (outputFormat === 'original' && files.some(f => !f.file.name.endsWith('.png')))) && (
                <div>
                  <label className="block text-xs font-semibold text-[#344054] uppercase tracking-wider mb-2">
                    Quality ({Math.round(quality * 100)}%)
                  </label>
                  <select
                    value={quality}
                    onChange={(e) => setQuality(parseFloat(e.target.value))}
                    className="w-full px-4 py-2.5 bg-[#F4F3FA] border border-[#D0D5DD] rounded-xl text-sm font-medium text-[#0F112E] focus:outline-none focus:ring-2 focus:ring-[#7C3AED]"
                  >
                    <option value={0.9}>High (90%)</option>
                    <option value={0.8}>Medium (80%)</option>
                    <option value={0.7}>Low (70%)</option>
                  </select>
                </div>
              )}
            </div>

            {/* Maintain Aspect Ratio Toggle */}
            <div className="flex items-center gap-3 pt-2">
              <input
                type="checkbox"
                id="aspectRatio"
                checked={maintainAspectRatio}
                onChange={(e) => setMaintainAspectRatio(e.target.checked)}
                className="w-4 h-4 text-[#7C3AED] rounded border-[#D0D5DD] focus:ring-[#7C3AED]"
              />
              <label htmlFor="aspectRatio" className="text-sm font-medium text-[#344054] select-none cursor-pointer">
                Maintain aspect ratio (prevents distortion)
              </label>
            </div>
          </div>

          {/* Action Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 bg-white border border-[#E4E2F0] rounded-2xl p-6 shadow-subtle">
            <div className="flex items-center gap-3">
              <input
                ref={addMoreInputRef}
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    handleFilesAdded(Array.from(e.target.files));
                    e.target.value = '';
                  }
                }}
              />
              <button
                type="button"
                onClick={() => addMoreInputRef.current?.click()}
                disabled={files.length >= MAX_BATCH_FILES}
                className="px-4 py-2.5 bg-[#F4F3FA] hover:bg-[#F1F5F9] border border-[#D0D5DD] text-[#344054] font-medium rounded-xl text-sm flex items-center gap-2 transition-colors disabled:opacity-50"
              >
                <Plus className="w-4 h-4" />
                Add More Files ({files.length}/{MAX_BATCH_FILES})
              </button>
            </div>

            <div className="flex items-center gap-3">
              {hasCompletedFiles && (
                <button
                  type="button"
                  onClick={handleDownloadAllZip}
                  disabled={isZipping}
                  className="px-5 py-2.5 bg-[#0D9488] hover:bg-[#0F766E] text-white font-medium rounded-xl text-sm flex items-center gap-2 shadow-sm transition-colors disabled:opacity-50"
                >
                  {isZipping ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Creating ZIP...
                    </>
                  ) : (
                    <>
                      <Archive className="w-4 h-4" />
                      Download All as ZIP ({completedCount})
                    </>
                  )}
                </button>
              )}

              <button
                type="button"
                onClick={handleRunResize}
                disabled={isResizing}
                className="px-6 py-2.5 bg-[#7C3AED] hover:bg-[#0E3A44] text-white font-medium rounded-xl text-sm flex items-center gap-2 shadow-sm transition-colors disabled:opacity-50"
              >
                {isResizing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Resizing Images...
                  </>
                ) : (
                  <>
                    <Maximize2 className="w-4 h-4" />
                    Resize {files.length} Image{files.length > 1 ? 's' : ''}
                  </>
                )}
              </button>
            </div>
          </div>

          {/* File List */}
          <div className="space-y-4">
            {files.map((item) => (
              <div
                key={item.id}
                className="bg-white border border-[#E4E2F0] rounded-2xl p-5 shadow-subtle flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
              >
                <div className="flex items-center gap-4 min-w-0">
                  {item.previewUrl ? (
                    <img
                      src={item.previewUrl}
                      alt={item.file.name}
                      className="w-14 h-14 object-cover rounded-xl border border-[#E4E2F0] shrink-0"
                    />
                  ) : (
                    <div className="w-14 h-14 bg-[#F1F5F9] rounded-xl flex items-center justify-center text-[#5E6488] shrink-0">
                      <Maximize2 className="w-6 h-6" />
                    </div>
                  )}

                  <div className="min-w-0">
                    <h4 className="font-semibold text-[#0F112E] truncate text-sm md:text-base">
                      {item.file.name}
                    </h4>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-[#5E6488] mt-1">
                      <span>Original: {item.originalWidth} × {item.originalHeight} px</span>
                      <span>•</span>
                      <span>Size: {formatBytes(item.file.size)}</span>
                      {item.status === 'completed' && item.width && item.height && (
                        <>
                          <span>•</span>
                          <span className="text-[#0D9488] font-semibold">
                            New: {item.width} × {item.height} px ({formatBytes(item.convertedSize || 0)})
                          </span>
                        </>
                      )}
                    </div>

                    {item.status === 'processing' && item.stage && (
                      <div className="mt-2 w-48">
                        <div className="flex justify-between text-xs text-[#5E6488] mb-1">
                          <span>{STAGE_LABELS[item.stage] || 'Processing...'}</span>
                          <span>{item.progress}%</span>
                        </div>
                        <ProgressBar progress={item.progress} />
                      </div>
                    )}

                    {item.status === 'failed' && item.errorMessage && (
                      <p className="text-xs text-[#DC2626] font-medium mt-1">
                        {item.errorMessage}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3 w-full md:w-auto justify-end shrink-0">
                  {item.status === 'completed' && item.resultBlob && (
                    <button
                      type="button"
                      onClick={() => handleDownloadSingle(item)}
                      className="px-4 py-2 bg-[#0D9488] hover:bg-[#0F766E] text-white text-xs font-medium rounded-lg flex items-center gap-1.5 transition-colors shadow-sm"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Download
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => handleRemoveFile(item.id)}
                    className="p-2 text-[#98A2B3] hover:text-[#DC2626] hover:bg-[#FEF2F2] rounded-lg transition-colors"
                    title="Remove file"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
