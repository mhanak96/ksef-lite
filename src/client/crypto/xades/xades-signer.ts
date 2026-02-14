import crypto from 'crypto';
import { DOMParser } from '@xmldom/xmldom';

import { debugLog, debugError } from '../../../utils/logger';
import {
  exclusiveCanonicalizeNode,
  canonicalizeNode,
} from './canonicalization';
import {
  verifyKeyMatchesCert,
  parseCertificateInfo,
  formatSigningTime,
} from './certificate.utils';
import { convertDerToP1363WithLowS } from './signature-conversion';
import { sha256Base64Buffer } from '../hash.utils';
import { AuthTokenRequestData } from '../../auth/types';

const NS_XMLDSIG = 'http://www.w3.org/2000/09/xmldsig#';
const NS_XADES = 'http://uri.etsi.org/01903/v1.3.2#';

function sha256Base64(data: string): string {
  return crypto.createHash('sha256').update(data, 'utf8').digest('base64');
}

/**
 * Generuje XML AuthTokenRequest
 */
export function generateAuthTokenRequestXml(
  data: AuthTokenRequestData
): string {
  const { challenge, contextType, contextValue, subjectIdentifierType } = data;

  return (
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<AuthTokenRequest xmlns="http://ksef.mf.gov.pl/auth/token/2.0">` +
    `<Challenge>${challenge}</Challenge>` +
    `<ContextIdentifier>` +
    `<${contextType}>${contextValue}</${contextType}>` +
    `</ContextIdentifier>` +
    `<SubjectIdentifierType>${subjectIdentifierType}</SubjectIdentifierType>` +
    `</AuthTokenRequest>`
  );
}

/**
 * Podpisuje XML używając XAdES - zgodnie z oficjalną implementacją KSeF C#
 */
export async function signXmlSimple(
  xmlString: string,
  certPem: string,
  privateKeyPem: string
): Promise<string> {
  try {
    if (!verifyKeyMatchesCert(certPem, privateKeyPem)) {
      throw new Error('Private key does not match certificate!');
    }

    const isECDSA = privateKeyPem.includes('EC PRIVATE KEY');
    const signatureAlgorithm = isECDSA
      ? 'http://www.w3.org/2001/04/xmldsig-more#ecdsa-sha256'
      : 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256';

    debugLog(`🔐 Detected key type: ${isECDSA ? 'ECDSA' : 'RSA'}`);
    debugLog(
      `🔐 Using XAdES format (matching official KSeF C# implementation)`
    );

    const certBase64 = certPem
      .replace(/-----BEGIN CERTIFICATE-----/g, '')
      .replace(/-----END CERTIFICATE-----/g, '')
      .replace(/\s/g, '');

    const certDer = Buffer.from(certBase64, 'base64');
    const certDigest = sha256Base64Buffer(certDer);
    const { issuer, serialNumber } = parseCertificateInfo(certPem);

    debugLog('📝 Certificate digest:', certDigest);

    const signatureId = 'Signature';
    const signedPropertiesId = 'SignedProperties';
    const signingTime = formatSigningTime();

    debugLog('📝 Signing time:', signingTime);

    // === Reference 1: Dokument główny z Exclusive C14N ===
    const docForDigest = new DOMParser().parseFromString(xmlString, 'text/xml');
    const canonicalDoc = exclusiveCanonicalizeNode(
      docForDigest.documentElement
    );
    const documentDigest = sha256Base64(canonicalDoc);
    debugLog('📝 Document digest:', documentDigest);

    // === QualifyingProperties z SignedProperties ===
    const qualifyingPropertiesXml =
      `<xades:QualifyingProperties Target="#${signatureId}" xmlns:xades="${NS_XADES}" xmlns="${NS_XMLDSIG}">` +
      `<xades:SignedProperties Id="${signedPropertiesId}">` +
      `<xades:SignedSignatureProperties>` +
      `<xades:SigningTime>${signingTime}</xades:SigningTime>` +
      `<xades:SigningCertificate>` +
      `<xades:Cert>` +
      `<xades:CertDigest>` +
      `<DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/>` +
      `<DigestValue>${certDigest}</DigestValue>` +
      `</xades:CertDigest>` +
      `<xades:IssuerSerial>` +
      `<X509IssuerName>${issuer}</X509IssuerName>` +
      `<X509SerialNumber>${serialNumber}</X509SerialNumber>` +
      `</xades:IssuerSerial>` +
      `</xades:Cert>` +
      `</xades:SigningCertificate>` +
      `</xades:SignedSignatureProperties>` +
      `</xades:SignedProperties>` +
      `</xades:QualifyingProperties>`;

    // === Reference 2: SignedProperties z Exclusive C14N ===
    const qpDoc = new DOMParser().parseFromString(
      qualifyingPropertiesXml,
      'text/xml'
    );
    const signedPropertiesElement = qpDoc.getElementsByTagName(
      'xades:SignedProperties'
    )[0];
    const canonicalSignedProperties = exclusiveCanonicalizeNode(
      signedPropertiesElement
    );
    debugLog(
      '📝 Canonical SignedProperties:',
      canonicalSignedProperties.substring(0, 300)
    );
    const signedPropertiesDigest = sha256Base64(canonicalSignedProperties);
    debugLog('📝 SignedProperties digest:', signedPropertiesDigest);

    // === SignedInfo ===
    const signedInfoXml =
      `<SignedInfo xmlns="${NS_XMLDSIG}">` +
      `<CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/>` +
      `<SignatureMethod Algorithm="${signatureAlgorithm}"/>` +
      `<Reference URI="">` +
      `<Transforms>` +
      `<Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"/>` +
      `<Transform Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/>` +
      `</Transforms>` +
      `<DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/>` +
      `<DigestValue>${documentDigest}</DigestValue>` +
      `</Reference>` +
      `<Reference URI="#${signedPropertiesId}" Type="http://uri.etsi.org/01903#SignedProperties">` +
      `<Transforms>` +
      `<Transform Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/>` +
      `</Transforms>` +
      `<DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/>` +
      `<DigestValue>${signedPropertiesDigest}</DigestValue>` +
      `</Reference>` +
      `</SignedInfo>`;

    // Kanonizuj SignedInfo (zwykła C14N, nie Exclusive)
    const signedInfoDoc = new DOMParser().parseFromString(
      signedInfoXml,
      'text/xml'
    );
    const canonicalSignedInfo = canonicalizeNode(signedInfoDoc.documentElement);
    debugLog('📝 Canonical SignedInfo length:', canonicalSignedInfo.length);

    // === Podpisz ===
    const sign = crypto.createSign('SHA256');
    sign.update(canonicalSignedInfo, 'utf8');
    sign.end();

    let signatureValue: string;
    if (isECDSA) {
      const derSignature = sign.sign(privateKeyPem);
      const p1363Signature = convertDerToP1363WithLowS(derSignature);
      signatureValue = p1363Signature.toString('base64');
    } else {
      signatureValue = sign.sign(privateKeyPem, 'base64');
    }
    debugLog('📝 SignatureValue length:', signatureValue.length);

    // === Złóż kompletny Signature ===
    const signatureXml =
      `<Signature xmlns="${NS_XMLDSIG}" Id="${signatureId}">` +
      signedInfoXml +
      `<SignatureValue>${signatureValue}</SignatureValue>` +
      `<KeyInfo>` +
      `<X509Data>` +
      `<X509Certificate>${certBase64}</X509Certificate>` +
      `</X509Data>` +
      `</KeyInfo>` +
      `<Object>` +
      qualifyingPropertiesXml +
      `</Object>` +
      `</Signature>`;

    const signedXml = xmlString.replace(
      '</AuthTokenRequest>',
      signatureXml + '</AuthTokenRequest>'
    );

    debugLog('✅ XML signed successfully (XAdES)');
    debugLog('📝 Signed XML length:', signedXml.length);

    return signedXml;
  } catch (error) {
    debugError(
      '🔴 Signing error:',
      error instanceof Error ? error.message : String(error)
    );
    if (error instanceof Error && error.stack) {
      debugError('🔴 Stack:', error.stack);
    }
    throw new Error(
      `XML signing failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
