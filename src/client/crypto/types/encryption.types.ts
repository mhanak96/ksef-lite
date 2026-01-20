export interface EncryptionKeys {
  symmetricKey: Buffer;
  iv: Buffer;
  encryptedSymmetricKey: Buffer;
}

export interface EncryptedInvoiceData {
  encrypted: Buffer;
  originalHash: string;
  originalSize: number;
  encryptedHash: string;
  encryptedSize: number;
}

export interface InvoiceEncryptionResult {
  encryptedContent: string;
  invoiceHash: string;
  invoiceSize: number;
  encryptedHash: string;
  encryptedSize: number;
}