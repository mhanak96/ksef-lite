export interface Fa3FooterInfo {
  text?: string;
}

export interface Fa3FooterRegistry {
  fullName?: string;
  krs?: string;
  regon?: string;
  bdo?: string;
}

export interface Fa3Footer {
  info?: Fa3FooterInfo[];
  registries?: Fa3FooterRegistry[];
}

export interface Fa3AttachmentMeta {
  key: string;
  value: string;
}

export type Fa3AttachmentText = string | string[];

export interface Fa3AttachmentTableMeta {
  key: string;
  value: string;
}

export interface Fa3AttachmentTableHeaderCol {
  name?: string;
  value?: string;
  type?: 'date' | 'datetime' | 'dec' | 'int' | 'time' | 'txt';
}

export type Fa3AttachmentTableHeader =
  | Fa3AttachmentTableHeaderCol[]
  | { columns: Fa3AttachmentTableHeaderCol[] };

export type Fa3AttachmentTableCell =
  | string
  | number
  | boolean
  | null
  | { value?: string | number | boolean | null };

export type Fa3AttachmentTableRow =
  | Fa3AttachmentTableCell[]
  | { cells: Fa3AttachmentTableCell[] };

export type Fa3AttachmentTableSummary =
  | Fa3AttachmentTableCell[]
  | { cells: Fa3AttachmentTableCell[] };

export interface Fa3AttachmentTable {
  metadata?: Fa3AttachmentTableMeta[];
  description?: string;
  header: Fa3AttachmentTableHeader;
  rows?: Fa3AttachmentTableRow[];
  summary?: Fa3AttachmentTableSummary | null;
}

export interface Fa3AttachmentBlock {
  header?: string;
  metadata?: Fa3AttachmentMeta[];
  text?: Fa3AttachmentText;
  tables?: Fa3AttachmentTable[];
}

export interface Fa3Attachment {
  blocks?: Fa3AttachmentBlock[];
}
