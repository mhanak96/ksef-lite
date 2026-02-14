import { createHash } from "crypto";

import { debugLog, debugError } from '../../../utils/logger';
import { HttpClient, isHttpError } from "../../http.client";
import { KSefEnvironment, KSEF_QR_BASE_URLS } from "../../types";
import { generateKSefInvoiceQRCode } from "../qr";
import {
  InvoiceUpoResult,
  GetInvoiceUpoOptions,
  DownloadedInvoice,
  DownloadInvoiceOptions,
  GetInvoiceQRCodeOptions,
  InvoiceQRCodeResult,
  GetInvoicesQuery,
  GetInvoicesOptions,
  GetInvoicesResult,
  SortOrder,
  DateType,
  InvoiceMetadataApiResponse,
  SessionInvoicesListResponse,
} from "./types";

const DEFAULT_TIMEOUT_MS = 20_000;
const DEFAULT_POLLING_DELAY_MS = 3_000;
const MAX_PAGE_SIZE = 250;
const MIN_PAGE_SIZE = 10;
const MAX_DATE_RANGE_DAYS = 93;
const MAX_POLLING_ATTEMPTS = 40; // ✅ NOWE

export class InvoiceService {
  constructor(
    private readonly httpClient: HttpClient,
    private readonly apiHttpClient: HttpClient,
    private readonly environment: KSefEnvironment,
    private readonly getAccessToken: () => string | null
  ) {}

  /* =========================
     DOWNLOAD FAKTURY
     ========================= */

  async downloadInvoice(
    ksefNumber: string,
    options: DownloadInvoiceOptions = {}
  ): Promise<DownloadedInvoice> {
    this.ensureAuthenticated();

    const cleanKsefNumber = this.validateKsefNumber(ksefNumber);
    const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

    const url = `/invoices/ksef/${encodeURIComponent(cleanKsefNumber)}`;

    const { text, headers, status, statusText } = await this.fetchWithHeaders(
      this.apiHttpClient,
      url,
      {
        ...this.authHeaders(),
        Accept: "application/xml",
      },
      timeoutMs
    );

    if (status < 200 || status >= 300) {
      throw new Error(`Invoice download failed HTTP ${status}: ${text || statusText}`);
    }

    return {
      xml: text,
      sha256Base64: headers.get("x-ms-meta-hash") ?? undefined,
    };
  }

  /* =========================
     UPO FAKTURY
     ========================= */

  async getInvoiceUpo(
    sessionReferenceNumber: string,
    options: GetInvoiceUpoOptions = {}
  ): Promise<InvoiceUpoResult> {
    this.ensureAuthenticated();

    const cleanRef = this.validateSessionReference(sessionReferenceNumber);

    const pollingDelayMs = options.pollingDelayMs ?? DEFAULT_POLLING_DELAY_MS;
    const timeoutMs = options.timeoutMs ?? 60_000;
    const apiTimeoutMs = options.apiTimeoutMs ?? DEFAULT_TIMEOUT_MS;
    const downloadTimeoutMs = options.downloadTimeoutMs ?? DEFAULT_TIMEOUT_MS;

    return this.pollForInvoiceUpo(cleanRef, pollingDelayMs, timeoutMs, apiTimeoutMs, downloadTimeoutMs);
  }

  private async pollForInvoiceUpo(
    sessionReferenceNumber: string,
    pollingDelayMs: number,
    timeoutMs: number,
    apiTimeoutMs: number,
    downloadTimeoutMs: number
  ): Promise<InvoiceUpoResult> {
    const started = Date.now();
    let attempt = 0;

    while (Date.now() - started < timeoutMs && attempt < MAX_POLLING_ATTEMPTS) {
      attempt++;
      
      try {
        const invoice = await this.fetchSessionInvoice(sessionReferenceNumber, apiTimeoutMs);

        if (!invoice) {
          debugLog(`📄 [UPO Poll] Attempt ${attempt}: No invoice yet`);
          await this.sleep(pollingDelayMs);
          continue;
        }

  
        const invoiceStatus = invoice.status?.code;
        if (invoiceStatus && invoiceStatus >= 400) {
          throw new Error(
            `Invoice has error status: code=${invoiceStatus}, description=${invoice.status?.description}`
          );
        }

        if (invoice.upoDownloadUrl) {
          debugLog(`📄 [UPO Poll] Attempt ${attempt}: UPO URL found!`);
          const { xml, sha256Base64 } = await this.downloadUpoXml(invoice.upoDownloadUrl, downloadTimeoutMs);

          return {
            invoiceReferenceNumber: invoice.referenceNumber,
            ksefNumber: invoice.ksefNumber ?? null,
            upoDownloadUrlExpirationDate: invoice.upoDownloadUrlExpirationDate ?? null,
            xml,
            sha256Base64,
          };
        }

        debugLog(`📄 [UPO Poll] Attempt ${attempt}: Waiting for UPO URL...`);
        await this.sleep(pollingDelayMs);
      } catch (error: any) {

        if (error?.message?.includes('error status')) {
          throw error;
        }
        
        if (this.shouldRetryAfterError(error)) {
          await this.handleRetryableError(error, pollingDelayMs);
          continue;
        }
        throw error;
      }
    }

    throw new Error(`Timeout waiting for invoice UPO: session=${sessionReferenceNumber}, attempts=${attempt}`);
  }

  private async fetchSessionInvoice(sessionReferenceNumber: string, timeoutMs: number) {
    const response = await this.httpClient.get<SessionInvoicesListResponse>(
      `/sessions/${encodeURIComponent(sessionReferenceNumber)}/invoices?pageSize=10`,
      { headers: this.authHeaders(), timeoutMs }
    );

    return response.invoices?.[0] ?? null;
  }

  private async downloadUpoXml(
    downloadUrl: string,
    timeoutMs: number
  ): Promise<{ xml: string; sha256Base64?: string }> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(downloadUrl, {
        method: "GET",
        signal: controller.signal,
      });

      if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new Error(`UPO download failed HTTP ${response.status}: ${text || response.statusText}`);
      }

      return {
        xml: await response.text(),
        sha256Base64: response.headers.get("x-ms-meta-hash") ?? undefined,
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /* =========================
     QR CODE
     ========================= */


  async getInvoiceQRCode(
    ksefNumber: string,
    options: GetInvoiceQRCodeOptions = {}
  ): Promise<InvoiceQRCodeResult> {
    this.ensureAuthenticated();

    const cleanKsefNumber = this.validateKsefNumber(ksefNumber);

    const invoice = await this.downloadInvoice(cleanKsefNumber);

    const sellerNip = this.extractSellerNip(invoice.xml);
    const issueDateRaw = this.extractIssueDate(invoice.xml);
    const issueDateForQr = this.formatDateForQr(issueDateRaw);

    const invoiceHashBase64Url = invoice.sha256Base64
      ? this.normalizeToBase64Url(invoice.sha256Base64)
      : this.computeSha256Base64Url(invoice.xml);

    const qrBaseUrl = KSEF_QR_BASE_URLS[this.environment];
    const url = this.buildVerificationUrl(qrBaseUrl, sellerNip, issueDateForQr, invoiceHashBase64Url);

    const qrCode = await generateKSefInvoiceQRCode(url, {
      pixelsPerModule: options.pixelsPerModule,
      margin: options.margin,
      errorCorrectionLevel: options.errorCorrectionLevel,
    });

    const labelUsesKsefNumber = options.labelUsesKsefNumber !== false;
    const label = labelUsesKsefNumber ? cleanKsefNumber : "OFFLINE";

    return {
      url,
      qrPngBase64: qrCode.pngBase64, // ✅ Czysty base64 string
      ...(options.includeDataUrl ? { qrDataUrl: qrCode.dataUrl } : {}),
      label,
      meta: {
        sellerNip,
        issueDateRaw,
        issueDateForQr,
        invoiceHashBase64Url,
        qrBaseUrl,
      },
    };
  }

  /**
   * Generuje QR code z lokalnego XML faktury + ksefNumber (BEZ pobierania z API)
   * 
   * @param invoiceXml - XML faktury (lokalny)
   * @param ksefNumber - Numer KSeF faktury (z metadanych sesji)
   */
  async generateQRCodeFromXml(
    invoiceXml: string,
    ksefNumber: string,
    options: GetInvoiceQRCodeOptions = {}
  ): Promise<InvoiceQRCodeResult> {
    debugLog(`🔲 [QR Service] generateQRCodeFromXml START`);
    debugLog(`🔲 [QR Service] ksefNumber: "${ksefNumber}"`);
    debugLog(`🔲 [QR Service] invoiceXml length: ${invoiceXml?.length ?? 'null'}`);
    debugLog(`🔲 [QR Service] options: ${JSON.stringify(options)}`);

    // Walidacja
    if (!invoiceXml || typeof invoiceXml !== 'string') {
      debugError(`❌ [QR Service] Invalid invoiceXml!`);
      throw new Error('Invalid invoiceXml');
    }
    if (!ksefNumber || typeof ksefNumber !== 'string') {
      debugError(`❌ [QR Service] Invalid ksefNumber!`);
      throw new Error('Invalid ksefNumber');
    }

    try {
      // Wyciągnij dane z lokalnego XML
      debugLog(`🔲 [QR Service] Extracting seller NIP...`);
      const sellerNip = this.extractSellerNip(invoiceXml);
      debugLog(`🔲 [QR Service] Seller NIP: ${sellerNip}`);

      debugLog(`🔲 [QR Service] Extracting issue date...`);
      const issueDateRaw = this.extractIssueDate(invoiceXml);
      debugLog(`🔲 [QR Service] Issue date raw: ${issueDateRaw}`);

      const issueDateForQr = this.formatDateForQr(issueDateRaw);
      debugLog(`🔲 [QR Service] Issue date for QR: ${issueDateForQr}`);
      
      // Oblicz hash z lokalnego XML
      debugLog(`🔲 [QR Service] Computing SHA256 hash...`);
      const invoiceHashBase64Url = this.computeSha256Base64Url(invoiceXml);
      debugLog(`🔲 [QR Service] Hash: ${invoiceHashBase64Url}`);

      // Zbuduj URL weryfikacyjny
      const qrBaseUrl = KSEF_QR_BASE_URLS[this.environment];
      debugLog(`🔲 [QR Service] QR base URL: ${qrBaseUrl}`);

      const url = this.buildVerificationUrl(qrBaseUrl, sellerNip, issueDateForQr, invoiceHashBase64Url);
      debugLog(`🔲 [QR Service] Verification URL: ${url}`);

      // Wygeneruj QR code
      debugLog(`🔲 [QR Service] Generating QR code image...`);
      const qrCode = await generateKSefInvoiceQRCode(url, {
        pixelsPerModule: options.pixelsPerModule,
        margin: options.margin,
        errorCorrectionLevel: options.errorCorrectionLevel,
      });
      debugLog(`🔲 [QR Service] QR PNG base64 length: ${qrCode.pngBase64?.length ?? 0}`);
      debugLog(`🔲 [QR Service] QR dataUrl length: ${qrCode.dataUrl?.length ?? 0}`);

      const result: InvoiceQRCodeResult = {
        url,
        qrPngBase64: qrCode.pngBase64, // ✅ Czysty base64 string
        ...(options.includeDataUrl ? { qrDataUrl: qrCode.dataUrl } : {}),
        label: ksefNumber, // ✅ Prawdziwy ksefNumber
        meta: {
          sellerNip,
          issueDateRaw,
          issueDateForQr,
          invoiceHashBase64Url,
          qrBaseUrl,
        },
      };

      debugLog(`✅ [QR Service] generateQRCodeFromXml SUCCESS`);
      debugLog(`🔲 [QR Service] Result URL: ${result.url}`);
      debugLog(`🔲 [QR Service] Result label: ${result.label}`);
      
      return result;
    } catch (error) {
      debugError(`❌ [QR Service] generateQRCodeFromXml FAILED:`, error);
      throw error;
    }
  }

  /* =========================
     GET INVOICES (METADATA)
     ========================= */

  async getInvoices(
    query: GetInvoicesQuery,
    options: GetInvoicesOptions = {}
  ): Promise<GetInvoicesResult> {
    this.ensureAuthenticated();
    this.validateGetInvoicesQuery(query);

    const sortOrder: SortOrder = options.sortOrder ?? "Asc";
    const pageSize = this.clampPageSize(options.pageSize ?? MAX_PAGE_SIZE);
    const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const maxRequests = options.maxRequests ?? 2000;
    const dedupe = options.dedupe !== false;

    const workingQuery = this.prepareWorkingQuery(query);

    return this.fetchAllInvoiceMetadata(workingQuery, {
      sortOrder,
      pageSize,
      timeoutMs,
      maxRequests,
      dedupe,
    });
  }

  private async fetchAllInvoiceMetadata(
    query: GetInvoicesQuery,
    config: { sortOrder: SortOrder; pageSize: number; timeoutMs: number; maxRequests: number; dedupe: boolean }
  ): Promise<GetInvoicesResult> {
    const { sortOrder, pageSize, timeoutMs, maxRequests, dedupe } = config;
    const sortField = this.getSortFieldForDateType(query.dateRange.dateType);

    let pageOffset = 0;
    let requests = 0;
    let pages = 0;
    let windows = 0;
    let deduped = 0;
    let permanentStorageHwmDate: string | null = null;

    const results: Array<Record<string, unknown>> = [];
    const seenKsefNumbers = new Set<string>();

    while (requests < maxRequests) {
      let response: InvoiceMetadataApiResponse;

      try {
        requests++;
        response = await this.fetchMetadataPage(query, sortOrder, pageOffset, pageSize, timeoutMs);
        pages++;
      } catch (error) {
        if (isHttpError(error) && error.status === 429) {
          const retryAfter = error.retryAfterSec ?? 30;
          await this.sleep(retryAfter * 1000);
          continue;
        }
        throw error;
      }

      permanentStorageHwmDate = response.permanentStorageHwmDate ?? permanentStorageHwmDate;

      for (const invoice of response.invoices ?? []) {
        const ksefNumber = String(invoice.ksefNumber ?? "");

        if (dedupe && ksefNumber && seenKsefNumbers.has(ksefNumber)) {
          deduped++;
          continue;
        }

        if (ksefNumber) {
          seenKsefNumbers.add(ksefNumber);
        }

        results.push(invoice);
      }

      if (!response.hasMore) {
        break;
      }

      if (!response.isTruncated) {
        pageOffset++;
        continue;
      }

      // Window shift required (isTruncated = true)
      const lastInvoice = response.invoices?.[response.invoices.length - 1];
      if (!lastInvoice) {
        throw new Error("isTruncated=true but no invoices returned - cannot advance window");
      }

      query = this.shiftDateRangeWindow(query, lastInvoice, sortField, sortOrder);
      windows++;
      pageOffset = 0;
    }

    if (requests >= maxRequests) {
      throw new Error(`getInvoices exceeded maxRequests=${maxRequests}`);
    }

    return {
      invoices: results,
      permanentStorageHwmDate,
      stats: { requests, pages, windows, deduped },
      cursor: { sortOrder, pageSize, pageOffset, dateRange: { ...query.dateRange } },
    };
  }

  private async fetchMetadataPage(
    query: GetInvoicesQuery,
    sortOrder: SortOrder,
    pageOffset: number,
    pageSize: number,
    timeoutMs: number
  ): Promise<InvoiceMetadataApiResponse> {
    const path = `/invoices/query/metadata?sortOrder=${sortOrder}&pageOffset=${pageOffset}&pageSize=${pageSize}`;

    return this.apiHttpClient.post<InvoiceMetadataApiResponse>(path, query, {
      headers: this.authHeaders(),
      timeoutMs,
    });
  }

  /* =========================
     HELPERS - VALIDATION
     ========================= */

  private ensureAuthenticated(): void {
    if (!this.getAccessToken()) {
      throw new Error("Not authenticated");
    }
  }

  private validateKsefNumber(ksefNumber: string): string {
    const clean = String(ksefNumber ?? "").trim();
    if (!clean) {
      throw new Error("Missing ksefNumber");
    }
    return clean;
  }

  private validateSessionReference(ref: string): string {
    const clean = String(ref ?? "").trim();
    if (!clean) {
      throw new Error("Missing sessionReferenceNumber");
    }
    return clean;
  }

  private validateGetInvoicesQuery(query: GetInvoicesQuery): void {
    if (!query?.subjectType) {
      throw new Error("Missing query.subjectType");
    }
    if (!query.dateRange?.dateType || !query.dateRange?.from) {
      throw new Error("Missing query.dateRange.dateType or from");
    }
  }

  private validateDateRangeMax3Months(from: string, to: string): void {
    const fromDate = new Date(from);
    const toDate = new Date(to);

    if (!Number.isFinite(fromDate.getTime()) || !Number.isFinite(toDate.getTime())) {
      return;
    }

    const diffDays = Math.abs(toDate.getTime() - fromDate.getTime()) / (24 * 60 * 60 * 1000);

    if (diffDays > MAX_DATE_RANGE_DAYS) {
      throw new Error(`Invalid dateRange: max 3 months allowed (got ~${diffDays.toFixed(1)} days)`);
    }
  }

  /* =========================
     HELPERS - DATA EXTRACTION
     ========================= */

  private extractSellerNip(xml: string): string {
    const podmiot1Match = xml.match(/<Podmiot1[\s\S]*?<NIP>(\d{10})<\/NIP>/);
    if (podmiot1Match?.[1]) {
      return podmiot1Match[1];
    }

    const anyNipMatch = xml.match(/<NIP>(\d{10})<\/NIP>/);
    if (anyNipMatch?.[1]) {
      return anyNipMatch[1];
    }

    throw new Error("Cannot extract seller NIP from XML");
  }

  private extractIssueDate(xml: string): string {
    const match = xml.match(/<P_1>([^<]+)<\/P_1>/);
    const raw = match?.[1]?.trim();

    if (!raw) {
      throw new Error("Cannot extract issue date (P_1) from XML");
    }

    return raw;
  }

  /* =========================
     HELPERS - FORMATTING
     ========================= */

  private formatDateForQr(dateStr: string): string {
    const s = String(dateStr).trim();

    if (/^\d{2}-\d{2}-\d{4}$/.test(s)) {
      return s;
    }

    const isoDatePart = s.slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(isoDatePart)) {
      const [yyyy, mm, dd] = isoDatePart.split("-");
      return `${dd}-${mm}-${yyyy}`;
    }

    const date = new Date(s);
    if (Number.isFinite(date.getTime())) {
      const dd = String(date.getUTCDate()).padStart(2, "0");
      const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
      const yyyy = String(date.getUTCFullYear());
      return `${dd}-${mm}-${yyyy}`;
    }

    throw new Error(`Unsupported date format: "${s}"`);
  }

  private normalizeToBase64Url(hash: string): string {
    const v = String(hash).trim();

    if (!v) {
      throw new Error("Empty hash");
    }

    if (/^[A-Za-z0-9\-_]+$/.test(v)) {
      return v.replace(/=+$/g, "");
    }

    if (/^[A-Za-z0-9+/=]+$/.test(v)) {
      return v.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
    }

    if (/^[a-f0-9]{64}$/i.test(v)) {
      return Buffer.from(v, "hex")
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/g, "");
    }

    throw new Error("Unsupported hash format");
  }

  private computeSha256Base64Url(xml: string): string {
    try {
      return createHash("sha256").update(Buffer.from(xml, "utf8")).digest("base64url");
    } catch {
      const b64 = createHash("sha256").update(Buffer.from(xml, "utf8")).digest("base64");
      return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
    }
  }

  private buildVerificationUrl(
    qrBaseUrl: string,
    sellerNip: string,
    issueDateForQr: string,
    invoiceHashBase64Url: string
  ): string {
    return `${qrBaseUrl}/invoice/${encodeURIComponent(sellerNip)}/${encodeURIComponent(issueDateForQr)}/${encodeURIComponent(invoiceHashBase64Url)}`;
  }

  /* =========================
     HELPERS - PAGINATION
     ========================= */

  private clampPageSize(size: number): number {
    if (!Number.isFinite(size)) {
      return MAX_PAGE_SIZE;
    }
    return Math.min(MAX_PAGE_SIZE, Math.max(MIN_PAGE_SIZE, Math.floor(size)));
  }

  private getSortFieldForDateType(dateType: DateType): string {
    const mapping: Record<DateType, string> = {
      PermanentStorage: "permanentStorageDate",
      Invoicing: "invoicingDate",
      Issue: "issueDate",
    };
    return mapping[dateType] ?? "issueDate";
  }

  private prepareWorkingQuery(query: GetInvoicesQuery): GetInvoicesQuery {
    const workingQuery = {
      ...query,
      dateRange: { ...query.dateRange },
    };

    if (!workingQuery.dateRange.to) {
      workingQuery.dateRange.to = new Date().toISOString();
    }

    this.validateDateRangeMax3Months(workingQuery.dateRange.from, workingQuery.dateRange.to);

    return workingQuery;
  }

  private shiftDateRangeWindow(
    query: GetInvoicesQuery,
    lastInvoice: Record<string, unknown>,
    sortField: string,
    sortOrder: SortOrder
  ): GetInvoicesQuery {
    const lastDateRaw = lastInvoice[sortField];

    if (typeof lastDateRaw !== "string" || !lastDateRaw.trim()) {
      throw new Error(`Cannot shift window: missing ${sortField} in last invoice`);
    }

    const lastDate = lastDateRaw.trim();
    const newQuery = { ...query, dateRange: { ...query.dateRange } };

    if (sortOrder === "Asc") {
      const prevFrom = String(newQuery.dateRange.from);
      newQuery.dateRange.from = prevFrom === lastDate ? this.addMilliseconds(lastDate, 1) : lastDate;
    } else {
      const prevTo = String(newQuery.dateRange.to ?? "");
      newQuery.dateRange.to = prevTo === lastDate ? this.addMilliseconds(lastDate, -1) : lastDate;
    }

    this.validateDateRangeMax3Months(newQuery.dateRange.from, String(newQuery.dateRange.to));

    return newQuery;
  }

  private addMilliseconds(iso: string, delta: number): string {
    const date = new Date(iso);
    if (!Number.isFinite(date.getTime())) {
      return iso;
    }
    return new Date(date.getTime() + delta).toISOString();
  }

  /* =========================
     HELPERS - HTTP
     ========================= */

  private authHeaders(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.getAccessToken()}`,
      Accept: "application/json",
    };
  }

  private async fetchWithHeaders(
    client: HttpClient,
    path: string,
    headers: Record<string, string>,
    timeoutMs: number
  ): Promise<{ text: string; headers: Headers; status: number; statusText: string }> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const baseUrl = (client as any).baseUrl;
      const url = `${baseUrl}${path}`;

      const response = await fetch(url, {
        method: "GET",
        headers,
        signal: controller.signal,
      });

      return {
        text: await response.text(),
        headers: response.headers,
        status: response.status,
        statusText: response.statusText,
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /* =========================
     HELPERS - ERROR HANDLING
     ========================= */

  private shouldRetryAfterError(error: unknown): boolean {
    return isHttpError(error) && (error.status === 429 || error.status === 404);
  }

  private async handleRetryableError(error: unknown, defaultDelayMs: number): Promise<void> {
    if (isHttpError(error) && error.status === 429) {
      const waitSec = error.retryAfterSec ?? 30;
      await this.sleep(waitSec * 1000);
    } else {
      await this.sleep(Math.max(500, defaultDelayMs));
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}