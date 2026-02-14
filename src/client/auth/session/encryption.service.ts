import { debugLog, debugError } from '../../../utils/logger';
import {
  SessionEncryption,
  PublicKeyCertificate,
  PublicKeyCertificatesResponse,
  EncryptionKeys,
  EncryptedInvoice,
  SessionCryptoOperations,
} from './types';

export class EncryptionService {
  constructor(private readonly crypto: SessionCryptoOperations) {}

  prepareSessionEncryption(
    certificatesResponse: PublicKeyCertificatesResponse
  ): EncryptionKeys {
    debugLog('🔐 Preparing session encryption...');

    const certificates = this.extractCertificates(certificatesResponse);

    debugLog('📋 Certificates to process:', certificates.length);

    if (certificates.length === 0) {
      debugError('❌ No certificates found in response!');
      debugError(
        '📋 Response structure:',
        JSON.stringify(certificatesResponse, null, 2)
      );
      throw new Error('No certificates returned from API');
    }

    const symKeyCert = this.findValidCertificate(certificates);

    debugLog('✅ Found certificate');
    debugLog('📋 Usage:', symKeyCert.usage);
    debugLog('📋 Valid from:', symKeyCert.validFrom);
    debugLog('📋 Valid to:', symKeyCert.validTo);

    const symmetricKey = this.crypto.generateAesKey();
    const iv = this.crypto.generateIv();

    const encryptedSymmetricKey = this.crypto.encryptSymmetricKey(
      symmetricKey,
      symKeyCert.certificate
    );

    debugLog('✅ Symmetric key encrypted');

    return {
      symmetricKey,
      iv,
      encryptedSymmetricKey,
    };
  }

  createSessionEncryptionPayload(keys: EncryptionKeys): SessionEncryption {
    return {
      encryptedSymmetricKey: keys.encryptedSymmetricKey.toString('base64'),
      initializationVector: keys.iv.toString('base64'),
    };
  }

  encryptInvoice(
    invoiceXml: string,
    symmetricKey: Buffer,
    iv: Buffer
  ): EncryptedInvoice {
    debugLog('🔐 Encrypting invoice...');

    const result = this.crypto.encryptInvoiceXml(invoiceXml, symmetricKey, iv);

    debugLog('✅ Invoice encrypted');
    debugLog('📝 Original size:', result.originalSize, 'bytes');
    debugLog('📝 Encrypted size:', result.encryptedSize, 'bytes');

    return {
      encryptedContent: result.encrypted.toString('base64'),
      invoiceHash: result.originalHash,
      invoiceSize: result.originalSize,
      encryptedHash: result.encryptedHash,
      encryptedSize: result.encryptedSize,
    };
  }

  private extractCertificates(
    response: PublicKeyCertificatesResponse
  ): PublicKeyCertificate[] {
    if (Array.isArray(response)) {
      return response;
    }

    if (response?.certificates) {
      return response.certificates;
    }

    if (response?.publicKeys) {
      return response.publicKeys;
    }

    if (response?.items) {
      return response.items;
    }

    return [];
  }

  private findValidCertificate(
    certificates: PublicKeyCertificate[]
  ): PublicKeyCertificate {
    const now = new Date();

    const validCerts = certificates.filter((cert) => {
      const hasUsage = cert.usage?.includes('SymmetricKeyEncryption');
      const validFrom = new Date(cert.validFrom);
      const validTo = new Date(cert.validTo);
      const isValid = validFrom <= now && validTo >= now;

      debugLog('🔍 Checking cert:', {
        usage: cert.usage,
        hasUsage,
        validFrom: cert.validFrom,
        validTo: cert.validTo,
        isValid,
        match: hasUsage && isValid,
      });

      return hasUsage && isValid;
    });

    if (validCerts.length === 0) {
      debugError('❌ No valid SymmetricKeyEncryption certificate found!');
      debugError(
        '📋 Available certificates:',
        certificates.map((c) => ({
          usage: c.usage,
          validFrom: c.validFrom,
          validTo: c.validTo,
        }))
      );
      throw new Error('No valid certificate found for SymmetricKeyEncryption');
    }

    // Wybierz najnowszy certyfikat
    return validCerts.sort(
      (a, b) =>
        new Date(b.validFrom).getTime() - new Date(a.validFrom).getTime()
    )[0];
  }
}
