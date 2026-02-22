# KSeF Lite

Nieoficjalna, lekka biblioteka TypeScript/JavaScript do integracji z polskim KSeF (Krajowy System e-Faktur).

**Kluczowe cechy:**

- Uwierzytelnianie wyłącznie certyfikatem (tokeny mają być wycofane do końca 2026 r.)
- Biblioteka backendowa — wymaga Node.js >= 18
- Tylko 3 zależności produkcyjne: `@xmldom/xmldom`, `qrcode`, `xml-crypto`
- Generowanie XML faktur FA(3) z JSON-a (`KSefInvoiceGenerator`)

## Funkcjonalności

- Uwierzytelnianie użytkownika do KSeF przy pomocy certyfikatu
- Wysyłka faktur w formacie XML FA(3) do KSeF
- Pobieranie faktur z KSeF
- Pobieranie UPO (Urzędowe Poświadczenie Odbioru)
- Generowanie kodów QR dla faktur (online i offline)
- Pobieranie listy faktur z KSeF (z paginacją i deduplikacją)
- Generowanie XML faktur FA(3) z obiektu JSON (`KSefInvoiceGenerator`)

## TODO

- `KsefParser()` — parsowanie XML faktury na obiekt JSON

## Instalacja

```
npm i ksef-lite
```

## Konfiguracja certyfikatu KSeF

1. Zaloguj się do KSeF i wygeneruj certyfikat (autoryzacja tokenami **nie jest obsługiwana**).
   ![Generowanie certyfikatu w KSeF](./images/certyfikat-strona-ksef.png)

2. Po uzupełnieniu wszystkich wymaganych informacji otrzymasz dwa pliki:
   - `cert.crt` (certyfikat)
   - `cert.key` (klucz prywatny)

3. Plik `.crt` jest gotowy do użycia, natomiast plik `.key` jest zaszyfrowany hasłem podanym w KSeF i przed użyciem trzeba go odszyfrować do postaci PEM.

   ![Plik .crt](./images/certyfikat.png)

   ![Zaszyfrowany plik .key](./images/klucz-zaszyfrowany.png)

   **macOS / Windows / Linux:**
```bash
openssl pkey -in cert.key -passin pass:HASLO -out cert-decrypted.key -traditional
```
   > **Uwaga:** W haśle do certyfikatu unikaj znaków specjalnych bash (np. `!`, `$`, `\`, `` ` ``). Ze znaków specjalnych bezpiecznie jest używać tylko podkreślnik `_`. W przeciwnym razie mogą wystąpić problemy z dekodowaniem klucza prywatnego. Komenda działa dla OpenSSL 1.1.1T i nowszych.

4. Otwórz plik `.crt` oraz odszyfrowany klucz (`cert-decrypted.key`) w edytorze, skopiuj ich zawartość i wklej do `.env`:

```env
KSEF_CERT=-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----
KSEF_KEY=-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----
```

## Szybki start

```ts
const { KSefClient } = require("ksef-lite");

const client = new KSefClient({
  mode: "test",
  contextNip: "7812345678",
  certificate: process.env.KSEF_CERT,
  privateKey: process.env.KSEF_KEY,
});

// Wysyłka faktury z UPO i kodem QR
const result = await client.sendInvoice(invoiceXml, { upo: true, qr: true });
console.log(result.invoiceKsefNumber); // numer KSeF
```

## API Reference

### `KSefClient`

Główna klasa biblioteki. Orkiestruje uwierzytelnianie, sesje, wysyłkę/pobieranie faktur, UPO i kody QR.

#### `constructor(config)`

```ts
new KSefClient(config: KSefClientConfigWithCrypto)
```

| Parametr | Typ | Wymagany | Opis |
|---|---|---|---|
| `mode` | `"production" \| "test" \| "demo"` | Nie | Środowisko KSeF. Domyślnie `"test"` |
| `contextNip` | `string` | Tak | NIP podmiotu (10 cyfr) |
| `certificate` | `string` | Tak | Certyfikat w formacie PEM (zawartość pliku `.crt`) |
| `privateKey` | `string` | Tak | Odszyfrowany klucz prywatny w formacie PEM |
| `subjectIdentifierType` | `"certificateSubject" \| "certificateFingerprint"` | Nie | Typ identyfikatora. Domyślnie `"certificateSubject"` |
| `debug` | `boolean` | Nie | Włącza szczegółowe logowanie. Domyślnie `false` |
| `crypto` | `KSefCryptoOperations` | Nie | Własna implementacja operacji kryptograficznych |

```ts
const client = new KSefClient({
  mode: "test",
  contextNip: "7812345678",
  certificate: process.env.KSEF_CERT,
  privateKey: process.env.KSEF_KEY,
  debug: true,
});
```

---

#### `sendInvoice(invoiceXml, options?)`

Wysyła fakturę XML do KSeF. Automatycznie uwierzytelnia się, otwiera sesję, wysyła fakturę i zamyka sesję.

```ts
async sendInvoice(invoiceXml: string, options?: SendInvoiceOptions): Promise<SendInvoiceResult>
```

**`SendInvoiceOptions`**

| Parametr | Typ | Domyślnie | Opis |
|---|---|---|---|
| `upo` | `boolean` | `false` | Pobrać UPO po wysyłce |
| `qr` | `boolean` | `false` | Wygenerować kod QR po wysyłce |

**`SendInvoiceResult`**

```ts
{
  status: number;                    // 200 = sukces, 4xx/5xx = błąd
  error?: string;                    // opis błędu (tylko przy błędzie)
  invoiceKsefNumber: string | null;  // numer KSeF faktury
  invoiceReferenceNumber: string;    // numer referencyjny faktury
  sessionReferenceNumber: string;    // numer referencyjny sesji
  invoiceHash: string;               // hash faktury (base64)
  invoiceSize: number;               // rozmiar faktury w bajtach
  meta: {
    sellerNip: string;
    issueDate: string;
    invoiceHashBase64Url: string;
    qrVerificationUrl: string;
  };
  upo?: { xml: string; sha256Base64?: string };       // tylko gdy upo=true
  qrCode?: { pngBase64: string; label: string };      // tylko gdy qr=true
}
```

```ts
const result = await client.sendInvoice(invoiceXml, { upo: true, qr: true });
console.log(result.invoiceKsefNumber);
console.log(result.upo?.xml);
```

---

#### `downloadInvoice(ksefNumber, options?)`

Pobiera fakturę z KSeF po numerze KSeF.

```ts
async downloadInvoice(ksefNumber: string, options?: DownloadInvoiceOptions): Promise<DownloadedInvoice>
```

**`DownloadInvoiceOptions`**

| Parametr | Typ | Opis |
|---|---|---|
| `timeoutMs` | `number` | Timeout żądania HTTP (ms) |

**`DownloadedInvoice`**

```ts
{
  xml: string;            // pełny XML faktury
  sha256Base64?: string;  // hash SHA256 (base64)
}
```

```ts
const invoice = await client.downloadInvoice("1234567890-20260120-ABCDEF-12");
console.log(invoice.xml);
```

---

#### `getInvoiceUpo(sessionReferenceNumber, options?)`

Pobiera UPO (Urzędowe Poświadczenie Odbioru) dla sesji.

```ts
async getInvoiceUpo(sessionReferenceNumber: string, options?: GetInvoiceUpoOptions): Promise<InvoiceUpoResult>
```

**`GetInvoiceUpoOptions`**

| Parametr | Typ | Opis |
|---|---|---|
| `pollingDelayMs` | `number` | Opóźnienie między kolejnymi próbami pollingu |
| `timeoutMs` | `number` | Maksymalny czas oczekiwania na UPO |
| `apiTimeoutMs` | `number` | Timeout żądania API |
| `downloadTimeoutMs` | `number` | Timeout pobierania pliku UPO |

**`InvoiceUpoResult`**

```ts
{
  invoiceReferenceNumber: string;
  ksefNumber: string | null;
  upoDownloadUrlExpirationDate: string | null;
  xml: string;
  sha256Base64?: string;
}
```

```ts
const upo = await client.getInvoiceUpo(sessionReferenceNumber);
console.log(upo.xml);
```

---

#### `getInvoiceQRCode(ksefNumber, options?)`

Generuje kod QR dla faktury (wymaga uwierzytelnienia — pobiera dane z API KSeF).

```ts
async getInvoiceQRCode(ksefNumber: string, options?: GetInvoiceQRCodeOptions): Promise<InvoiceQRCodeResult>
```

**`GetInvoiceQRCodeOptions`**

| Parametr | Typ | Domyślnie | Opis |
|---|---|---|---|
| `pixelsPerModule` | `number` | `5` | Rozmiar piksela modułu QR |
| `margin` | `number` | `1` | Margines kodu QR |
| `errorCorrectionLevel` | `"L" \| "M" \| "Q" \| "H"` | `"M"` | Poziom korekcji błędów |
| `includeDataUrl` | `boolean` | `false` | Dołączyć data URL (`data:image/png;base64,...`) |
| `labelUsesKsefNumber` | `boolean` | `false` | Użyć numeru KSeF jako etykiety |
| `apiTimeoutMs` | `number` | — | Timeout żądania API |

**`InvoiceQRCodeResult`**

```ts
{
  url: string;           // URL weryfikacyjny zakodowany w QR
  qrPngBase64: string;   // obraz PNG jako base64
  qrDataUrl?: string;    // data URL (gdy includeDataUrl=true)
  label: string;         // etykieta (numer KSeF lub "OFFLINE")
  meta: {
    sellerNip: string;
    issueDateRaw: string;
    issueDateForQr: string;
    invoiceHashBase64Url: string;
    qrBaseUrl: string;
  };
}
```

```ts
const qr = await client.getInvoiceQRCode(ksefNumber, {
  includeDataUrl: true,
  errorCorrectionLevel: "H",
});
console.log(qr.qrPngBase64);
```

---

#### `generateQRCodeFromXml(invoiceXml, ksefNumber, options?)`

Generuje kod QR offline — na podstawie XML faktury, bez zapytania do API KSeF. Przydatne gdy masz XML i numer KSeF, ale nie chcesz otwierać sesji.

```ts
async generateQRCodeFromXml(
  invoiceXml: string,
  ksefNumber: string,
  options?: GetInvoiceQRCodeOptions
): Promise<InvoiceQRCodeResult>
```

Parametry `options` i typ wyniku są identyczne jak w `getInvoiceQRCode`.

```ts
const qr = await client.generateQRCodeFromXml(invoiceXml, ksefNumber);
console.log(qr.url);
```

---

#### `getInvoices(query, options?)`

Pobiera listę faktur z KSeF z automatyczną paginacją i opcjonalną deduplikacją.

```ts
async getInvoices(query: GetInvoicesQuery, options?: GetInvoicesOptions): Promise<GetInvoicesResult>
```

**`GetInvoicesQuery`**

| Parametr | Typ | Wymagany | Opis |
|---|---|---|---|
| `subjectType` | `"Subject1" \| "Subject2" \| "Subject3" \| "SubjectAuthorized"` | Tak | Typ podmiotu (Subject1 = sprzedawca, Subject2 = nabywca) |
| `dateRange` | `DateRange` | Tak | Zakres dat (patrz niżej) |
| `invoiceNumber` | `string` | Nie | Filtrowanie po numerze faktury |
| `ksefNumber` | `string` | Nie | Filtrowanie po numerze KSeF |
| `counterpartyNip` | `string` | Nie | Filtrowanie po NIP kontrahenta |

**`DateRange`**

| Parametr | Typ | Wymagany | Opis |
|---|---|---|---|
| `dateType` | `"PermanentStorage" \| "Invoicing" \| "Issue"` | Tak | Typ daty |
| `from` | `string` | Tak | Data początkowa (ISO 8601) |
| `to` | `string` | Nie | Data końcowa (ISO 8601) |

**`GetInvoicesOptions`**

| Parametr | Typ | Domyślnie | Opis |
|---|---|---|---|
| `sortOrder` | `"Asc" \| "Desc"` | `"Asc"` | Kolejność sortowania |
| `pageSize` | `number` | `250` | Rozmiar strony |
| `timeoutMs` | `number` | — | Timeout żądań HTTP |
| `maxRequests` | `number` | — | Maksymalna liczba żądań |
| `dedupe` | `boolean` | `false` | Usuwanie duplikatów |

**`GetInvoicesResult`**

```ts
{
  invoices: Array<Record<string, unknown>>;   // lista faktur
  permanentStorageHwmDate: string | null;     // data high-water mark
  stats: {
    requests: number;
    pages: number;
    windows: number;
    deduped: number;
  };
  cursor: {
    sortOrder: "Asc" | "Desc";
    pageSize: number;
    pageOffset: number;
    dateRange: DateRange;
  };
}
```

```ts
const result = await client.getInvoices({
  subjectType: "Subject1",
  dateRange: {
    dateType: "PermanentStorage",
    from: "2026-01-01T00:00:00.000Z",
    to: "2026-01-31T00:00:00.000Z",
  },
}, { dedupe: true, pageSize: 250 });

console.log(`Znaleziono ${result.invoices.length} faktur`);
```

---

#### `setDebug(debug)` / `isAuthenticated()` / `getConfig()`

Metody pomocnicze:

```ts
client.setDebug(true);                // włącza/wyłącza debug logging
client.isAuthenticated();             // true jeśli klient jest uwierzytelniony
client.getConfig();                   // { mode, baseUrl, apiBaseUrl, contextNip }
```

---

### `KSefInvoiceGenerator`

Generator faktur XML FA(3) z obiektu JSON. Automatycznie oblicza kwoty VAT, sumy i zaokrąglenia.

```ts
const { KSefInvoiceGenerator } = require("ksef-lite");
```

#### `generate(invoice, options?)`

Generuje XML faktury FA(3) z obiektu JSON.

```ts
generate(invoice: Fa3Invoice | Fa3InvoiceInput | string, options?: { version?: "FA3" }): string
```

Przyjmuje obiekt `Fa3Invoice` / `Fa3InvoiceInput` lub JSON string. Zwraca gotowy XML faktury.

```ts
const generator = new KSefInvoiceGenerator();
const xml = generator.generate({
  seller: {
    nip: "7812345678",
    name: "Firma Sp. z o.o.",
    address: { countryCode: "PL", line1: "ul. Testowa 1", line2: "00-001 Warszawa" },
  },
  buyer: {
    nip: "2222222222",
    name: "Klient Sp. z o.o.",
    address: { countryCode: "PL", line1: "ul. Fakturowa 7", line2: "30-001 Kraków" },
  },
  details: {
    invoiceNumber: "FV/2026/01/001",
    issueDate: new Date(),
    currency: "PLN",
    items: [
      {
        description: "Usługa programistyczna",
        quantity: 10,
        unitOfMeasure: "godz.",
        unitPrice: 200,
        vatRate: "23",
      },
    ],
  },
});

// xml jest gotowy do wysłania przez client.sendInvoice(xml)
```

#### `createSampleInvoice()`

Statyczna metoda zwracająca przykładowy obiekt `Fa3Invoice` — przydatna do testów.

```ts
const sample = KSefInvoiceGenerator.createSampleInvoice();
const xml = new KSefInvoiceGenerator().generate(sample);
```

---

### `generateKSefInvoiceQRCode`

Niskopoziomowa, standalone funkcja do generowania kodu QR z dowolnego stringa (np. URL weryfikacyjnego).

```ts
import { generateKSefInvoiceQRCode } from "ksef-lite";

async function generateKSefInvoiceQRCode(
  content: string,
  options?: QRGeneratorOptions
): Promise<QRCodeResult>
```

**`QRGeneratorOptions`**

| Parametr | Typ | Domyślnie | Opis |
|---|---|---|---|
| `pixelsPerModule` | `number` | `5` | Rozmiar piksela |
| `margin` | `number` | `1` | Margines |
| `errorCorrectionLevel` | `"L" \| "M" \| "Q" \| "H"` | `"M"` | Poziom korekcji błędów |

**`QRCodeResult`**

```ts
{
  pngBase64: string;  // obraz PNG jako base64
  dataUrl: string;    // data URL gotowy do użycia w <img src="...">
}
```

```ts
const qr = await generateKSefInvoiceQRCode("https://qr.ksef.mf.gov.pl/invoice/...");
console.log(qr.pngBase64);
```

## Zaawansowane

Biblioteka eksportuje również niskopoziomowe klasy i funkcje, które można wykorzystać do budowy własnych integracji:

- `AuthService`, `ChallengeService` — obsługa procesu uwierzytelniania
- `SessionManager` — zarządzanie sesjami KSeF
- `EncryptionService` — szyfrowanie faktur (AES + RSA)
- `HttpClient` — klient HTTP z obsługą błędów i timeoutów
- Funkcje kryptograficzne: `sha256Base64`, `signXmlSimple`, `parseCertificateInfo` i inne

Szczegóły architektury znajdziesz w pliku [CONTEXT.md](./CONTEXT.md).

## Przykłady faktur

Generator był testowany na oficjalnych przykładowych plikach dla struktury logicznej FA(3) udostępnionych przez Ministerstwo Finansów:
https://ksef.podatki.gov.pl/pliki-do-pobrania-ksef-20/

Przetestowane przykłady (26) pokrywają m.in.:
- Faktury VAT, korygujące (KOR), zaliczkowe (ZAL), uproszczone (UPR)
- Procedurę marży, OSS, odwrotne obciążenie
- Faktury z załącznikami (Zalacznik) — np. rozliczenie energii
- Faktury walutowe, z transportem, warunkami transakcji
- Korekty z parami pozycji (StanPrzed)

JSON z fakturami znajdziesz w [invoiceExamples.json](./invoiceExamples.json).

## FAQ

**1. Dlaczego dodawanie faktury wyrzuca błąd?**
Najczęściej dlatego, że próbujesz wysłać **drugą identyczną fakturę**. W KSeF nie mogą istnieć dwie faktury o tym samym numerze, więc upewnij się, że nie wrzucasz jej ponownie.

**2. Gdzie znajdę więcej informacji o strukturze XML faktury (FA(3))?**
Oficjalne materiały i przykłady znajdziesz na stronie KAS:
https://www.gov.pl/web/kas/krajowy-system-e-faktur

Schemy XML i dokumentacja techniczna są też w oficjalnym repozytorium KSeF API na GitHubie:
https://github.com/CIRFMF/ksef-docs

**3. Dlaczego faktura w KSeF ma status "offline"?**
Faktura przesłana do KSeF otrzymuje status offline gdy data wystawienia (`P_1`) nie przypada na ten sam dzień co moment przesłania do systemu. To normalne zachowanie — faktura jest poprawna i przyjęta, ale KSeF traktuje ją jako wystawioną poza systemem. Aby faktura miała status online, data wystawienia musi być taka sama jak data wysyłki do KSeF.

**4. Gdzie znajdę kod źródłowy?**
https://github.com/mhanak96/ksef-lite
Możesz obserwować repo, zgłaszać uwagi i wrzucać issue — im więcej feedbacku, tym lepiej.

**5. Czy polecasz jakąś muzykę dobrze oddającą współpracę z API KSeF?**
Tak. Pixies – Where Is My Mind?

## Changelog

Pełna historia zmian: [CHANGELOG.md](./CHANGELOG.md)

## Licencja

MIT

## Kontrybucja

Zachęcam do kontrybucji, ale założeniem projektu jest praktyczność i minimalizm: rozwijamy wyłącznie te funkcjonalności, które są realnie niezbędne w typowych wdrożeniach KSeF, bez wspierania rozwiązań „wstecz" (tokenów oraz formatu FA(2)).
