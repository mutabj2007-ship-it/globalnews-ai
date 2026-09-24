/**
 * MARKET PROCUREMENT — RETAINED READER CONTRACT.
 *
 * This is deliberately separate from the numeric MarketObservation spine.
 * A procurement notice is an official lifecycle artifact, not a price/series
 * reading, so forcing it into value+unit+period would manufacture semantics.
 *
 * Every field below is publisher-stated or retained-store provenance.
 * There is no score, rank, similarity, inferred sector, Watch state or AI field.
 */

export interface MarketProcurementLocalizedText {
  readonly en?: string;
  readonly pl?: string;
  readonly fallback: string;
  readonly fallbackLanguage: string;
}

export interface MarketProcurementLocalizedNames {
  readonly en?: readonly string[];
  readonly pl?: readonly string[];
  readonly fallback: readonly string[];
  readonly fallbackLanguage: string;
}

export interface MarketProcurementNotice {
  readonly procurementKey: string;
  readonly publicationNumber: string;
  /** TED's source-stated date token, preserved at its published precision/offset. */
  readonly publicationDate: string;
  readonly noticeType: string;
  readonly title: MarketProcurementLocalizedText;
  readonly buyerNames: MarketProcurementLocalizedNames;
  /** TED-published ISO3 buyer-country tokens. */
  readonly buyerCountries: readonly string[];
  readonly cpvCodes: readonly string[];

  /**
   * Present only as a pair. A number without its publisher currency is not
   * surfaced as a value.
   */
  readonly totalValue: number | null;
  readonly totalValueCurrency: string | null;

  /** Source tokens; no timezone conversion or deadline synthesis is performed. */
  readonly deadlineDates: readonly string[];
  readonly deadlineTimes: readonly string[];

  readonly sourceLinks: {
    readonly htmlEn?: string;
    readonly htmlPl?: string;
    readonly xml?: string;
  };

  readonly provider: 'TED';
  readonly sourceClass: 'PROCUREMENT_NOTICE';
  readonly retrievalId: string;
  readonly retainedAt: string;
  readonly snapshotContentAddress: string;
  readonly freshnessBasis: 'RETAINED_ONLY';
}

export function marketProcurementKey(publicationNumber: string): string {
  return `mktproc:1:${publicationNumber.length}:${publicationNumber}`;
}
