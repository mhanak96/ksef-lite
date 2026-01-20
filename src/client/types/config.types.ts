export type KSefEnvironment = "production" | "test" | "demo";

export type SubjectIdentifierType = "certificateSubject" | "certificateFingerprint";

export interface KSefClientConfig {
  mode?: KSefEnvironment;
  contextNip: string;
  certificate: string;
  privateKey: string;
  subjectIdentifierType?: SubjectIdentifierType;
  debug?: boolean;
}

export interface KSefUrls {
  production: string;
  test: string;
  demo: string;
}

export const KSEF_API_URLS: Record<KSefEnvironment, string> = {
  production: "https://ksef.mf.gov.pl/api/v2",
  test: "https://api-test.ksef.mf.gov.pl/v2",
  demo: "https://ksef-demo.ksef.mf.gov.pl/v2",
};

export const KSEF_SESSION_URLS: Record<KSefEnvironment, string> = {
  production: "https://ksef.mf.gov.pl/api/v2",
  test: "https://ksef-test.mf.gov.pl/api/v2",
  demo: "https://ksef-demo.mf.gov.pl/api/v2",
};

export const KSEF_QR_BASE_URLS: Record<KSefEnvironment, string> = {
  production: "https://qr.ksef.mf.gov.pl",
  test: "https://qr-test.ksef.mf.gov.pl",
  demo: "https://qr-demo.ksef.mf.gov.pl",
};