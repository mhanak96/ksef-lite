import type { KSefClientConfig } from './config.types';
import type { KSefCryptoOperations } from '../auth/types';

export interface KSefClientConfigWithCrypto extends KSefClientConfig {
  crypto?: KSefCryptoOperations;
}

export interface SendInvoiceOptions {
  upo?: boolean;
  qr?: boolean;
}

export interface SendInvoiceResult {
  // Status
  status: number; // 200 = sukces, 4xx/5xx = błąd
  error?: string; // Opis błędu (tylko przy błędzie)

  // Numer KSeF (null jeśli błąd)
  invoiceKsefNumber: string | null;

  // Referencje - zawsze dostępne
  invoiceReferenceNumber: string;
  sessionReferenceNumber: string;

  // Dane faktury
  invoiceHash: string;
  invoiceSize: number;

  // Meta
  meta: {
    sellerNip: string;
    issueDate: string;
    invoiceHashBase64Url: string;
    qrVerificationUrl: string;
  };

  // Opcjonalne (tylko przy sukcesie)
  upo?: { xml: string; sha256Base64?: string; };
  qrCode?: { pngBase64: string; label: string; };
}
