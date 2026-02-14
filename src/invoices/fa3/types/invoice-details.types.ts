import type { Fa3InvoiceItem } from './item.types';
import type { Fa3Annotations } from './annotation.types';
import type { Fa3AdvancePartialPayment, Fa3Payment } from './payment.types';
import type { Fa3Order } from './order.types';
import type { Fa3Settlement } from './settlement.types';
import type { Fa3TransactionConditions } from './transaction.types';
import type { Fa3CorrectedSeller, Fa3CorrectedBuyer } from './party.types';

export interface Fa3CorrectedInvoiceRef {
  /** Data wystawienia faktury korygowanej */
  issueDate: Date | string;
  /** Numer faktury korygowanej */
  number: string;
  /** Numer KSeF faktury korygowanej (jeśli była w KSeF) */
  ksefNumber?: string;
}

export interface Fa3AdditionalInfo {
  /** Numer wiersza (opcjonalny) */
  lineNumber?: number | string;
  /** Klucz */
  key: string;
  /** Wartość */
  value: string;
}

export interface Fa3AdvanceInvoiceReference {
  /** Numer KSeF faktury zaliczkowej */
  ksefNumber?: string;
  /** Numer faktury zaliczkowej (gdy poza KSeF) */
  number?: string;
}

export interface Fa3SaleDateRange {
  /** Data początkowa okresu */
  from: Date | string;
  /** Data końcowa okresu */
  to: Date | string;
}

/**
 * Szczegóły faktury (sekcja <Fa>)
 */
export interface Fa3InvoiceDetails {
  // ─── Wymagane ───
  /** Numer faktury (P_2) */
  invoiceNumber: string;
  /** Data wystawienia (P_1) */
  issueDate: Date | string;
  /** Kod waluty ISO 4217 (KodWaluty) */
  currency: string;
  /**
   * Rodzaj faktury:
   * - VAT: Faktura podstawowa
   * - KOR: Faktura korygująca
   * - ZAL: Faktura zaliczkowa
   * - ROZ: Faktura rozliczeniowa (art. 106f ust. 3)
   * - UPR: Faktura uproszczona
   * - KOR_ZAL: Korekta faktury zaliczkowej
   * - KOR_ROZ: Korekta faktury rozliczeniowej
   */
  invoiceType: 'VAT' | 'KOR' | 'ZAL' | 'ROZ' | 'UPR' | 'KOR_ZAL' | 'KOR_ROZ';
  /** Pozycje faktury */
  items: Fa3InvoiceItem[];

  // ─── Daty ───
  /** Data sprzedaży (P_6) - gdy wspólna dla wszystkich pozycji */
  saleDate?: Date | string;
  /** Okres sprzedaży (OkresFa) - dla usług ciągłych */
  saleDateRange?: Fa3SaleDateRange;
  /** Miejsce wystawienia (P_1M) */
  issuePlace?: string;

  // ─── Dokumenty powiązane ───
  /** Numery WZ (max 1000) */
  deliveryNotes?: string[];

  // ─── Kursy walut ───
  /** Kurs waluty dla zaliczki (KursWalutyZ) */
  exchangeRateAdvance?: number;

  // ─── Adnotacje ───
  annotations?: Fa3Annotations;

  // ─── Dane korekt ───
  /** Przyczyna korekty */
  correctionReason?: string;
  /**
   * Typ korekty:
   * 1 - skutek w dacie faktury pierwotnej
   * 2 - skutek w dacie wystawienia korekty
   * 3 - skutek w innej dacie
   */
  correctionType?: 1 | 2 | 3;
  /** Faktury korygowane (max 50000) */
  correctedInvoices?: Fa3CorrectedInvoiceRef[];
  /** Okres faktur korygowanych (dla korekt zbiorczych) */
  correctedInvoicePeriod?: string;
  /** Poprawny numer faktury (gdy korekta błędnego numeru) */
  correctedInvoiceNumber?: string;
  /** Dane sprzedawcy przed korektą */
  correctedSeller?: Fa3CorrectedSeller;
  /** Dane nabywców przed korektą (max 101) */
  correctedBuyers?: Fa3CorrectedBuyer[];
  /** Kwota przed korektą (P_15ZK) */
  amountBeforeCorrection?: number;
  /** Kurs waluty przed korektą (KursWalutyZK) */
  exchangeRateBeforeCorrection?: number;

  // ─── Zaliczki ───
  /** Płatności częściowe zaliczkowe (ZaliczkaCzesciowa, max 31) */
  partialPayments?: Fa3AdvancePartialPayment[];
  /** Faktury zaliczkowe (FakturaZaliczkowa, max 100) */
  advanceInvoices?: Fa3AdvanceInvoiceReference[];

  // ─── Flagi ───
  /** Faktura do paragonu (FP = 1) */
  fp?: boolean;
  /** Powiązania między podmiotami (TP = 1) */
  tp?: boolean;
  /** Zwrot akcyzy dla rolników (ZwrotAkcyzy = 1) */
  exciseRefund?: boolean;

  // ─── Opisy dodatkowe ───
  /** Dodatkowe informacje (DodatkowyOpis, max 10000) */
  additionalInfo?: Fa3AdditionalInfo[];

  // ─── Pozostałe sekcje ───
  /** Rozliczenie (obciążenia/odliczenia) */
  settlement?: Fa3Settlement;
  /** Płatność */
  payment?: Fa3Payment;
  /** Warunki transakcji */
  transactionConditions?: Fa3TransactionConditions;
  /** Zamówienie (dla faktur zaliczkowych) */
  order?: Fa3Order;
}
