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
