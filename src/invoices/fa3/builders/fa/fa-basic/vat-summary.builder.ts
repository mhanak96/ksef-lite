import type { Fa3BuildContext } from '../../../validators/build-context';
import type { Fa3VatSummary } from '../../../types';

export type VatSummaryBuilderOptions = {
  indentSize?: number;
  indentChar?: string;
};

export class VatSummaryBuilder {
  private readonly indentSize: number;
  private readonly indentChar: string;

  constructor(options: VatSummaryBuilderOptions = {}) {
    this.indentSize = options.indentSize ?? 2;
    this.indentChar = options.indentChar ?? ' ';
  }

  build(
    vatSummary: Fa3VatSummary | null | undefined,
    currency: string,
    ctx?: Fa3BuildContext,
    level: number = 1
  ): string | null {
    if (!vatSummary) {
      this.vWarn(
        ctx,
        'MISSING_VAT_SUMMARY',
        'vatSummary',
        'Brak podsumowania VAT'
      );
      return null;
    }

    const elements: Array<string | null> = [];

    // Iterujemy po wszystkich stawkach VAT w podsumowaniu
    for (const rateKey in vatSummary) {
      const group = vatSummary[rateKey];
      const rate = group.vatRate;

      // P_13_1, P_14_1 - Stawka podstawowa (23% lub 22%)
      if (rate === 23 || rate === 22 || rate === '23' || rate === '22') {
        if (group.netAmount !== undefined && group.netAmount !== null) {
          elements.push(this.amountElement('P_13_1', group.netAmount, level));
        }
        if (group.vatAmount !== undefined && group.vatAmount !== null) {
          elements.push(this.amountElement('P_14_1', group.vatAmount, level));
        }
        // P_14_1W - Kwota VAT przeliczona na PLN (tylko dla walut obcych)
        if (
          currency !== 'PLN' &&
          group.vatAmountPLN !== undefined &&
          group.vatAmountPLN !== null
        ) {
          elements.push(
            this.amountElement('P_14_1W', group.vatAmountPLN, level)
          );
        }
      }
      // P_13_2, P_14_2 - Stawka obniżona pierwsza (8% lub 7%)
      else if (rate === 8 || rate === 7 || rate === '8' || rate === '7') {
        if (group.netAmount !== undefined && group.netAmount !== null) {
          elements.push(this.amountElement('P_13_2', group.netAmount, level));
        }
        if (group.vatAmount !== undefined && group.vatAmount !== null) {
          elements.push(this.amountElement('P_14_2', group.vatAmount, level));
        }
        if (
          currency !== 'PLN' &&
          group.vatAmountPLN !== undefined &&
          group.vatAmountPLN !== null
        ) {
          elements.push(
            this.amountElement('P_14_2W', group.vatAmountPLN, level)
          );
        }
      }
      // P_13_3, P_14_3 - Stawka obniżona druga (5%)
      else if (rate === 5 || rate === '5') {
        if (group.netAmount !== undefined && group.netAmount !== null) {
          elements.push(this.amountElement('P_13_3', group.netAmount, level));
        }
        if (group.vatAmount !== undefined && group.vatAmount !== null) {
          elements.push(this.amountElement('P_14_3', group.vatAmount, level));
        }
        if (
          currency !== 'PLN' &&
          group.vatAmountPLN !== undefined &&
          group.vatAmountPLN !== null
        ) {
          elements.push(
            this.amountElement('P_14_3W', group.vatAmountPLN, level)
          );
        }
      }
      // P_13_4, P_14_4 - Stawka obniżona trzecia (4% lub 3% - ryczałt dla taksówek)
      else if (rate === 4 || rate === 3 || rate === '4' || rate === '3') {
        if (group.netAmount !== undefined && group.netAmount !== null) {
          elements.push(this.amountElement('P_13_4', group.netAmount, level));
        }
        if (group.vatAmount !== undefined && group.vatAmount !== null) {
          elements.push(this.amountElement('P_14_4', group.vatAmount, level));
        }
        if (
          currency !== 'PLN' &&
          group.vatAmountPLN !== undefined &&
          group.vatAmountPLN !== null
        ) {
          elements.push(
            this.amountElement('P_14_4W', group.vatAmountPLN, level)
          );
        }
      }
      // P_13_5, P_14_5 - Procedura szczególna OSS (dział XII rozdział 6a)
      else if (rate === 'OSS' || (group as any).isOSS) {
        if (group.netAmount !== undefined && group.netAmount !== null) {
          elements.push(this.amountElement('P_13_5', group.netAmount, level));
        }
        if (group.vatAmount !== undefined && group.vatAmount !== null) {
          elements.push(this.amountElement('P_14_5', group.vatAmount, level));
        }
      }
      // P_13_6_1 - Stawka 0% (z wyłączeniem WDT i eksportu)
      else if (rate === '0 KR' || rate === '0KR') {
        if (group.netAmount !== undefined && group.netAmount !== null) {
          elements.push(this.amountElement('P_13_6_1', group.netAmount, level));
        }
      }
      // P_13_6_2 - Stawka 0% (wewnątrzwspólnotowa dostawa towarów - WDT)
      else if (rate === '0 WDT' || rate === '0WDT') {
        if (group.netAmount !== undefined && group.netAmount !== null) {
          elements.push(this.amountElement('P_13_6_2', group.netAmount, level));
        }
      }
      // P_13_6_3 - Stawka 0% (eksport)
      else if (rate === '0 EX' || rate === '0EX') {
        if (group.netAmount !== undefined && group.netAmount !== null) {
          elements.push(this.amountElement('P_13_6_3', group.netAmount, level));
        }
      }
      // P_13_7 - Zwolnione od podatku
      else if (rate === 'zw' || rate === 'ZW') {
        if (group.netAmount !== undefined && group.netAmount !== null) {
          elements.push(this.amountElement('P_13_7', group.netAmount, level));
        }
      }
      // P_13_8 - Niepodlegające opodatkowaniu poza terytorium kraju (z wyłączeniem OSS)
      else if (rate === 'np I' || rate === 'NP_I') {
        if (group.netAmount !== undefined && group.netAmount !== null) {
          elements.push(this.amountElement('P_13_8', group.netAmount, level));
        }
      }
      // P_13_9 - Niepodlegające opodatkowaniu (art. 100 ust. 1 pkt 4)
      else if (rate === 'np II' || rate === 'NP_II') {
        if (group.netAmount !== undefined && group.netAmount !== null) {
          elements.push(this.amountElement('P_13_9', group.netAmount, level));
        }
      }
      // P_13_10 - Odwrotne obciążenie
      else if (rate === 'oo' || rate === 'OO') {
        if (group.netAmount !== undefined && group.netAmount !== null) {
          elements.push(this.amountElement('P_13_10', group.netAmount, level));
        }
      }
      // P_13_11 - Procedura marży (art. 119 i 120)
      else if (rate === 'marza' || (group as any).isMargin) {
        if (group.netAmount !== undefined && group.netAmount !== null) {
          elements.push(this.amountElement('P_13_11', group.netAmount, level));
        }
      }
      // Nierozpoznana stawka VAT
      else {
        this.vWarn(
          ctx,
          'UNKNOWN_VAT_RATE',
          `vatSummary.${rateKey}`,
          `Nierozpoznana stawka VAT: ${rate}. Pominięto w podsumowaniu.`
        );
      }
    }

    return this.joinElements(elements);
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
    ctx?.error('VatSummaryBuilder', code, path, message);
  }

  protected vWarn(
    ctx: Fa3BuildContext | undefined,
    code: string,
    path: string,
    message: string
  ): void {
    ctx?.warn('VatSummaryBuilder', code, path, message);
  }

  // ============================================================
  // XML FORMATTING HELPERS
  // ============================================================

  protected indent(level: number): string {
    return this.indentChar.repeat(level * this.indentSize);
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

  protected element(
    tagName: string,
    value: unknown,
    level: number
  ): string | null {
    if (value === undefined || value === null || value === '') return null;
    return `${this.indent(level)}<${tagName}>${this.escapeXml(value)}</${tagName}>`;
  }

  protected formatAmount(amount: number): string {
    return this.roundAmount(Number(amount)).toFixed(2);
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
}
