/* =========================
   CHALLENGE
   ========================= */

export interface ChallengeResponse {
  challenge: string;
  timestamp: string;
}

/* =========================
     AUTH TOKEN REQUEST
     ========================= */

export interface AuthTokenRequestData {
  challenge: string;
  contextType: 'Nip' | 'CustomId';
  contextValue: string;
  subjectIdentifierType: 'certificateSubject' | 'certificateFingerprint';
}

/* =========================
     AUTH START / STATUS / REDEEM
     ========================= */

export interface AuthenticationToken {
  token: string;
  type: string;
}

export interface AuthStartResponse {
  referenceNumber: string;
  authenticationToken: AuthenticationToken;
  timestamp: string;
}

export interface AuthStatusResponse {
  processingCode: number;
  processingDescription: string;
  referenceNumber: string;
  timestamp: string;
  upo?: string;
  status?: {
    code?: number;
  };
  elementReferenceNumber?: string;
  exception?: {
    serviceMessage?: string;
  };
}

export interface TokenRedeemResponse {
  accessToken: {
    token: string;
    type: string;
  };
  timestamp: string;
}

/* =========================
     AUTH RESULT
     ========================= */

export interface AuthResult {
  accessToken: string;
  sessionToken: string;
  timestamp: string;
}

/* =========================
     OPTIONS & CONFIG
     ========================= */

export interface WaitForAuthOptions {
  maxWaitMs?: number;
  intervalMs?: number;
}

export interface AuthServiceConfig {
  certificate: string;
  privateKey: string;
  contextNip: string;
  subjectIdentifierType: 'certificateSubject' | 'certificateFingerprint';
}

/* =========================
     CRYPTO OPERATIONS (dependency injection)
     ========================= */

export interface AuthCryptoOperations {
  generateAuthTokenRequestXml(data: AuthTokenRequestData): string;
  signXml(
    xml: string,
    certificate: string,
    privateKey: string
  ): Promise<string>;
}

/**
 * Połączony interfejs dla wszystkich operacji crypto
 * Zawiera zarówno auth (XAdES) jak i session (AES/RSA)
 */
export interface KSefCryptoOperations extends AuthCryptoOperations {
  // AES operations
  generateAesKey(): Buffer;
  generateIv(): Buffer;
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

  // RSA operations
  encryptSymmetricKey(symmetricKey: Buffer, publicKeyCertPem: string): Buffer;
}
