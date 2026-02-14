import { createHash } from 'crypto';

export function extractSellerNip(xml: string): string {
  const podmiot1Match = xml.match(/<Podmiot1[\s\S]*?<NIP>(\d{10})<\/NIP>/);
  if (podmiot1Match?.[1]) {
    return podmiot1Match[1];
  }
  const anyNipMatch = xml.match(/<NIP>(\d{10})<\/NIP>/);
  if (anyNipMatch?.[1]) {
    return anyNipMatch[1];
  }
  throw new Error("Cannot extract seller NIP from XML");
}

export function extractIssueDate(xml: string): string {
  const match = xml.match(/<P_1>([^<]+)<\/P_1>/);
  const raw = match?.[1]?.trim();
  if (!raw) {
    throw new Error("Cannot extract issue date (P_1) from XML");
  }

  const isoDatePart = raw.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(isoDatePart)) {
    return isoDatePart;
  }
  return raw;
}

export function formatDateForQr(dateStr: string): string {
  const s = String(dateStr).trim();
  if (/^\d{2}-\d{2}-\d{4}$/.test(s)) {
    return s;
  }
  const isoDatePart = s.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(isoDatePart)) {
    const [yyyy, mm, dd] = isoDatePart.split("-");
    return `${dd}-${mm}-${yyyy}`;
  }
  throw new Error(`Unsupported date format: "${s}"`);
}

export function computeSha256Base64Url(xml: string): string {
  try {
    return createHash("sha256").update(Buffer.from(xml, "utf8")).digest("base64url");
  } catch {
    const b64 = createHash("sha256").update(Buffer.from(xml, "utf8")).digest("base64");
    return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  }
}
