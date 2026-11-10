'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  UploadCloud,
  FileCheck,
  AlertCircle,
  RotateCw,
  Trash2,
  Download,
  Archive,
  Plus,
  ArrowRight,
  RefreshCw,
  Info,
} from 'lucide-react';
import { formatBytes, triggerBlobDownload, createZipBlob, generateUniqueFilename } from '@/engines/shared/file-utils';
import { VALIDATION_LIMITS, validateGifFile } from '@/engines/shared/validation';
import { convertGifToPng } from '@/engines/image/convert';
import type { WorkerProgressStage } from '@/engines/image/worker/worker-types';
import ProgressBar from './ProgressBar';

export interface GifFileItem {
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
  isAnimated?: boolean;
}

const STAGE_LABELS: Record<WorkerProgressStage, string> = {
  validating: 'Validating GIF...',
  reading: 'Reading file data...',
  decoding: 'Decoding first frame...',
  encoding: 'Encoding PNG...',
  finalizing: 'Finalizing...',
};

export function GifToPngController() {
  const [isHydrated, setIsHydrated] = useState(false);
  const [files, setFiles] = useState<GifFileItem[]>([]);
  const [isConverting, setIsConverting] = useState(false);
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

  const handleFilesAdded = useCallback(
    async (incomingFiles: File[]) => {
      setGlobalMessage(null);

      if (incomingFiles.length === 0) return;

      const currentCount = files.length;
      if (currentCount + incomingFiles.length > VALIDATION_LIMITS.MAX_BATCH_FILES) {
        setGlobalMessage({
          type: 'error',
          text: `You can convert up to ${VALIDATION_LIMITS.MAX_BATCH_FILES} files at a time. Only the first ${
            VALIDATION_LIMITS.MAX_BATCH_FILES - currentCount
          } eligible files were added.`,
        });
      }

      const allowedIncoming = incomingFiles.slice(
        0,
        Math.max(0, VALIDATION_LIMITS.MAX_BATCH_FILES - currentCount)
      );

      const validatedItems: GifFileItem[] = [];

      for (const file of allowedIncoming) {
        const id = `${file.name}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
        const ext = file.name.split('.').pop()?.toLowerCase() || '';

        // Quick extension check
        if (ext !== 'gif') {
          validatedItems.push({
            id,
            file,
            status: 'failed',
            progress: 0,
            errorMessage: 'Only GIF files are supported.',
          });
          continue;
        }

        // Quick size check
        if (file.size > VALIDATION_LIMITS.MAX_IMAGE_SIZE_BYTES) {
          validatedItems.push({
            id,
            file,
            status: 'failed',
            progress: 0,
            errorMessage: 'This file is too large. Maximum size is 50 MB.',
          });
          continue;
        }

        // Deep header & magic bytes check
        const val = await validateGifFile(file);
        if (!val.valid) {
          validatedItems.push({
            id,
            file,
            status: 'failed',
            progress: 0,
            errorMessage: val.error?.message || 'This file is not a valid GIF image.',
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
          isAnimated: val.isAnimated,
          width: val.dimensions?.width,
          height: val.dimensions?.height,
        });
      }

      setFiles((prev) => [...prev, ...validatedItems]);
    },
    [files.length]
  );

  const onDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      if (isConverting) return;

      const droppedFiles = Array.from(e.dataTransfer.files || []);
      if (droppedFiles.length > 0) {
        handleFilesAdded(droppedFiles);
      }
    },
    [handleFilesAdded, isConverting]
  );

  const onDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length > 0) {
      handleFilesAdded(selectedFiles);
    }
    // Reset file input value so same files can be selected again
    e.target.value = '';
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

  const convertBatch = async () => {
    if (isConverting || files.length === 0) return;

    setIsConverting(true);
    setGlobalMessage(null);

    const pendingFiles = files.filter((f) => f.status === 'pending' || f.status === 'failed');

    for (const item of pendingFiles) {
      // Set to processing
      setFiles((prev) =>
        prev.map((f) =>
          f.id === item.id
            ? { ...f, status: 'processing', progress: 5, stage: 'validating', errorMessage: undefined }
            : f
        )
      );

      try {
        const result = await convertGifToPng(item.file, (progress, stage) => {
          setFiles((prev) =>
            prev.map((f) => (f.id === item.id ? { ...f, progress, stage } : f))
          );
        });

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
                  width: result.width,
                  height: result.height,
                }
              : f
          )
        );
      } catch (err: unknown) {
        let msg = "We couldn't convert this GIF. Please try again.";
        if (err && typeof err === 'object' && 'message' in err && typeof err.message === 'string') {
          msg = err.message;
        }

        setFiles((prev) =>
          prev.map((f) =>
            f.id === item.id
              ? {
                  ...f,
                  status: 'failed',
                  progress: 0,
                  errorMessage: msg,
                }
              : f
          )
        );
      }
    }

    setIsConverting(false);
  };

  const retrySingle = async (id: string) => {
    if (isConverting) return;
    const item = files.find((f) => f.id === id);
    if (!item) return;

    setIsConverting(true);
    setFiles((prev) =>
      prev.map((f) =>
        f.id === id
          ? { ...f, status: 'processing', progress: 5, stage: 'validating', errorMessage: undefined }
          : f
      )
    );

    try {
      const result = await convertGifToPng(item.file, (progress, stage) => {
        setFiles((prev) =>
          prev.map((f) => (f.id === id ? { ...f, progress, stage } : f))
        );
      });

      const resultUrl = URL.createObjectURL(result.blob);

      setFiles((prev) =>
        prev.map((f) =>
          f.id === id
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
                width: result.width,
                height: result.height,
              }
            : f
        )
      );
    } catch (err: unknown) {
      let msg = "We couldn't convert this GIF. Please try again.";
      if (err && typeof err === 'object' && 'message' in err && typeof err.message === 'string') {
        msg = err.message;
      }

      setFiles((prev) =>
        prev.map((f) =>
          f.id === id
            ? {
                ...f,
                status: 'failed',
                progress: 0,
                errorMessage: msg,
              }
            : f
        )
      );
    } finally {
      setIsConverting(false);
    }
  };

  const downloadSingle = (item: GifFileItem) => {
    if (!item.resultBlob || !item.resultFileName) return;
    triggerBlobDownload(item.resultBlob, item.resultFileName);
  };

  const downloadAllZip = async () => {
    const completedItems = files.filter((f) => f.status === 'completed' && f.resultBlob);
    if (completedItems.length === 0 || isZipping) return;

    setIsZipping(true);
    try {
      const zipEntries: { name: string; blob: Blob }[] = [];
      const usedNames = new Set<string>();

      completedItems.forEach((item) => {
        if (item.resultBlob && item.resultFileName) {
          const uniqueName = generateUniqueFilename(item.resultFileName, usedNames);
          usedNames.add(uniqueName);
          zipEntries.push({
            name: uniqueName,
            blob: item.resultBlob,
          });
        }
      });

      const zipBlob = await createZipBlob(zipEntries);
      triggerBlobDownload(zipBlob, 'gif-to-png-files.zip');
    } catch {
      setGlobalMessage({
        type: 'error',
        text: 'Failed to build ZIP archive. Please download files individually.',
      });
    } finally {
      setIsZipping(false);
    }
  };

  const resetAll = () => {
    if (isConverting) return;
    files.forEach((item) => {
      if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
      if (item.resultUrl) URL.revokeObjectURL(item.resultUrl);
    });
    setFiles([]);
    setGlobalMessage(null);
  };

  const validPendingCount = files.filter((f) => f.status === 'pending').length;
  const completedCount = files.filter((f) => f.status === 'completed').length;
  const failedCount = files.filter((f) => f.status === 'failed').length;

  return (
    <div
      id="gif-to-png-tool-root"
      data-testid="gif-to-png-tool-container"
      data-hydrated={isHydrated ? 'true' : 'false'}
      className="w-full max-w-5xl mx-auto space-y-8"
    >
      {/* Global alert / message banner */}
      {globalMessage && (
        <div
          id="gif-to-png-global-banner"
          className={`flex items-start gap-3 p-4 rounded-xl border ${
            globalMessage.type === 'error'
              ? 'bg-rose-50/80 border-rose-200 text-rose-800 dark:bg-rose-950/40 dark:border-rose-800/60 dark:text-rose-200'
              : 'bg-sky-50/80 border-sky-200 text-sky-800 dark:bg-sky-950/40 dark:border-sky-800/60 dark:text-sky-200'
          }`}
          role="alert"
        >
          {globalMessage.type === 'error' ? (
            <AlertCircle className="w-5 h-5 shrink-0 text-rose-500 mt-0.5" />
          ) : (
            <Info className="w-5 h-5 shrink-0 text-sky-500 mt-0.5" />
          )}
          <p className="text-sm font-medium leading-relaxed">{globalMessage.text}</p>
        </div>
      )}

      {/* Frame conversion notice callout */}
      <div
        id="gif-first-frame-notice"
        className="flex items-center gap-3 p-3.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-900 dark:text-amber-200"
      >
        <Info className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
        <p className="text-xs sm:text-sm font-medium">
          <strong>Note:</strong> Animated GIF files are converted using the first frame. Transparent pixels are preserved in the output PNG.
        </p>
      </div>

      {/* Upload Zone (when no files uploaded yet) */}
      {files.length === 0 && (
        <div
          id="gif-upload-dropzone"
          data-testid="gif-dropzone"
          onDrop={onDrop}
          onDragOver={onDragOver}
          onClick={() => fileInputRef.current?.click()}
          className="group relative flex flex-col items-center justify-center p-8 sm:p-12 text-center rounded-2xl border-2 border-dashed border-[#E4E2F0] dark:border-zinc-700 bg-white/60 dark:bg-zinc-900/60 hover:border-[#7C3AED] dark:hover:border-[#7C3AED] hover:bg-[#F4F0FD]/40 dark:hover:bg-emerald-950/10 transition-all duration-200 cursor-pointer shadow-sm"
        >
          <input
            ref={fileInputRef}
            id="gif-file-input"
            type="file"
            accept=".gif,image/gif"
            multiple
            className="hidden"
            onChange={handleFileInputChange}
          />
          <div className="w-16 h-16 mb-4 rounded-2xl bg-[#F4F0FD] dark:bg-emerald-950/60 text-[#7C3AED] dark:text-[#A78BFA] flex items-center justify-center shadow-inner group-hover:scale-105 transition-transform duration-200">
            <UploadCloud className="w-8 h-8" />
          </div>
          <h3 className="text-lg sm:text-xl font-semibold text-[#0F112E] dark:text-zinc-100 mb-1">
            Drag &amp; drop your GIF files here
          </h3>
          <p className="text-sm text-[#5E6488] dark:text-[#5E6488] mb-4 max-w-md">
            or click to <span className="text-[#7C3AED] dark:text-[#A78BFA] font-medium underline underline-offset-2">Browse files</span> from your computer
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-[#5E6488] dark:text-[#5E6488]">
            <span className="px-2.5 py-1 rounded-full bg-[#F4F3FA] dark:bg-zinc-800 font-medium">GIF only</span>
            <span>•</span>
            <span>Max 50 MB per file</span>
            <span>•</span>
            <span>Up to 20 files</span>
          </div>
        </div>
      )}

      {/* Main Workspace (when files are selected) */}
      {files.length > 0 && (
        <div id="gif-workspace-section" className="space-y-6">
          {/* Action Toolbar Header */}
          <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-white dark:bg-zinc-900 rounded-2xl border border-[#E4E2F0] dark:border-zinc-800 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold text-[#0F112E] dark:text-zinc-100">
                {files.length} {files.length === 1 ? 'file' : 'files'} selected
              </span>
              {completedCount > 0 && (
                <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-[#F4F0FD] dark:bg-emerald-950/70 text-[#5B21B6] dark:text-emerald-300">
                  {completedCount} converted
                </span>
              )}
              {failedCount > 0 && (
                <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-rose-100 dark:bg-rose-950/70 text-rose-700 dark:text-rose-300">
                  {failedCount} failed
                </span>
              )}
            </div>

            <div className="flex items-center gap-2.5">
              {/* Add More Files Button */}
              {files.length < VALIDATION_LIMITS.MAX_BATCH_FILES && (
                <>
                  <input
                    ref={addMoreInputRef}
                    id="gif-add-more-input"
                    type="file"
                    accept=".gif,image/gif"
                    multiple
                    className="hidden"
                    onChange={handleFileInputChange}
                  />
                  <button
                    id="gif-add-more-btn"
                    type="button"
                    onClick={() => addMoreInputRef.current?.click()}
                    disabled={isConverting}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm font-medium text-zinc-700 dark:text-zinc-300 bg-[#F4F3FA] dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-xl transition-colors disabled:opacity-50"
                  >
                    <Plus className="w-4 h-4" />
                    Add More
                  </button>
                </>
              )}

              {/* Reset / Convert More Button */}
              <button
                id="gif-reset-btn"
                type="button"
                onClick={resetAll}
                disabled={isConverting}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm font-medium text-zinc-700 dark:text-zinc-300 bg-[#F4F3FA] dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-xl transition-colors disabled:opacity-50"
              >
                <RefreshCw className="w-4 h-4" />
                {completedCount > 0 ? 'Convert More Files' : 'Clear All'}
              </button>
            </div>
          </div>

          {/* Files List */}
          <div id="gif-file-list" className="space-y-3">
            {files.map((item, index) => (
              <div
                key={item.id}
                id={`gif-item-${index}`}
                data-testid={`gif-file-item-${index}`}
                className="p-4 bg-white dark:bg-zinc-900 rounded-2xl border border-[#E4E2F0]/80 dark:border-zinc-800/80 shadow-sm transition-all"
              >
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  {/* File Metadata & Preview */}
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-12 h-12 shrink-0 rounded-xl bg-[#F4F3FA] dark:bg-zinc-800 border border-[#E4E2F0] dark:border-zinc-700 flex items-center justify-center overflow-hidden">
                      {item.previewUrl ? (
                        <img
                          src={item.previewUrl}
                          alt={item.file.name}
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <FileCheck className="w-6 h-6 text-[#7C3AED]" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-[#0F112E] dark:text-zinc-100 truncate">
                          {item.file.name}
                        </p>
                        {item.status === 'completed' && (
                          <span className="px-2 py-0.5 text-[11px] font-semibold bg-[#F4F0FD] dark:bg-emerald-950/70 text-[#5B21B6] dark:text-emerald-300 rounded-full shrink-0">
                            First frame
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-[#5E6488] dark:text-[#5E6488] mt-0.5">
                        <span>{formatBytes(item.file.size)}</span>
                        {item.width && item.height && (
                          <>
                            <span>•</span>
                            <span>
                              {item.width} × {item.height} px
                            </span>
                          </>
                        )}
                        {item.status === 'completed' && item.convertedSize && (
                          <>
                            <span>•</span>
                            <span className="text-[#7C3AED] dark:text-[#A78BFA] font-medium">
                              PNG: {formatBytes(item.convertedSize)}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions & Status Badge */}
                  <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                    {item.status === 'completed' && (
                      <button
                        id={`gif-download-btn-${index}`}
                        data-testid={`download-single-btn-${index}`}
                        type="button"
                        onClick={() => downloadSingle(item)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#7C3AED] hover:bg-[#5B21B6] active:bg-[#4C1D95] rounded-xl shadow-sm transition-colors"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Download PNG
                      </button>
                    )}

                    {item.status === 'failed' && (
                      <button
                        id={`gif-retry-btn-${index}`}
                        type="button"
                        onClick={() => retrySingle(item.id)}
                        disabled={isConverting}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-950/60 hover:bg-amber-200 dark:hover:bg-amber-900 rounded-xl transition-colors disabled:opacity-50"
                      >
                        <RotateCw className="w-3.5 h-3.5" />
                        Retry
                      </button>
                    )}

                    {item.status !== 'processing' && (
                      <button
                        id={`gif-remove-btn-${index}`}
                        type="button"
                        onClick={() => removeFile(item.id)}
                        disabled={isConverting}
                        aria-label={`Remove ${item.file.name}`}
                        className="p-1.5 text-[#5E6488] hover:text-rose-600 dark:hover:text-rose-400 rounded-lg transition-colors disabled:opacity-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Processing Progress Bar */}
                {item.status === 'processing' && (
                  <div className="mt-3">
                    <ProgressBar
                      progress={item.progress}
                      label={STAGE_LABELS[item.stage || 'decoding']}
                    />
                  </div>
                )}

                {/* Error Banner */}
                {item.status === 'failed' && item.errorMessage && (
                  <div className="mt-3 flex items-start gap-2 p-2.5 bg-rose-50 dark:bg-rose-950/50 border border-rose-200/80 dark:border-rose-800/60 rounded-xl text-rose-700 dark:text-rose-300 text-xs font-medium">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{item.errorMessage}</span>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Bottom Execution Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-5 bg-zinc-900 dark:bg-zinc-800/90 text-white rounded-2xl shadow-lg">
            <div className="text-center sm:text-left">
              <h4 className="text-sm font-semibold">
                {completedCount === files.length && files.length > 0
                  ? 'All conversions complete!'
                  : `${files.length} GIF ${files.length === 1 ? 'file' : 'files'} ready to convert`}
              </h4>
              <p className="text-xs text-[#5E6488] mt-0.5">
                {completedCount > 0
                  ? `${completedCount} of ${files.length} processed`
                  : 'Lossless 24-bit PNG with full transparency support'}
              </p>
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
              {/* Download All (ZIP) if multiple converted */}
              {completedCount > 1 && (
                <button
                  id="gif-download-all-zip-btn"
                  data-testid="download-zip-btn"
                  type="button"
                  onClick={downloadAllZip}
                  disabled={isZipping}
                  className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-semibold text-[#0F112E] bg-[#F4F3FA] hover:bg-white rounded-xl shadow transition-colors disabled:opacity-50"
                >
                  <Archive className="w-4 h-4" />
                  {isZipping ? 'Building ZIP...' : 'Download All (ZIP)'}
                </button>
              )}

              {/* Convert Button */}
              {validPendingCount > 0 && (
                <button
                  id="gif-convert-action-btn"
                  data-testid="convert-btn"
                  type="button"
                  onClick={convertBatch}
                  disabled={isConverting}
                  className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-6 py-2.5 text-xs sm:text-sm font-bold text-white bg-[#7C3AED] hover:bg-[#6D28D9] active:bg-[#5B21B6] rounded-xl shadow-md transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {isConverting ? (
                    <>
                      <RotateCw className="w-4 h-4 animate-spin" />
                      <span>Converting...</span>
                    </>
                  ) : (
                    <>
                      <span>Convert to PNG</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
