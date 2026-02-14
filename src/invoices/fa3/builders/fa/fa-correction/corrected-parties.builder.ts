import type { Fa3BuildContext } from '../../../validators/build-context';
import type {
  Fa3InvoiceDetails,
  Fa3CorrectedSeller,
  Fa3CorrectedBuyer,
} from '../../../types';

import { SellerBuilder } from '../../parties/seller.builder';
import { BuyerBuilder } from '../../parties/buyer.builder';

export type CorrectedPartiesBuilderOptions = {
  indentSize?: number;
  indentChar?: string;
};

export class CorrectedPartiesBuilder {
  private readonly indentSize: number;
  private readonly indentChar: string;
  private sellerBuilder: SellerBuilder;
  private buyerBuilder: BuyerBuilder;

  constructor(options: CorrectedPartiesBuilderOptions = {}) {
    this.indentSize = options.indentSize ?? 2;
    this.indentChar = options.indentChar ?? ' ';

    this.sellerBuilder = new SellerBuilder(options);
    this.buyerBuilder = new BuyerBuilder(options);
  }

  build(
    details: Fa3InvoiceDetails,
    ctx?: Fa3BuildContext,
    level: number = 1
  ): string | null {
    const elements: Array<string | null> = [];

    // Podmiot1K - Korygowany sprzedawca (0-1)
    if ((details as any).correctedSeller) {
      const sellerXml = this.sellerBuilder.buildAs(
        'Podmiot1K',
        (details as any).correctedSeller as Fa3CorrectedSeller,
        ctx,
        level
      );
      if (sellerXml) elements.push(sellerXml);
    }

    // Podmiot2K - Korygowani nabywcy (0-101)
    if (
      (details as any).correctedBuyers &&
      Array.isArray((details as any).correctedBuyers)
    ) {
      const buyers = (details as any).correctedBuyers as Fa3CorrectedBuyer[];

      if (buyers.length > 101) {
        this.vWarn(
          ctx,
          'LIMIT',
          'details.correctedBuyers',
          'Liczba korygowanych nabywców przekracza limit 101. Przetworzono tylko pierwszych 101.'
        );
      }

      const limited = buyers.slice(0, 101);
      for (const buyer of limited) {
        const buyerXml = this.buyerBuilder.buildAs(
          'Podmiot2K',
          buyer,
          ctx,
          level
        );
        if (buyerXml) elements.push(buyerXml);
      }
    }

    return this.joinElements(elements);
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
    ctx?.error('CorrectedPartiesBuilder', code, path, message);
  }

  protected vWarn(
    ctx: Fa3BuildContext | undefined,
    code: string,
    path: string,
    message: string
  ): void {
    ctx?.warn('CorrectedPartiesBuilder', code, path, message);
  }

  // ============================================================
  // UTILITY HELPERS
  // ============================================================

  protected joinElements(elements: Array<string | null | undefined>): string {
    return elements
      .filter((e): e is string => e !== null && e !== undefined && e !== '')
      .join('\n');
  }
}
