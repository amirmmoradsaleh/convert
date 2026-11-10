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
  ArrowUp,
  ArrowDown,
  RotateCcw,
  GripVertical,
  Info,
} from 'lucide-react';
import { formatBytes, triggerBlobDownload } from '@/engines/shared/file-utils';
import {
  reorderPdfPages,
  ReorderPdfPagesResult,
} from '@/engines/pdf/reorder-pages';
import { loadPdfDocument, LoadedPdfDocument } from '@/engines/pdf/loader';
import { renderPdfPageThumbnail } from '@/engines/pdf/renderer';
import { validateReorderPdfPagesFile } from '@/engines/pdf/validation';
import ProgressBar from './ProgressBar';

interface PageItem {
  originalPageNumber: number; // 1-indexed original page
  thumbnailUrl?: string;
}

export function ReorderPdfPagesController() {
  const [isHydrated, setIsHydrated] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [pdfDocInfo, setPdfDocInfo] = useState<LoadedPdfDocument | null>(null);
  const [pages, setPages] = useState<PageItem[]>([]);

  // Drag-and-drop state
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Processing state
  const [isLoadingPdf, setIsLoadingPdf] = useState(false);
  const [isReordering, setIsReordering] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState('');
  const [globalMessage, setGlobalMessage] = useState<{
    type: 'error' | 'info' | 'warning';
    text: string;
  } | null>(null);

  // Result state
  const [result, setResult] = useState<ReorderPdfPagesResult | null>(null);
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
    setDraggedIndex(null);
    setDragOverIndex(null);
  }, [downloadUrl]);

  const handleFileSelected = useCallback(
    async (incomingFile: File, multiNotice?: string) => {
      resetAll();
      setGlobalMessage(multiNotice ? { type: 'info', text: multiNotice } : null);
      setIsLoadingPdf(true);

      try {
        const validation = await validateReorderPdfPagesFile(incomingFile);
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

        if (loaded.pageCount === 1) {
          setGlobalMessage({
            type: 'info',
            text: 'This document contains only 1 page. Reordering is not applicable, but you can still download a validated copy.',
          });
        }

        // Initialize pages in sequential 1..pageCount order
        const initialPages: PageItem[] = [];
        for (let i = 1; i <= loaded.pageCount; i++) {
          initialPages.push({
            originalPageNumber: i,
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
                  prev.map((p) =>
                    p.originalPageNumber === i ? { ...p, thumbnailUrl: thumbUrl } : p
                  )
                );
              }
            } catch {
              // Fallback to placeholder card
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
          ? 'Reorder PDF Pages processes one document at a time. Processing the first file.'
          : undefined;
      handleFileSelected(e.dataTransfer.files[0], notice);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const notice =
        e.target.files.length > 1
          ? 'Reorder PDF Pages processes one document at a time. Processing the first file.'
          : undefined;
      handleFileSelected(e.target.files[0], notice);
    }
    if (e.target) {
      e.target.value = '';
    }
  };

  // Reordering helpers
  const movePage = (fromIndex: number, toIndex: number) => {
    if (fromIndex < 0 || fromIndex >= pages.length || toIndex < 0 || toIndex >= pages.length) {
      return;
    }
    setPages((prev) => {
      const updated = [...prev];
      const [moved] = updated.splice(fromIndex, 1);
      updated.splice(toIndex, 0, moved);
      return updated;
    });
  };

  const handleMoveUp = (index: number) => {
    if (index > 0) {
      movePage(index, index - 1);
    }
  };

  const handleMoveDown = (index: number) => {
    if (index < pages.length - 1) {
      movePage(index, index + 1);
    }
  };

  const handleResetOrder = () => {
    if (!pdfDocInfo) return;
    setPages((prev) =>
      [...prev].sort((a, b) => a.originalPageNumber - b.originalPageNumber)
    );
  };

  // Drag and drop page reordering
  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    // Transparent or ghost image
    try {
      e.dataTransfer.setData('text/plain', String(index));
    } catch {
      // Ignore if setData fails in some environments
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const handlePageDrop = (e: React.DragEvent<HTMLDivElement>, targetIndex: number) => {
    e.preventDefault();
    if (draggedIndex !== null && draggedIndex !== targetIndex) {
      movePage(draggedIndex, targetIndex);
    }
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const isOrderChanged = pages.some((p, i) => p.originalPageNumber !== i + 1);
  const isSinglePage = pages.length === 1;

  const handleReorder = async () => {
    if (!file || !pdfDocInfo || pages.length === 0) return;

    setIsReordering(true);
    setProgress(5);
    setProgressMessage('Starting page reordering...');
    setGlobalMessage(null);

    try {
      const newPageOrder = pages.map((p) => p.originalPageNumber);

      const reorderResult = await reorderPdfPages(
        file,
        {
          newPageOrder,
        },
        (prog) => {
          setProgress(prog.progress);
          setProgressMessage(prog.message);
        }
      );

      const url = URL.createObjectURL(reorderResult.resultBlob);
      setDownloadUrl(url);
      setResult(reorderResult);
    } catch (err: unknown) {
      const errAny = err as { message?: string };
      setGlobalMessage({
        type: 'error',
        text: errAny?.message || 'Failed to reorder PDF pages. Please try again.',
      });
    } finally {
      setIsReordering(false);
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
        {/* Global info / error / warning banner */}
        {globalMessage && (
          <div
            className={`p-4 rounded-lg flex items-start gap-3 text-sm animate-fadeIn ${
              globalMessage.type === 'error'
                ? 'bg-[#FEF2F2] border border-[#FCA5A5] text-[#991B1B]'
                : globalMessage.type === 'warning'
                ? 'bg-[#FFFBEB] border border-[#FDE68A] text-[#92400E]'
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
            aria-label="Upload PDF file to reorder pages"
          >
            <input
              ref={fileInputRef}
              id="reorder-pdf-pages-file-input"
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
              {isLoadingPdf ? 'Reading PDF file...' : 'Choose a PDF file to reorder pages'}
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

        {/* 2. File Selected & Ready to Reorder */}
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

              {!isReordering && (
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

            {/* Reordering Controls & State Bar */}
            <div className="p-4 bg-[#FFFFFF] border border-[#E4E2F0] rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm font-semibold text-[#0F112E]">
                  <span>Current Page Sequence:</span>
                  <span
                    className={`font-mono text-xs px-2 py-0.5 rounded ${
                      isOrderChanged
                        ? 'bg-[#E6F4F1] text-[#7C3AED] font-bold'
                        : 'bg-[#F1F5F9] text-[#64748B]'
                    }`}
                  >
                    {pages.map((p) => p.originalPageNumber).join(' → ')}
                  </span>
                </div>
                <p className="text-xs text-[#64748B]">
                  {isOrderChanged
                    ? 'Page order modified. Drag thumbnails or use arrow buttons to adjust.'
                    : 'Original page order. Drag thumbnails or use arrows to rearrange.'}
                </p>
              </div>

              <div>
                <button
                  type="button"
                  onClick={handleResetOrder}
                  disabled={!isOrderChanged || isReordering}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#64748B] hover:text-[#0F112E] bg-[#F1F5F9] hover:bg-[#E2E8F0] rounded-md transition-colors disabled:opacity-50"
                  title="Restore original page order"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset Order</span>
                </button>
              </div>
            </div>

            {/* Page Thumbnails Grid with Drag & Drop and Move buttons */}
            <div className="space-y-2">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 max-h-[460px] overflow-y-auto p-3 border border-[#E4E2F0] rounded-xl bg-[#F4F3FA]">
                {pages.map((p, index) => {
                  const isFirst = index === 0;
                  const isLast = index === pages.length - 1;
                  const isDragged = draggedIndex === index;
                  const isTarget = dragOverIndex === index;

                  return (
                    <div
                      key={`page-${p.originalPageNumber}`}
                      draggable={!isReordering && !isSinglePage}
                      onDragStart={(e) => handleDragStart(e, index)}
                      onDragOver={(e) => handleDragOver(e, index)}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handlePageDrop(e, index)}
                      onDragEnd={handleDragEnd}
                      className={`relative rounded-lg p-2 flex flex-col justify-between transition-all select-none border ${
                        isDragged
                          ? 'opacity-40 border-dashed border-[#7C3AED]'
                          : isTarget
                          ? 'border-2 border-[#7C3AED] bg-[#E6F4F1]/30 shadow-md scale-[1.02]'
                          : 'bg-[#FFFFFF] border-[#CBD5E1] hover:border-[#7C3AED] hover:shadow-xs'
                      }`}
                      aria-label={`Position ${index + 1}: Original Page ${p.originalPageNumber}`}
                    >
                      {/* Top Header of Card */}
                      <div className="w-full flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-1">
                          <GripVertical className="w-3.5 h-3.5 text-[#94A3B8] cursor-grab active:cursor-grabbing shrink-0" />
                          <span className="text-xs font-bold text-[#0F112E]">
                            #{index + 1}
                          </span>
                        </div>

                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-[#F1F5F9] text-[#64748B]">
                          Page {p.originalPageNumber}
                        </span>
                      </div>

                      {/* Thumbnail Image or Placeholder */}
                      <div className="w-full h-32 rounded border border-[#E2E8F0] bg-[#F1F5F9] flex items-center justify-center overflow-hidden mb-2">
                        {p.thumbnailUrl ? (
                          <img
                            src={p.thumbnailUrl}
                            alt={`Preview of original page ${p.originalPageNumber}`}
                            className="max-h-full max-w-full object-contain pointer-events-none"
                          />
                        ) : (
                          <div className="flex flex-col items-center justify-center text-[#94A3B8] gap-1">
                            <FileText className="w-6 h-6" />
                            <span className="text-[10px] font-medium">
                              Page {p.originalPageNumber}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Accessible Move Controls */}
                      <div className="w-full flex items-center justify-between gap-1 pt-1 border-t border-[#F1F5F9]">
                        <button
                          type="button"
                          onClick={() => handleMoveUp(index)}
                          disabled={isFirst || isReordering}
                          aria-label={`Move page ${p.originalPageNumber} earlier`}
                          className="flex-1 py-1 px-1.5 rounded text-[11px] font-semibold text-[#475467] hover:text-[#0F112E] hover:bg-[#F1F5F9] disabled:opacity-30 disabled:pointer-events-none flex items-center justify-center gap-0.5 border border-[#E2E8F0] transition-colors"
                        >
                          <ArrowUp className="w-3 h-3" />
                          <span>Up</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleMoveDown(index)}
                          disabled={isLast || isReordering}
                          aria-label={`Move page ${p.originalPageNumber} later`}
                          className="flex-1 py-1 px-1.5 rounded text-[11px] font-semibold text-[#475467] hover:text-[#0F112E] hover:bg-[#F1F5F9] disabled:opacity-30 disabled:pointer-events-none flex items-center justify-center gap-0.5 border border-[#E2E8F0] transition-colors"
                        >
                          <ArrowDown className="w-3 h-3" />
                          <span>Down</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Progress Bar while reordering */}
            {isReordering && (
              <div className="py-2 space-y-2">
                <ProgressBar progress={progress} />
                <p className="text-xs text-center text-[#64748B] font-medium animate-pulse">
                  {progressMessage || 'Reordering PDF pages...'}
                </p>
              </div>
            )}

            {/* Action CTA */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-end gap-3">
              <button
                type="button"
                onClick={resetAll}
                disabled={isReordering}
                className="w-full sm:w-auto px-4 py-2.5 text-sm font-medium text-[#475467] hover:text-[#0F112E] hover:bg-[#F1F5F9] rounded-lg transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                id="reorder-pages-submit-btn"
                onClick={handleReorder}
                disabled={isReordering}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg text-sm font-semibold text-white bg-[#7C3AED] hover:bg-[#6D28D9] active:scale-[0.98] transition-all shadow-sm disabled:opacity-50 disabled:pointer-events-none"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>
                  {isReordering
                    ? 'Reordering Pages...'
                    : isOrderChanged
                    ? 'Apply New Page Order'
                    : 'Save PDF Pages'}
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
                PDF pages reordered successfully
              </h3>
              <p className="text-sm text-[#475467] mt-1">
                Your new document has been generated in the requested page sequence.
              </p>
            </div>

            {/* Document stats */}
            <div className="p-4 bg-[#F4F3FA] border border-[#E2E8F0] rounded-xl max-w-md mx-auto text-xs sm:text-sm text-[#475467] space-y-1">
              <div className="flex justify-between">
                <span className="text-[#64748B]">Output Document:</span>
                <span
                  className="font-semibold text-[#0F112E] truncate max-w-[200px]"
                  title={result.resultFileName}
                >
                  {result.resultFileName}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#64748B]">Document Size:</span>
                <span className="font-medium text-[#0F112E]">
                  {formatBytes(result.resultSize)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#64748B]">Page Count:</span>
                <span className="font-medium text-[#0F112E]">
                  {result.pageCount} {result.pageCount === 1 ? 'page' : 'pages'}
                </span>
              </div>
              <div className="flex justify-between items-center pt-1 border-t border-[#E2E8F0] mt-1">
                <span className="text-[#64748B]">New Sequence:</span>
                <span className="font-mono text-xs font-bold text-[#7C3AED]">
                  {result.newPageOrder.join(' → ')}
                </span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={handleDownload}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg text-sm font-semibold text-white bg-[#059669] hover:bg-[#047857] active:scale-[0.98] transition-all shadow-sm"
              >
                <Download className="w-4 h-4" />
                <span>Download Reordered PDF</span>
              </button>
              <button
                type="button"
                onClick={resetAll}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 rounded-lg text-sm font-medium text-[#475467] bg-[#F1F5F9] hover:bg-[#E2E8F0] active:scale-[0.98] transition-all"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Reorder another PDF</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default ReorderPdfPagesController;
