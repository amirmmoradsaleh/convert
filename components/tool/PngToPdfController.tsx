'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  UploadCloud,
  AlertCircle,
  Trash2,
  Download,
  Plus,
  RefreshCw,
  CheckCircle2,
  FileText,
  ArrowUp,
  ArrowDown,
  Layout,
  Maximize2,
} from 'lucide-react';
import { formatBytes, triggerBlobDownload } from '@/engines/shared/file-utils';
import {
  convertImagesToPdf,
  ImageToPdfOptions,
  ImageToPdfResult,
  getImageDimensions,
  PdfOrientation,
} from '@/engines/pdf/image-to-pdf';
import { PNG_TO_PDF_LIMITS, validatePngToPdfFile } from '@/engines/pdf/validation';
import ProgressBar from './ProgressBar';

export interface PngToPdfItem {
  id: string;
  file: File;
  previewUrl: string;
  width: number;
  height: number;
  error?: string;
}

export function PngToPdfController() {
  const [isHydrated, setIsHydrated] = useState(false);
  const [items, setItems] = useState<PngToPdfItem[]>([]);

  // PDF Settings
  const [orientation, setOrientation] = useState<PdfOrientation>('auto');
  const [margin, setMargin] = useState<number>(20); // 0, 20, 40

  // Processing & Progress
  const [isConverting, setIsConverting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState('');
  const [globalMessage, setGlobalMessage] = useState<{ type: 'error' | 'info'; text: string } | null>(null);

  // Result state
  const [result, setResult] = useState<ImageToPdfResult | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const addMoreInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      items.forEach((item) => {
        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
      });
    };
  }, [items]);

  const handleFilesAdded = useCallback(
    async (incomingFiles: File[]) => {
      setGlobalMessage(null);
      if (incomingFiles.length === 0) return;

      const currentCount = items.length;
      if (currentCount + incomingFiles.length > PNG_TO_PDF_LIMITS.MAX_BATCH_FILES) {
        setGlobalMessage({
          type: 'error',
          text: `You can convert up to ${PNG_TO_PDF_LIMITS.MAX_BATCH_FILES} images at a time.`,
        });
      }

      const allowedIncoming = incomingFiles.slice(
        0,
        Math.max(0, PNG_TO_PDF_LIMITS.MAX_BATCH_FILES - currentCount)
      );

      const newItems: PngToPdfItem[] = [];

      for (const file of allowedIncoming) {
        // Validate each file strictly as PNG
        const validation = await validatePngToPdfFile(file);
        if (!validation.valid) {
          setGlobalMessage({
            type: 'error',
            text:
              validation.error?.message ||
              "We couldn't read this PNG file. Please try another image.",
          });
          continue;
        }

        const id = `${file.name}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
        const previewUrl = URL.createObjectURL(file);
        let dims = { width: 800, height: 600 };
        try {
          dims = await getImageDimensions(file);
        } catch {
          // Fallback default
        }

        newItems.push({
          id,
          file,
          previewUrl,
          width: dims.width,
          height: dims.height,
        });
      }

      if (newItems.length > 0) {
        setItems((prev) => [...prev, ...newItems]);
      }
    },
    [items.length]
  );

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFilesAdded(Array.from(e.dataTransfer.files));
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFilesAdded(Array.from(e.target.files));
      e.target.value = '';
    }
  };

  const removeFile = (id: string) => {
    setItems((prev) => {
      const target = prev.find((f) => f.id === id);
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((f) => f.id !== id);
    });
  };

  const moveUp = (index: number) => {
    if (index <= 0) return;
    setItems((prev) => {
      const updated = [...prev];
      const temp = updated[index - 1];
      updated[index - 1] = updated[index];
      updated[index] = temp;
      return updated;
    });
  };

  const moveDown = (index: number) => {
    if (index >= items.length - 1) return;
    setItems((prev) => {
      const updated = [...prev];
      const temp = updated[index + 1];
      updated[index + 1] = updated[index];
      updated[index] = temp;
      return updated;
    });
  };

  const resetAll = () => {
    items.forEach((item) => {
      if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
    });
    setItems([]);
    setResult(null);
    setProgress(0);
    setProgressMessage('');
    setGlobalMessage(null);
  };

  const handleConvert = async () => {
    if (items.length === 0 || isConverting) return;
    setIsConverting(true);
    setGlobalMessage(null);
    setProgress(10);
    setProgressMessage('Preparing files...');

    try {
      const filesToProcess = items.map((i) => i.file);
      const options: ImageToPdfOptions = {
        pageSize: 'A4',
        orientation,
        margin,
        outputFileName: filesToProcess.length === 1 ? undefined : 'png-to-pdf.pdf',
      };

      const conversionResult = await convertImagesToPdf(filesToProcess, options, (p) => {
        setProgress(p.progress);
        setProgressMessage(p.message);
      });

      setResult(conversionResult);
    } catch (err: unknown) {
      const errorMsg =
        err instanceof Error
          ? err.message
          : "We couldn't create the PDF from these images. Please try again with another file.";
      setGlobalMessage({ type: 'error', text: errorMsg });
    } finally {
      setIsConverting(false);
    }
  };

  const handleDownloadPdf = () => {
    if (!result) return;
    triggerBlobDownload(result.blob, result.fileName);
  };

  if (!isHydrated) {
    return (
      <div className="w-full max-w-4xl mx-auto p-8 text-center text-[#5E6488]">
        <div className="animate-spin inline-block w-6 h-6 border-2 border-[#7C3AED] border-t-transparent rounded-full mb-3" />
        <p>Loading PNG to PDF Converter...</p>
      </div>
    );
  }

  // Result UI State
  if (result) {
    return (
      <div data-hydrated={isHydrated ? 'true' : 'false'} className="w-full max-w-3xl mx-auto">
        <div className="bg-white border border-[#E4E2F0] rounded-2xl p-8 text-center shadow-sm">
          <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8" />
          </div>

          <h2 className="text-2xl font-bold text-[#0F112E] mb-2">PDF Created Successfully!</h2>
          <p className="text-sm text-[#5E6488] mb-6">
            Your {result.pageCount} {result.pageCount === 1 ? 'PNG image has' : 'PNG images have'} been
            combined into a clean, paginated PDF document.
          </p>

          <div className="bg-[#F4F3FA] border border-[#E4E2F0] rounded-xl p-5 mb-8 max-w-md mx-auto text-left flex items-center space-x-4">
            <div className="w-12 h-12 rounded-lg bg-[#7C3AED]/10 text-[#7C3AED] flex items-center justify-center shrink-0">
              <FileText className="w-6 h-6" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-[#0F112E] truncate" title={result.fileName}>
                {result.fileName}
              </p>
              <div className="flex items-center space-x-3 text-xs text-[#5E6488] mt-0.5">
                <span>{formatBytes(result.convertedSize)}</span>
                <span>•</span>
                <span>
                  {result.pageCount} {result.pageCount === 1 ? 'page' : 'pages'}
                </span>
                <span>•</span>
                <span className="uppercase font-medium text-[#7C3AED]">PDF</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 max-w-md mx-auto">
            <button
              onClick={handleDownloadPdf}
              className="w-full sm:w-auto flex-1 flex items-center justify-center space-x-2 bg-[#7C3AED] hover:bg-[#6D28D9] text-white px-6 py-3.5 rounded-xl font-medium shadow-sm transition-colors cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Download PDF</span>
            </button>
            <button
              onClick={resetAll}
              className="w-full sm:w-auto flex items-center justify-center space-x-2 bg-[#F4F3FA] hover:bg-slate-200 border border-[#E4E2F0] text-[#0F112E] px-6 py-3.5 rounded-xl font-medium transition-colors cursor-pointer"
            >
              <RefreshCw className="w-4 h-4 text-[#5E6488]" />
              <span>Convert More</span>
            </button>
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
      {items.length === 0 ? (
        <div
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-[#CBD5E1] hover:border-[#7C3AED] bg-white hover:bg-[#F4F3FA] transition-colors rounded-2xl p-10 sm:p-14 text-center cursor-pointer group"
        >
          <input
            id="png-to-pdf-file-input"
            ref={fileInputRef}
            type="file"
            multiple
            accept=".png,image/png"
            className="hidden"
            onChange={handleFileInputChange}
          />
          <div className="w-16 h-16 bg-[#7C3AED]/5 group-hover:bg-[#7C3AED]/10 text-[#7C3AED] rounded-2xl flex items-center justify-center mx-auto mb-4 transition-colors">
            <UploadCloud className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-[#0F112E] mb-2">Select or Drop PNG Images to Convert</h2>
          <p className="text-sm text-[#5E6488] max-w-md mx-auto mb-4">
            Upload up to 20 PNG photos, graphics, or transparent screenshots to generate a clean, unified PDF.
            Browser-based & 100% private.
          </p>
          <div className="inline-flex items-center px-4 py-2 bg-[#7C3AED] text-white text-sm font-medium rounded-xl group-hover:bg-[#6D28D9] transition-colors shadow-sm">
            Browse Files
          </div>
          <p className="text-xs text-[#5E6488] mt-4">
            PNG only • Max 50 MB per file • Up to 20 files per batch
          </p>
        </div>
      ) : (
        /* Multi/Single File Manager + Settings Layout */
        <div className="space-y-6">
          {/* Header Bar */}
          <div className="bg-white border border-[#E4E2F0] rounded-2xl p-4 sm:p-6 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-[#0F112E]">
                {items.length} {items.length === 1 ? 'PNG Image Selected' : 'PNG Images Selected'}
              </h2>
              <p className="text-xs text-[#5E6488] mt-0.5">
                The order below will become the page order in your PDF. Use arrows to reorder.
              </p>
            </div>

            <div className="flex items-center space-x-3 w-full sm:w-auto">
              {items.length < PNG_TO_PDF_LIMITS.MAX_BATCH_FILES && (
                <button
                  onClick={() => addMoreInputRef.current?.click()}
                  disabled={isConverting}
                  className="flex-1 sm:flex-none inline-flex items-center justify-center space-x-1.5 px-3.5 py-2 bg-[#F4F3FA] hover:bg-slate-100 border border-[#E4E2F0] rounded-xl text-xs font-semibold text-[#0F112E] transition-colors cursor-pointer disabled:opacity-50"
                >
                  <Plus className="w-4 h-4 text-[#7C3AED]" />
                  <span>Add PNGs</span>
                </button>
              )}
              <input
                id="png-to-pdf-add-more-input"
                ref={addMoreInputRef}
                type="file"
                multiple
                accept=".png,image/png"
                className="hidden"
                onChange={handleFileInputChange}
              />
              <button
                onClick={resetAll}
                disabled={isConverting}
                className="inline-flex items-center space-x-1 px-3 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear</span>
              </button>
            </div>
          </div>

          {/* Settings Panel */}
          <div className="bg-white border border-[#E4E2F0] rounded-2xl p-5 sm:p-6 shadow-sm space-y-5">
            <div className="flex items-center space-x-2 pb-3 border-b border-[#E4E2F0]">
              <Layout className="w-4 h-4 text-[#7C3AED]" />
              <h3 className="text-sm font-bold text-[#0F112E] uppercase tracking-wider">
                PDF Layout Settings
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              {/* Page Size */}
              <div>
                <label className="block text-xs font-bold text-[#0F112E] mb-1.5">
                  Page Size
                </label>
                <div className="px-3.5 py-2.5 bg-[#F4F3FA] border border-[#E4E2F0] rounded-xl text-xs font-semibold text-[#0F112E] flex items-center justify-between">
                  <span>Standard A4</span>
                  <span className="text-[11px] text-[#5E6488] font-normal">595 × 842 pt</span>
                </div>
              </div>

              {/* Orientation */}
              <div>
                <label className="block text-xs font-bold text-[#0F112E] mb-1.5">
                  Orientation
                </label>
                <div className="grid grid-cols-3 gap-1 p-1 bg-[#F4F3FA] border border-[#E4E2F0] rounded-xl">
                  <button
                    type="button"
                    onClick={() => setOrientation('auto')}
                    disabled={isConverting}
                    className={`py-1.5 text-xs font-medium rounded-lg transition-colors ${
                      orientation === 'auto'
                        ? 'bg-[#7C3AED] text-white shadow-sm'
                        : 'text-[#5E6488] hover:text-[#0F112E]'
                    }`}
                  >
                    Auto
                  </button>
                  <button
                    type="button"
                    onClick={() => setOrientation('portrait')}
                    disabled={isConverting}
                    className={`py-1.5 text-xs font-medium rounded-lg transition-colors ${
                      orientation === 'portrait'
                        ? 'bg-[#7C3AED] text-white shadow-sm'
                        : 'text-[#5E6488] hover:text-[#0F112E]'
                    }`}
                  >
                    Portrait
                  </button>
                  <button
                    type="button"
                    onClick={() => setOrientation('landscape')}
                    disabled={isConverting}
                    className={`py-1.5 text-xs font-medium rounded-lg transition-colors ${
                      orientation === 'landscape'
                        ? 'bg-[#7C3AED] text-white shadow-sm'
                        : 'text-[#5E6488] hover:text-[#0F112E]'
                    }`}
                  >
                    Landscape
                  </button>
                </div>
              </div>

              {/* Margins */}
              <div>
                <label className="block text-xs font-bold text-[#0F112E] mb-1.5">
                  Page Margin
                </label>
                <div className="grid grid-cols-3 gap-1 p-1 bg-[#F4F3FA] border border-[#E4E2F0] rounded-xl">
                  <button
                    type="button"
                    onClick={() => setMargin(0)}
                    disabled={isConverting}
                    className={`py-1.5 text-xs font-medium rounded-lg transition-colors ${
                      margin === 0
                        ? 'bg-[#7C3AED] text-white shadow-sm'
                        : 'text-[#5E6488] hover:text-[#0F112E]'
                    }`}
                  >
                    None
                  </button>
                  <button
                    type="button"
                    onClick={() => setMargin(20)}
                    disabled={isConverting}
                    className={`py-1.5 text-xs font-medium rounded-lg transition-colors ${
                      margin === 20
                        ? 'bg-[#7C3AED] text-white shadow-sm'
                        : 'text-[#5E6488] hover:text-[#0F112E]'
                    }`}
                  >
                    20 pt
                  </button>
                  <button
                    type="button"
                    onClick={() => setMargin(40)}
                    disabled={isConverting}
                    className={`py-1.5 text-xs font-medium rounded-lg transition-colors ${
                      margin === 40
                        ? 'bg-[#7C3AED] text-white shadow-sm'
                        : 'text-[#5E6488] hover:text-[#0F112E]'
                    }`}
                  >
                    40 pt
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Reorderable Image Page List */}
          <div className="space-y-3">
            {items.map((item, index) => (
              <div
                key={item.id}
                className="bg-white border border-[#E4E2F0] rounded-xl p-3 sm:p-4 flex items-center space-x-3 sm:space-x-4 shadow-sm hover:border-[#CBD5E1] transition-colors"
              >
                {/* Page Number Badge */}
                <div className="w-8 h-8 rounded-lg bg-[#7C3AED]/10 text-[#7C3AED] flex items-center justify-center font-bold text-xs shrink-0">
                  {index + 1}
                </div>

                {/* Thumbnail Preview with checkerboard for transparency */}
                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-lg bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:8px_8px] bg-white border border-[#E4E2F0] overflow-hidden shrink-0 flex items-center justify-center relative">
                  <img
                    src={item.previewUrl}
                    alt={item.file.name}
                    className="w-full h-full object-contain"
                  />
                </div>

                {/* File Information */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2">
                    <p className="text-sm font-semibold text-[#0F112E] truncate" title={item.file.name}>
                      {item.file.name}
                    </p>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 bg-slate-100 text-[#5E6488] rounded uppercase shrink-0">
                      {item.file.name.split('.').pop()}
                    </span>
                  </div>
                  <div className="flex items-center space-x-3 text-xs text-[#5E6488] mt-1">
                    <span>{formatBytes(item.file.size)}</span>
                    {item.width > 0 && item.height > 0 && (
                      <>
                        <span>•</span>
                        <span className="flex items-center space-x-1">
                          <Maximize2 className="w-3 h-3 inline text-[#5E6488]" />
                          <span>
                            {item.width} × {item.height}
                          </span>
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {/* Reorder & Action Controls */}
                <div className="flex items-center space-x-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => moveUp(index)}
                    disabled={index === 0 || isConverting}
                    aria-label={`Move ${item.file.name} up`}
                    className="p-1.5 text-[#5E6488] hover:text-[#0F112E] hover:bg-[#F4F3FA] rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <ArrowUp className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveDown(index)}
                    disabled={index === items.length - 1 || isConverting}
                    aria-label={`Move ${item.file.name} down`}
                    className="p-1.5 text-[#5E6488] hover:text-[#0F112E] hover:bg-[#F4F3FA] rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <ArrowDown className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeFile(item.id)}
                    disabled={isConverting}
                    aria-label={`Remove ${item.file.name}`}
                    className="p-1.5 text-[#5E6488] hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors disabled:opacity-30 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Progress Bar Display when processing */}
          {isConverting && (
            <div className="bg-white border border-[#E4E2F0] rounded-2xl p-5 shadow-sm space-y-3">
              <ProgressBar progress={progress} label={progressMessage} />
            </div>
          )}

          {/* Main Action Bar */}
          <div className="bg-white border border-[#E4E2F0] rounded-2xl p-4 sm:p-6 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-xs text-[#5E6488] text-center sm:text-left">
              Output:{' '}
              <span className="font-semibold text-[#0F112E]">
                {items.length === 1 ? '1 page PDF' : `${items.length} pages PDF`}
              </span>{' '}
              • A4 Format • Contain scaling
            </div>

            <button
              onClick={handleConvert}
              disabled={isConverting || items.length === 0}
              className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 bg-[#7C3AED] hover:bg-[#6D28D9] text-white px-8 py-3.5 rounded-xl font-medium shadow-sm transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isConverting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Creating PDF...</span>
                </>
              ) : (
                <>
                  <FileText className="w-4 h-4" />
                  <span>
                    Convert to PDF ({items.length} {items.length === 1 ? 'page' : 'pages'})
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

export default PngToPdfController;
