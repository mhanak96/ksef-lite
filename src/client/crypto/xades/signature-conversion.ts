import { debugLog } from "../../../utils/logger";

// Krzywa P-256 order (n) - potrzebne do low-S normalization
const P256_ORDER = BigInt("0xFFFFFFFF00000000FFFFFFFFFFFFFFFFBCE6FAADA7179E84F3B9CAC2FC632551");
const P256_HALF_ORDER = P256_ORDER / 2n;

function bufferToBigInt(buf: Buffer): bigint {
  return BigInt("0x" + buf.toString("hex"));
}

function bigIntToBuffer(num: bigint, length: number): Buffer {
  let hex = num.toString(16);
  if (hex.length % 2 !== 0) hex = "0" + hex;
  while (hex.length < length * 2) hex = "00" + hex;
  if (hex.length > length * 2) hex = hex.slice(-length * 2);
  return Buffer.from(hex, "hex");
}

/**
 * Konwertuje podpis ECDSA z DER do P1363 z Low-S normalization
 */
export function convertDerToP1363WithLowS(derSignature: Buffer): Buffer {
  let offset = 0;

  if (derSignature[offset++] !== 0x30) {
    throw new Error("Invalid DER signature: expected SEQUENCE");
  }

  let seqLength = derSignature[offset++];
  if (seqLength & 0x80) {
    offset += seqLength & 0x7f;
  }

  if (derSignature[offset++] !== 0x02) {
    throw new Error("Invalid DER signature: expected INTEGER for R");
  }

  const rLength = derSignature[offset++];
  const r = derSignature.slice(offset, offset + rLength);
  offset += rLength;

  if (derSignature[offset++] !== 0x02) {
    throw new Error("Invalid DER signature: expected INTEGER for S");
  }

  const sLength = derSignature[offset++];
  const s = derSignature.slice(offset, offset + sLength);

  const rBigInt = bufferToBigInt(r);
  let sBigInt = bufferToBigInt(s);

  // Low-S normalization
  if (sBigInt > P256_HALF_ORDER) {
    sBigInt = P256_ORDER - sBigInt;
    debugLog("📝 Applied low-S normalization");
  }

  const componentLength = 32;

  return Buffer.concat([bigIntToBuffer(rBigInt, componentLength), bigIntToBuffer(sBigInt, componentLength)]);
}