export interface Fa3SettlementCharge {
  /** Powód obciążenia */
  reason: string;
  /** Kwota obciążenia */
  amount: number;
}

export interface Fa3SettlementDeduction {
  /** Powód odliczenia */
  reason: string;
  /** Kwota odliczenia */
  amount: number;
}

/**
 * Rozliczenie (dodatkowe obciążenia/odliczenia)
 */
export interface Fa3Settlement {
  /** Obciążenia (max 100) */
  charges?: Fa3SettlementCharge[];
  /** Odliczenia (max 100) */
  deductions?: Fa3SettlementDeduction[];
  /** Suma obciążeń */
  totalCharges?: number;
  /** Suma odliczeń */
  totalDeductions?: number;
  /** Kwota do zapłaty (P_15 + obciążenia - odliczenia) */
  amountToPay?: number;
  /** Kwota nadpłacona do rozliczenia/zwrotu */
  amountToSettle?: number;
}
