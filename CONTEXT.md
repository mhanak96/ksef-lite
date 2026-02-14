# CONTEXT.md

Kontekst architektoniczny projektu KSeF Lite — dla modeli LLM i nowych kontrybutorów.

## Cel projektu

Nieoficjalna, lekka biblioteka TypeScript do integracji z polskim KSeF (Krajowy System e-Faktur). Pokrywa wyłącznie najczęściej potrzebne operacje: uwierzytelnianie certyfikatem, wysyłkę/pobieranie faktur, generowanie QR i UPO.

## Architektura modułów

```
src/
├── client/                     # Klient KSeF API
│   ├── ksef.client.ts          # Główna klasa KSefClient — orchestracja
│   ├── xml-extract.utils.ts    # Ekstrakcja danych z XML (NIP, data, hash)
│   ├── http.client.ts          # HTTP wrapper
│   ├── auth/                   # Autentykacja
│   │   ├── auth.service.ts     # AuthService — flow uwierzytelniania
│   │   ├── challenge.service.ts# ChallengeService — żądanie challenge
│   │   └── session/            # Zarządzanie sesją
│   │       ├── session.manager.ts    # SessionManager — open/close/send
│   │       └── encryption.service.ts # Szyfrowanie AES/RSA dla sesji
│   ├── crypto/                 # Warstwa kryptograficzna
│   │   ├── aes.crypto.ts       # AES szyfrowanie symetryczne
│   │   ├── hash.utils.ts       # SHA256 hashing
│   │   └── xades/              # Podpisy XAdES
│   │       ├── xades-signer.ts       # Podpisywanie XAdES
│   │       ├── certificate.utils.ts  # Parsowanie certyfikatów
│   │       └── signature-conversion.ts # Konwersja podpisów
│   ├── retrieval/              # Pobieranie danych z KSeF
│   │   ├── invoice/            # Faktury, UPO
│   │   └── qr/                 # Generowanie kodów QR
│   └── types/                  # Typy konfiguracji i HTTP
│       ├── config.types.ts     # KSefClientConfig, URLe środowisk
│       ├── http.types.ts       # Typy HTTP
│       └── ksef-client.types.ts# Typy publiczne klienta (SendInvoiceResult itp.)
│
├── invoices/                   # Generowanie faktur XML
│   ├── KsefInvoiceGenerator.ts # Wrapper delegujący do FA3
│   └── fa3/                    # Generator faktur FA(3)
│       ├── generators/
│       │   └── FA3InvoiceGenerator.ts # Główny generator
│       ├── builders/           # Modularni builderzy XML
│       │   ├── header.builder.ts
│       │   ├── subject.builder.ts
│       │   ├── fa-section.builder.ts
│       │   ├── payment.builder.ts
│       │   ├── correction.builder.ts
│       │   └── ...
│       ├── calculator/         # Kalkulacja VAT i sum
│       └── types/              # Typy FA3 (podzielone domenowo)
│           ├── index.ts        # Barrel re-export
│           ├── address.types.ts
│           ├── party.types.ts
│           ├── item.types.ts
│           ├── invoice.types.ts
│           └── ...
│
└── utils/
    └── logger.ts               # Debug logging
```

## Flow uwierzytelniania

1. **Challenge request** — `ChallengeService` wysyła żądanie do KSeF, otrzymuje `challenge` (losowy ciąg) i `timestamp`
2. **XAdES signing** — Challenge jest podpisywany certyfikatem użytkownika (podpis XAdES-BES z canonicalizacją exclusive C14N)
3. **Auth request** — Podpisany challenge wysyłany do KSeF jako żądanie autoryzacji
4. **Polling** — `AuthService` polluje status autoryzacji (max 8 prób, 3s przerwy)
5. **Token** — Po zatwierdzeniu, KSeF zwraca `accessToken` używany w kolejnych żądaniach

## Flow wysyłki faktury

1. **Autentykacja** — j.w. (jeśli jeszcze nie uwierzytelniony)
2. **Open session** — `SessionManager` otwiera sesję interaktywną, pobiera klucz publiczny KSeF
3. **Szyfrowanie** — Generowany jest klucz AES, faktura XML szyfrowana AES-256-CBC, klucz AES zawijany RSA kluczem publicznym KSeF
4. **Send** — Zaszyfrowana faktura wysyłana do sesji
5. **Close session** — Zamknięcie sesji
6. **Poll status** — Polling statusu sesji aż do terminowego (sukces/błąd)
7. **Fetch metadata** — Pobranie numeru KSeF faktury
8. **Opcjonalnie** — UPO i/lub QR code

## Builder pattern FA3

1. `FA3InvoiceGenerator.generate(input)` — normalizacja danych wejściowych
2. `InvoiceCalculator` — obliczanie VAT, sum netto/brutto, zaokrąglanie
3. `Fa3BuildContext` — kontekst budowania, zbiera błędy walidacji
4. Modularni builderzy (`HeaderBuilder`, `SubjectBuilder`, `FaSectionBuilder`, `PaymentBuilder`, `CorrectionBuilder` itd.) — każdy odpowiada za swoją sekcję XML
5. Wynik: `{ xml, issues }` — gotowy XML + lista problemów walidacyjnych

## Kluczowe decyzje

- **Tylko certyfikat** — tokeny mają być wycofane przez KSeF do końca 2026, dlatego biblioteka ich nie wspiera
- **Tylko backend (Node.js)** — operacje kryptograficzne wymagają Node.js `crypto` API
- **Trzy tryby**: `"test"`, `"demo"`, `"production"` — domyślnie `"production"`
- **Polling z retries** — domyślnie max 8 prób, 3s przerwy; terminalne kody HTTP: 400, 401, 403, 404, 409, 422, 500
- **Walidacja kolekcjonowana** — błędy zbierane podczas budowania XML (nie rzucane natychmiast)

## Zależności produkcyjne

| Paczka | Cel |
|--------|-----|
| `@xmldom/xmldom` | Parsowanie i serializacja XML DOM |
| `qrcode` | Generowanie QR code jako PNG |
| `xml-crypto` | Podpisy XAdES (canonicalizacja, weryfikacja) |

## Publiczne API

Eksportowane z `src/client/index.ts`:
- `KSefClient` — główna klasa klienta
- `KSefInvoiceGenerator` — generator faktur XML z JSON
- `generateKSefInvoiceQRCode` — standalone generowanie QR
- Wszystkie powiązane typy (`KSefClientConfig`, `SendInvoiceResult`, `Fa3Invoice`, `Fa3InvoiceInput` itd.)
