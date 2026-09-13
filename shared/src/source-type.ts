/**
 * ════════════════════════════════════════════════════════════════════════════
 * SOURCE TYPE — RECOVERED FROM CANONICAL C55, NOT INVENTED
 * ════════════════════════════════════════════════════════════════════════════
 *
 * PUBLISHER FEEDS RECOVERY R1. `SourceType` below is lifted VERBATIM — members
 * and doc comment — from `shared/src/sourceModel.ts` at canonical C55
 * (`3db5a09cd9831584293af61f6ed004ecf6657a4c`, blob
 * `2e6f...`, the C2-2 multi-source provenance model). The ruling was explicit:
 * *"If the historical C55 SourceType already expresses equivalent semantics,
 * prefer recovering it rather than inventing a new vocabulary."* It does, so it
 * is recovered rather than re-authored, and `feed-source-registry.ts` — itself
 * ported byte-identically — imports this exact name from this exact package.
 *
 * WHY A NEW FILE RATHER THAN PORTING `sourceModel.ts` WHOLE. That file also
 * exports `RetrievalOutcome`, which **already exists in the C907 shared
 * contract** — measured, not assumed. Porting the whole module would redeclare
 * an accepted type and break the barrel. So this is the smallest additive
 * slice: the one type the recovered lane actually needs, in its own module,
 * colliding with nothing.
 *
 * `EvidenceRole`, `SourceProvenance` and `ClarificationReason` are deliberately
 * NOT brought across. They are provenance-model work, not retrieval, and this
 * round restores retrieval.
 */

/**
 * WHAT KIND OF SOURCE produced a record. Deliberately three members and not a
 * spectrum: the distinction that matters downstream is who is speaking, not
 * how much they are trusted.
 */
export type SourceType =
  /** A news aggregator or wire API — GNews, GDELT DOC, Event Registry articles. */
  | 'NEWS_PROVIDER'
  /** An institution publishing about itself: a ministry, court, electoral body, central bank. */
  | 'OFFICIAL_SOURCE'
  /** A structured public dataset — statistics, indicators, registers. */
  | 'PUBLIC_DATA';

/**
 * ── THE CORROBORATION VOCABULARY — A TYPE ONLY, DELIBERATELY ────────────────
 *
 * `SourceType` says WHO IS SPEAKING. It does not say whether two records may
 * confirm each other, and the ruling requires that distinction:
 *
 *     "Do not treat official/public sources as independent journalistic
 *      corroboration."
 *
 * WHY THE RULE IS NOT COSMETIC. Two independent newsrooms reporting the same
 * event are two observations of the world. A central bank's own release and a
 * statistical office's own release are each ONE institution speaking about its
 * OWN acts — a primary record, often BETTER evidence than journalism, and
 * precisely for that reason never a second, independent confirmation of it.
 * Folding the two together would let an institution appear to corroborate
 * itself.
 *
 * NEITHER CLASS RANKS ABOVE THE OTHER. `OFFICIAL_PUBLIC` is not weaker
 * evidence; it answers a different question.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * REV A — WHY THERE IS NO `SourceType -> SourceCorroborationClass` FUNCTION
 * ════════════════════════════════════════════════════════════════════════════
 *
 * R1 shipped one, mapping `NEWS_PROVIDER -> LOCAL_JOURNALISM`. THAT WAS WRONG,
 * and the recovered doc comment twelve lines above this one says so in its own
 * words: `NEWS_PROVIDER` is *"a news aggregator or wire API — GNews, GDELT DOC,
 * Event Registry articles."*
 *
 * So the R1 inference classified GNews and GDELT DOC as LOCAL JOURNALISM. Those
 * are global aggregators. Treating an aggregator as a local newsroom would let
 * two GNews records — or a GNews record and a GDELT record carrying the same
 * wire copy — read as independent local corroboration of each other, which is
 * the exact inflation this vocabulary exists to prevent, arriving through the
 * mechanism meant to prevent it.
 *
 * THE ERROR WAS OF SCOPE, NOT OF VOCABULARY. `SourceType` is a GLOBAL property
 * of every record in the pipeline; corroboration class is a claim about a
 * SPECIFIC, CURATED, INDIVIDUALLY VERIFIED publisher. A three-member union over
 * the whole world cannot carry a judgement that was only ever made about six
 * named feeds.
 *
 * SO THE CLASSIFICATION IS NOT DERIVED HERE AT ALL. It is declared, per feed,
 * by explicit identity, in the lane that owns those identities —
 * `backend/src/modules/news/providers/feed-corroboration.ts`. That module is
 * fail-closed: a source it has never been told about contributes nothing, so
 * neither an aggregator nor a future registry entry can inherit LOCAL_JOURNALISM
 * by being the right `SourceType`.
 *
 * This file therefore exports the VOCABULARY and no inference over it.
 */
export type SourceCorroborationClass =
  /**
   * An individually verified newsroom filing its own journalism. May
   * corroborate other journalism.
   *
   * NEVER inferred from `SourceType`. An aggregator is not a newsroom, however
   * much journalism passes through it.
   */
  | 'LOCAL_JOURNALISM'
  /**
   * An institution or dataset publishing about itself. Authoritative as a
   * primary record; NEVER counted as independent journalistic corroboration.
   */
  | 'OFFICIAL_PUBLIC';
