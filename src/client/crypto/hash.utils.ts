import crypto from "crypto";

/**
 * Oblicza SHA-256 hash i zwraca jako base64
 */
export function sha256Base64(data: Buffer | string): string {
  const buffer = typeof data === "string" ? Buffer.from(data, "utf8") : data;
  return crypto.createHash("sha256").update(buffer).digest("base64");
}

/**
 * Oblicza SHA-256 hash z Buffer
 */
export function sha256Base64Buffer(buffer: Buffer): string {
  return crypto.createHash("sha256").update(buffer).digest("base64");
}

/**
 * Konwertuje certyfikat Base64 do formatu PEM
 */
export function pemFromBase64Cert(base64Cert: string): string {
  const clean = base64Cert.replace(/\s/g, "");
  return `-----BEGIN CERTIFICATE-----\n${clean}\n-----END CERTIFICATE-----`;
}

/**
 * Wybiera odpowiedni certyfikat z listy na podstawie usage
 */
export function pickCertificate(certificates: any[], usage: string): any | null {
  if (!Array.isArray(certificates) || certificates.length === 0) {
    return null;
  }

  const cert = certificates.find(
    (c) =>
      c.subjectName?.includes(usage) ||
      c.usage === usage ||
      c.subjectName?.toLowerCase().includes(usage.toLowerCase())
  );

  return cert || null;
}