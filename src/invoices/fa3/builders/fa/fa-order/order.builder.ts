import { OrderItemBuilder } from './order-item.builder';
import type { Fa3BuildContext } from '../../../validators/build-context';
import type { Fa3Order } from '../../../types';

export class OrderBuilder {
  private indentSize: number = 2;
  private indentChar: string = ' ';
  private builderName: string = 'OrderBuilder';
  private orderItemBuilder: OrderItemBuilder;

  constructor() {
    this.orderItemBuilder = new OrderItemBuilder();
  }

  // ============================================================
  // PUBLIC API
  // ============================================================

  public build(
    order: Fa3Order | null | undefined,
    ctx?: Fa3BuildContext,
    level: number = 1
  ): string | null {
    if (!order) return null;

    const innerLevel = level + 1;
    const elements: Array<string | null> = [];

    // WartoscZamowienia (wymagane)
    if (
      !this.reqNumber(
        ctx,
        'order.totalValue',
        order.totalValue,
        'Brak wartości zamówienia'
      )
    ) {
      return null;
    }
    elements.push(
      this.amountElement('WartoscZamowienia', order.totalValue, innerLevel)
    );

    // ZamowienieWiersz (wymagane, min 1) - deleguj do OrderItemBuilder
    if (
      !this.reqArray(ctx, 'order.items', order.items, 'Brak pozycji zamówienia')
    ) {
      return null;
    }

    // UWAGA: items siedzą w <Zamowienie>, więc ich level powinien być innerLevel
    // (OrderItemBuilder powinien robić blok <ZamowienieWiersz> na level=innerLevel)
    const itemsXml = this.orderItemBuilder.buildAll(
      order.items,
      innerLevel,
      ctx
    );
    if (itemsXml) elements.push(itemsXml);

    const xml = this.joinElements(elements);
    return xml ? this.block('Zamowienie', xml, level) : null;
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

  private reqNumber(
    ctx: Fa3BuildContext | undefined,
    path: string,
    value: unknown,
    message: string
  ): value is number {
    if (typeof value === 'number' && Number.isFinite(value)) return true;
    this.vError(ctx, 'REQUIRED', path, message);
    return false;
  }

  private reqArray<T = unknown>(
    ctx: Fa3BuildContext | undefined,
    path: string,
    value: unknown,
    message: string
  ): value is T[] {
    if (Array.isArray(value) && value.length > 0) return true;
    this.vError(ctx, 'REQUIRED_ARRAY', path, message);
    return false;
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

  private amountElement(
    tagName: string,
    amount: number | null | undefined,
    level: number
  ): string | null {
    if (amount === undefined || amount === null) return null;
    const formatted = this.formatAmount(amount);
    return this.element(tagName, formatted, level);
  }

  // ============================================================
  // VALUE FORMATTERS
  // ============================================================

  private formatAmount(amount: number): string {
    return this.roundAmount(Number(amount)).toFixed(2);
  }

  private roundAmount(amount: number): number {
    return Math.round(amount * 100) / 100;
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
}
