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
  Image as ImageIcon,
  CheckSquare,
  Square,
  Sliders,
  Archive,
  Layers,
} from 'lucide-react';
import { formatBytes, triggerBlobDownload } from '@/engines/shared/file-utils';
import {
  convertPdfToJpg,
  PdfToJpgResult,
  PdfToJpgQuality,
  PdfToJpgScale,
} from '@/engines/pdf/pdf-to-jpg';
import { loadPdfDocument, LoadedPdfDocument } from '@/engines/pdf/loader';
import { renderPdfPageThumbnail } from '@/engines/pdf/renderer';
import {
  PDF_TO_JPG_LIMITS,
  validatePdfToJpgFile,
  validateAndParsePageRange,
} from '@/engines/pdf/validation';
import ProgressBar from './ProgressBar';

interface PagePreviewItem {
  pageNumber: number;
  thumbnailUrl?: string;
  selected: boolean;
}

export function PdfToJpgController() {
  const [isHydrated, setIsHydrated] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [pdfDocInfo, setPdfDocInfo] = useState<LoadedPdfDocument | null>(null);
  const [pages, setPages] = useState<PagePreviewItem[]>([]);
  const [rangeInput, setRangeInput] = useState('');
  const [rangeError, setRangeError] = useState<string | null>(null);

  // Settings
  const [scale, setScale] = useState<PdfToJpgScale>(1.5);
  const [quality, setQuality] = useState<PdfToJpgQuality>('high');

  // Processing state
  const [isLoadingPdf, setIsLoadingPdf] = useState(false);
  const [isConverting, setIsConverting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState('');
  const [globalMessage, setGlobalMessage] = useState<{ type: 'error' | 'info'; text: string } | null>(null);

  // Result state
  const [result, setResult] = useState<PdfToJpgResult | null>(null);
  const [resultUrls, setResultUrls] = useState<Record<number, string>>({});

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  // Cleanup object URLs on unmount or reset
  useEffect(() => {
    return () => {
      Object.values(resultUrls).forEach((url) => {
        if (url) URL.revokeObjectURL(url);
      });
    };
  }, [resultUrls]);

  const resetAll = useCallback(() => {
    Object.values(resultUrls).forEach((url) => {
      if (url) URL.revokeObjectURL(url);
    });
    setFile(null);
    setPdfDocInfo(null);
    setPages([]);
    setRangeInput('');
    setRangeError(null);
    setResult(null);
    setResultUrls({});
    setProgress(0);
    setProgressMessage('');
    setGlobalMessage(null);
  }, [resultUrls]);

  const handleFileSelected = useCallback(
    async (incomingFile: File) => {
      resetAll();
      setGlobalMessage(null);
      setIsLoadingPdf(true);

      // Validate file format & magic bytes
      const validation = await validatePdfToJpgFile(incomingFile);
      if (!validation.valid) {
        setIsLoadingPdf(false);
        setGlobalMessage({
          type: 'error',
          text: validation.error?.message || 'This file is not a valid PDF. Please choose a valid PDF file.',
        });
        return;
      }

      try {
        const loaded = await loadPdfDocument(incomingFile);

        if (loaded.pageCount === 0) {
          throw new Error("We couldn't read any pages from this PDF. Please try another file.");
        }

        if (loaded.pageCount > PDF_TO_JPG_LIMITS.MAX_PAGE_COUNT) {
          setGlobalMessage({
            type: 'info',
            text: `This document contains ${loaded.pageCount} pages. You can select specific pages to convert.`,
          });
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

        // Render thumbnails in background for first 30 pages to prevent memory strain
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
              // Ignore thumbnail rendering error, card placeholder will remain
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
      handleFileSelected(e.dataTransfer.files[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFileSelected(e.target.files[0]);
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
    setRangeError(null);
  };

  const clearAllPages = () => {
    setPages((prev) => prev.map((p) => ({ ...p, selected: false })));
    setRangeError(null);
  };

  const handleApplyRange = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pdfDocInfo) return;

    const parsed = validateAndParsePageRange(rangeInput, pdfDocInfo.pageCount);
    if (!parsed.valid) {
      setRangeError(parsed.error || 'Invalid page selection.');
      return;
    }

    setRangeError(null);
    const selectedSet = new Set(parsed.pages);
    setPages((prev) =>
      prev.map((p) => ({
        ...p,
        selected: selectedSet.has(p.pageNumber),
      }))
    );
  };

  const selectedPagesList = pages.filter((p) => p.selected).map((p) => p.pageNumber);

  const handleConvert = async () => {
    if (!file || !pdfDocInfo || isConverting) return;

    if (selectedPagesList.length === 0) {
      setGlobalMessage({
        type: 'error',
        text: 'Select at least one page to convert.',
      });
      return;
    }

    setIsConverting(true);
    setGlobalMessage(null);
    setProgress(5);
    setProgressMessage('Preparing conversion...');

    try {
      const convResult = await convertPdfToJpg(
        file,
        {
          selectedPages: selectedPagesList,
          scale,
          quality,
        },
        (p) => {
          setProgress(p.progress);
          setProgressMessage(p.message);
        }
      );

      // Create preview object URLs for results
      const urls: Record<number, string> = {};
      convResult.pages.forEach((p) => {
        urls[p.pageNumber] = URL.createObjectURL(p.blob);
      });

      setResultUrls(urls);
      setResult(convResult);
    } catch (err: unknown) {
      const errAny = err as { message?: string };
      setGlobalMessage({
        type: 'error',
        text:
          errAny?.message ||
          "We couldn't convert this PDF to JPG. Please try again with another file.",
      });
    } finally {
      setIsConverting(false);
    }
  };

  const handleDownloadSingleJpg = (pageResult: { fileName: string; blob: Blob }) => {
    triggerBlobDownload(pageResult.blob, pageResult.fileName);
  };

  const handleDownloadAll = () => {
    if (!result) return;
    if (result.pages.length === 1) {
      triggerBlobDownload(result.pages[0].blob, result.pages[0].fileName);
    } else if (result.zipBlob && result.zipFileName) {
      triggerBlobDownload(result.zipBlob, result.zipFileName);
    }
  };

  if (!isHydrated) {
    return (
      <div className="w-full max-w-4xl mx-auto p-8 text-center text-[#5E6488]">
        <div className="animate-spin inline-block w-6 h-6 border-2 border-[#7C3AED] border-t-transparent rounded-full mb-3" />
        <p>Loading PDF to JPG Converter...</p>
      </div>
    );
  }

  // Result UI State
  if (result) {
    return (
      <div data-hydrated={isHydrated ? 'true' : 'false'} className="w-full max-w-4xl mx-auto space-y-6">
        <div className="bg-white border border-[#E4E2F0] rounded-2xl p-6 sm:p-8 text-center shadow-sm">
          <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8" />
          </div>

          <h2 className="text-2xl font-bold text-[#0F112E] mb-2">PDF Converted Successfully</h2>
          <p className="text-sm text-[#5E6488] mb-6 max-w-lg mx-auto">
            {result.convertedCount} {result.convertedCount === 1 ? 'page has' : 'pages have'} been
            extracted as high-quality JPG images (Total: {formatBytes(result.totalConvertedSize)}).
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-8 max-w-md mx-auto">
            {result.pages.length > 1 ? (
              <button
                onClick={handleDownloadAll}
                className="w-full sm:w-auto flex-1 flex items-center justify-center space-x-2 bg-[#7C3AED] hover:bg-[#6D28D9] text-white px-6 py-3.5 rounded-xl font-medium shadow-sm transition-colors cursor-pointer"
              >
                <Archive className="w-4 h-4" />
                <span>Download All (ZIP)</span>
              </button>
            ) : (
              <button
                onClick={handleDownloadAll}
                className="w-full sm:w-auto flex-1 flex items-center justify-center space-x-2 bg-[#7C3AED] hover:bg-[#6D28D9] text-white px-6 py-3.5 rounded-xl font-medium shadow-sm transition-colors cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Download JPG</span>
              </button>
            )}

            <button
              onClick={resetAll}
              className="w-full sm:w-auto flex items-center justify-center space-x-2 bg-[#F4F3FA] hover:bg-slate-200 border border-[#E4E2F0] text-[#0F112E] px-6 py-3.5 rounded-xl font-medium transition-colors cursor-pointer"
            >
              <RefreshCw className="w-4 h-4 text-[#5E6488]" />
              <span>Convert Another PDF</span>
            </button>
          </div>

          {/* Individual Page Results */}
          <div className="text-left border-t border-[#E4E2F0] pt-6">
            <h3 className="text-sm font-bold text-[#0F112E] uppercase tracking-wider mb-4">
              Individual JPG Files ({result.pages.length})
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {result.pages.map((p) => (
                <div
                  key={p.pageNumber}
                  className="bg-[#F4F3FA] border border-[#E4E2F0] rounded-xl p-4 flex items-center space-x-4"
                >
                  <div className="w-14 h-18 bg-white border border-[#E4E2F0] rounded-lg overflow-hidden shrink-0 flex items-center justify-center relative shadow-xs">
                    {resultUrls[p.pageNumber] ? (
                      <img
                        src={resultUrls[p.pageNumber]}
                        alt={`Page ${p.pageNumber}`}
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <ImageIcon className="w-6 h-6 text-[#5E6488]" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[#0F112E] truncate" title={p.fileName}>
                      {p.fileName}
                    </p>
                    <p className="text-xs text-[#5E6488] mt-0.5">
                      Page {p.pageNumber} • {formatBytes(p.size)}
                    </p>
                    <p className="text-[11px] text-[#5E6488] mt-0.5">
                      {p.width} × {p.height} px
                    </p>
                  </div>

                  <button
                    onClick={() => handleDownloadSingleJpg(p)}
                    title={`Download ${p.fileName}`}
                    aria-label={`Download ${p.fileName}`}
                    className="inline-flex items-center space-x-1 p-2.5 bg-white hover:bg-slate-100 border border-[#E4E2F0] rounded-xl text-xs font-medium text-[#7C3AED] transition-colors cursor-pointer shrink-0"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Upload & Configuration State
  return (
    <div data-hydrated={isHydrated ? 'true' : 'false'} className="w-full max-w-4xl mx-auto space-y-6">
      {/* Global Message Banner */}
      {globalMessage && (
        <div
          role="alert"
          className={`p-4 rounded-xl flex items-start space-x-3 text-sm ${
            globalMessage.type === 'error'
              ? 'bg-rose-50 border border-rose-200 text-rose-800'
              : 'bg-blue-50 border border-blue-200 text-blue-800'
          }`}
        >
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <div className="flex-1 font-medium">{globalMessage.text}</div>
          <button
            onClick={() => setGlobalMessage(null)}
            className="text-gray-400 hover:text-gray-600 text-xs uppercase font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* Initial Empty Upload State */}
      {!file ? (
        <div
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-[#CBD5E1] hover:border-[#7C3AED] bg-white hover:bg-[#F4F3FA] transition-colors rounded-2xl p-10 sm:p-14 text-center cursor-pointer group"
        >
          <input
            id="pdf-to-jpg-file-input"
            ref={fileInputRef}
            type="file"
            accept=".pdf,application/pdf"
            className="hidden"
            onChange={handleFileInputChange}
          />
          <div className="w-16 h-16 bg-[#7C3AED]/5 group-hover:bg-[#7C3AED]/10 text-[#7C3AED] rounded-2xl flex items-center justify-center mx-auto mb-4 transition-colors">
            <UploadCloud className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-[#0F112E] mb-2">Select or Drop PDF File to Convert</h2>
          <p className="text-sm text-[#5E6488] max-w-md mx-auto mb-4">
            Extract PDF document pages into high-resolution JPG images. Browser-based, fast, and 100% private.
          </p>
          <div className="inline-flex items-center px-4 py-2 bg-[#7C3AED] text-white text-sm font-medium rounded-xl group-hover:bg-[#6D28D9] transition-colors shadow-sm">
            {isLoadingPdf ? 'Loading PDF...' : 'Browse PDF File'}
          </div>
          <p className="text-xs text-[#5E6488] mt-4">PDF only • Maximum 100 MB</p>
        </div>
      ) : (
        /* Loaded PDF Page Selection & Settings Layout */
        <div className="space-y-6">
          {/* File Overview Header */}
          <div className="bg-white border border-[#E4E2F0] rounded-2xl p-4 sm:p-6 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center space-x-3.5 min-w-0">
              <div className="w-12 h-12 rounded-xl bg-[#7C3AED]/10 text-[#7C3AED] flex items-center justify-center shrink-0">
                <FileText className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <h2 className="text-base font-bold text-[#0F112E] truncate" title={file.name}>
                  {file.name}
                </h2>
                <div className="flex items-center space-x-2 text-xs text-[#5E6488] mt-0.5">
                  <span>{formatBytes(file.size)}</span>
                  <span>•</span>
                  <span>
                    {pdfDocInfo?.pageCount} {pdfDocInfo?.pageCount === 1 ? 'page' : 'pages'}
                  </span>
                  <span>•</span>
                  <span className="font-semibold text-[#7C3AED]">
                    {selectedPagesList.length} of {pdfDocInfo?.pageCount} selected
                  </span>
                </div>
              </div>
            </div>

            <button
              onClick={resetAll}
              disabled={isConverting}
              className="inline-flex items-center space-x-1.5 px-3.5 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Remove</span>
            </button>
          </div>

          {/* Page Selection Controls & Range Filter */}
          <div className="bg-white border border-[#E4E2F0] rounded-2xl p-5 sm:p-6 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#E4E2F0]">
              <div className="flex items-center space-x-2">
                <Layers className="w-4 h-4 text-[#7C3AED]" />
                <h3 className="text-sm font-bold text-[#0F112E] uppercase tracking-wider">
                  Page Selection ({selectedPagesList.length}/{pdfDocInfo?.pageCount})
                </h3>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={selectAllPages}
                  disabled={isConverting}
                  className="inline-flex items-center space-x-1 px-3 py-1.5 bg-[#F4F3FA] hover:bg-slate-100 border border-[#E4E2F0] rounded-lg text-xs font-medium text-[#0F112E] transition-colors cursor-pointer"
                >
                  <CheckSquare className="w-3.5 h-3.5 text-[#7C3AED]" />
                  <span>Select All</span>
                </button>
                <button
                  type="button"
                  onClick={clearAllPages}
                  disabled={isConverting}
                  className="inline-flex items-center space-x-1 px-3 py-1.5 bg-[#F4F3FA] hover:bg-slate-100 border border-[#E4E2F0] rounded-lg text-xs font-medium text-[#0F112E] transition-colors cursor-pointer"
                >
                  <Square className="w-3.5 h-3.5 text-[#5E6488]" />
                  <span>Clear All</span>
                </button>
              </div>
            </div>

            {/* Custom Range Input */}
            <form onSubmit={handleApplyRange} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={rangeInput}
                  onChange={(e) => setRangeInput(e.target.value)}
                  placeholder="e.g. 1-3, 5, 8-10"
                  className="w-full px-3.5 py-2 text-xs bg-[#F4F3FA] border border-[#E4E2F0] rounded-xl focus:outline-hidden focus:border-[#7C3AED] text-[#0F112E]"
                />
              </div>
              <button
                type="submit"
                disabled={isConverting || !rangeInput.trim()}
                className="px-4 py-2 bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-xs font-medium rounded-xl transition-colors cursor-pointer disabled:opacity-50 shrink-0"
              >
                Apply Range
              </button>
            </form>
            {rangeError && <p className="text-xs text-rose-600 font-medium">{rangeError}</p>}

            {/* Page Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3 max-h-96 overflow-y-auto p-1">
              {pages.map((p) => (
                <button
                  key={p.pageNumber}
                  type="button"
                  onClick={() => togglePageSelection(p.pageNumber)}
                  disabled={isConverting}
                  aria-label={`Page ${p.pageNumber} of ${pdfDocInfo?.pageCount}`}
                  aria-pressed={p.selected}
                  className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer relative group flex flex-col items-center ${
                    p.selected
                      ? 'border-[#7C3AED] bg-[#7C3AED]/5 ring-2 ring-[#7C3AED]/20'
                      : 'border-[#E4E2F0] bg-[#F4F3FA] opacity-60 hover:opacity-100 hover:border-slate-300'
                  }`}
                >
                  <div className="w-full aspect-3/4 bg-white border border-[#E4E2F0] rounded-lg overflow-hidden flex items-center justify-center mb-2 relative shadow-2xs">
                    {p.thumbnailUrl ? (
                      <img
                        src={p.thumbnailUrl}
                        alt={`Thumbnail Page ${p.pageNumber}`}
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <span className="text-xs font-bold text-[#5E6488]">P. {p.pageNumber}</span>
                    )}

                    <div
                      className={`absolute top-1 right-1 w-4 h-4 rounded flex items-center justify-center text-[10px] ${
                        p.selected ? 'bg-[#7C3AED] text-white' : 'bg-slate-200 text-transparent'
                      }`}
                    >
                      ✓
                    </div>
                  </div>

                  <span className="text-xs font-medium text-[#0F112E]">Page {p.pageNumber}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Settings Panel: Scale & Quality */}
          <div className="bg-white border border-[#E4E2F0] rounded-2xl p-5 sm:p-6 shadow-sm space-y-4">
            <div className="flex items-center space-x-2 pb-3 border-b border-[#E4E2F0]">
              <Sliders className="w-4 h-4 text-[#7C3AED]" />
              <h3 className="text-sm font-bold text-[#0F112E] uppercase tracking-wider">
                Output Resolution & Quality
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {/* Output Resolution Scale */}
              <div>
                <label className="block text-xs font-bold text-[#0F112E] mb-1.5">
                  Resolution Scale
                </label>
                <div className="grid grid-cols-3 gap-1 p-1 bg-[#F4F3FA] border border-[#E4E2F0] rounded-xl">
                  <button
                    type="button"
                    onClick={() => setScale(1.0)}
                    disabled={isConverting}
                    className={`py-2 text-xs font-medium rounded-lg transition-colors ${
                      scale === 1.0
                        ? 'bg-[#7C3AED] text-white shadow-sm'
                        : 'text-[#5E6488] hover:text-[#0F112E]'
                    }`}
                  >
                    1× (Standard)
                  </button>
                  <button
                    type="button"
                    onClick={() => setScale(1.5)}
                    disabled={isConverting}
                    className={`py-2 text-xs font-medium rounded-lg transition-colors ${
                      scale === 1.5
                        ? 'bg-[#7C3AED] text-white shadow-sm'
                        : 'text-[#5E6488] hover:text-[#0F112E]'
                    }`}
                  >
                    1.5× (Recommended)
                  </button>
                  <button
                    type="button"
                    onClick={() => setScale(2.0)}
                    disabled={isConverting}
                    className={`py-2 text-xs font-medium rounded-lg transition-colors ${
                      scale === 2.0
                        ? 'bg-[#7C3AED] text-white shadow-sm'
                        : 'text-[#5E6488] hover:text-[#0F112E]'
                    }`}
                  >
                    2× (High Res)
                  </button>
                </div>
              </div>

              {/* Quality Settings */}
              <div>
                <label className="block text-xs font-bold text-[#0F112E] mb-1.5">JPG Quality</label>
                <div className="grid grid-cols-3 gap-1 p-1 bg-[#F4F3FA] border border-[#E4E2F0] rounded-xl">
                  <button
                    type="button"
                    onClick={() => setQuality('high')}
                    disabled={isConverting}
                    className={`py-2 text-xs font-medium rounded-lg transition-colors ${
                      quality === 'high'
                        ? 'bg-[#7C3AED] text-white shadow-sm'
                        : 'text-[#5E6488] hover:text-[#0F112E]'
                    }`}
                  >
                    High (90%)
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuality('medium')}
                    disabled={isConverting}
                    className={`py-2 text-xs font-medium rounded-lg transition-colors ${
                      quality === 'medium'
                        ? 'bg-[#7C3AED] text-white shadow-sm'
                        : 'text-[#5E6488] hover:text-[#0F112E]'
                    }`}
                  >
                    Medium (80%)
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuality('low')}
                    disabled={isConverting}
                    className={`py-2 text-xs font-medium rounded-lg transition-colors ${
                      quality === 'low'
                        ? 'bg-[#7C3AED] text-white shadow-sm'
                        : 'text-[#5E6488] hover:text-[#0F112E]'
                    }`}
                  >
                    Low (70%)
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Progress Bar when converting */}
          {isConverting && (
            <div className="bg-white border border-[#E4E2F0] rounded-2xl p-5 shadow-sm space-y-3">
              <ProgressBar progress={progress} label={progressMessage} />
            </div>
          )}

          {/* Action Bar */}
          <div className="bg-white border border-[#E4E2F0] rounded-2xl p-4 sm:p-6 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-xs text-[#5E6488] text-center sm:text-left">
              Output:{' '}
              <span className="font-semibold text-[#0F112E]">
                {selectedPagesList.length} {selectedPagesList.length === 1 ? 'JPG image' : 'JPG images'}
              </span>{' '}
              • {scale}× scale • {quality.toUpperCase()} quality
            </div>

            <button
              onClick={handleConvert}
              disabled={isConverting || selectedPagesList.length === 0}
              className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 bg-[#7C3AED] hover:bg-[#6D28D9] text-white px-8 py-3.5 rounded-xl font-medium shadow-sm transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isConverting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Converting PDF...</span>
                </>
              ) : (
                <>
                  <ImageIcon className="w-4 h-4" />
                  <span>
                    Convert {selectedPagesList.length}{' '}
                    {selectedPagesList.length === 1 ? 'Page to JPG' : 'Pages to JPG'}
                  </span>
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default PdfToJpgController;
