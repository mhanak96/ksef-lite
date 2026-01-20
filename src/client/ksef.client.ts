import { createHash } from 'crypto';
import { HttpClient } from './http.client';
import {
  KSefCryptoOperations,
  AuthResult,
  SessionCryptoOperations,
  OpenSessionOptions,
  SessionStatusResponse,
} from './auth/session/types';
import { ksefCrypto } from './index';
import { AuthService, SessionManager } from './index';
import { InvoiceService } from './retrieval/invoice/invoice.service';
import {
  KSefClientConfig,
  KSefEnvironment,
  KSEF_SESSION_URLS,
  KSEF_API_URLS,
} from './types';
import {
  InvoiceUpoResult,
  GetInvoiceUpoOptions,
  GetInvoiceQRCodeOptions,
  InvoiceQRCodeResult,
  GetInvoicesQuery,
  GetInvoicesOptions,
  GetInvoicesResult,
  DownloadedInvoice,
  DownloadInvoiceOptions,
} from './retrieval/invoice/types';

/* =========================
   EXTENDED CONFIG (with optional crypto)
   ========================= */

export interface KSefClientConfigWithCrypto extends KSefClientConfig {
  crypto?: KSefCryptoOperations;
}

/* =========================
   SEND INVOICE OPTIONS & RESULT
   ========================= */

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

/* =========================
   ERROR STATUSES - do przerwania pętli
   ========================= */

const TERMINAL_ERROR_CODES = [
  400, // Bad request
  401, // Unauthorized  
  403, // Forbidden
  404, // Not found 
  409, // Conflict - DUPLIKAT FAKTURY!
  422, // Unprocessable entity
  500, // Server error
];

const SESSION_ERROR_DESCRIPTIONS = [
  'duplikat',
  'duplicate',
  'już istnieje',
  'already exists',
  'błąd walidacji',
  'validation error',
  'odrzucona',
  'rejected',
];

/* =========================
   KSEF CLIENT
   ========================= */

export class KSefClient {
  public readonly mode: KSefEnvironment;
  public readonly baseUrl: string;
  public readonly apiBaseUrl: string;
  public readonly contextNip: string;

  private readonly httpClient: HttpClient;
  private readonly apiHttpClient: HttpClient;
  private readonly authService: AuthService;
  private readonly invoiceService: InvoiceService;
  private readonly crypto: KSefCryptoOperations;

  private sessionManager: SessionManager | null = null;
  private accessToken: string | null = null;

  private readonly DEFAULTS = {
    PROCESSING_DELAY_MS: 3000,
    STATUS_TIMEOUT_MS: 120_000,
    UPO_TIMEOUT_MS: 60_000,
    UPO_API_TIMEOUT_MS: 20_000,
    UPO_DOWNLOAD_TIMEOUT_MS: 20_000,
    QR_API_TIMEOUT_MS: 20_000,
    MAX_POLLING_ATTEMPTS: 8,
  };

  constructor(config: KSefClientConfigWithCrypto) {
    this.validateConfig(config);

    this.mode = config.mode ?? 'production';
    this.baseUrl = KSEF_API_URLS[this.mode];
    this.apiBaseUrl = KSEF_API_URLS[this.mode];
    this.contextNip = config.contextNip;
    this.crypto = config.crypto ?? ksefCrypto;

    this.httpClient = new HttpClient(this.baseUrl, config.debug ?? false);
    this.apiHttpClient = new HttpClient(this.apiBaseUrl, config.debug ?? false);

    this.authService = new AuthService(
      this.httpClient,
      {
        certificate: config.certificate,
        privateKey: config.privateKey,
        contextNip: config.contextNip,
        subjectIdentifierType:
          config.subjectIdentifierType ?? 'certificateSubject',
      },
      this.crypto
    );

    this.invoiceService = new InvoiceService(
      this.httpClient,
      this.apiHttpClient,
      this.mode,
      () => this.accessToken
    );

    console.log(`🔧 KSefClient initialized: mode=${this.mode}`);
  }

  /* =========================
     PUBLIC API - INVOICE OPERATIONS
     ========================= */

  async generateQRCodeFromXml(
    invoiceXml: string,
    ksefNumber: string,
    options: GetInvoiceQRCodeOptions = {}
  ): Promise<InvoiceQRCodeResult> {
    console.log(`🔲 [QR] generateQRCodeFromXml called`);
    console.log(`🔲 [QR] ksefNumber: ${ksefNumber}`);
    
    try {
      const result = await this.invoiceService.generateQRCodeFromXml(invoiceXml, ksefNumber, options);
      console.log(`✅ [QR] Generated successfully`);
      console.log(`🔲 [QR] URL: ${result.url}`);
      console.log(`🔲 [QR] PNG base64 length: ${result.qrPngBase64?.length ?? 0}`);
      return result;
    } catch (error) {
      console.error(`❌ [QR] Generation FAILED:`, error);
      throw error;
    }
  }

  async getInvoiceQRCode(
    ksefNumber: string,
    options?: GetInvoiceQRCodeOptions
  ): Promise<InvoiceQRCodeResult> {
    await this.ensureAuthenticated();
    return this.invoiceService.getInvoiceQRCode(ksefNumber, options);
  }

/**
 * Wysyła fakturę do KSeF
 */
async sendInvoice(
  invoiceXml: string,
  options: SendInvoiceOptions = {}
): Promise<SendInvoiceResult> {
  const { upo = false, qr = false } = options;
  
  console.log(`📤 [sendInvoice] Starting...`);
  console.log(`📤 [sendInvoice] Options: upo=${upo}, qr=${qr}`);

  await this.ensureAuthenticated();

  // Otwórz sesję
  const openResponse = await this.openSession();
  const sessionReferenceNumber = openResponse.referenceNumber;
  console.log(`📤 [sendInvoice] Session opened: ${sessionReferenceNumber}`);

  let invoiceReferenceNumber: string = '';
  let invoiceHash: string = '';
  let invoiceSize: number = 0;
  let errorMessage: string | null = null;
  let statusCode: number = 200;

  try {
    // Wyślij fakturę
    const invoiceResponse = await this.sessionManager!.sendInvoiceToSession(
      invoiceXml,
      false
    );
    invoiceReferenceNumber = invoiceResponse.referenceNumber;
    invoiceHash = invoiceResponse.invoiceHash;
    invoiceSize = invoiceResponse.invoiceSize;
    console.log(`📤 [sendInvoice] Invoice sent: ${invoiceReferenceNumber}`);

    // Zamknij sesję
    await this.safeCloseSession();

  } catch (error: any) {
    console.error(`❌ [sendInvoice] Error during send/close:`, error);
    await this.emergencyCloseSession();
    // Nie rzucamy - kontynuujemy żeby zebrać dane
    errorMessage = error?.message ?? String(error);
    statusCode = 500;
  }

  // ✅ Poll status sesji (nawet przy błędzie wysyłki)
  let sessionStatus: SessionStatusResponse | null = null;
  try {
    sessionStatus = await this.pollSessionStatusWithErrorHandling(sessionReferenceNumber);
    
    console.log(`📤 [sendInvoice] Session status code: ${sessionStatus.status?.code}`);
    console.log(`📤 [sendInvoice] Session status desc: ${sessionStatus.status?.description}`);

    // Ustaw kod błędu z sesji jeśli jest
    if (sessionStatus.status?.code && sessionStatus.status.code >= 400) {
      statusCode = sessionStatus.status.code;
      errorMessage = sessionStatus.status.description ?? `Error code: ${statusCode}`;
    }
  } catch (error: any) {
    console.error(`❌ [sendInvoice] Error polling session:`, error);
    if (!errorMessage) {
      errorMessage = error?.message ?? String(error);
      statusCode = 500;
    }
  }

  // ✅ Pobierz metadata (nawet przy błędzie)
  let ksefNumber: string | null = null;
  try {
    const invoiceMetadata = await this.fetchInvoiceMetadataWithErrorHandling(sessionReferenceNumber);
    ksefNumber = invoiceMetadata?.ksefNumber || null;
    console.log(`📤 [sendInvoice] ksefNumber: ${ksefNumber}`);
  } catch (error: any) {
    console.error(`❌ [sendInvoice] Error fetching metadata:`, error);
    // Nie nadpisujemy statusCode - metadata to tylko dodatkowe info
  }

  // ✅ ZAWSZE wyciągamy dane z XML dla meta
  let sellerNip = '';
  let issueDate = '';
  let invoiceHashBase64Url = '';
  let qrVerificationUrl = '';
  
  try {
    sellerNip = this.extractSellerNip(invoiceXml);
    issueDate = this.extractIssueDate(invoiceXml);
    invoiceHashBase64Url = this.computeSha256Base64Url(invoiceXml);
    const qrBaseUrl = this.mode === 'production' 
      ? 'https://qr.ksef.mf.gov.pl' 
      : 'https://qr-test.ksef.mf.gov.pl';
    const issueDateForQr = this.formatDateForQr(issueDate);
    qrVerificationUrl = `${qrBaseUrl}/invoice/${sellerNip}/${issueDateForQr}/${invoiceHashBase64Url}`;
  } catch (error: any) {
    console.error(`❌ [sendInvoice] Error extracting XML data:`, error);
  }

  // UPO - tylko jeśli sukces i mamy ksefNumber
  let invoiceUpo: InvoiceUpoResult | undefined;
  if (upo && statusCode < 400 && ksefNumber) {
    console.log(`📄 [UPO] Fetching UPO...`);
    try {
      invoiceUpo = await this.invoiceService.getInvoiceUpo(sessionReferenceNumber, {
        pollingDelayMs: this.DEFAULTS.PROCESSING_DELAY_MS,
        timeoutMs: this.DEFAULTS.UPO_TIMEOUT_MS,
        apiTimeoutMs: this.DEFAULTS.UPO_API_TIMEOUT_MS,
        downloadTimeoutMs: this.DEFAULTS.UPO_DOWNLOAD_TIMEOUT_MS,
      });
      console.log(`✅ [UPO] Fetched successfully`);
    } catch (error) {
      console.error(`❌ [UPO] Failed:`, error);
    }
  }

  // QR - tylko jeśli sukces i mamy ksefNumber
  let qrPngBase64: string | undefined;
  if (qr && statusCode < 400 && ksefNumber) {
    console.log(`🔲 [QR] Generating QR code...`);
    try {
      const invoiceQrCode = await this.invoiceService.generateQRCodeFromXml(
        invoiceXml,
        ksefNumber,
        { apiTimeoutMs: this.DEFAULTS.QR_API_TIMEOUT_MS }
      );
      qrPngBase64 = invoiceQrCode.qrPngBase64;
      console.log(`✅ [QR] Generated successfully!`);
    } catch (error) {
      console.error(`❌ [QR] Generation FAILED:`, error);
    }
  }

  const result: SendInvoiceResult = {
    // Status i ewentualny błąd
    status: statusCode,
    ...(errorMessage ? { error: errorMessage } : {}),
    
    // Numer KSeF (null jeśli błąd)
    invoiceKsefNumber: ksefNumber,
    
    // Referencje - zawsze dostępne
    invoiceReferenceNumber,
    sessionReferenceNumber,
    
    // Dane faktury
    invoiceHash,
    invoiceSize,
    
    // Meta - zawsze obecne (jeśli udało się wyciągnąć z XML)
    meta: {
      sellerNip,
      issueDate,
      invoiceHashBase64Url,
      qrVerificationUrl,
    },
    
    // Opcjonalne - tylko przy sukcesie
    ...(invoiceUpo ? { 
      upo: {
        xml: invoiceUpo.xml,
        sha256Base64: invoiceUpo.sha256Base64,
      }
    } : {}),
    
    ...(qrPngBase64 ? { 
      qrCode: {
        pngBase64: qrPngBase64,
        label: ksefNumber!,
      }
    } : {}),
  };

  console.log(`${statusCode < 400 ? '✅' : '❌'} [sendInvoice] Complete!`);
  console.log(`📤 [sendInvoice] status: ${result.status}`);
  console.log(`📤 [sendInvoice] error: ${errorMessage ?? 'none'}`);
  console.log(`📤 [sendInvoice] invoiceKsefNumber: ${result.invoiceKsefNumber}`);
  
  return result;
}

  /* =========================
     PRIVATE - ERROR HANDLING
     ========================= */


  private checkForSessionError(status: SessionStatusResponse): void {
    const code = status.status?.code;
    const description = status.status?.description?.toLowerCase() ?? '';

 
    if (code && code >= 400) {
      throw new Error(
        `Session error: code=${code}, description=${status.status?.description}`
      );
    }

    for (const errorPhrase of SESSION_ERROR_DESCRIPTIONS) {
      if (description.includes(errorPhrase.toLowerCase())) {
        throw new Error(
          `Session error detected: "${status.status?.description}"`
        );
      }
    }

    // Sprawdź czy są nieudane faktury
    const totalCount = status.invoiceCount ?? 0;
    const successCount = status.successfulInvoiceCount ?? 0;
    
    if (totalCount > 0 && successCount === 0) {
      throw new Error(
        `All invoices failed: ${totalCount} sent, 0 successful. Status: ${status.status?.description}`
      );
    }
  }


  private async pollSessionStatusWithErrorHandling(
    sessionReferenceNumber: string
  ): Promise<SessionStatusResponse> {
    const maxAttempts = this.DEFAULTS.MAX_POLLING_ATTEMPTS;
    const delayMs = this.DEFAULTS.PROCESSING_DELAY_MS;
    
    console.log(`⏳ [Poll] Starting session status polling (max ${maxAttempts} attempts)...`);

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const response = await this.httpClient.get<SessionStatusResponse>(
          `/sessions/${encodeURIComponent(sessionReferenceNumber)}`,
          {
            headers: {
              Authorization: `Bearer ${this.accessToken}`,
              Accept: 'application/json',
            },
          }
        );

        const code = response.status?.code;
        const desc = response.status?.description ?? '';
        
        console.log(`⏳ [Poll] Attempt ${attempt}/${maxAttempts}: code=${code}, desc="${desc}"`);

 
        if (code && code >= 400) {
          console.error(`❌ [Poll] Error status detected! Stopping.`);
          return response;
        }

        if (this.isTerminalStatus(response)) {
          console.log(`✅ [Poll] Terminal status reached`);
          return response;
        }


        await this.sleep(delayMs);
      } catch (error: any) {
        console.error(`❌ [Poll] Attempt ${attempt} failed:`, error?.message ?? error);
        
        if (error?.status && error.status >= 400) {
          throw new Error(`Session polling failed with HTTP ${error.status}: ${error.message}`);
        }
        
        if (attempt === maxAttempts) {
          throw error;
        }
        
        await this.sleep(delayMs);
      }
    }

    throw new Error(
      `Session status polling exceeded max attempts (${maxAttempts}). Session may be stuck.`
    );
  }

  private isTerminalStatus(status: SessionStatusResponse): boolean {
    const code = status.status?.code;
    
    // Sukces
    if (code === 200) return true;
    
    // Błędy są też terminalne
    if (code && code >= 400) return true;
    
    // Sprawdź czy są przetworzone faktury
    const hasProcessedInvoices = 
      (status.invoiceCount ?? 0) > 0 && 
      (status.successfulInvoiceCount ?? 0) > 0;
    
    if (hasProcessedInvoices) return true;
    

    const desc = status.status?.description?.toLowerCase() ?? '';
    const terminalPhrases = [
      'zakończon', 
      'przetworzon', 
      'completed',
      'finished',
      'success',
      'error',
      'failed',
      'odrzucon', 
      'rejected',
    ];
    
    for (const phrase of terminalPhrases) {
      if (desc.includes(phrase)) return true;
    }
    
    return false;
  }


  private async fetchInvoiceMetadataWithErrorHandling(
    sessionReferenceNumber: string
  ): Promise<any> {
    const maxAttempts = this.DEFAULTS.MAX_POLLING_ATTEMPTS;
    const delayMs = this.DEFAULTS.PROCESSING_DELAY_MS;
    
    console.log(`📋 [Metadata] Fetching invoice metadata (max ${maxAttempts} attempts)...`);

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const response = await this.httpClient.get<any>(
          `/sessions/${encodeURIComponent(sessionReferenceNumber)}/invoices?pageSize=10`,
          {
            headers: {
              Authorization: `Bearer ${this.accessToken}`,
              Accept: 'application/json',
            },
          }
        );

        const invoice = response.invoices?.[0];
        
        console.log(`📋 [Metadata] Attempt ${attempt}/${maxAttempts}`);
        console.log(`📋 [Metadata] Invoices count: ${response.invoices?.length ?? 0}`);
        
        if (invoice) {
          console.log(`📋 [Metadata] Invoice referenceNumber: ${invoice.referenceNumber}`);
          console.log(`📋 [Metadata] Invoice ksefNumber: ${invoice.ksefNumber}`);
          console.log(`📋 [Metadata] Invoice status: ${JSON.stringify(invoice.status)}`);
          
         
          const invoiceStatus = invoice.status?.code;
          if (invoiceStatus && invoiceStatus >= 400) {
            throw new Error(
              `Invoice error: code=${invoiceStatus}, description=${invoice.status?.description}`
            );
          }
          
       
          if (invoice.ksefNumber) {
            console.log(`✅ [Metadata] Got ksefNumber: ${invoice.ksefNumber}`);
            return invoice;
          }
        }

        await this.sleep(delayMs);
      } catch (error: any) {
        console.error(`❌ [Metadata] Attempt ${attempt} failed:`, error?.message ?? error);
        
        // ✅ Jeśli to błąd faktury - przerwij
        if (error?.message?.includes('Invoice error')) {
          throw error;
        }
        
        if (attempt === maxAttempts) {
          console.warn(`⚠️ [Metadata] Max attempts reached, returning null`);
          return null;
        }
        
        await this.sleep(delayMs);
      }
    }

    console.warn(`⚠️ [Metadata] Could not fetch ksefNumber after ${maxAttempts} attempts`);
    return null;
  }

  /* =========================
     EXISTING METHODS (unchanged)
     ========================= */

  async downloadInvoice(
    ksefNumber: string,
    options?: DownloadInvoiceOptions
  ): Promise<DownloadedInvoice> {
    await this.ensureAuthenticated();
    return this.invoiceService.downloadInvoice(ksefNumber, options);
  }

  async getInvoiceUpo(
    sessionReferenceNumber: string,
    options?: GetInvoiceUpoOptions
  ): Promise<InvoiceUpoResult> {
    await this.ensureAuthenticated();
    return this.invoiceService.getInvoiceUpo(sessionReferenceNumber, options);
  }

  async getInvoices(
    query: GetInvoicesQuery,
    options?: GetInvoicesOptions
  ): Promise<GetInvoicesResult> {
    await this.ensureAuthenticated();
    return this.invoiceService.getInvoices(query, options);
  }

  setDebug(debug: boolean): void {
    this.httpClient.setDebug(debug);
    this.apiHttpClient.setDebug(debug);
  }

  getConfig() {
    return {
      mode: this.mode,
      baseUrl: this.baseUrl,
      apiBaseUrl: this.apiBaseUrl,
      contextNip: this.contextNip,
    };
  }

  isAuthenticated(): boolean {
    return this.accessToken !== null;
  }

  /* =========================
     PRIVATE - AUTHENTICATION
     ========================= */

  private async authenticate(): Promise<AuthResult> {
    const result = await this.authService.authenticate();

    this.accessToken = result.accessToken;
    this.sessionManager = new SessionManager(
      this.httpClient,
      this.accessToken,
      this.toSessionCrypto()
    );

    return result;
  }

  private async ensureAuthenticated(): Promise<void> {
    if (!this.accessToken) {
      await this.authenticate();
    }
  }

  /* =========================
     PRIVATE - SESSION (old method kept for reference)
     ========================= */

  /**
   * @deprecated Use pollSessionStatusWithErrorHandling instead
   */
  private async fetchInvoiceMetadata(
    sessionReferenceNumber: string,
    pollingDelayMs: number,
    timeoutMs: number
  ): Promise<any> {
  
    return this.fetchInvoiceMetadataWithErrorHandling(sessionReferenceNumber);
  }

  private async openSession(options?: OpenSessionOptions) {
    this.ensureSessionManager();
    return this.sessionManager!.openSession(options);
  }

  private async closeSession(): Promise<void> {
    this.ensureSessionManager();
    return this.sessionManager!.closeSession();
  }

  private ensureSessionManager(): void {
    if (!this.accessToken) {
      throw new Error('Not authenticated');
    }
    if (!this.sessionManager) {
      this.sessionManager = new SessionManager(
        this.httpClient,
        this.accessToken,
        this.toSessionCrypto()
      );
    }
  }

  private async safeCloseSession(): Promise<void> {
    try {
      await this.closeSession();
    } catch (error) {
      console.warn('⚠️ Failed to close session (non-critical):', error);
    }
  }

  private async emergencyCloseSession(): Promise<void> {
    if (this.sessionManager?.isSessionActive()) {
      try {
        await this.closeSession();
      } catch {

      }
    }
  }

  /* =========================
     PRIVATE - CRYPTO ADAPTERS
     ========================= */

  private toSessionCrypto(): SessionCryptoOperations {
    return {
      generateAesKey: this.crypto.generateAesKey.bind(this.crypto),
      generateIv: this.crypto.generateIv.bind(this.crypto),
      encryptSymmetricKey: this.crypto.encryptSymmetricKey.bind(this.crypto),
      encryptInvoiceXml: this.crypto.encryptInvoiceXml.bind(this.crypto),
    };
  }

  /* =========================
     PRIVATE - VALIDATION
     ========================= */

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /* =========================
     PRIVATE - XML DATA EXTRACTION
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
   
    const isoDatePart = raw.slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(isoDatePart)) {
      return isoDatePart;
    }
    return raw;
  }

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
    throw new Error(`Unsupported date format: "${s}"`);
  }

  private computeSha256Base64Url(xml: string): string {
    try {
      return createHash("sha256").update(Buffer.from(xml, "utf8")).digest("base64url");
    } catch {
      const b64 = createHash("sha256").update(Buffer.from(xml, "utf8")).digest("base64");
      return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
    }
  }

  private validateConfig(config: KSefClientConfigWithCrypto): void {
    if (!config) {
      throw new Error('Missing config');
    }
    if (!config.contextNip) {
      throw new Error('Missing required config: contextNip');
    }
    if (!config.certificate) {
      throw new Error('Missing required config: certificate (PEM format)');
    }
    if (!config.privateKey) {
      throw new Error('Missing required config: privateKey (PEM format)');
    }
    if (!/^\d{10}$/.test(config.contextNip)) {
      throw new Error('Invalid contextNip format. Expected 10 digits.');
    }
    if (!config.certificate.includes('BEGIN CERTIFICATE')) {
      throw new Error('Invalid certificate format. Expected PEM format.');
    }
    if (
      !config.privateKey.includes('BEGIN') ||
      !config.privateKey.includes('PRIVATE KEY')
    ) {
      throw new Error('Invalid privateKey format. Expected PEM format.');
    }
  }
}