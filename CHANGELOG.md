# Changelog

## 2.0.2 (w przygotowaniu)

- Przepisanie README — pełna dokumentacja API z sygnaturami, typami i przykładami
- Domyślne środowisko zmienione z `"production"` na `"test"`
- Dodanie pliku CONTEXT.md z opisem architektury dla LLM-ów
- Refaktoryzacja typów FA(3) — split na osobne pliki (party, item, header, payment, ...)
- Ekstrakcja helpera `xml-extract.utils.ts`
- Ekstrakcja loggera do `src/utils/logger.ts`

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
