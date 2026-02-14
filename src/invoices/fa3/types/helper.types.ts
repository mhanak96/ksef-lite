import type { Fa3Annotations } from './annotation.types';

export type Fa3AnnotationsBuildDetails = Record<string, unknown>;

export interface Fa3InvoiceItemForAnnotations {
  vatRate?: string | number;
  attachment15?: 1 | boolean;
  isMargin?: boolean;
}

export interface Fa3InvoiceForAnnotations {
  details?: {
    annotations?: Fa3Annotations;
    items?: Fa3InvoiceItemForAnnotations[];
  };
}
