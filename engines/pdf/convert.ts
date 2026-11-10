export interface PdfConvertOptions {
  targetFormat: 'jpg' | 'png' | 'pdf';
  dpi?: number;
}

export interface PdfProcessingResult {
  blob: Blob;
  fileName: string;
  originalSize: number;
  convertedSize: number;
  pageCount?: number;
}

export async function convertPdf(
  _file: File,
  _options: PdfConvertOptions,
  _onProgress?: (progress: number) => void
): Promise<PdfProcessingResult> {
  throw new Error('PDF convert engine interface ready. Tool implementation scheduled for PDF tool phase.');
}
