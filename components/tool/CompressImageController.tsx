'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  UploadCloud,
  FileCheck,
  AlertCircle,
  Trash2,
  Download,
  Archive,
  Plus,
  RefreshCw,
  Info,
  Sliders,
  Sparkles,
  CheckCircle2,
} from 'lucide-react';
import { formatBytes, triggerBlobDownload, createZipBlob } from '@/engines/shared/file-utils';
import { COMPRESS_IMAGE_LIMITS, validateCompressibleImageFile } from '@/engines/shared/validation';
import { compressImage, estimateCompressedSize, CompressResult } from '@/engines/image/compress';
import type { WorkerProgressStage } from '@/engines/image/worker/worker-types';
import ProgressBar from './ProgressBar';

export interface CompressFileItem {
  id: string;
  file: File;
  previewUrl?: string;
  status: 'pending' | 'validating' | 'processing' | 'completed' | 'failed';
  stage?: WorkerProgressStage;
  progress: number;
  errorMessage?: string;
  resultBlob?: Blob;
  resultUrl?: string;
  resultFileName?: string;
  originalSize?: number;
  convertedSize?: number;
  savedBytes?: number;
  savedPercentage?: number;
  noSavings?: boolean;
  isLosslessPngRetained?: boolean;
  width?: number;
  height?: number;
  estimatedSize?: number;
}

const STAGE_LABELS: Record<WorkerProgressStage, string> = {
  validating: 'Validating image...',
  reading: 'Reading file data...',
  decoding: 'Decoding image...',
  encoding: 'Compressing image...',
  finalizing: 'Finalizing...',
};

export function CompressImageController() {
  const [isHydrated, setIsHydrated] = useState(false);
  const [files, setFiles] = useState<CompressFileItem[]>([]);
  const [quality, setQuality] = useState<number>(80); // 10 to 100, step 5, default 80
  const [isCompressing, setIsCompressing] = useState(false);
  const [isZipping, setIsZipping] = useState(false);
  const [globalMessage, setGlobalMessage] = useState<{ type: 'error' | 'info'; text: string } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const addMoreInputRef = useRef<HTMLInputElement>(null);
  const estimateAbortRef = useRef<{ isCancelled: boolean }>({ isCancelled: false });

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
      estimateAbortRef.current.isCancelled = true;
    };
  }, [files]);

  // Recalculate estimates when quality changes for pending files
  useEffect(() => {
    if (files.length === 0) return;

    const abortController = new AbortController();
    const pendingItems = files.filter((f) => f.status === 'pending');
    if (pendingItems.length === 0) return;

    const runEstimates = async () => {
      for (const item of pendingItems) {
        if (abortController.signal.aborted) break;
        try {
          const est = await estimateCompressedSize(item.file, quality, abortController.signal);
          if (!abortController.signal.aborted) {
            setFiles((prev) =>
              prev.map((f) => (f.id === item.id ? { ...f, estimatedSize: est.estimatedSize } : f))
            );
          }
        } catch {
          // ignore aborted or estimation errors
        }
      }
    };

    const timer = setTimeout(() => {
      runEstimates();
    }, 250);

    return () => {
      clearTimeout(timer);
      abortController.abort();
    };
  }, [quality, files.length]);

  const handleFilesAdded = useCallback(
    async (incomingFiles: File[]) => {
      setGlobalMessage(null);

      if (incomingFiles.length === 0) return;

      const currentCount = files.length;
      if (currentCount + incomingFiles.length > COMPRESS_IMAGE_LIMITS.MAX_BATCH_FILES) {
        setGlobalMessage({
          type: 'error',
          text: `You can compress up to ${COMPRESS_IMAGE_LIMITS.MAX_BATCH_FILES} files at a time. Only the first ${
            COMPRESS_IMAGE_LIMITS.MAX_BATCH_FILES - currentCount
          } eligible files were added.`,
        });
      }

      const allowedIncoming = incomingFiles.slice(
        0,
        Math.max(0, COMPRESS_IMAGE_LIMITS.MAX_BATCH_FILES - currentCount)
      );

      const validatedItems: CompressFileItem[] = [];

      for (const file of allowedIncoming) {
        const id = `${file.name}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
        const ext = file.name.split('.').pop()?.toLowerCase() || '';

        // Quick extension check
        if (!COMPRESS_IMAGE_LIMITS.ALLOWED_EXTENSIONS.includes(ext)) {
          validatedItems.push({
            id,
            file,
            status: 'failed',
            progress: 0,
            errorMessage: 'Only JPG, JPEG, PNG, and WebP files are supported for compression.',
          });
          continue;
        }

        // Quick size check
        if (file.size > COMPRESS_IMAGE_LIMITS.MAX_FILE_SIZE_BYTES) {
          validatedItems.push({
            id,
            file,
            status: 'failed',
            progress: 0,
            errorMessage: 'This file is too large. Maximum size is 50 MB.',
          });
          continue;
        }

        // Deep header & magic bytes & animated WebP check
        const val = await validateCompressibleImageFile(file);
        if (!val.valid) {
          validatedItems.push({
            id,
            file,
            status: 'failed',
            progress: 0,
            errorMessage: val.error?.message || 'This file is not a valid image.',
          });
          continue;
        }

        let previewUrl: string | undefined;
        try {
          previewUrl = URL.createObjectURL(file);
        } catch {
          // Preview generation fallback
        }

        validatedItems.push({
          id,
          file,
          previewUrl,
          status: 'pending',
          progress: 0,
          originalSize: file.size,
          estimatedSize: file.size,
        });
      }

      setFiles((prev) => [...prev, ...validatedItems]);
    },
    [files.length]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      const droppedFiles = Array.from(e.dataTransfer.files || []);
      if (droppedFiles.length > 0) {
        handleFilesAdded(droppedFiles);
      }
    },
    [handleFilesAdded]
  );

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleRemoveFile = (id: string) => {
    setFiles((prev) => {
      const target = prev.find((item) => item.id === id);
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      if (target?.resultUrl) URL.revokeObjectURL(target.resultUrl);
      return prev.filter((item) => item.id !== id);
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

  const handleCompressAll = async () => {
    if (isCompressing || files.length === 0) return;

    const pendingOrFailed = files.filter((f) => f.status === 'pending' || f.status === 'failed');
    if (pendingOrFailed.length === 0) return;

    setIsCompressing(true);
    setGlobalMessage(null);

    const qualityFactor = quality / 100;

    for (const item of files) {
      if (item.status === 'completed') continue;

      // Update item to processing
      setFiles((prev) =>
        prev.map((f) =>
          f.id === item.id
            ? { ...f, status: 'processing', progress: 5, stage: 'validating', errorMessage: undefined }
            : f
        )
      );

      try {
        const result: CompressResult = await compressImage(
          item.file,
          { quality: qualityFactor },
          (progress, stage) => {
            setFiles((prev) =>
              prev.map((f) => (f.id === item.id ? { ...f, progress, stage } : f))
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
                  stage: 'finalizing',
                  resultBlob: result.blob,
                  resultUrl,
                  resultFileName: result.fileName,
                  originalSize: result.originalSize,
                  convertedSize: result.convertedSize,
                  savedBytes: result.savedBytes,
                  savedPercentage: result.savedPercentage,
                  noSavings: result.noSizeReduction,
                  isLosslessPngRetained: result.noSizeReduction && result.format === 'png',
                  width: result.width,
                  height: result.height,
                }
              : f
          )
        );
      } catch (err: unknown) {
        const message =
          err instanceof Error
            ? err.message
            : "We couldn't compress this image. Please try again.";

        setFiles((prev) =>
          prev.map((f) =>
            f.id === item.id
              ? {
                  ...f,
                  status: 'failed',
                  progress: 0,
                  errorMessage: message,
                }
              : f
          )
        );
      }
    }

    setIsCompressing(false);
  };

  const handleDownloadSingle = (item: CompressFileItem) => {
    if (!item.resultBlob || !item.resultFileName) return;
    triggerBlobDownload(item.resultBlob, item.resultFileName);
  };

  const handleDownloadAllZip = async () => {
    const completedItems = files.filter((f) => f.status === 'completed' && f.resultBlob && f.resultFileName);
    if (completedItems.length === 0 || isZipping) return;

    setIsZipping(true);
    try {
      const zipEntries = completedItems.map((item) => ({
        name: item.resultFileName!,
        blob: item.resultBlob!,
      }));

      const zipBlob = await createZipBlob(zipEntries);
      triggerBlobDownload(zipBlob, `compressed-images-${Date.now()}.zip`);
    } catch {
      setGlobalMessage({
        type: 'error',
        text: 'Failed to create ZIP file. Please download images individually.',
      });
    } finally {
      setIsZipping(false);
    }
  };

  if (!isHydrated) {
    return (
      <div className="bg-[#FFFFFF] border border-[#E4E2F0] rounded-card p-6 md:p-8 shadow-subtle mb-6 min-h-[300px] flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-[#7C3AED] border-t-transparent rounded-full" />
      </div>
    );
  }

  const completedCount = files.filter((f) => f.status === 'completed').length;
  const pendingCount = files.filter((f) => f.status === 'pending').length;
  const hasFiles = files.length > 0;
  const hasCompletedFiles = completedCount > 0;

  // Calculate total batch stats
  const totalOriginalBytes = files.reduce((acc, f) => acc + (f.originalSize || f.file.size), 0);
  const totalCompressedBytes = files.reduce(
    (acc, f) => acc + (f.convertedSize !== undefined ? f.convertedSize : f.originalSize || f.file.size),
    0
  );
  const totalSavedBytes = Math.max(0, totalOriginalBytes - totalCompressedBytes);
  const totalSavedPercentage =
    totalOriginalBytes > 0 && totalSavedBytes > 0
      ? Math.round((totalSavedBytes / totalOriginalBytes) * 1000) / 10
      : 0;

  return (
    <div data-hydrated={isHydrated ? 'true' : 'false'} className="space-y-6 mb-8">
      {/* Global alert banner */}
      {globalMessage && (
        <div
          role="alert"
          className={`p-4 rounded-lg flex items-start gap-3 text-sm ${
            globalMessage.type === 'error'
              ? 'bg-[#FEF3F2] border border-[#FECDCA] text-[#B42318]'
              : 'bg-[#F0F9FF] border border-[#B9E6FE] text-[#026AA2]'
          }`}
        >
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div className="flex-1">{globalMessage.text}</div>
          <button
            onClick={() => setGlobalMessage(null)}
            className="text-xs font-semibold uppercase tracking-wider underline hover:opacity-80"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main card */}
      <div className="bg-[#FFFFFF] border border-[#E4E2F0] rounded-card p-6 md:p-8 shadow-subtle space-y-6">
        {/* Upload Dropzone */}
        {!hasFiles ? (
          <div
            id="compress-dropzone"
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-[#CBD5E1] hover:border-[#7C3AED] bg-[#F4F3FA] hover:bg-[#F4F0FD] transition-colors rounded-xl p-8 md:p-12 text-center cursor-pointer flex flex-col items-center justify-center space-y-4"
          >
            <input
              ref={fileInputRef}
              type="file"
              id="compress-file-input"
              className="hidden"
              accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
              multiple
              onChange={(e) => {
                if (e.target.files) {
                  handleFilesAdded(Array.from(e.target.files));
                }
                e.target.value = '';
              }}
            />
            <div className="w-16 h-16 rounded-full bg-[#E0EFF2] text-[#7C3AED] flex items-center justify-center">
              <UploadCloud className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <p className="text-lg font-semibold text-[#0F112E]">
                Choose JPG, PNG, or WebP images to compress
              </p>
              <p className="text-sm text-[#5E6488]">
                or drag and drop files here
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-[#98A2B3]">
              <span className="bg-[#FFFFFF] px-2.5 py-1 rounded border border-[#E4E2F0]">JPG / JPEG</span>
              <span className="bg-[#FFFFFF] px-2.5 py-1 rounded border border-[#E4E2F0]">PNG</span>
              <span className="bg-[#FFFFFF] px-2.5 py-1 rounded border border-[#E4E2F0]">WebP</span>
              <span>• Up to 20 files • Max 50 MB per file</span>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Header Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-[#E4E2F0]">
              <div>
                <h3 className="text-lg font-semibold text-[#0F112E]">
                  Image Compression Queue ({files.length}/{COMPRESS_IMAGE_LIMITS.MAX_BATCH_FILES})
                </h3>
                <p className="text-xs text-[#5E6488]">
                  {completedCount} completed, {pendingCount} ready to compress
                </p>
              </div>

              <div className="flex items-center gap-2">
                <input
                  ref={addMoreInputRef}
                  type="file"
                  id="compress-add-more-input"
                  className="hidden"
                  accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                  multiple
                  onChange={(e) => {
                    if (e.target.files) {
                      handleFilesAdded(Array.from(e.target.files));
                    }
                    e.target.value = '';
                  }}
                />
                {files.length < COMPRESS_IMAGE_LIMITS.MAX_BATCH_FILES && !isCompressing && (
                  <button
                    id="compress-add-more-btn"
                    onClick={() => addMoreInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#7C3AED] bg-[#E0EFF2] hover:bg-[#D0E5E9] rounded-lg transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add More
                  </button>
                )}
                {!isCompressing && (
                  <button
                    id="compress-clear-all-btn"
                    onClick={handleClearAll}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#B42318] bg-[#FEF3F2] hover:bg-[#FECDCA] rounded-lg transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Clear All
                  </button>
                )}
              </div>
            </div>

            {/* Quality Settings Panel */}
            <div className="p-5 bg-[#F4F3FA] border border-[#E4E2F0] rounded-xl space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-[#7C3AED]" />
                  <label htmlFor="compress-quality-slider" className="text-sm font-semibold text-[#0F112E]">
                    Compression Quality Level
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-[#7C3AED] bg-[#E0EFF2] px-3 py-1 rounded-full">
                    {quality}%
                  </span>
                  <span className="text-xs text-[#5E6488]">
                    {quality >= 85 ? 'High Fidelity' : quality >= 60 ? 'Balanced' : 'Smallest Size'}
                  </span>
                </div>
              </div>

              {/* Quality Slider: 10 - 100, step 5 */}
              <div className="space-y-2">
                <input
                  id="compress-quality-slider"
                  type="range"
                  min="10"
                  max="100"
                  step="5"
                  value={quality}
                  disabled={isCompressing}
                  onChange={(e) => setQuality(Number(e.target.value))}
                  className="w-full h-2 bg-[#E2E8F0] rounded-lg appearance-none cursor-pointer accent-[#7C3AED] focus:outline-none"
                />
                <div className="flex justify-between text-xs text-[#98A2B3] px-1 font-mono">
                  <span>10%<span className="hidden sm:inline"> (Max Compression)</span></span>
                  <span>50%</span>
                  <span className="font-semibold text-[#7C3AED]">80%<span className="hidden sm:inline"> (Recommended)</span></span>
                  <span>100%<span className="hidden sm:inline"> (High Quality)</span></span>
                </div>
              </div>

              {/* Preset buttons */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span className="text-xs font-medium text-[#5E6488]">Quick presets:</span>
                {[
                  { label: 'High (90%)', val: 90 },
                  { label: 'Recommended (80%)', val: 80 },
                  { label: 'Balanced (60%)', val: 60 },
                  { label: 'Low Size (40%)', val: 40 },
                ].map((preset) => (
                  <button
                    key={preset.val}
                    type="button"
                    disabled={isCompressing}
                    onClick={() => setQuality(preset.val)}
                    className={`text-xs px-2.5 py-1 rounded border transition-colors ${
                      quality === preset.val
                        ? 'bg-[#7C3AED] text-white border-[#7C3AED]'
                        : 'bg-[#FFFFFF] text-[#475467] border-[#D0D5DD] hover:bg-[#F2F4F7]'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              {/* Format explanation notice */}
              <div className="flex items-start gap-2 text-xs text-[#475467] bg-[#FFFFFF] p-3 rounded-lg border border-[#E4E2F0]">
                <Info className="w-4 h-4 text-[#7C3AED] flex-shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <p>
                    <strong className="text-[#0F112E]">JPG & WebP:</strong> Compression adjusts quality based on the slider. If the output would not be smaller, your original file is preserved.
                  </p>
                  <p>
                    <strong className="text-[#0F112E]">PNG:</strong> Uses safe lossless re-encoding; the quality slider does not control lossy PNG compression. If the output is not smaller, your original PNG is preserved unchanged.
                  </p>
                </div>
              </div>
            </div>

            {/* Overall Batch Summary if completed */}
            {hasCompletedFiles && (
              <div className="p-4 bg-[#F0FDF4] border border-[#BBF7D0] rounded-xl flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-[#DCFCE7] text-[#16A34A] flex items-center justify-center flex-shrink-0">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[#166534]">
                      {completedCount} of {files.length} images compressed
                    </p>
                    <p className="text-xs text-[#15803D]">
                      Total size: {formatBytes(totalOriginalBytes)} → {formatBytes(totalCompressedBytes)}{' '}
                      {totalSavedBytes > 0 && (
                        <span className="font-bold">
                          (Saved {totalSavedPercentage}% / {formatBytes(totalSavedBytes)})
                        </span>
                      )}
                    </p>
                  </div>
                </div>

                <button
                  id="compress-download-zip-top-btn"
                  onClick={handleDownloadAllZip}
                  disabled={isZipping}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#16A34A] hover:bg-[#15803D] text-white text-xs font-semibold rounded-lg shadow-sm transition-colors"
                >
                  <Archive className="w-4 h-4" />
                  {isZipping ? 'Creating ZIP...' : 'Download All (.ZIP)'}
                </button>
              </div>
            )}

            {/* File List */}
            <div className="space-y-3">
              {files.map((item, index) => {
                const ext = item.file.name.split('.').pop()?.toUpperCase() || '';
                const isPng = ext === 'PNG';

                return (
                  <div
                    key={item.id}
                    className="p-4 bg-[#FFFFFF] border border-[#E4E2F0] rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-subtle hover:border-[#CBD5E1] transition-colors"
                  >
                    {/* Left: Thumbnail & Info */}
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-12 h-12 rounded-lg bg-[#F1F5F9] border border-[#E2E8F0] flex items-center justify-center overflow-hidden flex-shrink-0">
                        {item.previewUrl ? (
                          <img
                            src={item.previewUrl}
                            alt={item.file.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className="text-xs font-bold text-[#64748B]">{ext}</span>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-[#0F112E] truncate" title={item.file.name}>
                            {item.file.name}
                          </p>
                          <span className="text-[10px] font-mono px-1.5 py-0.5 bg-[#F1F5F9] text-[#475467] rounded border border-[#E2E8F0]">
                            {ext}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-x-2 text-xs text-[#5E6488] mt-0.5">
                          <span>Original: {formatBytes(item.file.size)}</span>
                          {item.width && item.height && (
                            <>
                              <span>•</span>
                              <span>{item.width}×{item.height}px</span>
                            </>
                          )}
                          {item.status === 'pending' && !isPng && item.estimatedSize && item.estimatedSize < item.file.size && (
                            <>
                              <span>•</span>
                              <span className="text-[#7C3AED] font-medium">
                                Est: ~{formatBytes(item.estimatedSize)} (-{Math.round(((item.file.size - item.estimatedSize) / item.file.size) * 100)}%)
                              </span>
                            </>
                          )}
                          {item.status === 'pending' && isPng && (
                            <>
                              <span>•</span>
                              <span className="text-[#64748B]">Lossless optimization (slider does not affect PNG)</span>
                            </>
                          )}
                        </div>

                        {/* Error message */}
                        {item.status === 'failed' && item.errorMessage && (
                          <p className="text-xs text-[#B42318] mt-1 flex items-center gap-1 font-medium">
                            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                            {item.errorMessage}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Middle: Progress / Status details */}
                    <div className="flex-shrink-0 md:w-56">
                      {item.status === 'processing' && (
                        <div className="space-y-1">
                          <div className="flex justify-between text-[11px] text-[#7C3AED] font-medium">
                            <span>{item.stage ? STAGE_LABELS[item.stage] : 'Compressing...'}</span>
                            <span>{item.progress}%</span>
                          </div>
                          <ProgressBar progress={item.progress} />
                        </div>
                      )}

                      {item.status === 'completed' && item.convertedSize !== undefined && (
                        <div className="text-right md:text-left space-y-0.5">
                          <div className="flex items-center gap-1.5 text-xs font-semibold text-[#166534]">
                            <FileCheck className="w-4 h-4 text-[#16A34A]" />
                            <span>{formatBytes(item.convertedSize)}</span>
                            {item.savedPercentage && item.savedPercentage > 0 ? (
                              <span className="bg-[#DCFCE7] text-[#15803D] px-1.5 py-0.5 rounded text-[10px]">
                                -{Math.round(item.savedPercentage)}%
                              </span>
                            ) : null}
                          </div>
                          <p className="text-[11px] text-[#5E6488]">
                            {item.isLosslessPngRetained
                              ? 'Original kept (already optimal)'
                              : item.noSavings
                              ? 'No size reduction (original kept)'
                              : `Saved ${formatBytes(item.savedBytes || 0)}`}
                          </p>
                        </div>
                      )}

                      {item.status === 'pending' && (
                        <span className="text-xs text-[#64748B] font-medium">Ready to compress</span>
                      )}
                    </div>

                    {/* Right: Actions */}
                    <div className="flex items-center justify-end gap-2 flex-shrink-0">
                      {item.status === 'completed' && (
                        <button
                          id={`compress-download-btn-${index}`}
                          onClick={() => handleDownloadSingle(item)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-xs font-medium rounded-lg shadow-sm transition-colors"
                        >
                          <Download className="w-3.5 h-3.5" />
                          Download
                        </button>
                      )}

                      {!isCompressing && (
                        <button
                          id={`compress-remove-btn-${index}`}
                          onClick={() => handleRemoveFile(item.id)}
                          aria-label={`Remove ${item.file.name}`}
                          className="p-1.5 text-[#98A2B3] hover:text-[#B42318] hover:bg-[#FEF3F2] rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Bottom Actions Bar */}
            <div className="pt-4 border-t border-[#E4E2F0] flex flex-wrap items-center justify-between gap-4">
              <div className="text-xs text-[#5E6488]">
                <span>
                  All processing happens in your browser. Pixel dimensions and alpha channels are preserved.
                </span>
              </div>

              <div className="flex items-center gap-3">
                {hasCompletedFiles && (
                  <button
                    id="compress-download-all-zip-btn"
                    onClick={handleDownloadAllZip}
                    disabled={isZipping}
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-[#FFFFFF] border border-[#CBD5E1] hover:bg-[#F4F3FA] text-[#0F112E] text-sm font-semibold rounded-lg shadow-sm transition-colors"
                  >
                    <Archive className="w-4 h-4 text-[#7C3AED]" />
                    {isZipping ? 'Creating ZIP...' : `Download All (${completedCount}) as ZIP`}
                  </button>
                )}

                {pendingCount > 0 && (
                  <button
                    id="compress-submit-btn"
                    onClick={handleCompressAll}
                    disabled={isCompressing}
                    className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-sm font-semibold rounded-lg shadow-md transition-colors disabled:opacity-50"
                  >
                    {isCompressing ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Compressing Images...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        Compress {pendingCount > 1 ? `${pendingCount} Images` : 'Image'}
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default CompressImageController;
