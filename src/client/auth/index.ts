export { AuthService } from './auth.service';
export { ChallengeService } from './challenge.service';
export * from './types';

// Session submodule
export {
  SessionManager,
  EncryptionService,
  SessionState,
  SessionFormCode,
  SessionEncryption,
  OpenSessionRequest,
  OpenSessionResponse,
  InvoicePayload,
  SendInvoiceResponse,
  OpenSessionOptions,
  SessionStatusInfo,
  SessionStatusResponse,
  SessionCryptoOperations,
  PublicKeyCertificate,
  PublicKeyCertificatesResponse,
  EncryptionKeys,
  EncryptedInvoice,
  isTerminalSessionStatus,
} from './session';

// Crypto submodule
export {
  // Ready-to-use implementation
  ksefCrypto,

  // XAdES functions
  generateAuthTokenRequestXml,
  signXmlSimple,
  verifyKeyMatchesCert,
  parseCertificateInfo,
  formatSigningTime,

  // Hash utilities
  sha256Base64,
  sha256Base64Buffer,
  pemFromBase64Cert,

  // Types
  CertificateInfo,
} from '../crypto';
