/**
 * Nagłówek faktury
 */
export interface Fa3Header {
  systemInfo?: string;
  creationDate?: Date | string;
}

/**
 * Opcje buildera nagłówka
 */
export interface HeaderBuilderOptions {
  indentSize?: number;
  indentChar?: string;
  baseLevel?: number;
}
