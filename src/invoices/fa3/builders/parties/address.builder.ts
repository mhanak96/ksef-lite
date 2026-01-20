import type { Fa3BuildContext } from '../../validators/build-context';
import type { Fa3Address, Fa3ContactDetails } from '../../types';

export type AddressBuilderOptions = {
  indentSize?: number;
  indentChar?: string;
};

export class AddressBuilder {
  private readonly indentSize: number;
  private readonly indentChar: string;

  constructor(options: AddressBuilderOptions = {}) {
    this.indentSize = options.indentSize ?? 2;
    this.indentChar = options.indentChar ?? ' ';
  }

  // ============================================================
  // PUBLIC API
  // ============================================================

  public buildAddress(
    data: Fa3Address,
    level: number,
    ctx?: Fa3BuildContext
  ): string {
    const innerLevel = level + 1;
    const elements: Array<string | null> = [];

    // KodKraju (wymagany)
    if (!data.countryCode) {
      this.vWarn(ctx, 'MISSING_COUNTRY', 'address.countryCode', 'Brak kodu kraju, użyto domyślnie PL');
    }
    elements.push(this.element('KodKraju', data.countryCode ?? 'PL', innerLevel));

    // Adres w formacie liniowym (AdresL1, AdresL2) lub strukturalnym
    if (data.address || data.line1) {
      elements.push(this.element('AdresL1', data.address ?? data.line1, innerLevel));

      if (this.hasValue(data.line2)) {
        elements.push(this.element('AdresL2', data.line2, innerLevel));
      }
    } else if (data.street || data.city) {
      const addressLine = this.buildAddressLine(data);
      elements.push(this.element('AdresL1', addressLine, innerLevel));
    } else {
      this.vError(ctx, 'REQUIRED', 'address.line1', 'Brak pierwszej linii adresu');
    }

    // GLN (opcjonalny)
    if (this.hasValue(data.gln)) {
      elements.push(this.element('GLN', data.gln, innerLevel));
    }

    return this.block('Adres', this.joinElements(elements), level) ?? '';
  }

  public buildCorrespondenceAddress(
    data: Fa3Address | null | undefined,
    level: number,
    ctx?: Fa3BuildContext
  ): string | null {
    if (!data) return null;

    const innerLevel = level + 1;
    const elements: Array<string | null> = [];

    if (!data.countryCode) {
      this.vWarn(ctx, 'MISSING_COUNTRY', 'correspondenceAddress.countryCode', 'Brak kodu kraju, użyto domyślnie PL');
    }
    elements.push(this.element('KodKraju', data.countryCode ?? 'PL', innerLevel));

    if (data.address || data.line1) {
      elements.push(this.element('AdresL1', data.address ?? data.line1, innerLevel));

      if (this.hasValue(data.line2)) {
        elements.push(this.element('AdresL2', data.line2, innerLevel));
      }
    } else if (data.street || data.city) {
      const addressLine = this.buildAddressLine(data);
      elements.push(this.element('AdresL1', addressLine, innerLevel));
    }

    if (this.hasValue(data.gln)) {
      elements.push(this.element('GLN', data.gln, innerLevel));
    }

    return this.block('AdresKoresp', this.joinElements(elements), level);
  }

  public buildContactDetails(
    contact: Fa3ContactDetails | null | undefined,
    level: number,
    emailTag: string = 'Email',
    phoneTag: string = 'Telefon'
  ): string | null {
    if (!contact) return null;

    const innerLevel = level + 1;
    const elements: Array<string | null> = [];

    if (this.hasValue(contact.email)) {
      elements.push(this.element(emailTag, contact.email, innerLevel));
    }

    if (this.hasValue(contact.phone)) {
      elements.push(this.element(phoneTag, contact.phone, innerLevel));
    }

    const xml = this.joinElements(elements);
    if (!xml) return null;

    return this.block('DaneKontaktowe', xml, level);
  }

  public buildContactDetailsList(
    contacts: Fa3ContactDetails[] | null | undefined,
    level: number,
    emailTag: string = 'Email',
    phoneTag: string = 'Telefon'
  ): string | null {
    if (!contacts || !Array.isArray(contacts) || contacts.length === 0) {
      return null;
    }

    // Maksymalnie 3 kontakty (zgodnie ze schematem FA(3))
    const limitedContacts = contacts.slice(0, 3);

    const elements: Array<string | null> = limitedContacts.map((c) =>
      this.buildContactDetails(c, level, emailTag, phoneTag)
    );

    const xml = this.joinElements(elements);
    return xml ? xml : null;
  }

  public buildDeliveryAddress(
    data: Fa3Address | null | undefined,
    level: number,
    tagName: string,
    ctx?: Fa3BuildContext
  ): string | null {
    if (!data) return null;

    const innerLevel = level + 1;
    const elements: Array<string | null> = [];

    if (!data.countryCode) {
      this.vWarn(ctx, 'MISSING_COUNTRY', `${tagName}.countryCode`, 'Brak kodu kraju, użyto domyślnie PL');
    }
    elements.push(this.element('KodKraju', data.countryCode ?? 'PL', innerLevel));

    // AdresL1 wymagany
    if (!data.address && !data.line1) {
      this.vError(ctx, 'REQUIRED', `${tagName}.line1`, 'Brak pierwszej linii adresu dostawy');
    }
    elements.push(this.element('AdresL1', data.address ?? data.line1 ?? '', innerLevel));

    if (this.hasValue(data.line2)) {
      elements.push(this.element('AdresL2', data.line2, innerLevel));
    }

    if (this.hasValue(data.gln)) {
      elements.push(this.element('GLN', data.gln, innerLevel));
    }

    return this.block(tagName, this.joinElements(elements), level);
  }

  public buildStructuredAddress(
    data: Fa3Address,
    level: number,
    ctx?: Fa3BuildContext
  ): string {
    const innerLevel = level + 1;
    const elements: Array<string | null> = [];

    if (!data.countryCode) {
      this.vWarn(ctx, 'MISSING_COUNTRY', 'address.countryCode', 'Brak kodu kraju, użyto domyślnie PL');
    }
    elements.push(this.element('KodKraju', data.countryCode ?? 'PL', innerLevel));

    if (this.hasValue(data.province)) {
      elements.push(this.element('Wojewodztwo', data.province, innerLevel));
    }
    if (this.hasValue(data.county)) {
      elements.push(this.element('Powiat', data.county, innerLevel));
    }
    if (this.hasValue(data.municipality)) {
      elements.push(this.element('Gmina', data.municipality, innerLevel));
    }
    if (this.hasValue(data.city)) {
      elements.push(this.element('Miejscowosc', data.city, innerLevel));
    }
    if (this.hasValue(data.street)) {
      elements.push(this.element('Ulica', data.street, innerLevel));
    }
    if (this.hasValue(data.buildingNumber)) {
      elements.push(this.element('NrDomu', data.buildingNumber, innerLevel));
    }
    if (this.hasValue(data.apartmentNumber)) {
      elements.push(this.element('NrLokalu', data.apartmentNumber, innerLevel));
    }
    if (this.hasValue(data.postalCode)) {
      elements.push(this.element('KodPocztowy', data.postalCode, innerLevel));
    }
    if (this.hasValue(data.postOffice)) {
      elements.push(this.element('Poczta', data.postOffice, innerLevel));
    }
    if (this.hasValue(data.gln)) {
      elements.push(this.element('GLN', data.gln, innerLevel));
    }

    return this.block('Adres', this.joinElements(elements), level) ?? '';
  }

  public buildForeignAddress(
    data: Fa3Address,
    level: number,
    ctx?: Fa3BuildContext
  ): string {
    const innerLevel = level + 1;
    const elements: Array<string | null> = [];

    if (!data.countryCode) {
      this.vWarn(ctx, 'MISSING_COUNTRY', 'address.countryCode', 'Brak kodu kraju dla adresu zagranicznego');
    }
    elements.push(this.element('KodKraju', data.countryCode ?? 'PL', innerLevel));

    if (data.address || data.line1) {
      elements.push(this.element('AdresL1', data.address ?? data.line1, innerLevel));

      if (this.hasValue(data.line2)) {
        elements.push(this.element('AdresL2', data.line2, innerLevel));
      }
    } else {
      const parts: string[] = [];
      if (data.street) parts.push(data.street);
      if (data.buildingNumber) parts.push(data.buildingNumber);
      if (data.postalCode) parts.push(data.postalCode);
      if (data.city) parts.push(data.city);
      if (data.region) parts.push(data.region);

      if (parts.length > 0) {
        elements.push(this.element('AdresL1', parts.join(', '), innerLevel));
      } else {
        this.vError(ctx, 'REQUIRED', 'address.line1', 'Brak danych adresowych');
      }
    }

    if (this.hasValue(data.gln)) {
      elements.push(this.element('GLN', data.gln, innerLevel));
    }

    return this.block('Adres', this.joinElements(elements), level) ?? '';
  }

  public buildAutoAddress(
    data: Fa3Address | null | undefined,
    level: number,
    ctx?: Fa3BuildContext
  ): string | null {
    if (!data) return null;

    const countryCode = data.countryCode ?? 'PL';
    if (countryCode !== 'PL') {
      return this.buildForeignAddress(data, level, ctx);
    }

    return this.buildAddress(data, level, ctx);
  }

  // ============================================================
  // PRIVATE HELPERS
  // ============================================================

  private buildAddressLine(data: Fa3Address): string {
    const parts: string[] = [];

    if (data.street) {
      let streetPart = data.street;

      if (data.buildingNumber) {
        streetPart += ` ${data.buildingNumber}`;
        if (data.apartmentNumber) {
          streetPart += `/${data.apartmentNumber}`;
        }
      }

      parts.push(streetPart);
    }

    if (data.postalCode || data.city) {
      let cityPart = '';
      if (data.postalCode) cityPart = data.postalCode;
      if (data.city) cityPart += cityPart ? ` ${data.city}` : data.city;
      parts.push(cityPart);
    }

    return parts.join(', ');
  }

  // ============================================================
  // VALIDATION HELPERS
  // ============================================================

  protected vError(
    ctx: Fa3BuildContext | undefined,
    code: string,
    path: string,
    message: string
  ): void {
    ctx?.error('AddressBuilder', code, path, message);
  }

  protected vWarn(
    ctx: Fa3BuildContext | undefined,
    code: string,
    path: string,
    message: string
  ): void {
    ctx?.warn('AddressBuilder', code, path, message);
  }

  // ============================================================
  // XML FORMATTING HELPERS
  // ============================================================

  protected indent(level: number): string {
    return this.indentChar.repeat(level * this.indentSize);
  }

  protected element(tagName: string, value: unknown, level: number): string | null {
    if (value === undefined || value === null || value === '') return null;
    return `${this.indent(level)}<${tagName}>${this.escapeXml(value)}</${tagName}>`;
  }

  protected block(
    tagName: string,
    content: string | null | undefined,
    level: number
  ): string | null {
    if (!content || content.trim() === '') return null;
    return `${this.indent(level)}<${tagName}>\n${content}\n${this.indent(level)}</${tagName}>`;
  }

  protected escapeXml(text: unknown): string {
    const str = String(text ?? '');
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  // ============================================================
  // UTILITY HELPERS
  // ============================================================

  protected joinElements(elements: Array<string | null | undefined>): string {
    return elements
      .filter((e): e is string => e !== null && e !== undefined && e !== '')
      .join('\n');
  }

  protected hasValue(value: unknown): boolean {
    return value !== undefined && value !== null && value !== '';
  }
}