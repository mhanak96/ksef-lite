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
