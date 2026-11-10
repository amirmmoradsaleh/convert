'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  UploadCloud,
  AlertCircle,
  Trash2,
  Download,
  RefreshCw,
  CheckCircle2,
  FileText,
  RotateCw,
  RotateCcw,
  CheckSquare,
  Square,
  Info,
} from 'lucide-react';
import { formatBytes, triggerBlobDownload } from '@/engines/shared/file-utils';
import {
  rotatePdf,
  RotateDegrees,
  RotateScope,
  RotatePdfResult,
} from '@/engines/pdf/rotate';
import { loadPdfDocument, LoadedPdfDocument } from '@/engines/pdf/loader';
import { renderPdfPageThumbnail } from '@/engines/pdf/renderer';
import { validateRotatePdfFile } from '@/engines/pdf/validation';
import ProgressBar from './ProgressBar';

interface PagePreviewItem {
  pageNumber: number;
  thumbnailUrl?: string;
  selected: boolean;
}

export function RotatePdfController() {
  const [isHydrated, setIsHydrated] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [pdfDocInfo, setPdfDocInfo] = useState<LoadedPdfDocument | null>(null);
  const [pages, setPages] = useState<PagePreviewItem[]>([]);

  // Rotation settings
  const [angle, setAngle] = useState<RotateDegrees>(90);
  const [scope, setScope] = useState<RotateScope>('all');

  // Processing state
  const [isLoadingPdf, setIsLoadingPdf] = useState(false);
  const [isRotating, setIsRotating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState('');
  const [globalMessage, setGlobalMessage] = useState<{
    type: 'error' | 'info';
    text: string;
  } | null>(null);

  // Result state
  const [result, setResult] = useState<RotatePdfResult | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  // Cleanup object URL on unmount or reset
  useEffect(() => {
    return () => {
      if (downloadUrl) {
        URL.revokeObjectURL(downloadUrl);
      }
    };
  }, [downloadUrl]);

  const resetAll = useCallback(() => {
    if (downloadUrl) {
      URL.revokeObjectURL(downloadUrl);
    }
    setFile(null);
    setPdfDocInfo(null);
    setPages([]);
    setResult(null);
    setDownloadUrl(null);
    setProgress(0);
    setProgressMessage('');
    setGlobalMessage(null);
    setAngle(90);
    setScope('all');
  }, [downloadUrl]);

  const handleFileSelected = useCallback(
    async (incomingFile: File, multiNotice?: string) => {
      resetAll();
      setGlobalMessage(multiNotice ? { type: 'info', text: multiNotice } : null);
      setIsLoadingPdf(true);

      try {
        // Validate file
        const validation = await validateRotatePdfFile(incomingFile);
        if (!validation.valid) {
          setGlobalMessage({
            type: 'error',
            text:
              validation.error?.message ||
              'This file is not a valid PDF. Please choose a valid PDF document.',
          });
          setIsLoadingPdf(false);
          return;
        }

        // Load document structure and page count
        const loaded = await loadPdfDocument(incomingFile);
        if (loaded.pageCount === 0) {
          setGlobalMessage({
            type: 'error',
            text: 'This PDF document contains no readable pages.',
          });
          setIsLoadingPdf(false);
          return;
        }

        setFile(incomingFile);
        setPdfDocInfo(loaded);

        // Initialize all pages as selected by default
        const initialPages: PagePreviewItem[] = [];
        for (let i = 1; i <= loaded.pageCount; i++) {
          initialPages.push({
            pageNumber: i,
            selected: true,
          });
        }
        setPages(initialPages);

        // Render thumbnails in background for first 40 pages
        const maxThumbnails = Math.min(loaded.pageCount, 40);
        setTimeout(async () => {
          for (let i = 1; i <= maxThumbnails; i++) {
            try {
              const thumbUrl = await renderPdfPageThumbnail(loaded.pdfDoc, i, 140);
              if (thumbUrl) {
                setPages((prev) =>
                  prev.map((p) => (p.pageNumber === i ? { ...p, thumbnailUrl: thumbUrl } : p))
                );
              }
            } catch {
              // Graceful fallback to card placeholder
            }
          }
        }, 50);
      } catch (err: unknown) {
        const errAny = err as { message?: string };
        const msg = errAny?.message || "We couldn't read this PDF. Please try another file.";
        setGlobalMessage({
          type: 'error',
          text: msg,
        });
      } finally {
        setIsLoadingPdf(false);
      }
    },
    [resetAll]
  );

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const notice =
        e.dataTransfer.files.length > 1
          ? 'Rotate PDF processes one document at a time. Processing the first file.'
          : undefined;
      handleFileSelected(e.dataTransfer.files[0], notice);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const notice =
        e.target.files.length > 1
          ? 'Rotate PDF processes one document at a time. Processing the first file.'
          : undefined;
      handleFileSelected(e.target.files[0], notice);
    }
    if (e.target) {
      e.target.value = '';
    }
  };

  const togglePageSelection = (pageNumber: number) => {
    setPages((prev) =>
      prev.map((p) => (p.pageNumber === pageNumber ? { ...p, selected: !p.selected } : p))
    );
  };

  const handleSelectAll = () => {
    setPages((prev) => prev.map((p) => ({ ...p, selected: true })));
  };

  const handleClearSelection = () => {
    setPages((prev) => prev.map((p) => ({ ...p, selected: false })));
  };

  const selectedCount = pages.filter((p) => p.selected).length;
  const totalCount = pages.length;

  const handleRotate = async () => {
    if (!file || !pdfDocInfo) return;

    if (scope === 'selected' && selectedCount === 0) {
      setGlobalMessage({
        type: 'error',
        text: 'Please select at least one page to rotate.',
      });
      return;
    }

    setIsRotating(true);
    setProgress(5);
    setProgressMessage('Starting PDF rotation...');
    setGlobalMessage(null);

    try {
      const selectedPageNumbers = pages.filter((p) => p.selected).map((p) => p.pageNumber);

      const rotateResult = await rotatePdf(
        file,
        {
          angle,
          scope,
          selectedPages: selectedPageNumbers,
        },
        (prog) => {
          setProgress(prog.progress);
          setProgressMessage(prog.message);
        }
      );

      const url = URL.createObjectURL(rotateResult.resultBlob);
      setDownloadUrl(url);
      setResult(rotateResult);
    } catch (err: unknown) {
      const errAny = err as { message?: string };
      setGlobalMessage({
        type: 'error',
        text: errAny?.message || 'Failed to rotate PDF. Please try again.',
      });
    } finally {
      setIsRotating(false);
    }
  };

  const handleDownload = () => {
    if (result && result.resultBlob) {
      triggerBlobDownload(result.resultBlob, result.resultFileName);
    }
  };

  return (
    <div
      className="bg-[#FFFFFF] border border-[#E4E2F0] rounded-card p-4 sm:p-6 md:p-8 shadow-subtle mb-6"
      data-hydrated={isHydrated}
    >
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Global info / error banner */}
        {globalMessage && (
          <div
            className={`p-4 rounded-lg flex items-start gap-3 text-sm animate-fadeIn ${
              globalMessage.type === 'error'
                ? 'bg-[#FEF2F2] border border-[#FCA5A5] text-[#991B1B]'
                : 'bg-[#EFF6FF] border border-[#BFDBFE] text-[#1E40AF]'
            }`}
            role="alert"
          >
            {globalMessage.type === 'error' ? (
              <AlertCircle className="w-5 h-5 shrink-0 text-[#DC2626] mt-0.5" />
            ) : (
              <Info className="w-5 h-5 shrink-0 text-[#2563EB] mt-0.5" />
            )}
            <div className="flex-1 font-medium">{globalMessage.text}</div>
            <button
              onClick={() => setGlobalMessage(null)}
              className="text-xs hover:opacity-75 font-semibold px-1 py-0.5"
              aria-label="Dismiss message"
            >
              ✕
            </button>
          </div>
        )}

        {/* 1. Initial State: Upload Zone */}
        {!file && !result && (
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-8 md:p-12 text-center cursor-pointer transition-all duration-200 group ${
              isLoadingPdf
                ? 'border-[#7C3AED] bg-[#F0FDF4]/30 pointer-events-none'
                : 'border-[#CBD5E1] hover:border-[#7C3AED] hover:bg-[#F4F3FA]'
            }`}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                fileInputRef.current?.click();
              }
            }}
            aria-label="Upload PDF file to rotate"
          >
            <input
              ref={fileInputRef}
              id="rotate-pdf-file-input"
              type="file"
              multiple
              accept=".pdf,application/pdf"
              className="hidden"
              onChange={handleFileInputChange}
            />

            <div className="w-16 h-16 rounded-full bg-[#E6F4F2] flex items-center justify-center mx-auto mb-4 group-hover:scale-105 transition-transform duration-200">
              <UploadCloud className="w-8 h-8 text-[#7C3AED]" />
            </div>

            <h2 className="text-lg md:text-xl font-semibold text-[#0F112E] mb-1">
              {isLoadingPdf ? 'Reading PDF file...' : 'Choose a PDF file to rotate'}
            </h2>
            <p className="text-sm text-[#5E6488] mb-4">
              Drag and drop your document here, or browse your device
            </p>

            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#F1F5F9] text-xs font-medium text-[#475467]">
              <span>Maximum file size: 100 MB</span>
              <span>•</span>
              <span>1 PDF at a time</span>
            </div>
          </div>
        )}

        {/* 2. File Selected & Ready to Configure */}
        {file && pdfDocInfo && !result && (
          <div className="space-y-6 animate-fadeIn">
            {/* Source Document Header Card */}
            <div className="p-4 md:p-5 bg-[#F4F3FA] border border-[#E2E8F0] rounded-xl flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 md:gap-4 overflow-hidden">
                <div className="w-12 h-12 rounded-lg bg-[#E6F4F2] flex items-center justify-center shrink-0">
                  <FileText className="w-6 h-6 text-[#7C3AED]" />
                </div>
                <div className="truncate">
                  <h3
                    className="text-base font-semibold text-[#0F112E] truncate"
                    title={file.name}
                  >
                    {file.name}
                  </h3>
                  <div className="flex items-center gap-2 text-xs text-[#5E6488] mt-0.5">
                    <span>{formatBytes(file.size)}</span>
                    <span>•</span>
                    <span className="font-medium text-[#7C3AED]">
                      {pdfDocInfo.pageCount}{' '}
                      {pdfDocInfo.pageCount === 1 ? 'page' : 'pages'}
                    </span>
                  </div>
                </div>
              </div>

              {!isRotating && (
                <button
                  onClick={resetAll}
                  className="p-2 text-[#64748B] hover:text-[#DC2626] hover:bg-[#FEE2E2] rounded-lg transition-colors shrink-0"
                  title="Remove file and choose another"
                  aria-label="Remove file"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              )}
            </div>

            {/* Controls Bar: Angle & Scope */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-[#FFFFFF] border border-[#E4E2F0] rounded-xl">
              {/* Rotation Angle Selector */}
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-[#475467] block">
                  Rotation Angle (Clockwise)
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setAngle(90)}
                    disabled={isRotating}
                    className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-lg text-xs sm:text-sm font-semibold border transition-all ${
                      angle === 90
                        ? 'bg-[#7C3AED] text-white border-[#7C3AED] shadow-xs'
                        : 'bg-[#F4F3FA] text-[#475467] border-[#E2E8F0] hover:bg-[#F1F5F9]'
                    }`}
                  >
                    <RotateCw className="w-3.5 h-3.5" />
                    <span>90°</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAngle(180)}
                    disabled={isRotating}
                    className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-lg text-xs sm:text-sm font-semibold border transition-all ${
                      angle === 180
                        ? 'bg-[#7C3AED] text-white border-[#7C3AED] shadow-xs'
                        : 'bg-[#F4F3FA] text-[#475467] border-[#E2E8F0] hover:bg-[#F1F5F9]'
                    }`}
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>180°</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAngle(270)}
                    disabled={isRotating}
                    className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-lg text-xs sm:text-sm font-semibold border transition-all ${
                      angle === 270
                        ? 'bg-[#7C3AED] text-white border-[#7C3AED] shadow-xs'
                        : 'bg-[#F4F3FA] text-[#475467] border-[#E2E8F0] hover:bg-[#F1F5F9]'
                    }`}
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>270°</span>
                  </button>
                </div>
              </div>

              {/* Scope Selector */}
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-[#475467] block">
                  Target Pages
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setScope('all')}
                    disabled={isRotating}
                    className={`py-2.5 px-3 rounded-lg text-xs sm:text-sm font-semibold border text-center transition-all ${
                      scope === 'all'
                        ? 'bg-[#7C3AED] text-white border-[#7C3AED] shadow-xs'
                        : 'bg-[#F4F3FA] text-[#475467] border-[#E2E8F0] hover:bg-[#F1F5F9]'
                    }`}
                  >
                    Rotate All Pages
                  </button>

                  <button
                    type="button"
                    onClick={() => setScope('selected')}
                    disabled={isRotating}
                    className={`py-2.5 px-3 rounded-lg text-xs sm:text-sm font-semibold border text-center transition-all ${
                      scope === 'selected'
                        ? 'bg-[#7C3AED] text-white border-[#7C3AED] shadow-xs'
                        : 'bg-[#F4F3FA] text-[#475467] border-[#E2E8F0] hover:bg-[#F1F5F9]'
                    }`}
                  >
                    Rotate Selected Pages
                  </button>
                </div>
              </div>
            </div>

            {/* Page Selection Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <div className="flex items-center gap-2">
                <span className="text-xs sm:text-sm font-medium text-[#0F112E]">
                  {scope === 'all' ? (
                    <span className="text-[#7C3AED] font-semibold">
                      All {totalCount} pages will be rotated
                    </span>
                  ) : (
                    <span>
                      <strong className="text-[#7C3AED]">{selectedCount}</strong> of{' '}
                      {totalCount} pages selected
                    </span>
                  )}
                </span>
              </div>

              {scope === 'selected' && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSelectAll}
                    disabled={isRotating}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-[#7C3AED] bg-[#F4F0FD] hover:bg-[#EDE8FA] rounded-md transition-colors"
                  >
                    <CheckSquare className="w-3.5 h-3.5" />
                    <span>Select All</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleClearSelection}
                    disabled={isRotating}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-[#64748B] hover:text-[#DC2626] bg-[#F1F5F9] hover:bg-[#FEE2E2] rounded-md transition-colors"
                  >
                    <Square className="w-3.5 h-3.5" />
                    <span>Clear</span>
                  </button>
                </div>
              )}
            </div>

            {/* Page Thumbnails Grid */}
            <div className="space-y-2">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 max-h-[380px] overflow-y-auto p-2 border border-[#E4E2F0] rounded-xl bg-[#F4F3FA]">
                {pages.map((p) => {
                  const isEffectiveSelected = scope === 'all' || p.selected;
                  return (
                    <div
                      key={p.pageNumber}
                      onClick={() => {
                        if (!isRotating && scope === 'selected') {
                          togglePageSelection(p.pageNumber);
                        }
                      }}
                      className={`relative rounded-lg p-2 flex flex-col items-center justify-between transition-all select-none ${
                        scope === 'selected' ? 'cursor-pointer' : 'cursor-default'
                      } ${
                        isEffectiveSelected
                          ? 'bg-[#FFFFFF] border-2 border-[#7C3AED] shadow-xs'
                          : 'bg-[#FFFFFF]/70 border border-[#E2E8F0] opacity-60 hover:opacity-100'
                      }`}
                      role="checkbox"
                      aria-checked={isEffectiveSelected}
                      tabIndex={scope === 'selected' ? 0 : -1}
                      onKeyDown={(e) => {
                        if (scope === 'selected' && (e.key === ' ' || e.key === 'Enter')) {
                          e.preventDefault();
                          togglePageSelection(p.pageNumber);
                        }
                      }}
                    >
                      {/* Checkbox indicator */}
                      <div className="w-full flex items-center justify-between mb-1.5">
                        <span className="text-xs font-bold text-[#475467]">
                          Page {p.pageNumber}
                        </span>
                        <div
                          className={`w-4 h-4 rounded flex items-center justify-center text-white text-[10px] ${
                            isEffectiveSelected ? 'bg-[#7C3AED]' : 'border border-[#CBD5E1] bg-white'
                          }`}
                        >
                          {isEffectiveSelected && '✓'}
                        </div>
                      </div>

                      {/* Thumbnail Image or Placeholder */}
                      <div className="w-full h-32 bg-[#F1F5F9] rounded border border-[#E2E8F0] flex items-center justify-center overflow-hidden">
                        {p.thumbnailUrl ? (
                          <img
                            src={p.thumbnailUrl}
                            alt={`Preview of page ${p.pageNumber}`}
                            className="max-h-full max-w-full object-contain"
                          />
                        ) : (
                          <div className="flex flex-col items-center justify-center text-[#94A3B8] gap-1">
                            <FileText className="w-6 h-6" />
                            <span className="text-[10px] font-medium">Page {p.pageNumber}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Progress Bar while rotating */}
            {isRotating && (
              <div className="py-2 space-y-2">
                <ProgressBar progress={progress} />
                <p className="text-xs text-center text-[#64748B] font-medium animate-pulse">
                  {progressMessage || 'Rotating PDF pages...'}
                </p>
              </div>
            )}

            {/* Action CTA */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-end gap-3">
              <button
                type="button"
                onClick={resetAll}
                disabled={isRotating}
                className="w-full sm:w-auto px-4 py-2.5 text-sm font-medium text-[#475467] hover:text-[#0F112E] hover:bg-[#F1F5F9] rounded-lg transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRotate}
                disabled={isRotating || (scope === 'selected' && selectedCount === 0)}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg text-sm font-semibold text-white bg-[#7C3AED] hover:bg-[#6D28D9] active:scale-[0.98] transition-all shadow-sm disabled:opacity-50 disabled:pointer-events-none"
              >
                <RotateCw className="w-4 h-4" />
                <span>
                  {isRotating
                    ? 'Rotating PDF...'
                    : scope === 'all'
                    ? `Rotate All Pages (${angle}°)`
                    : `Rotate ${selectedCount} ${selectedCount === 1 ? 'Page' : 'Pages'} (${angle}°)`}
                </span>
              </button>
            </div>
          </div>
        )}

        {/* 3. Result State */}
        {result && (
          <div className="space-y-6 animate-fadeIn text-center">
            <div className="w-14 h-14 rounded-full bg-[#ECFDF5] border border-[#A7F3D0] flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8 text-[#059669]" />
            </div>

            <div>
              <h3 className="text-2xl font-bold text-[#0F112E]">
                PDF rotated successfully
              </h3>
              <p className="text-sm text-[#475467] mt-1">
                Rotated {result.rotatedPageCount}{' '}
                {result.rotatedPageCount === 1 ? 'page' : 'pages'} by {result.angle}° clockwise
                without quality loss.
              </p>
            </div>

            {/* Document stats */}
            <div className="p-4 bg-[#F4F3FA] border border-[#E2E8F0] rounded-xl max-w-md mx-auto text-xs sm:text-sm text-[#475467] space-y-1">
              <div className="flex justify-between">
                <span className="text-[#64748B]">Output Document:</span>
                <span className="font-semibold text-[#0F112E] truncate max-w-[200px]" title={result.resultFileName}>
                  {result.resultFileName}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#64748B]">Document Size:</span>
                <span className="font-medium text-[#0F112E]">{formatBytes(result.resultSize)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#64748B]">Total Pages:</span>
                <span className="font-medium text-[#0F112E]">{result.pageCount}</span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={handleDownload}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg text-sm font-semibold text-white bg-[#059669] hover:bg-[#047857] active:scale-[0.98] transition-all shadow-sm"
              >
                <Download className="w-4 h-4" />
                <span>Download Rotated PDF</span>
              </button>
              <button
                type="button"
                onClick={resetAll}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 rounded-lg text-sm font-medium text-[#475467] bg-[#F1F5F9] hover:bg-[#E2E8F0] active:scale-[0.98] transition-all"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Rotate another PDF</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default RotatePdfController;
