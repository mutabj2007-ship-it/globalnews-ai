import type { OfficialSourceClass } from './officialSources';

/**
 * C2-2 — THE MULTI-SOURCE PROVENANCE MODEL.
 *
 * WHAT THIS EXISTS TO FIX. Until now every retrieved record was, implicitly, a
 * news article: `NewsArticle` carries `providerId`, `sourceName` and a URL, and
 * nothing anywhere records what KIND of source produced it or what role the
 * record plays as evidence. That was survivable while exactly one news
 * provider was active. It is not survivable for a pipeline that is meant to
 * hold journalism, a government statement and a statistical release side by
 * side and let Analysis tell them apart.
 *
 * Three fields already on `NewsArticle` — `sourceAuthorityClass`,
 * `evidencePrecision`, `geographicPrecision` — were declared for this purpose
 * and are written by NOTHING today; the frontend even renders "No data"
 * because of it. This model is the missing producer side, not a replacement
 * for those fields.
 *
 * ADDITIVE BY CONSTRUCTION. Every field here is optional and every existing
 * consumer keeps compiling and behaving identically. Nothing in this file
 * changes an existing type's required shape, and no existing field's meaning
 * is redefined.
 *
 * HONESTY RULE, INHERITED FROM THE REST OF THIS CODEBASE. Every field is
 * OBSERVED, never inferred to fill a gap. A record whose institution is
 * unknown carries no institution — not a guess derived from its domain, and
 * not a placeholder. `OfficialSourceEntry.reliabilityNote` already sets this
 * precedent by refusing to be "a fabricated numeric trust score", and the same
 * rule applies to every field below.
 */

/**
 * ── B3.1 · WHY `SourceType` IS IMPORTED HERE AND NOT DECLARED ─────────────
 *
 * The canonical module declared `SourceType` itself. The sealed candidate
 * already declares it in `./source-type`, and both modules reach the package
 * barrel through `export *` — so recovering the declaration would DOUBLE-EXPORT
 * the symbol and break the barrel.
 *
 * MEASURED BEFORE DECIDING: the two unions have the same three members
 * (`NEWS_PROVIDER` | `OFFICIAL_SOURCE` | `PUBLIC_DATA`). They are semantically
 * equivalent, so the CANDIDATE'S declaration remains authoritative per the B3.1
 * rule, and this module consumes it rather than competing with it.
 *
 * What is recovered here is only what the candidate LACKS: the provenance
 * structure and its companions. Nothing else from the canonical module is
 * carried, and nothing is invented.
 */
import type { SourceType } from './source-type';

/**
 * WHAT ROLE the record plays as evidence — orthogonal to `SourceType`, because
 * a government press release *reporting on* a third party is not a primary
 * record of that third party, and a news agency reproducing an official
 * statement in full is closer to one than an opinion column is.
 *
 * Never a ranking. `PRIMARY_RECORD` is not "better evidence" than `REPORTING`;
 * they answer different questions, and an election result needs the first
 * while an account of a protest needs the second.
 */
export type EvidenceRole =
  /** Journalism about an event the publisher did not itself perform. */
  | 'REPORTING'
  /** The institution's own record or statement about its own acts. */
  | 'PRIMARY_RECORD'
  /** Structured reference data — a statistic, an indicator, a register entry. */
  | 'REFERENCE_DATA'
  /** Background or explanatory material, not tied to a dated event. */
  | 'CONTEXT';

/**
 * The provenance of one retrieved record.
 *
 * `retrievedAt` is deliberately distinct from `NewsArticle.firstSeenAt`, and
 * the difference is load-bearing: `firstSeenAt` is when this deployment FIRST
 * ever persisted the record and is never rewritten, while `retrievedAt` is when
 * THIS request obtained it. Answering "how fresh is this evidence?" needs the
 * second; answering "how long have we known about this?" needs the first.
 */
export interface SourceProvenance {
  readonly sourceType: SourceType;

  /** The provider or registry entry id that produced the record. */
  readonly providerId?: string;

  /**
   * The publishing institution, as the registry names it — "National Bank of
   * Rwanda", not a domain. Absent for an ordinary news publisher, because a
   * publisher name is not an institution and inventing one would be a guess.
   */
  readonly institution?: string;

  /**
   * The authority's jurisdiction as an ISO 3166-1 alpha-2 code, or a curated
   * regional body code (e.g. 'EAC'). This is the jurisdiction of the SOURCE,
   * never of the story — a Rwandan ministry writing about Kenya keeps 'RW'.
   */
  readonly jurisdiction?: string;

  /** Language of the record as published, when the source states it. */
  readonly language?: string;

  /** Canonical URL of the record itself. */
  readonly sourceUrl?: string;

  /** ISO-8601. When THIS retrieval obtained the record. */
  readonly retrievedAt?: string;

  readonly evidenceRole?: EvidenceRole;

  /** Populated only for a source present in the official-source registry. */
  readonly authorityClass?: OfficialSourceClass;
}

/**
 * C2-2 — WHY A RESPONSE CARRIES NO EVIDENCE.
 *
 * THE DEFECT THIS CLOSES, MEASURED ON THE CONVERGENCE-2 RUNTIME. Asked
 * "Which country is more powerful in East Africa?", the pipeline correctly
 * declined to guess which countries were meant and made no provider call —
 * and then told the reader:
 *
 *     "No related articles were found for this question."
 *
 * That is not what happened. Nothing was searched for, because the question
 * did not say what to search for. The response was indistinguishable from a
 * genuine empty result: same null analysis, same `not-attempted` provenance,
 * same message. The only difference was `dataMode: 'unavailable'`, which reads
 * as a provider problem — so the system blamed retrieval for an
 * under-specified question.
 *
 * These codes let the response say which of those actually occurred.
 *
 * LANGUAGE-NEUTRAL CODES, NEVER PROSE — the same discipline `TrustReason`
 * already follows ("stable, language-neutral codes — never backend-authored
 * English prose"). Turning a code into a sentence a reader sees is the
 * frontend's job, in the frontend's two languages.
 */
/*
  ── B3.1 · WHAT WAS DELIBERATELY NOT RECOVERED ────────────────────────────

  The canonical module also declared `RetrievalOutcome` and `ClarificationReason`.
  Neither is recovered, for two separate reasons:

  ECONOMY USES NEITHER. Measured across `shared/src/economy`,
  `backend/src/modules/economy` and `frontend/src/lib/economy`: zero references
  to either symbol. Recovering them would widen the shared surface for no
  consumer.

  AND `RetrievalOutcome` COLLIDES SEMANTICALLY. The sealed candidate already
  exports one from `./analysis`, and the two are NOT equivalent:

    candidate   SUCCESS · NO_RELEVANT_EVIDENCE · PROVIDER_RATE_LIMITED ·
                PROVIDER_UNAVAILABLE · RETAINED_ONLY        (5, provider-centric)
    canonical   RETRIEVED · NO_MATCHING_EVIDENCE ·
                CLARIFICATION_REQUIRED · NOT_RETRIEVABLE    (4, query-centric)

  Different cardinality, different names, different questions. `SourceType` was
  safe to defer to the candidate because the unions were MEASURED equivalent;
  this one is not, so it is reported rather than reconciled.

  Recorded as SHARED-RETRIEVAL-OUTCOME-COLLISION-1. It blocks nothing today —
  Economy needs neither symbol — and it must be settled before anything else
  recovers the canonical retrieval vocabulary.
*/
