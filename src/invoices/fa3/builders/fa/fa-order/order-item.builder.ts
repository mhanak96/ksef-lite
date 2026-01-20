import type { Fa3BuildContext } from '../../../validators/build-context';
import type { Fa3OrderItem } from '../../../types';

export class OrderItemBuilder {
  private indentSize: number = 2;
  private indentChar: string = ' ';
  private builderName: string = 'OrderItemBuilder';

  // ============================================================
  // PUBLIC API
  // ============================================================

  public buildAll(
    items: Fa3OrderItem[] | null | undefined,
    level: number,
    ctx?: Fa3BuildContext
  ): string | null {
    if (!items || !Array.isArray(items) || items.length === 0) {
      return null;
    }

    if (items.length > 10000) {
      this.vWarn(
        ctx,
        'LIMIT',
        'order.items',
        'Liczba pozycji zamówienia przekracza limit 10000. Przetworzono tylko pierwsze 10000 pozycji.'
      );
    }

    const limitedItems = items.slice(0, 10000);

    const elements: Array<string | null> = limitedItems.map((item, index) =>
      this.build(item, index + 1, level, ctx)
    );

    return this.joinElements(elements);
  }

  public build(
    item: Fa3OrderItem,
    lineNumber: number,
    level: number,
    ctx?: Fa3BuildContext
  ): string | null {
    const path = `order.items[${lineNumber - 1}]`;
    const innerLevel = level + 1;
    const elements: Array<string | null> = [];

    // NrWierszaZam (wymagane)
    if (!this.reqNumber(ctx, `${path}.lineNumber`, lineNumber, 'Brak numeru wiersza zamówienia')) {
      return null;
    }
    elements.push(this.element('NrWierszaZam', lineNumber, innerLevel));

    // UU_IDZ (opcjonalne)
    if (this.hasValue(item.uuid)) {
      elements.push(this.element('UU_IDZ', item.uuid, innerLevel));
    }

    // P_7Z - nazwa (opcjonalne)
    if (this.hasValue(item.name)) {
      elements.push(this.element('P_7Z', item.name, innerLevel));
    }

    // IndeksZ (opcjonalne)
    if (this.hasValue(item.index)) {
      elements.push(this.element('IndeksZ', item.index, innerLevel));
    }

    // GTINZ (opcjonalne)
    if (this.hasValue(item.gtin)) {
      elements.push(this.element('GTINZ', item.gtin, innerLevel));
    }

    // PKWiUZ (opcjonalne)
    if (this.hasValue(item.pkwiu)) {
      elements.push(this.element('PKWiUZ', item.pkwiu, innerLevel));
    }

    // CNZ (opcjonalne)
    if (this.hasValue(item.cn)) {
      elements.push(this.element('CNZ', item.cn, innerLevel));
    }

    // PKOBZ (opcjonalne)
    if (this.hasValue(item.pkob)) {
      elements.push(this.element('PKOBZ', item.pkob, innerLevel));
    }

    // P_8AZ - jednostka miary (opcjonalne)
    if (this.hasValue(item.unit)) {
      elements.push(this.element('P_8AZ', item.unit, innerLevel));
    }

    // P_8BZ - ilość (opcjonalne)
    if (item.quantity !== undefined && item.quantity !== null) {
      elements.push(this.quantityElement('P_8BZ', item.quantity, innerLevel));
    }

    // P_9AZ - cena jednostkowa netto (opcjonalne)
    if (item.netPrice !== undefined && item.netPrice !== null) {
      elements.push(this.amountElement('P_9AZ', item.netPrice, innerLevel));
    }

    // P_11NettoZ - wartość netto (opcjonalne)
    if (item.netAmount !== undefined && item.netAmount !== null) {
      elements.push(this.amountElement('P_11NettoZ', item.netAmount, innerLevel));
    }

    // P_11VatZ - kwota VAT (opcjonalne)
    if (item.vatAmount !== undefined && item.vatAmount !== null) {
      elements.push(this.amountElement('P_11VatZ', item.vatAmount, innerLevel));
    }

    // P_12Z - stawka VAT (opcjonalne)
    if (this.hasValue(item.vatRate)) {
      elements.push(this.element('P_12Z', item.vatRate, innerLevel));
    }

    // P_12Z_XII - stawka VAT OSS (opcjonalne)
    if (item.vatRateOSS !== undefined && item.vatRateOSS !== null) {
      elements.push(this.element('P_12Z_XII', item.vatRateOSS, innerLevel));
    }

    // P_12Z_Zal_15 - załącznik 15 (opcjonalne)
    if (item.attachment15 === 1 || item.attachment15 === true) {
      elements.push(this.element('P_12Z_Zal_15', '1', innerLevel));
    }

    // GTUZ (opcjonalne)
    if (this.hasValue(item.gtu)) {
      elements.push(this.element('GTUZ', item.gtu, innerLevel));
    }

    // ProceduraZ (opcjonalne)
    if (this.hasValue(item.procedure)) {
      elements.push(this.element('ProceduraZ', item.procedure, innerLevel));
    }

    // KwotaAkcyzyZ (opcjonalne)
    if (item.exciseAmount !== undefined && item.exciseAmount !== null) {
      elements.push(this.amountElement('KwotaAkcyzyZ', item.exciseAmount, innerLevel));
    }

    // StanPrzedZ - dla faktur korygujących (opcjonalne)
    if (item.beforeCorrection === 1 || item.beforeCorrection === true) {
      elements.push(this.element('StanPrzedZ', '1', innerLevel));
    }

    return this.block('ZamowienieWiersz', this.joinElements(elements), level);
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

  private amountElement(
    tagName: string,
    amount: number | null | undefined,
    level: number
  ): string | null {
    if (amount === undefined || amount === null) return null;
    const formatted = this.formatAmount(amount);
    return this.element(tagName, formatted, level);
  }

  private quantityElement(
    tagName: string,
    quantity: number | null | undefined,
    level: number
  ): string | null {
    if (quantity === undefined || quantity === null) return null;
    const formatted = this.formatQuantity(quantity);
    return this.element(tagName, formatted, level);
  }

  // ============================================================
  // VALUE FORMATTERS
  // ============================================================

  private formatAmount(amount: number): string {
    return this.roundAmount(Number(amount)).toFixed(2);
  }

  private formatQuantity(quantity: number): string {
    const num = Number(quantity);
    return parseFloat(num.toFixed(6)).toString();
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

  private hasValue(value: unknown): boolean {
    return value !== undefined && value !== null && value !== '';
  }
}