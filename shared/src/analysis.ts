import type {
  NewsArticle,
  NewsDataMode,
  NewsFallbackReason,
} from './news';

/**
 * Milestone #47 — closed set of UI/response languages GlobalNews AI's
 * architecture supports. Represents requested/resolved UI and analysis
 * response language ONLY — never an arbitrary evidence/source language
 * (see NewsArticle.sourceLanguage, which is deliberately a plain
 * string, not this type, since retrieved evidence can be in any
 * language the news provider itself supports, a much larger set than
 * GlobalNews AI's own UI languages).
 *
 * PRODUCTION STATUS AS OF MILESTONE #47: only 'en' and 'pl' are
 * actually implemented and tested end-to-end (native English retrieval
 * for 'en'; staged Top-Headlines-then-Search-fallback retrieval for
 * 'pl' — see resolve-retrieval-language.util.ts). 'sw', 'fr', 'es',
 * 'ar', 'rw' are part of the planned architecture (this type already
 * includes them, and the retrieval-strategy resolver already has a
 * defined behavior for each) but are NOT activated in the frontend
 * language selector and have not been end-to-end tested — do not
 * present them as production-supported until their own acceptance
 * criteria are actually implemented.
 */
export type LanguageCode = 'en' | 'pl' | 'sw' | 'fr' | 'es' | 'ar' | 'rw';

/**
 * Whether an analysis was produced by a real AI provider or by
 * MockAnalysisProvider. Mirrors NewsDataMode's live/mock distinction —
 * mock analysis must never be presented as real AI output.
 */
export type AnalysisMode = 'live-ai' | 'mock-ai';

export type ConfidenceLevel = 'low' | 'medium' | 'high';

/**
 * Milestone #32 — deterministic fact about citation breadth for one
 * grounded entry, computed entirely by the backend from that entry's
 * own already-M31-resolved `sourceArticleIds` (never provider-emitted —
 * see validate-analysis-result.ts). This is a count, not a claim: it
 * says nothing about whether the cited evidence semantically supports
 * the specific strength of the generated text. Never conflate this
 * with EvidenceBasis, which is about excerpt provenance, or with any
 * notion of confirmation/truth.
 */
export interface EvidenceBreadth {
  /** Number of distinct canonical grounded source article IDs. */
  sourceCount: number;
  /** True iff sourceCount === 1. */
  singleSource: boolean;
}

/**
 * Milestone #32 — a specific excerpt the model identified as its basis
 * for one grounded entry, backend-validated to actually exist within
 * the exact (prompt-truncated) evidence text supplied to the model for
 * the cited evidence reference — see validate-analysis-result.ts and
 * build-analysis-prompt.util.ts. `articleId` is always a real,
 * canonical NewsArticle.id resolved the same way M31 resolves
 * sourceArticleIds — the model-facing request-local evidenceId
 * (S1/S2/...) this excerpt was originally attributed to is never
 * retained here or anywhere downstream of validation.
 *
 * This proves EXCERPT PROVENANCE only: that the text was actually
 * present in what the model was shown for that source. It does NOT
 * prove that the excerpt logically entails the claim's specific
 * wording or strength, and it is never a substitute for independent
 * verification. Present only when validation succeeds; never a
 * synthetic/manufactured fallback value (see EvidenceBreadth for the
 * separate, purely-quantitative signal).
 */
export interface EvidenceBasis {
  articleId: string;
  excerpt: string;
}

/**
 * Milestone #40 — the six base semantic labels a single evidence
 * excerpt can carry with respect to a requested "X affecting/affects
 * Y" relationship. Applies to ONE evidence assessment at a time — a
 * single excerpt is never 'mixed'; see RelationalSupportDirection for
 * the separate, backend-derived aggregate state.
 *
 * Establishes only "this excerpt is evidence relevant to the
 * relationship between X and Y in this sense" — never "X caused Y".
 * The backend cannot verify that a model-chosen direction is
 * semantically correct, only that the excerpt is real, verified text
 * from a real supplied article — see resolve-relational-evidence-
 * assessment.util.ts.
 */
export type RelationalEvidenceDirection =
  | 'requested-direction'
  | 'reverse-direction'
  | 'bidirectional'
  | 'association-only'
  | 'unclear'
  | 'non-substantive';

/**
 * Milestone #40 — a claim's aggregate relational-support state, backend-
 * derived from the set of validated RelationalEvidenceAssessments the
 * claim actually referenced (never from article co-membership alone).
 * 'mixed' is the ONLY value not possible on a single assessment — it
 * exists solely to represent disagreement across multiple assessments
 * supporting one claim (see RelationalSupport).
 */
export type RelationalSupportDirection = RelationalEvidenceDirection | 'mixed';

/**
 * Milestone #40 — one backend-validated evidence excerpt and its
 * semantic direction. `articleId` is always the real, canonical
 * article ID — never a request-local evidenceId. `excerpt` is
 * independently verified (Milestone #32-style substring check) against
 * the exact text supplied to the model for that article. Never implies
 * causal proof — see RelationalEvidenceDirection's doc comment.
 */
export interface RelationalEvidenceAssessment {
  articleId: string;
  excerpt: string;
  direction: RelationalEvidenceDirection;
}

/**
 * Milestone #40 — additive, optional field on a claim/agreement/
 * position/timeline entry. Present only when the entry explicitly
 * referenced one or more backend-validated relational evidence
 * assessments (never inferred from merely sharing an article with an
 * unrelated assessment — see the M40 design's Case 9 regression).
 *
 * `direction` is the aggregate across every assessment in
 * `assessments`: if all agree, that shared direction; if they
 * disagree, 'mixed'. Only 'requested-direction' and 'bidirectional'
 * count as direct support for the user's requested relationship —
 * 'mixed', 'reverse-direction', 'association-only', 'unclear', and
 * 'non-substantive' all mean this entry is NOT treated as supporting
 * evidence for the requested direction, even though the evidence
 * itself remains visible in `assessments` (reverse/contradicting
 * evidence is never discarded).
 *
 * No request-local assessmentId or evidenceId ever appears here or
 * anywhere downstream — both are purely internal validation-time
 * lookup keys, exactly like M31's evidenceId.
 */
export interface RelationalSupport {
  direction: RelationalSupportDirection;
  assessments: RelationalEvidenceAssessment[];
}

/**
 * ════════════════════════════════════════════════════════════════════════════
 * J-3 — WHAT KIND OF ASSERTION A CLAIM IS MAKING
 * ════════════════════════════════════════════════════════════════════════════
 *
 * CTO ruling: *"An interpretive label must not silently become GlobalNews AI's
 * own factual assertion unless the cited evidence directly supports that
 * characterization … Prefer preserving attribution structurally rather than
 * post-processing prose after generation."*
 *
 * THE MEASURED CASE. "Russia issued a threat to Poland…" collapses four separate
 * questions into one sentence the product then asserts in its own voice:
 *
 *   1. does the evidence support RUSSIA as the actor, or a ministry/official?
 *   2. does it identify a more precise speaker than the country?
 *   3. does it support the statement itself?
 *   4. does the SOURCE call it a threat — or is that our word?
 *
 * A reader cannot tell which parts are reported and which are ours, because the
 * sentence has no structure to carry the difference.
 *
 * TWO KINDS, NOT THREE. An interpretive characterisation is not a third kind of
 * key fact — it is a kind that does not belong in key facts at all, unless the
 * evidence itself makes the characterisation, in which case it is a REPORTED
 * STATEMENT attributed to whoever made it.
 */
export type ClaimAssertionKind =
  /** The evidence establishes this proposition. Stated in the product's voice. */
  | 'FACT'
  /**
   * Someone said this. The product reports THAT THEY SAID IT, which is a
   * different assertion from the content being true, and requires a speaker.
   */
  | 'REPORTED_STATEMENT';

/**
 * Who made a reported statement, as precisely as the evidence names them.
 *
 * REQUIRED whenever assertion is 'REPORTED_STATEMENT'. A reported statement
 * with no speaker is indistinguishable from a fact, which is the collapse this
 * exists to prevent — so the validator DROPS such an entry rather than
 * inventing an attributor or silently downgrading it to a fact.
 */
export interface StatementAttribution {
  /**
   * The most precise attributor the evidence supports: a named official or
   * ministry where one is given, the institution where it is not, and the
   * country only when the evidence attributes it no more precisely than that.
   */
  speaker: string;
  /** The reporting verb the evidence uses — said, announced, warned, denied. */
  verb?: string;
}

export interface SourcedClaim {
  claim: string;
  /**
   * J-3 — additive and optional. Absent means a result produced before this
   * distinction existed, and readers must treat it exactly as they always did.
   */
  assertion?: ClaimAssertionKind;
  /** J-3 — present only for REPORTED_STATEMENT, and required there. */
  attribution?: StatementAttribution;
  sourceArticleIds: string[];
  /** Milestone #32 — additive; absent on results generated before this milestone. */
  evidenceBreadth?: EvidenceBreadth;
  /** Milestone #32 — additive; present only when backend-validated. */
  evidenceBasis?: EvidenceBasis;
  /** Milestone #40 — additive; present only when backend-validated. See RelationalSupport doc comment. */
  relationalSupport?: RelationalSupport;
}

export interface AgreementPoint {
  point: string;
  sourceArticleIds: string[];
  evidenceBreadth?: EvidenceBreadth;
  evidenceBasis?: EvidenceBasis;
  relationalSupport?: RelationalSupport;
}

export interface DifferencePosition {
  description: string;
  sourceArticleIds: string[];
  evidenceBreadth?: EvidenceBreadth;
  evidenceBasis?: EvidenceBasis;
  relationalSupport?: RelationalSupport;
}

export interface DifferenceItem {
  topic: string;
  positions: DifferencePosition[];
}

export interface TimelineEvent {
  /** ISO-8601 timestamp. */
  timestamp: string;
  event: string;
  sourceArticleIds: string[];
  evidenceBreadth?: EvidenceBreadth;
  evidenceBasis?: EvidenceBasis;
  relationalSupport?: RelationalSupport;
}

/**
 * Milestone #31 — a case where the supplied evidence does not establish
 * a conclusion (e.g. "reports conflict", "this remains unconfirmed").
 * `sourceArticleIds` names the articles the uncertainty concerns, if
 * any — it may be empty when the gap is general rather than tied to a
 * specific supplied article. Additive alongside `unknowns` (free-text,
 * unchanged) rather than a replacement for it — see
 * NewsAnalysisResult.unknowns.
 */
export interface UncertaintyItem {
  description: string;
  sourceArticleIds: string[];
}

/**
 * Milestone #42 — MODEL SELF-ASSESSMENT METADATA ONLY. This is what the
 * AI provider itself reported about its own confidence — validated only
 * for shape (enum membership, numeric clamp to 0-100), never cross-
 * checked against grounding, corroboration, contradiction, or any other
 * deterministic signal. It is NOT the authoritative trust signal for
 * this analysis — see NewsAnalysisResult.trustState, which is derived
 * entirely independently by the backend and does not read this field at
 * all. Retained unmodified for backward compatibility; a future
 * frontend milestone is required to stop presenting this prominently as
 * if it were the authoritative trust level (see TrustState's own doc
 * comment for the full authority hierarchy).
 */
export interface ConfidenceInfo {
  level: ConfidenceLevel;
  /** 0-100. */
  score: number;
  explanation: string;
}

/**
 * Milestone #42 — the closed, language-neutral set of reasons a
 * TrustState can cite. These are stable structured codes, never English
 * prose — a future frontend localization layer maps each code to
 * human-readable text in the user's language. The backend remains the
 * sole authority on WHICH codes apply; it never generates or trusts
 * free-text explanations for trust derivation.
 */
export type TrustReason =
  | 'no-grounded-evidence'
  | 'single-distinct-article'
  | 'multiple-distinct-articles'
  | 'relational-support-adequate'
  | 'relational-support-limited'
  | 'requested-direction-unsupported'
  | 'reverse-evidence-present'
  | 'mixed-evidence-present'
  | 'uncertainties-reported'
  | 'differences-reported'
  | 'mock-execution';

export type TrustLevel = 'high' | 'moderate' | 'limited' | 'insufficient';

/**
 * Milestone #42 — AUTHORITATIVE BACKEND ANSWER-LEVEL TRUST STATE.
 *
 * AUTHORITY HIERARCHY (highest to lowest):
 * 1. TrustState (this) — authoritative backend answer-level trust.
 * 2. RelationalComposition — authoritative backend relational conclusion
 *    (Milestone #41); TrustState CONSUMES this, never re-derives it.
 * 3. evidenceBasis / evidenceBreadth / validated claims (Milestone #32) —
 *    supporting evidence structures.
 * 4. uncertainties / differences — bounded caveat/information structures.
 * 5. ConfidenceInfo (analysis.confidence) — model self-assessment
 *    metadata only, NEVER an input to this derivation.
 * 6. NewsArticle.confidence — retrieval/ranking signal only, unrelated
 *    to answer trust.
 * 7. AnalysisRetrievalContext.matchConfidence — geographic/query-
 *    resolution signal only, unrelated to answer trust.
 *
 * Derived entirely deterministically, entirely backend-side, from
 * already-validated structures plus the already-authoritative
 * analysisMode supplied to validateAnalysisResult() — see
 * derive-trust-state.util.ts. Never reads or is influenced by
 * `analysis.confidence`, provider prose, or any other model-self-
 * reported value.
 *
 * `reasons` are stable, language-neutral TrustReason codes — never
 * backend-authored English prose — a future frontend localization layer
 * is responsible for turning these into human-readable text.
 *
 * MOCK HARD OVERRIDE: whenever the analysis was produced in mock
 * execution mode, `level` is always 'insufficient' and `reasons` is
 * always exactly `['mock-execution']`, regardless of how many mock
 * articles/claims exist — see derive-trust-state.util.ts.
 *
 * NON-RELATIONAL 'high' IS NOT ACHIEVABLE in this milestone — ordinary
 * (non-relational) analyses have no structural per-conclusion
 * corroboration mechanism analogous to Milestone #41's relational one,
 * so `distinctSourceArticleCount` alone can never justify 'high'. This
 * is an intentional, disclosed limitation, not an oversight — see
 * derive-trust-state.util.ts's own doc comment.
 */
export interface TrustState {
  level: TrustLevel;
  reasons: TrustReason[];
  /**
   * Distinct validated article IDs represented across grounded
   * keyFacts/agreements/differences.positions/timeline. A breadth
   * measure of the analysis as a whole — NOT a claim that all of them
   * corroborate the same specific conclusion, and NOT a claim of
   * editorial/publisher independence.
   */
  distinctSourceArticleCount: number;
  /**
   * Relational-path only. True iff at least one claim's aggregate
   * relationalSupport.direction is 'reverse-direction' or 'mixed' —
   * both are structurally validated disagreement signals (Milestone
   * #40), never inferred from prose. association-only/unclear/
   * non-substantive evidence alone never sets this true.
   */
  relationalContradictionPresent?: boolean;
  /** = differences.length. Informational only — never implies contradiction or downgrades level. */
  differenceTopicCount: number;
  /** = uncertainties.length. Informational only — never implies severity or downgrades level. */
  uncertaintyCount: number;
  /** Present only when relationalComposition exists — mirrors relationalComposition.evidenceSufficiency exactly. */
  relationalEvidenceSufficiency?: EvidenceSufficiency;
}

export interface AnalysisEntities {
  countries: string[];
  locations: string[];
  people: string[];
  organizations: string[];
  topics: string[];
}

export interface AnalysisSourceRef {
  articleId: string;
  publisher: string;
  title: string;
  url: string;
  /** ISO-8601 timestamp. */
  publishedAt: string;
}

/**
 * Milestone #62 Phase 2 — the closed set of affected-party categories.
 * A plain string, not an enum-like closed union of prose, so the
 * frontend can group/label consistently without parsing free text.
 */
export type AffectedPartyType = 'person' | 'organization' | 'country' | 'region' | 'group' | 'other';

/**
 * Milestone #62 Phase 2 — one evidence-grounded affected-party entry.
 * Unlike context/relevance/immediateImpacts/spilloverImplications
 * (all plain SourcedClaim[], since each entry is a single
 * self-contained idea), "who is affected" and "how they're affected"
 * are two genuinely distinct questions bundled into one entity here —
 * collapsing them into one opaque claim string would lose the ability
 * to group by party/type that this field exists to provide. Uses the
 * SAME evidence-grounding fields as SourcedClaim (sourceArticleIds/
 * evidenceBreadth/evidenceBasis) — no separate citation system, only
 * the content shape differs.
 */
export interface AffectedParty {
  party: string;
  partyType: AffectedPartyType;
  effect: string;
  sourceArticleIds: string[];
  evidenceBreadth?: EvidenceBreadth;
  evidenceBasis?: EvidenceBasis;
}

/**
 * Milestone #62 Phase 3 — the closed set of significance/severity
 * levels. 'critical' carries a deliberately strengthened evidentiary
 * bar (see the prompt instructions in build-analysis-prompt.util.ts):
 * either an explicit authoritative designation of exceptional
 * severity, or multiple independent objective high-severity
 * indicators together — never a single isolated signal, and never
 * inferred from dramatic-sounding language alone.
 */
export type SignificanceLevel = 'minor' | 'moderate' | 'major' | 'critical';

/**
 * Milestone #62 Phase 3 — an evidence-grounded judgment of event
 * magnitude/consequence. Deliberately SEPARATE from trustState
 * (backend-derived evidence trust), confidence (model self-
 * assessment), and evidence sufficiency — a story can be highly
 * significant but poorly evidenced, or well evidenced but low
 * significance; this field says nothing about either of the other
 * two. `rationale` uses the SAME SourcedClaim evidence-grounding
 * model as every other field — no separate citation system. Capped
 * at 2 surviving entries — see validate-analysis-result.ts.
 */
export interface Significance {
  level: SignificanceLevel;
  rationale: SourcedClaim[];
}

/**
 * Milestone #62 Phase 4, second hardening — the deliberately narrow,
 * non-catch-all set of future-hinge categories a watchNext item must
 * fit. No "other"/"unknown"/generic fallback value exists on purpose:
 * if an item cannot truthfully fit one of these five categories, the
 * model is instructed to omit it entirely rather than force-fit it.
 */
export type WatchNextHingeType =
  | 'pending_response'
  | 'scheduled_event'
  | 'announced_action'
  | 'deadline'
  | 'forthcoming_report';

/**
 * Milestone #62 Phase 4, second hardening — like SourcedClaim, but
 * with an added required hingeType categorizing which kind of future
 * hinge the item represents. evidenceBasis stays optional at the TYPE
 * level (matching SourcedClaim's own convention) but is enforced as
 * effectively required by the validator for this field specifically
 * — the same pattern already established in the first hardening
 * round, unchanged here.
 */
export interface WatchNextItem {
  claim: string;
  hingeType: WatchNextHingeType;
  sourceArticleIds: string[];
  evidenceBreadth?: EvidenceBreadth;
  evidenceBasis?: EvidenceBasis;
}

/**
 * The validated, structured result of analyzing a set of news articles.
 * Every keyFact/agreement/difference-position/timeline entry must cite
 * at least one sourceArticleId from `sources` — ungrounded entries are
 * filtered out by the backend before this ever reaches the frontend.
 */
export interface NewsAnalysisResult {
  query: string;
  headline: string;
  summary: string;
  keyFacts: SourcedClaim[];
  agreements: AgreementPoint[];
  differences: DifferenceItem[];
  unknowns: string[];
  timeline: TimelineEvent[];
  confidence: ConfidenceInfo;
  entities: AnalysisEntities;
  sources: AnalysisSourceRef[];
  /** ISO-8601 timestamp. */
  generatedAt: string;
  analysisMode: AnalysisMode;

  /**
   * Milestone #42 — the authoritative backend trust signal. Always
   * present on a validated result (required, not optional) — see
   * derive-trust-state.util.ts's own doc comment for why this is safe:
   * validateAnalysisResult() is the sole constructor of
   * NewsAnalysisResult, and no persistent cache/storage of full
   * analysis results exists (only the in-memory, process-local
   * AnalysisService cache, cleared on every restart). See TrustState's
   * own doc comment for the full authority hierarchy — `confidence`
   * above is model self-reported metadata only and is never consulted
   * when deriving this field.
   */
  trustState: TrustState;

  /**
   * Milestone #31 — grounded insufficient-evidence / disagreement-adjacent
   * items, each optionally tied to specific supplied articles via
   * sourceArticleIds. Additive: `unknowns` (free-text, ungrounded) is
   * preserved unchanged for backward compatibility. Always present as an
   * array (possibly empty) on a validated result; optional only so older
   * callers/tests that don't set it still satisfy the type.
   */
  uncertainties?: UncertaintyItem[];

  /**
   * Milestone #40 — every backend-validated relational evidence
   * assessment for this analysis, regardless of whether any claim
   * ended up referencing it. Reverse-direction, association-only,
   * unclear, and non-substantive assessments are always included here
   * — this array is never filtered down to only "supporting" evidence,
   * so contradicting/counter evidence remains visible even when no
   * claim cites it. Empty when the query wasn't relational, the
   * provider emitted nothing valid, or analysisMode is 'mock-ai'
   * (MockAnalysisProvider never fabricates semantic assessments).
   * Optional only so pre-M40 callers/tests still satisfy the type;
   * always an array (possibly empty) on a freshly validated result.
   */
  relationalEvidenceAssessments?: RelationalEvidenceAssessment[];

  /**
   * Milestone #41 — the trusted, deterministically backend-derived
   * relational answer, present ONLY when relationalContextPresent was
   * true for this request (see AnalysisService/validateAnalysisResult).
   * Undefined for every non-relational request (ordinary M35/M36
   * generic queries, country/city retrieval) — see
   * build-relational-composition.util.ts.
   *
   * AUTHORITY: when present, `relationalComposition.summary` is the
   * authoritative answer to the user's relational question — `headline`
   * and `summary` above remain legacy orientation prose only, validated
   * merely for non-emptiness, and must NOT be presented as if they
   * resolve a relational question. Enforcing this at render time is
   * REQUIRED FUTURE WORK for the frontend milestone that consumes this
   * field — it is not automatically enforced by this field's mere
   * existence.
   *
   * Every field here is derived entirely by the backend from already-
   * validated relationalSupport data on keyFacts/agreements/
   * differences.positions/timeline entries — there is no model-facing
   * schema for this structure at all, and no model-written prose
   * anywhere in it (`summary` is selected from a fixed backend template
   * set — see build-relational-composition.util.ts).
   */
  relationalComposition?: RelationalComposition;

  /**
   * Milestone #62 Phase 1 — evidence-grounded background facts
   * necessary to understand the current development (historical,
   * institutional, or geographic context), using the SAME SourcedClaim
   * evidence-grounding model as keyFacts — no separate citation
   * system. Always an array (never undefined) on a validated result;
   * empty means the supplied evidence did not establish any useful
   * background beyond the immediate facts, never a fabricated filler
   * claim. Capped at 4 surviving entries after grounding/filtering —
   * see validate-analysis-result.ts.
   */
  context: SourcedClaim[];

  /**
   * Milestone #62 Phase 1 — evidence-grounded claims answering "why
   * does this matter", using the SAME SourcedClaim model. Always an
   * array (never undefined); empty means no meaningful relevance
   * claim could be grounded in the supplied evidence — never an
   * inflated or inferred importance claim. Capped at 3 surviving
   * entries — see validate-analysis-result.ts.
   */
  relevance: SourcedClaim[];

  /**
   * Milestone #62 Phase 2 — evidence-grounded parties (people,
   * organizations, countries, regions, or groups) the supplied
   * evidence explicitly describes as affected, and how. Always an
   * array (never undefined); empty means the evidence did not
   * identify specific affected parties. Capped at 6 surviving
   * entries — see validate-analysis-result.ts.
   */
  affectedParties: AffectedParty[];

  /**
   * J-2 — WHY A DIMENSION IS EMPTY, WHEN THE BACKEND KNOWS.
   *
   * An empty dimension has two causes and they are opposite facts about the
   * evidence: either the model proposed nothing (the reporting is silent), or
   * it proposed entries and every one failed grounding (the reporting did not
   * support what was drafted). A bare zero tells the reader neither and quietly
   * implies the first.
   *
   * Keyed by response field name, e.g. `relevance`, `immediateImpacts`.
   * OPTIONAL, so every pre-existing consumer and every hand-built test double is
   * unaffected: absent means "this result was produced before the census
   * existed", which readers already handle as "no reason available".
   *
   * DIAGNOSTIC, NOT COPY. These counts must never be rendered to a reader as
   * numbers; a surface derives a truthful sentence from them.
   */
  dimensionGrounding?: Record<string, { generated: number; accepted: number; rejected: number }>;

  /**
   * Milestone #62 Phase 2 — direct, already-occurring effects the
   * supplied evidence explicitly states, using the SAME SourcedClaim
   * model as context/relevance. Always an array; empty means no
   * groundable immediate effect was stated. Capped at 4 entries.
   */
  immediateImpacts: SourcedClaim[];

  /**
   * Milestone #62 Phase 2 — wider or secondary effects EXPLICITLY
   * discussed in the supplied evidence — never the model's own
   * extrapolation of what might plausibly follow. Always an array;
   * empty means no groundable spillover effect was stated. Capped at
   * 4 entries.
   */
  spilloverImplications: SourcedClaim[];

  /**
   * Milestone #62 Phase 3 — evidence-grounded significance/severity
   * judgment. `null` is the required insufficient-evidence state —
   * never defaulted to 'minor' or any other level when the evidence
   * doesn't support a defensible judgment. Never read by trustState
   * or confidence derivation, and never derived from either of them.
   */
  significance: Significance | null;

  /**
   * Milestone #62 Phase 4 (final M62 phase) — concrete forthcoming or
   * unresolved developments EXPLICITLY signalled by the supplied
   * evidence, each tagged with a narrow, deliberately non-catch-all
   * hingeType (see WatchNextHingeType below). Always an array; empty
   * means the evidence did not explicitly signal any forthcoming
   * development that fits an approved category — never filler, and
   * [] is preferred over an unsupported item. Capped at 4 entries.
   *
   * Second-hardening note (post-first-hardening runtime finding): the
   * first hardening round required evidenceBasis to be present and
   * M32-verified, which closes "no real excerpt at all" and
   * "fabricated excerpt" — but a real excerpt can still describe an
   * already-completed event ("Moscow hits infrastructure") cited in
   * support of a forward-looking claim. Requiring a structured
   * hingeType is a real, evidence-based compliance improvement (models
   * follow explicit categorical commitments more reliably than free
   * prose), but it is NOT a semantic proof that the claim/excerpt
   * genuinely match the declared category — the validator can only
   * check that hingeType is present and one of the five allowed
   * values, never that the classification is truthful.
   */
  watchNext: WatchNextItem[];

  /**
   * ══════════════════════════════════════════════════════════════════════
   * C907 CORRECTION 3 — WAS THIS EXECUTIVE BRIEF ACCEPTED, OR WITHHELD?
   * ══════════════════════════════════════════════════════════════════════
   *
   * THE RULING, in its own words: *"KNOWN NON-COMPLIANT EXECUTIVE BRIEF !=
   * ACCEPTED EXECUTIVE BRIEF."* When the structural check (C906 ruling D)
   * fails and the ONE permitted repair fails too, the product knows the brief
   * is non-compliant. It must not then present it as the answer.
   *
   * WHAT THIS FIELD IS. The machine-readable record of that decision,
   * attached to the analysis it describes. `availability: 'accepted'` means
   * `summary` is a brief the product stands behind.
   * `availability: 'withheld-non-compliant'` means the opposite, and on that
   * path `summary` IS THE EMPTY STRING — the non-compliant prose is not
   * transmitted at all, so no surface can render it by omission or by
   * accident. Withholding, not flagging, is what makes this fail CLOSED.
   *
   * WHAT IS RETAINED. Everything else. The ruling is explicit: *"while
   * retaining the rest of the valid analysis record"*. keyFacts, agreements,
   * differences, timeline, context, relevance, impacts, watchNext, entities,
   * sources and trustState are each independently validated and individually
   * evidence-cited; none of them depends on the summary's paragraph shape, and
   * discarding them would punish a reader for a prose defect.
   *
   * NO EXTRA CALL WAS MADE TO PRODUCE THIS. *"Do not invent another AI call."*
   * This is a verdict over work already done, never a third request.
   *
   * OPTIONAL FOR COMPATIBILITY ONLY. Absent means "not assessed" and MUST be
   * read as accepted by consumers — pre-C907 callers and fixtures do not set
   * it. A freshly produced analysis always carries it.
   */
  briefState?: ExecutiveBriefState;
}

/**
 * C907 — whether the Executive Brief in this record may be presented.
 *
 * Deliberately two values and not a severity scale. There is exactly one
 * structural requirement (C906 ruling D: a multi-development evidence set may
 * not be answered with a single blended paragraph), so there is exactly one
 * way to be withheld, and a wider vocabulary would invite a future "partially
 * accepted" that means nothing.
 */
export type ExecutiveBriefAvailability = 'accepted' | 'withheld-non-compliant';

/** C907 — see NewsAnalysisResult.briefState. */
export interface ExecutiveBriefState {
  readonly availability: ExecutiveBriefAvailability;
  /**
   * Distinct reporting clusters in the retrieved evidence, as measured by the
   * SAME clustering pass that built the provider's input. A figure, not a
   * judgment.
   */
  readonly clusters: number;
  /** Distinct editorial domains across that same retrieved evidence. */
  readonly categories: number;
  /**
   * True when a targeted repair was actually requested of the provider.
   *
   * ALPHA BUDGET R1 — WHAT FALSE MEANS NOW, STATED RATHER THAN LEFT TO DRIFT.
   * This used to promise that false "never" meant a repair was skipped. That
   * promise no longer holds and the field must say so: the synchronous repair
   * has been REMOVED from the analysis critical path, because it was a second
   * full `provider.analyzeNews()` regeneration (measured LARGER than the
   * original — 6,689 tokens against 6,367) that pushed a successful response
   * past the client deadline.
   *
   * So on the current synchronous path this is ALWAYS false, and it means: no
   * repair was requested. It does NOT mean the brief was accepted — read
   * `availability` for that, which is unchanged and still fail-closed. If a
   * governed asynchronous repair is introduced later, this field is where it
   * reports, and it can become true again without changing its meaning.
   */
  readonly repairRequested: boolean;
  /**
   * Plain English, present ONLY when withheld: what was wrong with the brief.
   * It describes the SHAPE of the answer and never its content, because the
   * check only ever judged shape.
   */
  readonly reason?: string;
}

/**
 * Milestone #41 — does at least one FINAL VALIDATED claim/agreement/
 * position/timeline entry have an aggregate relationalSupport.direction
 * of 'requested-direction' or 'bidirectional'? A 'mixed' aggregate
 * NEVER contributes, even if its underlying assessments include a
 * requested-direction one (M40's own aggregation already collapsed
 * that disagreement into 'mixed' — this field does not reach back
 * into individual assessments to reverse that).
 *
 * This says only "does any legitimate supporting evidence exist" — see
 * EvidenceSufficiency for whether that evidence is adequate to answer
 * the question with reasonable confidence.
 */
export type DirectionalEligibility = 'supported' | 'unsupported';

/**
 * Milestone #41 — corroboration strength, measured by DISTINCT
 * validated article IDs backing 'requested-direction'/'bidirectional'
 * claims (never by claim count — two claims citing the same article are
 * one supporting article, not two). "Distinct articles" proves exactly
 * that: distinct article IDs. It does NOT prove editorial/publisher
 * independence, which this repository has no mechanism to establish.
 *
 * - 'insufficient': zero distinct supporting articles.
 * - 'limited': exactly one distinct supporting article, OR contradicted
 *   by reverse-direction/mixed evidence regardless of article count.
 * - 'adequate': two or more distinct supporting articles, with no
 *   reverse-direction or mixed evidence present.
 */
export type EvidenceSufficiency = 'adequate' | 'limited' | 'insufficient';

/**
 * Milestone #41 — a reference into the FINAL VALIDATED result's own
 * arrays, generated EXCLUSIVELY by the backend while iterating those
 * arrays after validation completes. There is no candidate/model-facing
 * equivalent of this type anywhere — no candidate index is ever read,
 * and no candidate-to-validated translation ever occurs. This makes
 * index-shift and duplicate-reference attacks structurally
 * inapplicable, not merely mitigated.
 */
export interface ClaimReference {
  section: 'keyFacts' | 'agreements' | 'differences' | 'timeline';
  index: number;
}

/**
 * Milestone #41 — the trusted relational composition. See
 * NewsAnalysisResult.relationalComposition's doc comment for the
 * authority statement, and build-relational-composition.util.ts for
 * the full derivation algorithm.
 */
export interface RelationalComposition {
  directionalEligibility: DirectionalEligibility;
  evidenceSufficiency: EvidenceSufficiency;
  /** Selected from a fixed backend template set — never model prose. */
  summary: string;
  /** Aggregate direction requested-direction | bidirectional. */
  supportingClaims: ClaimReference[];
  /** Aggregate direction reverse-direction — never discarded. */
  reverseClaims: ClaimReference[];
  /** Aggregate direction association-only — never discarded. */
  associationOnlyClaims: ClaimReference[];
  /** Aggregate direction mixed — never discarded, never eligible. */
  mixedClaims: ClaimReference[];
  /** Aggregate direction unclear or non-substantive — never discarded. */
  unclearOrNonSubstantiveClaims: ClaimReference[];
}

/**
 * Provenance of the article retrieval that fed an analysis, independent
 * of NewsAnalysisResult.generatedAt. Always present once retrieval has
 * been attempted — including when zero articles were found or the AI
 * provider failed afterward — so the frontend can explain where the
 * evidence came from even when `analysis` is null.
 *
 * generatedAt on the analysis reflects when the AI ran, not when the
 * underlying articles were published. This type carries the article
 * freshness/provenance signal instead, so the two are never conflated.
 */
export interface AnalysisRetrievalContext {
  /** Whether the underlying articles were live, cached, or mock. */
  dataMode: NewsDataMode;

  /** IDs of providers that contributed articles (empty for cached/unavailable retrieval). */
  providers: string[];

  /** Present only when dataMode is 'cached' or 'unavailable'. */
  fallbackReason?: NewsFallbackReason;

  /**
   * ISO-8601 publication timestamp of the newest retrieved article.
   * Only reliably available on the country-aware retrieval path today.
   * Describes evidence freshness — never a substitute for
   * NewsAnalysisResult.generatedAt.
   */
  newestArticlePublishedAt?: string;

  /**
   * The country the RETAINED reporting establishes. Set by country-aware
   * retrieval (CountryNewsService) and, since the R4 article-evidence
   * correction, also by article-anchored retrieval — where it is resolved from
   * the anchor article's own countryCode, or from the retained supporting
   * reports when they agree on one.
   *
   * DOC-ONLY CHANGE. The type and its runtime shape are unchanged; this
   * comment previously said "only when CountryNewsService was used", which
   * stopped being true when article-anchored retrieval began populating the
   * same two fields from evidence rather than from a country feed. Consumers
   * read these fields identically either way — see the frontend's
   * buildGeographicEvidenceState(), which decides evidence precision from
   * countryCode alone and is not modified by that correction.
   */
  countryCode?: string;
  countryName?: string;

  /** Present only when country-aware retrieval was used. */
  providerDisplayName?: string;

  /** Number of articles this retrieval produced (0 is valid and meaningful). */
  articlesRetrieved: number;

  /**
   * Present only when country-aware retrieval (CountryNewsService) was
   * used AND the query resolved via a curated city (see
   * LocationContext in countries.ts) rather than the country name
   * itself. Lowercase canonical form, e.g. "kigali" — pair with
   * countryName for display (e.g. "Kigali, Rwanda").
   */
  city?: string;

  /**
   * Present only when country/city resolution for this query came from
   * fuzzy geographic typo resolution (see geo-fuzzy-resolver.ts) rather
   * than an exact match. matchedFrom is the raw lowercase word the user
   * actually typed (e.g. "kigalli"); canonicalLocation is the curated
   * entity it was resolved to (e.g. "kigali"), which is also what
   * countryName/city above already reflect for retrieval purposes.
   * matchConfidence is a 0-100 provenance score, not a second decision
   * tier — a fuzzy match is only ever surfaced here once it has already
   * cleared the resolver's single confidence/ambiguity gate.
   *
   * These exist so the frontend can disclose the correction (e.g.
   * `Interpreted "Kigalli" as Kigali`) instead of silently presenting
   * results as if the user had typed the canonical spelling — the
   * user's own `query` (see AnalysisApiResponse) is never altered.
   */
  matchedFrom?: string;
  canonicalLocation?: string;
  matchConfidence?: number;

  /**
   * ══════════════════════════════════════════════════════════════════════
   * C907 §8 — THE MACHINE-READABLE RETRIEVAL OUTCOME
   * ══════════════════════════════════════════════════════════════════════
   *
   * THE RULING: *"Machine-readable outcomes must distinguish at least:
   * SUCCESS / NO_RELEVANT_EVIDENCE / PROVIDER_RATE_LIMITED /
   * PROVIDER_UNAVAILABLE / RETAINED_ONLY."*
   *
   * WHY THE EXISTING FIELDS WERE NOT ENOUGH. `dataMode` says where the bytes
   * came from and `fallbackReason` is a two-member union — 'no-live-results'
   * or 'provider-error'. Between them they cannot separate the two states the
   * Alpha failure turned on: a provider that ANSWERED and had nothing, and a
   * provider that REFUSED because the rate limit was exhausted. Both arrived
   * as "no live results", and a reader was told there was no news when there
   * was no quota. RATE_LIMITED IS NOT "NO NEWS EXISTS".
   *
   * Optional for compatibility: absent means a path that predates C907 and
   * makes no outcome claim at all. A consumer must not read absence as
   * SUCCESS.
   */
  outcome?: RetrievalOutcome;

  /**
   * C907 §8 — the DECLARED REGION this request was retrieved for, when the
   * typed question named one.
   *
   * IT IS A SCOPE, NEVER A PRECISION. The ruling is explicit: *"Requested
   * regional scope must never raise evidence precision."* Nothing in this
   * shape is an evidence id, a geography or a confidence, and the per-report
   * evidence geography on each article is untouched by it — an article
   * retrieved under an East Africa request still carries whatever country the
   * resolver found in that article's own text, and a report about Kenya does
   * not become a report about East Africa because East Africa is what was
   * asked.
   */
  requestedScope?: RequestedRegionScope;
  comparisonCoverage?: import('./comparison-coverage').ComparisonCountryCoverage[];
  storyContextUsed?: boolean;
  /**
   * ASK/SEARCH R1 CLOSURE — the evidence-state fact, stamped by
   * AnalysisService on every analysis response and passed to the model.
   * Derived only by `resolveEvidenceState`, so the model, the cache and the UI
   * read ONE value. Optional for compatibility: absent means a producer that
   * predates it, and consumers then derive it with the same function.
   */
  evidenceState?: AnalysisEvidenceState;
}

/**
 * ASK/SEARCH R1 CLOSURE — what the evidence behind an answer IS, as one value.
 *
 *   live                  current live retrieval produced the evidence.
 *   retained              stored (previously retrieved) reporting was used
 *                         because live retrieval answered with nothing usable.
 *   degraded-fallback     a live provider FAILED (timeout, rate limit, error);
 *                         any evidence present is stored reporting standing in.
 *   no-relevant-evidence  retrieval answered and nothing relevant exists. The
 *                         only state that is a statement about the corpus.
 *
 * Only `live` may be described as current. The other three are never live.
 */
export type AnalysisEvidenceState = 'live' | 'retained' | 'degraded-fallback' | 'no-relevant-evidence';

/** The single derivation. Pure; reads only fields the contract already carries. */
export function resolveEvidenceState(
  context: Pick<AnalysisRetrievalContext, 'dataMode' | 'fallbackReason' | 'outcome'>,
  articleCount: number,
): AnalysisEvidenceState {
  const failed =
    context.outcome === 'PROVIDER_UNAVAILABLE' ||
    context.outcome === 'PROVIDER_RATE_LIMITED' ||
    context.fallbackReason === 'provider-error';

  if (articleCount === 0) {
    if (context.outcome === 'NO_RELEVANT_EVIDENCE') return 'no-relevant-evidence';
    if (failed) return 'degraded-fallback';
    if (context.dataMode === 'unavailable' && context.fallbackReason !== 'no-live-results') {
      return 'degraded-fallback';
    }
    return 'no-relevant-evidence';
  }

  if (failed) return 'degraded-fallback';
  if (context.outcome === 'RETAINED_ONLY') return 'retained';
  if (context.dataMode === 'live') return 'live';
  return 'retained';
}

/**
 * C907 §8 — what retrieval actually did, as one value a machine can branch on.
 *
 * THE FIVE ARE NOT A SEVERITY LADDER; they are five different facts, and
 * collapsing any pair of them is how the Alpha defect happened:
 *
 *   SUCCESS                live retrieval produced relevant evidence.
 *   NO_RELEVANT_EVIDENCE   the providers ANSWERED and nothing matched. This is
 *                          the only outcome that means "there is no reporting",
 *                          and it is a statement about the corpus.
 *   PROVIDER_RATE_LIMITED  the provider refused because quota was exhausted.
 *                          A statement about US, never about the world.
 *   PROVIDER_UNAVAILABLE   the provider could not be reached or errored.
 *   RETAINED_ONLY          live retrieval failed AND previously retrieved
 *                          reporting for the SAME requested scope was served
 *                          in its place. Always disclosed, never silent.
 */
export type RetrievalOutcome =
  | 'SUCCESS'
  | 'NO_RELEVANT_EVIDENCE'
  | 'PROVIDER_RATE_LIMITED'
  | 'PROVIDER_UNAVAILABLE'
  | 'RETAINED_ONLY';

/**
 * C907 §8 — a product-governed region the typed question asked about.
 *
 * `members` is the DECLARED membership, fixed in the product's own
 * configuration and never inferred from a provider response or from the map
 * camera. `membersRetrieved` and `membersWithEvidence` are counts of what this
 * request actually did, so a reader can be told "8 of 11 members returned
 * reporting" instead of being shown an aggregate that hides which countries
 * are missing.
 */
export interface RequestedRegionScope {
  /** Stable id, e.g. 'east-africa'. */
  readonly id: string;
  /** Canonical English label, e.g. 'East Africa'. */
  readonly label: string;
  /** ISO 3166-1 alpha-3 codes. The declared membership, in declaration order. */
  readonly members: readonly string[];

  /**
   * ══════════════════════════════════════════════════════════════════════════
   * COVERAGE TELEMETRY — C907 §0.1(3) FINAL RULING
   * ══════════════════════════════════════════════════════════════════════════
   *
   * *"Return coverage telemetry sufficient to expose: membersDeclared,
   * membersAttempted, membersLiveRetrieved, membersRetainedOnly,
   * membersUnavailable … No country may be permanently excluded because of
   * declaration order … do not describe partial coverage as complete regional
   * coverage."*
   *
   * WHAT THIS REPLACES AND WHY. The first C907 shape carried `membersRetrieved`
   * and `membersWithEvidence` — two numbers that could not distinguish "we
   * asked and the provider had nothing" from "we never asked". The first
   * implementation took `slice(0, 6)` over the declared order, which is
   * alphabetical by ISO3, so RWA, SOM, SSD, TZA and UGA were never asked about
   * on ANY East Africa question — and `membersRetrieved: 6` disclosed the count
   * while hiding that it was always the same six. A count that cannot expose a
   * permanent exclusion is not telemetry.
   *
   * So the counts are now five, and they are joined by the two LISTS that make
   * them checkable: a reader can be told which members were reached and which
   * were not, by name, rather than being handed an aggregate.
   */

  /** How many members the region declares. Always the full membership. */
  readonly membersDeclared: number;
  /** How many a provider request was actually sent for, across all batches. */
  readonly membersAttempted: number;
  /** How many contributed at least one relevant LIVE article. */
  readonly membersLiveRetrieved: number;
  /** How many contributed only previously-retrieved (retained) reporting. */
  readonly membersRetainedOnly: number;
  /** How many were attempted and whose provider response was a failure. */
  readonly membersUnavailable: number;

  /** ISO3 codes a provider request was sent for, in attempt order. */
  readonly attempted: readonly string[];
  /**
   * ISO3 codes never attempted — a batch cut short by throttling, not a
   * membership decision. Empty on a complete pass.
   */
  readonly notReached: readonly string[];

  /**
   * True ONLY when every declared member was attempted and none was
   * unavailable.
   *
   * This field exists so that "do not describe partial coverage as complete
   * regional coverage" is a value a surface can branch on rather than a
   * sentence in a document. A partial answer stays a truthful answer; it must
   * simply not claim to be a whole one.
   */
  readonly coverageComplete: boolean;
}

/**
 * Milestone #29 — one canonical organization identity, deterministically
 * resolved from the retrieved articles' own text (see
 * organization-alias-resolver.util.ts and build-source-entities.util.ts
 * on the backend). Never touched by the AI provider and never merged
 * with NewsAnalysisResult.entities (AnalysisEntities), which is
 * AI-generated and ungrounded — this type and that one are deliberately
 * kept structurally separate so source-derived and AI-generated
 * entities can never be confused for one another.
 */
export interface ResolvedOrganizationMention {
  /** Canonical organization name, e.g. "United Nations". */
  canonical: string;
  /**
   * Every distinct surface form actually found across the source
   * articles that resolved to this canonical entity (e.g. ["United
   * Nations", "UN"]). Always has at least one entry — this is what
   * keeps the original wording recoverable; `canonical` is a display
   * convenience, never a replacement of what a source actually said.
   */
  matchedFrom: string[];
  /**
   * IDs of articles — always a subset of this same response's
   * `articles` — that mentioned this organization in any surface form.
   * An organization can never cite an article that isn't present in
   * `articles` (e.g. one removed by de-duplication or the analyzed-
   * article cap).
   */
  articleIds: string[];
}

/**
 * Milestone #29 — entities extracted and resolved deterministically
 * from the retrieved articles themselves, independent of whether AI
 * analysis succeeded. Always present on AnalysisApiResponse, the same
 * way retrievalContext always is, so that source-derived evidence
 * survives an AI-provider failure. Distinct from and never merged with
 * NewsAnalysisResult.entities (AnalysisEntities).
 */
export interface SourceEntities {
  organizations: ResolvedOrganizationMention[];
}

/**
 * Milestone #30 — deploy-mode flag. Whether the backend was started
 * with production AI expected (AI_EXECUTION_MODE=production, see
 * AnalysisStartupValidator) or in development mode, where mock
 * analysis is permitted when no provider key is configured.
 */
export type AnalysisExecutionMode = 'production' | 'development';

/**
 * Milestone #30 — the outcome of this specific request's attempt (or
 * non-attempt) to produce an analysis. Always reflects what actually
 * happened on THIS request, independent of `analysisMode` (which
 * reflects which provider the deployment is running, not whether it
 * was called this time).
 *
 * - "success": a validated NewsAnalysisResult was produced.
 * - "failed": the provider was called but failed (auth, timeout,
 *   network, rate limit, malformed output) — see failureReason.
 * - "validation-rejected": the provider returned a candidate, but it
 *   was fundamentally invalid and validateAnalysisResult() rejected
 *   it outright (not the same as individual ungrounded entries being
 *   silently dropped, which is not a rejection).
 * - "not-attempted": no AI call was made at all, because retrieval
 *   produced zero articles to analyze.
 */
export type AnalysisProvenanceStatus =
  | 'success'
  | 'failed'
  | 'validation-rejected'
  | 'not-attempted';

/**
 * Milestone #30 — machine-readable reason for a "failed" (or, for
 * "validation-rejected", the matching) provenance status. Deliberately
 * coarse-grained and provider-agnostic (no raw provider error text, no
 * HTTP status codes) so this can be surfaced to the frontend/logs
 * without ever risking a leaked secret or a raw upstream error message.
 */
export type AnalysisFailureReason =
  | 'provider-not-configured'
  | 'provider-auth'
  | 'provider-timeout'
  | 'provider-unavailable'
  | 'provider-rate-limited'
  | 'malformed-output'
  | 'validation-rejected';

/** Milestone #30 — OpenAI (or a future provider's) reported token usage, when available. */
export interface AnalysisTokenUsage {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}

/**
 * Milestone #30 — truthful, always-present provenance for an analysis
 * attempt. Unlike `NewsAnalysisResult.analysisMode` (only present when
 * `analysis` is non-null), this exists on every AnalysisApiResponse —
 * success, failure, validation rejection, or not-attempted — so the
 * frontend never has to infer what happened from the mere presence or
 * absence of `analysis`. Never includes a secret value or a raw
 * upstream provider error string.
 */
export interface AnalysisProvenance {
  /** The active AnalysisProvider's stable id, e.g. "openai", "mock-analysis". */
  provider: string;

  /** Model identifier actually used, when known. Absent for mock analysis. */
  model?: string;

  /** Deploy-mode flag this backend process was started with. */
  executionMode: AnalysisExecutionMode;

  /**
   * Which provider family produced (or would have produced) this
   * result: live-ai vs mock-ai. Reflects the boot-time-selected
   * provider, independent of whether a call was attempted this
   * request (see `status` for that).
   */
  analysisMode: AnalysisMode;

  /** What happened on this specific request. */
  status: AnalysisProvenanceStatus;

  /** Present only when status is "failed" or "validation-rejected". */
  failureReason?: AnalysisFailureReason;

  /** Wall-clock duration of the provider call attempt, in milliseconds. Absent when status is "not-attempted". */
  latencyMs?: number;

  /** True when this response (or the analysis/error it carries) was served from AnalysisService's in-memory cache rather than freshly computed. */
  cached: boolean;

  /** Present only for a successful live-AI call when the provider reported usage. */
  tokenUsage?: AnalysisTokenUsage;
}

/**
 * Envelope returned by POST /analysis/news. `analysis` is null when
 * analysis could not be produced (no articles found, AI provider
 * failure, invalid model response, etc.) — in that case `articles` may
 * still be populated so the frontend can show raw results with an
 * explanation instead of crashing.
 */
export interface AnalysisCoverageContext {
  /**
   * True when the user's wording asks about GlobalNews AI's own coverage,
   * retrieval count, source completeness or why only/few reports surfaced.
   * This is a product-observability intent, not a claim about the world.
   */
  questionAsksAboutCoverage: boolean;
  /** Articles in the original retrieval pool before clustering/capping. */
  retrievedArticleCount: number;
  /** Reporting clusters in that original pool. */
  reportingClusterCount: number;
  /** Providers that actually contributed admitted articles. */
  contributingProviders: string[];
  /** Whether this retrieval is known to be live, retained/cached, or unavailable. */
  dataMode: NewsDataMode;
  outcome?: RetrievalOutcome;
  /**
   * Explicit guardrail for the reader: a bounded retrieval can never prove
   * that it represents all news about a country/topic.
   */
  comprehensiveCoverageEstablished: false;
}

export interface AnalysisApiResponse {
  /** The user's original, verbatim question — never rewritten. */
  query: string;

  /**
   * Milestone #47 — the UI/response language the caller requested.
   * Absent request field defaults to 'en' for full backward
   * compatibility with existing callers that never send it. This is
   * NOT an evidence/source-language field — see SourceLanguage-related
   * fields on NewsArticle for that separate concept.
   */
  requestedLanguage: LanguageCode;

  /**
   * Milestone #47 — the language the analysis was ACTUALLY produced
   * in. Always present, always truthful — this is what the AI
   * provider was instructed to respond in for this specific request,
   * never an aspirational or requested-but-unfulfilled value.
   */
  responseLanguage: LanguageCode;

  /**
   * The deterministically-normalized form of `query` used internally
   * for retrieval and caching (see normalizeQuery in
   * query-normalization.ts). Equal to `query` when no normalization
   * was applied. Never used to silently replace what's shown to the
   * user — display should always prefer `query`.
   */
  normalizedQuery: string;

  analysis: NewsAnalysisResult | null;
  articles: NewsArticle[];
  analysisError?: string;
  retrievalContext: AnalysisRetrievalContext;
  sourceEntities: SourceEntities;

  /**
   * Milestone #30 — always present, on every response shape (success,
   * failure, validation rejection, not-attempted, cached or fresh).
   * See AnalysisProvenance.
   */
  provenance: AnalysisProvenance;

  /**
   * Milestone #43 — structural diversity metadata describing the
   * ORIGINAL retrieved article pool for this request, computed BEFORE
   * duplicate clustering, the maxArticles cap, provider execution,
   * model citation selection, or validation. Deliberately lives here,
   * not on NewsAnalysisResult — it describes pre-validation retrieval
   * data, not the validated analysis contract.
   *
   * DOES NOT redefine, replace, or feed into: TrustState.
   * distinctSourceArticleCount (Milestone #42, counts only validated,
   * model-cited article IDs from a narrower, later-stage population),
   * relationalComposition.evidenceSufficiency (Milestone #41), TrustLevel,
   * TrustReason, or analysis.confidence. This field has no effect on
   * trust scoring in Milestone #43 — see SourceDiversity's own doc
   * comment for what it can and cannot prove.
   *
   * Optional: at least 3 distinct code paths in AnalysisService
   * construct an AnalysisApiResponse (an early empty-articles return,
   * and 2 further branches inside the main success/failure flow) —
   * unlike NewsAnalysisResult (which has exactly one constructor,
   * validateAnalysisResult()), this field's presence has not been
   * proven safe to make required across every one of those paths.
   */
  sourceDiversity?: SourceDiversity;

  /**
   * Beta coverage-awareness R1. Present for coverage/system questions so
   * Ask can answer "why only two?" without pretending the evidence set is
   * the entire real-world news picture.
   */
  coverageContext?: AnalysisCoverageContext;
}

/**
 * Milestone #43 — structural evidence source-diversity metadata for the
 * ORIGINAL retrieved article pool (before clustering/capping/citation —
 * see AnalysisApiResponse.sourceDiversity's own doc comment for the
 * exact population and non-authority statement).
 *
 * WHAT THIS CANNOT PROVE: genuine editorial independence, true
 * syndication/wire-copy origin (no attribution metadata exists in this
 * repository), or publisher organizational relationships. A higher
 * `knownDomainCount` or `distinctSourceNameCount` means more distinct
 * hostnames/provider-supplied names were observed — nothing more.
 * "Duplicate-like" clustering (reused unchanged from
 * cluster-articles.util.ts) is a deterministic title/URL heuristic, not
 * proof of common origin.
 */
export interface SourceDiversity {
  /** Total articles in the original retrieved pool, before clustering or the maxArticles cap. */
  retrievedArticleCount: number;
  /** Total number of clusters found (clusterArticlesWithMembership's own grouping — same algorithm as clusterDuplicateArticles(), unchanged). */
  reportingClusterCount: number;
  /** Number of those clusters with 2+ members — i.e., clusters where a duplicate-like repeat was actually detected. */
  duplicateLikeClusterCount: number;
  /** Size of the single largest cluster. 0 when retrievedArticleCount is 0. */
  largestClusterSize: number;
  /** Distinct normalized hostnames (lowercase, leading "www." stripped, no other subdomain collapsing) among articles with a parseable URL. */
  knownDomainCount: number;
  /** Count of articles whose URL could not be parsed into a hostname at all — never counted as their own distinct domain. */
  unknownDomainArticleCount: number;
  /**
   * Distinct non-empty (post-trim-check) raw provider-supplied
   * sourceName values. Empty/missing/whitespace-only values are
   * excluded entirely and never increase this count. Non-empty values
   * are never lowercased, normalized, aliased, or merged — this is raw
   * provider metadata, not verified publisher identity.
   */
  distinctSourceNameCount: number;
}

/**
 * Milestone #51 Phase B — bounded, optional context identifying a
 * specific story the user selected (e.g. from the World Map country
 * feed) before asking GlobalNews AI a question, so retrieval can be
 * anchored to that story's real country/topic instead of re-deriving
 * it (unreliably) from free-text query parsing alone.
 *
 * Deliberately NOT a full NewsArticle — only the minimal fields
 * retrieval anchoring and display actually need. `title` is required
 * (the field the query text itself was already built from) so this
 * type is never meaningfully "empty"; everything else is optional
 * because not every story-originated request has it available.
 *
 * `countryCode` is the primary anchor AnalysisService uses to bypass
 * its own free-text country-detection heuristic when present — see
 * AnalysisService.analyzeNews. Any ISO2/ISO3/name string that
 * resolveCountryByAnyIdentifier() already accepts is valid here; this
 * type does not further constrain the format.
 */
export interface StoryContext {
  title: string;
  articleId?: string;
  url?: string;
  sourceName?: string;
  countryCode?: string;
}
