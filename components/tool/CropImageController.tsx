'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  UploadCloud,
  AlertCircle,
  RefreshCw,
  Download,
  CheckCircle2,
  Crop as CropIcon,
} from 'lucide-react';
import { formatBytes, triggerBlobDownload } from '@/engines/shared/file-utils';
import { cropImage, ImageCropOptions, CropImageResult } from '@/engines/image/crop';
import type { WorkerProgressStage } from '@/engines/image/worker/worker-types';
import ProgressBar from './ProgressBar';

type AspectRatioMode = 'free' | '1:1' | '4:3' | '16:9';

const STAGE_LABELS: Record<WorkerProgressStage, string> = {
  validating: 'Validating image...',
  reading: 'Reading file data...',
  decoding: 'Decoding image...',
  encoding: 'Cropping & encoding...',
  finalizing: 'Finalizing...',
};

export function CropImageController() {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [originalWidth, setOriginalWidth] = useState<number>(0);
  const [originalHeight, setOriginalHeight] = useState<number>(0);

  // Crop State (in preview display pixels)
  const [cropBox, setCropBox] = useState<{ x: number; y: number; width: number; height: number }>({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
  });

  const [aspectRatio, setAspectRatio] = useState<AspectRatioMode>('free');
  const [outputFormat, setOutputFormat] = useState<'original' | 'jpg' | 'png' | 'webp'>('original');
  const [quality, setQuality] = useState<number>(0.9); // 0.9 default

  const [status, setStatus] = useState<'idle' | 'validating' | 'processing' | 'success' | 'error'>('idle');
  const [progress, setProgress] = useState<number>(0);
  const [stage, setStage] = useState<WorkerProgressStage | undefined>(undefined);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [result, setResult] = useState<CropImageResult | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);

  // Container & image display refs for coordinate scaling
  const imageContainerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Interaction dragging / resizing state
  const dragRef = useRef<{
    active: boolean;
    mode: 'move' | 'nw' | 'ne' | 'se' | 'sw' | null;
    startX: number;
    startY: number;
    initialBox: { x: number; y: number; width: number; height: number };
  }>({
    active: false,
    mode: null,
    startX: 0,
    startY: 0,
    initialBox: { x: 0, y: 0, width: 0, height: 0 },
  });

  // Cleanup URLs on unmount
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      if (resultUrl) URL.revokeObjectURL(resultUrl);
    };
  }, [previewUrl, resultUrl]);

  // Initialize crop box when image loads or aspect ratio changes
  const initCropBox = useCallback((imgW: number, imgH: number, mode: AspectRatioMode) => {
    if (imgW <= 0 || imgH <= 0) return;
    let w = Math.round(imgW * 0.9);
    let h = Math.round(imgH * 0.9);

    if (mode === '1:1') {
      const size = Math.min(imgW, imgH) * 0.8;
      w = size;
      h = size;
    } else if (mode === '4:3') {
      if (imgW / imgH > 4 / 3) {
        h = imgH * 0.8;
        w = h * (4 / 3);
      } else {
        w = imgW * 0.8;
        h = w * (3 / 4);
      }
    } else if (mode === '16:9') {
      if (imgW / imgH > 16 / 9) {
        h = imgH * 0.8;
        w = h * (16 / 9);
      } else {
        w = imgW * 0.8;
        h = w * (9 / 16);
      }
    }

    const x = (imgW - w) / 2;
    const y = (imgH - h) / 2;
    setCropBox({ x: Math.max(0, x), y: Math.max(0, y), width: Math.max(20, w), height: Math.max(20, h) });
  }, []);

  const handleFilesSelected = async (selectedFiles: File[]) => {
    if (selectedFiles.length === 0) return;
    const targetFile = selectedFiles[0];

    if (previewUrl) URL.revokeObjectURL(previewUrl);
    if (resultUrl) URL.revokeObjectURL(resultUrl);

    setFile(targetFile);
    setResult(null);
    setResultUrl(null);
    setErrorMessage(null);
    setStatus('validating');
    setProgress(15);

    const objectUrl = URL.createObjectURL(targetFile);
    setPreviewUrl(objectUrl);

    const img = new Image();
    img.onload = () => {
      const w = img.naturalWidth || img.width || 800;
      const h = img.naturalHeight || img.height || 600;
      setOriginalWidth(w);
      setOriginalHeight(h);

      // Get displayed dimensions
      const dispW = imgRef.current?.clientWidth || w;
      const dispH = imgRef.current?.clientHeight || h;

      initCropBox(dispW, dispH, aspectRatio);
      setStatus('idle');
      setProgress(0);
    };
    img.onerror = () => {
      setStatus('error');
      setErrorMessage("We couldn't decode this image. Please check the file.");
    };
    img.src = objectUrl;
  };

  // Re-initialize crop box when aspect ratio changes
  useEffect(() => {
    if (imgRef.current && originalWidth > 0 && originalHeight > 0) {
      const dispW = imgRef.current.clientWidth;
      const dispH = imgRef.current.clientHeight;
      initCropBox(dispW, dispH, aspectRatio);
    }
  }, [aspectRatio, originalWidth, originalHeight, initCropBox]);

  // Pointer event handlers for dragging and resizing crop box
  const handlePointerDown = (mode: 'move' | 'nw' | 'ne' | 'se' | 'sw', e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);

    dragRef.current = {
      active: true,
      mode,
      startX: e.clientX,
      startY: e.clientY,
      initialBox: { ...cropBox },
    };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current.active || !imgRef.current) return;
    e.preventDefault();

    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    const init = dragRef.current.initialBox;
    const dispW = imgRef.current.clientWidth;
    const dispH = imgRef.current.clientHeight;

    let { x, y, width, height } = init;
    const mode = dragRef.current.mode;

    if (mode === 'move') {
      x = Math.max(0, Math.min(dispW - width, init.x + dx));
      y = Math.max(0, Math.min(dispH - height, init.y + dy));
    } else if (mode === 'se') {
      width = Math.max(30, Math.min(dispW - init.x, init.width + dx));
      height = Math.max(30, Math.min(dispH - init.y, init.height + dy));

      if (aspectRatio === '1:1') {
        const size = Math.min(width, height);
        width = size;
        height = size;
      } else if (aspectRatio === '4:3') {
        height = width * (3 / 4);
      } else if (aspectRatio === '16:9') {
        height = width * (9 / 16);
      }
    } else if (mode === 'nw') {
      const newW = Math.max(30, init.width - dx);
      const newH = Math.max(30, init.height - dy);
      const newX = init.x + (init.width - newW);
      const newY = init.y + (init.height - newH);

      if (newX >= 0 && newY >= 0) {
        x = newX;
        y = newY;
        width = newW;
        height = newH;
      }
    } else if (mode === 'ne') {
      const newW = Math.max(30, Math.min(dispW - init.x, init.width + dx));
      const newH = Math.max(30, init.height - dy);
      const newY = init.y + (init.height - newH);

      if (newY >= 0) {
        width = newW;
        height = newH;
        y = newY;
      }
    } else if (mode === 'sw') {
      const newW = Math.max(30, init.width - dx);
      const newH = Math.max(30, Math.min(dispH - init.y, init.height + dy));
      const newX = init.x + (init.width - newW);

      if (newX >= 0) {
        x = newX;
        width = newW;
        height = newH;
      }
    }

    // Clamp box inside display image boundaries
    if (x < 0) x = 0;
    if (y < 0) y = 0;
    if (x + width > dispW) width = dispW - x;
    if (y + height > dispH) height = dispH - y;

    setCropBox({ x, y, width, height });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!dragRef.current.active) return;
    dragRef.current.active = false;
    dragRef.current.mode = null;
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // ignore capture errors
    }
  };

  // Compute source pixel dimensions from displayed crop box
  const getSourceCropDimensions = () => {
    if (!imgRef.current || originalWidth <= 0 || originalHeight <= 0) {
      return { sourceX: 0, sourceY: 0, sourceWidth: originalWidth, sourceHeight: originalHeight };
    }
    const dispW = imgRef.current.clientWidth;
    const dispH = imgRef.current.clientHeight;

    const scaleX = originalWidth / dispW;
    const scaleY = originalHeight / dispH;

    const sourceX = Math.round(cropBox.x * scaleX);
    const sourceY = Math.round(cropBox.y * scaleY);
    const sourceWidth = Math.round(cropBox.width * scaleX);
    const sourceHeight = Math.round(cropBox.height * scaleY);

    return {
      sourceX: Math.max(0, Math.min(originalWidth - 1, sourceX)),
      sourceY: Math.max(0, Math.min(originalHeight - 1, sourceY)),
      sourceWidth: Math.max(1, Math.min(originalWidth - sourceX, sourceWidth)),
      sourceHeight: Math.max(1, Math.min(originalHeight - sourceY, sourceHeight)),
    };
  };

  const sourceCrop = getSourceCropDimensions();

  // Keyboard navigation for accessibility
  const handleKeyDown = (e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 10 : 1;
    let { x, y } = cropBox;
    const { width, height } = cropBox;

    if (e.key === 'ArrowLeft') x -= step;
    else if (e.key === 'ArrowRight') x += step;
    else if (e.key === 'ArrowUp') y -= step;
    else if (e.key === 'ArrowDown') y += step;
    else return;

    e.preventDefault();
    if (imgRef.current) {
      const dispW = imgRef.current.clientWidth;
      const dispH = imgRef.current.clientHeight;
      x = Math.max(0, Math.min(dispW - width, x));
      y = Math.max(0, Math.min(dispH - height, y));
      setCropBox({ x, y, width, height });
    }
  };

  const handleExecuteCrop = async () => {
    if (!file) return;

    setStatus('processing');
    setProgress(0);
    setErrorMessage(null);

    const options: ImageCropOptions = {
      x: sourceCrop.sourceX,
      y: sourceCrop.sourceY,
      width: sourceCrop.sourceWidth,
      height: sourceCrop.sourceHeight,
      outputFormat,
      quality,
    };

    try {
      const res = await cropImage(file, options, (p, s) => {
        setProgress(p);
        if (s) setStage(s);
      });

      setResult(res);
      if (resultUrl) URL.revokeObjectURL(resultUrl);
      const url = URL.createObjectURL(res.blob);
      setResultUrl(url);
      setStatus('success');
    } catch (err: unknown) {
      setStatus('error');
      setErrorMessage(err instanceof Error ? err.message : 'Crop processing failed.');
    }
  };

  const handleReset = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    if (resultUrl) URL.revokeObjectURL(resultUrl);
    setFile(null);
    setPreviewUrl(null);
    setResult(null);
    setResultUrl(null);
    setStatus('idle');
    setErrorMessage(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="bg-[#FFFFFF] border border-[#E4E2F0] rounded-card p-6 md:p-8 shadow-subtle mb-6 space-y-6">
      {/* 1. Upload Zone (when no file selected) */}
      {!file && (
        <div
          className="border-2 border-dashed border-[#D0D5DD] hover:border-[#7C3AED] rounded-xl p-8 text-center cursor-pointer bg-[#F4F3FA] transition-colors"
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            if (e.dataTransfer.files?.length) {
              handleFilesSelected(Array.from(e.dataTransfer.files));
            }
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
            onChange={(e) => {
              if (e.target.files?.length) {
                handleFilesSelected(Array.from(e.target.files));
              }
            }}
          />
          <div className="max-w-xs mx-auto space-y-3">
            <div className="w-12 h-12 rounded-full bg-[#7C3AED]/10 text-[#7C3AED] flex items-center justify-center mx-auto">
              <UploadCloud className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-semibold text-[#0F112E]">Drag & drop your image here</p>
              <p className="text-xs text-[#5E6488] mt-1">Supports JPG, PNG, WebP up to 50 MB</p>
            </div>
            <button
              type="button"
              className="px-4 py-2 bg-[#7C3AED] text-[#FFFFFF] text-sm font-medium rounded-lg hover:bg-[#0D353F] transition-colors"
            >
              Browse file
            </button>
          </div>
        </div>
      )}

      {/* Global Error Banner */}
      {errorMessage && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-center space-x-3 text-red-700 text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* 2. Crop Editor & Options (when file selected and not yet completed) */}
      {file && status !== 'success' && (
        <div className="space-y-6">
          {/* File header info */}
          <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-[#F4F3FA] border border-[#E4E2F0] rounded-xl">
            <div>
              <p className="text-sm font-semibold text-[#0F112E] truncate max-w-xs md:max-w-md">{file.name}</p>
              <p className="text-xs text-[#5E6488] mt-0.5">
                Original: {originalWidth} × {originalHeight} px ({formatBytes(file.size)})
              </p>
            </div>
            <button
              type="button"
              onClick={handleReset}
              className="text-xs font-medium text-[#5E6488] hover:text-[#0F112E] flex items-center space-x-1 px-3 py-1.5 bg-[#FFFFFF] border border-[#D0D5DD] rounded-lg transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Change file</span>
            </button>
          </div>

          {/* Aspect Ratio Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center space-x-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#5E6488]">Aspect Ratio:</span>
              {(['free', '1:1', '4:3', '16:9'] as AspectRatioMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setAspectRatio(mode)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                    aspectRatio === mode
                      ? 'bg-[#7C3AED] text-[#FFFFFF]'
                      : 'bg-[#F4F3FA] text-[#344054] border border-[#D0D5DD] hover:bg-[#F1F5F9]'
                  }`}
                >
                  {mode.toUpperCase()}
                </button>
              ))}
            </div>

            <div className="text-xs font-semibold text-[#7C3AED] bg-[#7C3AED]/10 px-3 py-1.5 rounded-lg">
              Crop: {sourceCrop.sourceWidth} × {sourceCrop.sourceHeight} px
            </div>
          </div>

          {/* Interactive Crop Canvas / Container */}
          <div
            ref={imageContainerRef}
            tabIndex={0}
            onKeyDown={handleKeyDown}
            className="relative overflow-hidden bg-[#1E293B] rounded-xl flex items-center justify-center p-4 min-h-[320px] max-h-[500px] focus:outline-none focus:ring-2 focus:ring-[#7C3AED]"
          >
            {previewUrl && (
              <div className="relative inline-block max-w-full max-h-[450px]">
                <img
                  ref={imgRef}
                  src={previewUrl}
                  alt="Crop Preview"
                  className="block max-w-full max-h-[450px] object-contain select-none pointer-events-none"
                />

                {/* Crop Box Overlay */}
                <div
                  className="absolute border-2 border-[#38BDF8] bg-[#38BDF8]/10 cursor-move touch-none"
                  style={{
                    left: `${cropBox.x}px`,
                    top: `${cropBox.y}px`,
                    width: `${cropBox.width}px`,
                    height: `${cropBox.height}px`,
                  }}
                  onPointerDown={(e) => handlePointerDown('move', e)}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                >
                  {/* Rule of thirds grid lines */}
                  <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-none">
                    <div className="border-r border-b border-[#38BDF8]/40" />
                    <div className="border-r border-b border-[#38BDF8]/40" />
                    <div className="border-b border-[#38BDF8]/40" />
                    <div className="border-r border-b border-[#38BDF8]/40" />
                    <div className="border-r border-b border-[#38BDF8]/40" />
                    <div className="border-b border-[#38BDF8]/40" />
                    <div className="border-r border-[#38BDF8]/40" />
                    <div className="border-r border-[#38BDF8]/40" />
                    <div />
                  </div>

                  {/* 4 Corner Handles */}
                  <div
                    className="absolute -top-2 -left-2 w-4 h-4 bg-[#FFFFFF] border-2 border-[#7C3AED] rounded-full cursor-nwse-resize"
                    onPointerDown={(e) => handlePointerDown('nw', e)}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                  />
                  <div
                    className="absolute -top-2 -right-2 w-4 h-4 bg-[#FFFFFF] border-2 border-[#7C3AED] rounded-full cursor-nesw-resize"
                    onPointerDown={(e) => handlePointerDown('ne', e)}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                  />
                  <div
                    className="absolute -bottom-2 -left-2 w-4 h-4 bg-[#FFFFFF] border-2 border-[#7C3AED] rounded-full cursor-nesw-resize"
                    onPointerDown={(e) => handlePointerDown('sw', e)}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                  />
                  <div
                    className="absolute -bottom-2 -right-2 w-4 h-4 bg-[#FFFFFF] border-2 border-[#7C3AED] rounded-full cursor-nesw-resize"
                    onPointerDown={(e) => handlePointerDown('se', e)}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Output Format & Quality Options */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#344054] mb-1.5">
                Output Format
              </label>
              <select
                value={outputFormat}
                onChange={(e) => setOutputFormat(e.target.value as 'original' | 'jpg' | 'png' | 'webp')}
                className="w-full px-3 py-2 bg-[#FFFFFF] border border-[#D0D5DD] rounded-lg text-sm text-[#0F112E] focus:outline-none focus:ring-2 focus:ring-[#7C3AED]"
              >
                <option value="original">Original Format</option>
                <option value="jpg">JPG (JPEG)</option>
                <option value="png">PNG (Lossless)</option>
                <option value="webp">WebP</option>
              </select>
            </div>

            {(outputFormat === 'jpg' || (outputFormat === 'original' && file.name.match(/\.(jpg|jpeg)$/i))) && (
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#344054] mb-1.5">
                  JPG Quality
                </label>
                <select
                  value={quality}
                  onChange={(e) => setQuality(parseFloat(e.target.value))}
                  className="w-full px-3 py-2 bg-[#FFFFFF] border border-[#D0D5DD] rounded-lg text-sm text-[#0F112E] focus:outline-none focus:ring-2 focus:ring-[#7C3AED]"
                >
                  <option value={0.9}>High — 90%</option>
                  <option value={0.8}>Medium — 80%</option>
                  <option value={0.7}>Low — 70%</option>
                </select>
              </div>
            )}

            {outputFormat === 'webp' && (
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#344054] mb-1.5">
                  WebP Quality
                </label>
                <select
                  value={quality}
                  onChange={(e) => setQuality(parseFloat(e.target.value))}
                  className="w-full px-3 py-2 bg-[#FFFFFF] border border-[#D0D5DD] rounded-lg text-sm text-[#0F112E] focus:outline-none focus:ring-2 focus:ring-[#7C3AED]"
                >
                  <option value={0.9}>High — 90%</option>
                  <option value={0.8}>Medium — 80%</option>
                  <option value={0.7}>Low — 70%</option>
                </select>
              </div>
            )}
          </div>

          {/* Progress Bar during processing */}
          {status === 'processing' && (
            <div className="space-y-2">
              <ProgressBar progress={progress} label={stage ? STAGE_LABELS[stage] : 'Processing image...'} />
            </div>
          )}

          {/* Action Button */}
          <div className="flex justify-end pt-2">
            <button
              type="button"
              disabled={status === 'processing' || cropBox.width <= 0 || cropBox.height <= 0}
              onClick={handleExecuteCrop}
              className="px-6 py-3 bg-[#7C3AED] text-[#FFFFFF] font-semibold rounded-xl hover:bg-[#0D353F] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              <CropIcon className="w-5 h-5" />
              <span>{status === 'processing' ? 'Cropping...' : 'Crop Image'}</span>
            </button>
          </div>
        </div>
      )}

      {/* 3. Result View (when successful) */}
      {status === 'success' && result && (
        <div className="space-y-6">
          <div className="p-6 bg-[#F4F3FA] border border-[#E4E2F0] rounded-xl space-y-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-[#0F112E]">Image Cropped Successfully</h3>
                <p className="text-xs text-[#5E6488]">Ready for download</p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2 border-t border-[#E4E2F0] text-sm">
              <div>
                <span className="text-xs text-[#5E6488] block">Original Dimensions</span>
                <span className="font-medium text-[#0F112E]">{originalWidth} × {originalHeight} px</span>
              </div>
              <div>
                <span className="text-xs text-[#5E6488] block">Cropped Dimensions</span>
                <span className="font-medium text-[#0F112E]">{result.width} × {result.height} px</span>
              </div>
              <div>
                <span className="text-xs text-[#5E6488] block">Original Size</span>
                <span className="font-medium text-[#0F112E]">{formatBytes(result.originalSize)}</span>
              </div>
              <div>
                <span className="text-xs text-[#5E6488] block">Output Format</span>
                <span className="font-medium text-[#0F112E] uppercase">{result.format}</span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
            <button
              type="button"
              onClick={handleReset}
              className="px-5 py-2.5 bg-[#FFFFFF] border border-[#D0D5DD] text-[#344054] font-medium rounded-xl hover:bg-[#F4F3FA] transition-colors flex items-center space-x-2"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Crop another image</span>
            </button>

            {resultUrl && (
              <button
                type="button"
                onClick={() => triggerBlobDownload(result.blob, result.fileName)}
                className="px-6 py-3 bg-[#7C3AED] text-[#FFFFFF] font-semibold rounded-xl hover:bg-[#0D353F] transition-colors flex items-center space-x-2 shadow-sm"
              >
                <Download className="w-5 h-5" />
                <span>Download Cropped Image</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
