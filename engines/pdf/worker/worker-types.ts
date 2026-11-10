export type PdfOperation =
  | 'image-to-pdf'
  | 'convert'
  | 'merge'
  | 'split'
  | 'compress'
  | 'rotate'
  | 'delete-pages'
  | 'reorder-pages';

export interface PdfWorkerFileInput {
  name: string;
  data: ArrayBuffer;
  type?: string;
  width?: number;
  height?: number;
}

export interface PdfWorkerRequest {
  id: string;
  operation: PdfOperation;
  files: PdfWorkerFileInput[];
  options: {
    pageSize?: 'A4';
    orientation?: 'auto' | 'portrait' | 'landscape';
    margin?: number;
    outputFileName?: string;
    [key: string]: unknown;
  };
}

export interface PdfWorkerResponse {
  id: string;
  type?: 'progress' | 'result' | 'error';
  success: boolean;
  stage?: 'preparing' | 'processing' | 'finalizing' | 'completed';
  progress?: number;
  currentIndex?: number;
  totalCount?: number;
  fileName?: string;
  resultData?: ArrayBuffer;
  resultFileName?: string;
  pageCount?: number;
  resultFiles?: Array<{ name: string; data: ArrayBuffer }>;
  error?: string;
}
