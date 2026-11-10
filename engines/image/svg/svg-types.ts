export interface SvgDimensions {
  width: number;
  height: number;
  viewBox?: {
    minX: number;
    minY: number;
    width: number;
    height: number;
  };
}

export interface SvgValidationResult {
  valid: boolean;
  error?: Error;
  dimensions?: SvgDimensions;
  svgText?: string;
}

export interface SvgRasterizeOptions {
  maxWidth?: number;
  maxHeight?: number;
}
