import { PaymentPartsBuilder } from './payment-parts.builder';
import type { Fa3BuildContext } from '../../../validators/build-context';
import type { Fa3Payment } from '../../../types';

export class PaymentBuilder {
  private indentSize: number = 2;
  private indentChar: string = ' ';
  private builderName: string = 'PaymentBuilder';
  private paymentPartsBuilder: PaymentPartsBuilder;

  constructor() {
    this.paymentPartsBuilder = new PaymentPartsBuilder();
  }

  // ============================================================
  // PUBLIC API
  // ============================================================

  public build(
    payment: Fa3Payment | null | undefined,
    ctx?: Fa3BuildContext,
    level: number = 1
  ): string | null {
    if (!payment) return null;

    const innerLevel = level + 1;
    const elements: Array<string | null> = [];

    // Zaplacono + DataZaplaty
    if (payment.paid === true && payment.paymentDate) {
      elements.push(this.element('Zaplacono', '1', innerLevel));

      if (
        !this.reqDateLike(
          ctx,
          'payment.paymentDate',
          payment.paymentDate,
          'Brak daty zapłaty'
        )
      ) {
        return null;
      }
      elements.push(
        this.dateElement('DataZaplaty', payment.paymentDate, innerLevel)
      );
    }
    // ZnacznikZaplatyCzesciowej + ZaplataCzesciowa (deleguj do PaymentPartsBuilder)
    else if (
      payment.partialPaymentFlag &&
      payment.partialPayments &&
      payment.partialPayments.length > 0
    ) {
      if (
        !this.reqOneOf(
          ctx,
          'payment.partialPaymentFlag',
          payment.partialPaymentFlag,
          [1, 2] as const,
          'ZnacznikZaplatyCzesciowej musi być 1 lub 2'
        )
      ) {
        return null;
      }
      elements.push(
        this.element(
          'ZnacznikZaplatyCzesciowej',
          payment.partialPaymentFlag,
          innerLevel
        )
      );

      const partialPaymentsXml = this.paymentPartsBuilder.buildPartialPayments(
        payment.partialPayments,
        innerLevel,
        ctx
      );
      if (partialPaymentsXml) elements.push(partialPaymentsXml);
    }

    // TerminPlatnosci (deleguj do PaymentPartsBuilder) — pomijaj gdy zapłacono
    if (payment.paid !== true) {
      const dueDatesXml = this.paymentPartsBuilder.buildDueDates(
        payment.dueDates,
        payment.dueDate,
        payment.dueDateDescription,
        innerLevel,
        ctx
      );
      if (dueDatesXml) elements.push(dueDatesXml);
    }

    // FormaPlatnosci
    if (typeof payment.method === 'number') {
      if (
        !this.reqOneOf(
          ctx,
          'payment.method',
          payment.method,
          [1, 2, 3, 4, 5, 6, 7] as const,
          'FormaPlatnosci musi być 1-7'
        )
      ) {
        return null;
      }
      elements.push(this.element('FormaPlatnosci', payment.method, innerLevel));
    }

    // PlatnoscInna + OpisPlatnosci
    if (payment.otherMethod === true) {
      elements.push(this.element('PlatnoscInna', '1', innerLevel));

      if (
        !this.reqString(
          ctx,
          'payment.methodDescription',
          payment.methodDescription,
          'Brak opisu innej formy płatności'
        )
      ) {
        return null;
      }
      elements.push(
        this.element('OpisPlatnosci', payment.methodDescription, innerLevel)
      );
    }

    // RachunekBankowy (deleguj do PaymentPartsBuilder)
    const bankAccountsXml = this.paymentPartsBuilder.buildBankAccounts(
      payment.bankAccounts,
      payment.bankAccount,
      innerLevel,
      ctx
    );
    if (bankAccountsXml) elements.push(bankAccountsXml);

    // RachunekBankowyFaktora (deleguj do PaymentPartsBuilder)
    const factorAccountsXml = this.paymentPartsBuilder.buildFactorAccounts(
      payment.factorAccounts,
      innerLevel,
      ctx
    );
    if (factorAccountsXml) elements.push(factorAccountsXml);

    // Skonto (deleguj do PaymentPartsBuilder)
    if (payment.discount) {
      const discountXml = this.paymentPartsBuilder.buildDiscount(
        payment.discount,
        innerLevel,
        ctx
      );
      if (discountXml) elements.push(discountXml);
    }

    // LinkDoPlatnosci
    if (this.hasValue(payment.paymentLink)) {
      elements.push(
        this.element('LinkDoPlatnosci', payment.paymentLink, innerLevel)
      );
    }

    // IPKSeF
    if (this.hasValue(payment.ksefPaymentId)) {
      elements.push(this.element('IPKSeF', payment.ksefPaymentId, innerLevel));
    }

    const xml = this.joinElements(elements);
    return xml ? this.block('Platnosc', xml, level) : null;
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

  private reqDateLike(
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

  private reqString(
    ctx: Fa3BuildContext | undefined,
    path: string,
    value: unknown,
    message: string
  ): value is string {
    if (typeof value === 'string' && value.trim() !== '') return true;
    this.vError(ctx, 'REQUIRED', path, message);
    return false;
  }

  private reqOneOf<T extends string | number | boolean>(
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
