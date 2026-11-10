'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  UploadCloud,
  AlertCircle,
  Trash2,
  Download,
  RefreshCw,
  CheckCircle2,
  FileText,
  ShieldCheck,
  Minimize2,
  ArrowDown,
  ArrowRight,
  Info,
  Sliders,
} from 'lucide-react';
import { formatBytes, triggerBlobDownload } from '@/engines/shared/file-utils';
import {
  compressPdf,
  CompressPdfResult,
  CompressPdfProgress,
  PdfCompressionQuality,
  ALLOWED_PDF_COMPRESSION_QUALITIES,
  DEFAULT_PDF_COMPRESSION_QUALITY,
} from '@/engines/pdf/compress';
import { loadPdfDocument, LoadedPdfDocument } from '@/engines/pdf/loader';
import { validateCompressPdfFile } from '@/engines/pdf/validation';
import ProgressBar from './ProgressBar';

export function CompressPdfController() {
  const [isHydrated, setIsHydrated] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [pdfDocInfo, setPdfDocInfo] = useState<LoadedPdfDocument | null>(null);
  const [quality, setQuality] = useState<PdfCompressionQuality>(
    DEFAULT_PDF_COMPRESSION_QUALITY
  );

  // Processing state
  const [isLoadingPdf, setIsLoadingPdf] = useState(false);
  const [isCompressing, setIsCompressing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState('');
  const [globalMessage, setGlobalMessage] = useState<{
    type: 'error' | 'info';
    text: string;
  } | null>(null);

  // Result state
  const [result, setResult] = useState<CompressPdfResult | null>(null);
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
    setResult(null);
    setDownloadUrl(null);
    setProgress(0);
    setProgressMessage('');
    setGlobalMessage(null);
  }, [downloadUrl]);

  const handleFileSelected = useCallback(
    async (incomingFile: File) => {
      resetAll();
      setGlobalMessage(null);
      setIsLoadingPdf(true);

      try {
        // Validate file format and size limits
        const validation = await validateCompressPdfFile(incomingFile);
        if (!validation.valid) {
          setGlobalMessage({
            type: 'error',
            text:
              validation.error?.message ||
              "We couldn't read this PDF. Please choose a valid PDF file.",
          });
          setIsLoadingPdf(false);
          return;
        }

        // Parse PDF structure and page count using PDF.js loader
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
      } catch (err: unknown) {
        const errAny = err as { message?: string };
        const msg =
          errAny?.message || "We couldn't read this PDF. Please choose a valid PDF file.";
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
      if (e.dataTransfer.files.length > 1) {
        setGlobalMessage({
          type: 'info',
          text: 'Compress PDF works with one PDF at a time. Processing the first document.',
        });
      }
      handleFileSelected(e.dataTransfer.files[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      if (e.target.files.length > 1) {
        setGlobalMessage({
          type: 'info',
          text: 'Compress PDF works with one PDF at a time. Processing the first document.',
        });
      }
      handleFileSelected(e.target.files[0]);
      e.target.value = '';
    }
  };

  const handleCompress = async () => {
    if (!file || !pdfDocInfo || isCompressing) return;

    setGlobalMessage(null);
    setIsCompressing(true);
    setProgress(5);
    setProgressMessage('Reading PDF document...');

    try {
      const res = await compressPdf(
        file,
        { quality },
        (p: CompressPdfProgress) => {
          setProgress(p.progress);
          setProgressMessage(p.message);
        }
      );

      const url = URL.createObjectURL(res.resultBlob);
      setResult(res);
      setDownloadUrl(url);
    } catch (err: unknown) {
      const errAny = err as { message?: string };
      const msg =
        errAny?.message || "We couldn't compress this PDF. Please try again.";
      setGlobalMessage({
        type: 'error',
        text: msg,
      });
    } finally {
      setIsCompressing(false);
    }
  };

  const handleDownload = () => {
    if (!result) return;
    triggerBlobDownload(result.resultBlob, result.resultFileName);
  };

  if (!isHydrated) {
    return (
      <div className="bg-[#FFFFFF] border border-[#E4E2F0] rounded-card p-8 text-center text-[#5E6488] shadow-subtle mb-6 animate-pulse">
        <p className="text-sm">Loading Compress PDF...</p>
      </div>
    );
  }

  return (
    <div
      className="bg-[#FFFFFF] border border-[#E4E2F0] rounded-card p-6 md:p-8 shadow-subtle mb-6 transition-all"
      data-hydrated="true"
    >
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Global info / error message banner */}
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
            aria-label="Upload PDF file to compress"
          >
            <input
              ref={fileInputRef}
              id="compress-pdf-file-input"
              type="file"
              accept=".pdf,application/pdf"
              className="hidden"
              onChange={handleFileInputChange}
            />

            <div className="w-16 h-16 rounded-full bg-[#E6F4F2] flex items-center justify-center mx-auto mb-4 group-hover:scale-105 transition-transform duration-200">
              <UploadCloud className="w-8 h-8 text-[#7C3AED]" />
            </div>

            <h2 className="text-lg md:text-xl font-semibold text-[#0F112E] mb-1">
              {isLoadingPdf ? 'Reading PDF file...' : 'Choose a PDF file to compress'}
            </h2>
            <p className="text-sm text-[#5E6488] mb-4">
              Drag and drop your document here, or browse your files
            </p>

            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#F1F5F9] text-xs font-medium text-[#475467]">
              <span>Maximum file size: 100 MB</span>
              <span>•</span>
              <span>1 PDF at a time</span>
            </div>
          </div>
        )}

        {/* 2. File Selected & Ready to Compress */}
        {file && pdfDocInfo && !result && (
          <div className="space-y-6 animate-fadeIn">
            {/* Source Document Card */}
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

              {!isCompressing && (
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

            {/* Compression Quality Selection Panel */}
            <div className="p-4 md:p-5 bg-[#F4F3FA] border border-[#E2E8F0] rounded-xl space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                <div className="flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-[#7C3AED]" />
                  <span className="text-sm font-semibold text-[#0F112E]">
                    Compression Quality
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-bold text-[#7C3AED] bg-[#E0EFF2] px-2.5 py-0.5 rounded-full">
                    {quality}% Quality
                  </span>
                  <span className="text-[#5E6488]">
                    {quality <= 50
                      ? 'Strongest Compression'
                      : quality === 70
                      ? 'Balanced (Recommended)'
                      : quality === 60
                      ? 'Medium-High'
                      : 'High Fidelity'}
                  </span>
                </div>
              </div>

              {/* Segmented Quality Radio Buttons */}
              <div
                role="radiogroup"
                aria-label="Compression Quality"
                className="grid grid-cols-3 sm:grid-cols-6 gap-2"
              >
                {ALLOWED_PDF_COMPRESSION_QUALITIES.map((q) => {
                  const isSelected = quality === q;
                  return (
                    <button
                      key={q}
                      id={`compress-pdf-quality-${q}`}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      tabIndex={isSelected ? 0 : -1}
                      disabled={isCompressing}
                      onClick={() => setQuality(q)}
                      onKeyDown={(e) => {
                        const idx = ALLOWED_PDF_COMPRESSION_QUALITIES.indexOf(q);
                        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                          e.preventDefault();
                          const next =
                            ALLOWED_PDF_COMPRESSION_QUALITIES[
                              (idx + 1) % ALLOWED_PDF_COMPRESSION_QUALITIES.length
                            ];
                          setQuality(next);
                        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                          e.preventDefault();
                          const prev =
                            ALLOWED_PDF_COMPRESSION_QUALITIES[
                              (idx - 1 + ALLOWED_PDF_COMPRESSION_QUALITIES.length) %
                                ALLOWED_PDF_COMPRESSION_QUALITIES.length
                            ];
                          setQuality(prev);
                        }
                      }}
                      className={`py-2 px-3 rounded-lg text-sm font-semibold transition-all border text-center flex flex-col items-center justify-center ${
                        isSelected
                          ? 'bg-[#7C3AED] text-white border-[#7C3AED] shadow-sm'
                          : 'bg-[#FFFFFF] text-[#475467] border-[#CBD5E1] hover:border-[#7C3AED] hover:bg-[#F4F3FA]'
                      } disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      <span>{q}%</span>
                      {q === 70 && (
                        <span
                          className={`text-[10px] font-normal leading-tight ${
                            isSelected ? 'text-[#E0EFF2]' : 'text-[#5E6488]'
                          }`}
                        >
                          Default
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="flex flex-wrap items-center justify-between text-xs text-[#5E6488] pt-1">
                <span>Lower quality = smaller file</span>
                <span>Higher quality = better visual quality</span>
              </div>
            </div>

            {/* Information Callout */}
            <div className="p-4 rounded-xl bg-[#F0FDF4] border border-[#BBF7D0] flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-[#16A34A] shrink-0 mt-0.5" />
              <div className="text-xs md:text-sm text-[#166534] leading-relaxed">
                <p className="font-semibold mb-0.5">Safe Structural Compression</p>
                <p>
                  Optimizes PDF streams and internal object dictionaries without rasterizing pages.
                  Your text, vector diagrams, and layout fidelity are 100% preserved.
                </p>
              </div>
            </div>

            {/* Processing Progress Bar */}
            {isCompressing && (
              <div className="py-2 space-y-2">
                <ProgressBar progress={progress} />
                <p className="text-xs text-center text-[#64748B] font-medium animate-pulse">
                  {progressMessage || 'Processing document...'}
                </p>
              </div>
            )}

            {/* Action CTA */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-end gap-3">
              <button
                type="button"
                onClick={resetAll}
                disabled={isCompressing}
                className="w-full sm:w-auto px-4 py-2.5 text-sm font-medium text-[#475467] hover:text-[#0F112E] hover:bg-[#F1F5F9] rounded-lg transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCompress}
                disabled={isCompressing}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg text-sm font-semibold text-white bg-[#7C3AED] hover:bg-[#6D28D9] active:scale-[0.98] transition-all shadow-sm disabled:opacity-50 disabled:pointer-events-none"
              >
                <Minimize2 className="w-4 h-4" />
                <span>{isCompressing ? 'Compressing...' : 'Compress PDF'}</span>
              </button>
            </div>
          </div>
        )}

        {/* 3. Result State (Genuine Reduction vs No Reduction) */}
        {result && (
          <div className="space-y-6 animate-fadeIn">
            {result.isReduced ? (
              /* Genuine Reduction Achieved */
              <div className="text-center space-y-4">
                <div className="w-14 h-14 rounded-full bg-[#ECFDF5] border border-[#A7F3D0] flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-8 h-8 text-[#059669]" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-[#0F112E]">
                    PDF compressed successfully
                  </h3>
                  <p className="text-sm text-[#475467] mt-1">
                    {result.recompressedImageCount > 0
                      ? `Optimized ${result.recompressedImageCount} raster ${
                          result.recompressedImageCount === 1 ? 'image' : 'images'
                        } with vector and layout clarity preserved.`
                      : 'Optimized document structure with vector diagrams and typography preserved.'}
                  </p>
                  <div className="pt-1">
                    <span className="inline-flex items-center text-xs font-semibold text-[#7C3AED] bg-[#E0EFF2] px-2.5 py-0.5 rounded-full">
                      Compression Quality: {result.quality}%
                    </span>
                  </div>
                </div>

                {/* Size Comparison Stats Card */}
                <div className="grid grid-cols-3 gap-3 p-4 bg-[#F4F3FA] border border-[#E2E8F0] rounded-xl max-w-lg mx-auto">
                  <div className="text-center p-2">
                    <p className="text-xs text-[#64748B] font-medium uppercase tracking-wider mb-1">
                      Original
                    </p>
                    <p className="text-sm md:text-base font-semibold text-[#475467]">
                      {formatBytes(result.originalSize)}
                    </p>
                  </div>
                  <div className="text-center p-2 border-x border-[#E2E8F0]">
                    <p className="text-xs text-[#64748B] font-medium uppercase tracking-wider mb-1">
                      Compressed
                    </p>
                    <p className="text-sm md:text-base font-bold text-[#059669]">
                      {formatBytes(result.resultSize)}
                    </p>
                  </div>
                  <div className="text-center p-2 bg-[#ECFDF5] rounded-lg">
                    <p className="text-xs text-[#065F46] font-medium uppercase tracking-wider mb-1">
                      Reduced by
                    </p>
                    <div className="inline-flex items-center gap-0.5 text-sm md:text-base font-extrabold text-[#059669]">
                      <ArrowDown className="w-3.5 h-3.5" />
                      <span>{result.reductionPercent}%</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={handleDownload}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg text-sm font-semibold text-white bg-[#059669] hover:bg-[#047857] active:scale-[0.98] transition-all shadow-sm"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download Compressed PDF</span>
                  </button>
                  <button
                    type="button"
                    onClick={resetAll}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 rounded-lg text-sm font-medium text-[#475467] bg-[#F1F5F9] hover:bg-[#E2E8F0] active:scale-[0.98] transition-all"
                  >
                    <RefreshCw className="w-4 h-4" />
                    <span>Compress another PDF</span>
                  </button>
                </div>

                {/* Post-Action Related Tools Discovery */}
                <div className="mt-8 pt-6 border-t border-[#E2E8F0] text-left">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-semibold uppercase tracking-wider text-[#7C3AED]">
                      What would you like to do next?
                    </p>
                    <Link
                      href="/pdf-tools"
                      className="text-xs font-medium text-[#7C3AED] hover:underline inline-flex items-center gap-1"
                    >
                      <span>Explore all PDF tools</span>
                      <ArrowRight className="w-3 h-3" />
                    </Link>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {[
                      { name: 'Merge PDF', slug: 'merge-pdf', desc: 'Combine multiple PDFs' },
                      { name: 'Split PDF', slug: 'split-pdf', desc: 'Extract pages' },
                      { name: 'PDF to JPG', slug: 'pdf-to-jpg', desc: 'Convert to images' },
                      { name: 'PDF to PNG', slug: 'pdf-to-png', desc: 'Lossless graphics' },
                    ].map((tool) => (
                      <Link
                        key={tool.slug}
                        href={`/tools/${tool.slug}`}
                        className="p-3 bg-[#FFFFFF] border border-[#E2E8F0] hover:border-[#7C3AED] hover:bg-[#F4F0FD] rounded-lg transition-colors group"
                      >
                        <p className="text-xs font-semibold text-[#0F112E] group-hover:text-[#7C3AED] truncate">
                          {tool.name}
                        </p>
                        <p className="text-[11px] text-[#5E6488] truncate mt-0.5">
                          {tool.desc}
                        </p>
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              /* No Reduction Possible: PDF Already Optimized */
              <div className="text-center space-y-4">
                <div className="w-14 h-14 rounded-full bg-[#EFF6FF] border border-[#BFDBFE] flex items-center justify-center mx-auto">
                  <Info className="w-8 h-8 text-[#2563EB]" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-[#0F112E]">
                    The PDF could not be reduced further
                  </h3>
                  <p className="text-sm text-[#475467] mt-1 max-w-md mx-auto">
                    The original file is already optimized for this compression method. Your original
                    PDF will be kept unchanged.
                  </p>
                </div>

                {/* Size Comparison Card */}
                <div className="grid grid-cols-2 gap-3 p-4 bg-[#F4F3FA] border border-[#E2E8F0] rounded-xl max-w-md mx-auto">
                  <div className="text-center p-2">
                    <p className="text-xs text-[#64748B] font-medium uppercase tracking-wider mb-1">
                      Original
                    </p>
                    <p className="text-sm md:text-base font-semibold text-[#475467]">
                      {formatBytes(result.originalSize)}
                    </p>
                  </div>
                  <div className="text-center p-2 border-l border-[#E2E8F0]">
                    <p className="text-xs text-[#64748B] font-medium uppercase tracking-wider mb-1">
                      Result
                    </p>
                    <p className="text-sm md:text-base font-semibold text-[#475467]">
                      {formatBytes(result.resultSize)}
                    </p>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={handleDownload}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg text-sm font-semibold text-white bg-[#7C3AED] hover:bg-[#6D28D9] active:scale-[0.98] transition-all shadow-sm"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download Original PDF</span>
                  </button>
                  <button
                    type="button"
                    onClick={resetAll}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 rounded-lg text-sm font-medium text-[#475467] bg-[#F1F5F9] hover:bg-[#E2E8F0] active:scale-[0.98] transition-all"
                  >
                    <RefreshCw className="w-4 h-4" />
                    <span>Compress another PDF</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
