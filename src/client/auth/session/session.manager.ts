import { debugLog } from '../../../utils/logger';
import { HttpClient, isHttpError } from "../../http.client";
import { EncryptionService } from "./encryption.service";
import {
  SessionState,
  SessionFormCode,
  OpenSessionRequest,
  OpenSessionResponse,
  InvoicePayload,
  SendInvoiceResponse,
  OpenSessionOptions,
  SessionStatusResponse,
  SessionCryptoOperations,
  PublicKeyCertificatesResponse,
  isTerminalSessionStatus,
} from "./types";

const DEFAULT_FORM_CODE: SessionFormCode = {
  systemCode: "FA (3)",
  schemaVersion: "1-0E",
  value: "FA",
};

export class SessionManager {
  private state: SessionState = {
    referenceNumber: null,
    symmetricKey: null,
    iv: null,
    isActive: false,
  };

  private readonly encryptionService: EncryptionService;

  constructor(
    private readonly httpClient: HttpClient,
    private accessToken: string,
    crypto: SessionCryptoOperations
  ) {
    this.encryptionService = new EncryptionService(crypto);
  }

  updateAccessToken(token: string): void {
    this.accessToken = token;
  }

  async openSession(options: OpenSessionOptions = {}): Promise<OpenSessionResponse> {
    if (!this.accessToken) {
      throw new Error("Not authenticated. Access token required.");
    }

    if (this.state.isActive) {
      debugLog("⚠️  Session already active:", this.state.referenceNumber);
      return {
        referenceNumber: this.state.referenceNumber!,
        timestamp: new Date().toISOString(),
      };
    }

    debugLog("🔓 Opening session...");

    const certificatesResponse = await this.getPublicCertificates();

    const keys = this.encryptionService.prepareSessionEncryption(certificatesResponse);

    this.state.symmetricKey = keys.symmetricKey;
    this.state.iv = keys.iv;

    const formCode: SessionFormCode = {
      systemCode: options.systemCode ?? DEFAULT_FORM_CODE.systemCode,
      schemaVersion: options.schemaVersion ?? DEFAULT_FORM_CODE.schemaVersion,
      value: options.value ?? DEFAULT_FORM_CODE.value,
    };

    const encryption = this.encryptionService.createSessionEncryptionPayload(keys);

    const requestBody: OpenSessionRequest = {
      formCode,
      encryption,
    };

    const response = await this.httpClient.post<OpenSessionResponse>("/sessions/online", requestBody, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.accessToken}`,
      },
    });

    if (!response.referenceNumber) {
      throw new Error("Missing session referenceNumber in response");
    }

    this.state.referenceNumber = response.referenceNumber;
    this.state.isActive = true;

    debugLog("✅ Session opened:", response.referenceNumber);

    return response;
  }

  async sendInvoiceToSession(
    invoiceXml: string,
    offlineMode = false
  ): Promise<SendInvoiceResponse & { invoiceHash: string; invoiceSize: number }> {
    if (!this.state.isActive || !this.state.referenceNumber) {
      throw new Error("No active session. Call openSession() first.");
    }

    if (!this.state.symmetricKey || !this.state.iv) {
      throw new Error("Encryption keys not initialized");
    }

    debugLog("📤 Sending invoice...");

    const encrypted = this.encryptionService.encryptInvoice(
      invoiceXml,
      this.state.symmetricKey,
      this.state.iv
    );

    const payload: InvoicePayload = {
      invoiceHash: encrypted.invoiceHash,
      invoiceSize: encrypted.invoiceSize,
      encryptedInvoiceHash: encrypted.encryptedHash,
      encryptedInvoiceSize: encrypted.encryptedSize,
      encryptedInvoiceContent: encrypted.encryptedContent,
      offlineMode,
    };

    const response = await this.httpClient.post<SendInvoiceResponse>(
      `/sessions/online/${encodeURIComponent(this.state.referenceNumber)}/invoices`,
      payload,
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.accessToken}`,
        },
      }
    );

    if (!response.referenceNumber) {
      throw new Error("Missing invoice referenceNumber in response");
    }

    debugLog("✅ Invoice sent:", response.referenceNumber);

    return {
      ...response,
      invoiceHash: encrypted.invoiceHash,
      invoiceSize: encrypted.invoiceSize,
    };
  }

  async closeSession(): Promise<void> {
    if (!this.state.isActive || !this.state.referenceNumber) {
      throw new Error("No active session to close");
    }

    debugLog("🔒 Closing session...");

    await this.httpClient.post(
      `/sessions/online/${encodeURIComponent(this.state.referenceNumber)}/close`,
      undefined,
      {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
      }
    );

    this.state.isActive = false;
    this.state.symmetricKey = null;
    this.state.iv = null;
  
    debugLog("✅ Session closed:", this.state.referenceNumber);
  }

  async getStatus(): Promise<SessionStatusResponse> {
    if (!this.state.referenceNumber) {
      throw new Error("No session reference number");
    }

    return this.httpClient.get<SessionStatusResponse>(
      `/sessions/${encodeURIComponent(this.state.referenceNumber)}`,
      {
        headers: this.authHeaders(),
        timeoutMs: 20_000,
      }
    );
  }

  async pollUntilTerminal(intervalMs: number, timeoutMs: number): Promise<SessionStatusResponse> {
    const started = Date.now();
    let lastStatus: SessionStatusResponse | null = null;

    while (Date.now() - started < timeoutMs) {
      try {
        lastStatus = await this.getStatus();

        if (isTerminalSessionStatus(lastStatus.status.code)) {
          return lastStatus;
        }

        await this.sleep(intervalMs);
      } catch (error) {
        if (isHttpError(error) && error.status === 429) {
          const waitSec = error.retryAfterSec ?? 30;
          await this.sleep(waitSec * 1000);
          continue;
        }

        if (isHttpError(error) && error.status === 404) {
          await this.sleep(Math.max(500, intervalMs));
          continue;
        }

        throw error;
      }
    }

    if (lastStatus) {
      return lastStatus;
    }

    throw new Error(`Timeout waiting for session terminal status: ${this.state.referenceNumber}`);
  }

  isSessionActive(): boolean {
    return this.state.isActive;
  }

  getSessionReference(): string | null {
    return this.state.referenceNumber;
  }

  forceCloseSession(): void {
    this.resetState();
    debugLog("⚠️  Session force closed (no API call)");
  }

  private async getPublicCertificates(): Promise<PublicKeyCertificatesResponse> {
    debugLog("🔐 Fetching public certificates...");

    const response = await this.httpClient.get<PublicKeyCertificatesResponse>("/security/public-key-certificates");

    debugLog("📋 Full certificates response:", JSON.stringify(response, null, 2));

    return response;
  }

  private authHeaders(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.accessToken}`,
      Accept: "application/json",
    };
  }

  private resetState(): void {
    this.state = {
      referenceNumber: null,
      symmetricKey: null,
      iv: null,
      isActive: false,
    };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}