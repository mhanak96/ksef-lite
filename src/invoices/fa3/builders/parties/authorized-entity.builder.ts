import type { Fa3BuildContext } from '../../validators/build-context';
import type { Fa3Address, Fa3AuthorizedEntity } from '../../types';

export type AuthorizedEntityBuilderOptions = {
  indentSize?: number;
  indentChar?: string;
  baseLevel?: number;
};

export class AuthorizedEntityBuilder {
  private readonly indentSize: number;
  private readonly indentChar: string;
  private readonly baseLevel: number;

  constructor(options: AuthorizedEntityBuilderOptions = {}) {
    this.indentSize = options.indentSize ?? 2;
    this.indentChar = options.indentChar ?? ' ';
    this.baseLevel = options.baseLevel ?? 1;
  }

  build(entity: Fa3AuthorizedEntity, ctx?: Fa3BuildContext): string | null {
    if (!entity) return null;

    const level = this.baseLevel;
    const innerLevel = level + 1;

    const elements: Array<string | null> = [];

    // NrEORI (opcjonalny)
    if (this.hasValue(entity.eoriNumber)) {
      elements.push(this.element('NrEORI', entity.eoriNumber, innerLevel));
    }

    // DaneIdentyfikacyjne (wymagane: NIP + Nazwa)
    const identXml = this.buildIdentification(entity, innerLevel, ctx);
    if (identXml) elements.push(identXml);

    // Adres (wymagany!)
    const addressXml = this.buildAddress(entity.address, 'authorizedEntity.address', innerLevel + 1, ctx);
    if (addressXml) {
      elements.push(this.block('Adres', addressXml, innerLevel));
    } else {
      this.vError(ctx, 'REQUIRED', 'authorizedEntity.address', 'Brak adresu podmiotu upoważnionego');
    }

    // AdresKoresp (opcjonalny)
    if (entity.correspondenceAddress) {
      const corrAddressXml = this.buildAddress(
        entity.correspondenceAddress,
        'authorizedEntity.correspondenceAddress',
        innerLevel + 1,
        ctx
      );
      if (corrAddressXml) {
        elements.push(this.block('AdresKoresp', corrAddressXml, innerLevel));
      }
    }

    // DaneKontaktowe (0-3, używa EmailPU i TelefonPU zamiast Email i Telefon!)
    const contactXml = this.buildContact(entity, innerLevel);
    if (contactXml) elements.push(contactXml);

    // RolaPU (wymagane: 1, 2, lub 3)
    if (!entity.role) {
      this.vError(ctx, 'REQUIRED', 'authorizedEntity.role', 'Brak roli podmiotu upoważnionego');
    } else {
      const allowedRoles = [1, 2, 3] as const;
      if (!allowedRoles.includes(entity.role as any)) {
        this.vError(
          ctx,
          'INVALID_ROLE',
          'authorizedEntity.role',
          `Nieprawidłowa rola podmiotu upoważnionego: ${entity.role}. Dozwolone: 1 (organ egzekucyjny), 2 (komornik sądowy), 3 (przedstawiciel podatkowy)`
        );
      }
      elements.push(this.element('RolaPU', String(entity.role), innerLevel));
    }

    return this.block('PodmiotUpowazniony', this.joinElements(elements), level);
  }

  private buildIdentification(
    entity: Fa3AuthorizedEntity,
    blockLevel: number,
    ctx?: Fa3BuildContext
  ): string | null {
    const elementLevel = blockLevel + 1;
    const elements: Array<string | null> = [];

    // NIP (wymagany)
    if (!entity.nip) {
      this.vError(ctx, 'REQUIRED', 'authorizedEntity.nip', 'Brak numeru NIP podmiotu upoważnionego');
    }
    elements.push(this.element('NIP', entity.nip, elementLevel));

    // Nazwa (wymagana)
    if (!entity.name) {
      this.vError(ctx, 'REQUIRED', 'authorizedEntity.name', 'Brak nazwy podmiotu upoważnionego');
    }
    elements.push(this.element('Nazwa', entity.name, elementLevel));

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

    // GLN (opcjonalny)
    if (this.hasValue((address as any).gln)) {
      elements.push(this.element('GLN', (address as any).gln, elementLevel));
    }

    return this.joinElements(elements);
  }

  private buildContact(entity: Fa3AuthorizedEntity, blockLevel: number): string | null {
    if (!entity.email && !entity.phone) return null;

    const elementLevel = blockLevel + 1;
    const elements: Array<string | null> = [];

    // UWAGA: Używa EmailPU i TelefonPU (nie Email i Telefon!)
    if (entity.email) {
      elements.push(this.element('EmailPU', entity.email, elementLevel));
    }
    if (entity.phone) {
      elements.push(this.element('TelefonPU', entity.phone, elementLevel));
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
    ctx?.error('AuthorizedEntityBuilder', code, path, message);
  }

  protected vWarn(
    ctx: Fa3BuildContext | undefined,
    code: string,
    path: string,
    message: string
  ): void {
    ctx?.warn('AuthorizedEntityBuilder', code, path, message);
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