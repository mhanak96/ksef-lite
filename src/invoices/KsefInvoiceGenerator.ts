import { FA3InvoiceGenerator } from "./fa3";
import type { Fa3Invoice, Fa3InvoiceInput } from "./fa3/types";

export type KsefInvoiceVersion = "FA3";


export type KsefInvoiceInputByVersion<V extends KsefInvoiceVersion> =
  V extends "FA3" ? (Fa3Invoice | Fa3InvoiceInput | string) : never;

export type KsefInvoiceGeneratorOptions<V extends KsefInvoiceVersion = "FA3"> = {
  version?: V; 
};

export class KSefInvoiceGenerator {
  private fa3: FA3InvoiceGenerator;

  constructor() {
    this.fa3 = new FA3InvoiceGenerator();
  }

  /**
   * Normalizuje input - jeśli string to parsuje JSON, jeśli obiekt zwraca as-is.
  */
  private normalizeInput<T>(input: T | string): T {
    if (typeof input === "string") {
      try {
        return JSON.parse(input) as T;
      } catch (e) {
        throw new Error(`Invalid JSON input: ${(e as Error).message}`);
      }
    }
    return input;
  }

  /**
   * Generuje XML faktury KSeF dla wskazanej wersji (domyślnie FA3).
   */
  generate<V extends KsefInvoiceVersion = "FA3">(
    invoice: KsefInvoiceInputByVersion<V>,
    options?: KsefInvoiceGeneratorOptions<V>
  ): string {
    const version = (options?.version ?? "FA3") as KsefInvoiceVersion;

    switch (version) {
      case "FA3": {
        const normalized = this.normalizeInput<Fa3Invoice | Fa3InvoiceInput>(invoice);
        return this.fa3.generate(normalized);
      }
      default: {
        const _exhaustive: never = version;
        throw new Error(`Unsupported invoice version: ${String(_exhaustive)}`);
      }
    }
  }


  static isJsonString(input: unknown): input is string {
    return typeof input === "string";
  }

  static createSampleInvoice() {
    return FA3InvoiceGenerator.createSampleInvoice();
  }
}