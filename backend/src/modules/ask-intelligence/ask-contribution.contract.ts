/**
 * ════════════════════════════════════════════════════════════════════════════
 * ASK GLOBALNEWSAI — INTELLIGENCE BINDING R1: THE CONTRIBUTION CONTRACT
 * ════════════════════════════════════════════════════════════════════════════
 *
 * One small, typed shape for what a governed read contributed to ONE Ask answer. It is not a
 * universal intelligence schema: each contributor maps its own existing domain contract
 * (ConflictObservation, MarketRetainedProcurementNotice, EconomyObservation, the NISR Imihigo
 * record, the geography resolution) into these few fields, and nothing else.
 *
 * Codes and source data only — the frontend owns every word. A contribution never carries the
 * reader's question, never an account, never model output.
 *
 * STATUS TRUTH (contract §5): a missing contribution is NEVER a zero and NEVER evidence that
 * nothing happened.
 *   USED           the contributor returned governed observations relevant to the scope
 *   NO_MATCH       the contributor was consulted; no governed observation matches the scope
 *   NO_DATA        the contributor's governed store holds nothing admissible at all
 *   NOT_ASSESSED   the capability exists in the product but no governed observation reader
 *                  is populated/callable (e.g. Humanitarian R1) — degraded, disclosed
 *   DEGRADED       the read failed or timed out; the answer continues without it
 *   REFUSED        a governance rule refused the read (e.g. an admission identity failure)
 */

export const ASK_CONTRIBUTOR_IDS = [
  'CONFLICT',
  'MARKET_PROCUREMENT',
  'ECONOMY_CPI',
  'IMIHIGO',
  'GEOGRAPHY',
  'HUMANITARIAN',
  /** POLITICS INTEL R1 — the retained Politics store (PoliticsObservationRepository), read-only. */
  'POLITICS',
] as const;
export type AskContributorId = (typeof ASK_CONTRIBUTOR_IDS)[number];

export type AskContributionStatus =
  'USED' | 'NO_MATCH' | 'NO_DATA' | 'NOT_ASSESSED' | 'DEGRADED' | 'REFUSED';

/**
 * How the observation relates to time. None of these is "current": a retained observation is
 * never relabelled as today's reporting, whatever the question says.
 */
export type AskTemporalBasis =
  /** Event records dated by their source (Conflict/UCDP). */
  | 'RETAINED_EVENT_RECORD'
  /** Retained snapshot of publications on a stated publication date (TED). */
  | 'RETAINED_PUBLICATION'
  /** A retained statistical release for a reference period (NISR CPI). */
  | 'RETAINED_STATISTICAL_RELEASE'
  /** A retained evaluation for a closed cycle (NISR Imihigo 2024/2025). */
  | 'RETAINED_EVALUATION_CYCLE'
  /** Reference geography — context, not evidence of any event. */
  | 'REFERENCE_GEOGRAPHY'
  /**
   * POLITICS INTEL R1 — a retained official record (e.g. a legislative stage) dated by its OWN clocks:
   * event time when the source states it, else publication. Never the retrieval time.
   */
  | 'RETAINED_OFFICIAL_RECORD'
  | 'NONE';

/** One governed observation, with the provenance every specialist claim must carry. */
export interface AskContributionObservation {
  /** The contributor's own stable key for the record (event key, notice id, series id…). */
  readonly reference: string;
  /** A governed code for what the record is (event type, artifact class, series, entity class). */
  readonly kind: string;
  /** Source-stated text only (a notice title, a district name, a series label) — never generated. */
  readonly label: string | null;
  /** A source-stated value, verbatim, when the record has one (a score, a rate, a count). */
  readonly value: string | null;
  readonly unit: string | null;
  /** The observation/reference period as the source states it (date, month, cycle). */
  readonly period: string;
  /** Geography as the source/record states it (ISO3, district name, place). */
  readonly geography: string;
  readonly source: {
    readonly name: string;
    readonly url: string | null;
    /** Licence or rights note when the governed record carries one. */
    readonly licence: string | null;
  };
  /** When GlobalNewsAI retained the record (capture/ingest time), if known. */
  readonly retainedAt: string | null;
  /**
   * LIVE ACCEPTANCE REPAIR R1 (C) — structured, source-verbatim display fields, so a record is
   * shown as date · place · what · source instead of a raw citation string. Absent when the
   * record carries none; never generated, never geocoded.
   */
  readonly detail?: {
    /** The source-published location description (e.g. a UCDP `where_description`). */
    readonly place: string | null;
    /** The source-published parties (e.g. UCDP side A / side B), verbatim. */
    readonly parties: readonly string[];
    /** A source-published headline, verbatim, when one exists. */
    readonly headline: string | null;
    /** The outlets the source cites (the publisher's own citation, split — never rewritten). */
    readonly citedOutlets: readonly string[];
  };
  /**
   * POLITICS INTEL R1 (CTO ruling 11) — ADDITIVE, OPTIONAL provenance for a record whose governed
   * contract carries it. Absent on every other contributor, so their contributions are unchanged.
   * Only attributes the shared shape otherwise drops: official vs reporting, the record's own clocks,
   * revision, artifact anchor and language. Never a quotation, never a person field, never review data.
   */
  readonly provenance?: {
    readonly sourceType: string;
    readonly evidenceRole: string | null;
    /** Event time if the source states it, else publication — `temporalBasis` says which. */
    readonly effectiveAt: string;
    readonly temporalBasis: string;
    readonly publishedAt: string;
    readonly sourceUpdatedAt: string | null;
    readonly revisionOrdinal: number;
    readonly artifactSha256: string;
    readonly language: string;
  };
}

export interface AskContribution {
  readonly contributorId: AskContributorId;
  /** The analytical/specialist domain it serves (security→CONFLICT is one domain, not two). */
  readonly domain: string;
  readonly status: AskContributionStatus;
  /** SUPPLEMENTARY unless the plan REQUIRES this specialist role. */
  readonly applicability: 'REQUIRED' | 'SUPPLEMENTARY' | 'CONTEXT';
  readonly observations: readonly AskContributionObservation[];
  readonly temporalBasis: AskTemporalBasis;
  /** The scope the read was performed for (e.g. 'COD', 'nisr:district:56'). */
  readonly geographyBasis: string | null;
  /** Codes the answer must disclose (e.g. RETAINED_NOT_CURRENT, AGGREGATE_NOT_ASSIGNED). */
  readonly disclosures: readonly string[];
  readonly degradationReason: string | null;
}

/** What the route asked for, before any read — deterministic, zero AI, zero I/O. */
export interface AskContributorSelection {
  readonly contributorId: AskContributorId;
  readonly domain: string;
  readonly applicability: AskContribution['applicability'];
  /** The resolved scope the contributor will read (ISO3, NISR district, …). */
  readonly scope: {
    readonly countryIso3: string | null;
    readonly district: { readonly id: string; readonly name: string } | null;
    readonly place: string | null;
    /**
     * LIVE ACCEPTANCE REPAIR R1 — a sub-national qualifier the reader stated ("eastern") that no
     * governed geography resolved. Carried only so the answer can DISCLOSE the scope it read at.
     */
    readonly qualifier?: string | null;
    /**
     * SHARED R4 CONTINUITY — present only when the scope was INHERITED from the specific earlier
     * answer the turn is bound to (never reader-stated; see contributor-selection.ts).
     */
    readonly provenance?: 'EARLIER_TURN';
  };
}
