// src/crypto/xades.ts
import { AuthTokenRequestData } from './types/xades.types';
import { signXmlSimple } from './xades/xades-signer';

/**
 * Generuje XML AuthTokenRequest
 */
export function generateAuthTokenRequestXml(
  data: AuthTokenRequestData
): string {
  const { challenge, contextType, contextValue, subjectIdentifierType } = data;

  return `<?xml version="1.0" encoding="UTF-8"?><AuthTokenRequest xmlns="http://ksef.mf.gov.pl/auth/token/2.0"><Challenge>${challenge}</Challenge><ContextIdentifier><${contextType}>${contextValue}</${contextType}></ContextIdentifier><SubjectIdentifierType>${subjectIdentifierType}</SubjectIdentifierType></AuthTokenRequest>`;
}

// Re-export signXmlSimple
export { signXmlSimple } from './xades/xades-signer';

// Re-export helper functions
export { verifyKeyMatchesCert } from './xades/certificate.utils';
export {
  exclusiveCanonicalize,
  exclusiveCanonicalizeNode,
  canonicalizeNode,
} from './xades/canonicalization';
export { convertDerToP1363WithLowS } from './xades/signature-conversion';