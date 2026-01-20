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
  
  export const TERMINAL_SESSION_STATUS_CODES = new Set([200, 405, 415, 420, 430, 435, 440, 445, 500]);
  
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
  contextType: "Nip" | "CustomId";
  contextValue: string;
  subjectIdentifierType: "certificateSubject" | "certificateFingerprint";
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
  subjectIdentifierType: "certificateSubject" | "certificateFingerprint";
}

/* =========================
   CRYPTO OPERATIONS (dependency injection)
   ========================= */

export interface AuthCryptoOperations {
  generateAuthTokenRequestXml(data: AuthTokenRequestData): string;
  signXml(xml: string, certificate: string, privateKey: string): Promise<string>;
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