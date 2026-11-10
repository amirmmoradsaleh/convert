import type { ToolError } from '../../shared/errors';

export interface GifDimensions {
  width: number;
  height: number;
}

export interface GifValidationResult {
  valid: boolean;
  error?: ToolError;
  dimensions?: GifDimensions;
  isAnimated?: boolean;
  version?: 'GIF87a' | 'GIF89a';
}

export interface GifDecoderOptions {
  maxWidth?: number;
  maxHeight?: number;
}

export interface GifDecodeResult {
  blob: Blob;
  fileName: string;
  originalSize: number;
  convertedSize: number;
  width: number;
  height: number;
  isAnimated: boolean;
}
