import crypto from "crypto";
import { pemFromBase64Cert } from "./hash.utils";

export class RsaCrypto {
  /**
   * Szyfruje dane kluczem publicznym RSA używając OAEP + SHA-256
   */
  static encryptWithPublicKey(data: Buffer, publicKeyPem: string): Buffer {
    try {
      return crypto.publicEncrypt(
        {
          key: publicKeyPem,
          padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
          oaepHash: "sha256",
        },
        data
      );
    } catch (error) {
      throw new Error(`RSA encryption failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Szyfruje klucz symetryczny AES certyfikatem KSeF
   */
  static encryptSymmetricKey(symmetricKey: Buffer, certificateBase64: string): Buffer {
    if (symmetricKey.length !== 32) {
      throw new Error(`Symmetric key must be 32 bytes (AES-256), got ${symmetricKey.length}`);
    }

    const publicKeyPem = pemFromBase64Cert(certificateBase64);
    return this.encryptWithPublicKey(symmetricKey, publicKeyPem);
  }

  /**
   * Deszyfruje dane kluczem prywatnym RSA używając OAEP + SHA-256
   */
  static decryptWithPrivateKey(encryptedData: Buffer, privateKeyPem: string): Buffer {
    try {
      return crypto.privateDecrypt(
        {
          key: privateKeyPem,
          padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
          oaepHash: "sha256",
        },
        encryptedData
      );
    } catch (error) {
      throw new Error(`RSA decryption failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}