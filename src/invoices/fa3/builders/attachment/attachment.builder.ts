import type { Fa3BuildContext } from '../../validators/build-context';
import type {
  Fa3Attachment,
  Fa3AttachmentBlock,
  Fa3AttachmentMeta,
  Fa3AttachmentText,
  Fa3AttachmentTable,
  Fa3AttachmentTableMeta,
  Fa3AttachmentTableHeader,
  Fa3AttachmentTableHeaderCol,
  Fa3AttachmentTableRow,
  Fa3AttachmentTableCell,
  Fa3AttachmentTableSummary,
} from '../../types';

export class AttachmentBuilder {
  private indentSize: number = 2;
  private indentChar: string = ' ';
  private builderName: string = 'AttachmentBuilder';

  // ============================================================
  // PUBLIC API
  // ============================================================

  public build(
    attachment: Fa3Attachment | null | undefined,
    ctx?: Fa3BuildContext
  ): string | null {
    if (!attachment) return null;

    const level = 1; // <Zalacznik> jest bezpośrednio w <Faktura>
    const innerLevel = level + 1;
    const elements: Array<string | null> = [];

    // BlokDanych (1-1000)
    if (!attachment.blocks || attachment.blocks.length === 0) {
      this.vError(ctx, 'REQUIRED', 'attachment.blocks', 'Załącznik wymaga co najmniej jednego bloku danych');
      return null;
    }

    if (attachment.blocks.length > 1000) {
      this.vWarn(
        ctx,
        'LIMIT',
        'attachment.blocks',
        'Liczba bloków danych przekracza limit 1000. Przetworzono tylko pierwsze 1000.'
      );
    }

    const blocks = attachment.blocks.slice(0, 1000);
    for (const block of blocks) {
      const blockXml = this.buildDataBlock(block, innerLevel, ctx);
      if (blockXml) elements.push(blockXml);
    }

    const xml = this.joinElements(elements);
    if (!xml) return null;

    return this.block('Zalacznik', xml, level);
  }

  // ============================================================
  // PRIVATE BUILDERS - DATA BLOCK
  // ============================================================

  private buildDataBlock(
    block: Fa3AttachmentBlock,
    level: number,
    ctx?: Fa3BuildContext
  ): string | null {
    const innerLevel = level + 1;
    const elements: Array<string | null> = [];

    // ZNaglowek (opcjonalne)
    if (this.hasValue(block.header)) {
      elements.push(this.element('ZNaglowek', block.header, innerLevel));
    }

    // MetaDane (1-1000)
    if (block.metadata && block.metadata.length > 0) {
      if (block.metadata.length > 1000) {
        this.vWarn(
          ctx,
          'LIMIT',
          'attachment.block.metadata',
          'Liczba metadanych przekracza limit 1000. Przetworzono tylko pierwsze 1000.'
        );
      }

      const metadata = block.metadata.slice(0, 1000);
      for (const meta of metadata) {
        const metaXml = this.buildMetadata(meta, innerLevel, ctx);
        if (metaXml) elements.push(metaXml);
      }
    }

    // Tekst (opcjonalne)
    if (block.text) {
      const textXml = this.buildText(block.text, innerLevel, ctx);
      if (textXml) elements.push(textXml);
    }

    // Tabela (0-1000)
    if (block.tables && block.tables.length > 0) {
      if (block.tables.length > 1000) {
        this.vWarn(
          ctx,
          'LIMIT',
          'attachment.block.tables',
          'Liczba tabel przekracza limit 1000. Przetworzono tylko pierwsze 1000.'
        );
      }

      const tables = block.tables.slice(0, 1000);
      for (const table of tables) {
        const tableXml = this.buildTable(table, innerLevel, ctx);
        if (tableXml) elements.push(tableXml);
      }
    }

    return this.block('BlokDanych', this.joinElements(elements), level);
  }

  // ============================================================
  // PRIVATE BUILDERS - METADATA
  // ============================================================

  private buildMetadata(
    meta: Fa3AttachmentMeta,
    level: number,
    ctx?: Fa3BuildContext
  ): string | null {
    const innerLevel = level + 1;
    const elements: Array<string | null> = [];

    // ZKlucz (wymagane)
    if (!this.hasValue(meta.key)) {
      this.vError(ctx, 'REQUIRED', 'metadata.key', 'Brak klucza w metadanych');
      return null;
    }
    elements.push(this.element('ZKlucz', meta.key, innerLevel));

    // ZWartosc (wymagane)
    if (!this.hasValue(meta.value)) {
      this.vError(ctx, 'REQUIRED', 'metadata.value', 'Brak wartości w metadanych');
      return null;
    }
    elements.push(this.element('ZWartosc', meta.value, innerLevel));

    return this.block('MetaDane', this.joinElements(elements), level);
  }

  // ============================================================
  // PRIVATE BUILDERS - TEXT
  // ============================================================

  private buildText(
    text: Fa3AttachmentText,
    level: number,
    ctx?: Fa3BuildContext
  ): string | null {
    const innerLevel = level + 1;
    const elements: Array<string | null> = [];

    // Akapit (1-10)
    const paragraphs = Array.isArray(text) ? text : [text];

    if (paragraphs.length > 10) {
      this.vWarn(
        ctx,
        'LIMIT',
        'attachment.text.paragraphs',
        'Liczba akapitów przekracza limit 10. Przetworzono tylko pierwsze 10.'
      );
    }

    const limitedParagraphs = paragraphs.slice(0, 10);

    for (const paragraph of limitedParagraphs) {
      if (this.hasValue(paragraph)) {
        elements.push(this.element('Akapit', paragraph, innerLevel));
      }
    }

    return this.block('Tekst', this.joinElements(elements), level);
  }

  // ============================================================
  // PRIVATE BUILDERS - TABLE
  // ============================================================

  private buildTable(
    table: Fa3AttachmentTable,
    level: number,
    ctx?: Fa3BuildContext
  ): string | null {
    const innerLevel = level + 1;
    const elements: Array<string | null> = [];

    // TMetaDane (0-1000)
    if (table.metadata && table.metadata.length > 0) {
      if (table.metadata.length > 1000) {
        this.vWarn(
          ctx,
          'LIMIT',
          'attachment.table.metadata',
          'Liczba metadanych tabeli przekracza limit 1000. Przetworzono tylko pierwsze 1000.'
        );
      }

      const metadata = table.metadata.slice(0, 1000);
      for (const meta of metadata) {
        const metaXml = this.buildTableMetadata(meta, innerLevel, ctx);
        if (metaXml) elements.push(metaXml);
      }
    }

    // Opis (opcjonalne)
    if (this.hasValue(table.description)) {
      elements.push(this.element('Opis', table.description, innerLevel));
    }

    // TNaglowek (wymagane)
    if (!table.header) {
      this.vError(ctx, 'REQUIRED', 'attachment.table.header', 'Brak nagłówka tabeli');
      return null;
    }
    const headerXml = this.buildTableHeader(table.header, innerLevel, ctx);
    if (headerXml) elements.push(headerXml);

    // Wiersz (1-1000)
    if (!table.rows || table.rows.length === 0) {
      this.vError(ctx, 'REQUIRED', 'attachment.table.rows', 'Tabela wymaga co najmniej jednego wiersza');
      return null;
    }

    if (table.rows.length > 1000) {
      this.vWarn(
        ctx,
        'LIMIT',
        'attachment.table.rows',
        'Liczba wierszy tabeli przekracza limit 1000. Przetworzono tylko pierwsze 1000.'
      );
    }

    const rows = table.rows.slice(0, 1000);
    for (const row of rows) {
      const rowXml = this.buildTableRow(row, innerLevel, ctx);
      if (rowXml) elements.push(rowXml);
    }

    // Suma (opcjonalne)
    if (table.summary) {
      const summaryXml = this.buildTableSummary(table.summary, innerLevel, ctx);
      if (summaryXml) elements.push(summaryXml);
    }

    return this.block('Tabela', this.joinElements(elements), level);
  }

  private buildTableMetadata(
    meta: Fa3AttachmentTableMeta,
    level: number,
    ctx?: Fa3BuildContext
  ): string | null {
    const innerLevel = level + 1;
    const elements: Array<string | null> = [];

    // TKlucz (wymagane)
    if (!this.hasValue(meta.key)) {
      this.vError(ctx, 'REQUIRED', 'table.metadata.key', 'Brak klucza w metadanych tabeli');
      return null;
    }
    elements.push(this.element('TKlucz', meta.key, innerLevel));

    // TWartosc (wymagane)
    if (!this.hasValue(meta.value)) {
      this.vError(ctx, 'REQUIRED', 'table.metadata.value', 'Brak wartości w metadanych tabeli');
      return null;
    }
    elements.push(this.element('TWartosc', meta.value, innerLevel));

    return this.block('TMetaDane', this.joinElements(elements), level);
  }

  private buildTableHeader(
    header: Fa3AttachmentTableHeader,
    level: number,
    ctx?: Fa3BuildContext
  ): string | null {
    const innerLevel = level + 1;
    const elements: Array<string | null> = [];

    // Kol (1-20) - z atrybutem Typ
    const columns: Fa3AttachmentTableHeaderCol[] = Array.isArray(header)
      ? header
      : header?.columns || [];

    if (columns.length === 0) {
      this.vError(ctx, 'REQUIRED', 'table.header.columns', 'Nagłówek tabeli wymaga co najmniej jednej kolumny');
      return null;
    }

    if (columns.length > 20) {
      this.vWarn(
        ctx,
        'LIMIT',
        'table.header.columns',
        'Liczba kolumn przekracza limit 20. Przetworzono tylko pierwsze 20.'
      );
    }

    const limitedColumns = columns.slice(0, 20);

    for (const col of limitedColumns) {
      const colInnerLevel = innerLevel + 1;
      const colElements: Array<string | null> = [];

      // NKom (wymagane)
      const name = col.name ?? col.value ?? '';
      colElements.push(this.element('NKom', name, colInnerLevel));

      // Typ (domyślnie "txt")
      const type = col.type ?? 'txt';

      // Element z atrybutem
      elements.push(
        `${this.indent(innerLevel)}<Kol Typ="${this.escapeXml(type)}">\n${this.joinElements(
          colElements
        )}\n${this.indent(innerLevel)}</Kol>`
      );
    }

    return this.block('TNaglowek', this.joinElements(elements), level);
  }

  private buildTableRow(
    row: Fa3AttachmentTableRow,
    level: number,
    ctx?: Fa3BuildContext
  ): string | null {
    const innerLevel = level + 1;
    const elements: Array<string | null> = [];

    // WKom (1-20)
    const cells: Fa3AttachmentTableCell[] = Array.isArray(row) ? row : row?.cells || [];

    if (cells.length === 0) {
      this.vError(ctx, 'REQUIRED', 'table.row.cells', 'Wiersz tabeli wymaga co najmniej jednej komórki');
      return null;
    }

    if (cells.length > 20) {
      this.vWarn(
        ctx,
        'LIMIT',
        'table.row.cells',
        'Liczba komórek w wierszu przekracza limit 20. Przetworzono tylko pierwsze 20.'
      );
    }

    const limitedCells = cells.slice(0, 20);

    for (const cell of limitedCells) {
      const value = typeof cell === 'object' && cell !== null ? (cell as any).value ?? '' : cell;
      elements.push(this.element('WKom', value, innerLevel));
    }

    return this.block('Wiersz', this.joinElements(elements), level);
  }

  private buildTableSummary(
    summary: Fa3AttachmentTableSummary,
    level: number,
    ctx?: Fa3BuildContext
  ): string | null {
    const innerLevel = level + 1;
    const elements: Array<string | null> = [];

    // SKom (1-20)
    const cells: Fa3AttachmentTableCell[] = Array.isArray(summary) ? summary : summary?.cells || [];

    if (cells.length === 0) {
      this.vError(ctx, 'REQUIRED', 'table.summary.cells', 'Suma tabeli wymaga co najmniej jednej komórki');
      return null;
    }

    if (cells.length > 20) {
      this.vWarn(
        ctx,
        'LIMIT',
        'table.summary.cells',
        'Liczba komórek w sumie przekracza limit 20. Przetworzono tylko pierwsze 20.'
      );
    }

    const limitedCells = cells.slice(0, 20);

    for (const cell of limitedCells) {
      const value = typeof cell === 'object' && cell !== null ? (cell as any).value ?? '' : cell;
      elements.push(this.element('SKom', value, innerLevel));
    }

    return this.block('Suma', this.joinElements(elements), level);
  }

  // ============================================================
  // VALIDATION HELPERS
  // ============================================================

  private vError(
    ctx: Fa3BuildContext | undefined,
    code: string,
    path: string,
    message: string
  ): void {
    ctx?.error(this.builderName, code, path, message);
  }

  private vWarn(
    ctx: Fa3BuildContext | undefined,
    code: string,
    path: string,
    message: string
  ): void {
    ctx?.warn(this.builderName, code, path, message);
  }

  // ============================================================
  // XML FORMATTING HELPERS
  // ============================================================

  private indent(level: number): string {
    return this.indentChar.repeat(level * this.indentSize);
  }

  private element(tagName: string, value: unknown, level: number): string | null {
    if (value === undefined || value === null || value === '') return null;
    return `${this.indent(level)}<${tagName}>${this.escapeXml(value)}</${tagName}>`;
  }

  private block(
    tagName: string,
    content: string | null | undefined,
    level: number
  ): string | null {
    if (!content || content.trim() === '') return null;
    return `${this.indent(level)}<${tagName}>\n${content}\n${this.indent(level)}</${tagName}>`;
  }

  // ============================================================
  // VALUE FORMATTERS
  // ============================================================

  private escapeXml(text: unknown): string {
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

  private joinElements(elements: Array<string | null | undefined>): string {
    return elements
      .filter((e): e is string => e !== null && e !== undefined && e !== '')
      .join('\n');
  }

  private hasValue(value: unknown): boolean {
    return value !== undefined && value !== null && value !== '';
  }
}