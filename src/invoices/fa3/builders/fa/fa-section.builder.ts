import type { Fa3BuildContext } from '../../validators/build-context';
import type { Fa3Invoice } from '../../types';

import { VatSummaryBuilder } from './fa-basic/vat-summary.builder';
import { AnnotationsBuilder } from './fa-basic/annotations.builder';
import { SaleDateBuilder } from './fa-basic/sale-date.builder';
import { CorrectionBuilder } from './fa-correction/correction.builder';
import { InvoiceItemBuilder } from './fa-items/invoice-item.builder';
import { OrderBuilder } from './fa-order/order.builder';
import { PaymentBuilder } from './fa-payment/payment.builder';
import { SettlementBuilder } from './fa-settlement/settlement.builder';
import { TransactionBuilder } from './fa-transaction/transaction.builder';

import { CorrectedPartiesBuilder } from './fa-correction/corrected-parties.builder';

export type FaSectionBuilderOptions = {
  indentSize?: number;
  indentChar?: string;
  baseLevel?: number;
};

export class FaSectionBuilder {
  private readonly indentSize: number;
  private readonly indentChar: string;
  private readonly baseLevel: number;

  // Sub-buildery
  private vatSummaryBuilder: VatSummaryBuilder;
  private annotationsBuilder: AnnotationsBuilder;
  private saleDateBuilder: SaleDateBuilder;
  private correctionBuilder: CorrectionBuilder;
  private invoiceItemBuilder: InvoiceItemBuilder;
  private orderBuilder: OrderBuilder;
  private paymentBuilder: PaymentBuilder;
  private settlementBuilder: SettlementBuilder;
  private transactionBuilder: TransactionBuilder;
  private readonly correctedPartiesBuilder: CorrectedPartiesBuilder;

  constructor(options: FaSectionBuilderOptions = {}) {
    this.indentSize = options.indentSize ?? 2;
    this.indentChar = options.indentChar ?? ' ';
    this.baseLevel = options.baseLevel ?? 1;

    // Inicjalizacja builderów
    this.vatSummaryBuilder = new VatSummaryBuilder();
    this.annotationsBuilder = new AnnotationsBuilder();
    this.saleDateBuilder = new SaleDateBuilder();
    this.correctionBuilder = new CorrectionBuilder();
    this.invoiceItemBuilder = new InvoiceItemBuilder();
    this.orderBuilder = new OrderBuilder();
    this.paymentBuilder = new PaymentBuilder();
    this.settlementBuilder = new SettlementBuilder();
    this.transactionBuilder = new TransactionBuilder();
    this.correctedPartiesBuilder = new CorrectedPartiesBuilder(options);
  }

  build(invoice: Fa3Invoice, ctx?: Fa3BuildContext): string {
    const level = this.baseLevel;
    const innerLevel = level + 1;
    const elements: Array<string | null> = [];

    // ============================================================
    // PODSTAWOWE POLA (zgodnie ze schematem FA(3))
    // ============================================================

    // KodWaluty (wymagany)
    if (!invoice.details.currency) {
      this.vError(ctx, 'REQUIRED', 'details.currency', 'Brak kodu waluty');
    }
    elements.push(
      this.element('KodWaluty', invoice.details.currency, innerLevel)
    );

    // P_1 - Data wystawienia (wymagana)
    if (!invoice.details.issueDate) {
      this.vError(
        ctx,
        'REQUIRED',
        'details.issueDate',
        'Brak daty wystawienia faktury'
      );
    }
    elements.push(
      this.dateElement('P_1', invoice.details.issueDate, innerLevel)
    );

    // P_1M - Miejsce wystawienia (opcjonalne)
    if (this.hasValue(invoice.details.issuePlace)) {
      elements.push(
        this.element('P_1M', invoice.details.issuePlace, innerLevel)
      );
    }

    // P_2 - Numer faktury (wymagany)
    if (!invoice.details.invoiceNumber) {
      this.vError(
        ctx,
        'REQUIRED',
        'details.invoiceNumber',
        'Brak numeru faktury'
      );
    }
    elements.push(
      this.element('P_2', invoice.details.invoiceNumber, innerLevel)
    );

    // WZ - Dokumenty magazynowe (0-1000)
    if (
      invoice.details.deliveryNotes &&
      invoice.details.deliveryNotes.length > 0
    ) {
      const notes = invoice.details.deliveryNotes.slice(0, 1000);
      for (const note of notes) {
        elements.push(this.element('WZ', note, innerLevel));
      }
    }

    // P_6 lub OkresFa - Data/okres dostawy
    const saleDateXml = this.saleDateBuilder.build(
      invoice.details,
      ctx,
      innerLevel
    );
    if (saleDateXml) elements.push(saleDateXml);

    // ============================================================
    // PODSUMOWANIE VAT (P_13_X, P_14_X)
    // ============================================================
    const vatSummaryXml = this.vatSummaryBuilder.build(
      invoice.vatSummary,
      invoice.details.currency,
      ctx,
      innerLevel
    );
    if (vatSummaryXml) elements.push(vatSummaryXml);

    // ============================================================
    // KWOTY I KURSY
    // ============================================================

    // P_15 - Kwota należności ogółem (wymagana)
    if (
      invoice.summary?.grossAmount === undefined ||
      invoice.summary?.grossAmount === null
    ) {
      this.vError(
        ctx,
        'REQUIRED',
        'summary.grossAmount',
        'Brak kwoty należności ogółem (P_15)'
      );
    }
    elements.push(
      this.amountElement('P_15', invoice.summary?.grossAmount, innerLevel)
    );

    // KursWalutyZ - Kurs waluty dla zaliczek (opcjonalny)
    if (this.hasValue(invoice.details.exchangeRateAdvance)) {
      elements.push(
        this.quantityElement(
          'KursWalutyZ',
          invoice.details.exchangeRateAdvance,
          innerLevel
        )
      );
    }

    // ============================================================
    // ADNOTACJE
    // ============================================================
    const annotationsXml = this.annotationsBuilder.build(
      invoice.details.annotations,
      ctx,
      innerLevel
    );
    if (annotationsXml) {
      elements.push(annotationsXml);
    } else {
      this.vError(
        ctx,
        'REQUIRED',
        'details.annotations',
        'Brak wymaganych adnotacji'
      );
    }

    // ============================================================
    // RODZAJ FAKTURY I DANE KOREKTY
    // ============================================================

    // RodzajFaktury (wymagany)
    if (!invoice.details.invoiceType) {
      this.vError(
        ctx,
        'REQUIRED',
        'details.invoiceType',
        'Brak rodzaju faktury'
      );
    }
    elements.push(
      this.element('RodzajFaktury', invoice.details.invoiceType, innerLevel)
    );

    // Korekta - jeśli typ faktury to KOR, KOR_ZAL lub KOR_ROZ
    if (this.isCorrection(invoice.details.invoiceType)) {
      const correctionXml = this.correctionBuilder.build(
        invoice.details,
        ctx,
        innerLevel
      );
      if (correctionXml) elements.push(correctionXml);

      const partiesXml = this.correctedPartiesBuilder.build(
        invoice.details,
        ctx,
        innerLevel
      );
      if (partiesXml) elements.push(partiesXml);
    }

    // ============================================================
    // ZALICZKI CZĘŚCIOWE (0-31)
    // ============================================================
    if (
      invoice.details.partialPayments &&
      invoice.details.partialPayments.length > 0
    ) {
      const payments = invoice.details.partialPayments.slice(0, 31);
      for (const payment of payments) {
        const paymentXml = this.buildPartialPayment(payment, innerLevel);
        if (paymentXml) elements.push(paymentXml);
      }
    }

    // ============================================================
    // DODATKOWE FLAGI I OPISY
    // ============================================================

    // FP - Faktura art. 109 ust. 3d (opcjonalne)
    if (invoice.details.fp) {
      elements.push(this.element('FP', '1', innerLevel));
    }

    // TP - Powiązania między nabywcą a dostawcą (opcjonalne)
    if (invoice.details.tp) {
      elements.push(this.element('TP', '1', innerLevel));
    }

    // DodatkowyOpis (0-10000)
    if (
      invoice.details.additionalInfo &&
      invoice.details.additionalInfo.length > 0
    ) {
      const infos = invoice.details.additionalInfo.slice(0, 10000);
      for (const info of infos) {
        const infoXml = this.buildAdditionalInfo(info, innerLevel);
        if (infoXml) elements.push(infoXml);
      }
    }

    // FakturaZaliczkowa (0-100)
    if (
      invoice.details.advanceInvoices &&
      invoice.details.advanceInvoices.length > 0
    ) {
      const advances = invoice.details.advanceInvoices.slice(0, 100);
      for (const advance of advances) {
        const advanceXml = this.buildAdvanceInvoice(advance, innerLevel);
        if (advanceXml) elements.push(advanceXml);
      }
    }

    // ZwrotAkcyzy (opcjonalne)
    if (invoice.details.exciseRefund) {
      elements.push(this.element('ZwrotAkcyzy', '1', innerLevel));
    }

    // ============================================================
    // GŁÓWNE SEKCJE (każda ma własny builder)
    // ============================================================

    // FaWiersz - Pozycje faktury (0-10000)
    if (invoice.details.items && invoice.details.items.length > 0) {
      const itemsXml = this.invoiceItemBuilder.buildAll(
        invoice.details.items,
        ctx,
        innerLevel
      );
      if (itemsXml) elements.push(itemsXml);
    }

    // Rozliczenie (opcjonalne)
    if (invoice.details.settlement) {
      const settlementXml = this.settlementBuilder.build(
        invoice.details.settlement,
        ctx,
        innerLevel
      );
      if (settlementXml) elements.push(settlementXml);
    }

    // Platnosc (opcjonalne)
    if (invoice.details.payment) {
      const paymentXml = this.paymentBuilder.build(
        invoice.details.payment,
        ctx,
        innerLevel
      );
      if (paymentXml) elements.push(paymentXml);
    }

    // WarunkiTransakcji (opcjonalne)
    if (invoice.details.transactionConditions) {
      const transactionXml = this.transactionBuilder.build(
        invoice.details.transactionConditions,
        ctx,
        innerLevel
      );
      if (transactionXml) elements.push(transactionXml);
    }

    // Zamowienie (opcjonalne, tylko dla faktur zaliczkowych)
    if (invoice.details.order) {
      const orderXml = this.orderBuilder.build(
        invoice.details.order,
        ctx,
        innerLevel
      );
      if (orderXml) elements.push(orderXml);
    }

    return this.block('Fa', this.joinElements(elements), level) ?? '';
  }

  // ============================================================
  // PRIVATE HELPERS
  // ============================================================

  private isCorrection(invoiceType: string | undefined): boolean {
    return (
      invoiceType === 'KOR' ||
      invoiceType === 'KOR_ZAL' ||
      invoiceType === 'KOR_ROZ'
    );
  }

  private buildPartialPayment(payment: any, level: number): string | null {
    const innerLevel = level + 1;
    const elements: Array<string | null> = [];

    // P_6Z - Data otrzymania płatności (wymagana)
    elements.push(this.dateElement('P_6Z', payment.date, innerLevel));

    // P_15Z - Kwota płatności (wymagana)
    elements.push(this.amountElement('P_15Z', payment.amount, innerLevel));

    // KursWalutyZW - Kurs waluty (opcjonalny)
    if (this.hasValue(payment.exchangeRate)) {
      elements.push(
        this.quantityElement('KursWalutyZW', payment.exchangeRate, innerLevel)
      );
    }

    return this.block('ZaliczkaCzesciowa', this.joinElements(elements), level);
  }

  private buildAdditionalInfo(info: any, level: number): string | null {
    const innerLevel = level + 1;
    const elements: Array<string | null> = [];

    // NrWiersza (opcjonalny)
    if (this.hasValue(info.lineNumber)) {
      elements.push(this.element('NrWiersza', info.lineNumber, innerLevel));
    }

    // Klucz (wymagany)
    elements.push(this.element('Klucz', info.key, innerLevel));

    // Wartosc (wymagana)
    elements.push(this.element('Wartosc', info.value, innerLevel));

    return this.block('DodatkowyOpis', this.joinElements(elements), level);
  }

  private buildAdvanceInvoice(advance: any, level: number): string | null {
    const innerLevel = level + 1;
    const elements: Array<string | null> = [];

    if (advance.ksefNumber) {
      // Faktura wystawiona w KSeF
      elements.push(
        this.element('NrKSeFFaZaliczkowej', advance.ksefNumber, innerLevel)
      );
    } else if (advance.invoiceNumber) {
      // Faktura poza KSeF
      elements.push(this.element('NrKSeFZN', '1', innerLevel));
      elements.push(
        this.element('NrFaZaliczkowej', advance.invoiceNumber, innerLevel)
      );
    }

    return this.block('FakturaZaliczkowa', this.joinElements(elements), level);
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
    ctx?.error('FaSectionBuilder', code, path, message);
  }

  protected vWarn(
    ctx: Fa3BuildContext | undefined,
    code: string,
    path: string,
    message: string
  ): void {
    ctx?.warn('FaSectionBuilder', code, path, message);
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

  protected amountElement(
    tagName: string,
    amount: number | null | undefined,
    level: number
  ): string | null {
    if (amount === undefined || amount === null) return null;
    const formatted = this.formatAmount(amount);
    return this.element(tagName, formatted, level);
  }

  protected quantityElement(
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

  protected formatAmount(amount: number): string {
    return this.roundAmount(Number(amount)).toFixed(2).replace(/\.00$/, '');
  }

  protected formatQuantity(quantity: number): string {
    const num = Number(quantity);
    return parseFloat(num.toFixed(6)).toString();
  }

  protected roundAmount(amount: number): number {
    return Math.round(amount * 100) / 100;
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
