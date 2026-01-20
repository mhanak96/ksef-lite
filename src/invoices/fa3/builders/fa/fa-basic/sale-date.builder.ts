import type { Fa3BuildContext } from '../../../validators/build-context';
import type { Fa3InvoiceDetails } from '../../../types';

export type SaleDateBuilderOptions = {
  indentSize?: number;
  indentChar?: string;
};

export class SaleDateBuilder {
  private readonly indentSize: number;
  private readonly indentChar: string;

  constructor(options: SaleDateBuilderOptions = {}) {
    this.indentSize = options.indentSize ?? 2;
    this.indentChar = options.indentChar ?? ' ';
  }

  build(
    details: Fa3InvoiceDetails,
    ctx?: Fa3BuildContext,
    level: number = 1
  ): string | null {
    const innerLevel = level + 1;

    // P_6 - pojedyncza data sprzedaży (choice z OkresFa)
    if ((details as any).saleDate) {
      return this.dateElement('P_6', (details as any).saleDate, level);
    }

    // OkresFa - okres sprzedaży (P_6_Od, P_6_Do)
    if ((details as any).saleDateRange) {
      const range = (details as any).saleDateRange;

      if (!range.from || !range.to) {
        this.vWarn(
          ctx,
          'INCOMPLETE_RANGE',
          'details.saleDateRange',
          'Zakres dat sprzedaży jest niekompletny (brak from lub to)'
        );
        return null;
      }

      const elements: Array<string | null> = [];

      // P_6_Od - data początkowa okresu
      elements.push(this.dateElement('P_6_Od', range.from, innerLevel));

      // P_6_Do - data końcowa okresu (data dokonania/zakończenia dostawy)
      elements.push(this.dateElement('P_6_Do', range.to, innerLevel));

      return this.block('OkresFa', this.joinElements(elements), level);
    }

    // Brak daty sprzedaży - opcjonalne pole, nie generujemy błędu
    return null;
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
    ctx?.error('SaleDateBuilder', code, path, message);
  }

  protected vWarn(
    ctx: Fa3BuildContext | undefined,
    code: string,
    path: string,
    message: string
  ): void {
    ctx?.warn('SaleDateBuilder', code, path, message);
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

  protected dateElement(
    tagName: string,
    date: Date | string | null | undefined,
    level: number
  ): string | null {
    if (!date) return null;
    const formatted = this.formatDate(date);
    return this.element(tagName, formatted, level);
  }

  // ============================================================
  // VALUE FORMATTERS
  // ============================================================

  protected formatDate(date: Date | string): string {
    if (!date) return '';

    if (typeof date === 'string') {
      if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
      date = new Date(date);
    }

    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
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
}
