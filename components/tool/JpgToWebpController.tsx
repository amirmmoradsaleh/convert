'use client';

import React, { useState, useRef, useEffect, useId } from 'react';
import {
  UploadCloud,
  FileCheck,
  AlertCircle,
  RotateCw,
  Trash2,
  Download,
  Archive,
  Plus,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';
import { formatBytes, triggerBlobDownload, createZipBlob, generateUniqueFilename } from '@/engines/shared/file-utils';
import { VALIDATION_LIMITS, validateJpegFile } from '@/engines/shared/validation';
import { getHumanErrorMessage } from '@/engines/shared/errors';
import { convertJpgToWebp } from '@/engines/image/convert';
import type { WorkerProgressStage } from '@/engines/image/worker/worker-types';
import ProgressBar from './ProgressBar';

export interface JpgFileItem {
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
  width?: number;
  height?: number;
  usedQuality?: number;
}

const STAGE_LABELS: Record<WorkerProgressStage, string> = {
  validating: 'Validating JPEG...',
  reading: 'Reading file data...',
  decoding: 'Decoding JPEG...',
  encoding: 'Encoding WebP...',
  finalizing: 'Finalizing...',
};

export function JpgToWebpController() {
  const [files, setFiles] = useState<JpgFileItem[]>([]);
  const [isConverting, setIsConverting] = useState(false);
  const [isZipping, setIsZipping] = useState(false);
  const [quality, setQuality] = useState<number>(0.9); // Default 90%
  const [globalMessage, setGlobalMessage] = useState<{ type: 'error' | 'info'; text: string } | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const addMoreInputRef = useRef<HTMLInputElement>(null);
  const qualityGroupId = useId();

  useEffect(() => {
    setIsHydrated(true);
    return () => {
      // Clean up lingering object URLs on unmount
      files.forEach((f) => {
        if (f.previewUrl) URL.revokeObjectURL(f.previewUrl);
        if (f.resultUrl) URL.revokeObjectURL(f.resultUrl);
      });
    };
  }, []);

  const handleFilesAdded = async (newRawFiles: File[]) => {
    setGlobalMessage(null);

    const validNewFiles: File[] = [];
    let oversizedCount = 0;
    let formatRejectedCount = 0;

    for (const file of newRawFiles) {
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (ext !== 'jpg' && ext !== 'jpeg') {
        formatRejectedCount++;
        continue;
      }
      if (file.size > VALIDATION_LIMITS.MAX_IMAGE_SIZE_BYTES) {
        oversizedCount++;
        continue;
      }
      validNewFiles.push(file);
    }

    if (formatRejectedCount > 0) {
      setGlobalMessage({
        type: 'error',
        text: `Only JPG and JPEG files are supported. ${formatRejectedCount} invalid file(s) ignored.`,
      });
    } else if (oversizedCount > 0) {
      setGlobalMessage({
        type: 'error',
        text: `Files must be under 50 MB. ${oversizedCount} oversized file(s) ignored.`,
      });
    }

    if (validNewFiles.length === 0) return;

    // Check batch limit (max 20)
    const availableSlots = VALIDATION_LIMITS.MAX_BATCH_FILES - files.length;
    if (availableSlots <= 0) {
      setGlobalMessage({
        type: 'error',
        text: `Maximum limit of ${VALIDATION_LIMITS.MAX_BATCH_FILES} files reached. Please process or remove existing files.`,
      });
      return;
    }

    const filesToProcess = validNewFiles.slice(0, availableSlots);
    if (validNewFiles.length > availableSlots) {
      setGlobalMessage({
        type: 'info',
        text: `Added ${availableSlots} files. Maximum batch limit is ${VALIDATION_LIMITS.MAX_BATCH_FILES} files.`,
      });
    }

    // Build items
    const newItems: JpgFileItem[] = [];
    for (const file of filesToProcess) {
      const id = `${file.name}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      let previewUrl: string | undefined;

      try {
        previewUrl = URL.createObjectURL(file);
      } catch {
        // Safe preview fallback if blob URL fails
      }

      newItems.push({
        id,
        file,
        previewUrl,
        status: 'pending',
        progress: 0,
      });
    }

    setFiles((prev) => [...prev, ...newItems]);
  };

  const handleDrop = (e: React.DragEvent<HTMLElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (isConverting) return;
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFilesAdded(Array.from(e.dataTransfer.files));
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const removeFile = (id: string) => {
    if (isConverting) return;
    setFiles((prev) => {
      const target = prev.find((f) => f.id === id);
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      if (target?.resultUrl) URL.revokeObjectURL(target.resultUrl);
      return prev.filter((f) => f.id !== id);
    });
  };

  const resetAll = () => {
    if (isConverting) return;
    files.forEach((f) => {
      if (f.previewUrl) URL.revokeObjectURL(f.previewUrl);
      if (f.resultUrl) URL.revokeObjectURL(f.resultUrl);
    });
    setFiles([]);
    setGlobalMessage(null);
  };

  // Convert a single file through the pipeline
  const processSingleFile = async (
    item: JpgFileItem,
    existingNames: Set<string>,
    currentQuality: number
  ): Promise<JpgFileItem> => {
    // 1. Initial Validation stage
    const validation = await validateJpegFile(item.file);
    if (!validation.valid) {
      return {
        ...item,
        status: 'failed',
        progress: 0,
        errorMessage: validation.error?.message || 'This file is not a valid JPEG image.',
      };
    }

    try {
      // 2. Conversion via engine
      const result = await convertJpgToWebp(
        item.file,
        {
          quality: currentQuality,
        },
        (progress, stage) => {
          setFiles((prev) =>
            prev.map((f) =>
              f.id === item.id
                ? {
                    ...f,
                    status: 'processing',
                    progress,
                    stage,
                  }
                : f
            )
          );
        }
      );

      // Unique filename collision handling
      const baseName = result.fileName;
      const uniqueName = generateUniqueFilename(baseName, existingNames);
      existingNames.add(uniqueName);

      return {
        ...item,
        status: 'completed',
        progress: 100,
        stage: 'finalizing',
        resultBlob: result.blob,
        resultFileName: uniqueName,
        width: result.width,
        height: result.height,
        originalSize: result.originalSize,
        convertedSize: result.convertedSize,
        usedQuality: currentQuality,
      };
    } catch (err: unknown) {
      return {
        ...item,
        status: 'failed',
        progress: 0,
        errorMessage: getHumanErrorMessage(err),
      };
    }
  };

  // Start conversion for all pending or failed files
  const startConversion = async () => {
    if (isConverting) return;

    // Reset batch if all are completed
    const pendingItems = files.filter((f) => f.status === 'pending' || f.status === 'failed');
    if (pendingItems.length === 0) return;

    setIsConverting(true);
    setGlobalMessage(null);

    const existingNames = new Set<string>();
    files.forEach((f) => {
      if (f.status === 'completed' && f.resultFileName) {
        existingNames.add(f.resultFileName);
      }
    });

    const activeQuality = quality;

    // Sequential queue processing to prevent memory spikes with large files
    for (const item of files) {
      if (item.status !== 'pending' && item.status !== 'failed') continue;

      setFiles((prev) =>
        prev.map((f) =>
          f.id === item.id
            ? { ...f, status: 'validating', stage: 'validating', progress: 10 }
            : f
        )
      );

      const updated = await processSingleFile(item, existingNames, activeQuality);

      setFiles((prev) => prev.map((f) => (f.id === item.id ? updated : f)));
    }

    setIsConverting(false);
  };

  // Retry a single failed file
  const retryFile = async (id: string) => {
    if (isConverting) return;
    const target = files.find((f) => f.id === id);
    if (!target) return;

    setIsConverting(true);
    setGlobalMessage(null);

    setFiles((prev) =>
      prev.map((f) => (f.id === id ? { ...f, status: 'validating', progress: 10 } : f))
    );

    const existingNames = new Set<string>();
    files.forEach((f) => {
      if (f.status === 'completed' && f.resultFileName && f.id !== id) {
        existingNames.add(f.resultFileName);
      }
    });

    const updated = await processSingleFile(target, existingNames, quality);
    setFiles((prev) => prev.map((f) => (f.id === id ? updated : f)));
    setIsConverting(false);
  };

  // Download a single file
  const downloadFile = (item: JpgFileItem) => {
    if (!item.resultBlob || !item.resultFileName) return;
    triggerBlobDownload(item.resultBlob, item.resultFileName);
  };

  // Download all completed files as a ZIP archive
  const downloadAllAsZip = async () => {
    const completedFiles = files.filter((f) => f.status === 'completed' && f.resultBlob);
    if (completedFiles.length === 0 || isZipping) return;

    setIsZipping(true);
    try {
      const zipEntries = completedFiles.map((f) => ({
        name: f.resultFileName || f.file.name.replace(/\.(jpe?g)$/i, '.webp'),
        blob: f.resultBlob as Blob,
      }));

      const zipBlob = await createZipBlob(zipEntries);
      triggerBlobDownload(zipBlob, 'jpg-to-webp-files.zip');
    } catch {
      setGlobalMessage({
        type: 'error',
        text: 'Failed to create ZIP file. You can still download images individually.',
      });
    } finally {
      setIsZipping(false);
    }
  };

  // Calculate batch metrics
  const completedCount = files.filter((f) => f.status === 'completed').length;
  const failedCount = files.filter((f) => f.status === 'failed').length;
  const pendingCount = files.filter((f) => f.status === 'pending' || f.status === 'validating' || f.status === 'processing').length;
  const totalCount = files.length;

  const overallPercent = totalCount > 0
    ? Math.round(
        files.reduce((acc, f) => {
          if (f.status === 'completed') return acc + 100;
          if (f.status === 'failed') return acc + 100;
          return acc + f.progress;
        }, 0) / totalCount
      )
    : 0;

  const hasConvertibleFiles = files.some((f) => f.status === 'pending' || f.status === 'failed');

  if (!isHydrated) {
    return (
      <div
        data-hydrated="false"
        className="bg-[#FFFFFF] border border-[#E4E2F0] rounded-card p-8 md:p-12 text-center text-[#5E6488]"
      >
        Loading JPG to WebP converter...
      </div>
    );
  }

  return (
    <section
      aria-labelledby="jpg-to-webp-title"
      data-hydrated="true"
      data-testid="jpg-to-webp-container"
      className="w-full"
    >
      <h2 id="jpg-to-webp-title" className="sr-only">
        JPG to WebP Image Converter Tool
      </h2>

      {/* Global alert messages */}
      {globalMessage && (
        <div
          role="alert"
          className={`mb-6 p-4 rounded-lg flex items-center gap-3 text-sm font-medium ${
            globalMessage.type === 'error'
              ? 'bg-[#FEF2F2] border border-[#FCA5A5] text-[#DC2626]'
              : 'bg-[#F0FDF4] border border-[#86EFAC] text-[#16A34A]'
          }`}
        >
          <AlertCircle className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
          <span className="flex-1">{globalMessage.text}</span>
          <button
            type="button"
            onClick={() => setGlobalMessage(null)}
            className="text-xs underline hover:no-underline font-semibold"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Container Card */}
      <div className="bg-[#FFFFFF] border border-[#E4E2F0] rounded-card p-6 md:p-8 shadow-sm">
        {files.length === 0 ? (
          /* Empty State / Dropzone */
          <>
            <input
              ref={fileInputRef}
              id="jpg-to-webp-file-input"
              data-testid="file-input"
              type="file"
              multiple
              accept=".jpg,.jpeg,image/jpeg"
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  handleFilesAdded(Array.from(e.target.files));
                }
              }}
              onClick={(e) => {
                (e.target as HTMLInputElement).value = '';
              }}
              className="sr-only"
              tabIndex={-1}
            />

            <label
              htmlFor="jpg-to-webp-file-input"
              data-testid="upload-dropzone"
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              className="w-full block rounded-card border-2 border-dashed border-[#E4E2F0] hover:border-[#7C3AED]/60 bg-[#FFFFFF] hover:bg-[#F4F3FA] p-8 md:p-12 text-center transition-all cursor-pointer focus-within:ring-2 focus-within:ring-[#7C3AED]"
            >
              <div className="flex flex-col items-center justify-center">
                <div className="w-16 h-16 rounded-full bg-[#F4F0FD] text-[#7C3AED] flex items-center justify-center mb-4 transition-transform group-hover:scale-105">
                  <UploadCloud className="w-8 h-8" aria-hidden="true" />
                </div>

                <div className="space-y-1.5 mb-3">
                  <p className="text-xl md:text-2xl font-bold text-[#0F112E]">
                    <span className="text-[#7C3AED] underline decoration-[#7C3AED]/40 hover:decoration-[#7C3AED]">
                      Drag &amp; drop your JPG files here
                    </span>{' '}
                    or browse files
                  </p>
                  <p className="text-sm text-[#5E6488]">
                    Fast, private conversion to modern WebP format
                  </p>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-[#5E6488] mt-2">
                  <span className="bg-[#F4F3FA] border border-[#E4E2F0] px-2.5 py-1 rounded-md font-medium">
                    JPG, JPEG
                  </span>
                  <span className="bg-[#F4F3FA] border border-[#E4E2F0] px-2.5 py-1 rounded-md font-medium">
                    Maximum 50 MB per file
                  </span>
                  <span className="bg-[#F4F3FA] border border-[#E4E2F0] px-2.5 py-1 rounded-md font-medium">
                    Up to 20 files
                  </span>
                </div>

                <div className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 bg-[#7C3AED] text-white rounded-lg text-sm font-semibold hover:bg-[#6D28D9] transition-colors shadow-sm">
                  <Plus className="w-4 h-4" aria-hidden="true" />
                  <span>Browse files</span>
                </div>
              </div>
            </label>
          </>
        ) : (
          /* File list & processing view */
          <div className="space-y-6">
            {/* Header controls */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#E4E2F0]">
              <div>
                <h3 className="text-base font-bold text-[#0F112E]">
                  Selected Images ({files.length} / {VALIDATION_LIMITS.MAX_BATCH_FILES})
                </h3>
                <p className="text-xs text-[#5E6488]">
                  {completedCount} converted
                  {failedCount > 0 ? `, ${failedCount} failed` : ''}
                  {pendingCount > 0 ? `, ${pendingCount} waiting` : ''}
                </p>
              </div>

              <div className="flex items-center gap-2">
                {/* Add more files input */}
                {files.length < VALIDATION_LIMITS.MAX_BATCH_FILES && (
                  <>
                    <input
                      ref={addMoreInputRef}
                      id="jpg-add-more-input"
                      data-testid="jpg-add-more-input"
                      type="file"
                      multiple
                      accept=".jpg,.jpeg,image/jpeg"
                      disabled={isConverting}
                      onChange={(e) => {
                        if (e.target.files && e.target.files.length > 0) {
                          handleFilesAdded(Array.from(e.target.files));
                        }
                      }}
                      onClick={(e) => {
                        (e.target as HTMLInputElement).value = '';
                      }}
                      className="sr-only"
                      tabIndex={-1}
                    />
                    <button
                      type="button"
                      onClick={() => addMoreInputRef.current?.click()}
                      disabled={isConverting}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-[#E4E2F0] bg-white text-xs font-semibold text-[#0F112E] hover:bg-[#F4F3FA] disabled:opacity-50 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Add more</span>
                    </button>
                  </>
                )}

                {/* Reset all */}
                <button
                  type="button"
                  onClick={resetAll}
                  disabled={isConverting}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-[#E4E2F0] bg-white text-xs font-semibold text-[#DC2626] hover:bg-[#FEF2F2] hover:border-[#FCA5A5] disabled:opacity-50 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Clear all</span>
                </button>
              </div>
            </div>

            {/* Overall Progress when converting or completed */}
            {(isConverting || completedCount > 0) && (
              <div className="p-4 bg-[#F4F3FA] border border-[#E4E2F0] rounded-lg space-y-2">
                <div className="flex justify-between items-center text-xs font-semibold text-[#0F112E]">
                  <span>
                    {isConverting
                      ? `Converting images (${completedCount + failedCount} / ${totalCount} processed)...`
                      : `Batch conversion complete (${completedCount} of ${totalCount} successful)`}
                  </span>
                  <span className="text-[#7C3AED]">{overallPercent}%</span>
                </div>
                <ProgressBar progress={overallPercent} />
              </div>
            )}

            {/* File Cards List */}
            <div className="space-y-3" role="list" aria-label="Selected files to convert">
              {files.map((item) => (
                <div
                  key={item.id}
                  role="listitem"
                  className={`p-4 rounded-lg border transition-all ${
                    item.status === 'completed'
                      ? 'bg-[#FFFFFF] border-[#16A34A]/40 shadow-sm'
                      : item.status === 'failed'
                      ? 'bg-[#FEF2F2]/60 border-[#FCA5A5]'
                      : item.status === 'processing' || item.status === 'validating'
                      ? 'bg-[#F4F0FD] border-[#7C3AED]/40'
                      : 'bg-[#FFFFFF] border-[#E4E2F0]'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    {/* Left: preview & filename info */}
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-12 h-12 rounded-md bg-[#F4F3FA] border border-[#E4E2F0] flex items-center justify-center flex-shrink-0 overflow-hidden text-[#7C3AED]">
                        {item.previewUrl ? (
                          <img
                            src={item.previewUrl}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <FileCheck className="w-6 h-6 text-[#7C3AED]" aria-hidden="true" />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-[#0F112E] truncate">
                          {item.file.name}
                        </p>

                        <div className="flex flex-wrap items-center gap-2 text-xs text-[#5E6488] mt-0.5">
                          <span className="font-medium text-[#7C3AED]">JPG</span>
                          <span>•</span>
                          <span>{formatBytes(item.file.size)}</span>

                          {item.width && item.height ? (
                            <>
                              <span>•</span>
                              <span>
                                {item.width} × {item.height} px
                              </span>
                            </>
                          ) : null}

                          {/* Status badge */}
                          {item.status === 'pending' && (
                            <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-[#F4F3FA] border border-[#E4E2F0] text-[#5E6488]">
                              Ready to convert
                            </span>
                          )}

                          {item.status === 'validating' && (
                            <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-[#FEF3C7] text-[#92400E]">
                              Validating...
                            </span>
                          )}

                          {item.status === 'processing' && (
                            <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-[#F4F0FD] text-[#7C3AED] flex items-center gap-1">
                              <RotateCw className="w-3 h-3 animate-spin" />
                              {item.stage ? STAGE_LABELS[item.stage] : 'Processing...'}
                            </span>
                          )}

                          {item.status === 'completed' && (
                            <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-[#F0FDF4] text-[#16A34A] flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" />
                              WebP Ready
                            </span>
                          )}

                          {item.status === 'failed' && (
                            <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-[#FEF2F2] text-[#DC2626]">
                              Error
                            </span>
                          )}
                        </div>

                        {/* Result size comparison */}
                        {item.status === 'completed' && item.convertedSize && (
                          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
                            <span className="text-[#5E6488]">
                              Original: <strong className="text-[#0F112E]">{formatBytes(item.originalSize || item.file.size)}</strong>
                            </span>
                            <span className="text-[#5E6488]">→</span>
                            <span className="text-[#16A34A] font-semibold">
                              WebP: {formatBytes(item.convertedSize)}
                            </span>
                            {item.usedQuality && (
                              <span className="text-[11px] font-medium px-1.5 py-0.5 rounded bg-[#F4F0FD] text-[#7C3AED]">
                                Quality: {Math.round(item.usedQuality * 100)}%
                              </span>
                            )}
                            <span className="text-[#5E6488] text-[11px]">
                              ({item.resultFileName})
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right: Actions */}
                    <div className="flex items-center gap-2 flex-shrink-0 self-end sm:self-center">
                      {item.status === 'completed' && (
                        <button
                          type="button"
                          onClick={() => downloadFile(item)}
                          data-testid="download-single-btn"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#7C3AED] text-white rounded-md text-xs font-semibold hover:bg-[#6D28D9] transition-colors shadow-sm"
                          aria-label={`Download ${item.resultFileName}`}
                        >
                          <Download className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>Download WebP</span>
                        </button>
                      )}

                      {item.status === 'failed' && (
                        <button
                          type="button"
                          onClick={() => retryFile(item.id)}
                          disabled={isConverting}
                          data-testid="retry-file-btn"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#DC2626] text-white rounded-md text-xs font-semibold hover:bg-[#B91C1C] disabled:opacity-50 transition-colors shadow-sm"
                          aria-label={`Retry ${item.file.name}`}
                        >
                          <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>Retry</span>
                        </button>
                      )}

                      {!isConverting && (
                        <button
                          type="button"
                          onClick={() => removeFile(item.id)}
                          className="p-1.5 text-[#5E6488] hover:text-[#DC2626] hover:bg-[#FEF2F2] rounded-md transition-colors"
                          aria-label={`Remove ${item.file.name}`}
                        >
                          <Trash2 className="w-4 h-4" aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Individual File Progress Bar */}
                  {(item.status === 'processing' || item.status === 'validating') && (
                    <div className="mt-3 pt-2 border-t border-[#E4E2F0]/60">
                      <ProgressBar progress={item.progress} />
                    </div>
                  )}

                  {/* Error Message */}
                  {item.status === 'failed' && item.errorMessage && (
                    <div
                      role="alert"
                      className="mt-3 pt-2 border-t border-[#FCA5A5]/60 flex items-center gap-2 text-xs font-medium text-[#DC2626]"
                    >
                      <AlertCircle className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
                      <span>{item.errorMessage}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* WebP Quality Options */}
            <div className="p-5 bg-[#F4F3FA] border border-[#E4E2F0] rounded-lg space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#5E6488]">
                WebP Output Options
              </h4>

              <fieldset className="space-y-2">
                <legend className="text-sm font-semibold text-[#0F112E] mb-1">
                  WebP quality
                </legend>
                <div
                  role="radiogroup"
                  aria-label="Select WebP Quality"
                  className="grid grid-cols-3 gap-2"
                >
                  {[
                    { label: 'High — 90%', value: 0.9, id: 'quality-90' },
                    { label: 'Medium — 80%', value: 0.8, id: 'quality-80' },
                    { label: 'Low — 70%', value: 0.7, id: 'quality-70' },
                  ].map((opt) => {
                    const isSelected = quality === opt.value;
                    const inputId = `${qualityGroupId}-${opt.id}`;
                    return (
                      <label
                        key={opt.id}
                        htmlFor={inputId}
                        className={`relative flex items-center justify-center p-2.5 rounded-md border text-xs font-semibold cursor-pointer transition-all text-center ${
                          isSelected
                            ? 'bg-[#7C3AED] border-[#7C3AED] text-white shadow-sm'
                            : 'bg-white border-[#E4E2F0] text-[#0F112E] hover:bg-[#F4F0FD] hover:border-[#7C3AED]/30'
                        } ${isConverting ? 'opacity-50 pointer-events-none' : ''}`}
                      >
                        <input
                          type="radio"
                          id={inputId}
                          name="webp-quality"
                          data-testid={opt.id}
                          value={opt.value}
                          checked={isSelected}
                          disabled={isConverting}
                          onChange={() => setQuality(opt.value)}
                          className="sr-only"
                        />
                        <span>{opt.label}</span>
                      </label>
                    );
                  })}
                </div>
                <p className="text-xs text-[#5E6488] pt-0.5">
                  Higher quality produces larger files.
                </p>
              </fieldset>
            </div>

            {/* Bottom Actions Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-[#E4E2F0]">
              <div>
                <p className="text-xs text-[#5E6488]">
                  Outputs are generated client-side in your browser.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
                {/* Download All as ZIP (Available if 2 or more files completed, or 1 completed) */}
                {completedCount >= 2 && (
                  <button
                    type="button"
                    onClick={downloadAllAsZip}
                    disabled={isZipping || isConverting}
                    data-testid="download-all-zip-btn"
                    className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#0F112E] text-white rounded-lg text-sm font-semibold hover:bg-[#2C3E50] disabled:opacity-50 transition-colors shadow-sm"
                  >
                    {isZipping ? (
                      <>
                        <RotateCw className="w-4 h-4 animate-spin" aria-hidden="true" />
                        <span>Creating ZIP...</span>
                      </>
                    ) : (
                      <>
                        <Archive className="w-4 h-4" aria-hidden="true" />
                        <span>Download All ({completedCount} files as ZIP)</span>
                      </>
                    )}
                  </button>
                )}

                {/* Reset button when completed */}
                {completedCount > 0 && !hasConvertibleFiles && (
                  <button
                    type="button"
                    onClick={resetAll}
                    data-testid="convert-more-btn"
                    className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-[#E4E2F0] text-[#0F112E] rounded-lg text-sm font-semibold hover:bg-[#F4F3FA] transition-colors"
                  >
                    <RefreshCw className="w-4 h-4" aria-hidden="true" />
                    <span>Convert more files</span>
                  </button>
                )}

                {/* Main Conversion CTA */}
                {hasConvertibleFiles && (
                  <button
                    type="button"
                    onClick={startConversion}
                    disabled={isConverting || !hasConvertibleFiles}
                    data-testid="convert-button"
                    className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-[#7C3AED] text-white rounded-lg text-sm font-semibold hover:bg-[#6D28D9] disabled:opacity-50 transition-colors shadow-sm"
                  >
                    {isConverting ? (
                      <>
                        <RotateCw className="w-4 h-4 animate-spin" aria-hidden="true" />
                        <span>Converting...</span>
                      </>
                    ) : (
                      <>
                        <span>Convert to WebP</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

export default JpgToWebpController;
