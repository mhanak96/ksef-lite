import crypto from "crypto";
import { CertificateInfo } from "../types";

/**
 * Sprawdza czy klucz prywatny pasuje do certyfikatu
 */
export function verifyKeyMatchesCert(certPem: string, privateKeyPem: string): boolean {
  try {
    const testData = "test message for key verification";

    const sign = crypto.createSign("SHA256");
    sign.update(testData);
    const signature = sign.sign(privateKeyPem);

    const verify = crypto.createVerify("SHA256");
    verify.update(testData);
    const isValid = verify.verify(certPem, signature);

    console.log("🔍 Key-certificate match:", isValid ? "✅ OK" : "❌ MISMATCH");

    return isValid;
  } catch (error) {
    console.error("🔴 Key verification error:", error instanceof Error ? error.message : String(error));
    return false;
  }
}

/**
 * Parsuje certyfikat i wyciąga Issuer oraz SerialNumber
 */
export function parseCertificateInfo(certPem: string): CertificateInfo {
  const x509 = new crypto.X509Certificate(certPem);

  const issuer = x509.issuer;

  const serialHex = x509.serialNumber;
  const serialBigInt = BigInt("0x" + serialHex);
  const serialNumber = serialBigInt.toString(10);

  console.log("📝 Certificate Issuer:", issuer);
  console.log("📝 Certificate SerialNumber:", serialNumber);

  return { issuer, serialNumber };
}

/**
 * Formatuje datę ISO dla XAdES 
 */
export function formatSigningTime(): string {
  const date = new Date();
  date.setMinutes(date.getMinutes() - 1);
  return date.toISOString();
}