// src/invoices/fa3/calculators/invoice.calculator.ts
'use strict';

import type {
  Fa3Invoice,
  Fa3InvoiceItem,
  Fa3VatSummary,
  Fa3VatSummaryGroup,
  Fa3InvoiceSummary,
  Fa3OrderItem,
  Fa3Order,
} from '../types';

/**
 * Konfiguracja stawek VAT i ich mapowanie na pola KSeF
 */
const VAT_RATE_CONFIG: Record<
  string,
  {
    type:
      | 'standard'
      | 'zero'
      | 'exempt'
      | 'reverse'
      | 'margin'
      | 'oss'
      | 'outside';
    numericRate: number;
    netField: string;
    vatField: string | null;
    vatFieldPLN: string | null;
  }
> = {
  // Stawki standardowe (z VAT)
  '23': {
    type: 'standard',
    numericRate: 23,
    netField: 'P_13_1',
    vatField: 'P_14_1',
    vatFieldPLN: 'P_14_1W',
  },
  '22': {
    type: 'standard',
    numericRate: 22,
    netField: 'P_13_1',
    vatField: 'P_14_1',
    vatFieldPLN: 'P_14_1W',
  },
  '8': {
    type: 'standard',
    numericRate: 8,
    netField: 'P_13_2',
    vatField: 'P_14_2',
    vatFieldPLN: 'P_14_2W',
  },
  '7': {
    type: 'standard',
    numericRate: 7,
    netField: 'P_13_2',
    vatField: 'P_14_2',
    vatFieldPLN: 'P_14_2W',
  },
  '5': {
    type: 'standard',
    numericRate: 5,
    netField: 'P_13_3',
    vatField: 'P_14_3',
    vatFieldPLN: 'P_14_3W',
  },

  // Ryczałt dla taksówek
  '4': {
    type: 'standard',
    numericRate: 4,
    netField: 'P_13_4',
    vatField: 'P_14_4',
    vatFieldPLN: 'P_14_4W',
  },
  '3': {
    type: 'standard',
    numericRate: 3,
    netField: 'P_13_4',
    vatField: 'P_14_4',
    vatFieldPLN: 'P_14_4W',
  },

  // Stawka 0%
  '0 KR': {
    type: 'zero',
    numericRate: 0,
    netField: 'P_13_6_1',
    vatField: null,
    vatFieldPLN: null,
  },
  '0KR': {
    type: 'zero',
    numericRate: 0,
    netField: 'P_13_6_1',
    vatField: null,
    vatFieldPLN: null,
  },
  '0 WDT': {
    type: 'zero',
    numericRate: 0,
    netField: 'P_13_6_2',
    vatField: null,
    vatFieldPLN: null,
  },
  '0WDT': {
    type: 'zero',
    numericRate: 0,
    netField: 'P_13_6_2',
    vatField: null,
    vatFieldPLN: null,
  },
  '0 EX': {
    type: 'zero',
    numericRate: 0,
    netField: 'P_13_6_3',
    vatField: null,
    vatFieldPLN: null,
  },
  '0EX': {
    type: 'zero',
    numericRate: 0,
    netField: 'P_13_6_3',
    vatField: null,
    vatFieldPLN: null,
  },

  // Zwolnione
  zw: {
    type: 'exempt',
    numericRate: 0,
    netField: 'P_13_7',
    vatField: null,
    vatFieldPLN: null,
  },
  ZW: {
    type: 'exempt',
    numericRate: 0,
    netField: 'P_13_7',
    vatField: null,
    vatFieldPLN: null,
  },

  // Niepodlegające opodatkowaniu
  'np I': {
    type: 'outside',
    numericRate: 0,
    netField: 'P_13_8',
    vatField: null,
    vatFieldPLN: null,
  },
  NP_I: {
    type: 'outside',
    numericRate: 0,
    netField: 'P_13_8',
    vatField: null,
    vatFieldPLN: null,
  },
  'np II': {
    type: 'outside',
    numericRate: 0,
    netField: 'P_13_9',
    vatField: null,
    vatFieldPLN: null,
  },
  NP_II: {
    type: 'outside',
    numericRate: 0,
    netField: 'P_13_9',
    vatField: null,
    vatFieldPLN: null,
  },

  // Odwrotne obciążenie
  oo: {
    type: 'reverse',
    numericRate: 0,
    netField: 'P_13_10',
    vatField: null,
    vatFieldPLN: null,
  },
  OO: {
    type: 'reverse',
    numericRate: 0,
    netField: 'P_13_10',
    vatField: null,
    vatFieldPLN: null,
  },

  // Procedura marży
  marza: {
    type: 'margin',
    numericRate: 0,
    netField: 'P_13_11',
    vatField: null,
    vatFieldPLN: null,
  },
  MARZA: {
    type: 'margin',
    numericRate: 0,
    netField: 'P_13_11',
    vatField: null,
    vatFieldPLN: null,
  },
  margin: {
    type: 'margin',
    numericRate: 0,
    netField: 'P_13_11',
    vatField: null,
    vatFieldPLN: null,
  },
};

/**
 * Wewnętrzny typ dla akumulacji grup VAT (wszystkie pola wymagane)
 */
interface VatGroupAccumulator {
  vatRate: string | number;
  netAmount: number;
  vatAmount: number;
  grossAmount: number;
  vatAmountPLN: number;
  isMargin: boolean;
  isOSS: boolean;
}

/**
 * Wynik kalkulacji całej faktury
 */
export interface InvoiceCalculationResult {
  items: Fa3InvoiceItem[];
  vatSummary: Fa3VatSummary;
  summary: Fa3InvoiceSummary;
  order?: Fa3Order;
}

/**
 * Opcje kalkulatora
 */
export interface CalculatorOptions {
  /** Waluta faktury (domyślnie PLN) */
  currency?: string;
  /** Domyślny kurs wymiany dla całej faktury */
  defaultExchangeRate?: number;
  /** Tryb zaokrąglania: 'item' (każdy item osobno) lub 'total' (suma na końcu) */
  roundingMode?: 'item' | 'total';
  /** Liczba miejsc po przecinku dla kwot (domyślnie 2) */
  decimalPlaces?: number;
}

/**
 * Kompleksowy kalkulator faktur KSeF
 *
 * Obsługuje:
 * - Wszystkie stawki VAT (23%, 22%, 8%, 7%, 5%, 4%, 3%)
 * - Stawki zerowe (0 KR, 0 WDT, 0 EX)
 * - Zwolnienia (zw)
 * - Odwrotne obciążenie (oo)
 * - Niepodlegające (np I, np II)
 * - Procedura marży
 * - OSS (procedura szczególna)
 * - Waluty obce z przeliczeniem VAT na PLN
 * - Faktury korygujące (StanPrzed)
 * - Faktury zaliczkowe (ZAL) z zamówieniami
 */
export class InvoiceCalculator {
  private readonly options: Required<CalculatorOptions>;

  constructor(options: CalculatorOptions = {}) {
    this.options = {
      currency: options.currency ?? 'PLN',
      defaultExchangeRate: options.defaultExchangeRate ?? 1,
      roundingMode: options.roundingMode ?? 'item',
      decimalPlaces: options.decimalPlaces ?? 2,
    };
  }

  /**
   * Główna metoda - kalkuluje całą fakturę
   */
  calculate(invoice: Fa3Invoice): InvoiceCalculationResult {
    const currency = invoice.details?.currency ?? this.options.currency;
    const isForeignCurrency = currency !== 'PLN';

    // 1. Oblicz wszystkie itemy
    const calculatedItems = this.calculateItems(
      invoice.details?.items ?? [],
      isForeignCurrency
    );

    // 2. Zbuduj vatSummary (grupowanie po stawkach)
    const isCorrection = this.isCorrection(invoice.details?.invoiceType);
    const vatSummary = this.buildVatSummary(calculatedItems, isForeignCurrency, isCorrection);

    // 3. Oblicz sumy
    const summary = this.calculateSummary(calculatedItems, invoice);

    // 4. Obsłuż zamówienie (dla faktur zaliczkowych)
    let order: Fa3Order | undefined;
    if (invoice.details?.order) {
      order = this.calculateOrder(invoice.details.order, isForeignCurrency);
    }

    return {
      items: calculatedItems,
      vatSummary,
      summary,
      ...(order ? { order } : {}),
    };
  }

  /**
   * Kalkuluje listę itemów
   */
  private calculateItems(
    items: Fa3InvoiceItem[],
    isForeignCurrency: boolean
  ): Fa3InvoiceItem[] {
    return items.map((item) => {
      // Pomiń kalkulację dla pozycji "przed korektą" - te mają już wartości
      if (item.beforeCorrection === 1) {
        return this.ensureItemHasAllFields(item);
      }

      return this.calculateSingleItem(item, isForeignCurrency);
    });
  }

  /**
   * Kalkuluje pojedynczy item
   */
  private calculateSingleItem(
    item: Fa3InvoiceItem,
    isForeignCurrency: boolean
  ): Fa3InvoiceItem {
    const quantity = this.toNumber(item.quantity, 1);
    const netPrice = this.toNumber(item.netPrice, 0);
    const grossPrice = this.toNumber(item.grossPrice, null);
    const discount = this.toNumber(item.discount, 0);

    const vatRate = this.normalizeVatRate(item.vatRate);
    const rateConfig = VAT_RATE_CONFIG[vatRate];
    const numericRate =
      rateConfig?.numericRate ?? this.parseNumericRate(vatRate);

    const exchangeRate =
      this.toNumber(item.exchangeRate, null) ??
      this.options.defaultExchangeRate;

    let netAmount: number;
    let vatAmount: number;
    let grossAmount: number;
    let vatAmountPLN: number | null = null;

    // Sprawdź czy to procedura marży (tylko grossAmount)
    if (item.isMargin || rateConfig?.type === 'margin') {
      grossAmount = this.toNumber(item.grossAmount, 0);
      netAmount = grossAmount; // W marży netto = brutto (VAT jest w marży)
      vatAmount = 0;
    }
    // Sprawdź czy podano cenę brutto (art. 106e ust. 7 i 8)
    else if (grossPrice !== null && netPrice === 0) {
      grossAmount = this.round(quantity * grossPrice - discount);
      vatAmount = this.calculateVatFromGross(grossAmount, numericRate);
      netAmount = this.round(grossAmount - vatAmount);
    }
    // Standardowa kalkulacja od netto
    else {
      netAmount =
        item.netAmount !== undefined && item.netAmount !== null
          ? this.round(item.netAmount)
          : this.round(quantity * netPrice - discount);

      vatAmount = this.calculateVat(netAmount, numericRate);
      grossAmount = this.round(netAmount + vatAmount);
    }

    // Przelicz VAT na PLN dla walut obcych
    if (
      isForeignCurrency &&
      vatAmount > 0 &&
      exchangeRate &&
      exchangeRate !== 1
    ) {
      vatAmountPLN = this.round(vatAmount * exchangeRate);
    }

    // Czy item wymaga breakdown (P_11A, P_11Vat) w XML?
    const needsBreakdown =
      item.isMargin ||
      item.vatRateOSS !== undefined ||
      grossPrice !== null ||
      rateConfig?.type === 'margin' ||
      rateConfig?.type === 'oss';

    // Buduj wynik bazowy (zawsze)
    const result: Fa3InvoiceItem = {
      ...item,
      quantity,
      netAmount,
      vatRate,
    };

    // Dodaj opcjonalne pola tylko gdy są zdefiniowane
    if (netPrice > 0) {
      result.netPrice = netPrice;
    }

    if (discount > 0) {
      result.discount = discount;
    }

    if (grossPrice !== null) {
      result.grossPrice = grossPrice;
    }

    // Zawsze przechowuj vatAmount i grossAmount — potrzebne do
    // vatSummary (P_13_x / P_14_x) i summary (P_15)
    result.vatAmount = vatAmount;
    result.grossAmount = grossAmount;

    // Flaga wewnętrzna: czy emitować P_11A/P_11Vat w XML
    (result as any)._emitBreakdown = needsBreakdown;

    // Waluta obca - dodaj kurs
    if (isForeignCurrency && exchangeRate !== 1) {
      result.exchangeRate = exchangeRate;
    }

    // VAT w PLN dla walut obcych
    if (vatAmountPLN !== null) {
      result.vatAmountPLN = vatAmountPLN;
    }

    return result;
  }

  /**
   * Buduje vatSummary - grupowanie po stawkach VAT
   */
  private buildVatSummary(
    items: Fa3InvoiceItem[],
    isForeignCurrency: boolean,
    isCorrection: boolean = false
  ): Fa3VatSummary {
    // Używamy wewnętrznego typu z wymaganymi polami numerycznymi
    const groups: Record<string, VatGroupAccumulator> = {};

    // Pomocnicza: dodaje item do grupy (z opcjonalnym znakiem -1 dla "before")
    const addToGroup = (item: Fa3InvoiceItem, sign: 1 | -1) => {
      const vatRate = this.normalizeVatRate(item.vatRate);
      const rateConfig = VAT_RATE_CONFIG[vatRate];
      const groupKey = rateConfig?.netField ?? `custom_${vatRate}`;

      if (!groups[groupKey]) {
        groups[groupKey] = {
          vatRate,
          netAmount: 0,
          vatAmount: 0,
          grossAmount: 0,
          vatAmountPLN: 0,
          isMargin: rateConfig?.type === 'margin',
          isOSS: rateConfig?.type === 'oss' || !!item.vatRateOSS,
        };
      }

      groups[groupKey].netAmount += sign * (item.netAmount ?? 0);
      groups[groupKey].vatAmount += sign * (item.vatAmount ?? 0);
      groups[groupKey].grossAmount += sign * (item.grossAmount ?? 0);

      if (isForeignCurrency && item.vatAmountPLN) {
        groups[groupKey].vatAmountPLN += sign * item.vatAmountPLN;
      }

      if (item.vatRateOSS) {
        groups[groupKey].isOSS = true;
      }
    };

    for (const item of items) {
      if (item.beforeCorrection === 1) {
        // Dla korekt: pozycje "przed" odejmij od sumy
        if (isCorrection) {
          addToGroup(item, -1);
        }
        // Dla zwykłych faktur: pomiń (nie powinny tu być, ale na wszelki wypadek)
      } else {
        addToGroup(item, 1);
      }
    }

    // Konwertuj na Fa3VatSummary z zaokrągleniem
    const vatSummary: Fa3VatSummary = {};

    for (const [key, group] of Object.entries(groups)) {
      const summaryGroup: Fa3VatSummaryGroup = {
        vatRate: group.vatRate,
        netAmount: this.round(group.netAmount),
        vatAmount: this.round(group.vatAmount),
      };

      // Dodaj grossAmount (może być ujemny w korektach)
      if (group.grossAmount !== 0) {
        summaryGroup.grossAmount = this.round(group.grossAmount);
      }

      if (isForeignCurrency && group.vatAmountPLN !== 0) {
        summaryGroup.vatAmountPLN = this.round(group.vatAmountPLN);
      }

      if (group.isMargin) {
        summaryGroup.isMargin = true;
      }

      if (group.isOSS) {
        summaryGroup.isOSS = true;
      }

      vatSummary[key] = summaryGroup;
    }

    return vatSummary;
  }

  /**
   * Oblicza sumy faktury
   */
  private calculateSummary(
    items: Fa3InvoiceItem[],
    invoice: Fa3Invoice
  ): Fa3InvoiceSummary {
    // Filtruj pozycje "przed korektą" - nie wchodzą do sum
    const activeItems = items.filter((item) => item.beforeCorrection !== 1);

    let totalNet = 0;
    let totalVat = 0;
    let totalGross = 0;

    for (const item of activeItems) {
      totalNet += item.netAmount ?? 0;
      totalVat += item.vatAmount ?? 0;
      totalGross += item.grossAmount ?? 0;
    }

    // Dla faktur korygujących - uwzględnij pozycje "przed korektą" jako ujemne
    if (this.isCorrection(invoice.details?.invoiceType)) {
      const beforeItems = items.filter((item) => item.beforeCorrection === 1);

      for (const item of beforeItems) {
        totalNet -= item.netAmount ?? 0;
        totalVat -= item.vatAmount ?? 0;
        totalGross -= item.grossAmount ?? 0;
      }
    }

    return {
      netAmount: this.round(totalNet),
      vatAmount: this.round(totalVat),
      grossAmount: this.round(totalGross),
    };
  }

  /**
   * Kalkuluje zamówienie (dla faktur zaliczkowych)
   */
  private calculateOrder(
    order: Fa3Order,
    _isForeignCurrency: boolean
  ): Fa3Order {
    if (!order.items || order.items.length === 0) {
      return order;
    }

    const calculatedItems: Fa3OrderItem[] = order.items.map((item) => {
      const quantity = this.toNumber(item.quantity, 1);
      const netPrice = this.toNumber(item.netPrice, 0);

      const vatRate = this.normalizeVatRate(item.vatRate);
      const rateConfig = VAT_RATE_CONFIG[vatRate];
      const numericRate =
        rateConfig?.numericRate ?? this.parseNumericRate(vatRate);

      const netAmount =
        item.netAmount !== undefined && item.netAmount !== null
          ? this.round(item.netAmount)
          : this.round(quantity * netPrice);

      const vatAmount =
        item.vatAmount !== undefined && item.vatAmount !== null
          ? this.round(item.vatAmount)
          : this.calculateVat(netAmount, numericRate);

      return {
        ...item,
        quantity,
        netPrice: netPrice || undefined,
        netAmount,
        vatAmount,
        vatRate,
      };
    });

    // Oblicz wartość zamówienia (brutto) jeśli nie podano
    const totalValue =
      order.totalValue !== undefined && order.totalValue !== null
        ? order.totalValue
        : calculatedItems.reduce(
            (sum, item) => sum + (item.netAmount ?? 0) + (item.vatAmount ?? 0),
            0
          );

    return {
      ...order,
      totalValue: this.round(totalValue),
      items: calculatedItems,
    };
  }

  /**
   * Oblicza VAT od kwoty netto
   */
  private calculateVat(netAmount: number, rate: number): number {
    if (rate <= 0) return 0;
    return this.round(netAmount * (rate / 100));
  }

  /**
   * Oblicza VAT od kwoty brutto (metoda "w stu")
   */
  private calculateVatFromGross(grossAmount: number, rate: number): number {
    if (rate <= 0) return 0;
    return this.round((grossAmount * rate) / (100 + rate));
  }

  /**
   * Normalizuje stawkę VAT do formatu używanego w konfiguracji
   */
  private normalizeVatRate(vatRate: string | number | undefined): string {
    if (vatRate === undefined || vatRate === null) return '23';

    const str = String(vatRate).trim();

    // Zamień popularne warianty
    const normalized = str
      .replace(/^0\s*KR$/i, '0 KR')
      .replace(/^0\s*WDT$/i, '0 WDT')
      .replace(/^0\s*EX$/i, '0 EX')
      .replace(/^np\s*I$/i, 'np I')
      .replace(/^np\s*II$/i, 'np II');

    return normalized;
  }

  /**
   * Parsuje stawkę numeryczną z tekstu
   */
  private parseNumericRate(vatRate: string): number {
    const num = parseFloat(vatRate);
    return isNaN(num) ? 0 : num;
  }

  /**
   * Sprawdza czy faktura jest korektą
   */
  private isCorrection(invoiceType?: string): boolean {
    return !!invoiceType && ['KOR', 'KOR_ZAL', 'KOR_ROZ'].includes(invoiceType);
  }

  /**
   * Upewnia się że item ma wszystkie pola (dla beforeCorrection)
   */
  private ensureItemHasAllFields(item: Fa3InvoiceItem): Fa3InvoiceItem {
    const netAmount = item.netAmount ?? 0;
    const vatRate = this.normalizeVatRate(item.vatRate);
    const numericRate =
      VAT_RATE_CONFIG[vatRate]?.numericRate ?? this.parseNumericRate(vatRate);
    const vatAmount =
      item.vatAmount ?? this.calculateVat(netAmount, numericRate);
    const grossAmount = item.grossAmount ?? this.round(netAmount + vatAmount);

    return {
      ...item,
      netAmount,
      vatAmount,
      grossAmount,
      vatRate,
    };
  }

  /**
   * Konwertuje wartość na number
   */
  private toNumber(value: unknown, defaultValue: number): number;
  private toNumber(value: unknown, defaultValue: null): number | null;
  private toNumber(value: unknown, defaultValue: number | null): number | null {
    if (value === undefined || value === null) return defaultValue;
    const num = Number(value);
    return isNaN(num) ? defaultValue : num;
  }

  /**
   * Zaokrągla do określonej liczby miejsc po przecinku
   */
  private round(value: number): number {
    const factor = Math.pow(10, this.options.decimalPlaces);
    return Math.round(value * factor) / factor;
  }

  /**
   * Statyczna metoda pomocnicza - szybka kalkulacja
   */
  static calculate(
    invoice: Fa3Invoice,
    options?: CalculatorOptions
  ): InvoiceCalculationResult {
    const calculator = new InvoiceCalculator(options);
    return calculator.calculate(invoice);
  }

  /**
   * Statyczna metoda - kalkuluj i zwróć zaktualizowaną fakturę
   */
  static process(invoice: Fa3Invoice, options?: CalculatorOptions): Fa3Invoice {
    const calculator = new InvoiceCalculator({
      currency: invoice.details?.currency,
      ...options,
    });

    const result = calculator.calculate(invoice);

    return {
      ...invoice,
      vatSummary: result.vatSummary,
      summary: result.summary,
      details: {
        ...invoice.details!,
        items: result.items,
        ...(result.order ? { order: result.order } : {}),
      },
    };
  }
}

/**
 * Eksport funkcji pomocniczych dla prostszego użycia
 */
export function calculateInvoice(
  invoice: Fa3Invoice,
  options?: CalculatorOptions
): InvoiceCalculationResult {
  return InvoiceCalculator.calculate(invoice, options);
}

export function processInvoice(
  invoice: Fa3Invoice,
  options?: CalculatorOptions
): Fa3Invoice {
  return InvoiceCalculator.process(invoice, options);
}
