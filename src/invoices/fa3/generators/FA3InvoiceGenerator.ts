import { Fa3InvoiceBuilder } from '../builders/fa3-invoice.builder';
import { Fa3BuildContext } from '../validators/build-context';
import { InvoiceCalculator } from '../calculators/invoice.calculator';
import { debugError, debugWarn } from '../../../utils/logger';
import type { Fa3Invoice, Fa3InvoiceInput, Fa3Header } from '../types';

function validateNip(nip: string): boolean {
  const cleaned = nip.replace(/[\s-]/g, '');
  if (!/^\d{10}$/.test(cleaned)) return false;

  const weights = [6, 5, 7, 2, 3, 4, 5, 6, 7];
  const digits = cleaned.split('').map(Number);
  const checksum = digits[9];

  const sum = digits
    .slice(0, 9)
    .reduce((acc, digit, i) => acc + digit * weights[i], 0);
  const calculatedChecksum = sum % 11;

  return calculatedChecksum === checksum;
}

/**
 * Normalizuje adres z płaskich pól (addressLine1/addressLine2/countryCode)
 * do obiektu { countryCode, line1, line2 } jeśli brakuje pola `address`.
 */
function normalizeAddress(entity: any): any {
  if (entity?.address) return entity;
  if (!entity?.addressLine1) return entity;

  const { addressLine1, addressLine2, countryCode, gln, ...rest } = entity;
  return {
    ...rest,
    countryCode, // zachowaj na entity (potrzebne dla DaneIdentyfikacyjne)
    address: {
      countryCode: countryCode ?? 'PL',
      line1: addressLine1,
      line2: addressLine2,
      ...(gln !== undefined ? { gln } : {}),
    },
  };
}

/**
 * Normalizuje contact: { email, phone } → email, phone
 * oraz clientNumber → customerNumber na dowolnym obiekcie podmiotu.
 */
function normalizeContact(entity: any): any {
  if (!entity) return entity;
  let result = { ...entity };
  // contact: { email, phone } → email, phone
  if (result.contact) {
    const { contact, ...rest } = result;
    result = {
      ...rest,
      email: rest.email ?? contact.email,
      phone: rest.phone ?? contact.phone,
    };
  }
  // clientNumber → customerNumber
  if (result.clientNumber !== undefined && result.customerNumber === undefined) {
    result.customerNumber = result.clientNumber;
    delete result.clientNumber;
  }
  // vatUE as object { countryCode, vatNumber } → flat countryCodeUE + vatUE (string)
  if (result.vatUE && typeof result.vatUE === 'object') {
    const vatObj = result.vatUE;
    result.countryCodeUE = result.countryCodeUE ?? vatObj.countryCode;
    result.vatUE = vatObj.vatNumber ?? vatObj.number;
  }
  // brakId → noId (BrakID for consumers)
  if (result.brakId !== undefined && result.noId === undefined) {
    result.noId = result.brakId;
    delete result.brakId;
  }
  // taxId → idNumber, countryCode → idCountryCode (for non-EU buyers)
  if (result.taxId !== undefined && result.idNumber === undefined) {
    result.idNumber = result.taxId;
    delete result.taxId;
  }
  if (result.idNumber && !result.idCountryCode && result.countryCode) {
    result.idCountryCode = result.countryCode;
  }
  // vatPrefix → prefixVatUE (seller's PrefiksPodatnika)
  if (result.vatPrefix !== undefined && result.prefixVatUE === undefined) {
    result.prefixVatUE = result.vatPrefix;
    delete result.vatPrefix;
  }
  // jst (1|2) → isJstSubordinate (boolean)
  if (result.jst !== undefined && result.isJstSubordinate === undefined) {
    result.isJstSubordinate = result.jst === 1 || result.jst === '1' || result.jst === true;
    delete result.jst;
  }
  // gv (1|2) → isVatGroupMember (boolean)
  if (result.gv !== undefined && result.isVatGroupMember === undefined) {
    result.isVatGroupMember = result.gv === 1 || result.gv === '1' || result.gv === true;
    delete result.gv;
  }
  return result;
}

/**
 * Normalizuje pole `paid` — akceptuje `true`, `1`, `"1"` jako zapłacono.
 */
function normalizePaid(payment: any): any {
  if (!payment) return payment;
  const { paid, ...rest } = payment;
  if (paid === true || paid === 1 || paid === '1') {
    return { ...rest, paid: true };
  }
  return payment;
}

/**
 * Normalizuje podmiot trzeci — adres (flat → object), contact → email/phone, clientNumber → customerNumber.
 */
function normalizeThirdParty(tp: any): any {
  if (!tp) return tp;
  let result = normalizeContact(normalizeAddress(tp));
  // sharePercent → share
  if (result.sharePercent !== undefined && result.share === undefined) {
    result.share = result.sharePercent;
    delete result.sharePercent;
  }
  return result;
}

/**
 * Normalizuje settlement — mapuje amountDue → amountToPay.
 */
function normalizeSettlement(settlement: any): any {
  if (!settlement) return settlement;
  const { amountDue, ...rest } = settlement;
  if (amountDue !== undefined && rest.amountToPay === undefined) {
    rest.amountToPay = amountDue;
  }
  return rest;
}

/**
 * Normalizuje payment — mapuje bankAccountFactor → factorAccounts,
 * z ownBankAccount → ownBankAccountType, accountDescription → description.
 */
function normalizePaymentFull(payment: any): any {
  if (!payment) return payment;
  let result = normalizePaid(payment);
  // bankAccountFactor / factorBankAccount (single or array) → factorAccounts
  const rawFactor = result.bankAccountFactor ?? result.factorBankAccount;
  if (rawFactor && !result.factorAccounts) {
    const raw = Array.isArray(rawFactor)
      ? rawFactor
      : [rawFactor];
    result.factorAccounts = raw.map((acc: any) => ({
      accountNumber: acc.accountNumber,
      swift: acc.swift,
      ownBankAccountType: acc.ownBankAccountType ?? acc.ownBankAccount,
      bankName: acc.bankName,
      description: acc.description ?? acc.accountDescription,
    }));
    delete result.bankAccountFactor;
    delete result.factorBankAccount;
  }
  // bankAccount.accountDescription → description (normalizuj główny rachunek)
  if (result.bankAccount && typeof result.bankAccount === 'object') {
    if (result.bankAccount.accountDescription !== undefined && result.bankAccount.description === undefined) {
      result.bankAccount = {
        ...result.bankAccount,
        description: result.bankAccount.accountDescription,
      };
      delete result.bankAccount.accountDescription;
    }
  }
  // bankAccounts[].accountDescription → description (normalizuj tablicę rachunków)
  if (Array.isArray(result.bankAccounts)) {
    result.bankAccounts = result.bankAccounts.map((acc: any) => {
      if (acc.accountDescription !== undefined && acc.description === undefined) {
        const { accountDescription, ...rest } = acc;
        return { ...rest, description: accountDescription };
      }
      return acc;
    });
  }
  // dueDates: string[] → Fa3DueDate[] (normalize plain date strings to objects)
  if (Array.isArray(result.dueDates)) {
    result.dueDates = result.dueDates.map((dd: any) =>
      typeof dd === 'string' || dd instanceof Date ? { dueDate: dd } : dd
    );
  }
  // partialPayment (single object) → partialPayments (array)
  if (result.partialPayment && !result.partialPayments) {
    result.partialPayments = Array.isArray(result.partialPayment)
      ? result.partialPayment
      : [result.partialPayment];
    delete result.partialPayment;
  }
  // termDescription → dueDateDescription (count→quantity, event→startEvent)
  if (result.termDescription && !result.dueDateDescription) {
    const td = result.termDescription;
    result.dueDateDescription = {
      quantity: td.quantity ?? td.count,
      unit: td.unit,
      startEvent: td.startEvent ?? td.event,
    };
    delete result.termDescription;
  }
  return result;
}

/**
 * Normalizuje adres transportowy — flat addressLine1/2 → line1/line2.
 */
function normalizeTransportAddress(addr: any): any {
  if (!addr) return addr;
  if (addr.line1) return addr; // already normalized
  if (!addr.addressLine1) return addr;
  const { addressLine1, addressLine2, ...rest } = addr;
  return { ...rest, line1: addressLine1, line2: addressLine2 };
}

/**
 * Normalizuje carrier — flat addressLine1/2 → address object.
 */
function normalizeCarrier(carrier: any): any {
  if (!carrier) return carrier;
  if (carrier.address) return carrier;
  if (!carrier.addressLine1) return carrier;
  const { addressLine1, addressLine2, countryCode, ...rest } = carrier;
  return {
    ...rest,
    address: {
      countryCode: countryCode ?? 'PL',
      line1: addressLine1,
      line2: addressLine2,
    },
  };
}

/**
 * Normalizuje transport entry — carrier address, packageUnit → packagingUnit,
 * fromAddress/toAddress flat → line1/line2.
 */
function normalizeTransportEntry(t: any): any {
  if (!t) return t;
  const result: any = { ...t };
  // Coerce type and cargoType to numbers (JSON may have strings like "3", "13")
  if (typeof result.type === 'string') result.type = Number(result.type);
  if (typeof result.cargoType === 'string') result.cargoType = Number(result.cargoType);
  // cargoDescription (number) → cargoType (when cargoDescription is numeric, it's the cargo type code)
  if (result.cargoDescription !== undefined && result.cargoType === undefined && typeof result.cargoDescription === 'number') {
    result.cargoType = result.cargoDescription;
    delete result.cargoDescription;
  }
  // packageUnit → packagingUnit
  if (result.packageUnit !== undefined && result.packagingUnit === undefined) {
    result.packagingUnit = result.packageUnit;
    delete result.packageUnit;
  }
  // Normalize carrier address
  if (result.carrier) {
    result.carrier = normalizeCarrier(result.carrier);
  }
  // Normalize from/to/via addresses
  if (result.fromAddress) {
    result.fromAddress = normalizeTransportAddress(result.fromAddress);
  }
  if (result.toAddress) {
    result.toAddress = normalizeTransportAddress(result.toAddress);
  }
  if (Array.isArray(result.viaAddresses)) {
    result.viaAddresses = result.viaAddresses.map(normalizeTransportAddress);
  }
  return result;
}

/**
 * Normalizuje transactionConditions — batchNumber → batchNumbers, transport entries.
 */
function normalizeTransactionConditions(tc: any): any {
  if (!tc) return tc;
  const result: any = { ...tc };
  // batchNumber (string) → batchNumbers (string[])
  if (result.batchNumber !== undefined && !result.batchNumbers) {
    result.batchNumbers = Array.isArray(result.batchNumber)
      ? result.batchNumber
      : [result.batchNumber];
    delete result.batchNumber;
  }
  // deliveryConditions → deliveryTerms
  if (result.deliveryConditions !== undefined && result.deliveryTerms === undefined) {
    result.deliveryTerms = result.deliveryConditions;
    delete result.deliveryConditions;
  }
  // orders[].orderDate → date, orders[].orderNumber → number
  if (Array.isArray(result.orders)) {
    result.orders = result.orders.map((o: any) => ({
      date: o.date ?? o.orderDate,
      number: o.number ?? o.orderNumber,
    }));
  }
  // Single transport object → array
  if (result.transport && !Array.isArray(result.transport)) {
    result.transport = [result.transport];
  }
  // Normalize transport entries (shipFrom→fromAddress, shipTo→toAddress, carrier address, etc.)
  if (Array.isArray(result.transport)) {
    result.transport = result.transport.map((t: any) => {
      const entry = normalizeTransportEntry(t);
      // shipFrom → fromAddress
      if (entry.shipFrom && !entry.fromAddress) {
        entry.fromAddress = normalizeTransportAddress(entry.shipFrom);
        delete entry.shipFrom;
      }
      // shipTo → toAddress
      if (entry.shipTo && !entry.toAddress) {
        entry.toAddress = normalizeTransportAddress(entry.shipTo);
        delete entry.shipTo;
      }
      return entry;
    });
  }
  return result;
}

/**
 * Normalizuje annotations — spłaszcza zagnieżdżone obiekty (pMarzy, zwolnienie, noweSrodkiTransportu)
 * do płaskiej struktury Fa3Annotations.
 */
function normalizeAnnotations(annotations: any): any {
  if (!annotations) return annotations;
  const result: any = { ...annotations };

  // pMarzy: { p_pMarzy, p_pMarzy_2, p_pMarzy_3_1, ... } → flat
  if (result.pMarzy && typeof result.pMarzy === 'object') {
    Object.assign(result, result.pMarzy);
    delete result.pMarzy;
  }

  // zwolnienie: { p_19, p_19a, ... } or { p_19n } → flat
  if (result.zwolnienie && typeof result.zwolnienie === 'object') {
    Object.assign(result, result.zwolnienie);
    delete result.zwolnienie;
  }

  // noweSrodkiTransportu: { p_22, ... } or { p_22n } → flat
  if (result.noweSrodkiTransportu && typeof result.noweSrodkiTransportu === 'object') {
    Object.assign(result, result.noweSrodkiTransportu);
    delete result.noweSrodkiTransportu;
  }

  return result;
}

/**
 * Normalizuje footer — flat { info, krs, regon, bdo } → structured { info: [{ text }], registries: [{ krs, regon, bdo }] }.
 */
function normalizeFooter(footer: any): any {
  if (!footer) return footer;
  // Already in structured format
  if (Array.isArray(footer.info) || Array.isArray(footer.registries)) return footer;

  const result: any = {};

  // info: string → info: [{ text: string }]
  if (typeof footer.info === 'string') {
    result.info = [{ text: footer.info }];
  } else if (footer.info) {
    result.info = footer.info;
  }

  // Flat krs/regon/bdo → registries: [{ krs, regon, bdo }]
  if (footer.krs || footer.regon || footer.bdo || footer.fullName) {
    result.registries = [{
      fullName: footer.fullName,
      krs: footer.krs,
      regon: footer.regon,
      bdo: footer.bdo,
    }];
  } else if (footer.registries) {
    result.registries = footer.registries;
  }

  return result;
}

/**
 * Normalizuje attachment — dataBlock (single) → blocks (array),
 * table columns → header, tableMetadata (single) → metadata (array).
 */
function normalizeAttachment(attachment: any): any {
  if (!attachment) return attachment;

  // Already in correct format with blocks array
  if (Array.isArray(attachment.blocks) && attachment.blocks.length > 0) {
    // Still normalize tables within existing blocks
    return {
      ...attachment,
      blocks: attachment.blocks.map(normalizeAttachmentBlock),
    };
  }

  // dataBlock (single object) → blocks (array)
  if (attachment.dataBlock) {
    const block = normalizeAttachmentBlock(attachment.dataBlock);
    return { blocks: [block] };
  }

  return attachment;
}

/**
 * Normalizuje pojedynczy blok załącznika — table columns → header,
 * tableMetadata (single) → metadata (array).
 */
function normalizeAttachmentBlock(block: any): any {
  if (!block) return block;
  const result: any = { ...block };

  // Normalize tables within the block
  if (Array.isArray(result.tables)) {
    result.tables = result.tables.map(normalizeAttachmentTable);
  }

  return result;
}

/**
 * Normalizuje tabelę załącznika — columns → header,
 * tableMetadata (single obj) → metadata (array).
 */
function normalizeAttachmentTable(table: any): any {
  if (!table) return table;
  const result: any = { ...table };

  // columns → header (builder expects header with columns)
  if (result.columns && !result.header) {
    result.header = result.columns;
    delete result.columns;
  }

  // tableMetadata (single object { key, value }) → metadata (array)
  if (result.tableMetadata && !result.metadata) {
    result.metadata = Array.isArray(result.tableMetadata)
      ? result.tableMetadata
      : [result.tableMetadata];
    delete result.tableMetadata;
  }

  return result;
}

/**
 * Mapowanie P_13_x/P_14_x → vatRate do konwersji totals → vatSummary.
 */
const TOTALS_RATE_MAP: Record<string, string | number> = {
  P_13_1: '23', P_14_1: '23',
  P_13_2: '8', P_14_2: '8',
  P_13_3: '5', P_14_3: '5',
  P_13_4: '4', P_14_4: '4',
  P_13_5: 'OSS', P_14_5: 'OSS',
  P_13_6_1: '0 KR',
  P_13_6_2: '0 WDT',
  P_13_6_3: '0 EX',
  P_13_7: 'zw',
  P_13_8: 'np I',
  P_13_9: 'np II',
  P_13_10: 'OO',
  P_13_11: 'marza',
};

/**
 * Konwertuje flat totals { P_13_1, P_14_1, P_15 } → { vatSummary, summary }.
 */
function normalizeTotals(totals: any): { vatSummary: any; summary: any } | null {
  if (!totals) return null;

  const vatSummary: any = {};
  const processedKeys = new Set<string>();

  for (const [key, rate] of Object.entries(TOTALS_RATE_MAP)) {
    if (totals[key] === undefined) continue;
    const rateKey = typeof rate === 'string' ? rate : String(rate);
    const groupKey = `P_13_${key.includes('_1W') ? '1' : key.replace(/^P_1[34]_/, '')}`;

    // Determine the canonical group key from the rate
    const canonicalKey = Object.entries(TOTALS_RATE_MAP)
      .find(([k]) => k.startsWith('P_13_') && TOTALS_RATE_MAP[k] === rate)?.[0] ?? key;

    if (!processedKeys.has(canonicalKey)) {
      processedKeys.add(canonicalKey);
      const netKey = canonicalKey; // P_13_x
      const vatKey = canonicalKey.replace('P_13_', 'P_14_'); // P_14_x

      const group: any = {
        vatRate: rate,
        netAmount: totals[netKey] ?? 0,
        vatAmount: totals[vatKey] ?? 0,
      };
      // P_14_xW — kwota VAT przeliczona na PLN (dla walut obcych)
      const vatPLNKey = vatKey + 'W'; // e.g. P_14_1W
      if (totals[vatPLNKey] !== undefined) {
        group.vatAmountPLN = totals[vatPLNKey];
      }
      vatSummary[canonicalKey] = group;
    }
  }

  const grossAmount = totals.P_15 ?? 0;
  // Calculate net/vat from vatSummary groups
  let totalNet = 0;
  let totalVat = 0;
  for (const g of Object.values(vatSummary) as any[]) {
    totalNet += g.netAmount ?? 0;
    totalVat += g.vatAmount ?? 0;
  }

  return {
    vatSummary,
    summary: {
      netAmount: totalNet,
      vatAmount: totalVat,
      grossAmount,
    },
  };
}

function normalizeInvoice(input: Fa3InvoiceInput | Fa3Invoice): Fa3Invoice {
  const header: Fa3Header = {
    systemInfo: input.header?.systemInfo ?? 'KSeF TypeScript Library',
    creationDate: input.header?.creationDate ?? new Date(),
  };

  // Normalizuj lineNumber, uuId → uuid dla itemów
  const items = (input.details.items ?? []).map((item, idx) => {
    const normalized: any = {
      ...item,
      // lineNumber will be assigned after map for correction pairing
    };
    // Mapuj uuId (camelCase z JSON) → uuid (nasze wewnętrzne pole)
    if ((item as any).uuId !== undefined && normalized.uuid === undefined) {
      normalized.uuid = (item as any).uuId;
      delete normalized.uuId;
    }
    // deliveryDate → saleDate (P_6A per wiersz)
    if (normalized.deliveryDate !== undefined && normalized.saleDate === undefined) {
      normalized.saleDate = normalized.deliveryDate;
      delete normalized.deliveryDate;
    }
    // Zapamiętaj czy netAmount, vatRate, vatAmount, quantity były jawnie podane w JSON
    // (calculator je nadpisze, ale builder musi wiedzieć czy emitować)
    if (item.netAmount === undefined || item.netAmount === null) {
      normalized._noNetAmount = true;
    }
    if (item.vatRate === undefined || item.vatRate === null) {
      normalized._noVatRate = true;
    }
    if (item.vatAmount === undefined || item.vatAmount === null) {
      normalized._noVatAmount = true;
    }
    if (item.quantity === undefined || item.quantity === null) {
      normalized._noQuantity = true;
    }
    // UPR (faktura uproszczona) — FaWiersz zawiera tylko NrWierszaFa, UU_ID i P_7
    if (input.details.invoiceType === 'UPR') {
      normalized._simplified = true;
    }
    return normalized;
  });

  // Auto-assign lineNumbers for items.
  // For corrections: beforeCorrection item and the following after-item share the same number.
  {
    const needsAutoNumber = items.some((i: any) => i.lineNumber === undefined);
    if (needsAutoNumber) {
      let lineNum = 0;
      for (let i = 0; i < items.length; i++) {
        if (items[i].lineNumber !== undefined) continue;
        const isBefore = items[i].beforeCorrection === 1 || items[i].beforeCorrection === true;
        if (isBefore) {
          lineNum++;
          items[i].lineNumber = lineNum;
        } else {
          const prev = i > 0 ? items[i - 1] : null;
          const prevIsBefore = prev && (prev.beforeCorrection === 1 || prev.beforeCorrection === true);
          if (prevIsBefore) {
            items[i].lineNumber = lineNum;
          } else {
            lineNum++;
            items[i].lineNumber = lineNum;
          }
        }
      }
    }
  }

  // Normalizuj adnotacje (pMarzy, zwolnienie, noweSrodkiTransportu → flat)
  const annotations = normalizeAnnotations(input.details.annotations);

  // Jeśli procedura marży i item nie ma vatRate, ustaw vatRate='marza' i isMargin=true
  if (annotations?.p_pMarzy === 1) {
    for (const item of items) {
      if (item._noVatRate) {
        item.vatRate = 'marza';
        item.isMargin = true;
      }
    }
  }

  // Normalizuj adresy (flat → object) i kontakt (contact → email/phone, clientNumber → customerNumber)
  const seller = normalizeContact(normalizeAddress(input.seller));
  const buyer = normalizeContact(normalizeAddress(input.buyer));

  // Normalizuj thirdParties (adresy + contact)
  const thirdParties = input.thirdParties?.map(normalizeThirdParty);

  // Normalizuj payment (paid, bankAccountFactor)
  const payment = normalizePaymentFull(input.details.payment);

  // Normalizuj order items — uuId → uuid
  let orderData = input.details.order;
  if (orderData && Array.isArray(orderData.items)) {
    orderData = {
      ...orderData,
      items: orderData.items.map((item: any, idx: number) => {
        const normalized: any = { ...item };
        if ((item as any).uuId !== undefined && normalized.uuid === undefined) {
          normalized.uuid = (item as any).uuId;
          delete normalized.uuId;
        }
        // lineNumber will be assigned below after all items are normalized
        return normalized;
      }),
    };
    // Auto-assign lineNumbers for order items that don't have them.
    // For corrections: beforeCorrection item and the following after-item share the same number.
    const orderItems = orderData.items as any[];
    const needsAutoNumber = orderItems.some((i: any) => i.lineNumber === undefined);
    if (needsAutoNumber) {
      let lineNum = 0;
      for (let i = 0; i < orderItems.length; i++) {
        if (orderItems[i].lineNumber !== undefined) continue;
        const isBefore = orderItems[i].beforeCorrection === 1 || orderItems[i].beforeCorrection === true;
        if (isBefore) {
          lineNum++;
          orderItems[i].lineNumber = lineNum;
        } else {
          // If previous item was beforeCorrection, reuse its number (pair)
          const prev = i > 0 ? orderItems[i - 1] : null;
          const prevIsBefore = prev && (prev.beforeCorrection === 1 || prev.beforeCorrection === true);
          if (prevIsBefore) {
            orderItems[i].lineNumber = lineNum;
          } else {
            lineNum++;
            orderItems[i].lineNumber = lineNum;
          }
        }
      }
    }
  }

  // Normalizuj settlement (amountDue → amountToPay)
  const settlement = normalizeSettlement(input.details.settlement);

  // Normalizuj transactionConditions (batchNumber, transport)
  const transactionConditions = normalizeTransactionConditions(
    input.details.transactionConditions
  );

  // Normalizuj WZ — wz (string|string[]) → deliveryNotes (string[])
  const inputAny = input.details as any;
  let deliveryNotes = input.details.deliveryNotes;
  if (!deliveryNotes && inputAny.wz !== undefined) {
    deliveryNotes = Array.isArray(inputAny.wz) ? inputAny.wz : [inputAny.wz];
  }

  // Normalizuj additionalDescription → additionalInfo
  let additionalInfo = input.details.additionalInfo;
  if (!additionalInfo && inputAny.additionalDescription !== undefined) {
    additionalInfo = inputAny.additionalDescription;
  }

  // Normalizuj billingPeriod → saleDateRange (OkresFa)
  if (inputAny.billingPeriod && !input.details.saleDateRange) {
    (input.details as any).saleDateRange = inputAny.billingPeriod;
  }

  // Normalizuj correctedPeriod → correctedInvoicePeriod
  let correctedInvoicePeriod = input.details.correctedInvoicePeriod;
  if (!correctedInvoicePeriod && inputAny.correctedPeriod !== undefined) {
    correctedInvoicePeriod = inputAny.correctedPeriod;
  }

  // Normalizuj P_15ZK z totals → amountBeforeCorrection
  if (inputAny.totals?.P_15ZK !== undefined && (input.details as any).amountBeforeCorrection === undefined) {
    (input.details as any).amountBeforeCorrection = inputAny.totals.P_15ZK;
  }

  // Normalizuj totals → vatSummary + summary (dla faktur zbiorczych bez items)
  const totalsData = normalizeTotals(inputAny.totals);
  let vatSummary = input.vatSummary ?? {};
  let summary = {
    netAmount: input.summary?.netAmount ?? 0,
    vatAmount: input.summary?.vatAmount ?? 0,
    grossAmount: input.summary?.grossAmount ?? 0,
  };
  if (totalsData) {
    vatSummary = totalsData.vatSummary;
    summary = totalsData.summary;
  }

  return {
    header,
    seller,
    buyer,
    thirdParties,
    authorizedEntity: input.authorizedEntity,
    details: {
      ...input.details,
      items,
      annotations,
      payment,
      settlement,
      transactionConditions,
      deliveryNotes,
      additionalInfo,
      correctedInvoicePeriod,
      ...(orderData ? { order: orderData } : {}),
    },
    vatSummary,
    summary,
    footer: normalizeFooter(input.footer),
    attachment: normalizeAttachment(input.attachment),
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

    // Zachowaj oryginalne summary/vatSummary jeśli podane (niezerowe)
    const userSummary = normalizedInvoice.summary;
    const userVatSummary = normalizedInvoice.vatSummary;
    const hasUserSummary = userSummary && userSummary.grossAmount !== 0;
    // User podał totals (nawet jeśli bez P_13/P_14) → użyj ich vatSummary zamiast kalkulowanego
    const inputAnyGen = invoice as any;
    const hadTotals = !!(inputAnyGen.details?.totals || inputAnyGen.invoice?.details?.totals);
    const hasUserVatSummary =
      hadTotals ||
      (userVatSummary && Object.keys(userVatSummary).length > 0 &&
      Object.values(userVatSummary).some((g) => (g.netAmount ?? 0) !== 0));

    // 2. KALKULACJA - obliczenie wszystkich kwot, VAT summary i sum
    normalizedInvoice = InvoiceCalculator.process(normalizedInvoice, {
      currency: normalizedInvoice.details.currency,
      roundingMode: 'item',
      decimalPlaces: 2,
    });

    // Jeśli user podał totale, użyj ich zamiast kalkulowanych
    if (hasUserSummary) {
      normalizedInvoice = { ...normalizedInvoice, summary: userSummary };
    }
    if (hasUserVatSummary) {
      normalizedInvoice = { ...normalizedInvoice, vatSummary: userVatSummary };
    }

    // 3. WALIDACJA I BUILD - generowanie XML
    const ctx = new Fa3BuildContext({ mode: 'collect' }, validateNip);

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

    const warnings = ctx.issues.filter((i) => i.severity === 'warning');
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
