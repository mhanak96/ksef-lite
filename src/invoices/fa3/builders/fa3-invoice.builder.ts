import { HeaderBuilder } from './header/header.builder';
import { SellerBuilder } from './parties/seller.builder';
import { BuyerBuilder } from './parties/buyer.builder';
import { ThirdPartyBuilder } from './parties/third-party.builder';
import { AuthorizedEntityBuilder } from './parties/authorized-entity.builder';
import { FaSectionBuilder } from './fa/fa-section.builder';
import { FooterBuilder } from './footer/footer.builder';
import { AttachmentBuilder } from './attachment/attachment.builder';

import type { Fa3Invoice } from '../types';
import type { Fa3BuildContext } from '../validators/build-context';

type XmlAttributes = Record<string, string | number | boolean | null | undefined>;

export class Fa3InvoiceBuilder {
  private indentSize: number = 2;
  private indentChar: string = ' ';

  private headerBuilder: HeaderBuilder;
  private sellerBuilder: SellerBuilder;
  private buyerBuilder: BuyerBuilder;
  private thirdPartyBuilder: ThirdPartyBuilder;
  private authorizedEntityBuilder: AuthorizedEntityBuilder;
  private faSectionBuilder: FaSectionBuilder;
  private footerBuilder: FooterBuilder;
  private attachmentBuilder: AttachmentBuilder;

  constructor() {
    this.headerBuilder = new HeaderBuilder();
    this.sellerBuilder = new SellerBuilder();
    this.buyerBuilder = new BuyerBuilder();
    this.thirdPartyBuilder = new ThirdPartyBuilder();
    this.authorizedEntityBuilder = new AuthorizedEntityBuilder();
    this.faSectionBuilder = new FaSectionBuilder();
    this.footerBuilder = new FooterBuilder();
    this.attachmentBuilder = new AttachmentBuilder();
  }

  build(invoice: Fa3Invoice, ctx: Fa3BuildContext): string {
    const parts: string[] = [];
    
    parts.push('<?xml version="1.0" encoding="UTF-8"?>');
    // parts.push('<Faktura xmlns:etd="http://crd.gov.pl/xml/schematy/dziedzinowe/mf/2022/01/05/eD/DefinicjeTypy/" xmlns="http://crd.gov.pl/wzor/2023/06/29/12648/">');
    parts.push('<Faktura xmlns:etd="http://crd.gov.pl/xml/schematy/dziedzinowe/mf/2022/01/05/eD/DefinicjeTypy/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns="http://crd.gov.pl/wzor/2025/06/25/13775/">');
    
    const header = this.headerBuilder.build(invoice.header, ctx);
    if (header) parts.push(header);
    
    const seller = this.sellerBuilder.build(invoice.seller, ctx);
    if (seller) parts.push(seller);
    
    const buyer = this.buyerBuilder.build(invoice.buyer, ctx);
    if (buyer) parts.push(buyer);
    
    if (invoice.thirdParties && invoice.thirdParties.length > 0) {
      const thirdParties = this.thirdPartyBuilder.buildAll(invoice.thirdParties, ctx);
      if (thirdParties) parts.push(thirdParties);
    }
    
    if (invoice.authorizedEntity) {
      const authorized = this.authorizedEntityBuilder.build(invoice.authorizedEntity, ctx);
      if (authorized) parts.push(authorized);
    }
    
    const fa = this.faSectionBuilder.build(invoice, ctx);
    if (fa) parts.push(fa);
    
    if (invoice.footer) {
      const footer = this.footerBuilder.build(invoice.footer, ctx);
      if (footer) parts.push(footer);
    }
    
    if (invoice.attachment) {
      const attachment = this.attachmentBuilder.build(invoice.attachment, ctx);
      if (attachment) parts.push(attachment);
    }
    
    parts.push('</Faktura>');
    
    return parts.join('\n');
  }

  // ============================================================
  // VALIDATION HELPERS
  // ============================================================

  protected vError(
    ctx: Fa3BuildContext | undefined,
    code: string,
    path: string,
    message: string
  ): void {
    ctx?.error('Fa3InvoiceBuilder', code, path, message);
  }

  protected vWarn(
    ctx: Fa3BuildContext | undefined,
    code: string,
    path: string,
    message: string
  ): void {
    ctx?.warn('Fa3InvoiceBuilder', code, path, message);
  }

  protected reqString(
    ctx: Fa3BuildContext | undefined,
    path: string,
    value: unknown,
    message: string
  ): value is string {
    if (typeof value === 'string' && value.trim() !== '') return true;
    this.vError(ctx, 'REQUIRED', path, message);
    return false;
  }

  protected reqNumber(
    ctx: Fa3BuildContext | undefined,
    path: string,
    value: unknown,
    message: string
  ): value is number {
    if (typeof value === 'number' && Number.isFinite(value)) return true;
    this.vError(ctx, 'REQUIRED', path, message);
    return false;
  }

  protected reqBoolean(
    ctx: Fa3BuildContext | undefined,
    path: string,
    value: unknown,
    message: string
  ): value is boolean {
    if (typeof value === 'boolean') return true;
    this.vError(ctx, 'REQUIRED', path, message);
    return false;
  }

  protected reqArray<T = unknown>(
    ctx: Fa3BuildContext | undefined,
    path: string,
    value: unknown,
    message: string
  ): value is T[] {
    if (Array.isArray(value) && value.length > 0) return true;
    this.vError(ctx, 'REQUIRED_ARRAY', path, message);
    return false;
  }

  protected reqDateLike(
    ctx: Fa3BuildContext | undefined,
    path: string,
    value: unknown,
    message: string
  ): value is Date | string {
    if (value instanceof Date && !Number.isNaN(value.getTime())) return true;
    if (
      typeof value === 'string' &&
      value.trim() !== '' &&
      !Number.isNaN(new Date(value).getTime())
    ) {
      return true;
    }
    this.vError(ctx, 'REQUIRED_DATE', path, message);
    return false;
  }

  protected reqOneOf<T extends string | number | boolean>(
    ctx: Fa3BuildContext | undefined,
    path: string,
    value: unknown,
    allowed: readonly T[],
    message: string
  ): value is T {
    if ((allowed as readonly unknown[]).includes(value)) return true;
    this.vError(
      ctx,
      'ONE_OF',
      path,
      `${message}. Dozwolone wartości: ${allowed.join(', ')}`
    );
    return false;
  }

  // ============================================================
  // XML FORMATTING HELPERS
  // ============================================================

  protected indent(level: number): string {
    return this.indentChar.repeat(level * this.indentSize);
  }

  protected element(tagName: string, value: unknown, level: number): string | null {
    if (value === undefined || value === null || value === '') return null;
    return `${this.indent(level)}<${tagName}>${this.escapeXml(value)}</${tagName}>`;
  }

  protected elementReq(
    tagName: string,
    value: unknown,
    level: number,
    ctx: Fa3BuildContext | undefined,
    path: string,
    message: string
  ): string {
    const xml = this.element(tagName, value, level);
    if (xml) return xml;
    this.vError(ctx, 'REQUIRED', path, message);
    return '';
  }

  protected elementWithAttributes(
    tagName: string,
    value: unknown,
    attributes: XmlAttributes | null | undefined,
    level: number
  ): string | null {
    if (value === undefined || value === null || value === '') return null;

    const attrs = Object.entries(attributes || {})
      .filter(([, v]) => v !== undefined && v !== null)
      .map(([k, v]) => `${k}="${this.escapeXml(v)}"`)
      .join(' ');

    const attrStr = attrs ? ` ${attrs}` : '';
    return `${this.indent(level)}<${tagName}${attrStr}>${this.escapeXml(value)}</${tagName}>`;
  }

  protected block(
    tagName: string,
    content: string | null | undefined,
    level: number
  ): string | null {
    if (!content || content.trim() === '') return null;
    return `${this.indent(level)}<${tagName}>\n${content}\n${this.indent(level)}</${tagName}>`;
  }

  protected blockReq(
    tagName: string,
    content: string | null | undefined,
    level: number,
    ctx: Fa3BuildContext | undefined,
    path: string,
    message: string
  ): string {
    const xml = this.block(tagName, content, level);
    if (xml) return xml;
    this.vError(ctx, 'REQUIRED_BLOCK', path, message);
    return '';
  }

  protected blockWithAttributes(
    tagName: string,
    content: string | null | undefined,
    attributes: XmlAttributes | null | undefined,
    level: number
  ): string | null {
    if (!content || content.trim() === '') return null;

    const attrs = Object.entries(attributes || {})
      .filter(([, v]) => v !== undefined && v !== null)
      .map(([k, v]) => `${k}="${this.escapeXml(v)}"`)
      .join(' ');

    const attrStr = attrs ? ` ${attrs}` : '';
    return `${this.indent(level)}<${tagName}${attrStr}>\n${content}\n${this.indent(level)}</${tagName}>`;
  }

  protected dateElement(
    tagName: string,
    date: Date | string | null | undefined,
    level: number
  ): string | null {
    if (!date) return null;
    const formatted = this.formatDate(date);
    return this.element(tagName, formatted, level);
  }

  protected dateElementReq(
    tagName: string,
    date: Date | string | null | undefined,
    level: number,
    ctx: Fa3BuildContext | undefined,
    path: string,
    message: string
  ): string {
    if (!date) {
      this.vError(ctx, 'REQUIRED_DATE', path, message);
      return '';
    }
    const formatted = this.formatDate(date);
    return this.elementReq(tagName, formatted, level, ctx, path, message);
  }

  protected dateTimeElement(
    tagName: string,
    dateTime: Date | string | null | undefined,
    level: number
  ): string | null {
    if (!dateTime) return null;
    const formatted = this.formatDateTime(dateTime);
    return this.element(tagName, formatted, level);
  }

  protected dateTimeElementReq(
    tagName: string,
    dateTime: Date | string | null | undefined,
    level: number,
    ctx: Fa3BuildContext | undefined,
    path: string,
    message: string
  ): string {
    if (!dateTime) {
      this.vError(ctx, 'REQUIRED_DATETIME', path, message);
      return '';
    }
    const formatted = this.formatDateTime(dateTime);
    return this.elementReq(tagName, formatted, level, ctx, path, message);
  }

  protected amountElement(
    tagName: string,
    amount: number | null | undefined,
    level: number
  ): string | null {
    if (amount === undefined || amount === null) return null;
    const formatted = this.formatAmount(amount);
    return this.element(tagName, formatted, level);
  }

  protected amountElementReq(
    tagName: string,
    amount: number | null | undefined,
    level: number,
    ctx: Fa3BuildContext | undefined,
    path: string,
    message: string
  ): string {
    if (amount === undefined || amount === null) {
      this.vError(ctx, 'REQUIRED_AMOUNT', path, message);
      return '';
    }
    const formatted = this.formatAmount(amount);
    return this.elementReq(tagName, formatted, level, ctx, path, message);
  }

  protected quantityElement(
    tagName: string,
    quantity: number | null | undefined,
    level: number
  ): string | null {
    if (quantity === undefined || quantity === null) return null;
    const formatted = this.formatQuantity(quantity);
    return this.element(tagName, formatted, level);
  }

  protected quantityElementReq(
    tagName: string,
    quantity: number | null | undefined,
    level: number,
    ctx: Fa3BuildContext | undefined,
    path: string,
    message: string
  ): string {
    if (quantity === undefined || quantity === null) {
      this.vError(ctx, 'REQUIRED_QUANTITY', path, message);
      return '';
    }
    const formatted = this.formatQuantity(quantity);
    return this.elementReq(tagName, formatted, level, ctx, path, message);
  }

  // ============================================================
  // VALUE FORMATTERS
  // ============================================================

  protected formatDate(date: Date | string): string {
    if (!date) return '';

    if (typeof date === 'string') {
      if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
      date = new Date(date);
    }

    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  protected formatDateTime(dateTime: Date | string): string {
    if (!dateTime) return '';

    if (typeof dateTime === 'string') {
      if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(dateTime)) return dateTime;
      dateTime = new Date(dateTime);
    }

    return dateTime.toISOString();
  }

  protected formatAmount(amount: number): string {
    return this.roundAmount(Number(amount)).toFixed(2);
  }

  protected formatQuantity(quantity: number): string {
    const num = Number(quantity);
    return parseFloat(num.toFixed(6)).toString();
  }

  protected roundAmount(amount: number): number {
    return Math.round(amount * 100) / 100;
  }

  protected escapeXml(text: unknown): string {
    const str = String(text ?? '');
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  // ============================================================
  // UTILITY HELPERS
  // ============================================================

  protected joinElements(elements: Array<string | null | undefined>): string {
    return elements
      .filter((e): e is string => e !== null && e !== undefined && e !== '')
      .join('\n');
  }

  protected hasValue(value: unknown): boolean {
    return value !== undefined && value !== null && value !== '';
  }

  protected optionalElement(tagName: string, value: unknown, level: number): string | null {
    if (!this.hasValue(value)) return null;
    return this.element(tagName, value, level);
  }

  protected conditionalElement(
    condition: boolean,
    tagName: string,
    value: unknown,
    level: number
  ): string | null {
    if (!condition) return null;
    return this.element(tagName, value, level);
  }

  protected flagElement(
    tagName: string,
    flag: boolean | number | string | null | undefined,
    level: number,
    trueValue: string = '1',
    falseValue: string = '2'
  ): string | null {
    const value = flag === true || flag === 1 || flag === '1' ? trueValue : falseValue;
    return this.element(tagName, value, level);
  }

  protected trueFlagElement(
    tagName: string,
    flag: boolean | number | string | null | undefined,
    level: number
  ): string | null {
    if (flag === true || flag === 1 || flag === '1') {
      return this.element(tagName, '1', level);
    }
    return null;
  }
}
