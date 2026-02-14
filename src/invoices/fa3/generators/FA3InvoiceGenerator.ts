import { Fa3InvoiceBuilder } from '../builders/fa3-invoice.builder';
import { Fa3BuildContext } from '../validators/build-context';
import { InvoiceCalculator } from '../calculators/invoice.calculator';
import { debugError, debugWarn } from '../../../utils/logger';

import type { 
  Fa3Invoice, 
  Fa3InvoiceInput,
  Fa3Header,
} from '../types';

function validateNip(nip: string): boolean {
  const cleaned = nip.replace(/[\s-]/g, '');
  if (!/^\d{10}$/.test(cleaned)) return false;

  const weights = [6, 5, 7, 2, 3, 4, 5, 6, 7];
  const digits = cleaned.split('').map(Number);
  const checksum = digits[9];
  
  const sum = digits.slice(0, 9).reduce((acc, digit, i) => acc + digit * weights[i], 0);
  const calculatedChecksum = sum % 11;
  
  return calculatedChecksum === checksum;
}

function normalizeInvoice(input: Fa3InvoiceInput | Fa3Invoice): Fa3Invoice {
  const header: Fa3Header = {
    systemInfo: input.header?.systemInfo ?? 'KSeF TypeScript Library',
    creationDate: input.header?.creationDate ?? new Date(),
  };

  // Normalizuj lineNumber dla itemów
  const items = (input.details.items ?? []).map((item, idx) => ({
    ...item,
    lineNumber: item.lineNumber ?? idx + 1,
  }));

  return {
    header,
    seller: input.seller,
    buyer: input.buyer,
    thirdParties: input.thirdParties,
    authorizedEntity: input.authorizedEntity,
    details: {
      ...input.details,
      items,
    },
    vatSummary: input.vatSummary ?? {},
    summary: {
      netAmount: input.summary?.netAmount ?? 0,
      vatAmount: input.summary?.vatAmount ?? 0,
      grossAmount: input.summary?.grossAmount ?? 0,
    },
    footer: input.footer,
    attachment: input.attachment,
  };
  
}

export class FA3InvoiceGenerator {
  private fa3InvoiceBuilder: Fa3InvoiceBuilder;

  constructor() {
    this.fa3InvoiceBuilder = new Fa3InvoiceBuilder();
  }

  generate(invoice: Fa3Invoice | Fa3InvoiceInput): string {
    // 1. NORMALIZACJA - przygotowanie danych
    let normalizedInvoice = normalizeInvoice(invoice);

    // 2. KALKULACJA - obliczenie wszystkich kwot, VAT summary i sum
    normalizedInvoice = InvoiceCalculator.process(normalizedInvoice, {
      currency: normalizedInvoice.details.currency,
      roundingMode: 'item',
      decimalPlaces: 2,
    });

    // 3. WALIDACJA I BUILD - generowanie XML
    const ctx = new Fa3BuildContext(
      { mode: 'collect' },
      validateNip
    );

    const xml = this.fa3InvoiceBuilder.build(normalizedInvoice, ctx);

    // 4. RAPORTOWANIE BŁĘDÓW
    if (ctx.hasErrors()) {
      debugError('❌ FA(3) validation errors:');
      for (const issue of ctx.issues) {
        if (issue.severity === 'error') {
          debugError(`  [${issue.code}] ${issue.path}: ${issue.message}`);
        }
      }
    }

    const warnings = ctx.issues.filter(i => i.severity === 'warning');
    if (warnings.length > 0) {
      debugWarn('⚠️  FA(3) validation warnings:');
      for (const issue of warnings) {
        debugWarn(`  [${issue.code}] ${issue.path}: ${issue.message}`);
      }
    }

    return xml;
  }

  static createSampleInvoice(): Fa3Invoice {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}${mm}${dd}`;

    return {
      header: {
        systemInfo: 'KSeF TypeScript Library Test',
        creationDate: now,
      },
      seller: {
        nip: '7812070483',
        name: 'LEGALBYTE DEV SP. Z O.O.',
        address: {
          countryCode: 'PL',
          line1: 'ul. Prototypowa 10',
          line2: '00-950 Warszawa',
        },
      },
      buyer: {
        nip: '2222222222',
        name: 'KLIENT TESTOWY SP. Z O.O.',
        address: {
          countryCode: 'PL',
          line1: 'ul. Fakturkowa 7',
          line2: '30-001 Kraków',
        },
      },
      details: {
        invoiceNumber: `FV/${dateStr}/TEST/${Date.now().toString().slice(-6)}`,
        issueDate: now,
        saleDate: now,
        currency: 'PLN',
        invoiceType: 'VAT',
        items: [
          {
            lineNumber: 1,
            name: 'Usługa programistyczna - test',
            unit: 'godz',
            quantity: 10,
            netPrice: 150.0,
            vatRate: 23,
          },
        ],
        annotations: {
          p_16: 2,
          p_17: 2,
          p_18: 2,
          p_18a: 2,
        },
        payment: {
          dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
          method: 6,
        },
      },
      // vatSummary i summary zostaną obliczone przez InvoiceCalculator
      vatSummary: {},
      summary: { netAmount: 0, vatAmount: 0, grossAmount: 0 },
    };
  }
}

export default FA3InvoiceGenerator;