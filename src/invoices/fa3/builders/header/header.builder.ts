import type { Fa3Header } from '../../types';
import type { Fa3BuildContext } from '../../validators/build-context';

export type HeaderBuilderOptions = {
  indentSize?: number;
  indentChar?: string;
  baseLevel?: number;
};

export class HeaderBuilder {
  private indentSize: number;
  private indentChar: string;
  private baseLevel: number;

  constructor(options: HeaderBuilderOptions = {}) {
    this.indentSize = options.indentSize ?? 2;
    this.indentChar = options.indentChar ?? ' ';
    this.baseLevel = options.baseLevel ?? 1;
  }

  public build(header: Fa3Header = {}, ctx?: Fa3BuildContext): string | null {
    const level = this.baseLevel;
    const innerLevel = level + 1;
    const elements: Array<string | null> = [];

    elements.push(this.buildKodFormularza(innerLevel));
    elements.push(this.element('WariantFormularza', '3', innerLevel));

    if (!header.creationDate) {
      this.vError(
        ctx,
        'REQUIRED',
        'header.creationDate',
        'Brak daty wytworzenia faktury. Podstawiono bieżącą datę i czas.'
      );
    }

    const creationDate = header.creationDate
      ? this.formatDateTime(header.creationDate)
      : new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');

    elements.push(this.element('DataWytworzeniaFa', creationDate, innerLevel));

    if (this.hasValue(header.systemInfo)) {
      elements.push(this.element('SystemInfo', header.systemInfo, innerLevel));
    }

    return this.block('Naglowek', this.joinElements(elements), level);
  }

  private buildKodFormularza(level: number): string {
    return `${this.indent(level)}<KodFormularza kodSystemowy="FA (3)" wersjaSchemy="1-0E">FA</KodFormularza>`;
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
    ctx?.error('HeaderBuilder', code, path, message);
  }

  protected vWarn(
    ctx: Fa3BuildContext | undefined,
    code: string,
    path: string,
    message: string
  ): void {
    ctx?.warn('HeaderBuilder', code, path, message);
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

  // ============================================================
  // VALUE FORMATTERS
  // ============================================================

  protected formatDateTime(dateTime: Date | string): string {
    if (!dateTime) return '';

    if (typeof dateTime === 'string') {
      if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(dateTime))
        return dateTime;
      dateTime = new Date(dateTime);
    }

    return dateTime.toISOString();
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
