export interface AuthTokenRequestData {
  challenge: string;
  contextType: "Nip" | "CustomId";
  contextValue: string;
  subjectIdentifierType: "certificateSubject" | "certificateFingerprint";
}

export interface CertificateInfo {
  issuer: string;
  serialNumber: string;
}

export interface XAdESSigningConfig {
  xmlString: string;
  certificate: string;
  privateKey: string;
}

export interface XAdESSigningResult {
  signedXml: string;
  signatureValue: string;
  certificateDigest: string;
  documentDigest: string;
}