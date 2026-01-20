// Types
export * from "./types";

// Hash utilities
export { sha256Base64, sha256Base64Buffer, pemFromBase64Cert, pickCertificate } from "./hash.utils";

// AES
export { AesCrypto } from "./aes.crypto";

// RSA
export { RsaCrypto } from "./rsa.crypto";

// XAdES
export {
  generateAuthTokenRequestXml,
  signXmlSimple,
  verifyKeyMatchesCert,
  parseCertificateInfo,
  formatSigningTime,
  exclusiveCanonicalize,
  exclusiveCanonicalizeNode,
  canonicalizeNode,
  convertDerToP1363WithLowS,
} from "./xades";

// ============================================
// Ready-to-use crypto implementation
// ============================================

import { AesCrypto } from "./aes.crypto";
import { RsaCrypto } from "./rsa.crypto";
import { generateAuthTokenRequestXml, signXmlSimple } from "./xades";
import { KSefCryptoOperations } from "../auth/types";

/**
 * Gotowa implementacja KSefCryptoOperations
 * Można przekazać bezpośrednio do KSefClient
 */
export const ksefCrypto: KSefCryptoOperations = {
  // Auth (XAdES)
  generateAuthTokenRequestXml,
  signXml: signXmlSimple,

  // Session (AES)
  generateAesKey: () => AesCrypto.generateKey(),
  generateIv: () => AesCrypto.generateIV(),
  encryptInvoiceXml: (xml, key, iv) => AesCrypto.encryptInvoiceXml(xml, key, iv),

  // Session (RSA)
  encryptSymmetricKey: (key, cert) => RsaCrypto.encryptSymmetricKey(key, cert),
};