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
  AlertTriangle,
  CheckSquare,
  Square,
  Info,
} from 'lucide-react';
import { formatBytes, triggerBlobDownload } from '@/engines/shared/file-utils';
import {
  deletePdfPages,
  DeletePdfPagesResult,
} from '@/engines/pdf/delete-pages';
import { loadPdfDocument, LoadedPdfDocument } from '@/engines/pdf/loader';
import { renderPdfPageThumbnail } from '@/engines/pdf/renderer';
import { validateDeletePdfPagesFile } from '@/engines/pdf/validation';
import ProgressBar from './ProgressBar';

interface PagePreviewItem {
  pageNumber: number;
  thumbnailUrl?: string;
  markedForDeletion: boolean;
}

export function DeletePdfPagesController() {
  const [isHydrated, setIsHydrated] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [pdfDocInfo, setPdfDocInfo] = useState<LoadedPdfDocument | null>(null);
  const [pages, setPages] = useState<PagePreviewItem[]>([]);

  // Processing state
  const [isLoadingPdf, setIsLoadingPdf] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState('');
  const [globalMessage, setGlobalMessage] = useState<{
    type: 'error' | 'info' | 'warning';
    text: string;
  } | null>(null);

  // Result state
  const [result, setResult] = useState<DeletePdfPagesResult | null>(null);
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
  }, [downloadUrl]);

  const handleFileSelected = useCallback(
    async (incomingFile: File, multiNotice?: string) => {
      resetAll();
      setGlobalMessage(multiNotice ? { type: 'info', text: multiNotice } : null);
      setIsLoadingPdf(true);

      try {
        // Validate file
        const validation = await validateDeletePdfPagesFile(incomingFile);
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

        // Initialize pages with none marked for deletion by default
        const initialPages: PagePreviewItem[] = [];
        for (let i = 1; i <= loaded.pageCount; i++) {
          initialPages.push({
            pageNumber: i,
            markedForDeletion: false,
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
          ? 'Delete PDF Pages processes one document at a time. Processing the first file.'
          : undefined;
      handleFileSelected(e.dataTransfer.files[0], notice);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const notice =
        e.target.files.length > 1
          ? 'Delete PDF Pages processes one document at a time. Processing the first file.'
          : undefined;
      handleFileSelected(e.target.files[0], notice);
    }
    if (e.target) {
      e.target.value = '';
    }
  };

  const togglePageDeletion = (pageNumber: number) => {
    setPages((prev) =>
      prev.map((p) =>
        p.pageNumber === pageNumber
          ? { ...p, markedForDeletion: !p.markedForDeletion }
          : p
      )
    );
  };

  const handleSelectAll = () => {
    setPages((prev) => prev.map((p) => ({ ...p, markedForDeletion: true })));
  };

  const handleClearSelection = () => {
    setPages((prev) => prev.map((p) => ({ ...p, markedForDeletion: false })));
  };

  const deleteCount = pages.filter((p) => p.markedForDeletion).length;
  const totalCount = pages.length;
  const remainingCount = totalCount - deleteCount;

  const isAllPagesSelected = totalCount > 0 && deleteCount === totalCount;
  const isSinglePageDoc = totalCount === 1;
  const canDelete = deleteCount > 0 && remainingCount > 0 && !isDeleting;

  const handleDelete = async () => {
    if (!file || !pdfDocInfo) return;

    if (isSinglePageDoc) {
      setGlobalMessage({
        type: 'error',
        text: 'A single-page PDF cannot have its only page deleted. At least one page must remain in the PDF.',
      });
      return;
    }

    if (deleteCount === 0) {
      setGlobalMessage({
        type: 'error',
        text: 'Please select at least one page to delete.',
      });
      return;
    }

    if (isAllPagesSelected) {
      setGlobalMessage({
        type: 'error',
        text: 'At least one page must remain in the PDF. You cannot delete all pages.',
      });
      return;
    }

    setIsDeleting(true);
    setProgress(5);
    setProgressMessage('Starting page removal...');
    setGlobalMessage(null);

    try {
      const pagesToDelete = pages
        .filter((p) => p.markedForDeletion)
        .map((p) => p.pageNumber);

      const deleteResult = await deletePdfPages(
        file,
        {
          pagesToDelete,
        },
        (prog) => {
          setProgress(prog.progress);
          setProgressMessage(prog.message);
        }
      );

      const url = URL.createObjectURL(deleteResult.resultBlob);
      setDownloadUrl(url);
      setResult(deleteResult);
    } catch (err: unknown) {
      const errAny = err as { message?: string };
      setGlobalMessage({
        type: 'error',
        text: errAny?.message || 'Failed to delete PDF pages. Please try again.',
      });
    } finally {
      setIsDeleting(false);
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
            ) : globalMessage.type === 'warning' ? (
              <AlertTriangle className="w-5 h-5 shrink-0 text-[#D97706] mt-0.5" />
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
            aria-label="Upload PDF file to delete pages"
          >
            <input
              ref={fileInputRef}
              id="delete-pdf-pages-file-input"
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
              {isLoadingPdf ? 'Reading PDF file...' : 'Choose a PDF file to delete pages'}
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

              {!isDeleting && (
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

            {/* Selection Overview & Action Bar */}
            <div className="p-4 bg-[#FFFFFF] border border-[#E4E2F0] rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm font-semibold text-[#0F112E]">
                  <span className="text-[#DC2626]">
                    {deleteCount} {deleteCount === 1 ? 'page' : 'pages'} selected for deletion
                  </span>
                  <span>•</span>
                  <span className="text-[#059669]">
                    {remainingCount} {remainingCount === 1 ? 'page' : 'pages'} will remain
                  </span>
                </div>
                <p className="text-xs text-[#64748B]">
                  Click on page thumbnails below to mark or unmark pages for removal.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSelectAll}
                  disabled={isDeleting || isSinglePageDoc}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#DC2626] bg-[#FEF2F2] hover:bg-[#FEE2E2] rounded-md transition-colors disabled:opacity-50"
                >
                  <CheckSquare className="w-3.5 h-3.5" />
                  <span>Select All</span>
                </button>
                <button
                  type="button"
                  onClick={handleClearSelection}
                  disabled={isDeleting || deleteCount === 0}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#64748B] hover:text-[#0F112E] bg-[#F1F5F9] hover:bg-[#E2E8F0] rounded-md transition-colors disabled:opacity-50"
                >
                  <Square className="w-3.5 h-3.5" />
                  <span>Clear Selection</span>
                </button>
              </div>
            </div>

            {/* Safety Warning when all pages or single page is selected */}
            {isAllPagesSelected && (
              <div
                className="p-4 rounded-lg bg-[#FEF2F2] border border-[#FCA5A5] text-[#991B1B] text-sm flex items-center gap-3 animate-fadeIn"
                role="alert"
              >
                <AlertTriangle className="w-5 h-5 shrink-0 text-[#DC2626]" />
                <span className="font-semibold">
                  At least one page must remain in the PDF. You cannot delete all pages.
                </span>
              </div>
            )}

            {isSinglePageDoc && (
              <div
                className="p-4 rounded-lg bg-[#FFFBEB] border border-[#FDE68A] text-[#92400E] text-sm flex items-center gap-3 animate-fadeIn"
                role="alert"
              >
                <AlertTriangle className="w-5 h-5 shrink-0 text-[#D97706]" />
                <span className="font-semibold">
                  A single-page PDF cannot have its only page deleted. At least one page must remain in the PDF.
                </span>
              </div>
            )}

            {/* Page Thumbnails Grid */}
            <div className="space-y-2">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 max-h-[400px] overflow-y-auto p-3 border border-[#E4E2F0] rounded-xl bg-[#F4F3FA]">
                {pages.map((p) => {
                  const isDeleted = p.markedForDeletion;
                  return (
                    <div
                      key={p.pageNumber}
                      onClick={() => {
                        if (!isDeleting && !isSinglePageDoc) {
                          togglePageDeletion(p.pageNumber);
                        }
                      }}
                      className={`relative rounded-lg p-2 flex flex-col items-center justify-between transition-all select-none ${
                        isSinglePageDoc
                          ? 'cursor-not-allowed opacity-75 bg-[#FFFFFF] border border-[#E2E8F0]'
                          : 'cursor-pointer hover:shadow-xs'
                      } ${
                        isDeleted
                          ? 'bg-[#FEF2F2] border-2 border-[#DC2626] shadow-xs'
                          : 'bg-[#FFFFFF] border border-[#CBD5E1]'
                      }`}
                      role="checkbox"
                      aria-checked={isDeleted}
                      tabIndex={isSinglePageDoc ? -1 : 0}
                      onKeyDown={(e) => {
                        if (!isSinglePageDoc && (e.key === ' ' || e.key === 'Enter')) {
                          e.preventDefault();
                          togglePageDeletion(p.pageNumber);
                        }
                      }}
                    >
                      {/* Top Header of Card */}
                      <div className="w-full flex items-center justify-between mb-1.5">
                        <span className="text-xs font-bold text-[#475467]">
                          Page {p.pageNumber}
                        </span>

                        <div
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 ${
                            isDeleted
                              ? 'bg-[#DC2626] text-white'
                              : 'bg-[#F1F5F9] text-[#64748B]'
                          }`}
                        >
                          {isDeleted ? 'To Delete' : 'Keep'}
                        </div>
                      </div>

                      {/* Thumbnail Image or Placeholder */}
                      <div
                        className={`w-full h-32 rounded border flex items-center justify-center overflow-hidden transition-opacity ${
                          isDeleted
                            ? 'bg-[#FEE2E2]/50 border-[#FCA5A5] opacity-60'
                            : 'bg-[#F1F5F9] border-[#E2E8F0]'
                        }`}
                      >
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

            {/* Progress Bar while deleting */}
            {isDeleting && (
              <div className="py-2 space-y-2">
                <ProgressBar progress={progress} />
                <p className="text-xs text-center text-[#64748B] font-medium animate-pulse">
                  {progressMessage || 'Removing pages from PDF...'}
                </p>
              </div>
            )}

            {/* Action CTA */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-end gap-3">
              <button
                type="button"
                onClick={resetAll}
                disabled={isDeleting}
                className="w-full sm:w-auto px-4 py-2.5 text-sm font-medium text-[#475467] hover:text-[#0F112E] hover:bg-[#F1F5F9] rounded-lg transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                id="delete-pages-submit-btn"
                onClick={handleDelete}
                disabled={!canDelete}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg text-sm font-semibold text-white bg-[#DC2626] hover:bg-[#B91C1C] active:scale-[0.98] transition-all shadow-sm disabled:opacity-50 disabled:pointer-events-none"
              >
                <Trash2 className="w-4 h-4" />
                <span>
                  {isDeleting
                    ? 'Removing Pages...'
                    : deleteCount === 0
                    ? 'Select Pages to Delete'
                    : `Delete ${deleteCount} ${deleteCount === 1 ? 'Page' : 'Pages'} (${remainingCount} Remaining)`}
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
                Pages deleted successfully
              </h3>
              <p className="text-sm text-[#475467] mt-1">
                Removed {result.deletedPageCount}{' '}
                {result.deletedPageCount === 1 ? 'page' : 'pages'}. Your new document contains{' '}
                {result.pageCount} {result.pageCount === 1 ? 'page' : 'pages'}.
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
                <span className="text-[#64748B]">Remaining Pages:</span>
                <span className="font-medium text-[#059669] font-bold">
                  {result.pageCount} of {result.originalPageCount}
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
                <span>Download PDF</span>
              </button>
              <button
                type="button"
                onClick={resetAll}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 rounded-lg text-sm font-medium text-[#475467] bg-[#F1F5F9] hover:bg-[#E2E8F0] active:scale-[0.98] transition-all"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Delete pages from another PDF</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default DeletePdfPagesController;
