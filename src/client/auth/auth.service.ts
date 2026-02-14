import { debugLog, debugWarn, debugError } from '../../utils/logger';
import { HttpClient } from "../http.client";
import { ChallengeService } from "./challenge.service";
import {
  AuthServiceConfig,
  AuthCryptoOperations,
  AuthStartResponse,
  AuthStatusResponse,
  TokenRedeemResponse,
  AuthResult,
  WaitForAuthOptions,
} from "./types";

const DEFAULT_MAX_WAIT_MS = 30_000;
const DEFAULT_POLL_INTERVAL_MS = 1_200;

export class AuthService {
  private readonly httpClient: HttpClient;
  private readonly challengeService: ChallengeService;
  private readonly crypto: AuthCryptoOperations;
  private config: AuthServiceConfig;

  constructor(
    httpClient: HttpClient,
    config: AuthServiceConfig,
    crypto: AuthCryptoOperations
  ) {
    this.httpClient = httpClient;
    this.config = config;
    this.crypto = crypto;
    this.challengeService = new ChallengeService(httpClient);
  }

  async authenticate(): Promise<AuthResult> {
    debugLog("🔐 Starting authentication process...");

    const { challenge } = await this.challengeService.getChallenge();

    const xmlString = this.crypto.generateAuthTokenRequestXml({
      challenge,
      contextType: "Nip",
      contextValue: this.config.contextNip,
      subjectIdentifierType: this.config.subjectIdentifierType,
    });

    debugLog("📄 Generated XML AuthTokenRequest");

    const signedXml = await this.crypto.signXml(
      xmlString,
      this.config.certificate,
      this.config.privateKey
    );

    debugLog("📝 XML signed with XAdES");

    const authStart = await this.startAuthentication(signedXml);

    debugLog("✅ Authentication started:", authStart.referenceNumber);

    await this.waitForAuthCompletion(
      authStart.referenceNumber,
      authStart.authenticationToken.token
    );

    const accessToken = await this.redeemToken(authStart.authenticationToken.token);

    debugLog("✅ Authentication completed successfully");

    return {
      accessToken,
      sessionToken: authStart.authenticationToken.token,
      timestamp: authStart.timestamp,
    };
  }

  private async startAuthentication(signedXml: string): Promise<AuthStartResponse> {
    debugLog("📤 Sending signed XML to KSeF...");

    const response = await this.httpClient.post<AuthStartResponse>(
      "/auth/xades-signature",
      signedXml,
      {
        headers: { "Content-Type": "application/xml" },
      }
    );

    if (!response.referenceNumber || !response.authenticationToken?.token) {
      throw new Error("Missing referenceNumber or authenticationToken in response");
    }

    return response;
  }

  private async waitForAuthCompletion(
    referenceNumber: string,
    authToken: string,
    options: WaitForAuthOptions = {}
  ): Promise<AuthStatusResponse> {
    const maxWaitMs = options.maxWaitMs ?? DEFAULT_MAX_WAIT_MS;
    const intervalMs = options.intervalMs ?? DEFAULT_POLL_INTERVAL_MS;
    const deadline = Date.now() + maxWaitMs;
    let attempts = 0;

    debugLog("⏳ Waiting for authentication verification...");

    while (Date.now() < deadline) {
      attempts++;

      const status = await this.httpClient.get<AuthStatusResponse>(
        `/auth/${encodeURIComponent(referenceNumber)}`,
        {
          headers: { Authorization: `Bearer ${authToken}` },
          timeoutMs: 15_000,
        }
      );

      if (attempts === 1) {
        debugLog("📋 First auth status response:", JSON.stringify(status, null, 2));
      }

      const statusCode = this.extractStatusCode(status);

      if (this.isAuthSuccess(status, statusCode)) {
        debugLog("✅ Authentication verified (attempt:", attempts, ")");
        return status;
      }

      if (this.isAuthError(status, statusCode)) {
        const message =
          status.exception?.serviceMessage ?? status.processingDescription ?? "Unknown error";
        throw new Error(`Authentication failed with status ${statusCode}: ${message}`);
      }

      const maxAttempts = Math.ceil(maxWaitMs / intervalMs);
      debugLog(
        `⏳ Still waiting... (attempt ${attempts}/${maxAttempts}, status.code: ${statusCode ?? "null"})`
      );

      await this.sleep(intervalMs);
    }

    throw new Error(`Authentication timeout after ${maxWaitMs}ms (${attempts} attempts)`);
  }

  private async redeemToken(authToken: string): Promise<string> {
    debugLog("🔄 Redeeming token...");

    const response = await this.httpClient.post<TokenRedeemResponse>(
      "/auth/token/redeem",
      undefined,
      {
        headers: { Authorization: `Bearer ${authToken}` },
      }
    );

    if (!response.accessToken?.token) {
      throw new Error("Missing accessToken in redeem response");
    }

    return response.accessToken.token;
  }

  private extractStatusCode(status: AuthStatusResponse): number | undefined {
    return status?.status?.code ?? status?.processingCode ?? undefined;
  }

  private isAuthSuccess(status: AuthStatusResponse, statusCode?: number): boolean {
    return (
      statusCode === 200 ||
      status.upo !== undefined ||
      status.elementReferenceNumber !== undefined
    );
  }

  private isAuthError(status: AuthStatusResponse, statusCode?: number): boolean {
    return (statusCode !== undefined && statusCode >= 400) || status.exception !== undefined;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  updateConfig(config: Partial<AuthServiceConfig>): void {
    this.config = { ...this.config, ...config };
  }

  getConfig(): AuthServiceConfig {
    return { ...this.config };
  }
}