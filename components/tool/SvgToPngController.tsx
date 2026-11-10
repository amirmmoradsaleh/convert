'use client';

import React, { useState, useRef, useEffect } from 'react';
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
  FileCode,
} from 'lucide-react';
import { convertSvgToPng } from '@/engines/image/convert';
import type { WorkerProgressStage } from '@/engines/image/worker/worker-types';
import { validateSvgFile, SVG_LIMITS } from '@/engines/image/svg/svg-validator';
import { getHumanErrorMessage } from '@/engines/shared/errors';
import {
  formatBytes,
  generateUniqueFilename,
  createZipBlob,
  triggerBlobDownload,
} from '@/engines/shared/file-utils';
import ProgressBar from './ProgressBar';

export type FileStatus = 'pending' | 'validating' | 'processing' | 'completed' | 'failed';

export interface SvgFileItem {
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
}

const STAGE_LABELS: Record<WorkerProgressStage, string> = {
  validating: 'Validating SVG structure & security...',
  reading: 'Parsing SVG dimensions...',
  decoding: 'Rasterizing vector paths...',
  encoding: 'Encoding PNG format...',
  finalizing: 'Finalizing PNG...',
};

export function SvgToPngController() {
  const [files, setFiles] = useState<SvgFileItem[]>([]);
  const [isConverting, setIsConverting] = useState(false);
  const [isZipping, setIsZipping] = useState(false);
  const [globalMessage, setGlobalMessage] = useState<{ type: 'error' | 'info'; text: string } | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const addMoreInputRef = useRef<HTMLInputElement>(null);

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
      if (ext !== 'svg') {
        formatRejectedCount++;
        continue;
      }
      if (file.size > SVG_LIMITS.MAX_FILE_SIZE_BYTES) {
        oversizedCount++;
        continue;
      }
      validNewFiles.push(file);
    }

    if (formatRejectedCount > 0) {
      setGlobalMessage({
        type: 'error',
        text: `Only SVG files (.svg) are supported. ${formatRejectedCount} invalid file(s) ignored.`,
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
    const remainingSlots = SVG_LIMITS.MAX_BATCH_FILES - currentCount;

    if (remainingSlots <= 0) {
      setGlobalMessage({
        type: 'error',
        text: `Maximum limit of ${SVG_LIMITS.MAX_BATCH_FILES} files reached.`,
      });
      return;
    }

    const filesToProcess = validNewFiles.slice(0, remainingSlots);
    if (validNewFiles.length > remainingSlots) {
      setGlobalMessage({
        type: 'info',
        text: `Added ${remainingSlots} files. Maximum batch size is ${SVG_LIMITS.MAX_BATCH_FILES} files.`,
      });
    }

    // Initialize items with validating status
    const initialItems: SvgFileItem[] = filesToProcess.map((file) => {
      return {
        id: `svg_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
        file,
        status: 'validating',
        progress: 0,
        stage: 'validating',
      };
    });

    setFiles((prev) => [...prev, ...initialItems]);

    // Validate SVG structure, security, and dimensions asynchronously
    for (const item of initialItems) {
      const result = await validateSvgFile(item.file);
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
                  width: result.dimensions?.width,
                  height: result.dimensions?.height,
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

    // Process files sequentially to maintain predictable browser performance
    for (const item of pendingItems) {
      // Re-validate SVG security & structure
      const valResult = await validateSvgFile(item.file);
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
        const result = await convertSvgToPng(
          item.file,
          (progress, stage) => {
            setFiles((prev) =>
              prev.map((f) =>
                f.id === item.id
                  ? {
                      ...f,
                      progress,
                      stage: stage || 'decoding',
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
                }
              : f
          )
        );
      } catch (err: unknown) {
        setFiles((prev) =>
          prev.map((f) =>
            f.id === item.id
              ? {
                  ...f,
                  status: 'failed',
                  errorMessage: getHumanErrorMessage(err),
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

    if (item.resultUrl) URL.revokeObjectURL(item.resultUrl);

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

    setIsConverting(true);

    try {
      const result = await convertSvgToPng(
        item.file,
        (progress, stage) => {
          setFiles((prev) =>
            prev.map((f) =>
              f.id === id
                ? {
                    ...f,
                    progress,
                    stage: stage || 'decoding',
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
              }
            : f
        )
      );
    } catch (err: unknown) {
      setFiles((prev) =>
        prev.map((f) =>
          f.id === id
            ? {
                ...f,
                status: 'failed',
                errorMessage: getHumanErrorMessage(err),
              }
            : f
        )
      );
    } finally {
      setIsConverting(false);
    }
  };

  const handleDownloadSingle = (item: SvgFileItem) => {
    if (!item.resultBlob || !item.resultFileName) return;
    triggerBlobDownload(item.resultBlob, item.resultFileName);
  };

  const handleDownloadAllZip = async () => {
    if (isZipping) return;
    const completed = files.filter((f) => f.status === 'completed' && f.resultBlob);
    if (completed.length === 0) return;

    setIsZipping(true);
    setGlobalMessage(null);

    try {
      const usedNames = new Set<string>();
      const entries = completed.map((item) => {
        const uniqueName = generateUniqueFilename(item.resultFileName || 'image.png', usedNames);
        return {
          name: uniqueName,
          blob: item.resultBlob!,
        };
      });

      const zipBlob = await createZipBlob(entries);
      triggerBlobDownload(zipBlob, 'svg-to-png-converted.zip');
    } catch (err: unknown) {
      setGlobalMessage({
        type: 'error',
        text: 'Failed to create ZIP archive: ' + getHumanErrorMessage(err),
      });
    } finally {
      setIsZipping(false);
    }
  };

  const completedFiles = files.filter((f) => f.status === 'completed');
  const hasCompleted = completedFiles.length > 0;
  const pendingCount = files.filter(
    (f) => f.status === 'pending' || f.status === 'failed' || f.status === 'validating'
  ).length;

  if (!isHydrated) {
    return (
      <div
        id="svg-to-png-skeleton"
        data-testid="svg-to-png-tool-container"
        data-hydrated="false"
        className="p-8 text-center text-[#5E6488] bg-[#FFFFFF] border border-[#E4E2F0] rounded-card"
      >
        Loading SVG to PNG converter...
      </div>
    );
  }

  return (
    <div
      id="svg-to-png-tool-root"
      data-testid="svg-to-png-tool-container"
      data-hydrated="true"
      className="space-y-6"
    >
      {/* Global alert messages */}
      {globalMessage && (
        <div
          id="svg-global-message"
          role="alert"
          className={`p-4 rounded-lg flex items-center gap-3 text-sm font-medium ${
            globalMessage.type === 'error'
              ? 'bg-[#FEF2F2] border border-[#FCA5A5] text-[#991B1B]'
              : 'bg-[#EFF6FF] border border-[#BFDBFE] text-[#1E40AF]'
          }`}
        >
          {globalMessage.type === 'error' ? (
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
          ) : (
            <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          )}
          <span>{globalMessage.text}</span>
        </div>
      )}

      {/* Main Upload / File Handling State */}
      {files.length === 0 ? (
        <div
          id="svg-upload-dropzone"
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
              handleFilesAdded(Array.from(e.dataTransfer.files));
            }
          }}
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-[#CBD5E1] hover:border-[#7C3AED] bg-[#F4F3FA] hover:bg-[#F0FDF4]/30 rounded-card p-8 md:p-12 text-center cursor-pointer transition-all duration-200 group"
        >
          <input
            ref={fileInputRef}
            id="svg-file-input"
            type="file"
            accept=".svg,image/svg+xml"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                handleFilesAdded(Array.from(e.target.files));
                e.target.value = '';
              }
            }}
          />

          <div className="flex flex-col items-center justify-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-[#E0F2FE] flex items-center justify-center text-[#7C3AED] group-hover:scale-110 transition-transform">
              <UploadCloud className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <p className="text-base md:text-lg font-semibold text-[#0F112E]">
                Select SVG files or drag & drop here
              </p>
              <p className="text-xs md:text-sm text-[#5E6488]">
                Supports up to {SVG_LIMITS.MAX_BATCH_FILES} files (up to 50 MB each). Instant local browser rasterization.
              </p>
            </div>
            <div className="pt-2">
              <span className="inline-flex items-center px-4 py-2 rounded-lg bg-[#7C3AED] text-[#FFFFFF] text-sm font-medium shadow-sm hover:bg-[#6D28D9] transition-colors">
                Choose SVG Files
              </span>
            </div>
          </div>
        </div>
      ) : (
        <div id="svg-active-workspace" className="space-y-6">
          {/* Header Controls Bar */}
          <div className="bg-[#FFFFFF] border border-[#E4E2F0] rounded-card p-4 md:p-6 shadow-subtle space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-[#0F112E] flex items-center gap-2">
                  <span>Selected SVG Files</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-[#E0F2FE] text-[#7C3AED] font-semibold">
                    {files.length} / {SVG_LIMITS.MAX_BATCH_FILES}
                  </span>
                </h2>
                <p className="text-xs text-[#5E6488] mt-0.5">
                  Rasterize SVG vector files to high-resolution PNG with preserved transparency.
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {files.length < SVG_LIMITS.MAX_BATCH_FILES && (
                  <>
                    <input
                      ref={addMoreInputRef}
                      id="svg-add-more-input"
                      type="file"
                      accept=".svg,image/svg+xml"
                      multiple
                      className="hidden"
                      onChange={(e) => {
                        if (e.target.files && e.target.files.length > 0) {
                          handleFilesAdded(Array.from(e.target.files));
                          e.target.value = '';
                        }
                      }}
                    />
                    <button
                      id="btn-svg-add-more"
                      type="button"
                      disabled={isConverting}
                      onClick={() => addMoreInputRef.current?.click()}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#D0D5DD] bg-[#FFFFFF] text-xs md:text-sm font-medium text-[#344054] hover:bg-[#F9FAFB] disabled:opacity-50 transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      Add More
                    </button>
                  </>
                )}

                <button
                  id="btn-svg-clear-all"
                  type="button"
                  disabled={isConverting}
                  onClick={handleClearAll}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#FCA5A5] bg-[#FFFFFF] text-xs md:text-sm font-medium text-[#991B1B] hover:bg-[#FEF2F2] disabled:opacity-50 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  Clear All
                </button>
              </div>
            </div>

            {/* Action Bar */}
            <div className="pt-2 border-t border-[#F2F4F7] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="text-xs text-[#5E6488]">
                {hasCompleted ? (
                  <span>
                    Converted {completedFiles.length} of {files.length} file(s)
                  </span>
                ) : (
                  <span>Ready to convert {pendingCount} file(s) to PNG format</span>
                )}
              </div>

              <div className="flex items-center gap-3">
                {pendingCount > 0 && (
                  <button
                    id="btn-svg-convert-all"
                    type="button"
                    disabled={isConverting}
                    onClick={handleConvertAll}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#7C3AED] text-[#FFFFFF] text-sm font-semibold hover:bg-[#6D28D9] disabled:opacity-50 transition-colors shadow-sm cursor-pointer"
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

                {hasCompleted && (
                  <button
                    id="btn-svg-download-all-zip"
                    type="button"
                    disabled={isZipping || isConverting}
                    onClick={handleDownloadAllZip}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#2E7D32] text-[#FFFFFF] text-sm font-semibold hover:bg-[#1B5E20] disabled:opacity-50 transition-colors shadow-sm cursor-pointer"
                  >
                    {isZipping ? (
                      <>
                        <RotateCw className="w-4 h-4 animate-spin" />
                        <span>Creating ZIP...</span>
                      </>
                    ) : (
                      <>
                        <Archive className="w-4 h-4" />
                        <span>Download All (ZIP)</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* File Cards List */}
          <div className="space-y-3">
            {files.map((item, index) => (
              <div
                key={item.id}
                id={`svg-file-card-${index}`}
                className="bg-[#FFFFFF] border border-[#E4E2F0] rounded-card p-4 shadow-subtle transition-all duration-200"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  {/* Left: Thumbnail & Name Info */}
                  <div className="flex items-start md:items-center gap-3 min-w-0">
                    <div className="w-12 h-12 rounded-lg bg-[#F4F3FA] border border-[#E2E8F0] flex items-center justify-center flex-shrink-0 text-[#7C3AED] overflow-hidden">
                      {item.resultUrl ? (
                        <img
                          src={item.resultUrl}
                          alt="Converted PNG thumbnail"
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <FileCode className="w-6 h-6 text-[#7C3AED]" />
                      )}
                    </div>

                    <div className="min-w-0 space-y-1">
                      <p className="text-sm font-semibold text-[#0F112E] truncate" title={item.file.name}>
                        {item.file.name}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-[#5E6488] flex-wrap">
                        <span>Original: {formatBytes(item.file.size)}</span>
                        {item.width && item.height ? (
                          <>
                            <span>•</span>
                            <span>{item.width} × {item.height} px</span>
                          </>
                        ) : null}
                        {item.status === 'completed' && item.convertedSize && (
                          <>
                            <span>•</span>
                            <span className="font-medium text-[#2E7D32]">
                              PNG: {formatBytes(item.convertedSize)}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: Status & Actions */}
                  <div className="flex items-center gap-3 self-end md:self-center flex-shrink-0">
                    {item.status === 'validating' && (
                      <span className="inline-flex items-center gap-1.5 text-xs text-[#5E6488]">
                        <RotateCw className="w-3.5 h-3.5 animate-spin text-[#7C3AED]" />
                        Validating...
                      </span>
                    )}

                    {item.status === 'pending' && (
                      <span className="text-xs font-medium text-[#5E6488] px-2.5 py-1 rounded bg-[#F2F4F7]">
                        Ready
                      </span>
                    )}

                    {item.status === 'processing' && (
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#7C3AED]">
                        <RotateCw className="w-3.5 h-3.5 animate-spin" />
                        {STAGE_LABELS[item.stage || 'decoding']} ({item.progress}%)
                      </span>
                    )}

                    {item.status === 'completed' && (
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-[#2E7D32] bg-[#F0FDF4] px-2 py-1 rounded border border-[#DCFCE7]">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Converted
                        </span>

                        <button
                          id={`btn-download-single-${index}`}
                          type="button"
                          onClick={() => handleDownloadSingle(item)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#7C3AED] hover:bg-[#6D28D9] text-[#FFFFFF] text-xs font-medium transition-colors shadow-sm cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5" />
                          Download
                        </button>
                      </div>
                    )}

                    {item.status === 'failed' && (
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-[#991B1B] bg-[#FEF2F2] px-2 py-1 rounded border border-[#FCA5A5]">
                          <AlertCircle className="w-3.5 h-3.5" />
                          Failed
                        </span>

                        <button
                          id={`btn-retry-${index}`}
                          type="button"
                          disabled={isConverting}
                          onClick={() => handleRetryFile(item.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-[#D0D5DD] bg-[#FFFFFF] hover:bg-[#F9FAFB] text-xs font-medium text-[#344054] transition-colors"
                        >
                          <RefreshCw className="w-3 h-3" />
                          Retry
                        </button>
                      </div>
                    )}

                    {!isConverting && item.status !== 'processing' && (
                      <button
                        id={`btn-remove-${index}`}
                        type="button"
                        onClick={() => handleRemoveFile(item.id)}
                        className="text-[#98A2B3] hover:text-[#B42318] p-1.5 rounded-lg hover:bg-[#FEF2F2] transition-colors"
                        title="Remove file"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Progress Bar for active processing */}
                {item.status === 'processing' && (
                  <div className="mt-3">
                    <ProgressBar
                      progress={item.progress}
                      label={STAGE_LABELS[item.stage || 'decoding']}
                    />
                  </div>
                )}

                {/* Detailed Error message if failed */}
                {item.status === 'failed' && item.errorMessage && (
                  <div className="mt-3 p-2.5 rounded bg-[#FEF2F2] border border-[#FCA5A5] text-xs text-[#991B1B] flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span>{item.errorMessage}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default SvgToPngController;
