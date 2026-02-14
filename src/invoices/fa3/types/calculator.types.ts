import type {
  Fa3InvoiceItem,
  Fa3VatSummary,
  Fa3InvoiceSummary,
} from './item.types';
import type { Fa3Order } from './order.types';

/**
 * Opcje kalkulatora
 */
export interface Fa3CalculatorOptions {
  /** Waluta faktury (domyślnie PLN) */
  currency?: string;
  /** Domyślny kurs wymiany dla całej faktury */
  defaultExchangeRate?: number;
  /** Tryb zaokrąglania: 'item' (każdy item osobno) lub 'total' (suma na końcu) */
  roundingMode?: 'item' | 'total';
  /** Liczba miejsc po przecinku dla kwot (domyślnie 2) */
  decimalPlaces?: number;
}

/**
 * Wynik kalkulacji faktury
 */
export interface Fa3CalculationResult {
  /** Obliczone pozycje faktury */
  items: Fa3InvoiceItem[];
  /** Podsumowanie VAT */
  vatSummary: Fa3VatSummary;
  /** Podsumowanie faktury */
  summary: Fa3InvoiceSummary;
  /** Zamówienie (dla faktur zaliczkowych) */
  order?: Fa3Order;
}
