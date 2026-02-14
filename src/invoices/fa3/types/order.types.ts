/**
 * Pozycja zamówienia (ZamowienieWiersz)
 */
export interface Fa3OrderItem {
  // ─── Dane wejściowe ───
  /** Nazwa towaru/usługi (P_7Z) */
  name?: string;
  /** Jednostka miary (P_8AZ) */
  unit?: string;
  /** Ilość (P_8BZ) */
  quantity?: number;
  /** Cena jednostkowa netto (P_9AZ) */
  netPrice?: number;
  /** Stawka VAT (P_12Z) */
  vatRate?: string | number;

  // ─── Obliczane automatycznie ───
  /** Wartość netto (P_11NettoZ) */
  netAmount?: number;
  /** Kwota VAT (P_11VatZ) */
  vatAmount?: number;

  // ─── Identyfikatory i klasyfikacje ───
  /** Uniwersalny unikalny identyfikator (UU_IDZ) */
  uuid?: string;
  /** Indeks wewnętrzny (IndeksZ) */
  index?: string;
  /** GTIN (GTINZ) */
  gtin?: string;
  /** PKWiU (PKWiUZ) */
  pkwiu?: string;
  /** CN (CNZ) */
  cn?: string;
  /** PKOB (PKOBZ) */
  pkob?: string;
  /** GTU (GTUZ) */
  gtu?: string;
  /** Procedura (ProceduraZ) */
  procedure?: string;
  /** Stawka VAT OSS (P_12Z_XII) */
  vatRateOSS?: number;
  /** Załącznik 15 (P_12Z_Zal_15) */
  attachment15?: 1;
  /** Kwota akcyzy (KwotaAkcyzyZ) */
  exciseAmount?: number;
  /** Stan przed korektą (StanPrzedZ) */
  beforeCorrection?: 1;
}

/**
 * Zamówienie (dla faktur zaliczkowych ZAL)
 */
export interface Fa3Order {
  /** Wartość zamówienia brutto (WartoscZamowienia) */
  totalValue: number;
  /** Pozycje zamówienia */
  items: Fa3OrderItem[];
}
