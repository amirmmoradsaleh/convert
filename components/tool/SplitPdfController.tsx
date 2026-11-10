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
  Scissors,
  Layers,
  Archive,
  CheckSquare,
  Square,
  Sparkles,
} from 'lucide-react';
import { formatBytes, triggerBlobDownload } from '@/engines/shared/file-utils';
import {
  splitPdf,
  SplitPdfMode,
  SplitPdfResult,
  SplitPdfProgress,
} from '@/engines/pdf/split';
import { loadPdfDocument, LoadedPdfDocument } from '@/engines/pdf/loader';
import { renderPdfPageThumbnail } from '@/engines/pdf/renderer';
import {
  validateSplitPdfFile,
  parseSplitRanges,
  ParsedSplitRange,
} from '@/engines/pdf/validation';
import ProgressBar from './ProgressBar';

interface PagePreviewItem {
  pageNumber: number;
  thumbnailUrl?: string;
  selected: boolean;
}

export function SplitPdfController() {
  const [isHydrated, setIsHydrated] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [pdfDocInfo, setPdfDocInfo] = useState<LoadedPdfDocument | null>(null);
  const [pages, setPages] = useState<PagePreviewItem[]>([]);

  // Split settings
  const [mode, setMode] = useState<SplitPdfMode>('extract-pages');
  const [rangeInput, setRangeInput] = useState('');
  const [parsedRanges, setParsedRanges] = useState<ParsedSplitRange[]>([]);
  const [rangeError, setRangeError] = useState<string | null>(null);

  // Processing state
  const [isLoadingPdf, setIsLoadingPdf] = useState(false);
  const [isSplitting, setIsSplitting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState('');
  const [globalMessage, setGlobalMessage] = useState<{ type: 'error' | 'info'; text: string } | null>(null);

  // Result state
  const [result, setResult] = useState<SplitPdfResult | null>(null);
  const [itemUrls, setItemUrls] = useState<Record<string, string>>({});
  const [zipUrl, setZipUrl] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  // Cleanup object URLs on unmount or reset
  useEffect(() => {
    return () => {
      Object.values(itemUrls).forEach((url) => {
        if (url) URL.revokeObjectURL(url);
      });
      if (zipUrl) {
        URL.revokeObjectURL(zipUrl);
      }
    };
  }, [itemUrls, zipUrl]);

  const resetAll = useCallback(() => {
    Object.values(itemUrls).forEach((url) => {
      if (url) URL.revokeObjectURL(url);
    });
    if (zipUrl) {
      URL.revokeObjectURL(zipUrl);
    }
    setFile(null);
    setPdfDocInfo(null);
    setPages([]);
    setRangeInput('');
    setParsedRanges([]);
    setRangeError(null);
    setResult(null);
    setItemUrls({});
    setZipUrl(null);
    setProgress(0);
    setProgressMessage('');
    setGlobalMessage(null);
    setMode('extract-pages');
  }, [itemUrls, zipUrl]);

  // Update parsed ranges live when range input or mode changes
  useEffect(() => {
    if (mode !== 'split-ranges' || !pdfDocInfo) {
      setRangeError(null);
      setParsedRanges([]);
      return;
    }

    if (!rangeInput.trim()) {
      setRangeError(null);
      setParsedRanges([]);
      return;
    }

    const res = parseSplitRanges(rangeInput, pdfDocInfo.pageCount);
    if (!res.valid) {
      setRangeError(res.error || 'Invalid page range format.');
      setParsedRanges([]);
    } else {
      setRangeError(null);
      setParsedRanges(res.ranges);
    }
  }, [mode, rangeInput, pdfDocInfo]);

  const handleFileSelected = useCallback(
    async (incomingFile: File, multiNotice?: string) => {
      resetAll();
      setGlobalMessage(multiNotice ? { type: 'info', text: multiNotice } : null);
      setIsLoadingPdf(true);

      try {
        // Validate file
        const validation = await validateSplitPdfFile(incomingFile);
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

        // Pre-populate default page range suggestion
        if (loaded.pageCount <= 4) {
          setRangeInput(Array.from({ length: loaded.pageCount }, (_, i) => `${i + 1}`).join(', '));
        } else {
          const mid = Math.ceil(loaded.pageCount / 2);
          setRangeInput(`1-${mid}, ${mid + 1}-${loaded.pageCount}`);
        }

        // Initialize all pages as selected by default for Mode A
        const initialPages: PagePreviewItem[] = [];
        for (let i = 1; i <= loaded.pageCount; i++) {
          initialPages.push({
            pageNumber: i,
            selected: true,
          });
        }
        setPages(initialPages);

        // Render thumbnails in background for first 30 pages to conserve client memory
        const maxThumbnails = Math.min(loaded.pageCount, 30);
        setTimeout(async () => {
          for (let i = 1; i <= maxThumbnails; i++) {
            try {
              const thumbUrl = await renderPdfPageThumbnail(loaded.pdfDoc, i, 120);
              if (thumbUrl) {
                setPages((prev) =>
                  prev.map((p) => (p.pageNumber === i ? { ...p, thumbnailUrl: thumbUrl } : p))
                );
              }
            } catch {
              // Card fallback placeholder will render gracefully
            }
          }
        }, 50);
      } catch (err: unknown) {
        const errAny = err as { message?: string };
        const msg =
          errAny?.message || "We couldn't read this PDF. Please try another file.";
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
          ? 'Split PDF works with one PDF at a time. Processing the first document.'
          : undefined;
      handleFileSelected(e.dataTransfer.files[0], notice);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const notice =
        e.target.files.length > 1
          ? 'Split PDF works with one PDF at a time. Processing the first document.'
          : undefined;
      handleFileSelected(e.target.files[0], notice);
      e.target.value = '';
    }
  };

  const togglePageSelection = (pageNumber: number) => {
    setPages((prev) =>
      prev.map((p) => (p.pageNumber === pageNumber ? { ...p, selected: !p.selected } : p))
    );
  };

  const selectAllPages = () => {
    setPages((prev) => prev.map((p) => ({ ...p, selected: true })));
  };

  const clearAllPages = () => {
    setPages((prev) => prev.map((p) => ({ ...p, selected: false })));
  };

  const selectedPagesList = pages.filter((p) => p.selected).map((p) => p.pageNumber);

  // Execute PDF Splitting
  const handleSplitPdf = async () => {
    if (!file || !pdfDocInfo) return;

    setGlobalMessage(null);

    if (mode === 'extract-pages' && selectedPagesList.length === 0) {
      setGlobalMessage({
        type: 'error',
        text: 'Please select at least one page to extract.',
      });
      return;
    }

    if (mode === 'split-ranges') {
      const res = parseSplitRanges(rangeInput, pdfDocInfo.pageCount);
      if (!res.valid || res.ranges.length === 0) {
        setGlobalMessage({
          type: 'error',
          text: res.error || 'Please enter valid page ranges (e.g. 1-3, 4-8).',
        });
        return;
      }
    }

    setIsSplitting(true);
    setProgress(5);
    setProgressMessage('Starting PDF split process...');

    try {
      const splitResult = await splitPdf(
        file,
        {
          mode,
          selectedPages: selectedPagesList,
          ranges: mode === 'split-ranges' ? parsedRanges : undefined,
        },
        (p: SplitPdfProgress) => {
          setProgress(p.progress);
          setProgressMessage(p.message);
        }
      );

      // Create object URLs for direct browser downloads
      const urls: Record<string, string> = {};
      splitResult.items.forEach((item) => {
        urls[item.fileName] = URL.createObjectURL(item.blob);
      });
      setItemUrls(urls);

      if (splitResult.zipBlob) {
        setZipUrl(URL.createObjectURL(splitResult.zipBlob));
      }

      setResult(splitResult);
    } catch (err: unknown) {
      const errAny = err as { message?: string };
      setGlobalMessage({
        type: 'error',
        text:
          errAny?.message ||
          'Failed to split PDF document. Please ensure the file is valid and unlocked.',
      });
    } finally {
      setIsSplitting(false);
    }
  };

  const downloadAllZip = () => {
    if (!result?.zipBlob || !result.zipFileName) return;
    triggerBlobDownload(result.zipBlob, result.zipFileName);
  };

  const downloadSinglePdf = (fileName: string, blob: Blob) => {
    triggerBlobDownload(blob, fileName);
  };

  if (!isHydrated) {
    return (
      <div className="bg-[#FFFFFF] border border-[#E4E2F0] rounded-card p-8 text-center text-[#5E6488]">
        Loading Split PDF tool...
      </div>
    );
  }

  return (
    <div data-hydrated="true" className="space-y-6">
      {/* Global alert / error banner */}
      {globalMessage && (
        <div
          role="alert"
          className={`p-4 rounded-xl border flex items-start gap-3 text-sm ${
            globalMessage.type === 'error'
              ? 'bg-rose-50 border-rose-200 text-rose-800'
              : 'bg-teal-50 border-teal-200 text-teal-800'
          }`}
        >
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div className="flex-1 font-medium">{globalMessage.text}</div>
          <button
            onClick={() => setGlobalMessage(null)}
            className="text-gray-400 hover:text-gray-600 font-bold ml-2"
            aria-label="Dismiss alert"
          >
            ×
          </button>
        </div>
      )}

      {/* Initial Upload Phase */}
      {!file && !result && (
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-[#CBD5E1] hover:border-[#7C3AED] bg-[#F4F3FA] hover:bg-[#F0F7F7] transition-all rounded-card p-8 md:p-12 text-center cursor-pointer group"
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              fileInputRef.current?.click();
            }
          }}
          aria-label="Upload PDF to split"
        >
          <input
            id="split-pdf-file-input"
            type="file"
            multiple
            ref={fileInputRef}
            onChange={handleFileInputChange}
            accept=".pdf,application/pdf"
            className="hidden"
          />
          <div className="max-w-md mx-auto space-y-4">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-[#E6F4F1] text-[#7C3AED] flex items-center justify-center group-hover:scale-105 transition-transform">
              <UploadCloud className="w-8 h-8" />
            </div>
            <div>
              <p className="text-base font-semibold text-[#0F112E]">
                {isLoadingPdf
                  ? 'Analyzing and parsing PDF...'
                  : 'Click to upload or drag and drop your PDF'}
              </p>
              <p className="text-sm text-[#5E6488] mt-1">
                Single PDF file up to 100 MB. 100% private client-side processing.
              </p>
            </div>
            <div className="inline-flex items-center justify-center px-4 py-2 text-xs font-medium text-[#7C3AED] bg-white border border-[#CBD5E1] rounded-lg shadow-2xs">
              Select PDF File
            </div>
          </div>
        </div>
      )}

      {/* Main Split Configuration UI */}
      {file && pdfDocInfo && !result && (
        <div className="space-y-6">
          {/* Active File Header Card */}
          <div className="bg-[#FFFFFF] border border-[#E4E2F0] rounded-card p-4 md:p-6 shadow-subtle flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-[#E6F4F1] text-[#7C3AED] flex items-center justify-center flex-shrink-0">
                <FileText className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <h3 className="text-base font-semibold text-[#0F112E] truncate" title={file.name}>
                  {file.name}
                </h3>
                <p className="text-xs text-[#5E6488] flex items-center gap-2 mt-0.5">
                  <span>{formatBytes(file.size)}</span>
                  <span>•</span>
                  <span className="font-medium text-[#7C3AED]">
                    {pdfDocInfo.pageCount} {pdfDocInfo.pageCount === 1 ? 'page' : 'pages'}
                  </span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={resetAll}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#5E6488] hover:text-rose-600 hover:bg-rose-50 border border-[#E4E2F0] rounded-lg transition-colors"
                title="Remove file and choose another"
              >
                <Trash2 className="w-4 h-4" />
                <span>Change PDF</span>
              </button>
            </div>
          </div>

          {/* Mode Selector Tabs */}
          <div className="bg-[#FFFFFF] border border-[#E4E2F0] rounded-card p-6 shadow-subtle space-y-6">
            <div>
              <label className="block text-sm font-semibold text-[#0F112E] mb-3">
                Choose Split Mode
              </label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* Mode A */}
                <button
                  type="button"
                  onClick={() => setMode('extract-pages')}
                  className={`p-4 rounded-xl border text-left transition-all ${
                    mode === 'extract-pages'
                      ? 'border-[#7C3AED] bg-[#E6F4F1]/30 ring-2 ring-[#7C3AED]/20'
                      : 'border-[#E4E2F0] hover:border-[#CBD5E1] bg-white'
                  }`}
                >
                  <div className="flex items-center gap-2.5 mb-1.5">
                    <CheckSquare
                      className={`w-5 h-5 ${
                        mode === 'extract-pages' ? 'text-[#7C3AED]' : 'text-gray-400'
                      }`}
                    />
                    <span className="font-semibold text-sm text-[#0F112E]">
                      Extract Selected Pages
                    </span>
                  </div>
                  <p className="text-xs text-[#5E6488] leading-relaxed">
                    Pick individual pages visually to save each selected page as a separate PDF.
                  </p>
                </button>

                {/* Mode B */}
                <button
                  type="button"
                  onClick={() => setMode('split-all')}
                  className={`p-4 rounded-xl border text-left transition-all ${
                    mode === 'split-all'
                      ? 'border-[#7C3AED] bg-[#E6F4F1]/30 ring-2 ring-[#7C3AED]/20'
                      : 'border-[#E4E2F0] hover:border-[#CBD5E1] bg-white'
                  }`}
                >
                  <div className="flex items-center gap-2.5 mb-1.5">
                    <Scissors
                      className={`w-5 h-5 ${
                        mode === 'split-all' ? 'text-[#7C3AED]' : 'text-gray-400'
                      }`}
                    />
                    <span className="font-semibold text-sm text-[#0F112E]">
                      Split Every Page
                    </span>
                  </div>
                  <p className="text-xs text-[#5E6488] leading-relaxed">
                    Split the entire document into {pdfDocInfo.pageCount} separate 1-page PDF files.
                  </p>
                </button>

                {/* Mode C */}
                <button
                  type="button"
                  onClick={() => setMode('split-ranges')}
                  className={`p-4 rounded-xl border text-left transition-all ${
                    mode === 'split-ranges'
                      ? 'border-[#7C3AED] bg-[#E6F4F1]/30 ring-2 ring-[#7C3AED]/20'
                      : 'border-[#E4E2F0] hover:border-[#CBD5E1] bg-white'
                  }`}
                >
                  <div className="flex items-center gap-2.5 mb-1.5">
                    <Layers
                      className={`w-5 h-5 ${
                        mode === 'split-ranges' ? 'text-[#7C3AED]' : 'text-gray-400'
                      }`}
                    />
                    <span className="font-semibold text-sm text-[#0F112E]">
                      Split by Ranges
                    </span>
                  </div>
                  <p className="text-xs text-[#5E6488] leading-relaxed">
                    Specify custom page intervals (e.g. 1-3, 4-8) into custom partitioned PDFs.
                  </p>
                </button>
              </div>
            </div>

            {/* Mode A UI: Visual Thumbnail Grid & Selection */}
            {mode === 'extract-pages' && (
              <div className="space-y-4 pt-2 border-t border-[#E4E2F0]">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h4 className="text-sm font-semibold text-[#0F112E]">
                      Select Pages to Extract
                    </h4>
                    <p className="text-xs text-[#5E6488]">
                      {selectedPagesList.length} of {pdfDocInfo.pageCount}{' '}
                      {pdfDocInfo.pageCount === 1 ? 'page' : 'pages'} selected
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={selectAllPages}
                      className="px-3 py-1.5 text-xs font-medium text-[#7C3AED] hover:bg-[#E6F4F1] border border-[#CBD5E1] rounded-lg transition-colors"
                    >
                      Select All
                    </button>
                    <button
                      type="button"
                      onClick={clearAllPages}
                      className="px-3 py-1.5 text-xs font-medium text-[#5E6488] hover:bg-gray-100 border border-[#CBD5E1] rounded-lg transition-colors"
                    >
                      Clear All
                    </button>
                  </div>
                </div>

                {/* Page Thumbnails Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 max-h-[380px] overflow-y-auto p-1">
                  {pages.map((page) => (
                    <div
                      key={page.pageNumber}
                      onClick={() => togglePageSelection(page.pageNumber)}
                      className={`relative border rounded-xl p-2.5 text-center cursor-pointer transition-all select-none flex flex-col items-center justify-between min-h-[140px] ${
                        page.selected
                          ? 'border-[#7C3AED] bg-[#E6F4F1]/30 ring-2 ring-[#7C3AED]/30 shadow-2xs'
                          : 'border-[#E4E2F0] bg-[#F4F3FA] opacity-60 hover:opacity-100 hover:border-gray-400'
                      }`}
                      role="checkbox"
                      aria-checked={page.selected}
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          togglePageSelection(page.pageNumber);
                        }
                      }}
                    >
                      {/* Checkbox badge */}
                      <div className="absolute top-2 right-2 z-10">
                        {page.selected ? (
                          <CheckSquare className="w-5 h-5 text-[#7C3AED]" />
                        ) : (
                          <Square className="w-5 h-5 text-gray-400" />
                        )}
                      </div>

                      {/* Thumbnail Preview or placeholder */}
                      <div className="w-full flex-1 flex items-center justify-center my-1">
                        {page.thumbnailUrl ? (
                          <img
                            src={page.thumbnailUrl}
                            alt={`Page ${page.pageNumber}`}
                            className="max-h-[85px] max-w-full object-contain rounded border border-gray-200 bg-white shadow-2xs"
                          />
                        ) : (
                          <div className="w-14 h-18 bg-white border border-gray-200 rounded flex flex-col items-center justify-center text-gray-300 shadow-2xs">
                            <FileText className="w-6 h-6" />
                          </div>
                        )}
                      </div>

                      <span className="text-xs font-semibold text-[#0F112E]">
                        Page {page.pageNumber}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Mode B UI: Split Every Page Summary */}
            {mode === 'split-all' && (
              <div className="p-4 bg-[#F4F3FA] border border-[#E4E2F0] rounded-xl space-y-3">
                <div className="flex items-start gap-3">
                  <Sparkles className="w-5 h-5 text-[#7C3AED] flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-semibold text-[#0F112E]">
                      Split into {pdfDocInfo.pageCount} separate PDF documents
                    </h4>
                    <p className="text-xs text-[#5E6488] mt-1 leading-relaxed">
                      Each page from 1 to {pdfDocInfo.pageCount} will become its own individual PDF document
                      (e.g., <code className="font-mono text-[11px] bg-white px-1.5 py-0.5 rounded border border-gray-200">page-1.pdf</code>, <code className="font-mono text-[11px] bg-white px-1.5 py-0.5 rounded border border-gray-200">page-2.pdf</code>).
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Mode C UI: Custom Page Ranges */}
            {mode === 'split-ranges' && (
              <div className="space-y-4 pt-2 border-t border-[#E4E2F0]">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label
                      htmlFor="range-input"
                      className="block text-sm font-semibold text-[#0F112E]"
                    >
                      Enter Page Ranges
                    </label>
                    <span className="text-xs text-[#5E6488]">
                      Total document pages: {pdfDocInfo.pageCount}
                    </span>
                  </div>
                  <input
                    id="range-input"
                    type="text"
                    value={rangeInput}
                    onChange={(e) => setRangeInput(e.target.value)}
                    placeholder="e.g. 1-3, 4-8, 9-12"
                    className={`w-full px-3.5 py-2.5 text-sm rounded-xl border font-mono bg-white text-[#0F112E] placeholder:text-gray-400 focus:outline-hidden focus:ring-2 ${
                      rangeError
                        ? 'border-rose-300 focus:ring-rose-200'
                        : 'border-[#CBD5E1] focus:ring-[#7C3AED]/20 focus:border-[#7C3AED]'
                    }`}
                  />
                  {rangeError ? (
                    <p className="text-xs font-medium text-rose-600 mt-1.5 flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" />
                      {rangeError}
                    </p>
                  ) : (
                    <p className="text-xs text-[#5E6488] mt-1.5">
                      Separate ranges with commas (e.g. <span className="font-mono font-semibold text-gray-700">1-3, 4-8</span> or single pages like <span className="font-mono font-semibold text-gray-700">1, 3, 5-7</span>).
                    </p>
                  )}
                </div>

                {/* Parsed Range Preview Chips */}
                {parsedRanges.length > 0 && !rangeError && (
                  <div className="p-3.5 bg-[#F0F7F7] border border-[#B2DFDB] rounded-xl space-y-2">
                    <span className="text-xs font-semibold text-[#7C3AED] uppercase tracking-wider block">
                      Output Documents to be Generated ({parsedRanges.length}):
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {parsedRanges.map((r, idx) => (
                        <div
                          key={idx}
                          className="px-2.5 py-1 bg-white border border-[#80CBC4] rounded-lg text-xs font-medium text-[#7C3AED] shadow-2xs flex items-center gap-1.5"
                        >
                          <span className="font-bold">Part {idx + 1}:</span>
                          <span>{r.label}</span>
                          <span className="text-gray-400">({r.pages.length} {r.pages.length === 1 ? 'page' : 'pages'})</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Split Action CTA */}
            <div className="pt-4 border-t border-[#E4E2F0] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="text-xs text-[#5E6488]">
                {mode === 'extract-pages' && (
                  <span>
                    Will create{' '}
                    <strong className="text-[#0F112E] font-semibold">
                      {selectedPagesList.length}
                    </strong>{' '}
                    separate PDF {selectedPagesList.length === 1 ? 'document' : 'documents'}.
                  </span>
                )}
                {mode === 'split-all' && (
                  <span>
                    Will create{' '}
                    <strong className="text-[#0F112E] font-semibold">
                      {pdfDocInfo.pageCount}
                    </strong>{' '}
                    separate 1-page PDF documents.
                  </span>
                )}
                {mode === 'split-ranges' && (
                  <span>
                    Will create{' '}
                    <strong className="text-[#0F112E] font-semibold">
                      {parsedRanges.length}
                    </strong>{' '}
                    custom PDF {parsedRanges.length === 1 ? 'document' : 'documents'}.
                  </span>
                )}
              </div>

              <button
                type="button"
                onClick={handleSplitPdf}
                disabled={
                  isSplitting ||
                  (mode === 'extract-pages' && selectedPagesList.length === 0) ||
                  (mode === 'split-ranges' && (parsedRanges.length === 0 || !!rangeError))
                }
                className="px-6 py-3 bg-[#7C3AED] hover:bg-[#0D353F] disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold text-sm rounded-xl transition-all shadow-subtle flex items-center justify-center gap-2 cursor-pointer"
              >
                <Scissors className="w-4 h-4" />
                <span>{isSplitting ? 'Splitting PDF...' : 'Split PDF'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Splitting Progress Bar */}
      {isSplitting && (
        <div className="bg-[#FFFFFF] border border-[#E4E2F0] rounded-card p-6 shadow-subtle space-y-3">
          <div className="flex items-center justify-between text-sm font-semibold text-[#0F112E]">
            <span>Splitting PDF Document...</span>
            <span className="text-[#7C3AED] font-bold">{progress}%</span>
          </div>
          <ProgressBar progress={progress} />
          <p className="text-xs text-[#5E6488] flex items-center gap-1.5">
            <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#7C3AED]" />
            {progressMessage || 'Processing pages...'}
          </p>
        </div>
      )}

      {/* Completed Results View */}
      {result && (
        <div className="bg-[#FFFFFF] border border-[#E4E2F0] rounded-card p-6 md:p-8 shadow-subtle space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#E4E2F0]">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-teal-100 text-teal-700 flex items-center justify-center flex-shrink-0">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-[#0F112E]">
                  PDF Split Complete!
                </h3>
                <p className="text-xs text-[#5E6488] mt-0.5">
                  Generated {result.items.length}{' '}
                  {result.items.length === 1 ? 'file' : 'files'} from{' '}
                  <span className="font-semibold text-gray-700">{result.originalFileName}</span>
                </p>
              </div>
            </div>

            {/* Primary Action Button */}
            <div className="flex items-center gap-3">
              {result.items.length > 1 && result.zipBlob ? (
                <button
                  type="button"
                  onClick={downloadAllZip}
                  className="px-5 py-2.5 bg-[#7C3AED] hover:bg-[#0D353F] text-white font-semibold text-sm rounded-xl transition-all shadow-subtle flex items-center gap-2 cursor-pointer"
                >
                  <Archive className="w-4 h-4" />
                  <span>Download All as ZIP ({formatBytes(result.zipBlob.size)})</span>
                </button>
              ) : result.items.length === 1 ? (
                <button
                  type="button"
                  onClick={() =>
                    downloadSinglePdf(result.items[0].fileName, result.items[0].blob)
                  }
                  className="px-5 py-2.5 bg-[#7C3AED] hover:bg-[#0D353F] text-white font-semibold text-sm rounded-xl transition-all shadow-subtle flex items-center gap-2 cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Download PDF ({formatBytes(result.items[0].size)})</span>
                </button>
              ) : null}

              <button
                type="button"
                onClick={resetAll}
                className="px-4 py-2.5 border border-[#CBD5E1] hover:bg-gray-50 text-[#0F112E] font-medium text-sm rounded-xl transition-colors flex items-center gap-1.5"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Split Another</span>
              </button>
            </div>
          </div>

          {/* List of Generated Output PDFs */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-[#0F112E]">
              Generated PDF Files ({result.items.length})
            </h4>
            <div className="divide-y divide-[#E4E2F0] border border-[#E4E2F0] rounded-xl overflow-hidden">
              {result.items.map((item, idx) => (
                <div
                  key={idx}
                  className="p-3.5 sm:p-4 bg-white hover:bg-[#F4F3FA] transition-colors flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-[#E6F4F1] text-[#7C3AED] flex items-center justify-center flex-shrink-0">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[#0F112E] truncate" title={item.fileName}>
                        {item.fileName}
                      </p>
                      <p className="text-xs text-[#5E6488] flex items-center gap-2">
                        <span>{formatBytes(item.size)}</span>
                        <span>•</span>
                        <span>
                          {item.pageCount} {item.pageCount === 1 ? 'page' : 'pages'}
                          {item.pageNumbers.length > 0 &&
                            ` (Page ${item.pageNumbers.join(', ')})`}
                        </span>
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => downloadSinglePdf(item.fileName, item.blob)}
                    className="px-3 py-1.5 text-xs font-semibold text-[#7C3AED] hover:bg-[#E6F4F1] border border-[#CBD5E1] rounded-lg transition-colors flex items-center gap-1.5 flex-shrink-0 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
