import type { Fa3BuildContext } from '../../validators/build-context';
import type { Fa3Address, Fa3Buyer, Fa3CorrectedBuyer } from '../../types';

export type BuyerBuilderOptions = {
  indentSize?: number;
  indentChar?: string;
  baseLevel?: number;
};

export class BuyerBuilder {
  private readonly indentSize: number;
  private readonly indentChar: string;
  private readonly baseLevel: number;

  constructor(options: BuyerBuilderOptions = {}) {
    this.indentSize = options.indentSize ?? 2;
    this.indentChar = options.indentChar ?? ' ';
    this.baseLevel = options.baseLevel ?? 1;
  }

  build(buyer: Fa3Buyer, ctx?: Fa3BuildContext): string | null {
    return this.buildAs('Podmiot2', buyer, ctx);
  }

  buildAs(
    tagName: 'Podmiot2' | 'Podmiot2K' | string,
    buyer: Fa3Buyer | Fa3CorrectedBuyer,
    ctx?: Fa3BuildContext,
    levelOverride?: number
  ): string | null {
    const level = levelOverride ?? this.baseLevel;
    const innerLevel = level + 1;

    if (!buyer) {
      this.vError(ctx, 'REQUIRED', 'buyer', 'Brak danych nabywcy');
      return null;
    }

    const elements: Array<string | null> = [];

    const identXml = this.buildIdentification(buyer, innerLevel, ctx);
    if (identXml) elements.push(identXml);

    const addressXml = this.buildAddress(
      buyer.address,
      'buyer.address',
      innerLevel + 1,
      ctx
    );
    if (addressXml) {
      elements.push(this.block('Adres', addressXml, innerLevel));
    }

    const contactXml = this.buildContact(buyer, innerLevel);
    if (contactXml) elements.push(contactXml);

    // NrKlienta (opcjonalne)
    const bAnyOuter = buyer as any;
    if (this.hasValue(bAnyOuter.customerNumber)) {
      elements.push(this.element('NrKlienta', bAnyOuter.customerNumber, innerLevel));
    }

    if (tagName === 'Podmiot2') {
      elements.push(...this.buildJstAndGv(buyer as Fa3Buyer, innerLevel, ctx));
    }

    return this.block(tagName, this.joinElements(elements), level);
  }

  private buildIdentification(
    buyer: Fa3Buyer | Fa3CorrectedBuyer,
    blockLevel: number,
    ctx?: Fa3BuildContext
  ): string | null {
    const elementLevel = blockLevel + 1;
    const elements: Array<string | null> = [];
    const bAny = buyer as any;

    if (bAny.isConsumer) {
      elements.push(this.element('BrakID', '1', elementLevel));
    } else if (bAny.vatUE) {
      if (bAny.countryCodeUE) {
        elements.push(this.element('KodUE', bAny.countryCodeUE, elementLevel));
      }
      elements.push(this.element('NrVatUE', bAny.vatUE, elementLevel));
    } else if (bAny.nip) {
      elements.push(this.element('NIP', bAny.nip, elementLevel));
    } else if (bAny.idNumber) {
      if (bAny.countryCode) {
        elements.push(this.element('KodKraju', bAny.countryCode, elementLevel));
      }
      elements.push(this.element('NrID', bAny.idNumber, elementLevel));
    } else if (bAny.noId) {
      elements.push(this.element('BrakID', '1', elementLevel));
    } else {
      this.vError(
        ctx,
        'REQUIRED',
        'buyer.identifier',
        'Brak identyfikatora nabywcy (NIP, VAT UE lub ustaw isConsumer/noId)'
      );
    }

    if (bAny.name) {
      elements.push(this.element('Nazwa', bAny.name, elementLevel));
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

    // GLN (opcjonalne)
    if ((address as any).gln) {
      elements.push(this.element('GLN', (address as any).gln, elementLevel));
    }

    return this.joinElements(elements);
  }

  private buildContact(
    buyer: Fa3Buyer | Fa3CorrectedBuyer,
    blockLevel: number
  ): string | null {
    const bAny = buyer as any;

    if (!bAny.email && !bAny.phone) return null;

    const elementLevel = blockLevel + 1;
    const elements: Array<string | null> = [];

    if (bAny.email) {
      elements.push(this.element('Email', bAny.email, elementLevel));
    }
    if (bAny.phone) {
      elements.push(this.element('Telefon', bAny.phone, elementLevel));
    }

    return this.block(
      'DaneKontaktowe',
      this.joinElements(elements),
      blockLevel
    );
  }

  private buildJstAndGv(
    buyer: Fa3Buyer,
    level: number,
    ctx?: Fa3BuildContext
  ): Array<string | null> {
    const jstValue = buyer.isJstSubordinate ? '1' : '2';
    const gvValue = buyer.isVatGroupMember ? '1' : '2';

    if (!jstValue) {
      this.vError(ctx, 'REQUIRED', 'buyer.JST', 'Brak pola JST dla nabywcy');
    }
    if (!gvValue) {
      this.vError(ctx, 'REQUIRED', 'buyer.GV', 'Brak pola GV dla nabywcy');
    }

    return [
      this.element('JST', jstValue, level),
      this.element('GV', gvValue, level),
    ];
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
    ctx?.error('BuyerBuilder', code, path, message);
  }

  protected vWarn(
    ctx: Fa3BuildContext | undefined,
    code: string,
    path: string,
    message: string
  ): void {
    ctx?.warn('BuyerBuilder', code, path, message);
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
