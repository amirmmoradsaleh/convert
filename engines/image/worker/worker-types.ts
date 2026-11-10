import type { ToolErrorCode } from '../../shared/errors';

export type ImageOperation = 'convert' | 'compress' | 'resize' | 'crop' | 'rotate';

export type WorkerProgressStage = 'validating' | 'reading' | 'decoding' | 'encoding' | 'finalizing';

export interface ImageWorkerRequest {
  id: string;
  operation: ImageOperation;
  fileData: ArrayBuffer;
  fileName: string;
  mimeType: string;
  options: {
    targetFormat?: 'png' | 'jpg' | 'webp';
    sourceFormat?: 'png' | 'jpg' | 'jpeg' | 'webp' | 'heic' | 'gif' | 'bmp';
    quality?: number;
    backgroundColor?: string;
    [key: string]: unknown;
  };
}

export interface ImageWorkerResponse {
  id: string;
  success: boolean;
  type?: 'progress' | 'success' | 'error';
  progress?: number;
  stage?: WorkerProgressStage;
  resultData?: ArrayBuffer;
  resultMime?: string;
  fileName?: string;
  width?: number;
  height?: number;
  originalSize?: number;
  convertedSize?: number;
  error?: string;
  errorCode?: ToolErrorCode;
}

