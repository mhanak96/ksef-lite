/* =========================
   FORM CODE
   ========================= */

export interface SessionFormCode {
  systemCode?: string;
  schemaVersion?: string;
  value?: string;
}

/* =========================
     ENCRYPTION
     ========================= */

export interface SessionEncryption {
  encryptedSymmetricKey: string;
  initializationVector: string;
}

/* =========================
     SESSION STATE
     ========================= */

export interface SessionState {
  referenceNumber: string | null;
  symmetricKey: Buffer | null;
  iv: Buffer | null;
  isActive: boolean;
}

/* =========================
     REQUESTS
     ========================= */

export interface OpenSessionRequest {
  formCode: SessionFormCode;
  encryption: SessionEncryption;
}

export interface InvoicePayload {
  invoiceHash: string;
  invoiceSize: number;
  encryptedInvoiceHash: string;
  encryptedInvoiceSize: number;
  encryptedInvoiceContent: string;
  offlineMode?: boolean;
}

/* =========================
     RESPONSES
     ========================= */

export interface OpenSessionResponse {
  referenceNumber: string;
  timestamp: string;
}

export interface SendInvoiceResponse {
  referenceNumber: string;
  timestamp: string;
}

/* =========================
     OPTIONS
     ========================= */

export interface OpenSessionOptions {
  systemCode?: string;
  schemaVersion?: string;
  value?: string;
}

/* =========================
     STATUS (for polling)
     ========================= */

export interface SessionStatusInfo {
  code: number;
  description: string;
  details?: string[] | null;
  extensions?: Record<string, string | null> | null;
}

export interface SessionStatusResponse {
  status: SessionStatusInfo;
  dateCreated: string;
  dateUpdated: string;
  validUntil?: string | null;
  invoiceCount?: number | null;
  successfulInvoiceCount?: number | null;
  failedInvoiceCount?: number | null;
}

/* =========================
     TERMINAL STATUS CODES
     ========================= */

export const TERMINAL_SESSION_STATUS_CODES = new Set([
  200, 405, 415, 420, 430, 435, 440, 445, 500,
]);

export function isTerminalSessionStatus(code: number): boolean {
  return TERMINAL_SESSION_STATUS_CODES.has(code);
}

/* =========================
     CRYPTO DEPENDENCIES (injection)
     ========================= */

export interface PublicKeyCertificate {
  certificate: string;
  usage: string[];
  validFrom: string;
  validTo: string;
}

export interface PublicKeyCertificatesResponse {
  certificates?: PublicKeyCertificate[];
  publicKeys?: PublicKeyCertificate[];
  items?: PublicKeyCertificate[];
}

export interface EncryptionKeys {
  symmetricKey: Buffer;
  iv: Buffer;
  encryptedSymmetricKey: Buffer;
}

export interface EncryptedInvoice {
  encryptedContent: string;
  invoiceHash: string;
  invoiceSize: number;
  encryptedHash: string;
  encryptedSize: number;
}

/**
 * Interface dla operacji kryptograficznych AES/RSA
 * Implementacja musi być dostarczona z zewnątrz
 */
export interface SessionCryptoOperations {
  generateAesKey(): Buffer;
  generateIv(): Buffer;
  encryptSymmetricKey(symmetricKey: Buffer, publicKeyCertPem: string): Buffer;
  encryptInvoiceXml(
    xml: string,
    symmetricKey: Buffer,
    iv: Buffer
  ): {
    encrypted: Buffer;
    originalHash: string;
    originalSize: number;
    encryptedHash: string;
    encryptedSize: number;
  };
}
