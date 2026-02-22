# Changelog

## 2.6.0

Skupienie na generowaniu faktur XML FA(3) zgodnych ze schematem KSeF — przetestowane na oficjalnych przykładach (Przykład 8–25).

### Nowa warstwa normalizacji JSON → FA(3)

Generator akceptuje teraz elastyczny format JSON i automatycznie normalizuje dane do wewnętrznej struktury FA(3). Obsługiwane mapowania:

**Podmioty (seller/buyer/thirdParties):**
- Adresy: `addressLine1/addressLine2/countryCode` → zagnieżdżony obiekt `address: { countryCode, line1, line2 }`
- Kontakt: `contact: { email, phone }` → płaskie pola `email`, `phone`
- Identyfikatory: `clientNumber` → `customerNumber`, `taxId` → `idNumber`, `brakId` → `noId`, `vatPrefix` → `prefixVatUE`
- VAT UE: `vatUE: { countryCode, vatNumber }` → płaskie `countryCodeUE` + `vatUE`
- JST/GV: `jst: 1|2` → `isJstSubordinate`, `gv: 1|2` → `isVatGroupMember`
- Podmiot trzeci: `sharePercent` → `share` (Udzial)

**Pozycje faktury (items):**
- Flagi `_noNetAmount`, `_noVatRate`, `_noVatAmount`, `_noQuantity` — śledzenie co było jawnie w JSON; pola domyślne z kalkulatora nie są emitowane do XML gdy nie były w oryginale
- `deliveryDate` → `saleDate` (P_6A per wiersz)
- `uuId` → `uuid` (UU_ID) — opcjonalne, bez auto-generowania
- Automatyczna numeracja wierszy z obsługą par korygujących (beforeCorrection + after dzielą numer)
- Faktury uproszczone (UPR): `_simplified` — FaWiersz zawiera tylko NrWierszaFa, P_7 i opcjonalnie P_12

**Adnotacje (annotations):**
- Spłaszczanie zagnieżdżonych obiektów: `pMarzy: { p_pMarzy, p_pMarzy_3_1 }` → płaskie pola
- Analogicznie: `zwolnienie: { p_19n }`, `noweSrodkiTransportu: { p_22n }`
- Auto-detekcja marży: gdy `p_pMarzy=1`, itemy bez vatRate dostają `vatRate='marza'`

**Płatności (payment):**
- `bankAccountFactor` / `factorBankAccount` → `factorAccounts[]` (RachunekBankowyFaktora)
- `bankAccount.accountDescription` → `description` (OpisRachunku)
- `dueDates: string[]` → `Fa3DueDate[]` (TerminPlatnosci)
- `partialPayment` → `partialPayments[]` (ZaplataCzesciowa)
- `termDescription` → `dueDateDescription` (TerminOpis: count→quantity, event→startEvent)

**Totale (totals):**
- `totals: { P_13_1, P_14_1, P_15, ... }` → automatyczna konwersja na `vatSummary` + `summary`
- `P_14_xW` → `vatAmountPLN` (kwoty VAT przeliczone na PLN)
- `P_15ZK` → `amountBeforeCorrection` (kwota przed korektą)
- User-provided totals mają priorytet nad kalkulowanymi

**Zamówienia (order):**
- `uuId` → `uuid` (UU_IDZ) — opcjonalne
- Automatyczna numeracja z parami korygującymi (jak dla items)

**Warunki transakcji (transactionConditions):**
- `batchNumber` → `batchNumbers[]`
- `deliveryConditions` → `deliveryTerms`
- `orders[].orderDate` → `date`, `orders[].orderNumber` → `number`
- `transport` (single) → `transport[]` (array)
- `shipFrom` → `fromAddress`, `shipTo` → `toAddress`
- `cargoDescription` (numeric) → `cargoType` (OpisLadunku)

**Pozostałe normalizacje:**
- `billingPeriod: { from, to }` → `saleDateRange` (OkresFa)
- `correctedPeriod` → `correctedInvoicePeriod`
- `additionalDescription` → `additionalInfo` (DodatkowyOpis)
- `wz` (string|string[]) → `deliveryNotes[]`
- Stopka: `{ info: string, krs, regon, bdo }` → `{ info: [{ text }], registries: [{ krs, regon, bdo }] }`

### Załączniki (Zalacznik)

- `attachment.dataBlock` → `blocks[]` (BlokDanych)
- Tabele: `columns` → `header`, `tableMetadata` → `metadata[]`
- Puste komórki w wierszach (`WKom`) emitowane jako `<WKom/>` (zachowanie kolumn)
- Puste komórki w sumach (`SKom`) pomijane (tylko wartości z treścią)

### Kalkulator

- Obsługa pozycji `beforeCorrection` w vatSummary (odejmowanie z sign -1)
- Flaga `_emitBreakdown` — P_11A/P_11Vat emitowane tylko dla marży, OSS i cen brutto
- Formatowanie kwot: usunięcie zbędnych `.00` (np. `100.00` → `100`)

### Buildery

- `BuyerBuilder`: obsługa GLN w adresie, NrKlienta
- `SellerBuilder`: obsługa PrefiksPodatnika (vatPrefix)
- `InvoiceItemBuilder`: warunkowa emisja P_8B, P_11, P_11A, P_11Vat, P_12 na podstawie flag `_no*`
- `PaymentBuilder`: pomijanie TerminPlatnosci gdy faktura opłacona (`paid=true`)
- Wszystkie buildery: ujednolicone formatowanie kwot (bez `.00`)

### Testy

- Dodanie zestawu testów jednostkowych opartych na oficjalnych przykładowych plikach dla struktury logicznej FA(3) z Ministerstwa Finansów (Przykład 8–25)
- Konfiguracja Jest z osobnym `tsconfig.test.json`

## 2.5.0

- Gruntowna refaktoryzacja całego codebase (70 plików, 3200+ zmian)
- Przepisanie README — pełna dokumentacja API z sygnaturami, typami i przykładami
- Domyślne środowisko zmienione z `"production"` na `"test"`
- Dodanie pliku CONTEXT.md z opisem architektury dla LLM-ów
- Refaktoryzacja typów FA(3) — split na osobne pliki (party, item, header, payment, ...)
- Ekstrakcja helpera `xml-extract.utils.ts`
- Ekstrakcja loggera do `src/utils/logger.ts`
- Refaktoryzacja modułów: auth, crypto, session, retrieval, builders, validators
- Ulepszenie eksportów i struktury indeksów

## 2.0.1

- `KSefInvoiceGenerator` — generowanie XML faktur FA(3) z obiektu JSON
- `generateQRCodeFromXml` — offline generowanie kodów QR (bez sesji KSeF)
- `getInvoices` — pobieranie listy faktur z paginacją i deduplikacją
- Refaktoryzacja klienta HTTP i obsługi błędów

## 1.0.0

- Uwierzytelnianie certyfikatem (XAdES)
- `sendInvoice` — wysyłka faktur z opcjonalnym UPO i QR
- `downloadInvoice` — pobieranie faktur po numerze KSeF
- `getInvoiceUpo` — pobieranie UPO
- `getInvoiceQRCode` — generowanie kodów QR (online)
