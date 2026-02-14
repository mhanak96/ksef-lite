export interface QRGeneratorOptions {
  pixelsPerModule?: number;
  margin?: number;
  errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H';
}

export interface QRCodeResult {
  pngBase64: string;

  dataUrl: string;
}
