/**
 * Forma płatności:
 * 1 - Gotówka
 * 2 - Karta
 * 3 - Bon
 * 4 - Czek
 * 5 - Kredyt
 * 6 - Przelew
 * 7 - Mobilna
 */
export type Fa3PaymentMethod = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface Fa3PartialPayment {
  amount: number;
  date: Date | string;
  method?: Fa3PaymentMethod;
  otherMethod?: boolean;
  methodDescription?: string;
}

export interface Fa3AdvancePartialPayment {
  /** Data otrzymania płatności (P_6Z) */
  date: Date | string;
  /** Kwota płatności (P_15Z) */
  amount: number;
  /** Kurs waluty (KursWalutyZW) */
  exchangeRate?: number;
}

export interface Fa3DueDateDescription {
  quantity: number | string;
  unit: string;
  startEvent: string;
}

export interface Fa3DueDate {
  dueDate?: Date | string;
  dueDateDescription?: Fa3DueDateDescription;
}

export interface Fa3BankAccount {
  /** Pełny numer rachunku (NrRB) */
  accountNumber: string;
  /** Kod SWIFT */
  swift?: string;
  /**
   * Typ rachunku własnego banku:
   * 1 - Rachunek do rozliczeń wierzytelności
   * 2 - Rachunek do pobrania należności
   * 3 - Rachunek gospodarki własnej
   */
  ownBankAccountType?: 1 | 2 | 3;
  /** Nazwa banku */
  bankName?: string;
  /** Opis rachunku */
  description?: string;
}

export interface Fa3Discount {
  /** Warunki skonta */
  conditions: string;
  /** Wysokość skonta */
  amount: string | number;
}

export interface Fa3Payment {
  /** Termin płatności */
  dueDate?: Date | string;
  /** Forma płatności */
  method?: Fa3PaymentMethod;
  /** Kwota */
  amount?: number;
  /** Rachunek bankowy (uproszczony lub pełny) */
  bankAccount?: string | Fa3BankAccount;
  /** Czy zapłacono (1 = tak) */
  paid?: boolean;
  /** Data zapłaty */
  paymentDate?: Date | string;
  /** Znacznik płatności częściowej (1 = częściowa, 2 = całość w częściach) */
  partialPaymentFlag?: 1 | 2;
  /** Płatności częściowe */
  partialPayments?: Fa3PartialPayment[];
  /** Terminy płatności (wiele) */
  dueDates?: Fa3DueDate[];
  /** Opis terminu płatności */
  dueDateDescription?: Fa3DueDateDescription;
  /** Inna forma płatności */
  otherMethod?: boolean;
  /** Opis innej formy płatności */
  methodDescription?: string;
  /** Rachunki bankowe (wiele) */
  bankAccounts?: Fa3BankAccount[];
  /** Rachunki faktora */
  factorAccounts?: Fa3BankAccount[];
  /** Skonto */
  discount?: Fa3Discount;
  /** Link do płatności online */
  paymentLink?: string;
  /** Identyfikator płatności KSeF (IPKSeF) */
  ksefPaymentId?: string;
}
