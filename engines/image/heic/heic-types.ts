export interface DecodedImage {
  width: number;
  height: number;
  imageData?: ImageData;
  imageBitmap?: ImageBitmap;
}

export interface HeicDecodeOptions {
  quality?: number;
}

export interface HeicDecoder {
  decode(file: File | Blob): Promise<DecodedImage>;
  decodeToJpegBlob(file: File | Blob, quality?: number): Promise<Blob>;
}
