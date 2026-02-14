import { DOMParser } from '@xmldom/xmldom';
import { C14nCanonicalization, ExclusiveCanonicalization } from 'xml-crypto';

/**
 * Exclusive C14N - używane przez KSeF dla wszystkich referencji
 */
export function exclusiveCanonicalize(xmlString: string): string {
  const doc = new DOMParser().parseFromString(xmlString, 'text/xml');
  const c14n = new ExclusiveCanonicalization();
  return c14n.process(doc.documentElement as any, {});
}

/**
 * Exclusive C14N dla node
 */
export function exclusiveCanonicalizeNode(node: any): string {
  const c14n = new ExclusiveCanonicalization();
  return c14n.process(node, {});
}

/**
 * Zwykła C14N dla SignedInfo
 */
export function canonicalizeNode(node: any): string {
  const c14n = new C14nCanonicalization();
  return c14n.process(node, {});
}
