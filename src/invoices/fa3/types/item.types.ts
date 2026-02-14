/**
 * Pozycja faktury (FaWiersz)
 *
 * Dane wejściowe (podaje user):
 * - name, unit, quantity, netPrice, vatRate
 *
 * Obliczane automatycznie przez kalkulator:
 * - netAmount, vatAmount, grossAmount, vatAmountPLN
 */
export interface Fa3InvoiceItem {
  // ─── Dane wejściowe (podaje user) ───
  /** Nazwa towaru/usługi (P_7) */
  name?: string;
  /** Jednostka miary (P_8A) */
  unit?: string;
  /** Ilość (P_8B) */
  quantity?: number;
  /** Cena jednostkowa netto (P_9A) */
  netPrice?: number;
  /** Cena jednostkowa brutto - dla art. 106e ust. 7 i 8 (P_9B) */
  grossPrice?: number;
  /** Rabat/opust (P_10) */
  discount?: number;
  /**
   * Stawka VAT (P_12)
   * Dozwolone wartości: 23, 22, 8, 7, 5, 4, 3, "0 KR", "0 WDT", "0 EX", "zw", "oo", "np I", "np II"
   */
  vatRate?: string | number;
  /** Kurs waluty dla pozycji (KursWaluty) - dla walut obcych */
  exchangeRate?: number;

  // ─── Flagi ───
  /** Znacznik stanu przed korektą (StanPrzed = 1) */
  beforeCorrection?: 1;
  /** Znacznik załącznika 15 - mechanizm podzielonej płatności (P_12_Zal_15 = 1) */
  attachment15?: 1;
  /** Czy pozycja w procedurze marży */
  isMargin?: boolean;

  // ─── Obliczane automatycznie przez kalkulator ───
  /** Wartość netto (P_11) = quantity × netPrice - discount */
  netAmount?: number;
  /** Kwota VAT (P_11Vat) = netAmount × vatRate% */
  vatAmount?: number;
  /** Wartość brutto (P_11A) = netAmount + vatAmount */
  grossAmount?: number;
  /** VAT przeliczony na PLN - dla walut obcych */
  vatAmountPLN?: number;

  // ─── Klasyfikacje i identyfikatory ───
  /** Numer wiersza (NrWierszaFa) - nadawany automatycznie */
  lineNumber?: number;
  /** Uniwersalny unikalny identyfikator wiersza (UU_ID) */
  uuid?: string;
  /** Data sprzedaży dla wiersza (P_6A) - gdy różne daty dla pozycji */
  saleDate?: Date | string;
  /** Indeks wewnętrzny towaru/usługi (Indeks) */
  index?: string;
  /** Globalny numer jednostki handlowej (GTIN) */
  gtin?: string;
  /** Symbol PKWiU (PKWiU) */
  pkwiu?: string;
  /** Symbol Nomenklatury Scalonej (CN) */
  cn?: string;
  /** Symbol PKOB (PKOB) */
  pkob?: string;
  /** Oznaczenie GTU (GTU_01 - GTU_13) */
  gtu?: string;
  /** Oznaczenie procedury (Procedura) */
  procedure?: string;
  /** Stawka VAT OSS (P_12_XII) */
  vatRateOSS?: number;
  /** Kwota akcyzy (KwotaAkcyzy) */
  exciseAmount?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// VAT SUMMARY TYPES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Grupa podsumowania VAT (dla jednej stawki)
 */
export interface Fa3VatSummaryGroup {
  /** Stawka VAT */
  vatRate: string | number;
  /** Suma netto dla stawki (P_13_x) */
  netAmount: number;
  /** Suma VAT dla stawki (P_14_x) */
  vatAmount: number;
  /** Suma brutto dla stawki */
  grossAmount?: number;
  /** VAT w PLN - dla walut obcych (P_14_xW) */
  vatAmountPLN?: number;
  /** Czy procedura marży */
  isMargin?: boolean;
  /** Czy procedura OSS */
  isOSS?: boolean;
}

/**
 * Podsumowanie VAT - grupowanie po stawkach
 * Klucz to identyfikator pola KSeF (np. "P_13_1" dla 23%)
 */
export type Fa3VatSummary = Record<string, Fa3VatSummaryGroup>;

// ─────────────────────────────────────────────────────────────────────────────
// INVOICE SUMMARY TYPES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Podsumowanie faktury
 */
export interface Fa3InvoiceSummary {
  /** Suma netto */
  netAmount: number;
  /** Suma VAT */
  vatAmount: number;
  /** Suma brutto (P_15) - kwota należności ogółem */
  grossAmount: number;
}

/** Alias dla kompatybilności */
export type Fa3Summary = Fa3InvoiceSummary;
