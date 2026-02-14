import type { Fa3BuildContext } from '../../../validators/build-context';
import type {
  Fa3Settlement,
  Fa3SettlementCharge,
  Fa3SettlementDeduction,
} from '../../../types';

export class SettlementBuilder {
  private indentSize: number = 2;
  private indentChar: string = ' ';
  private builderName: string = 'SettlementBuilder';

  // ============================================================
  // PUBLIC API
  // ============================================================

  public build(
    settlement: Fa3Settlement | null | undefined,
    ctx?: Fa3BuildContext,
    level: number = 1
  ): string | null {
    if (!settlement) return null;

    const innerLevel = level + 1;
    const elements: Array<string | null> = [];

    // Obciazenia (0-100)
    if (settlement.charges && settlement.charges.length > 0) {
      if (settlement.charges.length > 100) {
        this.vWarn(
          ctx,
          'LIMIT',
          'settlement.charges',
          'Liczba obciążeń przekracza limit 100. Przetworzono tylko pierwsze 100.'
        );
      }

      const charges = settlement.charges.slice(0, 100);
      for (let i = 0; i < charges.length; i++) {
        const chargeXml = this.buildCharge(charges[i], innerLevel, ctx, i);
        if (chargeXml) elements.push(chargeXml);
      }
    }

    // SumaObciazen (opcjonalne)
    if (
      settlement.totalCharges !== undefined &&
      settlement.totalCharges !== null
    ) {
      elements.push(
        this.amountElement('SumaObciazen', settlement.totalCharges, innerLevel)
      );
    }

    // Odliczenia (0-100)
    if (settlement.deductions && settlement.deductions.length > 0) {
      if (settlement.deductions.length > 100) {
        this.vWarn(
          ctx,
          'LIMIT',
          'settlement.deductions',
          'Liczba odliczeń przekracza limit 100. Przetworzono tylko pierwsze 100.'
        );
      }

      const deductions = settlement.deductions.slice(0, 100);
      for (let i = 0; i < deductions.length; i++) {
        const deductionXml = this.buildDeduction(
          deductions[i],
          innerLevel,
          ctx,
          i
        );
        if (deductionXml) elements.push(deductionXml);
      }
    }

    // SumaOdliczen (opcjonalne)
    if (
      settlement.totalDeductions !== undefined &&
      settlement.totalDeductions !== null
    ) {
      elements.push(
        this.amountElement(
          'SumaOdliczen',
          settlement.totalDeductions,
          innerLevel
        )
      );
    }

    // DoZaplaty (opcjonalne)
    if (
      settlement.amountToPay !== undefined &&
      settlement.amountToPay !== null
    ) {
      elements.push(
        this.amountElement('DoZaplaty', settlement.amountToPay, innerLevel)
      );
    }

    // DoRozliczenia (opcjonalne)
    if (
      settlement.amountToSettle !== undefined &&
      settlement.amountToSettle !== null
    ) {
      elements.push(
        this.amountElement(
          'DoRozliczenia',
          settlement.amountToSettle,
          innerLevel
        )
      );
    }

    const xml = this.joinElements(elements);
    return xml ? this.block('Rozliczenie', xml, level) : null;
  }

  // ============================================================
  // PRIVATE BUILDERS
  // ============================================================

  private buildCharge(
    charge: Fa3SettlementCharge,
    level: number,
    ctx?: Fa3BuildContext,
    index?: number
  ): string | null {
    const path = `settlement.charges[${index ?? 0}]`;
    const innerLevel = level + 1;
    const elements: Array<string | null> = [];

    // Kwota (wymagane)
    if (
      !this.reqNumber(
        ctx,
        `${path}.amount`,
        charge.amount,
        'Brak kwoty obciążenia'
      )
    ) {
      return null;
    }
    elements.push(this.amountElement('Kwota', charge.amount, innerLevel));

    // Powod (wymagane)
    if (
      !this.reqString(
        ctx,
        `${path}.reason`,
        charge.reason,
        'Brak powodu obciążenia'
      )
    ) {
      return null;
    }
    elements.push(this.element('Powod', charge.reason, innerLevel));

    return this.block('Obciazenia', this.joinElements(elements), level);
  }

  private buildDeduction(
    deduction: Fa3SettlementDeduction,
    level: number,
    ctx?: Fa3BuildContext,
    index?: number
  ): string | null {
    const path = `settlement.deductions[${index ?? 0}]`;
    const innerLevel = level + 1;
    const elements: Array<string | null> = [];

    // Kwota (wymagane)
    if (
      !this.reqNumber(
        ctx,
        `${path}.amount`,
        deduction.amount,
        'Brak kwoty odliczenia'
      )
    ) {
      return null;
    }
    elements.push(this.amountElement('Kwota', deduction.amount, innerLevel));

    // Powod (wymagane)
    if (
      !this.reqString(
        ctx,
        `${path}.reason`,
        deduction.reason,
        'Brak powodu odliczenia'
      )
    ) {
      return null;
    }
    elements.push(this.element('Powod', deduction.reason, innerLevel));

    return this.block('Odliczenia', this.joinElements(elements), level);
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
