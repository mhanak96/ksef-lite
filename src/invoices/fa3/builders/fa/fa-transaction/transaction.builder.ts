import { TransportBuilder } from './transport.builder';
import type { Fa3BuildContext } from '../../../validators/build-context';
import type {
  Fa3TransactionConditions,
  Fa3TransactionContractRef,
  Fa3TransactionOrderRef,
} from '../../../types';

export class TransactionBuilder {
  private indentSize: number = 2;
  private indentChar: string = ' ';
  private builderName: string = 'TransactionBuilder';
  private transportBuilder: TransportBuilder;

  constructor() {
    this.transportBuilder = new TransportBuilder();
  }

  // ============================================================
  // PUBLIC API
  // ============================================================

  public build(
    conditions: Fa3TransactionConditions | null | undefined,
    ctx?: Fa3BuildContext,
    level: number = 1
  ): string | null {
    if (!conditions) return null;

    const innerLevel = level + 1;
    const elements: Array<string | null> = [];

    // Umowy (0-100)
    if (conditions.contracts && conditions.contracts.length > 0) {
      if (conditions.contracts.length > 100) {
        this.vWarn(
          ctx,
          'LIMIT',
          'conditions.contracts',
          'Liczba umów przekracza limit 100. Przetworzono tylko pierwsze 100.'
        );
      }

      const contracts = conditions.contracts.slice(0, 100);
      for (const contract of contracts) {
        const contractXml = this.buildContract(contract, innerLevel, ctx);
        if (contractXml) elements.push(contractXml);
      }
    }

    // Zamowienia (0-100)
    if (conditions.orders && conditions.orders.length > 0) {
      if (conditions.orders.length > 100) {
        this.vWarn(
          ctx,
          'LIMIT',
          'conditions.orders',
          'Liczba zamówień przekracza limit 100. Przetworzono tylko pierwsze 100.'
        );
      }

      const orders = conditions.orders.slice(0, 100);
      for (const order of orders) {
        const orderXml = this.buildOrder(order, innerLevel, ctx);
        if (orderXml) elements.push(orderXml);
      }
    }

    // NrPartiiTowaru (0-1000)
    if (conditions.batchNumbers && conditions.batchNumbers.length > 0) {
      if (conditions.batchNumbers.length > 1000) {
        this.vWarn(
          ctx,
          'LIMIT',
          'conditions.batchNumbers',
          'Liczba numerów partii przekracza limit 1000. Przetworzono tylko pierwsze 1000.'
        );
      }

      const batches = conditions.batchNumbers.slice(0, 1000);
      for (const batch of batches) {
        elements.push(this.element('NrPartiiTowaru', batch, innerLevel));
      }
    }

    // WarunkiDostawy (opcjonalne)
    if (this.hasValue(conditions.deliveryTerms)) {
      elements.push(
        this.element('WarunkiDostawy', conditions.deliveryTerms, innerLevel)
      );
    }

    // KursUmowny + WalutaUmowna (opcjonalne, razem)
    if (
      conditions.contractualRate !== undefined &&
      conditions.contractualRate !== null &&
      this.hasValue(conditions.contractualCurrency)
    ) {
      elements.push(
        this.quantityElement(
          'KursUmowny',
          conditions.contractualRate,
          innerLevel
        )
      );
      elements.push(
        this.element(
          'WalutaUmowna',
          conditions.contractualCurrency!,
          innerLevel
        )
      );
    }

    // Transport (0-20) - deleguj do TransportBuilder
    if (conditions.transport && conditions.transport.length > 0) {
      const transportsXml = this.transportBuilder.buildAll(
        conditions.transport,
        innerLevel,
        ctx
      );
      if (transportsXml) elements.push(transportsXml);
    }

    // PodmiotPosredniczacy (opcjonalne)
    if (conditions.intermediary === true) {
      elements.push(this.element('PodmiotPosredniczacy', '1', innerLevel));
    }

    const xml = this.joinElements(elements);
    if (!xml) return null;

    return this.block('WarunkiTransakcji', xml, level);
  }

  // ============================================================
  // PRIVATE BUILDERS
  // ============================================================

  private buildContract(
    contract: Fa3TransactionContractRef,
    level: number,
    _ctx?: Fa3BuildContext
  ): string | null {
    const innerLevel = level + 1;
    const elements: Array<string | null> = [];

    // DataUmowy (opcjonalne)
    if (contract.date) {
      elements.push(this.dateElement('DataUmowy', contract.date, innerLevel));
    }

    // NrUmowy (opcjonalne)
    if (this.hasValue(contract.number)) {
      elements.push(this.element('NrUmowy', contract.number, innerLevel));
    }

    const xml = this.joinElements(elements);
    return xml ? this.block('Umowy', xml, level) : null;
  }

  private buildOrder(
    order: Fa3TransactionOrderRef,
    level: number,
    _ctx?: Fa3BuildContext
  ): string | null {
    const innerLevel = level + 1;
    const elements: Array<string | null> = [];

    // DataZamowienia (opcjonalne)
    if (order.date) {
      elements.push(this.dateElement('DataZamowienia', order.date, innerLevel));
    }

    // NrZamowienia (opcjonalne)
    if (this.hasValue(order.number)) {
      elements.push(this.element('NrZamowienia', order.number, innerLevel));
    }

    const xml = this.joinElements(elements);
    return xml ? this.block('Zamowienia', xml, level) : null;
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

  private dateElement(
    tagName: string,
    date: Date | string | null | undefined,
    level: number
  ): string | null {
    if (!date) return null;
    const formatted = this.formatDate(date);
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

  private formatQuantity(quantity: number): string {
    const num = Number(quantity);
    return parseFloat(num.toFixed(6)).toString();
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
