import type { Fa3BuildContext } from '../../../validators/build-context';
import type {
  Fa3Transport,
  Fa3Carrier,
  Fa3TransportAddress,
} from '../../../types';

export class TransportBuilder {
  private indentSize: number = 2;
  private indentChar: string = ' ';
  private builderName: string = 'TransportBuilder';

  // ============================================================
  // PUBLIC API
  // ============================================================

  public buildAll(
    transports: Fa3Transport[] | null | undefined,
    level: number,
    ctx?: Fa3BuildContext
  ): string | null {
    if (!transports || transports.length === 0) return null;

    if (transports.length > 20) {
      this.vWarn(
        ctx,
        'LIMIT',
        'conditions.transport',
        'Liczba transportów przekracza limit 20. Przetworzono tylko pierwsze 20.'
      );
    }

    const limited = transports.slice(0, 20);
    const elements = limited.map((t, i) => this.build(t, level, ctx, i));

    return this.joinElements(elements);
  }

  public build(
    transport: Fa3Transport,
    level: number,
    ctx?: Fa3BuildContext,
    index?: number
  ): string | null {
    const path = `transport[${index ?? 0}]`;
    const innerLevel = level + 1;
    const elements: Array<string | null> = [];

    // RodzajTransportu (opcjonalne)
    if (transport.type !== undefined && transport.type !== null) {
      if (!this.reqOneOf(
        ctx,
        `${path}.type`,
        transport.type,
        [1, 2, 3, 4, 5, 7, 8] as const,
        'RodzajTransportu musi być 1-5, 7 lub 8'
      )) {
        return null;
      }
      elements.push(this.element('RodzajTransportu', transport.type, innerLevel));
    }
    // TransportInny + OpisInnegoTransportu (opcjonalne)
    else if (transport.otherType === true) {
      elements.push(this.element('TransportInny', '1', innerLevel));

      if (!this.reqString(
        ctx,
        `${path}.typeDescription`,
        transport.typeDescription,
        'Brak opisu innego rodzaju transportu'
      )) {
        return null;
      }
      elements.push(this.element('OpisInnegoTransportu', transport.typeDescription, innerLevel));
    }

    // Przewoznik (opcjonalne)
    if (transport.carrier) {
      const carrierXml = this.buildCarrier(transport.carrier, innerLevel, ctx);
      if (carrierXml) elements.push(carrierXml);
    }

    // NrZleceniaTransportu (opcjonalne)
    if (this.hasValue(transport.orderNumber)) {
      elements.push(this.element('NrZleceniaTransportu', transport.orderNumber, innerLevel));
    }

    // OpisLadunku (opcjonalne)
    if (transport.cargoType !== undefined && transport.cargoType !== null) {
      if (!this.reqOneOf(
        ctx,
        `${path}.cargoType`,
        transport.cargoType,
        [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20] as const,
        'OpisLadunku musi być 1-20'
      )) {
        return null;
      }
      elements.push(this.element('OpisLadunku', transport.cargoType, innerLevel));
    }
    // LadunekInny + OpisInnegoLadunku (opcjonalne)
    else if (transport.otherCargoType === true) {
      elements.push(this.element('LadunekInny', '1', innerLevel));

      if (!this.reqString(
        ctx,
        `${path}.cargoDescription`,
        transport.cargoDescription,
        'Brak opisu innego ładunku'
      )) {
        return null;
      }
      elements.push(this.element('OpisInnegoLadunku', transport.cargoDescription, innerLevel));
    }

    // JednostkaOpakowania (opcjonalne)
    if (this.hasValue(transport.packagingUnit)) {
      elements.push(this.element('JednostkaOpakowania', transport.packagingUnit, innerLevel));
    }

    // DataGodzRozpTransportu (opcjonalne)
    if (transport.startDateTime) {
      elements.push(this.dateTimeElement('DataGodzRozpTransportu', transport.startDateTime, innerLevel));
    }

    // DataGodzZakTransportu (opcjonalne)
    if (transport.endDateTime) {
      elements.push(this.dateTimeElement('DataGodzZakTransportu', transport.endDateTime, innerLevel));
    }

    // WysylkaZ (opcjonalne)
    if (transport.fromAddress) {
      const fromXml = this.buildTransportAddress(transport.fromAddress, innerLevel, 'WysylkaZ', ctx);
      if (fromXml) elements.push(fromXml);
    }

    // WysylkaPrzez (0-20)
    if (transport.viaAddresses && transport.viaAddresses.length > 0) {
      if (transport.viaAddresses.length > 20) {
        this.vWarn(
          ctx,
          'LIMIT',
          `${path}.viaAddresses`,
          'Liczba adresów pośrednich przekracza limit 20. Przetworzono tylko pierwsze 20.'
        );
      }

      const via = transport.viaAddresses.slice(0, 20);
      for (const addr of via) {
        const viaXml = this.buildTransportAddress(addr, innerLevel, 'WysylkaPrzez', ctx);
        if (viaXml) elements.push(viaXml);
      }
    }

    // WysylkaDo (opcjonalne)
    if (transport.toAddress) {
      const toXml = this.buildTransportAddress(transport.toAddress, innerLevel, 'WysylkaDo', ctx);
      if (toXml) elements.push(toXml);
    }

    const xml = this.joinElements(elements);
    return xml ? this.block('Transport', xml, level) : null;
  }

  // ============================================================
  // PRIVATE BUILDERS
  // ============================================================

  private buildCarrier(
    carrier: Fa3Carrier,
    level: number,
    ctx?: Fa3BuildContext
  ): string | null {
    const innerLevel = level + 1;
    const elements: Array<string | null> = [];

    // DaneIdentyfikacyjne
    const identElements: Array<string | null> = [];

    if (this.hasValue(carrier.nip)) {
      identElements.push(this.element('NIP', carrier.nip, innerLevel + 1));
    } else if (this.hasValue(carrier.vatUE) && this.hasValue(carrier.countryCodeUE)) {
      identElements.push(this.element('KodUE', carrier.countryCodeUE, innerLevel + 1));
      identElements.push(this.element('NrVatUE', carrier.vatUE, innerLevel + 1));
    } else if (this.hasValue(carrier.idNumber)) {
      if (this.hasValue(carrier.idCountryCode)) {
        identElements.push(this.element('KodKraju', carrier.idCountryCode, innerLevel + 1));
      }
      identElements.push(this.element('NrID', carrier.idNumber, innerLevel + 1));
    } else if (carrier.noId === true) {
      identElements.push(this.element('BrakID', '1', innerLevel + 1));
    }

    if (this.hasValue(carrier.name)) {
      identElements.push(this.element('Nazwa', carrier.name, innerLevel + 1));
    }

    const identXml = this.joinElements(identElements);
    if (identXml) {
      elements.push(this.block('DaneIdentyfikacyjne', identXml, innerLevel));
    }

    // AdresPrzewoznika
    if (carrier.address) {
      const addressXml = this.buildTransportAddress(carrier.address, innerLevel, 'AdresPrzewoznika', ctx);
      if (addressXml) elements.push(addressXml);
    }

    const xml = this.joinElements(elements);
    return xml ? this.block('Przewoznik', xml, level) : null;
  }

  private buildTransportAddress(
    data: Fa3TransportAddress,
    level: number,
    tagName: string,
    ctx?: Fa3BuildContext
  ): string | null {
    const innerLevel = level + 1;
    const elements: Array<string | null> = [];

    // KodKraju (domyślnie PL)
    const country = this.hasValue(data.countryCode) ? data.countryCode! : 'PL';
    elements.push(this.element('KodKraju', country, innerLevel));

    // AdresL1 (wymagane)
    const line1 = data.address ?? data.line1;
    if (!this.hasValue(line1)) {
      this.vError(ctx, 'REQUIRED', `${tagName}.line1`, 'Brak pierwszej linii adresu transportowego');
      return null;
    }
    elements.push(this.element('AdresL1', line1, innerLevel));

    // AdresL2 (opcjonalne)
    if (this.hasValue(data.line2)) {
      elements.push(this.element('AdresL2', data.line2, innerLevel));
    }

    // GLN (opcjonalne)
    if (this.hasValue(data.gln)) {
      elements.push(this.element('GLN', data.gln, innerLevel));
    }

    const xml = this.joinElements(elements);
    return xml ? this.block(tagName, xml, level) : null;
  }

  // ============================================================
  // VALIDATION HELPERS
  // ============================================================

  private vError(
    ctx: Fa3BuildContext | undefined,
    code: string,
    path: string,
    message: string
  ): void {
    ctx?.error(this.builderName, code, path, message);
  }

  private vWarn(
    ctx: Fa3BuildContext | undefined,
    code: string,
    path: string,
    message: string
  ): void {
    ctx?.warn(this.builderName, code, path, message);
  }

  private reqString(
    ctx: Fa3BuildContext | undefined,
    path: string,
    value: unknown,
    message: string
  ): value is string {
    if (typeof value === 'string' && value.trim() !== '') return true;
    this.vError(ctx, 'REQUIRED', path, message);
    return false;
  }

  private reqOneOf<T extends string | number | boolean>(
    ctx: Fa3BuildContext | undefined,
    path: string,
    value: unknown,
    allowed: readonly T[],
    message: string
  ): value is T {
    if ((allowed as readonly unknown[]).includes(value)) return true;
    this.vError(ctx, 'ONE_OF', path, `${message}. Dozwolone wartości: ${allowed.join(', ')}`);
    return false;
  }

  // ============================================================
  // XML FORMATTING HELPERS
  // ============================================================

  private indent(level: number): string {
    return this.indentChar.repeat(level * this.indentSize);
  }

  private element(tagName: string, value: unknown, level: number): string | null {
    if (value === undefined || value === null || value === '') return null;
    return `${this.indent(level)}<${tagName}>${this.escapeXml(value)}</${tagName}>`;
  }

  private block(
    tagName: string,
    content: string | null | undefined,
    level: number
  ): string | null {
    if (!content || content.trim() === '') return null;
    return `${this.indent(level)}<${tagName}>\n${content}\n${this.indent(level)}</${tagName}>`;
  }

  private dateTimeElement(
    tagName: string,
    dateTime: Date | string | null | undefined,
    level: number
  ): string | null {
    if (!dateTime) return null;
    const formatted = this.formatDateTime(dateTime);
    return this.element(tagName, formatted, level);
  }

  // ============================================================
  // VALUE FORMATTERS
  // ============================================================

  private formatDateTime(dateTime: Date | string): string {
    if (!dateTime) return '';

    if (typeof dateTime === 'string') {
      if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(dateTime)) return dateTime;
      dateTime = new Date(dateTime);
    }

    return dateTime.toISOString();
  }

  private escapeXml(text: unknown): string {
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

  private joinElements(elements: Array<string | null | undefined>): string {
    return elements
      .filter((e): e is string => e !== null && e !== undefined && e !== '')
      .join('\n');
  }

  private hasValue(value: unknown): boolean {
    return value !== undefined && value !== null && value !== '';
  }
}