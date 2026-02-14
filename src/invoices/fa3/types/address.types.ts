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
