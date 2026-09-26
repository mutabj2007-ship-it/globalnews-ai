/**
 * ════════════════════════════════════════════════════════════════════════════
 * ASK CONVERSATIONAL EVIDENCE ANCHORING R1 — THE ONE EVENT-EVIDENCE AUTHORITY
 * ════════════════════════════════════════════════════════════════════════════
 *
 * THE DEFECT (reproduced on the real AnalysisService, see the R1 regression
 * suite). "What caused the plane crash in Congo?" routed to a country feed that
 * ignores the topic, so a same-country Ebola report became undifferentiated
 * evidence; the follow-up "Does this influence the neighboring countries?"
 * then let that Ebola report — which itself says neighbouring countries are on
 * alert — stand in for the crash's cross-border effects. Geographic and
 * temporal co-occurrence was promoted into consequence.
 *
 * WHY A NEW RELATION AND NOT `EvidenceRole`. `source-provenance.ts` already has
 * `EvidenceRole` (REPORTING / PRIMARY_RECORD / REFERENCE_DATA / CONTEXT), and it
 * answers a different question: what KIND OF SOURCE a record is. A wire report
 * about the crash and a wire report about Ebola are both REPORTING. What this
 * defect needs is how an article RELATES TO THE ANCHORED EVENT — an orthogonal
 * axis. Reusing the source-role type for it would conflate the two, so this is
 * the single authority for the event relation and nothing else classifies it.
 */

/**
 * How one retrieved article relates to the event the reader asked about.
 *
 *   DIRECT_EVENT          reporting directly describing the event itself.
 *   REPORTED_CONSEQUENCE  reporting that itself explicitly links a consequence
 *                         to the event ("… after the crash", "… led to …").
 *   CONTEXT_ONLY          same place / same period / otherwise relevant
 *                         background that establishes neither a cause nor a
 *                         consequence of the event.
 *
 * CONTEXT_ONLY evidence may be shown, clearly separated as context. It can never
 * satisfy a question about the event's cause, effects, consequences, who it
 * affected, or cross-border impact — the backend withholds any such claim whose
 * only support is context, whatever the model writes.
 */
export type EventEvidenceRelation = 'DIRECT_EVENT' | 'REPORTED_CONSEQUENCE' | 'CONTEXT_ONLY';

/** Which reasoning the reader's question asks for about the event. */
export interface EventQuestionAspects {
  readonly cause: boolean;
  readonly effect: boolean;
  readonly crossBorder: boolean;
}

/**
 * Deterministic, evidence-backed facts the backend states about an answer.
 * Codes, never prose: the frontend owns the EN/PL wording.
 *
 *   CROSS_BORDER_NOT_ESTABLISHED  the question asks about neighbouring-country
 *                                 or cross-border impact and no retrieved report
 *                                 explicitly links such a consequence to the event.
 *   CAUSE_NOT_ESTABLISHED         the question asks what caused the event and no
 *                                 retrieved report states a cause.
 *   CONTEXT_SEPARATED             some evidence is context only; it is not
 *                                 established as a cause or consequence.
 *   COUNTRY_INTERPRETED_FROM_EVIDENCE  an ambiguous place name ("Congo") was
 *                                 resolved from the event reporting itself.
 *   COUNTRY_FROM_SELECTED_CONTEXT an ambiguous place name was resolved by the
 *                                 country the reader selected.
 */
export type EventAnchorDisclosure =
  | 'CROSS_BORDER_NOT_ESTABLISHED'
  | 'CAUSE_NOT_ESTABLISHED'
  | 'CONTEXT_SEPARATED'
  | 'COUNTRY_INTERPRETED_FROM_EVIDENCE'
  | 'COUNTRY_FROM_SELECTED_CONTEXT';

/**
 * The structured event anchor for one answer. Every field is either the
 * reader's own words (the topic) or derived deterministically from retrieved
 * evidence. No AI-generated narrative is ever stored here.
 */
export interface EventAnchor {
  /** The event's topic words, from the reader's question (e.g. "plane crash"). */
  readonly topic: string;
  /** Where the anchor came from: this question, or the prior user question ("this", "it"). */
  readonly source: 'current-question' | 'prior-question';
  /** ISO-3 of the event's country when established; absent otherwise. */
  readonly countryIso3?: string;
  readonly aspects: EventQuestionAspects;
  /** Article ids by relation to the event. */
  readonly directEventArticleIds: readonly string[];
  readonly consequenceArticleIds: readonly string[];
  readonly contextArticleIds: readonly string[];
  readonly disclosures: readonly EventAnchorDisclosure[];
  /** How many model claims were withheld because their only support was context evidence. */
  readonly contextOnlyClaimsWithheld?: number;
}

/**
 * Place names that are genuinely ambiguous between two countries. A bare
 * "Congo" is NOT universally DR Congo: it can mean the Democratic Republic of
 * the Congo (Kinshasa) or the Republic of the Congo (Brazzaville). Qualified
 * forms ("DR Congo", "Republic of the Congo", "Congo-Kinshasa", "Brazzaville")
 * are unambiguous and never reach this table.
 */
export const AMBIGUOUS_COUNTRY_NAMES: Readonly<Record<string, readonly string[]>> = {
  congo: ['COD', 'COG'],
  kongo: ['COD', 'COG'],
  konga: ['COD', 'COG'],
  kongu: ['COD', 'COG'],
};

/** Clarification reasons the backend may emit (the frontend owns the wording). */
export type AnalysisClarificationReason =
  | 'COMPARISON_MEMBERS_UNDETERMINED'
  | 'TOO_MANY_ENTITIES'
  | 'AMBIGUOUS_COUNTRY';
