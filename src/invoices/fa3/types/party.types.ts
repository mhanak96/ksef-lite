import type { Fa3Address } from './address.types';

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
   * (masz też noId; to jest "alias" pod Twoją logikę buildera)
   */
  isConsumer?: boolean;

  /**
   * Kod kraju dla identyfikatora NrID (ThirdPartyBuilder używa tego jako <KodKraju>)
   * UWAGA: to jest osobne od countryCodeUE (UE VAT).
   */
  countryCode?: string;

  /**
   * Flaga "inna rola" – ThirdPartyBuilder używa:
   *  - customRole + customRoleDescription => <RolaInna> + <OpisRoli>
   */
  customRole?: boolean;

  /** Opis "innej roli" dla <OpisRoli> */
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
