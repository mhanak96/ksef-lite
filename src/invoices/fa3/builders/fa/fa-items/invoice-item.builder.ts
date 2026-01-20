import type { Fa3BuildContext } from '../../../validators/build-context';
import type { Fa3InvoiceItem } from '../../../types';

type XmlAttributes = Record<string, string | number | boolean | null | undefined>;

export class InvoiceItemBuilder {
  private indentSize: number = 2;
  private indentChar: string = ' ';
  private builderName: string = 'InvoiceItemBuilder';

  // ============================================================
  // PUBLIC API
  // ============================================================

  public buildAll(
    items: Fa3InvoiceItem[] | null | undefined,
    ctx?: Fa3BuildContext,
    level: number = 1
  ): string | null {
    if (!items || !Array.isArray(items) || items.length === 0) {
      return null;
    }
  
    if (items.length > 10000) {
      this.vWarn(
        ctx,
        'LIMIT',
        'items',
        'Liczba pozycji przekracza limit 10000. Przetworzono tylko pierwsze 10000 pozycji.'
      );
    }
  
    const limitedItems = items.slice(0, 10000);
  
    const elements: Array<string | null> = limitedItems.map((item, index) =>
      this.build(item, index + 1, level, ctx)
    );
  
    return this.joinElements(elements);
  }
  

  public build(
    item: Fa3InvoiceItem,
    lineNumber: number,
    level: number,
    ctx?: Fa3BuildContext
  ): string | null {
    const path = `items[${lineNumber - 1}]`;
    const innerLevel = level + 1;
    const elements: Array<string | null> = [];

    // NrWierszaFa (wymagane)
    if (!this.reqNumber(ctx, `${path}.lineNumber`, lineNumber, 'Brak numeru wiersza faktury')) {
      return null;
    }
    elements.push(this.element('NrWierszaFa', lineNumber, innerLevel));

    // UU_ID (opcjonalne)
    if (this.hasValue(item.uuid)) {
      elements.push(this.element('UU_ID', item.uuid, innerLevel));
    }

    // P_6A - data sprzedaży dla wiersza (opcjonalne)
    if (item.saleDate) {
      elements.push(this.dateElement('P_6A', item.saleDate, innerLevel));
    }

    // P_7 - nazwa towaru/usługi (opcjonalne, ale bardzo ważne)
    if (this.hasValue(item.name)) {
      elements.push(this.element('P_7', item.name, innerLevel));
    }

    // Indeks (opcjonalne)
    if (this.hasValue(item.index)) {
      elements.push(this.element('Indeks', item.index, innerLevel));
    }

    // GTIN (opcjonalne)
    if (this.hasValue(item.gtin)) {
      elements.push(this.element('GTIN', item.gtin, innerLevel));
    }

    // PKWiU (opcjonalne)
    if (this.hasValue(item.pkwiu)) {
      elements.push(this.element('PKWiU', item.pkwiu, innerLevel));
    }

    // CN (opcjonalne)
    if (this.hasValue(item.cn)) {
      elements.push(this.element('CN', item.cn, innerLevel));
    }

    // PKOB (opcjonalne)
    if (this.hasValue(item.pkob)) {
      elements.push(this.element('PKOB', item.pkob, innerLevel));
    }

    // P_8A - jednostka miary (opcjonalne)
    if (this.hasValue(item.unit)) {
      elements.push(this.element('P_8A', item.unit, innerLevel));
    }

    // P_8B - ilość (opcjonalne)
    if (item.quantity !== undefined && item.quantity !== null) {
      elements.push(this.quantityElement('P_8B', item.quantity, innerLevel));
    }

    // P_9A - cena jednostkowa netto (opcjonalne)
    if (item.netPrice !== undefined && item.netPrice !== null) {
      elements.push(this.amountElement('P_9A', item.netPrice, innerLevel));
    }

    // P_9B - cena jednostkowa brutto (opcjonalne)
    if (item.grossPrice !== undefined && item.grossPrice !== null) {
      elements.push(this.amountElement('P_9B', item.grossPrice, innerLevel));
    }

    // P_10 - rabat (opcjonalne)
    if (item.discount !== undefined && item.discount !== null) {
      elements.push(this.amountElement('P_10', item.discount, innerLevel));
    }

    // P_11 - wartość netto (opcjonalne, ale zazwyczaj wymagane)
    if (item.netAmount !== undefined && item.netAmount !== null) {
      elements.push(this.amountElement('P_11', item.netAmount, innerLevel));
    }

    // P_11A - wartość brutto (opcjonalne)
    if (item.grossAmount !== undefined && item.grossAmount !== null) {
      elements.push(this.amountElement('P_11A', item.grossAmount, innerLevel));
    }

    // P_11Vat - kwota VAT (opcjonalne)
    if (item.vatAmount !== undefined && item.vatAmount !== null) {
      elements.push(this.amountElement('P_11Vat', item.vatAmount, innerLevel));
    }

    // P_12 - stawka VAT (opcjonalne, ale zazwyczaj wymagane)
    if (this.hasValue(item.vatRate)) {
      elements.push(this.element('P_12', item.vatRate, innerLevel));
    }

    // P_12_XII - stawka VAT OSS (opcjonalne)
    if (item.vatRateOSS !== undefined && item.vatRateOSS !== null) {
      elements.push(this.element('P_12_XII', item.vatRateOSS, innerLevel));
    }

    // P_12_Zal_15 - załącznik 15 (opcjonalne)
    if (item.attachment15 === 1 || item.attachment15 === true) {
      elements.push(this.element('P_12_Zal_15', '1', innerLevel));
    }

    // KwotaAkcyzy (opcjonalne)
    if (item.exciseAmount !== undefined && item.exciseAmount !== null) {
      elements.push(this.amountElement('KwotaAkcyzy', item.exciseAmount, innerLevel));
    }

    // GTU (opcjonalne)
    if (this.hasValue(item.gtu)) {
      elements.push(this.element('GTU', item.gtu, innerLevel));
    }

    // Procedura (opcjonalne)
    if (this.hasValue(item.procedure)) {
      elements.push(this.element('Procedura', item.procedure, innerLevel));
    }

    // KursWaluty (opcjonalne)
    if (item.exchangeRate !== undefined && item.exchangeRate !== null) {
      elements.push(this.quantityElement('KursWaluty', item.exchangeRate, innerLevel));
    }

    // StanPrzed - dla faktur korygujących (opcjonalne)
    if (item.beforeCorrection === 1 || item.beforeCorrection === true) {
      elements.push(this.element('StanPrzed', '1', innerLevel));
    }

    return this.block('FaWiersz', this.joinElements(elements), level);
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

  private dateElement(
    tagName: string,
    date: Date | string | null | undefined,
    level: number
  ): string | null {
    if (!date) return null;
    const formatted = this.formatDate(date);
    return this.element(tagName, formatted, level);
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

  private formatDate(date: Date | string): string {
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