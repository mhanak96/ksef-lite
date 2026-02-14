import type { Fa3BuildContext } from '../../../validators/build-context';
import type {
  Fa3Annotations,
  Fa3NewTransportMeans,
  Fa3InvoiceForAnnotations,
  Fa3InvoiceItemForAnnotations,
} from '../../../types';

export type AnnotationsBuilderOptions = {
  indentSize?: number;
  indentChar?: string;
};

export class AnnotationsBuilder {
  private readonly indentSize: number;
  private readonly indentChar: string;

  constructor(options: AnnotationsBuilderOptions = {}) {
    this.indentSize = options.indentSize ?? 2;
    this.indentChar = options.indentChar ?? ' ';
  }

  public build(
    annotations: Fa3Annotations | null | undefined,
    ctx?: Fa3BuildContext,
    level: number = 1
  ): string | null {
    const anno: Fa3Annotations = (annotations ?? {}) as Fa3Annotations;

    const innerLevel = level + 1;
    const elements: Array<string | null> = [];

    // P_16 - Metoda kasowa (wymagane: 1 lub 2)
    const p_16 = anno.p_16 ?? 2;
    if (
      !this.reqOneOf(
        ctx,
        'annotations.p_16',
        p_16,
        [1, 2] as const,
        'P_16 musi być 1 lub 2'
      )
    ) {
      return null;
    }
    elements.push(this.element('P_16', p_16, innerLevel));

    // P_17 - Samofakturowanie (wymagane: 1 lub 2)
    const p_17 = anno.p_17 ?? 2;
    if (
      !this.reqOneOf(
        ctx,
        'annotations.p_17',
        p_17,
        [1, 2] as const,
        'P_17 musi być 1 lub 2'
      )
    ) {
      return null;
    }
    elements.push(this.element('P_17', p_17, innerLevel));

    // P_18 - Odwrotne obciążenie (wymagane: 1 lub 2)
    const p_18 = anno.p_18 ?? 2;
    if (
      !this.reqOneOf(
        ctx,
        'annotations.p_18',
        p_18,
        [1, 2] as const,
        'P_18 musi być 1 lub 2'
      )
    ) {
      return null;
    }
    elements.push(this.element('P_18', p_18, innerLevel));

    // P_18A - Mechanizm podzielonej płatności (wymagane: 1 lub 2)
    const p_18a = anno.p_18a ?? 2;
    if (
      !this.reqOneOf(
        ctx,
        'annotations.p_18a',
        p_18a,
        [1, 2] as const,
        'P_18A musi być 1 lub 2'
      )
    ) {
      return null;
    }
    elements.push(this.element('P_18A', p_18a, innerLevel));

    // Zwolnienie
    const exemptionXml = this.buildExemption(anno, innerLevel, ctx);
    if (exemptionXml) elements.push(exemptionXml);

    // NoweSrodkiTransportu
    const transportXml = this.buildNewTransportMeans(anno, innerLevel, ctx);
    if (transportXml) elements.push(transportXml);

    // P_23 - Procedura uproszczona (wymagane: 1 lub 2)
    const p_23 = anno.p_23 ?? 2;
    if (
      !this.reqOneOf(
        ctx,
        'annotations.p_23',
        p_23,
        [1, 2] as const,
        'P_23 musi być 1 lub 2'
      )
    ) {
      return null;
    }
    elements.push(this.element('P_23', p_23, innerLevel));

    // PMarzy
    const marginXml = this.buildMarginProcedures(anno, innerLevel, ctx);
    if (marginXml) elements.push(marginXml);

    return this.block('Adnotacje', this.joinElements(elements), level);
  }

  // ============================================================
  // Zwolnienie
  // ============================================================

  private buildExemption(
    annotations: Fa3Annotations,
    level: number,
    ctx?: Fa3BuildContext
  ): string | null {
    const innerLevel = level + 1;
    const elements: Array<string | null> = [];

    if (annotations.p_19 === 1) {
      elements.push(this.element('P_19', '1', innerLevel));

      const hasAnyBasis =
        this.hasValue(annotations.p_19a) ||
        this.hasValue(annotations.p_19b) ||
        this.hasValue(annotations.p_19c);

      if (!hasAnyBasis) {
        this.vError(
          ctx,
          'REQUIRED',
          'annotations.p_19',
          'Jeśli P_19=1, wymagana jest podstawa prawna (P_19A, P_19B lub P_19C)'
        );
      }

      if (this.hasValue(annotations.p_19a)) {
        elements.push(this.element('P_19A', annotations.p_19a, innerLevel));
      }
      if (this.hasValue(annotations.p_19b)) {
        elements.push(this.element('P_19B', annotations.p_19b, innerLevel));
      }
      if (this.hasValue(annotations.p_19c)) {
        elements.push(this.element('P_19C', annotations.p_19c, innerLevel));
      }
    } else {
      elements.push(this.element('P_19N', '1', innerLevel));
    }

    return this.block('Zwolnienie', this.joinElements(elements), level);
  }

  // ============================================================
  // Nowe środki transportu
  // ============================================================

  private buildNewTransportMeans(
    annotations: Fa3Annotations,
    level: number,
    ctx?: Fa3BuildContext
  ): string | null {
    const innerLevel = level + 1;
    const elements: Array<string | null> = [];

    const list = annotations.newTransportMeans;
    const hasList = Array.isArray(list) && list.length > 0;

    if (annotations.p_22 === 1 || hasList) {
      elements.push(this.element('P_22', '1', innerLevel));

      // P_42_5 - Obowiązek art. 42 ust. 5 (opcjonalne)
      if (annotations.p_42_5 !== undefined) {
        if (
          !this.reqOneOf(
            ctx,
            'annotations.p_42_5',
            annotations.p_42_5,
            [1, 2] as const,
            'P_42_5 musi być 1 lub 2'
          )
        ) {
          // kontynuuj mimo błędu
        } else {
          elements.push(this.element('P_42_5', annotations.p_42_5, innerLevel));
        }
      }

      if (!hasList) {
        this.vError(
          ctx,
          'REQUIRED',
          'annotations.newTransportMeans',
          'Jeśli P_22=1, wymagana jest lista środków transportu'
        );
      } else {
        // Max 10000
        const means = list!.slice(0, 10000);
        for (let i = 0; i < means.length; i++) {
          const transportXml = this.buildNewTransportMeansItem(
            means[i],
            innerLevel,
            ctx,
            i
          );
          if (transportXml) elements.push(transportXml);
        }
      }
    } else {
      elements.push(this.element('P_22N', '1', innerLevel));
    }

    return this.block(
      'NoweSrodkiTransportu',
      this.joinElements(elements),
      level
    );
  }

  private buildNewTransportMeansItem(
    transport: Fa3NewTransportMeans,
    level: number,
    ctx?: Fa3BuildContext,
    index?: number
  ): string | null {
    const path = `newTransportMeans[${index ?? 0}]`;
    const innerLevel = level + 1;
    const elements: Array<string | null> = [];

    // P_22A - Data pierwszego użycia (wymagana)
    if (
      !this.reqDateLike(
        ctx,
        `${path}.firstUseDate`,
        transport.firstUseDate,
        'Brak daty pierwszego użycia środka transportu'
      )
    ) {
      return null;
    }
    elements.push(
      this.dateElement('P_22A', transport.firstUseDate, innerLevel)
    );

    // P_NrWierszaNST - Numer wiersza faktury (wymagany)
    if (
      !this.reqNumber(
        ctx,
        `${path}.lineNumber`,
        transport.lineNumber,
        'Brak numeru wiersza faktury dla środka transportu'
      )
    ) {
      return null;
    }
    elements.push(
      this.element('P_NrWierszaNST', transport.lineNumber, innerLevel)
    );

    // Opcjonalne dane środka transportu
    if (this.hasValue(transport.brand)) {
      elements.push(this.element('P_22BMK', transport.brand, innerLevel));
    }
    if (this.hasValue(transport.model)) {
      elements.push(this.element('P_22BMD', transport.model, innerLevel));
    }
    if (this.hasValue(transport.color)) {
      elements.push(this.element('P_22BK', transport.color, innerLevel));
    }
    if (this.hasValue(transport.registrationNumber)) {
      elements.push(
        this.element('P_22BNR', transport.registrationNumber, innerLevel)
      );
    }
    if (this.hasValue(transport.productionYear)) {
      elements.push(
        this.element('P_22BRP', transport.productionYear, innerLevel)
      );
    }

    // P_22BT - "Typ/rodzaj" (opis) – UWAGA: w typach masz też `type: 1|2|3`.
    // Jeśli Twoje typy mają pole stringowe na P_22BT jako `transportType`, użyj go.
    // Jeżeli nadal trzymasz to w `vehicleType?: string`, to też to obsłużymy.
    const anyT = transport as unknown as {
      transportType?: string;
      vehicleType?: string;
      type?: unknown;
    };
    const transportTypeDesc =
      (typeof anyT.transportType === 'string' && anyT.transportType.trim()
        ? anyT.transportType
        : undefined) ??
      (typeof anyT.vehicleType === 'string' && anyT.vehicleType.trim()
        ? anyT.vehicleType
        : undefined);
    if (this.hasValue(transportTypeDesc)) {
      elements.push(this.element('P_22BT', transportTypeDesc, innerLevel));
    }

    // Choice: P_22B (lądowy) / P_22C (pływający) / P_22D (powietrzny)
    // W Twoich typach FA3 to jest `transport.type: 1|2|3` (NIE vehicleType jako number).
    if (transport.type === 1) {
      // Pojazd lądowy - wymagany przebieg
      if (
        !this.reqString(
          ctx,
          `${path}.mileage`,
          transport.mileage,
          'Brak przebiegu dla pojazdu lądowego'
        )
      ) {
        return null;
      }
      elements.push(this.element('P_22B', transport.mileage, innerLevel));

      // Choice: P_22B1 (VIN) / P_22B2 (nadwozie) / P_22B3 (podwozie) / P_22B4 (rama)
      if (this.hasValue(transport.vin)) {
        elements.push(this.element('P_22B1', transport.vin, innerLevel));
      } else if (this.hasValue(transport.bodyNumber)) {
        elements.push(this.element('P_22B2', transport.bodyNumber, innerLevel));
      } else if (this.hasValue(transport.chassisNumber)) {
        elements.push(
          this.element('P_22B3', transport.chassisNumber, innerLevel)
        );
      } else if (this.hasValue(transport.frameNumber)) {
        elements.push(
          this.element('P_22B4', transport.frameNumber, innerLevel)
        );
      }
    } else if (transport.type === 2) {
      // Jednostka pływająca - wymagane godziny
      if (
        !this.reqString(
          ctx,
          `${path}.operatingHours`,
          transport.operatingHours,
          'Brak godzin dla jednostki pływającej'
        )
      ) {
        return null;
      }
      elements.push(
        this.element('P_22C', transport.operatingHours, innerLevel)
      );

      if (this.hasValue(transport.hullNumber)) {
        elements.push(this.element('P_22C1', transport.hullNumber, innerLevel));
      }
    } else if (transport.type === 3) {
      // Statek powietrzny - wymagane godziny
      if (
        !this.reqString(
          ctx,
          `${path}.operatingHours`,
          transport.operatingHours,
          'Brak godzin dla statku powietrznego'
        )
      ) {
        return null;
      }
      elements.push(
        this.element('P_22D', transport.operatingHours, innerLevel)
      );

      // W Twoich typach było `factoryNumber`. Część kodu używa `serialNumber`.
      // Obsłużymy oba bez błędów TS.
      const anyA = transport as unknown as {
        serialNumber?: string;
        factoryNumber?: string;
      };
      const serial = anyA.serialNumber ?? anyA.factoryNumber;
      if (this.hasValue(serial)) {
        elements.push(this.element('P_22D1', serial, innerLevel));
      }
    } else {
      this.vError(
        ctx,
        'REQUIRED',
        `${path}.type`,
        'Brak lub nieprawidłowy typ pojazdu (1=lądowy, 2=pływający, 3=powietrzny)'
      );
    }

    return this.block(
      'NowySrodekTransportu',
      this.joinElements(elements),
      level
    );
  }

  // ============================================================
  // Procedury marży
  // ============================================================

  private buildMarginProcedures(
    annotations: Fa3Annotations,
    level: number,
    ctx?: Fa3BuildContext
  ): string | null {
    const innerLevel = level + 1;
    const elements: Array<string | null> = [];

    if (annotations.p_pMarzy === 1) {
      elements.push(this.element('P_PMarzy', '1', innerLevel));

      const hasAnyMargin =
        annotations.p_pMarzy_2 === 1 ||
        annotations.p_pMarzy_3_1 === 1 ||
        annotations.p_pMarzy_3_2 === 1 ||
        annotations.p_pMarzy_3_3 === 1;

      if (!hasAnyMargin) {
        this.vError(
          ctx,
          'REQUIRED',
          'annotations.p_pMarzy',
          'Jeśli P_PMarzy=1, wymagany jest typ procedury marży'
        );
      }

      if (annotations.p_pMarzy_2 === 1) {
        elements.push(this.element('P_PMarzy_2', '1', innerLevel));
      }
      if (annotations.p_pMarzy_3_1 === 1) {
        elements.push(this.element('P_PMarzy_3_1', '1', innerLevel));
      }
      if (annotations.p_pMarzy_3_2 === 1) {
        elements.push(this.element('P_PMarzy_3_2', '1', innerLevel));
      }
      if (annotations.p_pMarzy_3_3 === 1) {
        elements.push(this.element('P_PMarzy_3_3', '1', innerLevel));
      }
    } else {
      elements.push(this.element('P_PMarzyN', '1', innerLevel));
    }

    return this.block('PMarzy', this.joinElements(elements), level);
  }

  // ============================================================
  // AUTO-DETECTION UTILITY
  // ============================================================

  public autoDetectAnnotations(
    invoice: Fa3InvoiceForAnnotations
  ): Fa3Annotations {
    const annotations: Fa3Annotations = {
      ...(invoice.details?.annotations || {}),
    };

    const items: Fa3InvoiceItemForAnnotations[] = invoice.details?.items || [];

    // odwrotne obciążenie
    const hasReverseCharge = items.some(
      (item) => item.vatRate === 'oo' || item.vatRate === 'OO'
    );
    if (hasReverseCharge && annotations.p_18 === undefined) {
      annotations.p_18 = 1;
    }

    // split payment (załącznik 15)
    const hasSplitPayment = items.some(
      (item) => item.attachment15 === 1 || item.attachment15 === true
    );
    if (hasSplitPayment && annotations.p_18a === undefined) {
      annotations.p_18a = 1;
    }

    // zwolnienie z VAT
    const hasExemption = items.some(
      (item) => item.vatRate === 'zw' || item.vatRate === 'ZW'
    );
    if (hasExemption && annotations.p_19 === undefined) {
      annotations.p_19 = 1;
    }

    // procedura marży
    const hasMargin = items.some(
      (item) => item.vatRate === 'marza' || item.isMargin === true
    );
    if (hasMargin && annotations.p_pMarzy === undefined) {
      annotations.p_pMarzy = 1;
      if (annotations.p_pMarzy_3_1 === undefined) {
        annotations.p_pMarzy_3_1 = 1;
      }
    }

    return annotations;
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
    ctx?.error('AnnotationsBuilder', code, path, message);
  }

  protected vWarn(
    ctx: Fa3BuildContext | undefined,
    code: string,
    path: string,
    message: string
  ): void {
    ctx?.warn('AnnotationsBuilder', code, path, message);
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

  protected reqNumber(
    ctx: Fa3BuildContext | undefined,
    path: string,
    value: unknown,
    message: string
  ): value is number {
    if (typeof value === 'number' && Number.isFinite(value)) return true;
    this.vError(ctx, 'REQUIRED', path, message);
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
