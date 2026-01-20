// src/invoices/fa3/types/index.ts

// ─────────────────────────────────────────────────────────────────────────────
// VALIDATION TYPES
// ─────────────────────────────────────────────────────────────────────────────

export type IssueSeverity = 'error' | 'warning';

export interface ValidationIssue {
  severity: IssueSeverity;
  code: string;
  path: string;
  message: string;
  builder?: string;
}

export interface BuildResult {
  xml: string;
  issues: ValidationIssue[];
}

// ─────────────────────────────────────────────────────────────────────────────
// ADDRESS TYPES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Adres (uniwersalny) – dopasowany do AddressBuilder
 *
 * Builder obsługuje:
 * 1) liniowy: address/line1 + opcjonalnie line2
 * 2) składany: street + buildingNumber + apartmentNumber + postalCode + city
 * 3) strukturalny (PL): province/county/municipality/city/street/.../postOffice
 * 4) zagraniczny: dodatkowo region
 * 5) opcjonalny GLN
 */
export interface Fa3Address {
  countryCode?: string;

  address?: string;

  line1?: string;
  line2?: string;

  street?: string;
  buildingNumber?: string;
  apartmentNumber?: string;
  postalCode?: string;
  city?: string;

  province?: string;    
  county?: string;      
  municipality?: string; 
  postOffice?: string;    

  region?: string;


  gln?: string;
}

/**
 * Dane kontaktowe
 */
export interface Fa3ContactDetails {
  email?: string;
  phone?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// SUBJECT TYPES (Seller, Buyer, ThirdParty)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Sprzedawca (Podmiot1)
 */
export interface Fa3Seller {
  nip: string;
  name: string;
  address: Fa3Address | string;
  email?: string;
  phone?: string;
  /** Prefiks VAT UE (dla WDT) */
  prefixVatUE?: string;
}

/**
 * Nabywca (Podmiot2)
 */
export interface Fa3Buyer {
  // Identyfikacja (jedna z opcji)
  /** NIP nabywcy (dla polskich firm) */
  nip?: string;
  /** Kod kraju UE (dla kontrahentów UE) */
  countryCodeUE?: string;
  /** Numer VAT UE (dla kontrahentów UE) */
  vatUE?: string;
  /** Kod kraju identyfikatora (dla kontrahentów spoza UE) */
  idCountryCode?: string;
  /** Numer identyfikacyjny (dla kontrahentów spoza UE) */
  idNumber?: string;

  // Dane podstawowe
  name: string;
  address: Fa3Address | string;

  // Kontakt (opcjonalne)
  email?: string;
  phone?: string;

  // Typy nabywcy
  /** Konsument bez NIP (BrakID = 1) */
  isConsumer?: boolean;
  /** Kontrahent zagraniczny */
  isForeign?: boolean;
  /** NIP UE (alias dla vatUE, dla kompatybilności) */
  vatId?: string;

  /** Kod kraju (dla zagranicznego) */
  countryCode?: string;

  /**
   * Czy faktura dotyczy jednostki podrzędnej JST (np. szkoły w gminie)?
   * Jeśli true (wartość 1), wymaga wypełnienia Podmiot3 z rolą 8.
   * @default false (wartość 2)
   */
  isJstSubordinate?: boolean;

  /**
   * Czy nabywca jest członkiem grupy VAT?
   * Jeśli true (wartość 1), wymaga wypełnienia Podmiot3 z rolą 10.
   * @default false (wartość 2)
   */
  isVatGroupMember?: boolean;

  /** Numer klienta (opcjonalny) */
  customerNumber?: string;
  /** Unikalny ID nabywcy (dla korekt) */
  buyerId?: string;
}

/**
 * Podmiot trzeci (Podmiot3) - opcjonalny
 */
export interface Fa3ThirdParty {
  nip?: string;
  /** Identyfikator wewnętrzny (NIP + suffix) */
  internalId?: string;

  countryCodeUE?: string;
  vatUE?: string;

  idCountryCode?: string;
  idNumber?: string;

  /** Brak identyfikatora (BrakID = 1) */
  noId?: boolean;

  /** Nazwa podmiotu */
  name?: string;

  /** Adres */
  address?: Fa3Address | string;

  /** Adres korespondencyjny */
  correspondenceAddress?: Fa3Address;

  email?: string;
  phone?: string;

  /**
   * Rola podmiotu trzeciego:
   * 1 - Faktor
   * 2 - Odbiorca
   * 3 - Podmiot pierwotny
   * 4 - Dodatkowy nabywca
   * 5 - Wystawca faktury
   * 6 - Dokonujący płatności
   * 7 - JST - wystawca
   * 8 - JST - odbiorca
   * 9 - Członek grupy VAT - wystawca
   * 10 - Członek grupy VAT - odbiorca
   * 11 - Pracownik
   */
  role?: number | string;

  /** Opis roli (gdy role = "inna") */
  roleDescription?: string;

  /** Udział procentowy (dla dodatkowych nabywców) */
  share?: number;

  /** Numer klienta */
  customerNumber?: string;

  /** Unikalny ID nabywcy (dla korekt) */
  buyerId?: string;

  // ============================================================
  // DODANE POD ThirdPartyBuilder (żeby TS przestał krzyczeć)
  // ============================================================

  /** Nr EORI (opcjonalny) – używany przez ThirdPartyBuilder -> <NrEORI> */
  eoriNumber?: string;

  /**
   * Konsument bez identyfikatora – ThirdPartyBuilder traktuje to jak BrakID
   * (masz też noId; to jest “alias” pod Twoją logikę buildera)
   */
  isConsumer?: boolean;

  /**
   * Kod kraju dla identyfikatora NrID (ThirdPartyBuilder używa tego jako <KodKraju>)
   * UWAGA: to jest osobne od countryCodeUE (UE VAT).
   */
  countryCode?: string;

  /**
   * Flaga “inna rola” – ThirdPartyBuilder używa:
   *  - customRole + customRoleDescription => <RolaInna> + <OpisRoli>
   */
  customRole?: boolean;

  /** Opis “innej roli” dla <OpisRoli> */
  customRoleDescription?: string;
}

/**
 * Podmiot upoważniony - opcjonalny
 */
export interface Fa3AuthorizedEntity {
  nip: string;
  name: string;
  address: Fa3Address | string;
  correspondenceAddress?: Fa3Address;
  email?: string;
  phone?: string;

  eoriNumber?: string;
  /**
   * Rola podmiotu upoważnionego:
   * 1 - Organ egzekucyjny
   * 2 - Komornik sądowy
   * 3 - Przedstawiciel podatkowy
   */
  role: 1 | 2 | 3;
}

/**
 * Skorygowany sprzedawca (dla faktur korygujących)
 */
export interface Fa3CorrectedSeller {
  prefixVatUE?: string;
  nip: string;
  name: string;
  address: Fa3Address | string;
}

/**
 * Skorygowany nabywca (dla faktur korygujących)
 */
export interface Fa3CorrectedBuyer {
  nip?: string;
  countryCodeUE?: string;
  vatUE?: string;
  idCountryCode?: string;
  idNumber?: string;
  noId?: boolean;
  name?: string;
  address?: Fa3Address | string;
  buyerId?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// HEADER TYPES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Nagłówek faktury
 */
export interface Fa3Header {
  systemInfo?: string;
  creationDate?: Date | string;
}

/**
 * Opcje buildera nagłówka
 */
export interface HeaderBuilderOptions {
  indentSize?: number;
  indentChar?: string;
  baseLevel?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// INVOICE ITEM TYPES
// ─────────────────────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────────────────
// ANNOTATIONS TYPES
// ─────────────────────────────────────────────────────────────────────────────

export type Fa3Flag12 = 1 | 2;

/**
 * Nowy środek transportu (dla WDT)
 */
export interface Fa3NewTransportMeans {
  /** Typ: 1 = pojazd lądowy, 2 = jednostka pływająca, 3 = statek powietrzny */
  type: 1 | 2 | 3;

  /** Numer wiersza faktury z dostawą */
  lineNumber: number;

  /** Data dopuszczenia do użytku */
  firstUseDate: Date | string;

  /** Marka */
  brand?: string;
  /** Model */
  model?: string;
  /** Kolor */
  color?: string;
  /** Numer rejestracyjny */
  registrationNumber?: string;
  /** Rok produkcji */
  productionYear?: string;

  /** Opcjonalny typ/rodzaj (P_22BT) */
  transportType?: string; // <-- zamiast "type?: string" (bo "type" jest już 1|2|3)

  // ───────────────────────────
  // LAND (type=1)
  // ───────────────────────────
  /** Przebieg (dla pojazdów lądowych) */
  mileage?: string;

  /** Numer VIN (dla pojazdów lądowych) */
  vin?: string;
  /** Numer nadwozia */
  bodyNumber?: string;
  /** Numer podwozia */
  chassisNumber?: string;
  /** Numer ramy */
  frameNumber?: string;

  // ───────────────────────────
  // WATERCRAFT (type=2) / AIRCRAFT (type=3)
  // ───────────────────────────
  /** Liczba godzin roboczych (dla jednostek pływających/statków) */
  operatingHours?: string;

  /** Numer kadłuba (dla jednostek pływających) */
  hullNumber?: string;

  /** Numer fabryczny / seryjny (dla statków powietrznych) */
  serialNumber?: string;

  /**
   * BACKWARD-COMPAT:
   * Miałeś wcześniej `factoryNumber`. Zostawiamy jako alias,
   * żeby stare dane nie wywaliły kompilacji / runtime.
   */
  factoryNumber?: string;
}


/**
 * Adnotacje faktury
 */
export interface Fa3Annotations {
  /** Metoda kasowa (1 = tak, 2 = nie) */
  p_16?: Fa3Flag12;
  /** Samofakturowanie (1 = tak, 2 = nie) */
  p_17?: Fa3Flag12;
  /** Odwrotne obciążenie (1 = tak, 2 = nie) */
  p_18?: Fa3Flag12;
  /** Mechanizm podzielonej płatności (1 = tak, 2 = nie) */
  p_18a?: Fa3Flag12;

  /** Zwolnienie od podatku (1 = tak) */
  p_19?: 1;
  /** Podstawa zwolnienia - przepis ustawy */
  p_19a?: string;
  /** Podstawa zwolnienia - przepis dyrektywy */
  p_19b?: string;
  /** Podstawa zwolnienia - inna podstawa */
  p_19c?: string;

  /** WDT nowych środków transportu (1 = tak) */
  p_22?: 1;
  /** Obowiązek z art. 42 ust. 5 (1 = tak, 2 = nie) */
  p_42_5?: Fa3Flag12;
  /** Dane nowych środków transportu */
  newTransportMeans?: Fa3NewTransportMeans[];

  /** Procedura uproszczona trójstronna (1 = tak, 2 = nie) */
  p_23?: Fa3Flag12;

  /** Procedura marży (1 = tak) */
  p_pMarzy?: 1;
  /** Procedura marży - biura podróży */
  p_pMarzy_2?: 1;
  /** Procedura marży - towary używane */
  p_pMarzy_3_1?: 1;
  /** Procedura marży - dzieła sztuki */
  p_pMarzy_3_2?: 1;
  /** Procedura marży - przedmioty kolekcjonerskie i antyki */
  p_pMarzy_3_3?: 1;

  /** Dodatkowe pola (dla elastyczności) */
  [key: string]: Fa3Flag12 | 1 | string | Fa3NewTransportMeans[] | undefined;
}

// ─────────────────────────────────────────────────────────────────────────────
// PAYMENT TYPES
// ─────────────────────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────────────────
// ORDER TYPES (dla faktur zaliczkowych)
// ─────────────────────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────────────────
// SETTLEMENT TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface Fa3SettlementCharge {
  /** Powód obciążenia */
  reason: string;
  /** Kwota obciążenia */
  amount: number;
}

export interface Fa3SettlementDeduction {
  /** Powód odliczenia */
  reason: string;
  /** Kwota odliczenia */
  amount: number;
}

/**
 * Rozliczenie (dodatkowe obciążenia/odliczenia)
 */
export interface Fa3Settlement {
  /** Obciążenia (max 100) */
  charges?: Fa3SettlementCharge[];
  /** Odliczenia (max 100) */
  deductions?: Fa3SettlementDeduction[];
  /** Suma obciążeń */
  totalCharges?: number;
  /** Suma odliczeń */
  totalDeductions?: number;
  /** Kwota do zapłaty (P_15 + obciążenia - odliczenia) */
  amountToPay?: number;
  /** Kwota nadpłacona do rozliczenia/zwrotu */
  amountToSettle?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// TRANSACTION CONDITIONS TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface Fa3TransactionContractRef {
  date?: Date | string;
  number?: string;
}

export interface Fa3TransactionOrderRef {
  date?: Date | string;
  number?: string;
}

export interface Fa3TransportAddress {
  countryCode?: string;
  address?: string;
  line1?: string;
  line2?: string;
  gln?: string;
}

export interface Fa3Carrier {
  nip?: string;
  countryCodeUE?: string;
  vatUE?: string;
  idCountryCode?: string;
  idNumber?: string;
  noId?: boolean;
  name?: string;
  address?: Fa3TransportAddress;
}

/**
 * Rodzaj transportu:
 * 1 - Transport morski
 * 2 - Transport kolejowy
 * 3 - Transport drogowy
 * 4 - Transport lotniczy
 * 5 - Przesyłka pocztowa
 * 7 - Stałe instalacje przesyłowe
 * 8 - Żegluga śródlądowa
 */
export type Fa3TransportType = 1 | 2 | 3 | 4 | 5 | 7 | 8;

/**
 * Rodzaj ładunku:
 * 1-20 (Bańka, Beczka, Butla, Karton, Kanister, Klatka, Kontener, ...)
 */
export type Fa3CargoType = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 20;

export interface Fa3Transport {
  /** Rodzaj transportu */
  type?: Fa3TransportType;
  /** Inny rodzaj transportu */
  otherType?: boolean;
  /** Opis innego transportu */
  typeDescription?: string;
  /** Przewoźnik */
  carrier?: Fa3Carrier;
  /** Numer zlecenia transportu */
  orderNumber?: string;
  /** Rodzaj ładunku */
  cargoType?: Fa3CargoType;
  /** Inny ładunek */
  otherCargoType?: boolean;
  /** Opis ładunku */
  cargoDescription?: string;
  /** Jednostka opakowania */
  packagingUnit?: string;
  /** Data i godzina rozpoczęcia transportu */
  startDateTime?: Date | string;
  /** Data i godzina zakończenia transportu */
  endDateTime?: Date | string;
  /** Adres wysyłki */
  fromAddress?: Fa3TransportAddress;
  /** Adresy pośrednie */
  viaAddresses?: Fa3TransportAddress[];
  /** Adres docelowy */
  toAddress?: Fa3TransportAddress;
}

export interface Fa3TransactionConditions {
  /** Umowy powiązane */
  contracts?: Fa3TransactionContractRef[];
  /** Zamówienia powiązane */
  orders?: Fa3TransactionOrderRef[];
  /** Numery partii towaru */
  batchNumbers?: string[];
  /** Warunki dostawy (Incoterms) */
  deliveryTerms?: string;
  /** Kurs umowny */
  contractualRate?: number;
  /** Waluta umowna */
  contractualCurrency?: string;
  /** Dane transportu */
  transport?: Fa3Transport[];
  /** Podmiot pośredniczący w transakcji łańcuchowej */
  intermediary?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// FOOTER & ATTACHMENT TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface Fa3FooterInfo {
  text?: string;
}

export interface Fa3FooterRegistry {
  fullName?: string;
  krs?: string;
  regon?: string;
  bdo?: string;
}

export interface Fa3Footer {
  info?: Fa3FooterInfo[];
  registries?: Fa3FooterRegistry[];
}

export interface Fa3AttachmentMeta {
  key: string;
  value: string;
}

export type Fa3AttachmentText = string | string[];

export interface Fa3AttachmentTableMeta {
  key: string;
  value: string;
}

export interface Fa3AttachmentTableHeaderCol {
  name?: string;
  value?: string;
  type?: 'date' | 'datetime' | 'dec' | 'int' | 'time' | 'txt';
}

export type Fa3AttachmentTableHeader =
  | Fa3AttachmentTableHeaderCol[]
  | { columns: Fa3AttachmentTableHeaderCol[] };

export type Fa3AttachmentTableCell =
  | string
  | number
  | boolean
  | null
  | { value?: string | number | boolean | null };

export type Fa3AttachmentTableRow =
  | Fa3AttachmentTableCell[]
  | { cells: Fa3AttachmentTableCell[] };

export type Fa3AttachmentTableSummary =
  | Fa3AttachmentTableCell[]
  | { cells: Fa3AttachmentTableCell[] };

export interface Fa3AttachmentTable {
  metadata?: Fa3AttachmentTableMeta[];
  description?: string;
  header: Fa3AttachmentTableHeader;
  rows?: Fa3AttachmentTableRow[];
  summary?: Fa3AttachmentTableSummary | null;
}

export interface Fa3AttachmentBlock {
  header?: string;
  metadata?: Fa3AttachmentMeta[];
  text?: Fa3AttachmentText;
  tables?: Fa3AttachmentTable[];
}

export interface Fa3Attachment {
  blocks?: Fa3AttachmentBlock[];
}

// ─────────────────────────────────────────────────────────────────────────────
// INVOICE DETAILS TYPES
// ─────────────────────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────────────────
// GŁÓWNY TYP FAKTURY - Fa3Invoice
// ─────────────────────────────────────────────────────────────────────────────

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
    items: Array<Partial<Fa3InvoiceItem> & { name: string; quantity: number; netPrice: number; vatRate: string | number }>;
  };
  /** Opcjonalne - obliczane automatycznie */
  vatSummary?: Fa3VatSummary;
  /** Opcjonalne - obliczane automatycznie */
  summary?: Partial<Fa3InvoiceSummary>;
  footer?: Fa3Footer;
  attachment?: Fa3Attachment;
}

// ─────────────────────────────────────────────────────────────────────────────
// CALCULATOR TYPES
// ─────────────────────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────────────────
// BUILDER OPTIONS TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface Fa3BuilderOptions {
  indentSize?: number;
  indentChar?: string;
  baseLevel?: number;
}

export interface InvoiceDetailsBuilderOptions extends Fa3BuilderOptions {}

// ─────────────────────────────────────────────────────────────────────────────
// HELPER TYPES (dla builderów i walidatorów)
// ─────────────────────────────────────────────────────────────────────────────

export type Fa3AnnotationsBuildDetails = Record<string, unknown>;

export interface Fa3InvoiceItemForAnnotations {
  vatRate?: string | number;
  attachment15?: 1 | boolean;
  isMargin?: boolean;
}

export interface Fa3InvoiceForAnnotations {
  details?: {
    annotations?: Fa3Annotations;
    items?: Fa3InvoiceItemForAnnotations[];
  };
}