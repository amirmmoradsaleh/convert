'use client';

import React, { useState, useRef, useEffect, useId } from 'react';
import {
  UploadCloud,
  FileCheck,
  RotateCw,
  CheckCircle2,
  AlertCircle,
  Download,
  Trash2,
  Plus,
  ArrowRight,
  Archive,
  RefreshCw,
} from 'lucide-react';
import { convertWebpToJpg } from '@/engines/image/convert';
import type { WorkerProgressStage } from '@/engines/image/worker/worker-types';
import { validateWebpFile, VALIDATION_LIMITS } from '@/engines/shared/validation';
import { getHumanErrorMessage } from '@/engines/shared/errors';
import {
  formatBytes,
  generateUniqueFilename,
  createZipBlob,
  triggerBlobDownload,
} from '@/engines/shared/file-utils';
import ProgressBar from './ProgressBar';

export type FileStatus = 'pending' | 'validating' | 'processing' | 'completed' | 'failed';

export interface WebpFileItem {
  id: string;
  file: File;
  previewUrl?: string;
  resultUrl?: string;
  width?: number;
  height?: number;
  status: FileStatus;
  progress: number;
  stage?: WorkerProgressStage;
  errorMessage?: string;
  resultBlob?: Blob;
  resultFileName?: string;
  originalSize?: number;
  convertedSize?: number;
  usedQuality?: number;
  usedBgColor?: string;
}

const STAGE_LABELS: Record<WorkerProgressStage, string> = {
  validating: 'Validating WebP...',
  reading: 'Reading WebP...',
  decoding: 'Decoding WebP...',
  encoding: 'Applying background & encoding JPG...',
  finalizing: 'Finalizing JPG...',
};

export function WebpToJpgController() {
  const [files, setFiles] = useState<WebpFileItem[]>([]);
  const [isConverting, setIsConverting] = useState(false);
  const [isZipping, setIsZipping] = useState(false);
  const [quality, setQuality] = useState<number>(0.9); // Default: High 90%
  const [backgroundColor, setBackgroundColor] = useState<string>('#FFFFFF'); // Default: White
  const [globalMessage, setGlobalMessage] = useState<{ type: 'error' | 'info'; text: string } | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const addMoreInputRef = useRef<HTMLInputElement>(null);
  const qualityGroupId = useId();
  const bgGroupId = useId();

  useEffect(() => {
    setIsHydrated(true);
    return () => {
      // Clean up all object URLs on unmount
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
      if (ext !== 'webp') {
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
        text: `Only WebP files are supported. ${formatRejectedCount} invalid file(s) ignored.`,
      });
    } else if (oversizedCount > 0) {
      setGlobalMessage({
        type: 'error',
        text: `Files must be under 50 MB. ${oversizedCount} oversized file(s) ignored.`,
      });
    }

    if (validNewFiles.length === 0) return;

    // Check batch limit (max 20)
    const currentCount = files.length;
    const remainingSlots = VALIDATION_LIMITS.MAX_BATCH_FILES - currentCount;

    if (remainingSlots <= 0) {
      setGlobalMessage({
        type: 'error',
        text: `You can convert a maximum of ${VALIDATION_LIMITS.MAX_BATCH_FILES} files per batch.`,
      });
      return;
    }

    const filesToTake = validNewFiles.slice(0, remainingSlots);
    if (validNewFiles.length > remainingSlots) {
      setGlobalMessage({
        type: 'info',
        text: `Only the first ${remainingSlots} files were added. Maximum batch size is ${VALIDATION_LIMITS.MAX_BATCH_FILES} files.`,
      });
    }

    // Prepare items with previews
    const newItems: WebpFileItem[] = filesToTake.map((file) => {
      const id = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      let previewUrl: string | undefined;
      try {
        previewUrl = URL.createObjectURL(file);
      } catch {
        previewUrl = undefined;
      }

      return {
        id,
        file,
        previewUrl,
        status: 'pending',
        progress: 0,
      };
    });

    setFiles((prev) => [...prev, ...newItems]);
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
    files.forEach((f) => {
      if (f.previewUrl) URL.revokeObjectURL(f.previewUrl);
      if (f.resultUrl) URL.revokeObjectURL(f.resultUrl);
    });
    setFiles([]);
    setGlobalMessage(null);
  };

  // Convert a single file through the pipeline
  const processSingleFile = async (
    item: WebpFileItem,
    existingNames: Set<string>,
    currentQuality: number,
    currentBg: string
  ): Promise<WebpFileItem> => {
    // 1. Initial Validation stage
    const validation = await validateWebpFile(item.file);
    if (!validation.valid) {
      return {
        ...item,
        status: 'failed',
        progress: 0,
        errorMessage: validation.error?.message || 'This file is not a valid WebP image.',
      };
    }

    try {
      // 2. Conversion via engine
      const result = await convertWebpToJpg(
        item.file,
        {
          quality: currentQuality,
          backgroundColor: currentBg,
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

      let resultUrl: string | undefined;
      try {
        resultUrl = URL.createObjectURL(result.blob);
      } catch {
        resultUrl = undefined;
      }

      return {
        ...item,
        status: 'completed',
        progress: 100,
        stage: 'finalizing',
        resultBlob: result.blob,
        resultUrl,
        resultFileName: uniqueName,
        width: result.width,
        height: result.height,
        originalSize: result.originalSize,
        convertedSize: result.convertedSize,
        usedQuality: currentQuality,
        usedBgColor: currentBg,
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
    const pendingOrFailed = files.filter((f) => f.status === 'pending' || f.status === 'failed');
    if (pendingOrFailed.length === 0 && files.length > 0) {
      handleClearAll();
      return;
    }

    setIsConverting(true);
    setGlobalMessage(null);

    const existingNames = new Set<string>();
    files.forEach((f) => {
      if (f.resultFileName) existingNames.add(f.resultFileName);
    });

    const concurrency = 2; // Process 2 images concurrently for optimal responsiveness
    const targetItems = [...pendingOrFailed];
    let currentIndex = 0;

    const runWorker = async () => {
      while (currentIndex < targetItems.length) {
        const item = targetItems[currentIndex++];
        if (!item) break;

        setFiles((prev) =>
          prev.map((f) => (f.id === item.id ? { ...f, status: 'validating', progress: 10, stage: 'validating' } : f))
        );

        const updated = await processSingleFile(item, existingNames, quality, backgroundColor);
        setFiles((prev) => prev.map((f) => (f.id === item.id ? updated : f)));
      }
    };

    const workers = Array.from({ length: Math.min(concurrency, targetItems.length) }, () => runWorker());
    await Promise.all(workers);

    setIsConverting(false);
  };

  // Retry a single failed file
  const handleRetryFile = async (id: string) => {
    const item = files.find((f) => f.id === id);
    if (!item || isConverting) return;

    setFiles((prev) =>
      prev.map((f) => (f.id === id ? { ...f, status: 'validating', progress: 10, stage: 'validating', errorMessage: undefined } : f))
    );

    const existingNames = new Set<string>();
    files.forEach((f) => {
      if (f.id !== id && f.resultFileName) existingNames.add(f.resultFileName);
    });

    const updated = await processSingleFile(item, existingNames, quality, backgroundColor);
    setFiles((prev) => prev.map((f) => (f.id === id ? updated : f)));
  };

  // Download single converted JPG
  const handleDownloadSingle = (item: WebpFileItem) => {
    if (!item.resultBlob || !item.resultFileName) return;
    triggerBlobDownload(item.resultBlob, item.resultFileName);
  };

  // Download all converted JPGs as a ZIP file
  const handleDownloadAllZip = async () => {
    const completedItems = files.filter((f) => f.status === 'completed' && f.resultBlob && f.resultFileName);
    if (completedItems.length === 0 || isZipping) return;

    try {
      setIsZipping(true);
      const zipPayload = completedItems.map((item) => ({
        name: item.resultFileName!,
        blob: item.resultBlob!,
      }));

      const zipBlob = await createZipBlob(zipPayload);
      triggerBlobDownload(zipBlob, 'webp-to-jpg-files.zip');
    } catch {
      setGlobalMessage({
        type: 'error',
        text: 'Failed to create ZIP archive. You can still download files individually.',
      });
    } finally {
      setIsZipping(false);
    }
  };

  // Calculations for overall progress
  const completedCount = files.filter((f) => f.status === 'completed').length;
  const failedCount = files.filter((f) => f.status === 'failed').length;
  const pendingCount = files.filter((f) => f.status === 'pending').length;
  const totalCount = files.length;
  const canConvert = (pendingCount > 0 || failedCount > 0) && !isConverting;
  const overallPercent = totalCount > 0 ? Math.round(((completedCount + failedCount) / totalCount) * 100) : 0;

  return (
    <div
      data-testid="webp-tool-container"
      data-hydrated={isHydrated ? 'true' : 'false'}
      className="bg-[#FFFFFF] border border-[#E4E2F0] rounded-card p-6 md:p-8 shadow-subtle mb-6"
    >
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Global Alert Message */}
        {globalMessage && (
          <div
            role="alert"
            className={`p-4 rounded-lg flex items-start gap-3 text-sm ${
              globalMessage.type === 'error'
                ? 'bg-[#FEF2F2] border border-[#FCA5A5] text-[#991B1B]'
                : 'bg-[#F4F0FD] border border-[#BAE6FD] text-[#0369A1]'
            }`}
          >
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" aria-hidden="true" />
            <p className="flex-1">{globalMessage.text}</p>
          </div>
        )}

        {/* Dropzone view when no files selected */}
        {files.length === 0 ? (
          <>
            <input
              ref={fileInputRef}
              id="webp-file-input"
              data-testid="webp-file-input"
              type="file"
              multiple
              accept=".webp,image/webp"
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  handleFilesAdded(Array.from(e.target.files));
                  e.target.value = '';
                }
              }}
              className="sr-only"
              tabIndex={-1}
            />

            <label
              htmlFor="webp-file-input"
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (e.dataTransfer.files) {
                  handleFilesAdded(Array.from(e.dataTransfer.files));
                }
              }}
              className="w-full block rounded-card border-2 border-dashed border-[#E4E2F0] hover:border-[#7C3AED]/60 bg-[#FFFFFF] hover:bg-[#F4F3FA] p-8 md:p-12 text-center transition-all cursor-pointer focus-within:ring-2 focus-within:ring-[#7C3AED]"
            >
              <div className="flex flex-col items-center justify-center">
                <div className="w-16 h-16 rounded-full bg-[#F4F0FD] text-[#7C3AED] flex items-center justify-center mb-4 transition-transform group-hover:scale-105">
                  <UploadCloud className="w-8 h-8" aria-hidden="true" />
                </div>

                <div className="space-y-1.5 mb-3">
                  <p className="text-xl md:text-2xl font-bold text-[#0F112E]">
                    <span className="text-[#7C3AED] underline decoration-[#7C3AED]/40 hover:decoration-[#7C3AED]">
                      Drag &amp; drop your WEBP files here
                    </span>{' '}
                    or browse files
                  </p>
                  <p className="text-sm text-[#5E6488]">
                    Fast, private conversion to high-quality, universal JPG format
                  </p>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-[#5E6488] mt-2">
                  <span className="bg-[#F4F3FA] border border-[#E4E2F0] px-2.5 py-1 rounded-md font-medium">
                    Format: WEBP
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
                      id="webp-add-more-input"
                      data-testid="webp-add-more-input"
                      type="file"
                      multiple
                      accept=".webp,image/webp"
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
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#7C3AED] bg-[#F4F0FD] hover:bg-[#EDE8FA] rounded-md transition-colors disabled:opacity-50"
                    >
                      <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Add More</span>
                    </button>
                  </>
                )}

                <button
                  type="button"
                  onClick={handleClearAll}
                  disabled={isConverting}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#5E6488] hover:text-[#DC2626] hover:bg-[#FEF2F2] rounded-md transition-colors disabled:opacity-50"
                >
                  <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Clear All</span>
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
                          <span className="font-medium text-[#7C3AED]">WEBP</span>
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
                              JPG Ready
                            </span>
                          )}

                          {item.status === 'failed' && (
                            <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-[#FEF2F2] text-[#DC2626]">
                              Error
                            </span>
                          )}
                        </div>

                        {/* Result size & options comparison */}
                        {item.status === 'completed' && item.originalSize && item.convertedSize && (
                          <div className="flex flex-wrap items-center gap-1.5 text-xs text-[#16A34A] mt-1 font-medium">
                            <span>{formatBytes(item.originalSize)}</span>
                            <ArrowRight className="w-3 h-3 text-[#5E6488]" aria-hidden="true" />
                            <span>{formatBytes(item.convertedSize)}</span>
                            <span className="text-xs text-[#5E6488] ml-1">
                              ({item.resultFileName})
                            </span>
                            {item.usedQuality && (
                              <span className="text-[11px] text-[#5E6488] bg-[#F4F3FA] border border-[#E4E2F0] px-1.5 py-0.5 rounded">
                                Quality: {Math.round(item.usedQuality * 100)}%
                              </span>
                            )}
                            {item.usedBgColor && (
                              <span className="text-[11px] text-[#5E6488] bg-[#F4F3FA] border border-[#E4E2F0] px-1.5 py-0.5 rounded">
                                Background: {item.usedBgColor === '#000000' ? 'Black' : 'White'}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right: Actions */}
                    <div className="flex items-center gap-2 justify-end flex-shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-[#E4E2F0]">
                      {item.status === 'completed' && (
                        <button
                          type="button"
                          onClick={() => handleDownloadSingle(item)}
                          data-testid="download-single-btn"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#7C3AED] text-white rounded-md text-xs font-semibold hover:bg-[#6D28D9] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C3AED]"
                          aria-label={`Download converted ${item.resultFileName}`}
                        >
                          <Download className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>Download</span>
                        </button>
                      )}

                      {item.status === 'failed' && (
                        <button
                          type="button"
                          onClick={() => handleRetryFile(item.id)}
                          disabled={isConverting}
                          data-testid="retry-file-btn"
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#DC2626] text-white rounded-md text-xs font-medium hover:bg-[#B91C1C] transition-colors disabled:opacity-50"
                          aria-label={`Retry converting ${item.file.name}`}
                        >
                          <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>Retry</span>
                        </button>
                      )}

                      {item.status !== 'processing' && item.status !== 'validating' && (
                        <button
                          type="button"
                          onClick={() => handleRemoveFile(item.id)}
                          disabled={isConverting}
                          aria-label={`Remove file ${item.file.name}`}
                          className="p-1.5 text-[#5E6488] hover:text-[#DC2626] hover:bg-[#FEF2F2] rounded-md transition-colors"
                        >
                          <Trash2 className="w-4 h-4" aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Stage-based progress bar per processing file */}
                  {(item.status === 'processing' || item.status === 'validating') && (
                    <div className="mt-3 pt-2 border-t border-[#7C3AED]/10">
                      <div className="flex justify-between text-xs text-[#7C3AED] font-medium mb-1">
                        <span>{item.stage ? STAGE_LABELS[item.stage] : 'Processing image...'}</span>
                        <span>{item.progress}%</span>
                      </div>
                      <ProgressBar progress={item.progress} />
                    </div>
                  )}

                  {/* Inline error message */}
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

            {/* WEBP → JPG Conversion Options (Placed between file list and conversion CTA) */}
            <div className="p-5 bg-[#F4F3FA] border border-[#E4E2F0] rounded-lg space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#5E6488]">
                JPG Output Options
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* 1. Quality Setting */}
                <fieldset className="space-y-2">
                  <legend className="text-sm font-semibold text-[#0F112E] mb-1">
                    JPG quality
                  </legend>
                  <div
                    role="radiogroup"
                    aria-label="Select JPG Quality"
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
                            name="webp-jpg-quality"
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

                {/* 2. Background Option for Transparency */}
                <fieldset className="space-y-2">
                  <legend className="text-sm font-semibold text-[#0F112E] mb-1">
                    Background
                  </legend>
                  <div
                    role="radiogroup"
                    aria-label="Select background color for transparent areas"
                    className="grid grid-cols-2 gap-2"
                  >
                    {[
                      { label: 'White', value: '#FFFFFF', id: 'bg-white', dot: 'bg-white border border-gray-300' },
                      { label: 'Black', value: '#000000', id: 'bg-black', dot: 'bg-black border border-gray-600' },
                    ].map((opt) => {
                      const isSelected = backgroundColor === opt.value;
                      const inputId = `${bgGroupId}-${opt.id}`;
                      return (
                        <label
                          key={opt.id}
                          htmlFor={inputId}
                          className={`relative flex items-center justify-center gap-2 p-2.5 rounded-md border text-xs font-semibold cursor-pointer transition-all text-center ${
                            isSelected
                              ? 'bg-[#7C3AED] border-[#7C3AED] text-white shadow-sm'
                              : 'bg-white border-[#E4E2F0] text-[#0F112E] hover:bg-[#F4F0FD] hover:border-[#7C3AED]/30'
                          } ${isConverting ? 'opacity-50 pointer-events-none' : ''}`}
                        >
                          <input
                            type="radio"
                            id={inputId}
                            name="webp-jpg-bg-color"
                            data-testid={opt.id}
                            value={opt.value}
                            checked={isSelected}
                            disabled={isConverting}
                            onChange={() => setBackgroundColor(opt.value)}
                            className="sr-only"
                          />
                          <span
                            className={`w-3 h-3 rounded-full ${opt.dot} flex-shrink-0`}
                            aria-hidden="true"
                          />
                          <span>{opt.label}</span>
                        </label>
                      );
                    })}
                  </div>
                  <p className="text-xs text-[#5E6488] pt-0.5">
                    Fills transparent areas of the WebP before saving as JPG.
                  </p>
                </fieldset>
              </div>
            </div>

            {/* Bottom Action Bar */}
            <div className="pt-4 border-t border-[#E4E2F0] flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-xs text-[#5E6488] text-center sm:text-left">
                <span>All conversion takes place locally in your browser. Files are never uploaded to our server.</span>
              </div>

              <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto justify-end">
                {/* Download All ZIP button */}
                {completedCount > 1 && (
                  <button
                    type="button"
                    data-testid="download-all-zip-btn"
                    onClick={handleDownloadAllZip}
                    disabled={isZipping || isConverting}
                    className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#F4F0FD] border border-[#7C3AED] text-[#7C3AED] rounded-lg text-sm font-semibold hover:bg-[#EDE8FA] transition-colors disabled:opacity-50"
                  >
                    <Archive className="w-4 h-4" aria-hidden="true" />
                    <span>{isZipping ? 'Creating ZIP...' : 'Download All (ZIP)'}</span>
                  </button>
                )}

                {/* Primary Convert button */}
                <button
                  type="button"
                  data-testid="convert-btn"
                  onClick={startConversion}
                  disabled={!canConvert && !(completedCount > 0 && pendingCount === 0)}
                  className={`flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                    canConvert || (completedCount > 0 && pendingCount === 0)
                      ? 'bg-[#7C3AED] text-white hover:bg-[#6D28D9] shadow-sm hover:shadow'
                      : 'bg-[#E4E2F0] text-[#9CA3AF] cursor-not-allowed'
                  }`}
                >
                  {isConverting ? (
                    <>
                      <RotateCw className="w-4 h-4 animate-spin" aria-hidden="true" />
                      <span>Converting ({completedCount + failedCount}/{totalCount})...</span>
                    </>
                  ) : completedCount > 0 && pendingCount === 0 ? (
                    <>
                      <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                      <span>Convert More Files</span>
                    </>
                  ) : (
                    <>
                      <ArrowRight className="w-4 h-4" aria-hidden="true" />
                      <span>Convert to JPG</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default WebpToJpgController;
