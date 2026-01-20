import crypto from "crypto";
import { sha256Base64Buffer } from "./hash.utils";
import { EncryptedInvoiceData } from "./types";

const ALGORITHM = "aes-256-cbc";
const KEY_LENGTH = 32;
const IV_LENGTH = 16;

export class AesCrypto {
  /**
   * Generuje losowy klucz AES-256 (32 bajty)
   */
  static generateKey(): Buffer {
    return crypto.randomBytes(KEY_LENGTH);
  }

  /**
   * Generuje losowy IV - Initialization Vector (16 bajtów)
   */
  static generateIV(): Buffer {
    return crypto.randomBytes(IV_LENGTH);
  }

  /**
   * Szyfruje dane używając AES-256-CBC
   */
  static encrypt(data: Buffer, key: Buffer, iv: Buffer): Buffer {
    this.validateKey(key);
    this.validateIV(iv);

    try {
      const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
      return Buffer.concat([cipher.update(data), cipher.final()]);
    } catch (error) {
      throw new Error(`AES encryption failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Deszyfruje dane używając AES-256-CBC
   */
  static decrypt(encrypted: Buffer, key: Buffer, iv: Buffer): Buffer {
    this.validateKey(key);
    this.validateIV(iv);

    try {
      const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
      return Buffer.concat([decipher.update(encrypted), decipher.final()]);
    } catch (error) {
      throw new Error(`AES decryption failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Szyfruje XML faktury i oblicza wszystkie wymagane hashe
   */
  static encryptInvoiceXml(invoiceXml: string, symmetricKey: Buffer, iv: Buffer): EncryptedInvoiceData {
    const xmlBuffer = Buffer.from(invoiceXml, "utf8");

    const originalHash = sha256Base64Buffer(xmlBuffer);
    const originalSize = xmlBuffer.length;

    const encrypted = this.encrypt(xmlBuffer, symmetricKey, iv);

    const encryptedHash = sha256Base64Buffer(encrypted);
    const encryptedSize = encrypted.length;

    return {
      encrypted,
      originalHash,
      originalSize,
      encryptedHash,
      encryptedSize,
    };
  }

  /**
   * Deszyfruje XML faktury
   */
  static decryptInvoiceXml(encryptedXml: Buffer, symmetricKey: Buffer, iv: Buffer): string {
    const decrypted = this.decrypt(encryptedXml, symmetricKey, iv);
    return decrypted.toString("utf8");
  }

  /**
   * Szyfruje dane tekstowe
   */
  static encryptText(text: string, key: Buffer, iv: Buffer): string {
    const buffer = Buffer.from(text, "utf8");
    const encrypted = this.encrypt(buffer, key, iv);
    return encrypted.toString("base64");
  }

  /**
   * Deszyfruje dane tekstowe
   */
  static decryptText(encryptedBase64: string, key: Buffer, iv: Buffer): string {
    const encrypted = Buffer.from(encryptedBase64, "base64");
    const decrypted = this.decrypt(encrypted, key, iv);
    return decrypted.toString("utf8");
  }

  private static validateKey(key: Buffer): void {
    if (key.length !== KEY_LENGTH) {
      throw new Error(`AES key must be ${KEY_LENGTH} bytes (256 bits), got ${key.length}`);
    }
  }

  private static validateIV(iv: Buffer): void {
    if (iv.length !== IV_LENGTH) {
      throw new Error(`IV must be ${IV_LENGTH} bytes (128 bits), got ${iv.length}`);
    }
  }
}