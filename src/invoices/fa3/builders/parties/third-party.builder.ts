import type { Fa3BuildContext } from '../../validators/build-context';
import type { Fa3Address, Fa3ThirdParty } from '../../types';

export type ThirdPartyBuilderOptions = {
  indentSize?: number;
  indentChar?: string;
  baseLevel?: number;
};

export class ThirdPartyBuilder {
  private readonly indentSize: number;
  private readonly indentChar: string;
  private readonly baseLevel: number;

  constructor(options: ThirdPartyBuilderOptions = {}) {
    this.indentSize = options.indentSize ?? 2;
    this.indentChar = options.indentChar ?? ' ';
    this.baseLevel = options.baseLevel ?? 1;
  }

  buildAll(parties: Fa3ThirdParty[], ctx?: Fa3BuildContext): string | null {
    if (!parties || parties.length === 0) return null;

    // Maksymalnie 100 podmiotów trzecich
    const limited = parties.slice(0, 100);

    const elements: string[] = [];
    for (const party of limited) {
      const xml = this.build(party, ctx);
      if (xml) elements.push(xml);
    }

    return elements.join('\n');
  }

  build(party: Fa3ThirdParty, ctx?: Fa3BuildContext): string | null {
    const level = this.baseLevel;
    const innerLevel = level + 1;

    if (!party) {
      this.vError(
        ctx,
        'REQUIRED',
        'thirdParty',
        'Brak danych podmiotu trzeciego'
      );
      return null;
    }

    const elements: Array<string | null> = [];

    // IDNabywcy - unikalny klucz (opcjonalny)
    if (this.hasValue(party.buyerId)) {
      elements.push(this.element('IDNabywcy', party.buyerId, innerLevel));
    }

    // NrEORI (opcjonalny)
    if (this.hasValue(party.eoriNumber)) {
      elements.push(this.element('NrEORI', party.eoriNumber, innerLevel));
    }

    // DaneIdentyfikacyjne (wymagane)
    const identXml = this.buildIdentification(party, innerLevel, ctx);
    if (identXml) elements.push(identXml);

    // Adres (opcjonalny)
    if (party.address) {
      const addressXml = this.buildAddress(
        party.address,
        'thirdParty.address',
        innerLevel + 1,
        ctx
      );
      if (addressXml) {
        elements.push(this.block('Adres', addressXml, innerLevel));
      }
    }

    // AdresKoresp (opcjonalny)
    if (party.correspondenceAddress) {
      const corrAddressXml = this.buildAddress(
        party.correspondenceAddress,
        'thirdParty.correspondenceAddress',
        innerLevel + 1,
        ctx
      );
      if (corrAddressXml) {
        elements.push(this.block('AdresKoresp', corrAddressXml, innerLevel));
      }
    }

    // DaneKontaktowe (0-3)
    const contactXml = this.buildContact(party, innerLevel);
    if (contactXml) elements.push(contactXml);

    // Rola lub RolaInna (wymagane)
    const roleXml = this.buildRole(party, innerLevel, ctx);
    if (roleXml) elements.push(roleXml);

    // Udzial (opcjonalny, tylko dla dodatkowego nabywcy)
    if (this.hasValue(party.share)) {
      elements.push(this.element('Udzial', party.share, innerLevel));
    }

    // NrKlienta (opcjonalny)
    if (this.hasValue(party.customerNumber)) {
      elements.push(
        this.element('NrKlienta', party.customerNumber, innerLevel)
      );
    }

    return this.block('Podmiot3', this.joinElements(elements), level);
  }

  private buildIdentification(
    party: Fa3ThirdParty,
    blockLevel: number,
    ctx?: Fa3BuildContext
  ): string | null {
    const elementLevel = blockLevel + 1;
    const elements: Array<string | null> = [];

    // Identyfikator (choice: NIP, IDWew, VAT UE, NrID, BrakID)
    if (party.isConsumer || party.noId) {
      elements.push(this.element('BrakID', '1', elementLevel));
    } else if (party.internalId) {
      // IDWew - identyfikator wewnętrzny z NIP
      elements.push(this.element('IDWew', party.internalId, elementLevel));
    } else if (party.vatUE) {
      if (party.countryCodeUE) {
        elements.push(this.element('KodUE', party.countryCodeUE, elementLevel));
      }
      elements.push(this.element('NrVatUE', party.vatUE, elementLevel));
    } else if (party.nip) {
      elements.push(this.element('NIP', party.nip, elementLevel));
    } else if (party.idNumber) {
      if (party.countryCode) {
        elements.push(
          this.element('KodKraju', party.countryCode, elementLevel)
        );
      }
      elements.push(this.element('NrID', party.idNumber, elementLevel));
    } else {
      this.vError(
        ctx,
        'REQUIRED',
        'thirdParty.identifier',
        'Brak identyfikatora podmiotu trzeciego (NIP, IDWew, VAT UE, NrID lub ustaw noId)'
      );
    }

    // Nazwa (opcjonalna)
    if (party.name) {
      elements.push(this.element('Nazwa', party.name, elementLevel));
    }

    return this.block(
      'DaneIdentyfikacyjne',
      this.joinElements(elements),
      blockLevel
    );
  }

  private buildAddress(
    address: Fa3Address | string | undefined,
    path: string,
    elementLevel: number,
    ctx?: Fa3BuildContext
  ): string | null {
    if (!address) {
      return null;
    }

    const elements: Array<string | null> = [];

    if (typeof address === 'string') {
      const lines = address
        .split(',')
        .map((l) => l.trim())
        .filter(Boolean);

      elements.push(this.element('KodKraju', 'PL', elementLevel));

      if (lines[0]) {
        elements.push(this.element('AdresL1', lines[0], elementLevel));
      } else {
        this.vError(
          ctx,
          'REQUIRED',
          `${path}.line1`,
          'Brak pierwszej linii adresu'
        );
      }

      if (lines[1]) {
        elements.push(this.element('AdresL2', lines[1], elementLevel));
      }

      return this.joinElements(elements);
    }

    if (!address.countryCode) {
      this.vError(
        ctx,
        'REQUIRED',
        `${path}.countryCode`,
        'Brak kodu kraju w adresie'
      );
    }
    elements.push(
      this.element('KodKraju', address.countryCode ?? 'PL', elementLevel)
    );

    if (!address.line1) {
      this.vError(
        ctx,
        'REQUIRED',
        `${path}.line1`,
        'Brak pierwszej linii adresu'
      );
    }
    elements.push(this.element('AdresL1', address.line1 ?? '', elementLevel));

    if (address.line2) {
      elements.push(this.element('AdresL2', address.line2, elementLevel));
    }

    // GLN (opcjonalny)
    if (this.hasValue((address as any).gln)) {
      elements.push(this.element('GLN', (address as any).gln, elementLevel));
    }

    return this.joinElements(elements);
  }

  private buildContact(
    party: Fa3ThirdParty,
    blockLevel: number
  ): string | null {
    if (!party.email && !party.phone) return null;

    const elementLevel = blockLevel + 1;
    const elements: Array<string | null> = [];

    if (party.email) {
      elements.push(this.element('Email', party.email, elementLevel));
    }
    if (party.phone) {
      elements.push(this.element('Telefon', party.phone, elementLevel));
    }

    return this.block(
      'DaneKontaktowe',
      this.joinElements(elements),
      blockLevel
    );
  }

  private buildRole(
    party: Fa3ThirdParty,
    level: number,
    ctx?: Fa3BuildContext
  ): string | null {
    const elements: Array<string | null> = [];

    if (party.customRole && party.customRoleDescription) {
      // RolaInna + OpisRoli
      elements.push(this.element('RolaInna', '1', level));
      elements.push(
        this.element('OpisRoli', party.customRoleDescription, level)
      );
    } else if (party.role) {
      // Rola (1-11)
      const allowedRoles = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] as const;
      if (!allowedRoles.includes(party.role as any)) {
        this.vError(
          ctx,
          'INVALID_ROLE',
          'thirdParty.role',
          `Nieprawidłowa rola podmiotu trzeciego: ${party.role}. Dozwolone: 1-11`
        );
      }
      elements.push(this.element('Rola', String(party.role), level));
    } else {
      this.vError(
        ctx,
        'REQUIRED',
        'thirdParty.role',
        'Brak roli podmiotu trzeciego'
      );
    }

    return this.joinElements(elements);
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
    ctx?.error('ThirdPartyBuilder', code, path, message);
  }

  protected vWarn(
    ctx: Fa3BuildContext | undefined,
    code: string,
    path: string,
    message: string
  ): void {
    ctx?.warn('ThirdPartyBuilder', code, path, message);
  }

  // ============================================================
  // XML FORMATTING HELPERS
  // ============================================================

  protected indent(level: number): string {
    return this.indentChar.repeat(level * this.indentSize);
  }

  protected element(
    tagName: string,
    value: unknown,
    level: number
  ): string | null {
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
