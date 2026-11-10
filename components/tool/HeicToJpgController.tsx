'use client';

import React, { useState, useRef, useEffect, useId } from 'react';
import {
  UploadCloud,
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
import { convertHeicToJpg } from '@/engines/image/convert';
import type { WorkerProgressStage } from '@/engines/image/worker/worker-types';
import { validateHeicFile, VALIDATION_LIMITS } from '@/engines/shared/validation';
import { getHumanErrorMessage } from '@/engines/shared/errors';
import {
  formatBytes,
  generateUniqueFilename,
  createZipBlob,
  triggerBlobDownload,
} from '@/engines/shared/file-utils';
import ProgressBar from './ProgressBar';

export type FileStatus = 'pending' | 'validating' | 'processing' | 'completed' | 'failed';

export interface HeicFileItem {
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
}

const STAGE_LABELS: Record<WorkerProgressStage, string> = {
  validating: 'Validating HEIC container...',
  reading: 'Preparing HEIC converter...',
  decoding: 'Decoding HEIC image...',
  encoding: 'Encoding JPG at selected quality...',
  finalizing: 'Finalizing JPG...',
};

export function HeicToJpgController() {
  const [files, setFiles] = useState<HeicFileItem[]>([]);
  const [isConverting, setIsConverting] = useState(false);
  const [isZipping, setIsZipping] = useState(false);
  const [quality, setQuality] = useState<number>(0.9); // Default: High 90%
  const [globalMessage, setGlobalMessage] = useState<{ type: 'error' | 'info'; text: string } | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const addMoreInputRef = useRef<HTMLInputElement>(null);
  const qualityGroupId = useId();

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
      if (ext !== 'heic') {
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
        text: `Only HEIC files (.heic) are supported. ${formatRejectedCount} invalid file(s) ignored.`,
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
        text: `Maximum limit of ${VALIDATION_LIMITS.MAX_BATCH_FILES} files reached.`,
      });
      return;
    }

    const filesToProcess = validNewFiles.slice(0, remainingSlots);
    if (validNewFiles.length > remainingSlots) {
      setGlobalMessage({
        type: 'info',
        text: `Added ${remainingSlots} files. Maximum batch size is ${VALIDATION_LIMITS.MAX_BATCH_FILES} files.`,
      });
    }

    // Initialize items with validating status
    const initialItems: HeicFileItem[] = filesToProcess.map((file) => {
      return {
        id: `heic_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
        file,
        status: 'validating',
        progress: 0,
        stage: 'validating',
      };
    });

    setFiles((prev) => [...prev, ...initialItems]);

    // Validate container & brands asynchronously
    for (const item of initialItems) {
      const result = await validateHeicFile(item.file);
      if (!result.valid && result.error) {
        setFiles((prev) =>
          prev.map((f) =>
            f.id === item.id
              ? {
                  ...f,
                  status: 'failed',
                  errorMessage: getHumanErrorMessage(result.error),
                }
              : f
          )
        );
      } else {
        setFiles((prev) =>
          prev.map((f) =>
            f.id === item.id
              ? {
                  ...f,
                  status: 'pending',
                }
              : f
          )
        );
      }
    }
  };

  const handleRemoveFile = (id: string) => {
    if (isConverting) return;
    setFiles((prev) => {
      const target = prev.find((f) => f.id === id);
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      if (target?.resultUrl) URL.revokeObjectURL(target.resultUrl);
      return prev.filter((f) => f.id !== id);
    });
  };

  const handleClearAll = () => {
    if (isConverting) return;
    files.forEach((f) => {
      if (f.previewUrl) URL.revokeObjectURL(f.previewUrl);
      if (f.resultUrl) URL.revokeObjectURL(f.resultUrl);
    });
    setFiles([]);
    setGlobalMessage(null);
  };

  const handleConvertAll = async () => {
    if (isConverting) return;
    setGlobalMessage(null);

    const pendingItems = files.filter(
      (f) => f.status === 'pending' || f.status === 'failed' || f.status === 'validating'
    );
    if (pendingItems.length === 0) return;

    setIsConverting(true);

    const activeQuality = quality;

    // Process files sequentially to control browser memory during heavy HEIC decoding
    for (const item of pendingItems) {
      // Re-validate container if necessary
      const valResult = await validateHeicFile(item.file);
      if (!valResult.valid && valResult.error) {
        setFiles((prev) =>
          prev.map((f) =>
            f.id === item.id
              ? {
                  ...f,
                  status: 'failed',
                  errorMessage: getHumanErrorMessage(valResult.error),
                }
              : f
          )
        );
        continue;
      }

      setFiles((prev) =>
        prev.map((f) =>
          f.id === item.id
            ? {
                ...f,
                status: 'processing',
                progress: 5,
                stage: 'validating',
                errorMessage: undefined,
              }
            : f
        )
      );

      try {
        const result = await convertHeicToJpg(
          item.file,
          {
            quality: activeQuality,
          },
          (progress, stage) => {
            setFiles((prev) =>
              prev.map((f) =>
                f.id === item.id
                  ? {
                      ...f,
                      progress,
                      stage,
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
                  stage: 'finalizing',
                  resultBlob: result.blob,
                  resultUrl,
                  resultFileName: result.fileName,
                  width: result.width,
                  height: result.height,
                  originalSize: result.originalSize,
                  convertedSize: result.convertedSize,
                  usedQuality: activeQuality,
                }
              : f
          )
        );
      } catch (err: unknown) {
        const msg = getHumanErrorMessage(err);
        setFiles((prev) =>
          prev.map((f) =>
            f.id === item.id
              ? {
                  ...f,
                  status: 'failed',
                  errorMessage: msg,
                }
              : f
          )
        );
      }
    }

    setIsConverting(false);
  };

  const handleRetryFile = async (id: string) => {
    if (isConverting) return;
    const item = files.find((f) => f.id === id);
    if (!item) return;

    if (item.resultUrl) {
      URL.revokeObjectURL(item.resultUrl);
    }

    setIsConverting(true);
    setFiles((prev) =>
      prev.map((f) =>
        f.id === id
          ? {
              ...f,
              status: 'processing',
              progress: 5,
              stage: 'validating',
              errorMessage: undefined,
            }
          : f
      )
    );

    try {
      const activeQuality = quality;
      const result = await convertHeicToJpg(
        item.file,
        {
          quality: activeQuality,
        },
        (progress, stage) => {
          setFiles((prev) =>
            prev.map((f) =>
              f.id === id
                ? {
                    ...f,
                    progress,
                    stage,
                  }
                : f
            )
          );
        }
      );

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
                width: result.width,
                height: result.height,
                originalSize: result.originalSize,
                convertedSize: result.convertedSize,
                usedQuality: activeQuality,
              }
            : f
        )
      );
    } catch (err: unknown) {
      const msg = getHumanErrorMessage(err);
      setFiles((prev) =>
        prev.map((f) =>
          f.id === id
            ? {
                ...f,
                status: 'failed',
                errorMessage: msg,
              }
            : f
        )
      );
    } finally {
      setIsConverting(false);
    }
  };

  const handleDownloadSingle = (item: HeicFileItem) => {
    if (!item.resultBlob || !item.resultFileName) return;
    triggerBlobDownload(item.resultBlob, item.resultFileName);
  };

  const handleDownloadZip = async () => {
    const completedItems = files.filter(
      (f) => f.status === 'completed' && f.resultBlob && f.resultFileName
    );
    if (completedItems.length === 0 || isZipping) return;

    setIsZipping(true);
    try {
      const usedNames = new Set<string>();
      const zipEntries = completedItems.map((item) => {
        const uniqueName = generateUniqueFilename(item.resultFileName!, usedNames);
        usedNames.add(uniqueName);
        return {
          name: uniqueName,
          blob: item.resultBlob!,
        };
      });

      const zipBlob = await createZipBlob(zipEntries);
      triggerBlobDownload(zipBlob, 'heic-to-jpg-files.zip');
    } catch {
      setGlobalMessage({
        type: 'error',
        text: 'Failed to generate ZIP archive. Please try downloading files individually.',
      });
    } finally {
      setIsZipping(false);
    }
  };

  const completedCount = files.filter((f) => f.status === 'completed').length;
  const pendingCount = files.filter((f) => f.status === 'pending' || f.status === 'validating').length;
  const failedCount = files.filter((f) => f.status === 'failed').length;
  const allDone = files.length > 0 && files.every((f) => f.status === 'completed' || f.status === 'failed');

  return (
    <div
      data-testid="heic-to-jpg-tool-container"
      data-hydrated={isHydrated ? 'true' : 'false'}
      className="bg-[#FFFFFF] border border-[#E4E2F0] rounded-card p-6 md:p-8 shadow-subtle mb-6"
    >
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Global Alert Message */}
        {globalMessage && (
          <div
            role="alert"
            className={`p-4 rounded-xl flex items-start gap-3 text-sm ${
              globalMessage.type === 'error'
                ? 'bg-[#FEF2F2] border border-[#FCA5A5] text-[#991B1B]'
                : 'bg-[#F0FDF4] border border-[#BBF7D0] text-[#166534]'
            }`}
          >
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-rose-600" aria-hidden="true" />
            <p className="flex-1">{globalMessage.text}</p>
          </div>
        )}

        {/* Initial Empty Upload State */}
        {files.length === 0 ? (
          <>
            <input
              ref={fileInputRef}
              id="heic-file-input"
              data-testid="heic-file-input"
              type="file"
              multiple
              accept=".heic,image/heic"
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
              htmlFor="heic-file-input"
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
                      Choose HEIC files
                    </span>{' '}
                    or drag &amp; drop here
                  </p>
                  <p className="text-sm text-[#5E6488]">
                    Convert Apple iPhone &amp; iPad HEIC photos into high-quality standard JPG images
                  </p>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-[#5E6488] mt-2">
                  <span className="bg-[#F4F3FA] border border-[#E4E2F0] px-2.5 py-1 rounded-md font-medium">
                    Format: HEIC
                  </span>
                  <span className="bg-[#F4F3FA] border border-[#E4E2F0] px-2.5 py-1 rounded-md font-medium">
                    Max: 50 MB per file
                  </span>
                  <span className="bg-[#F4F3FA] border border-[#E4E2F0] px-2.5 py-1 rounded-md font-medium">
                    Up to 20 files
                  </span>
                </div>
              </div>
            </label>
          </>
        ) : (
          /* Active File Management & Conversion Workflow */
          <div className="space-y-6">
            {/* Options & Action Bar */}
            <div className="p-4 md:p-5 bg-[#F4F3FA] border border-[#E2E8F0] rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-6">
                {/* JPG Quality Selector */}
                <div>
                  <label id={qualityGroupId} className="block text-xs font-semibold text-[#475569] uppercase tracking-wider mb-2">
                    JPG Quality
                  </label>
                  <div
                    role="radiogroup"
                    aria-labelledby={qualityGroupId}
                    className="inline-flex p-1 bg-[#E2E8F0] rounded-lg gap-1"
                  >
                    {[
                      { label: 'High (90%)', value: 0.9, id: 'q-90' },
                      { label: 'Medium (80%)', value: 0.8, id: 'q-80' },
                      { label: 'Low (70%)', value: 0.7, id: 'q-70' },
                    ].map((preset) => (
                      <button
                        key={preset.id}
                        type="button"
                        role="radio"
                        aria-checked={quality === preset.value}
                        disabled={isConverting}
                        onClick={() => setQuality(preset.value)}
                        className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                          quality === preset.value
                            ? 'bg-white text-[#0F112E] shadow-sm font-semibold'
                            : 'text-[#64748B] hover:text-[#1E293B]'
                        } ${isConverting ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Batch Status & Top Buttons */}
              <div className="flex items-center gap-2 self-end md:self-auto">
                <input
                  ref={addMoreInputRef}
                  type="file"
                  accept=".heic,image/heic"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0) {
                      handleFilesAdded(Array.from(e.target.files));
                      e.target.value = '';
                    }
                  }}
                />
                {files.length < VALIDATION_LIMITS.MAX_BATCH_FILES && !isConverting && (
                  <button
                    type="button"
                    onClick={() => addMoreInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-[#475569] bg-white border border-[#CBD5E1] rounded-lg hover:bg-[#F1F5F9] transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add more
                  </button>
                )}
                {!isConverting && (
                  <button
                    type="button"
                    onClick={handleClearAll}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-rose-600 bg-white border border-rose-200 rounded-lg hover:bg-rose-50 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Clear all
                  </button>
                )}
              </div>
            </div>

            {/* Files List */}
            <div className="space-y-3" role="region" aria-label="Selected HEIC files">
              {files.map((item, index) => {
                const ext = item.file.name.split('.').pop()?.toUpperCase() || 'HEIC';
                return (
                  <div
                    key={item.id}
                    id={`file-item-${index}`}
                    className="p-4 bg-white border border-[#E2E8F0] rounded-xl flex flex-col gap-3 shadow-xs"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-lg bg-[#EFF6FF] border border-[#BFDBFE] flex items-center justify-center shrink-0">
                          <span className="text-xs font-bold text-[#2563EB]">{ext}</span>
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-[#1E293B] truncate">
                            {item.file.name}
                          </p>
                          <p className="text-xs text-[#64748B]">
                            {formatBytes(item.file.size)}
                            {item.status === 'completed' && item.convertedSize && (
                              <span className="text-emerald-600 font-medium">
                                {' '}
                                → {formatBytes(item.convertedSize)} (JPG)
                              </span>
                            )}
                          </p>
                        </div>
                      </div>

                      {/* Status Badge & Action Controls */}
                      <div className="flex items-center gap-2 shrink-0">
                        {item.status === 'validating' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
                            <RotateCw className="w-3 h-3 animate-spin" />
                            Validating
                          </span>
                        )}

                        {item.status === 'pending' && (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
                            Ready
                          </span>
                        )}

                        {item.status === 'processing' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                            <RotateCw className="w-3 h-3 animate-spin" />
                            {item.stage ? STAGE_LABELS[item.stage] : 'Processing...'}
                          </span>
                        )}

                        {item.status === 'completed' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            Done
                          </span>
                        )}

                        {item.status === 'failed' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-rose-50 text-rose-700 border border-rose-200">
                            <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                            Failed
                          </span>
                        )}

                        {/* Single File Download Button */}
                        {item.status === 'completed' && item.resultBlob && (
                          <button
                            type="button"
                            id={`download-btn-${index}`}
                            onClick={() => handleDownloadSingle(item)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs transition-colors"
                            aria-label={`Download converted JPG for ${item.file.name}`}
                          >
                            <Download className="w-3.5 h-3.5" />
                            Download
                          </button>
                        )}

                        {/* Retry Button */}
                        {item.status === 'failed' && !isConverting && (
                          <button
                            type="button"
                            id={`retry-btn-${index}`}
                            onClick={() => handleRetryFile(item.id)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-[#2563EB] bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors"
                            aria-label={`Retry converting ${item.file.name}`}
                          >
                            <RefreshCw className="w-3 h-3" />
                            Retry
                          </button>
                        )}

                        {/* Remove Button */}
                        {!isConverting && item.status !== 'completed' && (
                          <button
                            type="button"
                            onClick={() => handleRemoveFile(item.id)}
                            className="p-1.5 text-[#94A3B8] hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
                            aria-label={`Remove ${item.file.name}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Per-item progress bar during processing */}
                    {item.status === 'processing' && (
                      <div className="mt-1">
                        <ProgressBar
                          progress={item.progress}
                          label={item.stage ? STAGE_LABELS[item.stage] : 'Converting HEIC to JPG...'}
                        />
                      </div>
                    )}

                    {/* Error detail */}
                    {item.status === 'failed' && item.errorMessage && (
                      <p className="text-xs text-rose-600 bg-rose-50 p-2.5 rounded-lg border border-rose-100">
                        {item.errorMessage}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Batch Progress Bar when converting */}
            {isConverting && (
              <div className="p-4 bg-blue-50/50 border border-blue-100 rounded-xl" aria-live="polite">
                <div className="flex items-center justify-between text-xs font-semibold text-[#1E293B] mb-2">
                  <span>
                    Processing batch ({completedCount + failedCount} / {files.length} files)
                  </span>
                  <span>
                    {Math.round(((completedCount + failedCount) / files.length) * 100)}%
                  </span>
                </div>
                <div className="w-full bg-blue-100 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-[#2563EB] h-2 transition-all duration-300 rounded-full"
                    style={{
                      width: `${((completedCount + failedCount) / files.length) * 100}%`,
                    }}
                  />
                </div>
              </div>
            )}

            {/* Main Action Footer */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-xs text-[#64748B]">
                {completedCount > 0 && `${completedCount} of ${files.length} converted successfully.`}
                {failedCount > 0 && ` ${failedCount} failed.`}
                {pendingCount > 0 && ` ${pendingCount} ready to convert.`}
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto">
                {/* Convert Button */}
                {!allDone && (
                  <button
                    type="button"
                    id="convert-heic-btn"
                    disabled={isConverting || pendingCount === 0}
                    onClick={handleConvertAll}
                    className={`w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm shadow-sm transition-all ${
                      isConverting || pendingCount === 0
                        ? 'bg-[#E2E8F0] text-[#94A3B8] cursor-not-allowed'
                        : 'bg-[#2563EB] text-white hover:bg-[#1D4ED8] hover:shadow-md'
                    }`}
                  >
                    {isConverting ? (
                      <>
                        <RotateCw className="w-4 h-4 animate-spin" />
                        Converting...
                      </>
                    ) : (
                      <>
                        Convert to JPG
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                )}

                {/* Download All (ZIP) Button */}
                {completedCount > 0 && (
                  <button
                    type="button"
                    id="download-all-zip-btn"
                    disabled={isZipping || isConverting}
                    onClick={handleDownloadZip}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-semibold text-sm text-emerald-700 bg-emerald-50 border border-emerald-300 hover:bg-emerald-100 hover:border-emerald-400 shadow-xs transition-all"
                  >
                    {isZipping ? (
                      <>
                        <RotateCw className="w-4 h-4 animate-spin text-emerald-600" />
                        Creating ZIP...
                      </>
                    ) : (
                      <>
                        <Archive className="w-4 h-4 text-emerald-600" />
                        Download All (ZIP)
                      </>
                    )}
                  </button>
                )}

                {/* Reset / Convert More Files Button */}
                {allDone && (
                  <button
                    type="button"
                    id="convert-more-btn"
                    onClick={handleClearAll}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-semibold text-sm text-[#475569] bg-white border border-[#CBD5E1] hover:bg-[#F1F5F9] shadow-xs transition-all"
                  >
                    <RefreshCw className="w-4 h-4 text-[#64748B]" />
                    Convert more files
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

export default HeicToJpgController;
