import type { ToolError } from '../../shared/errors';

export interface BmpDimensions {
  width: number;
  height: number;
  isTopDown: boolean;
  bpp: number;
  compression: number;
}

export interface BmpValidationResult {
  valid: boolean;
  error?: ToolError;
  dimensions?: BmpDimensions;
  dibHeaderSize?: number;
}

export interface BmpDecoderOptions {
  maxWidth?: number;
  maxHeight?: number;
}

export interface BmpDecodeResult {
  blob: Blob;
  fileName: string;
  originalSize: number;
  convertedSize: number;
  width: number;
  height: number;
  isTopDown: boolean;
}
