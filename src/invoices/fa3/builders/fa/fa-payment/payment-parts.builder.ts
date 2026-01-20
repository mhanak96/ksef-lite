import type { Fa3BuildContext } from '../../../validators/build-context';
import type {
  Fa3PartialPayment,
  Fa3DueDate,
  Fa3BankAccount,
  Fa3Discount,
} from '../../../types';

type DueDateLike = {
  dueDate?: Fa3DueDate['dueDate'] | null;
  dueDateDescription?: Fa3DueDate['dueDateDescription'] | null;
};

export class PaymentPartsBuilder {
  private indentSize: number = 2;
  private indentChar: string = ' ';
  private builderName: string = 'PaymentPartsBuilder';

  // ============================================================
  // PUBLIC API - PARTIAL PAYMENTS
  // ============================================================

  public buildPartialPayments(
    payments: Fa3PartialPayment[] | null | undefined,
    level: number,
    ctx?: Fa3BuildContext
  ): string | null {
    if (!payments || payments.length === 0) return null;

    if (payments.length > 100) {
      this.vWarn(
        ctx,
        'LIMIT',
        'payment.partialPayments',
        'Liczba płatności częściowych przekracza limit 100. Przetworzono tylko pierwsze 100.'
      );
    }

    const limited = payments.slice(0, 100);
    const elements = limited.map((p, i) => this.buildPartialPayment(p, level, ctx, i));

    return this.joinElements(elements);
  }

  private buildPartialPayment(
    partial: Fa3PartialPayment,
    level: number,
    ctx?: Fa3BuildContext,
    index?: number
  ): string | null {
    const path = `partialPayments[${index ?? 0}]`;
    const innerLevel = level + 1;
    const elements: Array<string | null> = [];

    // KwotaZaplatyCzesciowej (wymagane)
    if (!this.reqNumber(ctx, `${path}.amount`, partial.amount, 'Brak kwoty zapłaty częściowej')) {
      return null;
    }
    elements.push(this.amountElement('KwotaZaplatyCzesciowej', partial.amount, innerLevel));

    // DataZaplatyCzesciowej (wymagane)
    if (!this.reqDateLike(ctx, `${path}.date`, partial.date, 'Brak daty zapłaty częściowej')) {
      return null;
    }
    elements.push(this.dateElement('DataZaplatyCzesciowej', partial.date, innerLevel));

    // FormaPlatnosci (opcjonalne)
    if (typeof partial.method === 'number') {
      if (!this.reqOneOf(
        ctx,
        `${path}.method`,
        partial.method,
        [1, 2, 3, 4, 5, 6, 7] as const,
        'FormaPlatnosci musi być 1-7'
      )) {
        return null;
      }
      elements.push(this.element('FormaPlatnosci', partial.method, innerLevel));
    }

    // PlatnoscInna + OpisPlatnosci (opcjonalne)
    if (partial.otherMethod === true) {
      elements.push(this.element('PlatnoscInna', '1', innerLevel));
      if (this.hasValue(partial.methodDescription)) {
        elements.push(this.element('OpisPlatnosci', partial.methodDescription, innerLevel));
      }
    }

    return this.block('ZaplataCzesciowa', this.joinElements(elements), level);
  }

  // ============================================================
  // PUBLIC API - DUE DATES
  // ============================================================

  public buildDueDates(
    dueDates: Fa3DueDate[] | null | undefined,
    singleDueDate: Date | string | null | undefined,
    dueDateDescription: Fa3DueDate['dueDateDescription'] | null | undefined,
    level: number,
    ctx?: Fa3BuildContext
  ): string | null {
    // Jeśli jest tablica terminów
    if (dueDates && dueDates.length > 0) {
      if (dueDates.length > 100) {
        this.vWarn(
          ctx,
          'LIMIT',
          'payment.dueDates',
          'Liczba terminów płatności przekracza limit 100. Przetworzono tylko pierwsze 100.'
        );
      }

      const limited = dueDates.slice(0, 100);
      const elements = limited.map((dd) => this.buildDueDate(dd, level, ctx));
      return this.joinElements(elements);
    }
    // Jeśli są pojedyncze pola dueDate/dueDateDescription
    else if (singleDueDate || dueDateDescription) {
      const dueLike: DueDateLike = {
        dueDate: singleDueDate,
        dueDateDescription: dueDateDescription,
      };
      return this.buildDueDate(dueLike, level, ctx);
    }

    return null;
  }

  private buildDueDate(
    data: DueDateLike,
    level: number,
    ctx?: Fa3BuildContext
  ): string | null {
    const innerLevel = level + 1;
    const elements: Array<string | null> = [];

    // Termin (opcjonalne)
    if (data.dueDate) {
      elements.push(this.dateElement('Termin', data.dueDate, innerLevel));
    }

    // TerminOpis (opcjonalne)
    if (data.dueDateDescription) {
      const desc = data.dueDateDescription;
      const descElements: Array<string | null> = [];

      if (!this.reqNumber(ctx, 'dueDateDescription.quantity', desc.quantity, 'Brak ilości w opisie terminu')) {
        return null;
      }
      descElements.push(this.element('Ilosc', desc.quantity, innerLevel + 1));

      if (!this.reqString(ctx, 'dueDateDescription.unit', desc.unit, 'Brak jednostki w opisie terminu')) {
        return null;
      }
      descElements.push(this.element('Jednostka', desc.unit, innerLevel + 1));

      if (!this.reqString(
        ctx,
        'dueDateDescription.startEvent',
        desc.startEvent,
        'Brak zdarzenia początkowego w opisie terminu'
      )) {
        return null;
      }
      descElements.push(this.element('ZdarzeniePoczatkowe', desc.startEvent, innerLevel + 1));

      elements.push(this.block('TerminOpis', this.joinElements(descElements), innerLevel));
    }

    return elements.length > 0 ? this.block('TerminPlatnosci', this.joinElements(elements), level) : null;
  }

  // ============================================================
  // PUBLIC API - BANK ACCOUNTS
  // ============================================================

  public buildBankAccounts(
    accounts: Fa3BankAccount[] | null | undefined,
    singleAccount: string | Fa3BankAccount | null | undefined,
    level: number,
    ctx?: Fa3BuildContext
  ): string | null {
    // Jeśli jest tablica rachunków
    if (accounts && accounts.length > 0) {
      if (accounts.length > 100) {
        this.vWarn(
          ctx,
          'LIMIT',
          'payment.bankAccounts',
          'Liczba rachunków bankowych przekracza limit 100. Przetworzono tylko pierwsze 100.'
        );
      }

      const limited = accounts.slice(0, 100);
      const elements = limited.map((acc, i) =>
        this.buildBankAccount(acc, level, 'RachunekBankowy', ctx, i)
      );
      return this.joinElements(elements);
    }
    // Jeśli jest pojedynczy rachunek
    else if (singleAccount) {
      const normalized = this.normalizeBankAccount(singleAccount);
      return this.buildBankAccount(normalized, level, 'RachunekBankowy', ctx, 0);
    }

    return null;
  }

  public buildFactorAccounts(
    accounts: Fa3BankAccount[] | null | undefined,
    level: number,
    ctx?: Fa3BuildContext
  ): string | null {
    if (!accounts || accounts.length === 0) return null;

    if (accounts.length > 20) {
      this.vWarn(
        ctx,
        'LIMIT',
        'payment.factorAccounts',
        'Liczba rachunków faktora przekracza limit 20. Przetworzono tylko pierwsze 20.'
      );
    }

    const limited = accounts.slice(0, 20);
    const elements = limited.map((acc, i) =>
      this.buildBankAccount(acc, level, 'RachunekBankowyFaktora', ctx, i)
    );

    return this.joinElements(elements);
  }

  private normalizeBankAccount(account: string | Fa3BankAccount): Fa3BankAccount {
    if (typeof account === 'string') {
      return { accountNumber: account };
    }
    return account;
  }

  private buildBankAccount(
    account: Fa3BankAccount,
    level: number,
    tagName: string,
    ctx?: Fa3BuildContext,
    index?: number
  ): string | null {
    const path = `bankAccount[${index ?? 0}]`;
    const innerLevel = level + 1;
    const elements: Array<string | null> = [];

    // NrRB (wymagane)
    if (!this.reqString(ctx, `${path}.accountNumber`, account.accountNumber, 'Brak numeru rachunku bankowego')) {
      return null;
    }
    elements.push(this.element('NrRB', account.accountNumber, innerLevel));

    // SWIFT (opcjonalne)
    if (this.hasValue(account.swift)) {
      elements.push(this.element('SWIFT', account.swift, innerLevel));
    }

    // RachunekWlasnyBanku (opcjonalne)
    if (account.ownBankAccountType !== undefined) {
      if (!this.reqOneOf(
        ctx,
        `${path}.ownBankAccountType`,
        account.ownBankAccountType,
        [1, 2, 3] as const,
        'RachunekWlasnyBanku musi być 1, 2 lub 3'
      )) {
        return null;
      }
      elements.push(this.element('RachunekWlasnyBanku', account.ownBankAccountType, innerLevel));
    }

    // NazwaBanku (opcjonalne)
    if (this.hasValue(account.bankName)) {
      elements.push(this.element('NazwaBanku', account.bankName, innerLevel));
    }

    // OpisRachunku (opcjonalne)
    if (this.hasValue(account.description)) {
      elements.push(this.element('OpisRachunku', account.description, innerLevel));
    }

    return this.block(tagName, this.joinElements(elements), level);
  }

  // ============================================================
  // PUBLIC API - DISCOUNT
  // ============================================================

  public buildDiscount(
    discount: Fa3Discount,
    level: number,
    ctx?: Fa3BuildContext
  ): string | null {
    const innerLevel = level + 1;
    const elements: Array<string | null> = [];

    // WarunkiSkonta (wymagane)
    if (!this.reqString(ctx, 'discount.conditions', discount.conditions, 'Brak warunków skonta')) {
      return null;
    }
    elements.push(this.element('WarunkiSkonta', discount.conditions, innerLevel));

    // WysokoscSkonta (wymagane)
    if (!this.reqString(ctx, 'discount.amount', discount.amount, 'Brak wysokości skonta')) {
      return null;
    }
    elements.push(this.element('WysokoscSkonta', discount.amount, innerLevel));

    return this.block('Skonto', this.joinElements(elements), level);
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

  private reqOneOf<T extends string | number | boolean>(
    ctx: Fa3BuildContext | undefined,
    path: string,
    value: unknown,
    allowed: readonly T[],
    message: string
  ): value is T {
    if ((allowed as readonly unknown[]).includes(value)) return true;
    this.vError(ctx, 'ONE_OF', path, `${message}. Dozwolone wartości: ${allowed.join(', ')}`);
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