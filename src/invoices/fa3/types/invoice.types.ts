import type { Fa3Header } from './header.types';
import type {
  Fa3Seller,
  Fa3Buyer,
  Fa3ThirdParty,
  Fa3AuthorizedEntity,
} from './party.types';
import type { Fa3InvoiceDetails } from './invoice-details.types';
import type {
  Fa3InvoiceItem,
  Fa3VatSummary,
  Fa3InvoiceSummary,
} from './item.types';
import type { Fa3Footer, Fa3Attachment } from './footer.types';

/**
 * Kompletny typ faktury FA(3)
 *
 * Struktura XML:
 * - header      → <Naglowek>
 * - seller      → <Podmiot1>
 * - buyer       → <Podmiot2>
 * - thirdParties→ <Podmiot3> (opcjonalne, max 100)
 * - authorizedEntity → <PodmiotUpowazniony> (opcjonalne)
 * - details     → <Fa>
 * - vatSummary  → część <Fa> (P_13_x, P_14_x)
 * - summary     → część <Fa> (P_15)
 * - footer      → <Stopka> (opcjonalne)
 * - attachment  → <Zalacznik> (opcjonalne)
 */
export interface Fa3Invoice {
  /** Nagłówek faktury */
  header: Fa3Header;
  /** Sprzedawca */
  seller: Fa3Seller;
  /** Nabywca */
  buyer: Fa3Buyer;
  /** Podmioty trzecie (opcjonalne, max 100) */
  thirdParties?: Fa3ThirdParty[];
  /** Podmiot upoważniony (opcjonalne) */
  authorizedEntity?: Fa3AuthorizedEntity;
  /** Szczegóły faktury */
  details: Fa3InvoiceDetails;
  /** Podsumowanie VAT - obliczane automatycznie przez kalkulator */
  vatSummary?: Fa3VatSummary;
  /** Podsumowanie faktury - obliczane automatycznie przez kalkulator */
  summary: Fa3InvoiceSummary;
  /** Stopka (opcjonalne) */
  footer?: Fa3Footer;
  /** Załącznik (opcjonalne) */
  attachment?: Fa3Attachment;
}

// ─────────────────────────────────────────────────────────────────────────────
// INPUT TYPES (dla uproszczonego wejścia)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Uproszczony input - pozwala na częściowe dane
 * Kalkulator automatycznie uzupełni brakujące wartości
 */
export interface Fa3InvoiceInput {
  header?: Partial<Fa3Header>;
  seller: Fa3Seller;
  buyer: Fa3Buyer;
  thirdParties?: Fa3ThirdParty[];
  authorizedEntity?: Fa3AuthorizedEntity;
  details: Omit<Fa3InvoiceDetails, 'items'> & {
    items: Array<
      Partial<Fa3InvoiceItem> & {
        name: string;
        quantity: number;
        netPrice: number;
        vatRate: string | number;
      }
    >;
  };
  /** Opcjonalne - obliczane automatycznie */
  vatSummary?: Fa3VatSummary;
  /** Opcjonalne - obliczane automatycznie */
  summary?: Partial<Fa3InvoiceSummary>;
  footer?: Fa3Footer;
  attachment?: Fa3Attachment;
}
