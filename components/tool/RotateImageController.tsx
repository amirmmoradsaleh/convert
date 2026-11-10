'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  UploadCloud,
  AlertCircle,
  Trash2,
  Download,
  Archive,
  Plus,
  RefreshCw,
  RotateCw,
  CheckCircle2,
  Image as ImageIcon,
} from 'lucide-react';
import { formatBytes, triggerBlobDownload, createZipBlob, formatDownloadFilename } from '@/engines/shared/file-utils';
import { rotateImage, RotateImageResult } from '@/engines/image/rotate';
import type { WorkerProgressStage } from '@/engines/image/worker/worker-types';
import ProgressBar from './ProgressBar';

export interface RotateFileItem {
  id: string;
  file: File;
  previewUrl?: string;
  originalWidth: number;
  originalHeight: number;
  status: 'pending' | 'validating' | 'processing' | 'completed' | 'failed';
  stage?: WorkerProgressStage;
  progress: number;
  errorMessage?: string;
  resultBlob?: Blob;
  resultUrl?: string;
  resultFileName?: string;
  originalSize?: number;
  convertedSize?: number;
  format?: 'jpg' | 'png' | 'webp';
  width?: number;
  height?: number;
}

const STAGE_LABELS: Record<WorkerProgressStage, string> = {
  validating: 'Validating image...',
  reading: 'Reading file data...',
  decoding: 'Decoding image...',
  encoding: 'Rotating & encoding...',
  finalizing: 'Finalizing...',
};

const MAX_BATCH_FILES = 20;

export function RotateImageController() {
  const [isHydrated, setIsHydrated] = useState(false);
  const [files, setFiles] = useState<RotateFileItem[]>([]);

  // Shared Rotation & Output Options
  const [degrees, setDegrees] = useState<0 | 90 | 180 | 270>(90);
  const [outputFormat, setOutputFormat] = useState<'original' | 'jpg' | 'png' | 'webp'>('original');
  const [quality, setQuality] = useState<number>(0.9); // 0.7, 0.8, 0.9

  const [isRotating, setIsRotating] = useState(false);
  const [isZipping, setIsZipping] = useState(false);
  const [globalMessage, setGlobalMessage] = useState<{ type: 'error' | 'info'; text: string } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const addMoreInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  // Clean up object URLs on unmount
  useEffect(() => {
    return () => {
      files.forEach((item) => {
        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
        if (item.resultUrl) URL.revokeObjectURL(item.resultUrl);
      });
    };
  }, [files]);

  const loadImageDimensions = async (file: File): Promise<{ width: number; height: number }> => {
    return new Promise((resolve) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const w = img.naturalWidth || img.width || 800;
        const h = img.naturalHeight || img.height || 600;
        URL.revokeObjectURL(url);
        resolve({ width: w, height: h });
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve({ width: 800, height: 600 });
      };
      img.src = url;
    });
  };

  const handleFilesAdded = useCallback(
    async (incomingFiles: File[]) => {
      setGlobalMessage(null);
      if (incomingFiles.length === 0) return;

      const currentCount = files.length;
      if (currentCount + incomingFiles.length > MAX_BATCH_FILES) {
        setGlobalMessage({
          type: 'error',
          text: `You can rotate up to ${MAX_BATCH_FILES} files at a time.`,
        });
      }

      const allowedIncoming = incomingFiles.slice(
        0,
        Math.max(0, MAX_BATCH_FILES - currentCount)
      );

      const newItems: RotateFileItem[] = [];

      for (const file of allowedIncoming) {
        const id = `${file.name}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
        const previewUrl = URL.createObjectURL(file);
        const dims = await loadImageDimensions(file);

        newItems.push({
          id,
          file,
          previewUrl,
          originalWidth: dims.width,
          originalHeight: dims.height,
          status: 'pending',
          progress: 0,
        });
      }

      setFiles((prev) => [...prev, ...newItems]);
    },
    [files.length]
  );

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFiles = Array.from(e.dataTransfer.files);
      handleFilesAdded(droppedFiles);
    }
  };

  const handleFileSelectChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selected = Array.from(e.target.files);
      handleFilesAdded(selected);
      e.target.value = '';
    }
  };

  const removeFile = (id: string) => {
    setFiles((prev) => {
      const target = prev.find((f) => f.id === id);
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      if (target?.resultUrl) URL.revokeObjectURL(target.resultUrl);
      return prev.filter((f) => f.id !== id);
    });
  };

  const clearAll = () => {
    files.forEach((item) => {
      if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
      if (item.resultUrl) URL.revokeObjectURL(item.resultUrl);
    });
    setFiles([]);
    setGlobalMessage(null);
  };

  const rotateLeft = () => {
    setDegrees((prev) => ((prev - 90 + 360) % 360) as 0 | 90 | 180 | 270);
  };

  const rotateRight = () => {
    setDegrees((prev) => ((prev + 90) % 360) as 0 | 90 | 180 | 270);
  };

  const rotate180 = () => {
    setDegrees((prev) => ((prev + 180) % 360) as 0 | 90 | 180 | 270);
  };

  const handleProcessAll = async () => {
    if (files.length === 0 || isRotating) return;
    setIsRotating(true);
    setGlobalMessage(null);

    const pendingOrFailed = files.filter(
      (f) => f.status === 'pending' || f.status === 'failed' || f.status === 'completed'
    );

    for (const item of pendingOrFailed) {
      setFiles((prev) =>
        prev.map((f) =>
          f.id === item.id
            ? { ...f, status: 'validating', progress: 10, stage: 'validating', errorMessage: undefined }
            : f
        )
      );

      try {
        const result: RotateImageResult = await rotateImage(
          item.file,
          {
            degrees,
            outputFormat,
            quality,
          },
          (progress, stage) => {
            setFiles((prev) =>
              prev.map((f) =>
                f.id === item.id
                  ? { ...f, status: 'processing', progress, stage: stage || 'encoding' }
                  : f
              )
            );
          }
        );

        if (item.resultUrl) {
          URL.revokeObjectURL(item.resultUrl);
        }

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
                  originalSize: result.originalSize,
                  convertedSize: result.convertedSize,
                  format: result.format,
                  width: result.width,
                  height: result.height,
                }
              : f
          )
        );
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "We couldn't rotate this image. Please try again.";
        setFiles((prev) =>
          prev.map((f) =>
            f.id === item.id
              ? {
                  ...f,
                  status: 'failed',
                  progress: 0,
                  errorMessage: message,
                }
              : f
          )
        );
      }
    }

    setIsRotating(false);
  };

  const handleDownloadAllZip = async () => {
    const completedItems = files.filter((f) => f.status === 'completed' && f.resultBlob && f.resultFileName);
    if (completedItems.length === 0 || isZipping) return;

    setIsZipping(true);
    try {
      const zipEntries = completedItems.map((item) => ({
        name: item.resultFileName || 'rotated-image.jpg',
        blob: item.resultBlob!,
      }));

      const zipBlob = await createZipBlob(zipEntries);
      triggerBlobDownload(zipBlob, `rotated-images-${Date.now()}.zip`);
    } catch {
      setGlobalMessage({
        type: 'error',
        text: 'Failed to generate ZIP archive. Please download files individually.',
      });
    } finally {
      setIsZipping(false);
    }
  };

  if (!isHydrated) {
    return (
      <div className="bg-[#FFFFFF] border border-[#E4E2F0] rounded-card p-8 text-center shadow-subtle mb-6">
        <p className="text-sm text-[#5E6488]">Loading Rotate Image tool...</p>
      </div>
    );
  }

  const completedCount = files.filter((f) => f.status === 'completed').length;
  const hasFiles = files.length > 0;
  const activeFile = files[0]; // For single-file preview/details

  return (
    <div className="space-y-6">
      {globalMessage && (
        <div
          className={`p-4 rounded-xl border flex items-center space-x-3 text-sm ${
            globalMessage.type === 'error'
              ? 'bg-red-50 border-red-200 text-red-700'
              : 'bg-blue-50 border-blue-200 text-blue-700'
          }`}
        >
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{globalMessage.text}</span>
        </div>
      )}

      {!hasFiles ? (
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-[#D0D5DD] hover:border-[#7C3AED] bg-[#FFFFFF] hover:bg-[#F4F3FA] rounded-card p-10 md:p-14 text-center cursor-pointer transition-all shadow-subtle group"
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
            multiple
            onChange={handleFileSelectChange}
            className="hidden"
          />
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[#F4F0FD] text-[#7C3AED] flex items-center justify-center group-hover:scale-105 transition-transform">
            <UploadCloud className="w-8 h-8" />
          </div>
          <h2 className="text-lg font-semibold text-[#0F112E] mb-1">
            Upload images to rotate
          </h2>
          <p className="text-sm text-[#5E6488] mb-4">
            Drag & drop JPG, PNG, or WebP files here, or browse files (Max 50 MB, up to 20 files)
          </p>
          <button
            type="button"
            className="px-5 py-2.5 bg-[#7C3AED] hover:bg-[#0D3640] text-white font-medium text-sm rounded-lg transition-colors shadow-sm inline-flex items-center space-x-2"
          >
            <Plus className="w-4 h-4" />
            <span>Select Images</span>
          </button>
        </div>
      ) : (
        <div className="bg-[#FFFFFF] border border-[#E4E2F0] rounded-card p-6 md:p-8 shadow-subtle space-y-6">
          {/* Header toolbar */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-[#E4E2F0] gap-4">
            <div>
              <h2 className="text-lg font-bold text-[#0F112E]">
                Rotate Images ({files.length} / {MAX_BATCH_FILES})
              </h2>
              <p className="text-xs text-[#5E6488]">
                Shared rotation: <span className="font-semibold text-[#7C3AED]">{degrees}°</span>
              </p>
            </div>
            <div className="flex items-center space-x-3">
              <input
                ref={addMoreInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
                multiple
                onChange={handleFileSelectChange}
                className="hidden"
              />
              {files.length < MAX_BATCH_FILES && (
                <button
                  type="button"
                  onClick={() => addMoreInputRef.current?.click()}
                  className="px-3.5 py-2 border border-[#D0D5DD] hover:bg-[#F4F3FA] text-[#344054] text-xs font-semibold rounded-lg transition-colors inline-flex items-center space-x-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add More</span>
                </button>
              )}
              <button
                type="button"
                onClick={clearAll}
                className="px-3.5 py-2 border border-red-200 hover:bg-red-50 text-red-600 text-xs font-semibold rounded-lg transition-colors inline-flex items-center space-x-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear All</span>
              </button>
            </div>
          </div>

          {/* Rotation & Output Controls */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-5 bg-[#F4F3FA] border border-[#E4E2F0] rounded-xl">
            {/* Rotation Controls */}
            <div className="space-y-3">
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#344054]">
                Rotation Angle ({degrees}°)
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={rotateLeft}
                  className={`py-2 px-3 text-xs font-semibold rounded-lg border transition-all inline-flex items-center justify-center space-x-1 ${
                    degrees === 270
                      ? 'bg-[#7C3AED] text-white border-[#7C3AED]'
                      : 'bg-white text-[#344054] border-[#D0D5DD] hover:bg-[#F4F3FA]'
                  }`}
                >
                  <span>-90° (Left)</span>
                </button>
                <button
                  type="button"
                  onClick={rotate180}
                  className={`py-2 px-3 text-xs font-semibold rounded-lg border transition-all inline-flex items-center justify-center space-x-1 ${
                    degrees === 180
                      ? 'bg-[#7C3AED] text-white border-[#7C3AED]'
                      : 'bg-white text-[#344054] border-[#D0D5DD] hover:bg-[#F4F3FA]'
                  }`}
                >
                  <span>180°</span>
                </button>
                <button
                  type="button"
                  onClick={rotateRight}
                  className={`py-2 px-3 text-xs font-semibold rounded-lg border transition-all inline-flex items-center justify-center space-x-1 ${
                    degrees === 90
                      ? 'bg-[#7C3AED] text-white border-[#7C3AED]'
                      : 'bg-white text-[#344054] border-[#D0D5DD] hover:bg-[#F4F3FA]'
                  }`}
                >
                  <RotateCw className="w-3.5 h-3.5" />
                  <span>+90° (Right)</span>
                </button>
              </div>
            </div>

            {/* Output Format */}
            <div className="space-y-3">
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#344054]">
                Output Format
              </label>
              <select
                value={outputFormat}
                onChange={(e) => setOutputFormat(e.target.value as 'original' | 'jpg' | 'png' | 'webp')}
                className="w-full px-3 py-2 bg-white border border-[#D0D5DD] rounded-lg text-sm text-[#0F112E] focus:outline-none focus:ring-2 focus:ring-[#7C3AED]"
              >
                <option value="original">Original Format</option>
                <option value="jpg">JPG (JPEG)</option>
                <option value="png">PNG (Preserves Transparency)</option>
                <option value="webp">WebP</option>
              </select>
            </div>

            {/* Quality Preset (for JPG / WebP) */}
            {(outputFormat === 'jpg' || outputFormat === 'webp' || (outputFormat === 'original' && activeFile && !activeFile.file.name.endsWith('.png'))) && (
              <div className="space-y-3">
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#344054]">
                  Quality Preset
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: 'High (90%)', val: 0.9 },
                    { label: 'Med (80%)', val: 0.8 },
                    { label: 'Low (70%)', val: 0.7 },
                  ].map((q) => (
                    <button
                      key={q.val}
                      type="button"
                      onClick={() => setQuality(q.val)}
                      className={`py-2 px-2 text-xs font-semibold rounded-lg border transition-all text-center ${
                        quality === q.val
                          ? 'bg-[#7C3AED] text-white border-[#7C3AED]'
                          : 'bg-white text-[#344054] border-[#D0D5DD] hover:bg-[#F4F3FA]'
                      }`}
                    >
                      {q.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Single File Preview (if exactly 1 file) */}
          {files.length === 1 && activeFile && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center p-4 bg-white border border-[#E4E2F0] rounded-xl">
              <div className="md:col-span-1 flex justify-center bg-[#F4F3FA] p-4 rounded-lg border border-[#E4E2F0] min-h-[160px] max-h-[220px] relative overflow-hidden">
                {activeFile.previewUrl ? (
                  <img
                    src={activeFile.previewUrl}
                    alt={activeFile.file.name}
                    style={{ transform: `rotate(${degrees}deg)`, transition: 'transform 0.3s ease' }}
                    className="max-h-[180px] max-w-full object-contain shadow-sm"
                  />
                ) : (
                  <ImageIcon className="w-12 h-12 text-[#98A2B3] self-center" />
                )}
              </div>
              <div className="md:col-span-2 space-y-2">
                <div className="flex items-center space-x-2">
                  <span className="font-semibold text-[#0F112E] text-base truncate max-w-[280px]">
                    {activeFile.file.name}
                  </span>
                  <span className="text-xs px-2 py-0.5 bg-[#F4F0FD] text-[#7C3AED] font-medium rounded">
                    {formatBytes(activeFile.file.size)}
                  </span>
                </div>
                <p className="text-xs text-[#5E6488]">
                  Original Dimensions: {activeFile.originalWidth} × {activeFile.originalHeight} px
                </p>
                {activeFile.status === 'completed' && activeFile.width && activeFile.height && (
                  <p className="text-xs text-emerald-600 font-medium">
                    Rotated Dimensions: {activeFile.width} × {activeFile.height} px ({formatBytes(activeFile.convertedSize || 0)})
                  </p>
                )}
                {activeFile.status === 'processing' && (
                  <div className="space-y-1.5 pt-2">
                    <div className="flex justify-between text-xs text-[#5E6488]">
                      <span>{activeFile.stage ? STAGE_LABELS[activeFile.stage] : 'Processing...'}</span>
                      <span>{activeFile.progress}%</span>
                    </div>
                    <ProgressBar progress={activeFile.progress} />
                  </div>
                )}
                {activeFile.errorMessage && (
                  <p className="text-xs text-red-600 font-medium">{activeFile.errorMessage}</p>
                )}
              </div>
            </div>
          )}

          {/* Batch File List (if > 1 file) */}
          {files.length > 1 && (
            <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
              {files.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-3 bg-white border border-[#E4E2F0] rounded-xl text-sm"
                >
                  <div className="flex items-center space-x-3 truncate">
                    <div className="w-10 h-10 rounded-lg bg-[#F4F0FD] flex items-center justify-center flex-shrink-0 overflow-hidden border border-[#E4E2F0]">
                      {item.previewUrl ? (
                        <img
                          src={item.previewUrl}
                          alt=""
                          style={{ transform: `rotate(${degrees}deg)` }}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <ImageIcon className="w-5 h-5 text-[#7C3AED]" />
                      )}
                    </div>
                    <div className="truncate">
                      <p className="font-semibold text-[#0F112E] truncate max-w-[200px] sm:max-w-[320px]">
                        {item.file.name}
                      </p>
                      <p className="text-xs text-[#5E6488]">
                        {formatBytes(item.file.size)} • {item.originalWidth}×{item.originalHeight}px
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3 flex-shrink-0">
                    {item.status === 'completed' && (
                      <span className="inline-flex items-center space-x-1 text-xs font-semibold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Done</span>
                      </span>
                    )}
                    {item.status === 'processing' && (
                      <span className="inline-flex items-center space-x-1 text-xs font-semibold text-[#7C3AED] bg-[#F4F0FD] px-2.5 py-1 rounded-full animate-pulse">
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>{item.progress}%</span>
                      </span>
                    )}
                    {item.status === 'failed' && (
                      <span className="text-xs font-semibold text-red-600 bg-red-50 px-2.5 py-1 rounded-full">
                        Failed
                      </span>
                    )}
                    {item.status === 'pending' && (
                      <span className="text-xs text-[#5E6488] px-2 py-1">Queued</span>
                    )}

                    {item.resultUrl && (
                      <a
                        href={item.resultUrl}
                        download={formatDownloadFilename(item.resultFileName || 'rotated.jpg')}
                        className="p-2 bg-[#F4F0FD] hover:bg-[#EDE8FA] text-[#7C3AED] rounded-lg transition-colors"
                        title="Download"
                      >
                        <Download className="w-4 h-4" />
                      </a>
                    )}

                    <button
                      type="button"
                      onClick={() => removeFile(item.id)}
                      className="p-2 text-[#98A2B3] hover:text-red-600 rounded-lg transition-colors"
                      title="Remove"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Action CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-between pt-4 border-t border-[#E4E2F0] gap-4">
            <div className="text-xs text-[#5E6488]">
              {completedCount > 0 ? `${completedCount} of ${files.length} images rotated successfully.` : 'Ready to rotate with shared angle.'}
            </div>
            <div className="flex items-center space-x-3 w-full sm:w-auto">
              <button
                type="button"
                onClick={handleProcessAll}
                disabled={isRotating}
                className="w-full sm:w-auto px-6 py-3 bg-[#7C3AED] hover:bg-[#0D3640] text-white font-semibold text-sm rounded-xl transition-all shadow-sm inline-flex items-center justify-center space-x-2 disabled:opacity-50"
              >
                {isRotating ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Rotating Images...</span>
                  </>
                ) : (
                  <>
                    <RotateCw className="w-4 h-4" />
                    <span>Rotate Image{files.length > 1 ? 's' : ''} ({degrees}°)</span>
                  </>
                )}
              </button>

              {completedCount > 1 && (
                <button
                  type="button"
                  onClick={handleDownloadAllZip}
                  disabled={isZipping}
                  className="w-full sm:w-auto px-6 py-3 bg-white border border-[#7C3AED] text-[#7C3AED] hover:bg-[#F4F0FD] font-semibold text-sm rounded-xl transition-all shadow-sm inline-flex items-center justify-center space-x-2"
                >
                  {isZipping ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
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

              {files.length === 1 && files[0].resultUrl && (
                <a
                  href={files[0].resultUrl}
                  download={formatDownloadFilename(files[0].resultFileName || 'rotated.jpg')}
                  className="w-full sm:w-auto px-6 py-3 bg-[#7C3AED] hover:bg-[#6D28D9] text-white font-semibold text-sm rounded-xl transition-all shadow-sm inline-flex items-center justify-center space-x-2"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Rotated Image</span>
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default RotateImageController;
