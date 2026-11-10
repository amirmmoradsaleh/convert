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
  Layers,
} from 'lucide-react';
import { formatBytes, triggerBlobDownload } from '@/engines/shared/file-utils';
import { mergePdfs, MergePdfResult } from '@/engines/pdf/merge';
import { loadPdfDocument } from '@/engines/pdf/loader';
import {
  MERGE_PDF_LIMITS,
  validateMergePdfFile,
} from '@/engines/pdf/validation';
import ProgressBar from './ProgressBar';

export interface MergePdfItem {
  id: string;
  file: File;
  pageCount?: number;
  status: 'loading' | 'ready' | 'error';
  error?: string;
}

export function MergePdfController() {
  const [isHydrated, setIsHydrated] = useState(false);
  const [items, setItems] = useState<MergePdfItem[]>([]);

  // Processing state
  const [isMerging, setIsMerging] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState('');
  const [globalMessage, setGlobalMessage] = useState<{ type: 'error' | 'info'; text: string } | null>(null);

  // Result state
  const [result, setResult] = useState<MergePdfResult | null>(null);
  const [outputUrl, setOutputUrl] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const addMoreInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  // Cleanup object URL on unmount or reset
  useEffect(() => {
    return () => {
      if (outputUrl) {
        URL.revokeObjectURL(outputUrl);
      }
    };
  }, [outputUrl]);

  const resetAll = useCallback(() => {
    if (outputUrl) {
      URL.revokeObjectURL(outputUrl);
    }
    setItems([]);
    setResult(null);
    setOutputUrl(null);
    setProgress(0);
    setProgressMessage('');
    setGlobalMessage(null);
  }, [outputUrl]);

  const handleFilesAdded = useCallback(
    async (incomingFiles: File[]) => {
      setGlobalMessage(null);
      if (incomingFiles.length === 0) return;

      const currentCount = items.length;
      if (currentCount + incomingFiles.length > MERGE_PDF_LIMITS.MAX_BATCH_FILES) {
        setGlobalMessage({
          type: 'error',
          text: `You can merge up to ${MERGE_PDF_LIMITS.MAX_BATCH_FILES} PDF files at a time.`,
        });
      }

      const allowedIncoming = incomingFiles.slice(
        0,
        Math.max(0, MERGE_PDF_LIMITS.MAX_BATCH_FILES - currentCount)
      );

      // Check total batch aggregate size
      const currentSize = items.reduce((sum, item) => sum + item.file.size, 0);
      const incomingSize = allowedIncoming.reduce((sum, f) => sum + f.size, 0);
      if (currentSize + incomingSize > MERGE_PDF_LIMITS.MAX_AGGREGATE_SIZE) {
        setGlobalMessage({
          type: 'error',
          text: `Total batch size exceeds the limit of ${Math.round(
            MERGE_PDF_LIMITS.MAX_AGGREGATE_SIZE / (1024 * 1024)
          )} MB. Try merging fewer or smaller files.`,
        });
        return;
      }

      const newItems: MergePdfItem[] = [];

      for (const file of allowedIncoming) {
        const id = `${file.name}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

        // Validate basic file limits and magic bytes
        const validation = await validateMergePdfFile(file);
        if (!validation.valid) {
          setGlobalMessage({
            type: 'error',
            text: validation.error?.message || `The file "${file.name}" is not a valid PDF. Please choose a valid PDF file.`,
          });
          continue;
        }

        newItems.push({
          id,
          file,
          status: 'loading',
        });
      }

      if (newItems.length === 0) return;

      setItems((prev) => [...prev, ...newItems]);

      // Parse page counts asynchronously for newly added files
      for (const item of newItems) {
        try {
          const docInfo = await loadPdfDocument(item.file);
          if (docInfo.pageCount === 0) {
            setItems((prev) =>
              prev.map((it) =>
                it.id === item.id
                  ? { ...it, status: 'error', error: 'No pages found in this PDF' }
                  : it
              )
            );
            setGlobalMessage({
              type: 'error',
              text: `The file "${item.file.name}" does not contain any readable pages.`,
            });
          } else {
            setItems((prev) =>
              prev.map((it) =>
                it.id === item.id
                  ? { ...it, status: 'ready', pageCount: docInfo.pageCount }
                  : it
              )
            );
          }
        } catch (err: unknown) {
          const errMsg =
            err instanceof Error
              ? err.message
              : `We couldn't read "${item.file.name}". Please remove it or choose another PDF.`;
          setItems((prev) =>
            prev.map((it) =>
              it.id === item.id
                ? { ...it, status: 'error', error: errMsg }
                : it
            )
          );
          setGlobalMessage({
            type: 'error',
            text: errMsg,
          });
        }
      }
    },
    [items]
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

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((it) => it.id !== id));
  };

  const moveItem = (index: number, direction: 'up' | 'down') => {
    setItems((prev) => {
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= prev.length) return prev;
      const copy = [...prev];
      const temp = copy[index];
      copy[index] = copy[targetIndex];
      copy[targetIndex] = temp;
      return copy;
    });
  };

  const handleMerge = async () => {
    if (items.length < 2 || isMerging) return;

    const hasErrors = items.some((it) => it.status === 'error');
    if (hasErrors) {
      setGlobalMessage({
        type: 'error',
        text: 'Please remove unreadable or invalid PDF files before merging.',
      });
      return;
    }

    const isStillLoading = items.some((it) => it.status === 'loading');
    if (isStillLoading) {
      setGlobalMessage({
        type: 'info',
        text: 'Please wait for all PDF files to finish loading.',
      });
      return;
    }

    setIsMerging(true);
    setGlobalMessage(null);
    setProgress(5);
    setProgressMessage('Reading and preparing PDF files...');

    try {
      const filesToMerge = items.map((it) => it.file);
      const mergeResult = await mergePdfs(
        filesToMerge,
        {
          outputFileName: 'merged.pdf',
        },
        (prog) => {
          setProgress(prog.progress);
          setProgressMessage(prog.message);
        }
      );

      const url = URL.createObjectURL(mergeResult.blob);
      setOutputUrl(url);
      setResult(mergeResult);
    } catch (err: unknown) {
      const errAny = err as { message?: string };
      setGlobalMessage({
        type: 'error',
        text:
          errAny?.message ||
          "We couldn't merge your PDF files. Please try again with another file.",
      });
    } finally {
      setIsMerging(false);
    }
  };

  const handleDownload = () => {
    if (!result) return;
    triggerBlobDownload(result.blob, result.fileName);
  };

  const totalPagesCount = items.reduce((sum, it) => sum + (it.pageCount || 0), 0);
  const totalSizeBytes = items.reduce((sum, it) => sum + it.file.size, 0);
  const canMerge =
    items.length >= 2 &&
    !isMerging &&
    !items.some((it) => it.status === 'loading' || it.status === 'error');

  if (!isHydrated) {
    return (
      <div className="w-full max-w-4xl mx-auto p-8 text-center text-[#5E6488]">
        <div className="animate-spin inline-block w-6 h-6 border-2 border-[#7C3AED] border-t-transparent rounded-full mb-3" />
        <p>Loading PDF Merger...</p>
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

          <h2 className="text-2xl font-bold text-[#0F112E] mb-2">PDFs Merged Successfully</h2>
          <p className="text-sm text-[#5E6488] mb-6 max-w-lg mx-auto">
            Combined {result.fileCount} PDF files into a single document with{' '}
            <span className="font-semibold text-[#0F112E]">
              {result.pageCount} {result.pageCount === 1 ? 'page' : 'pages'}
            </span>{' '}
            (Total size: {formatBytes(result.mergedSize)}).
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-8 max-w-md mx-auto">
            <button
              onClick={handleDownload}
              className="w-full sm:w-auto flex-1 flex items-center justify-center space-x-2 bg-[#7C3AED] hover:bg-[#6D28D9] text-white px-6 py-3.5 rounded-xl font-medium shadow-sm transition-colors cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Download Merged PDF</span>
            </button>

            <button
              onClick={resetAll}
              className="w-full sm:w-auto flex items-center justify-center space-x-2 bg-[#F4F3FA] hover:bg-slate-200 border border-[#E4E2F0] text-[#0F112E] px-6 py-3.5 rounded-xl font-medium transition-colors cursor-pointer"
            >
              <RefreshCw className="w-4 h-4 text-[#5E6488]" />
              <span>Merge More PDFs</span>
            </button>
          </div>

          {/* Merge Details Summary */}
          <div className="bg-[#F4F3FA] border border-[#E4E2F0] rounded-xl p-4 max-w-md mx-auto text-left text-xs text-[#5E6488] space-y-1.5">
            <div className="flex justify-between">
              <span>Output filename:</span>
              <span className="font-semibold text-[#0F112E]">{result.fileName}</span>
            </div>
            <div className="flex justify-between">
              <span>Total pages:</span>
              <span className="font-semibold text-[#0F112E]">{result.pageCount} pages</span>
            </div>
            <div className="flex justify-between">
              <span>Input files merged:</span>
              <span className="font-semibold text-[#0F112E]">{result.fileCount} files</span>
            </div>
            <div className="flex justify-between">
              <span>Total output size:</span>
              <span className="font-semibold text-[#0F112E]">{formatBytes(result.mergedSize)}</span>
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
            className="text-gray-400 hover:text-gray-600 text-xs uppercase font-bold cursor-pointer"
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
            id="merge-pdf-file-input"
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,application/pdf"
            className="hidden"
            onChange={handleFileInputChange}
          />
          <div className="w-16 h-16 bg-[#7C3AED]/5 group-hover:bg-[#7C3AED]/10 text-[#7C3AED] rounded-2xl flex items-center justify-center mx-auto mb-4 transition-colors">
            <UploadCloud className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-[#0F112E] mb-2">Select or Drop PDF Files to Combine</h2>
          <p className="text-sm text-[#5E6488] max-w-md mx-auto mb-4">
            Combine multiple PDF files into one clean document. Arrange files in your preferred order with 100% client-side privacy.
          </p>
          <div className="inline-flex items-center px-4 py-2 bg-[#7C3AED] text-white text-sm font-medium rounded-xl group-hover:bg-[#6D28D9] transition-colors shadow-sm">
            Browse PDF Files
          </div>
          <p className="text-xs text-[#5E6488] mt-4">
            PDF files only • Up to 20 files • 100 MB per file
          </p>
        </div>
      ) : (
        /* Loaded PDF List and Ordering Layout */
        <div className="space-y-6">
          {/* File Overview & Action Bar Header */}
          <div className="bg-white border border-[#E4E2F0] rounded-2xl p-4 sm:p-6 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center space-x-3.5">
              <div className="w-12 h-12 rounded-xl bg-[#7C3AED]/10 text-[#7C3AED] flex items-center justify-center shrink-0">
                <Layers className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-base font-bold text-[#0F112E]">
                  {items.length} {items.length === 1 ? 'PDF File' : 'PDF Files Selected'}
                </h2>
                <div className="flex items-center space-x-2 text-xs text-[#5E6488] mt-0.5">
                  <span>{formatBytes(totalSizeBytes)}</span>
                  <span>•</span>
                  <span className="font-semibold text-[#7C3AED]">
                    {totalPagesCount} {totalPagesCount === 1 ? 'page total' : 'pages total'}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-2 w-full sm:w-auto justify-end">
              <input
                id="merge-pdf-add-more-input"
                ref={addMoreInputRef}
                type="file"
                multiple
                accept=".pdf,application/pdf"
                className="hidden"
                onChange={handleFileInputChange}
              />
              <button
                type="button"
                onClick={() => addMoreInputRef.current?.click()}
                disabled={isMerging || items.length >= MERGE_PDF_LIMITS.MAX_BATCH_FILES}
                className="inline-flex items-center space-x-1.5 px-3.5 py-2 text-xs font-semibold bg-[#F4F3FA] hover:bg-slate-100 border border-[#E4E2F0] text-[#0F112E] rounded-xl transition-colors cursor-pointer disabled:opacity-50"
              >
                <Plus className="w-3.5 h-3.5 text-[#7C3AED]" />
                <span>Add More PDFs</span>
              </button>

              <button
                type="button"
                onClick={resetAll}
                disabled={isMerging}
                className="inline-flex items-center space-x-1.5 px-3.5 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear All</span>
              </button>
            </div>
          </div>

          {/* Reorderable PDF File List */}
          <div className="bg-white border border-[#E4E2F0] rounded-2xl p-4 sm:p-6 shadow-sm space-y-3">
            <div className="flex items-center justify-between pb-3 border-b border-[#E4E2F0]">
              <h3 className="text-xs font-bold text-[#0F112E] uppercase tracking-wider">
                Document Merge Order ({items.length} files)
              </h3>
              <span className="text-xs text-[#5E6488]">
                Use arrows to adjust the order of documents
              </span>
            </div>

            <div className="space-y-2.5">
              {items.map((item, index) => (
                <div
                  key={item.id}
                  className={`p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${
                    item.status === 'error'
                      ? 'bg-rose-50/50 border-rose-200'
                      : 'bg-[#F4F3FA] border-[#E4E2F0] hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center space-x-3.5 min-w-0 flex-1">
                    <span className="w-7 h-7 rounded-lg bg-white border border-[#E4E2F0] flex items-center justify-center text-xs font-bold text-[#7C3AED] shrink-0 shadow-2xs">
                      {index + 1}
                    </span>

                    <div className="w-9 h-9 rounded-lg bg-white border border-[#E4E2F0] flex items-center justify-center text-[#7C3AED] shrink-0">
                      <FileText className="w-4 h-4" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-[#0F112E] truncate" title={item.file.name}>
                        {item.file.name}
                      </p>
                      <div className="flex items-center space-x-2 text-xs text-[#5E6488] mt-0.5">
                        <span>{formatBytes(item.file.size)}</span>
                        <span>•</span>
                        {item.status === 'loading' ? (
                          <span className="text-amber-600 font-medium">Reading pages...</span>
                        ) : item.status === 'error' ? (
                          <span className="text-rose-600 font-medium">{item.error || 'Unreadable PDF'}</span>
                        ) : (
                          <span className="font-semibold text-[#7C3AED]">
                            {item.pageCount} {item.pageCount === 1 ? 'page' : 'pages'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Ordering & Remove Controls */}
                  <div className="flex items-center space-x-1.5 self-end sm:self-center shrink-0">
                    <button
                      type="button"
                      onClick={() => moveItem(index, 'up')}
                      disabled={isMerging || index === 0}
                      title={`Move ${item.file.name} up`}
                      aria-label={`Move ${item.file.name} up`}
                      className="p-2 bg-white hover:bg-slate-100 border border-[#E4E2F0] rounded-lg text-[#0F112E] transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => moveItem(index, 'down')}
                      disabled={isMerging || index === items.length - 1}
                      title={`Move ${item.file.name} down`}
                      aria-label={`Move ${item.file.name} down`}
                      className="p-2 bg-white hover:bg-slate-100 border border-[#E4E2F0] rounded-lg text-[#0F112E] transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => removeItem(item.id)}
                      disabled={isMerging}
                      title={`Remove ${item.file.name}`}
                      aria-label={`Remove ${item.file.name}`}
                      className="p-2 bg-white hover:bg-rose-50 text-rose-600 border border-[#E4E2F0] rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Insufficient Files Notice */}
          {items.length === 1 && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs font-medium flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>Add at least one more PDF to merge.</span>
            </div>
          )}

          {/* Progress Bar when merging */}
          {isMerging && (
            <div className="bg-white border border-[#E4E2F0] rounded-2xl p-5 shadow-sm space-y-3">
              <ProgressBar progress={progress} label={progressMessage} />
            </div>
          )}

          {/* Action Bar */}
          <div className="bg-white border border-[#E4E2F0] rounded-2xl p-4 sm:p-6 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-xs text-[#5E6488] text-center sm:text-left">
              Output:{' '}
              <span className="font-semibold text-[#0F112E]">merged.pdf</span> •{' '}
              <span className="font-semibold text-[#0F112E]">{totalPagesCount} total pages</span> • Vector
              preserved
            </div>

            <button
              onClick={handleMerge}
              disabled={!canMerge}
              className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 bg-[#7C3AED] hover:bg-[#6D28D9] text-white px-8 py-3.5 rounded-xl font-medium shadow-sm transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isMerging ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Merging PDFs...</span>
                </>
              ) : (
                <>
                  <Layers className="w-4 h-4" />
                  <span>Merge {items.length} PDFs</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default MergePdfController;
