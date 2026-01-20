# KSeF Lite

Nieoficjalna, lekka biblioteka TypeScript/JavaScript do integracji z KSeF, stanowiąca produkcyjną bazę do rozbudowy, ponieważ w praktyce większość integracji z KSeF potrzebuje tylko kilku najważniejszych operacji.

Założenia:

- Tylko to, co naprawdę potrzebne w typowych wdrożeniach.
- Czytelny kod i typy → łatwo dopisać kolejne endpointy/flow.
- Biblioteka jest nastawiona na uwierzytelnianie certyfikatem (tokeny mają być wycofane do końca 2026 r.).
- Jak potrzebujesz czgoś bardziej zaawansowanego to sobie dobudujesz (patrz. plik CONTEXT.MD dla modeli LLM).

## Aktualne funkcjonalności

- ✅ Uwierzytelnianie użytkownika do KSeF przy pomocy certyfikatu
- ✅ Wysyłka faktur w formacie XML FA(3) do KSeF
- ✅ Pobieranie UPO
- ✅ Generowanie kodów QR dla faktur
- ✅ Pobieranie listy dostępnych faktur z KSeF

## TODO

- ⏳ `KsefInvoiceGenerator()` — generowanie XML faktury z JSON-a
- ⏳ `KsefParser()` — parsowanie XML faktury na obiekt JSON

## Instalacja 

```
npm i ksef-lite
```

## Konfiguracja przy użyciu certyfikatu KSeF

1. Zaloguj się do KSeF i wygeneruj certyfikat (autoryzacja tokenami **nie jest obsługiwana**).
  ![Generowanie certyfikatu w KSeF](./images/certyfikat-strona-ksef.png)

2. Po uzupełnieniu wszystkich wymaganych informacji otrzymasz dwa pliki:
   - `cert.crt` (certyfikat)
   - `cert.key` (klucz prywatny)

3. Plik `.crt` jest gotowy do użycia, natomiast plik `.key` jest zaszyfrowany hasłem podanym w KSeF i przed użyciem trzeba go odszyfrować do postaci PEM.

  ![Plik .crt](./images/certyfikat.png)

  ![Zaszyfrowany plik .key](./images/klucz-zaszyfrowany.png)

   **macOS / windows / linux:**
```bash
   openssl rsa -in cert.key -out cert-decrypted.key
```

4. Otwórz plik `.crt` oraz odszyfrowany klucz (`cert-decrypted.key`) w edytorze (np. VS Code), skopiuj ich zawartość i wklej do `.env` jako wartości zmiennych środowiskowych:

```env
   KSEF_CERT=-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----
   KSEF_KEY=-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----
```

## Przykłady użycia

> Przykłady zakładają użycie certyfikatu i klucza z `.env`

### Uwierzytelnianie w KSeF 

> **Ważne (założenia biblioteki):**
> - `ksef-lite` jest nastawiony na **uwierzytelnianie certyfikatem** (PEM).  
> - **Tokeny nie są wspierane** (i nie planujemy ich dodawać — to celowe, zgodne z filozofią „lite”).
> - To jest biblioteka **backendowa** (Node.js / serverless). Nie wkładaj certyfikatu/klucza do frontendu.
> - Certyfikat i klucz trzymaj w **zmiennych środowiskowych / sekretach** (np. Secret Manager), nie w repo.


```js
const { KSefClient } = require("ksef-lite");

const client = new KSefClient({
  mode, // "test" | "production"
  contextNip,
  certificate,
  privateKey,
  debug: "test",
});
```
Gdzie:
- mode: środowisko testowe lub produkcyjne (domyślnie testowe). 
- contextNip: numer NIP podmiotu, na który wystawiono certyfikat w KSeF
- certificate - certyfikat (zawartośc pliku .crt)
- privateKey (zawartośc ODSZYFROWANEGO pliku .key)
- debug - szczegółowość logowania całego procesu (TODO)

### Wysyłanie faktury do KSeF

```js
const { KSefClient } = require("ksef-lite");

(async () => {
  const client = new KSefClient({
    mode, // "test" | "production"
    contextNip,
    certificate,
    privateKey,
    debug: "test",
  });

  // Twój plik z fakturą w formacie FA(3) - przykłady link w FAQ
  const invoiceXml = "";

  const result = await client.sendInvoice(invoiceXml, {
    upo: true, // czy odpowiedź ma zawierać UPO dla przesłanej faktury
    qr: true,  // czy odpowiedź ma zawierać kod QR przesłanej faktury
  });

  console.log(result);
})().catch(console.error);
```


Format odpowiedzi:

```json
{
  "status": 200,
  "invoiceKsefNumber": "<KSEF_NUMBER>",
  "invoiceReferenceNumber": "<INVOICE_REF_NUMBER>",
  "sessionReferenceNumber": "<SESSION_REF_NUMBER>",
  "invoiceHash": "<INVOICE_HASH_BASE64>",
  "invoiceSize": 2340,
  "meta": {
    "sellerNip": "<SELLER_NIP>",
    "issueDate": "2026-01-20",
    "invoiceHashBase64Url": "<INVOICE_HASH_BASE64URL>",
    "qrVerificationUrl": "<QR_VERIFICATION_URL>"
  },
  "upo": {
    "xml": "<UPO_XML>",
    "sha256Base64": "<UPO_SHA256_BASE64>"
  },
  "qrCode": {
    "pngBase64": "<QR_PNG_BASE64>",
    "label": "<KSEF_NUMBER>"
  }
}

```

### Pobieranie UPO 

```js
const { KSefClient } = require("ksef-lite");

(async () => {
  const client = new KSefClient({
    mode, // "test" | "production"
    contextNip,
    certificate,
    privateKey,
    debug: "test",
  });

  const upo = await client.getInvoiceUpo(KSEF_SESSION_REFERENCE_NUMBER); 
  // numer sesji w KSeF (patrz wysyłanie faktur) - nie pomyl z resztą numerów!

  console.log(upo);
})().catch(console.error);
```

Format odpowiedzi:

```json
{
  "invoiceReferenceNumber": "<INVOICE_REF_NUMBER>",
  "ksefNumber": "<KSEF_NUMBER>",
  "upoDownloadUrlExpirationDate": "2026-01-23T21:19:09.476Z",
  "xml": "<UPO_XML>",
  "sha256Base64": "<UPO_SHA256_BASE64>"
};

```

### Generowanie QR kodu dla faktury 

```js
const { KSefClient } = require("ksef-lite");

// Generowanie przy pomocy paczki qrcode (można użyć jej ustawień)
const HARD_CODED = {
  options: {
    pixelsPerModule: 5,
    margin: 1,
    errorCorrectionLevel: "M",
    includeDataUrl: true,
    labelUsesKsefNumber: true,
  },
};

(async () => {
  const client = new KSefClient({
    mode, // "test" | "production"
    contextNip,
    certificate,
    privateKey,
    debug: "test",
  });

  const qr = await client.getInvoiceQRCode(ksefNumber, HARD_CODED.options || {});
  console.log(qr);
})().catch(console.error);
```
Format odpowiedzi:

```json
{
  "url": "https://qr-test.ksef.mf.gov.pl/invoice...",
  "qrPngBase64": "iVBORw0KGgoAAAANSUhEUgAAANcAAADXCAYAAACJfcS1AAAAAklEQVR4AewaftIAAAmASURBVO3B...",
  "qrDataUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAANcAAADXCAYAAACJfcS1AAAAAklEQVR4AewaftIAAAmASURBVO3B...",
  "label": "7812...",
  "meta": {
    "sellerNip": "...",
    "issueDateRaw": "2026-01-17",
    "issueDateForQr": "17-01-2026",
    "invoiceHashBase64Url": "...",
    "qrBaseUrl": "https://qr-test.ksef.mf.gov.pl"
  }
}

```

### Pobieranie faktury 

```js
const { KSefClient } = require("ksef-lite");

(async () => {
  const client = new KSefClient({
    mode, // "test" | "production"
    contextNip,
    certificate,
    privateKey,
    debug: "test",
  });

  const invoice = await client.downloadInvoice(ksefNumber);
  console.log(invoice);
})().catch(console.error);
```

```json
{
  "xml": "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<Faktura xmlns:etd=\"...\" xmlns:xsi=\"...\" xmlns=\"...\">\n...\n</Faktura>",
  "sha256Base64": "OYbwcHG8xBEjAqDEO6CjsW9RfncaQVPtHesVzuJwipU="
}

```

### Pobieranie listy faktur 

```js
const { KSefClient } = require("ksef-lite");

const query = {
  subjectType: "Subject1", // sprzedawca
  dateRange: {
    dateType: "PermanentStorage",
    from: "2026-01-01T00:00:00.000Z", // data początkowa
    to: "2026-01-20T00:00:00.000Z",   // data końcowa
    restrictToPermanentStorageHwmDate: true,
  },
};

const opts = {
  sortOrder: "Asc",
  pageSize: 250,
  timeoutMs: 20000,
  maxRequests: 2000,
  dedupe: true,
};

(async () => {
  const client = new KSefClient({
    mode, // "test" | "production"
    contextNip,
    certificate,
    privateKey,
    debug: "test",
  });

  const result = await client.getInvoices(query, opts);
  console.log(result);
})().catch(console.error);
```

Format odpowiedzi:

```json

{
  "invoices": [
    {
      "ksefNumber": "<KSEF_NUMBER_1>",
      "invoiceNumber": "<INVOICE_NO_1>",
      "issueDate": "2026-01-07",
      "seller": { "nip": "<NIP_SELLER>", "name": "<SELLER_NAME>" },
      "buyer": { "identifier": { "type": "Nip", "value": "<NIP_BUYER>" }, "name": "<BUYER_NAME>" },
      "netAmount": 100,
      "vatAmount": 23,
      "grossAmount": 123,
      "currency": "PLN",
      "invoicingMode": "Online",
      "invoiceType": "Vat",
      "invoiceHash": "<HASH_1>"
    },
    {
      "ksefNumber": "<KSEF_NUMBER_2>",
      "invoiceNumber": "<INVOICE_NO_2>",
      "issueDate": "2026-01-09",
      "seller": { "nip": "<NIP_SELLER>", "name": "<SELLER_NAME>" },
      "buyer": { "identifier": { "type": "Nip", "value": "<NIP_BUYER>" }, "name": "<BUYER_NAME>" },
      "netAmount": 1000,
      "vatAmount": 230,
      "grossAmount": 1230,
      "currency": "PLN",
      "invoicingMode": "Online",
      "invoiceType": "Vat",
      "invoiceHash": "<HASH_2>",
      "thirdSubjects": [
        { "identifier": { "type": "Nip", "value": "<NIP_PAYER>" }, "name": "<PAYER_NAME>", "role": 1 },
        { "identifier": { "type": "Nip", "value": "<NIP_RECEIVER>" }, "name": "<RECEIVER_NAME>", "role": 2 }
      ]
    }
  ],
  "permanentStorageHwmDate": "2026-01-20T00:00:00+00:00",
  "stats": { "requests": 1, "pages": 1 },
  "cursor": {
    "sortOrder": "Asc",
    "pageSize": 250,
    "pageOffset": 0,
    "dateRange": {
      "dateType": "PermanentStorage",
      "from": "2026-01-01T00:00:00.000Z",
      "to": "2026-01-20T00:00:00.000Z",
      "restrictToPermanentStorageHwmDate": true
    }
  }
}

```
## FAQ

**1. Dlaczego dodawanie faktury wyrzuca błąd?**  
Najczęściej dlatego, że próbujesz wysłać **drugą identyczną fakturę**. W KSeF nie mogą istnieć dwie faktury o tym samym numerze, więc upewnij się, że nie wrzucasz jej ponownie.

**2. Gdzie znajdę więcej informacji o strukturze XML faktury (FA(3))?**  
Oficjalne materiały i przykłady znajdziesz na stronie KAS:  
https://www.gov.pl/web/kas/krajowy-system-e-faktur

Schemy XML i dokumentacja techniczna są też w oficjalnym repozytorium KSeF API na GitHubie:
https://github.com/CIRFMF/ksef-docs   

PS. Pracuję też nad funkcją, która pozwoli generować XML FA(3) z JSON-a (`KsefInvoiceGenerator()`).

**3. Gdzie znajdę kod źródłowy?**  
Tutaj 👉 https://github.com/mhanak96/ksef-lite  
Możesz obserwować repo, zgłaszać uwagi i wrzucać issue - im więcej feedbacku, tym lepiej.

**4. Czy polecasz jakąś muzykę dobrze oddającą współpracę z API KSeF?**  
Tak. Pixies – Where Is My Mind? 🤯  

## Licencja

MIT

## Kontrybucja

Zachęcam do kontrybucji, ale założeniem projektu jest praktyczność i minimalizm: rozwijamy wyłącznie te funkcjonalności, które są realnie niezbędne w typowych wdrożeniach KSeF, bez wspierania rozwiązań „wstecz” (tokenów oraz formatu FA(2)).
