import type { Fa3BuildContext } from '../../validators/build-context';
import type { Fa3Footer, Fa3FooterInfo, Fa3FooterRegistry } from '../../types';

export class FooterBuilder {
  private indentSize: number = 2;
  private indentChar: string = ' ';
  private builderName: string = 'FooterBuilder';

  // ============================================================
  // PUBLIC API
  // ============================================================

  public build(
    footer: Fa3Footer | null | undefined,
    ctx?: Fa3BuildContext
  ): string | null {
    if (!footer) return null;

    const level = 1; // <Stopka> jest bezpośrednio w <Faktura>
    const innerLevel = level + 1;
    const elements: Array<string | null> = [];

    // Informacje (0-3)
    if (footer.info && footer.info.length > 0) {
      if (footer.info.length > 3) {
        this.vWarn(
          ctx,
          'LIMIT',
          'footer.info',
          'Liczba informacji w stopce przekracza limit 3. Przetworzono tylko pierwsze 3.'
        );
      }

      const infos = footer.info.slice(0, 3);
      for (const info of infos) {
        const infoXml = this.buildInfo(info, innerLevel, ctx);
        if (infoXml) elements.push(infoXml);
      }
    }

    // Rejestry (0-100)
    if (footer.registries && footer.registries.length > 0) {
      if (footer.registries.length > 100) {
        this.vWarn(
          ctx,
          'LIMIT',
          'footer.registries',
          'Liczba rejestrów w stopce przekracza limit 100. Przetworzono tylko pierwsze 100.'
        );
      }

      const registries = footer.registries.slice(0, 100);
      for (const registry of registries) {
        const registryXml = this.buildRegistry(registry, innerLevel, ctx);
        if (registryXml) elements.push(registryXml);
      }
    }

    const xml = this.joinElements(elements);
    if (!xml) return null;

    return this.block('Stopka', xml, level);
  }

  // ============================================================
  // PRIVATE BUILDERS
  // ============================================================

  private buildInfo(
    info: Fa3FooterInfo,
    level: number,
    _ctx?: Fa3BuildContext
  ): string | null {
    const innerLevel = level + 1;
    const elements: Array<string | null> = [];

    // StopkaFaktury (opcjonalne)
    if (this.hasValue(info.text)) {
      elements.push(this.element('StopkaFaktury', info.text, innerLevel));
    }

    const xml = this.joinElements(elements);
    if (!xml) return null;

    return this.block('Informacje', xml, level);
  }

  private buildRegistry(
    registry: Fa3FooterRegistry,
    level: number,
    _ctx?: Fa3BuildContext
  ): string | null {
    const innerLevel = level + 1;
    const elements: Array<string | null> = [];

    // PelnaNazwa (opcjonalne)
    if (this.hasValue(registry.fullName)) {
      elements.push(this.element('PelnaNazwa', registry.fullName, innerLevel));
    }

    // KRS (opcjonalne)
    if (this.hasValue(registry.krs)) {
      elements.push(this.element('KRS', registry.krs, innerLevel));
    }

    // REGON (opcjonalne)
    if (this.hasValue(registry.regon)) {
      elements.push(this.element('REGON', registry.regon, innerLevel));
    }

    // BDO (opcjonalne)
    if (this.hasValue(registry.bdo)) {
      elements.push(this.element('BDO', registry.bdo, innerLevel));
    }

    const xml = this.joinElements(elements);
    if (!xml) return null;

    return this.block('Rejestry', xml, level);
  }

  // ============================================================
  // VALIDATION HELPERS
  // ============================================================

  private vWarn(
    ctx: Fa3BuildContext | undefined,
    code: string,
    path: string,
    message: string
  ): void {
    ctx?.warn(this.builderName, code, path, message);
  }

  // ============================================================
  // XML FORMATTING HELPERS
  // ============================================================

  private indent(level: number): string {
    return this.indentChar.repeat(level * this.indentSize);
  }

  private element(
    tagName: string,
    value: unknown,
    level: number
  ): string | null {
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

  // ============================================================
  // VALUE FORMATTERS
  // ============================================================

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
