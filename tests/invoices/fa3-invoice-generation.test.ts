import { FA3InvoiceGenerator } from '../../src/invoices/fa3/generators/FA3InvoiceGenerator';
import { InvoiceCalculator } from '../../src/invoices/fa3/calculators/invoice.calculator';
import type { Fa3InvoiceInput } from '../../src/invoices/fa3/types';

/**
 * Test oparty na FA_3_Przykład_1.xml — weryfikuje poprawność generowania XML.
 */

function buildExampleInput(): Fa3InvoiceInput {
  return {
    header: {
      systemInfo: 'SamploFaktur',
      creationDate: new Date('2026-02-01T00:00:00Z'),
    },
    seller: {
      nip: '9999999999',
      name: 'ABC AGD sp. z o. o.',
      address: {
        countryCode: 'PL',
        line1: 'ul. Kwiatowa 1 m. 2',
        line2: '00-001 Warszawa',
      },
      email: 'abc@abc.pl',
      phone: '667444555',
    },
    buyer: {
      nip: '1111111111',
      name: 'F.H.U. Jan Kowalski',
      address: {
        countryCode: 'PL',
        line1: 'ul. Polna 1',
        line2: '00-001 Warszawa',
      },
      email: 'jan@kowalski.pl',
      phone: '555777999',
      customerNumber: 'fdfd778343',
    },
    details: {
      currency: 'PLN',
      issueDate: '2026-02-15',
      issuePlace: 'Warszawa',
      invoiceNumber: 'FV2026/02/150',
      saleDate: '2026-01-27',
      invoiceType: 'VAT',
      fp: true,
      additionalInfo: [
        {
          key: 'preferowane godziny dowozu',
          value: 'dni robocze 17:00 - 20:00',
        },
      ],
      annotations: {
        p_16: 2,
        p_17: 2,
        p_18: 2,
        p_18a: 2,
      },
      items: [
        {
          uuid: 'aaaa111133339990',
          name: 'lodówka Zimnotech mk1',
          unit: 'szt.',
          quantity: 1,
          netPrice: 1626.01,
          vatRate: '23',
        },
        {
          uuid: 'aaaa111133339991',
          name: 'wniesienie sprzętu',
          unit: 'szt.',
          quantity: 1,
          netPrice: 40.65,
          vatRate: '23',
        },
        {
          uuid: 'aaaa111133339992',
          name: 'promocja lodówka pełna mleka',
          unit: 'szt.',
          quantity: 1,
          netPrice: 0.95,
          vatRate: '5',
        },
      ],
      payment: {
        method: 6,
        paid: true,
        paymentDate: '2026-01-27',
      },
    },
    footer: {
      info: [{ text: 'Kapiał zakładowy 5 000 000' }],
      registries: [
        {
          krs: '0000099999',
          regon: '999999999',
          bdo: '000099999',
        },
      ],
    },
  };
}

/** Wersja z flat address (addressLine1/addressLine2) zamiast address object */
function buildExampleInputFlatAddress(): any {
  return {
    header: {
      systemInfo: 'SamploFaktur',
      creationDate: new Date('2026-02-01T00:00:00Z'),
    },
    seller: {
      nip: '9999999999',
      name: 'ABC AGD sp. z o. o.',
      addressLine1: 'ul. Kwiatowa 1 m. 2',
      addressLine2: '00-001 Warszawa',
      countryCode: 'PL',
      email: 'abc@abc.pl',
      phone: '667444555',
    },
    buyer: {
      nip: '1111111111',
      name: 'F.H.U. Jan Kowalski',
      addressLine1: 'ul. Polna 1',
      addressLine2: '00-001 Warszawa',
      countryCode: 'PL',
      email: 'jan@kowalski.pl',
      phone: '555777999',
      customerNumber: 'fdfd778343',
    },
    details: {
      currency: 'PLN',
      issueDate: '2026-02-15',
      invoiceNumber: 'FV2026/02/150',
      saleDate: '2026-01-27',
      invoiceType: 'VAT',
      annotations: { p_16: 2, p_17: 2, p_18: 2, p_18a: 2 },
      items: [
        { name: 'Test', unit: 'szt.', quantity: 1, netPrice: 100, vatRate: '23' },
      ],
      payment: { method: 6 },
    },
  };
}

/** Wersja z user-provided totals (P_15 = 2051) */
function buildExampleInputWithTotals(): Fa3InvoiceInput {
  const input = buildExampleInput();
  return {
    ...input,
    vatSummary: {
      P_13_1: { vatRate: '23', netAmount: 1666.66, vatAmount: 383.33 },
      P_13_3: { vatRate: '5', netAmount: 0.95, vatAmount: 0.05 },
    },
    summary: {
      netAmount: 1667.61,
      vatAmount: 383.38,
      grossAmount: 2051,
    },
  };
}

describe('FA3InvoiceGenerator — FA_3_Przykład_1', () => {
  let xml: string;

  beforeAll(() => {
    const generator = new FA3InvoiceGenerator();
    xml = generator.generate(buildExampleInput());
  });

  // ─── Adresy ───

  it('should generate Adres in Podmiot1 (seller)', () => {
    expect(xml).toContain('<KodKraju>PL</KodKraju>');
    expect(xml).toContain('<AdresL1>ul. Kwiatowa 1 m. 2</AdresL1>');
    expect(xml).toContain('<AdresL2>00-001 Warszawa</AdresL2>');
  });

  it('should generate Adres in Podmiot2 (buyer)', () => {
    expect(xml).toContain('<AdresL1>ul. Polna 1</AdresL1>');
  });

  // ─── VAT calculation ───

  it('should calculate P_13_1 (net 23%) = 1666.66', () => {
    expect(xml).toContain('<P_13_1>1666.66</P_13_1>');
  });

  it('should calculate P_14_1 (vat 23%) = 383.33', () => {
    expect(xml).toContain('<P_14_1>383.33</P_14_1>');
  });

  it('should calculate P_13_3 (net 5%) = 0.95', () => {
    expect(xml).toContain('<P_13_3>0.95</P_13_3>');
  });

  it('should calculate P_14_3 (vat 5%) = 0.05', () => {
    expect(xml).toContain('<P_14_3>0.05</P_14_3>');
  });

  it('should calculate P_15 (total gross) = 2050.99 (auto-calc)', () => {
    // Auto-calculated: 1666.66 + 383.33 + 0.95 + 0.05 = 2050.99
    expect(xml).toContain('<P_15>2050.99</P_15>');
  });

  // ─── Platnosc ───

  it('should generate Zaplacono when paid=true', () => {
    expect(xml).toContain('<Zaplacono>1</Zaplacono>');
  });

  it('should generate DataZaplaty when paid=true', () => {
    expect(xml).toContain('<DataZaplaty>2026-01-27</DataZaplaty>');
  });

  it('should NOT generate TerminPlatnosci when paid=true', () => {
    expect(xml).not.toContain('<TerminPlatnosci>');
    expect(xml).not.toContain('<Termin>');
  });

  it('should generate FormaPlatnosci', () => {
    expect(xml).toContain('<FormaPlatnosci>6</FormaPlatnosci>');
  });

  // ─── UU_ID ───

  it('should include UU_ID in line items when provided', () => {
    expect(xml).toContain('<UU_ID>aaaa111133339990</UU_ID>');
    expect(xml).toContain('<UU_ID>aaaa111133339991</UU_ID>');
    expect(xml).toContain('<UU_ID>aaaa111133339992</UU_ID>');
  });

  // ─── FP i DodatkowyOpis ───

  it('should generate FP element', () => {
    expect(xml).toContain('<FP>1</FP>');
  });

  it('should generate DodatkowyOpis', () => {
    expect(xml).toContain('<DodatkowyOpis>');
    expect(xml).toContain('<Klucz>preferowane godziny dowozu</Klucz>');
    expect(xml).toContain('<Wartosc>dni robocze 17:00 - 20:00</Wartosc>');
  });

  // ─── DaneKontaktowe i NrKlienta ───

  it('should generate seller DaneKontaktowe', () => {
    expect(xml).toContain('<Email>abc@abc.pl</Email>');
    expect(xml).toContain('<Telefon>667444555</Telefon>');
  });

  it('should generate buyer DaneKontaktowe', () => {
    expect(xml).toContain('<Email>jan@kowalski.pl</Email>');
    expect(xml).toContain('<Telefon>555777999</Telefon>');
  });

  it('should generate NrKlienta for buyer', () => {
    expect(xml).toContain('<NrKlienta>fdfd778343</NrKlienta>');
  });

  // ─── Stopka ───

  it('should generate Stopka with registries', () => {
    expect(xml).toContain('<Stopka>');
    expect(xml).toContain('<KRS>0000099999</KRS>');
    expect(xml).toContain('<REGON>999999999</REGON>');
    expect(xml).toContain('<BDO>000099999</BDO>');
  });

  it('should generate Stopka with info', () => {
    expect(xml).toMatch(/Kapia.*zakładowy 5 000 000/);
  });

  // ─── P_11A/P_11Vat nie powinny się pojawiać dla standardowych pozycji ───

  it('should NOT generate P_11A for standard items', () => {
    expect(xml).not.toContain('<P_11A>');
  });

  it('should NOT generate P_11Vat for standard items', () => {
    expect(xml).not.toContain('<P_11Vat>');
  });
});

describe('Flat address normalization (addressLine1/addressLine2)', () => {
  it('should generate Adres from flat addressLine1/addressLine2 fields', () => {
    const generator = new FA3InvoiceGenerator();
    const xml = generator.generate(buildExampleInputFlatAddress());
    expect(xml).toContain('<AdresL1>ul. Kwiatowa 1 m. 2</AdresL1>');
    expect(xml).toContain('<AdresL2>00-001 Warszawa</AdresL2>');
    expect(xml).toContain('<AdresL1>ul. Polna 1</AdresL1>');
  });
});

describe('User-provided totals override calculator', () => {
  it('should use P_15 = 2051 from user summary (no trailing zeros)', () => {
    const generator = new FA3InvoiceGenerator();
    const xml = generator.generate(buildExampleInputWithTotals());
    expect(xml).toContain('<P_15>2051</P_15>');
  });

  it('should use P_14_1 = 383.33 from user vatSummary', () => {
    const generator = new FA3InvoiceGenerator();
    const xml = generator.generate(buildExampleInputWithTotals());
    expect(xml).toContain('<P_14_1>383.33</P_14_1>');
  });
});

describe('Payment paid normalization (paid: 1)', () => {
  it('should accept paid=1 (number) and generate Zaplacono', () => {
    const generator = new FA3InvoiceGenerator();
    const input: any = buildExampleInput();
    input.details.payment = {
      method: 6,
      paid: 1, // number instead of boolean
      paymentDate: '2026-01-27',
    };
    const xml = generator.generate(input);
    expect(xml).toContain('<Zaplacono>1</Zaplacono>');
    expect(xml).toContain('<DataZaplaty>2026-01-27</DataZaplaty>');
  });
});

describe('InvoiceCalculator — vatAmount/grossAmount for standard rates', () => {
  const makeInvoice = (items: any[]) => ({
    header: { systemInfo: 'Test', creationDate: new Date() },
    seller: { nip: '1234567890', name: 'Test', address: 'Test, Test' },
    buyer: { name: 'Buyer', address: 'Buyer, Buyer' },
    details: {
      invoiceNumber: 'FV/1',
      issueDate: '2026-01-01',
      currency: 'PLN',
      invoiceType: 'VAT' as const,
      items,
      annotations: { p_16: 2 as const, p_17: 2 as const, p_18: 2 as const, p_18a: 2 as const },
    },
    vatSummary: {},
    summary: { netAmount: 0, vatAmount: 0, grossAmount: 0 },
  });

  it('should always compute vatAmount and grossAmount on items', () => {
    const result = InvoiceCalculator.calculate(
      makeInvoice([{ lineNumber: 1, name: 'Item', quantity: 1, netPrice: 100, vatRate: '23' }])
    );

    expect(result.items[0].vatAmount).toBe(23);
    expect(result.items[0].grossAmount).toBe(123);
    expect(result.vatSummary['P_13_1']?.netAmount).toBe(100);
    expect(result.vatSummary['P_13_1']?.vatAmount).toBe(23);
    expect(result.summary.grossAmount).toBe(123);
  });

  it('should compute vatAmount for 5% rate', () => {
    const result = InvoiceCalculator.calculate(
      makeInvoice([{ lineNumber: 1, name: 'Item', quantity: 1, netPrice: 200, vatRate: '5' }])
    );

    expect(result.items[0].vatAmount).toBe(10);
    expect(result.items[0].grossAmount).toBe(210);
    expect(result.vatSummary['P_13_3']?.vatAmount).toBe(10);
    expect(result.summary.grossAmount).toBe(210);
  });
});

describe('PaymentBuilder — paid vs dueDate edge cases', () => {
  it('should not generate TerminPlatnosci when paid and dueDate both present', () => {
    const generator = new FA3InvoiceGenerator();
    const input = buildExampleInput();
    input.details.payment = {
      method: 6,
      paid: true,
      paymentDate: '2026-01-27',
      dueDate: '2026-02-28',
    };
    const result = generator.generate(input);
    expect(result).toContain('<Zaplacono>1</Zaplacono>');
    expect(result).not.toContain('<TerminPlatnosci>');
  });

  it('should generate TerminPlatnosci when NOT paid', () => {
    const generator = new FA3InvoiceGenerator();
    const input = buildExampleInput();
    input.details.payment = {
      method: 6,
      dueDate: '2026-02-28',
    };
    const result = generator.generate(input);
    expect(result).not.toContain('<Zaplacono>');
    expect(result).toContain('<Termin>2026-02-28</Termin>');
  });
});

// ════════════════════════════════════════════════════════════════
// FA_3_Przykład_2 — Faktura korygująca (KOR)
// ════════════════════════════════════════════════════════════════

function buildCorrectionInput(): any {
  return {
    header: {
      systemInfo: 'SamploFaktur',
      creationDate: new Date('2026-02-01T00:00:00Z'),
    },
    seller: {
      nip: '9999999999',
      name: 'ABC AGD sp. z o. o.',
      address: { countryCode: 'PL', line1: 'ul. Kwiatowa 1 m. 2', line2: '00-001 Warszawa' },
      email: 'abc@abc.pl',
      phone: '667444555',
    },
    buyer: {
      nip: '1111111111',
      name: 'F.H.U. Jan Kowalski',
      address: { countryCode: 'PL', line1: 'ul. Polna 1', line2: '00-001 Warszawa' },
      email: 'jan@kowalski.pl',
      phone: '555777999',
      customerNumber: 'fdfd778343',
    },
    details: {
      currency: 'PLN',
      issueDate: '2026-02-15',
      issuePlace: 'Warszawa',
      invoiceNumber: 'FVKOR2026/02/150',
      saleDate: '2026-01-27',
      invoiceType: 'KOR',
      annotations: { p_16: 2, p_17: 2, p_18: 2, p_18a: 2 },
      correctionReason: 'obniżka ceny o 200 zł z uwagi na uszkodzenia estetyczne',
      correctionType: 3,
      correctedInvoices: [
        { issueDate: '2026-02-15', number: 'FV2026/02/150' },
      ],
      items: [
        // Stan PRZED korektą
        {
          lineNumber: 1,
          uuId: 'aaaa111133339990',
          name: 'lodówka Zimnotech mk1',
          unit: 'szt.',
          quantity: 1,
          netPrice: 1626.01,
          netAmount: 1626.01,
          vatRate: '23',
          beforeCorrection: 1,
        },
        // Stan PO korekcie
        {
          lineNumber: 1,
          uuId: 'aaaa111133339990',
          name: 'lodówka Zimnotech mk1',
          unit: 'szt.',
          quantity: 1,
          netPrice: 1463.41,
          netAmount: 1463.41,
          vatRate: '23',
        },
      ],
      payment: {
        method: 6,
        paid: 1,
        paymentDate: '2026-02-20',
      },
    },
    footer: {
      info: [{ text: 'Kapiał zakładowy 5 000 000' }],
      registries: [{ krs: '0000099999', regon: '999999999', bdo: '000099999' }],
    },
  };
}

describe('FA3InvoiceGenerator — correction invoice (KOR)', () => {
  let xml: string;

  beforeAll(() => {
    const generator = new FA3InvoiceGenerator();
    xml = generator.generate(buildCorrectionInput());
  });

  // ─── Błąd 1: P_13_1 / P_14_1 — delta, nie wartość PO ───

  it('should calculate P_13_1 as delta (after - before) = -162.60', () => {
    expect(xml).toContain('<P_13_1>-162.60</P_13_1>');
  });

  it('should calculate P_14_1 as delta VAT = -37.40', () => {
    expect(xml).toContain('<P_14_1>-37.40</P_14_1>');
  });

  it('should calculate P_15 as delta gross = -200 (no trailing zeros)', () => {
    expect(xml).toContain('<P_15>-200</P_15>');
  });

  // ─── Błąd 2: NrWierszaFa — oba wiersze mają ten sam lineNumber ───

  it('should use lineNumber from item, both rows have NrWierszaFa=1', () => {
    const matches = xml.match(/<NrWierszaFa>1<\/NrWierszaFa>/g);
    expect(matches).toHaveLength(2);
  });

  it('should NOT auto-increment lineNumber to 2', () => {
    expect(xml).not.toContain('<NrWierszaFa>2</NrWierszaFa>');
  });

  // ─── Błąd 3: UU_ID — uuId z JSON mapped to uuid ───

  it('should include UU_ID in both correction rows', () => {
    const matches = xml.match(/<UU_ID>aaaa111133339990<\/UU_ID>/g);
    expect(matches).toHaveLength(2);
  });

  // ─── Błąd 4: PrzyczynaKorekty — inline, no whitespace ───

  it('should render PrzyczynaKorekty inline without extra whitespace', () => {
    // Check that the tag and text are on the same line
    const match = xml.match(/<PrzyczynaKorekty>([^<]+)<\/PrzyczynaKorekty>/);
    expect(match).toBeTruthy();
    expect(match![1]).toBe('obniżka ceny o 200 zł z uwagi na uszkodzenia estetyczne');
  });

  // ─── StanPrzed flag ───

  it('should have StanPrzed=1 on the "before" row', () => {
    expect(xml).toContain('<StanPrzed>1</StanPrzed>');
  });

  // ─── RodzajFaktury ───

  it('should have RodzajFaktury=KOR', () => {
    expect(xml).toContain('<RodzajFaktury>KOR</RodzajFaktury>');
  });

  // ─── TypKorekty ───

  it('should have TypKorekty=3', () => {
    expect(xml).toContain('<TypKorekty>3</TypKorekty>');
  });

  // ─── DaneFaKorygowanej ───

  it('should include DaneFaKorygowanej', () => {
    expect(xml).toContain('<DaneFaKorygowanej>');
    expect(xml).toContain('<NrFaKorygowanej>FV2026/02/150</NrFaKorygowanej>');
  });

  // ─── P_11A / P_11Vat should NOT appear for standard correction items ───

  it('should NOT generate P_11A for correction items', () => {
    expect(xml).not.toContain('<P_11A>');
  });

  it('should NOT generate P_11Vat for correction items', () => {
    expect(xml).not.toContain('<P_11Vat>');
  });
});

// ════════════════════════════════════════════════════════════════
// FA_3_Przykład_4 — Faktura z Podmiot3, Transport, WZ, Rozliczenie
// ════════════════════════════════════════════════════════════════

function buildExample4Input(): any {
  return {
    header: {
      systemInfo: 'SamploFaktur',
      creationDate: new Date('2026-02-01T00:00:00Z'),
    },
    seller: {
      nip: '9999999999',
      name: 'ABC AGD sp. z o. o.',
      address: { countryCode: 'PL', line1: 'ul. Kwiatowa 1 m. 2', line2: '00-001 Warszawa' },
      contact: { email: 'abc@abc.pl', phone: '667444555' },
    },
    buyer: {
      nip: '1111111111',
      name: 'F.H.U. Jan Kowalski',
      address: { countryCode: 'PL', line1: 'ul. Polna 1', line2: '00-001 Warszawa' },
      contact: { email: 'cde@cde.pl', phone: '555777999' },
      clientNumber: 'fdfd778343',
    },
    thirdParties: [
      {
        nip: '2222222222',
        name: 'Bank Bankowości Bankowej S. A. BBB Faktoring',
        addressLine1: 'ul. Bankowa 1',
        addressLine2: '00-003 Łódź',
        countryCode: 'PL',
        contact: { email: 'bbb@efaktoring.pl', phone: '666888999' },
        role: 1,
      },
    ],
    details: {
      currency: 'PLN',
      issueDate: '2026-02-15',
      invoiceNumber: 'FV2026/02/150',
      saleDate: '2026-01-27',
      invoiceType: 'VAT',
      wz: '44343434/2026',
      annotations: { p_16: 2, p_17: 2, p_18: 2, p_18a: 2 },
      items: [
        {
          name: 'Usługa testowa',
          unit: 'szt.',
          quantity: 100,
          netPrice: 522.60,
          vatRate: '23',
        },
      ],
      settlement: {
        deductions: [
          { amount: 1000, reason: 'nadwyżka salda nierozliczonych środków' },
        ],
        totalDeductions: 1000,
        amountDue: 63279.92,
      },
      payment: {
        method: 6,
        dueDate: '2026-03-15',
        bankAccountFactor: {
          accountNumber: '73111111111111111111111111',
          ownBankAccount: 2,
          bankName: 'Bank Bankowości Bankowej S. A.',
          accountDescription: 'PLN',
        },
      },
      transactionConditions: {
        batchNumber: '2312323/2026',
        transport: [
          {
            type: 3,
            carrier: {
              nip: '6666666666',
              name: 'Jan Nowak Transport',
              addressLine1: 'ul. Bukowa 5',
              addressLine2: '00-004 Poznań',
              countryCode: 'PL',
            },
            cargoType: '13',
            packageUnit: 'a',
            fromAddress: {
              countryCode: 'PL',
              addressLine1: 'Sadowa 1 lok. 2',
              addressLine2: '00-001 Warszawa',
            },
            toAddress: {
              countryCode: 'PL',
              addressLine1: 'ul. Sadowa 1 lok. 3',
              addressLine2: '00-002 Kraków',
            },
          },
        ],
      },
    },
    vatSummary: {
      P_13_1: { vatRate: '23', netAmount: 52260.10, vatAmount: 12019.82 },
    },
    summary: {
      netAmount: 52260.10,
      vatAmount: 12019.82,
      grossAmount: 64279.92,
    },
    footer: {
      info: 'Kapiał zakładowy 5 000 000',
      krs: '0000099999',
      regon: '999999999',
      bdo: '000099999',
    },
  };
}

describe('FA3InvoiceGenerator — FA_3_Przykład_4', () => {
  let xml: string;

  beforeAll(() => {
    const generator = new FA3InvoiceGenerator();
    xml = generator.generate(buildExample4Input());
  });

  // ─── Błąd 1: WZ ───

  it('should generate WZ element from wz field', () => {
    expect(xml).toContain('<WZ>44343434/2026</WZ>');
  });

  // ─── Błąd 2: Podmiot3 z adresem i kontaktem ───

  it('should generate Podmiot3 with DaneIdentyfikacyjne', () => {
    expect(xml).toContain('<Podmiot3>');
    expect(xml).toContain('<Nazwa>Bank Bankowości Bankowej S. A. BBB Faktoring</Nazwa>');
  });

  it('should generate Podmiot3 with Adres from flat fields', () => {
    expect(xml).toContain('<AdresL1>ul. Bankowa 1</AdresL1>');
    expect(xml).toContain('<AdresL2>00-003 Łódź</AdresL2>');
  });

  it('should generate Podmiot3 with DaneKontaktowe from contact object', () => {
    expect(xml).toContain('<Email>bbb@efaktoring.pl</Email>');
    expect(xml).toContain('<Telefon>666888999</Telefon>');
  });

  it('should generate Podmiot3 with Rola', () => {
    expect(xml).toContain('<Rola>1</Rola>');
  });

  // ─── Błąd 3: DoZaplaty ───

  it('should generate DoZaplaty from amountDue in settlement', () => {
    expect(xml).toContain('<DoZaplaty>63279.92</DoZaplaty>');
  });

  it('should generate Odliczenia in Rozliczenie', () => {
    expect(xml).toContain('<Odliczenia>');
    expect(xml).toContain('<Kwota>1000</Kwota>');
    expect(xml).toContain('<SumaOdliczen>1000</SumaOdliczen>');
  });

  // ─── Błąd 4: RachunekBankowyFaktora ───

  it('should generate RachunekBankowyFaktora from bankAccountFactor', () => {
    expect(xml).toContain('<RachunekBankowyFaktora>');
    expect(xml).toContain('<NrRB>73111111111111111111111111</NrRB>');
    expect(xml).toContain('<RachunekWlasnyBanku>2</RachunekWlasnyBanku>');
    expect(xml).toContain('<NazwaBanku>Bank Bankowości Bankowej S. A.</NazwaBanku>');
    expect(xml).toContain('<OpisRachunku>PLN</OpisRachunku>');
  });

  // ─── Błąd 5: NrPartiiTowaru ───

  it('should generate NrPartiiTowaru from batchNumber', () => {
    expect(xml).toContain('<NrPartiiTowaru>2312323/2026</NrPartiiTowaru>');
  });

  // ─── Błąd 6: Transport ───

  it('should generate Transport section with RodzajTransportu', () => {
    expect(xml).toContain('<Transport>');
    expect(xml).toContain('<RodzajTransportu>3</RodzajTransportu>');
  });

  it('should generate Przewoznik with DaneIdentyfikacyjne', () => {
    expect(xml).toContain('<Przewoznik>');
    expect(xml).toContain('<Nazwa>Jan Nowak Transport</Nazwa>');
  });

  it('should generate Przewoznik AdresPrzewoznika from flat carrier address', () => {
    expect(xml).toContain('<AdresPrzewoznika>');
    expect(xml).toContain('<AdresL1>ul. Bukowa 5</AdresL1>');
    expect(xml).toContain('<AdresL2>00-004 Poznań</AdresL2>');
  });

  it('should generate OpisLadunku and JednostkaOpakowania', () => {
    expect(xml).toContain('<OpisLadunku>13</OpisLadunku>');
    expect(xml).toContain('<JednostkaOpakowania>a</JednostkaOpakowania>');
  });

  it('should generate WysylkaZ address', () => {
    expect(xml).toContain('<WysylkaZ>');
    expect(xml).toContain('<AdresL1>Sadowa 1 lok. 2</AdresL1>');
  });

  it('should generate WysylkaDo address', () => {
    expect(xml).toContain('<WysylkaDo>');
    expect(xml).toContain('<AdresL1>ul. Sadowa 1 lok. 3</AdresL1>');
  });

  // ─── UU_ID is optional ───

  it('should NOT auto-generate UU_ID when not provided in items', () => {
    // items in this example don't have uuid — UU_ID should not appear
    const uuidMatches = xml.match(/<UU_ID>[^<]+<\/UU_ID>/g);
    expect(uuidMatches).toBeFalsy();
  });

  // ─── Podmiot1 DaneKontaktowe (from contact object) ───

  it('should generate seller DaneKontaktowe from contact object', () => {
    expect(xml).toContain('<Email>abc@abc.pl</Email>');
    expect(xml).toContain('<Telefon>667444555</Telefon>');
  });

  // ─── Podmiot2 DaneKontaktowe and NrKlienta (from contact + clientNumber) ───

  it('should generate buyer DaneKontaktowe from contact object', () => {
    expect(xml).toContain('<Email>cde@cde.pl</Email>');
    expect(xml).toContain('<Telefon>555777999</Telefon>');
  });

  it('should generate NrKlienta from clientNumber', () => {
    expect(xml).toContain('<NrKlienta>fdfd778343</NrKlienta>');
  });

  // ─── Stopka ───

  it('should generate Stopka with registries', () => {
    expect(xml).toContain('<Stopka>');
    expect(xml).toContain('<KRS>0000099999</KRS>');
    expect(xml).toContain('<REGON>999999999</REGON>');
    expect(xml).toContain('<BDO>000099999</BDO>');
  });

  it('should generate Stopka with info', () => {
    expect(xml).toMatch(/Kapia.*zakładowy 5 000 000/);
  });
});

// ════════════════════════════════════════════════════════════════
// FA_3_Przykład_22 — Faktura WDT (nabywca UE)
// ════════════════════════════════════════════════════════════════

function buildExample22Input(): any {
  return {
    header: {
      systemInfo: 'SamploFaktur',
      creationDate: new Date('2026-02-01T00:00:00Z'),
    },
    seller: {
      nip: '9999999999',
      countryCode: 'PL',
      vatPrefix: 'PL',
      name: 'ABC AGD sp. z o. o.',
      addressLine1: 'ul. Kwiatowa 1 m. 2',
      addressLine2: '00-001 Warszawa',
      contact: { email: 'abc@abc.pl', phone: '667444555' },
    },
    buyer: {
      countryCode: 'DE',
      vatUE: { countryCode: 'DE', vatNumber: '999999999' },
      name: 'EFG GmbH',
      addressLine1: 'Blümchenstraße 1',
      addressLine2: '10999 Berlin',
      contact: { email: 'johan@shmidt.de', phone: '555777999' },
    },
    details: {
      currency: 'EUR',
      issueDate: '2026-02-15',
      issuePlace: 'Warszawa',
      invoiceNumber: 'FV2026/02/150',
      invoiceType: 'VAT',
      annotations: { p_16: 2, p_17: 2, p_18: 2, p_18a: 2 },
      items: [
        {
          name: 'lodówka Zimnotech mk1',
          unit: 'szt.',
          quantity: 10,
          netPrice: 400,
          netAmount: 4000,
          vatRate: '0 WDT',
          saleDate: '2026-01-03',
        },
      ],
    },
    footer: {
      info: 'Kapiał zakładowy 5 000 000',
      krs: '0000099999',
      regon: '999999999',
      bdo: '000099999',
    },
  };
}

describe('FA3InvoiceGenerator — FA_3_Przykład_22 (WDT)', () => {
  let xml: string;

  beforeAll(() => {
    const generator = new FA3InvoiceGenerator();
    xml = generator.generate(buildExample22Input());
  });

  it('should generate PrefiksPodatnika for seller', () => {
    expect(xml).toContain('<PrefiksPodatnika>PL</PrefiksPodatnika>');
  });

  it('should generate KodUE from vatUE object', () => {
    expect(xml).toContain('<KodUE>DE</KodUE>');
  });

  it('should generate NrVatUE as string from vatUE.vatNumber', () => {
    expect(xml).toContain('<NrVatUE>999999999</NrVatUE>');
    expect(xml).not.toContain('[object Object]');
  });

  it('should generate buyer Nazwa', () => {
    expect(xml).toContain('<Nazwa>EFG GmbH</Nazwa>');
  });

  it('should generate buyer address from flat fields', () => {
    expect(xml).toContain('<AdresL1>Blümchenstraße 1</AdresL1>');
    expect(xml).toContain('<AdresL2>10999 Berlin</AdresL2>');
  });

  it('should generate buyer DaneKontaktowe from contact', () => {
    expect(xml).toContain('<Email>johan@shmidt.de</Email>');
  });
});

// ════════════════════════════════════════════════════════════════
// FA_3_Przykład_23 — Faktura eksportowa (nabywca spoza UE)
// ════════════════════════════════════════════════════════════════

describe('FA3InvoiceGenerator — FA_3_Przykład_23 (export, non-EU buyer)', () => {
  let xml: string;

  beforeAll(() => {
    const generator = new FA3InvoiceGenerator();
    xml = generator.generate({
      header: { systemInfo: 'SamploFaktur', creationDate: new Date('2026-02-01T00:00:00Z') },
      seller: {
        nip: '9999999999',
        name: 'ABC AGD sp. z o. o.',
        addressLine1: 'ul. Kwiatowa 1 m. 2',
        addressLine2: '00-001 Warszawa',
        countryCode: 'PL',
      },
      buyer: {
        countryCode: 'US',
        taxId: '999999999',
        name: 'EFG Ltd.',
        addressLine1: 'Flower (St) 1',
        addressLine2: 'Seattle, WA 99999',
      },
      details: {
        currency: 'USD',
        issueDate: '2026-06-15',
        invoiceNumber: 'FV2026/02/150',
        invoiceType: 'VAT',
        annotations: { p_16: 2, p_17: 2, p_18: 2, p_18a: 2 },
        items: [
          { name: 'lodówka', unit: 'szt.', quantity: 20, netPrice: 400, vatRate: '0 EX' },
        ],
      },
    } as any);
  });

  it('should generate KodKraju US in buyer DaneIdentyfikacyjne', () => {
    expect(xml).toContain('<KodKraju>US</KodKraju>');
  });

  it('should generate NrID from taxId', () => {
    expect(xml).toContain('<NrID>999999999</NrID>');
  });

  it('should generate buyer Nazwa', () => {
    expect(xml).toContain('<Nazwa>EFG Ltd.</Nazwa>');
  });
});

// ════════════════════════════════════════════════════════════════
// FA_3_Przykład_6 — Korekta zbiorcza (totals bez items)
// ════════════════════════════════════════════════════════════════

describe('FA3InvoiceGenerator — FA_3_Przykład_6 (collective correction with totals)', () => {
  let xml: string;

  beforeAll(() => {
    const generator = new FA3InvoiceGenerator();
    xml = generator.generate({
      header: { systemInfo: 'SamploFaktur', creationDate: new Date('2026-02-01T00:00:00Z') },
      seller: {
        nip: '9999999999',
        name: 'ABC AGD sp. z o. o.',
        addressLine1: 'ul. Kwiatowa 1 m. 2',
        addressLine2: '00-001 Warszawa',
        countryCode: 'PL',
      },
      buyer: {
        nip: '1111111111',
        name: 'F.H.U. Jan Kowalski',
        addressLine1: 'ul. Polna 1',
        addressLine2: '00-001 Warszawa',
        countryCode: 'PL',
      },
      details: {
        currency: 'PLN',
        issueDate: '2026-07-15',
        invoiceNumber: 'FVKOR/2026/ZB/1',
        invoiceType: 'KOR',
        correctionReason: 'rabat za pierwsze półrocze 2026',
        correctionType: 1,
        correctedPeriod: 'pierwsze półrocze 2026',
        correctedInvoices: [
          { issueDate: '2026-01-15', number: 'FV/2026/01/001' },
          { issueDate: '2026-02-15', number: 'FV/2026/02/002' },
          { issueDate: '2026-03-15', number: 'FV/2026/03/003' },
          { issueDate: '2026-04-15', number: 'FV/2026/04/004' },
          { issueDate: '2026-05-15', number: 'FV/2026/05/005' },
          { issueDate: '2026-06-15', number: 'FV/2026/06/006' },
        ],
        annotations: { p_16: 2, p_17: 2, p_18: 2, p_18a: 2 },
        items: [],
        totals: {
          P_13_1: -40650.41,
          P_14_1: -9349.59,
          P_15: -50000,
        },
      },
    } as any);
  });

  // ─── Problem 1: Totals → P_13_1, P_14_1, P_15 ───

  it('should generate P_13_1 from totals', () => {
    expect(xml).toContain('<P_13_1>-40650.41</P_13_1>');
  });

  it('should generate P_14_1 from totals', () => {
    expect(xml).toContain('<P_14_1>-9349.59</P_14_1>');
  });

  it('should generate P_15 from totals', () => {
    expect(xml).toContain('<P_15>-50000</P_15>');
  });

  // ─── Problem 2: OkresFaKorygowanej ───

  it('should generate OkresFaKorygowanej from correctedPeriod', () => {
    expect(xml).toContain('<OkresFaKorygowanej>pierwsze półrocze 2026</OkresFaKorygowanej>');
  });

  it('should generate all 6 DaneFaKorygowanej', () => {
    const matches = xml.match(/<DaneFaKorygowanej>/g);
    expect(matches).toHaveLength(6);
  });

  it('should have RodzajFaktury=KOR', () => {
    expect(xml).toContain('<RodzajFaktury>KOR</RodzajFaktury>');
  });
});

// ════════════════════════════════════════════════════════════════
// FA_3_Przykład_7 — Korekta zbiorcza z items bez netAmount/vatRate
// ════════════════════════════════════════════════════════════════

describe('FA3InvoiceGenerator — FA_3_Przykład_7 (items without netAmount/vatRate)', () => {
  let xml: string;

  beforeAll(() => {
    const generator = new FA3InvoiceGenerator();
    xml = generator.generate({
      header: { systemInfo: 'Samplofaktur', creationDate: new Date('2026-07-15T09:30:47Z') },
      seller: {
        nip: '9999999999',
        name: 'ABC AGD sp. z o. o.',
        addressLine1: 'ul. Kwiatowa 1 m. 2',
        addressLine2: '00-001 Warszawa',
        countryCode: 'PL',
      },
      buyer: {
        nip: '1111111111',
        name: 'CeDeE s.c.',
        addressLine1: 'ul. Sadowa 1 lok. 3',
        addressLine2: '00-002 Kraków',
        countryCode: 'PL',
        clientNumber: 'fdfd778343',
      },
      details: {
        currency: 'PLN',
        issueDate: '2026-07-15',
        invoiceNumber: 'FK2026/07/243',
        invoiceType: 'KOR',
        annotations: { p_16: 2, p_17: 2, p_18: 2, p_18a: 2 },
        correctionReason: 'rabat 50000 z uwagi na poziom zakupów pierwszym półroczu 2026',
        correctionType: 2,
        correctedPeriod: 'pierwsze półrocze 2026',
        correctedInvoices: [
          { number: 'FV2026/01/134', issueDate: '2026-01-15', ksefNumber: '9999999999-20230908-8BEF280C8D35-4D' },
          { number: 'FV2026/02/150', issueDate: '2026-02-15', ksefNumber: '9999999999-20230908-76B2B580D4DC-80' },
          { number: 'FV2026/03/143', issueDate: '2026-03-15', ksefNumber: '9999999999-20230908-4191312C0E57-09' },
          { number: 'FV2026/04/23', issueDate: '2026-04-15', ksefNumber: '9999999999-20230908-2B9266CEF3C4-DD' },
          { number: 'FV2026/05/54', issueDate: '2026-05-15', ksefNumber: '9999999999-20230908-16B99491C78B-3D' },
          { number: 'FV2026/06/15', issueDate: '2026-06-15', ksefNumber: '9999999999-20230908-D08FB95950BE-3E' },
        ],
        items: [
          { name: 'lodówka Zimnotech mk1', unit: 'szt.', quantity: 1000, cn: '8418 21 91' },
        ],
        totals: { P_15: -50000, P_13_1: -40650.41, P_14_1: -9349.59 },
      },
      footer: { info: 'Kapitał zakładowy 5 000 000', krs: '0000099999', regon: '999999999', bdo: '000099999' },
    } as any);
  });

  it('should NOT generate P_11 when netAmount not in JSON', () => {
    // FaWiersz should not contain P_11
    const faWiersz = xml.match(/<FaWiersz>[\s\S]*?<\/FaWiersz>/)?.[0] ?? '';
    expect(faWiersz).not.toContain('<P_11>');
  });

  it('should NOT generate P_12 when vatRate not in JSON', () => {
    const faWiersz = xml.match(/<FaWiersz>[\s\S]*?<\/FaWiersz>/)?.[0] ?? '';
    expect(faWiersz).not.toContain('<P_12>');
  });

  it('should generate P_7 (name)', () => {
    expect(xml).toContain('<P_7>lodówka Zimnotech mk1</P_7>');
  });

  it('should generate CN', () => {
    expect(xml).toContain('<CN>8418 21 91</CN>');
  });

  it('should generate P_8B (quantity)', () => {
    expect(xml).toContain('<P_8B>1000</P_8B>');
  });

  it('should generate P_13_1 from totals', () => {
    expect(xml).toContain('<P_13_1>-40650.41</P_13_1>');
  });

  it('should generate P_15 from totals', () => {
    expect(xml).toContain('<P_15>-50000</P_15>');
  });

  it('should generate OkresFaKorygowanej', () => {
    expect(xml).toContain('<OkresFaKorygowanej>pierwsze półrocze 2026</OkresFaKorygowanej>');
  });

  it('should generate DaneFaKorygowanej with ksefNumber', () => {
    expect(xml).toContain('<NrKSeF>1</NrKSeF>');
    expect(xml).toContain('<NrKSeFFaKorygowanej>9999999999-20230908-8BEF280C8D35-4D</NrKSeFFaKorygowanej>');
  });
});
