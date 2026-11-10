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
import { convertPngToWebp } from '@/engines/image/convert';
import type { WorkerProgressStage } from '@/engines/image/worker/worker-types';
import { validatePngFile, VALIDATION_LIMITS } from '@/engines/shared/validation';
import { getHumanErrorMessage } from '@/engines/shared/errors';
import {
  formatBytes,
  generateUniqueFilename,
  createZipBlob,
  triggerBlobDownload,
} from '@/engines/shared/file-utils';
import ProgressBar from './ProgressBar';

export type FileStatus = 'pending' | 'validating' | 'processing' | 'completed' | 'failed';

export interface PngFileItem {
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
  validating: 'Validating PNG...',
  reading: 'Reading PNG data...',
  decoding: 'Decoding PNG image...',
  encoding: 'Encoding WebP format...',
  finalizing: 'Finalizing WebP...',
};

export function PngToWebpController() {
  const [files, setFiles] = useState<PngFileItem[]>([]);
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
      if (ext !== 'png') {
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
        text: `Only PNG files (.png) are supported. ${formatRejectedCount} unsupported file(s) ignored.`,
      });
    } else if (oversizedCount > 0) {
      setGlobalMessage({
        type: 'error',
        text: `Files must be under 50 MB. ${oversizedCount} oversized file(s) ignored.`,
      });
    }

    if (validNewFiles.length === 0) return;

    // Check batch slots (max 20)
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

    const newItems: PngFileItem[] = [];
    for (const file of filesToProcess) {
      const id = `${file.name}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      let previewUrl: string | undefined;

      try {
        previewUrl = URL.createObjectURL(file);
      } catch {
        // Preview generation fallback
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

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFilesAdded(Array.from(e.target.files));
      e.target.value = '';
    }
  };

  const handleRemoveFile = (id: string) => {
    if (isConverting) return;
    setFiles((prev) => {
      const item = prev.find((f) => f.id === id);
      if (item) {
        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
        if (item.resultUrl) URL.revokeObjectURL(item.resultUrl);
      }
      return prev.filter((f) => f.id !== id);
    });
  };

  const handleResetAll = () => {
    if (isConverting) return;
    files.forEach((f) => {
      if (f.previewUrl) URL.revokeObjectURL(f.previewUrl);
      if (f.resultUrl) URL.revokeObjectURL(f.resultUrl);
    });
    setFiles([]);
    setGlobalMessage(null);
  };

  const convertSingleFile = async (
    item: PngFileItem,
    targetQuality: number
  ): Promise<Partial<PngFileItem>> => {
    // 1. Pre-validation with magic bytes check
    const validation = await validatePngFile(item.file);
    if (!validation.valid && validation.error) {
      return {
        status: 'failed',
        progress: 0,
        errorMessage: getHumanErrorMessage(validation.error),
      };
    }

    // 2. Perform Client-side Conversion
    try {
      const result = await convertPngToWebp(
        item.file,
        {
          quality: targetQuality,
        },
        (percent, stage) => {
          setFiles((prev) =>
            prev.map((f) => (f.id === item.id ? { ...f, progress: percent, stage } : f))
          );
        }
      );

      const resultUrl = URL.createObjectURL(result.blob);

      return {
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
        usedQuality: targetQuality,
        errorMessage: undefined,
      };
    } catch (err: unknown) {
      return {
        status: 'failed',
        progress: 0,
        errorMessage: getHumanErrorMessage(err),
      };
    }
  };

  const handleConvertAll = async () => {
    if (isConverting || files.length === 0) return;
    setIsConverting(true);
    setGlobalMessage(null);

    const itemsToProcess = files.filter((f) => f.status !== 'completed');

    for (const item of itemsToProcess) {
      // Mark as validating/processing
      setFiles((prev) =>
        prev.map((f) =>
          f.id === item.id
            ? { ...f, status: 'processing', progress: 5, stage: 'validating' }
            : f
        )
      );

      const update = await convertSingleFile(item, quality);

      setFiles((prev) =>
        prev.map((f) => (f.id === item.id ? { ...f, ...update } : f))
      );
    }

    setIsConverting(false);
  };

  const handleRetrySingle = async (id: string) => {
    if (isConverting) return;
    const item = files.find((f) => f.id === id);
    if (!item) return;

    if (item.resultUrl) {
      URL.revokeObjectURL(item.resultUrl);
    }

    setFiles((prev) =>
      prev.map((f) =>
        f.id === id
          ? { ...f, status: 'processing', progress: 5, stage: 'validating', errorMessage: undefined }
          : f
      )
    );

    const update = await convertSingleFile(item, quality);

    setFiles((prev) =>
      prev.map((f) => (f.id === id ? { ...f, ...update } : f))
    );
  };

  const handleDownloadSingle = (item: PngFileItem) => {
    if (!item.resultBlob || !item.resultFileName) return;
    triggerBlobDownload(item.resultBlob, item.resultFileName);
  };

  const handleDownloadAllZip = async () => {
    const completedItems = files.filter((f) => f.status === 'completed' && f.resultBlob);
    if (completedItems.length === 0 || isZipping) return;

    setIsZipping(true);
    try {
      const usedNames = new Set<string>();
      const zipEntries = completedItems.map((item) => {
        const fallbackName = item.file.name.replace(/\.png$/i, '.webp');
        const baseName = item.resultFileName || fallbackName;
        const uniqueName = generateUniqueFilename(baseName, usedNames);
        usedNames.add(uniqueName);
        return {
          name: uniqueName,
          blob: item.resultBlob!,
        };
      });

      const zipBlob = await createZipBlob(zipEntries);
      triggerBlobDownload(zipBlob, 'png-to-webp-files.zip');
    } catch {
      setGlobalMessage({
        type: 'error',
        text: 'Failed to create ZIP archive. Please download files individually.',
      });
    } finally {
      setIsZipping(false);
    }
  };

  const completedCount = files.filter((f) => f.status === 'completed').length;
  const failedCount = files.filter((f) => f.status === 'failed').length;
  const allCompleted = files.length > 0 && completedCount === files.length;
  const hasPendingOrFailed = files.some((f) => f.status === 'pending' || f.status === 'failed');

  return (
    <div
      className="bg-[#FFFFFF] border border-[#E4E2F0] rounded-card p-6 md:p-8 shadow-subtle mb-6"
      data-hydrated={isHydrated}
      data-testid="png-to-webp-container"
    >
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Global Notifications */}
        {globalMessage && (
          <div
            role="alert"
            className={`p-4 rounded-lg flex items-start gap-3 text-sm ${
              globalMessage.type === 'error'
                ? 'bg-[#FEF2F2] border border-[#FEE2E2] text-[#991B1B]'
                : 'bg-[#EFF6FF] border border-[#DBEAFE] text-[#1E40AF]'
            }`}
          >
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <p className="flex-1">{globalMessage.text}</p>
            <button
              type="button"
              onClick={() => setGlobalMessage(null)}
              className="text-xs font-semibold underline hover:opacity-80"
              aria-label="Dismiss message"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Upload Dropzone (When Empty) */}
        {files.length === 0 && (
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onClick={() => fileInputRef.current?.click()}
            role="button"
            tabIndex={0}
            aria-label="Upload PNG images. Drag and drop PNG files here or press Enter to browse"
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                fileInputRef.current?.click();
              }
            }}
            className="border-2 border-dashed border-[#CBD5E1] hover:border-[#7C3AED] bg-[#F4F3FA] hover:bg-[#F1F5F9] rounded-2xl p-8 md:p-12 text-center transition-all duration-200 cursor-pointer flex flex-col items-center justify-center gap-4 group focus:outline-none focus:ring-2 focus:ring-[#7C3AED] focus:ring-offset-2"
          >
            <input
              ref={fileInputRef}
              type="file"
              id="png-file-input"
              multiple
              accept=".png,image/png"
              className="sr-only"
              onChange={handleFileInputChange}
            />
            <div className="w-16 h-16 rounded-full bg-[#E0F2FE] flex items-center justify-center text-[#7C3AED] group-hover:scale-105 transition-transform duration-200">
              <UploadCloud className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <p className="text-base md:text-lg font-semibold text-[#0F112E]">
                Drag &amp; drop your PNG files here
              </p>
              <p className="text-sm text-[#5E6488]">
                or <span className="text-[#7C3AED] font-medium underline">browse files</span> from your computer
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-[#5E6488] pt-2">
              <span className="px-2.5 py-1 bg-[#FFFFFF] border border-[#E2E8F0] rounded-full font-medium">
                PNG only
              </span>
              <span className="px-2.5 py-1 bg-[#FFFFFF] border border-[#E2E8F0] rounded-full font-medium">
                Up to 50 MB per file
              </span>
              <span className="px-2.5 py-1 bg-[#FFFFFF] border border-[#E2E8F0] rounded-full font-medium">
                Up to 20 files
              </span>
            </div>
          </div>
        )}

        {/* Selected Files & Options View */}
        {files.length > 0 && (
          <div className="space-y-6">
            {/* Header / Actions Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[#E4E2F0]">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-base text-[#0F112E]">
                  Selected Files ({files.length}/{VALIDATION_LIMITS.MAX_BATCH_FILES})
                </span>
                {completedCount > 0 && (
                  <span className="text-xs px-2 py-0.5 bg-[#ECFDF5] text-[#065F46] font-medium rounded-full border border-[#A7F3D0]">
                    {completedCount} converted
                  </span>
                )}
                {failedCount > 0 && (
                  <span className="text-xs px-2 py-0.5 bg-[#FEF2F2] text-[#991B1B] font-medium rounded-full border border-[#FECACA]">
                    {failedCount} failed
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                {files.length < VALIDATION_LIMITS.MAX_BATCH_FILES && !isConverting && (
                  <>
                    <input
                      ref={addMoreInputRef}
                      type="file"
                      multiple
                      accept=".png,image/png"
                      className="sr-only"
                      onChange={handleFileInputChange}
                    />
                    <button
                      type="button"
                      onClick={() => addMoreInputRef.current?.click()}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#7C3AED] bg-[#F0FDF4] hover:bg-[#DCFCE7] border border-[#BBF7D0] rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-[#7C3AED]"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add more
                    </button>
                  </>
                )}

                {!isConverting && (
                  <button
                    type="button"
                    onClick={handleResetAll}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#5E6488] hover:text-[#991B1B] hover:bg-[#FEF2F2] border border-[#E4E2F0] rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-[#991B1B]"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Clear all
                  </button>
                )}
              </div>
            </div>

            {/* Options Panel */}
            <div className="p-5 bg-[#F4F3FA] border border-[#E2E8F0] rounded-xl space-y-4">
              <h3 className="font-semibold text-sm text-[#0F112E]">
                WebP Output Options
              </h3>

              {/* WebP Quality Selection */}
              <fieldset className="space-y-2">
                <legend className="text-sm font-semibold text-[#0F112E] mb-1">
                  WebP quality
                </legend>
                <div
                  id={qualityGroupId}
                  className="grid grid-cols-1 sm:grid-cols-3 gap-3"
                  role="radiogroup"
                  aria-label="WebP Quality Presets"
                >
                  {[
                    { label: 'High — 90%', value: 0.9, sub: 'Recommended', testId: 'quality-90' },
                    { label: 'Medium — 80%', value: 0.8, sub: 'Balanced', testId: 'quality-80' },
                    { label: 'Low — 70%', value: 0.7, sub: 'Smallest file', testId: 'quality-70' },
                  ].map((preset) => (
                    <label
                      key={preset.value}
                      className={`relative flex flex-col p-3 rounded-xl border cursor-pointer transition-all ${
                        quality === preset.value
                          ? 'border-[#7C3AED] bg-[#FFFFFF] shadow-sm ring-1 ring-[#7C3AED]'
                          : 'border-[#E2E8F0] bg-[#FFFFFF] hover:border-[#CBD5E1]'
                      } ${isConverting ? 'opacity-60 cursor-not-allowed' : ''}`}
                    >
                      <input
                        type="radio"
                        name="webp-quality"
                        data-testid={preset.testId}
                        value={preset.value}
                        checked={quality === preset.value}
                        disabled={isConverting}
                        onChange={() => setQuality(preset.value)}
                        className="sr-only"
                      />
                      <span className="text-sm font-semibold text-[#0F112E]">{preset.label}</span>
                      <span className="text-xs text-[#5E6488]">{preset.sub}</span>
                    </label>
                  ))}
                </div>
                <p className="text-xs text-[#5E6488] pt-1">
                  Higher quality produces larger files. Transparent backgrounds are preserved automatically.
                </p>
              </fieldset>
            </div>

            {/* File List Items */}
            <div className="space-y-3" role="list" aria-label="Selected PNG files">
              {files.map((item) => (
                <div
                  key={item.id}
                  role="listitem"
                  className="p-4 bg-[#FFFFFF] border border-[#E4E2F0] rounded-xl shadow-xs space-y-3 transition-all"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-12 h-12 rounded-lg bg-[#F1F5F9] border border-[#E2E8F0] overflow-hidden flex items-center justify-center flex-shrink-0 relative">
                        {item.previewUrl ? (
                          <img
                            src={item.previewUrl}
                            alt={`Preview of ${item.file.name}`}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <FileCheck className="w-6 h-6 text-[#5E6488]" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-[#0F112E] truncate" title={item.file.name}>
                          {item.file.name}
                        </p>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-[#5E6488] mt-0.5">
                          <span>{formatBytes(item.file.size)}</span>
                          <span>•</span>
                          <span className="uppercase">{item.file.name.split('.').pop() || 'PNG'}</span>
                          {item.width && item.height && (
                            <>
                              <span>•</span>
                              <span>
                                {item.width} × {item.height}px
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Status / Action Controls */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {item.status === 'completed' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-[#ECFDF5] text-[#065F46] border border-[#A7F3D0]">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          WebP Ready
                        </span>
                      )}

                      {item.status === 'failed' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-[#FEF2F2] text-[#991B1B] border border-[#FECACA]">
                          <AlertCircle className="w-3.5 h-3.5" />
                          Failed
                        </span>
                      )}

                      {item.status === 'processing' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-[#EFF6FF] text-[#1E40AF] border border-[#BFDBFE]">
                          <RotateCw className="w-3.5 h-3.5 animate-spin" />
                          Converting...
                        </span>
                      )}

                      {item.status === 'pending' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-[#F4F3FA] text-[#475569] border border-[#E2E8F0]">
                          Ready to convert
                        </span>
                      )}

                      {item.status !== 'processing' && (
                        <button
                          type="button"
                          onClick={() => handleRemoveFile(item.id)}
                          aria-label={`Remove ${item.file.name}`}
                          className="p-1.5 text-[#94A3B8] hover:text-[#991B1B] hover:bg-[#FEF2F2] rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-[#991B1B]"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Progress Bar (During Processing) */}
                  {item.status === 'processing' && (
                    <div className="space-y-1.5 pt-1">
                      <ProgressBar
                        progress={item.progress}
                        label={item.stage ? STAGE_LABELS[item.stage] : 'Processing...'}
                      />
                    </div>
                  )}

                  {/* Error State with Retry Button */}
                  {item.status === 'failed' && (
                    <div className="p-3 bg-[#FEF2F2] border border-[#FEE2E2] rounded-lg flex items-center justify-between gap-3 text-xs text-[#991B1B]">
                      <div className="flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 flex-shrink-0" />
                        <span>{item.errorMessage || 'This file is not a valid PNG image.'}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRetrySingle(item.id)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#FFFFFF] border border-[#FECACA] hover:bg-[#FEE2E2] font-semibold text-[#991B1B] rounded-md transition-colors"
                      >
                        <RefreshCw className="w-3 h-3" />
                        Retry
                      </button>
                    </div>
                  )}

                  {/* Completed Output Card */}
                  {item.status === 'completed' && item.resultBlob && (
                    <div className="p-3 bg-[#F0FDF4] border border-[#DCFCE7] rounded-lg flex flex-wrap items-center justify-between gap-3">
                      <div className="space-y-0.5 text-xs text-[#166534]">
                        <div className="font-semibold flex items-center gap-1.5">
                          <span>Converted: {item.resultFileName}</span>
                          <span className="text-[#5E6488] font-normal">
                            ({item.resultFileName})
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-[#475569]">
                          <span>Original: {formatBytes(item.originalSize || item.file.size)}</span>
                          <span>→</span>
                          <span className="font-semibold text-[#166534]">
                            WebP: {formatBytes(item.convertedSize || item.resultBlob.size)}
                          </span>
                          <span>•</span>
                          <span>Quality: {Math.round((item.usedQuality ?? quality) * 100)}%</span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleDownloadSingle(item)}
                        aria-label={`Download converted ${item.resultFileName}`}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-xs font-semibold rounded-lg shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-[#7C3AED] focus:ring-offset-1"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Download
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Bottom Actions Bar */}
            <div className="pt-4 border-t border-[#E4E2F0] flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-xs text-[#5E6488] text-center sm:text-left">
                {allCompleted ? (
                  <span className="text-[#166534] font-medium">
                    All {files.length} file(s) converted successfully!
                  </span>
                ) : isConverting ? (
                  <span>Processing conversions in your browser...</span>
                ) : (
                  <span>
                    Ready to convert {files.filter((f) => f.status !== 'completed').length} file(s)
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto justify-center">
                {allCompleted && (
                  <button
                    type="button"
                    onClick={handleResetAll}
                    className="w-full sm:w-auto px-4 py-2.5 text-sm font-medium text-[#0F112E] bg-[#F1F5F9] hover:bg-[#E2E8F0] border border-[#CBD5E1] rounded-xl transition-colors"
                  >
                    Convert more files
                  </button>
                )}

                {completedCount > 1 && (
                  <button
                    type="button"
                    onClick={handleDownloadAllZip}
                    disabled={isZipping}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-[#0F766E] hover:bg-[#115E59] text-white text-sm font-semibold rounded-xl shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-[#0F766E] focus:ring-offset-2 disabled:opacity-50"
                  >
                    <Archive className="w-4 h-4" />
                    {isZipping ? 'Zipping...' : 'Download All (ZIP)'}
                  </button>
                )}

                {hasPendingOrFailed && (
                  <button
                    type="button"
                    onClick={handleConvertAll}
                    disabled={isConverting}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-sm font-semibold rounded-xl shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-[#7C3AED] focus:ring-offset-2 disabled:opacity-50"
                  >
                    {isConverting ? (
                      <>
                        <RotateCw className="w-4 h-4 animate-spin" />
                        Converting...
                      </>
                    ) : (
                      <>
                        Convert to WebP
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
    </div>
  );
}
export default PngToWebpController;
