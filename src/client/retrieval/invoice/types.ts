/* =========================
   DOWNLOAD INVOICE
   ========================= */

export interface DownloadInvoiceOptions {
  timeoutMs?: number;
}

export interface DownloadedInvoice {
  xml: string;
  sha256Base64?: string;
}

/* =========================
     UPO (Potwierdzenie Odbioru)
     ========================= */

export interface GetInvoiceUpoOptions {
  pollingDelayMs?: number;
  timeoutMs?: number;
  apiTimeoutMs?: number;
  downloadTimeoutMs?: number;
}

export interface InvoiceUpoResult {
  invoiceReferenceNumber: string;
  ksefNumber: string | null;
  upoDownloadUrlExpirationDate: string | null;
  xml: string;
  sha256Base64?: string;
}

/* =========================
     QR CODE
     ========================= */

export interface GetInvoiceQRCodeOptions {
  pixelsPerModule?: number;
  margin?: number;
  errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H';
  includeDataUrl?: boolean;
  labelUsesKsefNumber?: boolean;
  apiTimeoutMs?: number;
}

export interface InvoiceQRCodeResult {
  /** Verification URL encoded in QR */
  url: string;

  /** ✅ PNG image as base64 string (without data URL prefix) */
  qrPngBase64: string;

  /** Full data URL ready for <img src="..."> - only if includeDataUrl=true */
  qrDataUrl?: string;

  /** Label for the QR code (ksefNumber or "OFFLINE") */
  label: string;

  /** Metadata used to generate the QR */
  meta: {
    sellerNip: string;
    issueDateRaw: string;
    issueDateForQr: string;
    invoiceHashBase64Url: string;
    qrBaseUrl: string;
  };
}

/* =========================
     GET INVOICES (METADATA QUERY)
     ========================= */

export type SubjectType =
  | 'Subject1'
  | 'Subject2'
  | 'Subject3'
  | 'SubjectAuthorized';
export type DateType = 'PermanentStorage' | 'Invoicing' | 'Issue';
export type SortOrder = 'Asc' | 'Desc';

export interface DateRange {
  dateType: DateType;
  from: string;
  to?: string;
}

export interface GetInvoicesQuery {
  subjectType: SubjectType;
  dateRange: DateRange;
  invoiceNumber?: string;
  ksefNumber?: string;
  counterpartyNip?: string;
}

export interface GetInvoicesOptions {
  sortOrder?: SortOrder;
  pageSize?: number;
  timeoutMs?: number;
  maxRequests?: number;
  dedupe?: boolean;
}

export interface GetInvoicesResult {
  invoices: Array<Record<string, unknown>>;
  permanentStorageHwmDate: string | null;
  stats: {
    requests: number;
    pages: number;
    windows: number;
    deduped: number;
  };
  cursor: {
    sortOrder: SortOrder;
    pageSize: number;
    pageOffset: number;
    dateRange: DateRange;
  };
}

export type InvoiceDateRange = DateRange;

/* =========================
     API RESPONSE TYPES
     ========================= */

export interface InvoiceMetadataApiResponse {
  invoices?: Array<Record<string, unknown>>;
  hasMore?: boolean;
  isTruncated?: boolean;
  permanentStorageHwmDate?: string;
}

export interface SessionInvoicesListResponse {
  invoices?: Array<{
    referenceNumber: string; // ✅ REQUIRED
    ksefNumber?: string;
    upoDownloadUrl?: string;
    upoDownloadUrlExpirationDate?: string;
    status?: {
      code?: number;
      description?: string;
    };
    [key: string]: unknown;
  }> | null;
}
