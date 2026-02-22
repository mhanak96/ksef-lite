import type { Fa3BuildContext } from '../../../validators/build-context';
import type { Fa3InvoiceDetails, Fa3CorrectedInvoiceRef } from '../../../types';

export type CorrectionBuilderOptions = {
  indentSize?: number;
  indentChar?: string;
};

export class CorrectionBuilder {
  private readonly indentSize: number;
  private readonly indentChar: string;

  constructor(options: CorrectionBuilderOptions = {}) {
    this.indentSize = options.indentSize ?? 2;
    this.indentChar = options.indentChar ?? ' ';
  }

  build(
    details: Fa3InvoiceDetails,
    ctx?: Fa3BuildContext,
    level: number = 1
  ): string | null {
    const elements: Array<string | null> = [];

    // PrzyczynaKorekty (opcjonalne) — trim() żeby usunąć ewentualny whitespace z inputu
    const correctionReason =
      typeof (details as any).correctionReason === 'string'
        ? (details as any).correctionReason.trim()
        : (details as any).correctionReason;
    if (this.hasValue(correctionReason)) {
      elements.push(this.element('PrzyczynaKorekty', correctionReason, level));
    }

    // TypKorekty (opcjonalne, ale jeśli podane to musi być 1, 2 lub 3)
    if ((details as any).correctionType !== undefined) {
      if (
        !this.reqOneOf(
          ctx,
          'details.correctionType',
          (details as any).correctionType,
          [1, 2, 3] as const,
          'TypKorekty musi być 1, 2 lub 3'
        )
      ) {
        // Kontynuuj mimo błędu
      } else {
        elements.push(
          this.element('TypKorekty', (details as any).correctionType, level)
        );
      }
    }

    // DaneFaKorygowanej (wymagane - minimum 1, maksimum 50000)
    if (
      !this.reqArray(
        ctx,
        'details.correctedInvoices',
        (details as any).correctedInvoices,
        'Brak listy faktur korygowanych dla faktury korygującej'
      )
    ) {
      return null;
    }

    if (
      (details as any).correctedInvoices &&
      (details as any).correctedInvoices.length > 0
    ) {
      if ((details as any).correctedInvoices.length > 50000) {
        this.vWarn(
          ctx,
          'LIMIT',
          'details.correctedInvoices',
          'Liczba faktur korygowanych przekracza limit 50000. Przetworzono tylko pierwsze 50000.'
        );
      }
      const invoices = (
        (details as any).correctedInvoices as Fa3CorrectedInvoiceRef[]
      ).slice(0, 50000);
      for (const inv of invoices) {
        const invXml = this.buildCorrectedInvoice(inv, level, ctx);
        if (invXml) elements.push(invXml);
      }
    }

    // OkresFaKorygowanej (opcjonalne)
    if (this.hasValue((details as any).correctedInvoicePeriod)) {
      elements.push(
        this.element(
          'OkresFaKorygowanej',
          (details as any).correctedInvoicePeriod,
          level
        )
      );
    }

    // NrFaKorygowany (opcjonalne - poprawny numer faktury korygowanej)
    if (this.hasValue((details as any).correctedInvoiceNumber)) {
      elements.push(
        this.element(
          'NrFaKorygowany',
          (details as any).correctedInvoiceNumber,
          level
        )
      );
    }

    // P_15ZK i KursWalutyZK (opcjonalne - dla faktur zaliczkowych)
    if ((details as any).amountBeforeCorrection !== undefined) {
      elements.push(
        this.amountElement(
          'P_15ZK',
          (details as any).amountBeforeCorrection,
          level
        )
      );

      if ((details as any).exchangeRateBeforeCorrection !== undefined) {
        elements.push(
          this.quantityElement(
            'KursWalutyZK',
            (details as any).exchangeRateBeforeCorrection,
            level
          )
        );
      }
    }

    return this.joinElements(elements);
  }

  private buildCorrectedInvoice(
    inv: Fa3CorrectedInvoiceRef,
    level: number,
    ctx?: Fa3BuildContext
  ): string | null {
    const innerLevel = level + 1;
    const elements: Array<string | null> = [];

    // DataWystFaKorygowanej (wymagana)
    if (
      !this.reqDateLike(
        ctx,
        'correctedInvoice.issueDate',
        inv?.issueDate,
        'Brak daty wystawienia faktury korygowanej'
      )
    ) {
      return null;
    }
    elements.push(
      this.dateElement('DataWystFaKorygowanej', inv.issueDate, innerLevel)
    );

    // NrFaKorygowanej (wymagany)
    if (
      !this.reqString(
        ctx,
        'correctedInvoice.number',
        inv?.number,
        'Brak numeru faktury korygowanej'
      )
    ) {
      return null;
    }
    elements.push(this.element('NrFaKorygowanej', inv.number, innerLevel));

    // Choice: NrKSeF + NrKSeFFaKorygowanej OR NrKSeFN
    if (this.hasValue(inv.ksefNumber)) {
      // Faktura korygowana wystawiona w KSeF
      elements.push(this.element('NrKSeF', '1', innerLevel));
      elements.push(
        this.element('NrKSeFFaKorygowanej', inv.ksefNumber, innerLevel)
      );
    } else {
      // Faktura korygowana poza KSeF
      elements.push(this.element('NrKSeFN', '1', innerLevel));
    }

    return this.block('DaneFaKorygowanej', this.joinElements(elements), level);
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
    ctx?.error('CorrectionBuilder', code, path, message);
  }

  protected vWarn(
    ctx: Fa3BuildContext | undefined,
    code: string,
    path: string,
    message: string
  ): void {
    ctx?.warn('CorrectionBuilder', code, path, message);
  }

  protected reqString(
    ctx: Fa3BuildContext | undefined,
    path: string,
    value: unknown,
    message: string
  ): value is string {
    if (typeof value === 'string' && value.trim() !== '') return true;
    this.vError(ctx, 'REQUIRED', path, message);
    return false;
  }

  protected reqArray<T = unknown>(
    ctx: Fa3BuildContext | undefined,
    path: string,
    value: unknown,
    message: string
  ): value is T[] {
    if (Array.isArray(value) && value.length > 0) return true;
    this.vError(ctx, 'REQUIRED_ARRAY', path, message);
    return false;
  }

  protected reqDateLike(
    ctx: Fa3BuildContext | undefined,
    path: string,
    value: unknown,
    message: string
  ): value is Date | string {
    if (value instanceof Date && !Number.isNaN(value.getTime())) return true;
    if (
      typeof value === 'string' &&
      value.trim() !== '' &&
      !Number.isNaN(new Date(value).getTime())
    ) {
      return true;
    }
    this.vError(ctx, 'REQUIRED_DATE', path, message);
    return false;
  }

  protected reqOneOf<T extends string | number>(
    ctx: Fa3BuildContext | undefined,
    path: string,
    value: unknown,
    allowed: readonly T[],
    message: string
  ): value is T {
    if ((allowed as readonly unknown[]).includes(value)) return true;
    this.vError(
      ctx,
      'ONE_OF',
      path,
      `${message}. Dozwolone wartości: ${allowed.join(', ')}`
    );
    return false;
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
