import * as QRCode from "qrcode";
import { QRGeneratorOptions, QRCodeResult } from "./types";

const DEFAULT_OPTIONS: Required<QRGeneratorOptions> = {
  pixelsPerModule: 5,
  margin: 1,
  errorCorrectionLevel: "M",
};

export async function generateKSefInvoiceQRCode(
  content: string,
  options: QRGeneratorOptions = {}
): Promise<QRCodeResult> {
  const config = {
    pixelsPerModule: Math.max(1, Math.floor(options.pixelsPerModule ?? DEFAULT_OPTIONS.pixelsPerModule)),
    margin: Math.max(0, Math.floor(options.margin ?? DEFAULT_OPTIONS.margin)),
    errorCorrectionLevel: options.errorCorrectionLevel ?? DEFAULT_OPTIONS.errorCorrectionLevel,
  };

  const pngBuffer: Buffer = await QRCode.toBuffer(content, {
    type: "png",
    scale: config.pixelsPerModule,
    margin: config.margin,
    errorCorrectionLevel: config.errorCorrectionLevel,
  });

  const base64 = pngBuffer.toString("base64");

  return {
    pngBase64: base64, // ✅ Czysty base64 string
    dataUrl: `data:image/png;base64,${base64}`,
  };
}