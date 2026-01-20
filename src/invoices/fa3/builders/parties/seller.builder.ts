import type { Fa3BuildContext } from '../../validators/build-context';
import type { Fa3Address, Fa3Seller, Fa3CorrectedSeller } from '../../types';

export type SellerBuilderOptions = {
  indentSize?: number;
  indentChar?: string;
  baseLevel?: number;
};

type SellerLike = {
  nip: string;
  name: string;
  address: Fa3Address | string;
  email?: string;
  phone?: string;
};

export class SellerBuilder {
  private readonly indentSize: number;
  private readonly indentChar: string;
  private readonly baseLevel: number;

  constructor(options: SellerBuilderOptions = {}) {
    this.indentSize = options.indentSize ?? 2;
    this.indentChar = options.indentChar ?? ' ';
    this.baseLevel = options.baseLevel ?? 1;
  }

  build(seller: Fa3Seller, ctx?: Fa3BuildContext): string | null {
    return this.buildAs('Podmiot1', seller, ctx);
  }

  buildAs(
    tagName: 'Podmiot1' | 'Podmiot1K' | string,
    seller: Fa3Seller | Fa3CorrectedSeller | SellerLike,
    ctx?: Fa3BuildContext,
    levelOverride?: number
  ): string | null {
    const level = levelOverride ?? this.baseLevel;
    const innerLevel = level + 1;

    if (!seller) {
      this.vError(ctx, 'REQUIRED', 'seller', 'Brak danych sprzedawcy');
      return null;
    }

    const elements: Array<string | null> = [];

    const identXml = this.buildIdentification(seller as SellerLike, innerLevel, ctx);
    if (identXml) elements.push(identXml);

    const addressXml = this.buildAddress((seller as SellerLike).address, 'seller.address', innerLevel, ctx);
    if (addressXml) {
      elements.push(this.block('Adres', addressXml, innerLevel));
    } else {
      this.vError(ctx, 'REQUIRED', 'seller.address', 'Brak adresu sprzedawcy');
    }

    const contactXml = this.buildContact(seller as SellerLike, innerLevel);
    if (contactXml) elements.push(contactXml);

    return this.block(tagName, this.joinElements(elements), level);
  }

  private buildIdentification(
    seller: SellerLike,
    blockLevel: number,
    ctx?: Fa3BuildContext
  ): string | null {
    const elementLevel = blockLevel + 1;
    const elements: Array<string | null> = [];

    if (!seller.nip) {
      this.vError(ctx, 'REQUIRED', 'seller.nip', 'Brak numeru NIP sprzedawcy');
    }
    elements.push(this.element('NIP', seller.nip, elementLevel));

    if (!seller.name) {
      this.vError(ctx, 'REQUIRED', 'seller.name', 'Brak nazwy sprzedawcy');
    }
    elements.push(this.element('Nazwa', seller.name, elementLevel));

    return this.block('DaneIdentyfikacyjne', this.joinElements(elements), blockLevel);
  }

  private buildAddress(
    address: Fa3Address | string | undefined,
    path: string,
    elementLevel: number,
    ctx?: Fa3BuildContext
  ): string | null {
    if (!address) {
      this.vError(ctx, 'REQUIRED', path, 'Brak adresu');
      return null;
    }

    const elements: Array<string | null> = [];

    if (typeof address === 'string') {
      const lines = address.split(',').map(l => l.trim()).filter(Boolean);

      elements.push(this.element('KodKraju', 'PL', elementLevel));

      if (lines[0]) {
        elements.push(this.element('AdresL1', lines[0], elementLevel));
      } else {
        this.vError(ctx, 'REQUIRED', `${path}.line1`, 'Brak pierwszej linii adresu');
      }

      if (lines[1]) {
        elements.push(this.element('AdresL2', lines[1], elementLevel));
      }

      return this.joinElements(elements);
    }

    if (!address.countryCode) {
      this.vError(ctx, 'REQUIRED', `${path}.countryCode`, 'Brak kodu kraju w adresie');
    }
    elements.push(this.element('KodKraju', address.countryCode ?? 'PL', elementLevel));

    if (!address.line1) {
      this.vError(ctx, 'REQUIRED', `${path}.line1`, 'Brak pierwszej linii adresu');
    }
    elements.push(this.element('AdresL1', address.line1 ?? '', elementLevel));

    if (address.line2) {
      elements.push(this.element('AdresL2', address.line2, elementLevel));
    }

    return this.joinElements(elements);
  }

  private buildContact(seller: SellerLike, blockLevel: number): string | null {
    if (!seller.email && !seller.phone) return null;

    const elementLevel = blockLevel + 1;
    const elements: Array<string | null> = [];

    if (seller.email) {
      elements.push(this.element('Email', seller.email, elementLevel));
    }
    if (seller.phone) {
      elements.push(this.element('Telefon', seller.phone, elementLevel));
    }

    return this.block('DaneKontaktowe', this.joinElements(elements), blockLevel);
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
    ctx?.error('SellerBuilder', code, path, message);
  }

  protected vWarn(
    ctx: Fa3BuildContext | undefined,
    code: string,
    path: string,
    message: string
  ): void {
    ctx?.warn('SellerBuilder', code, path, message);
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