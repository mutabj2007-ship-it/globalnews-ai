import type { OfficialSourceClass } from './officialSources';

/**
 * M64.1 — GDELT-shaped signal contract, deliberately NOT NewsArticle.
 *
 * A GeoSignal is a provider's report of an event, geographic mention,
 * or coverage/trend datum — never retrieved publication evidence. It
 * must never be treated as a substitute for an original source
 * article, and it must never reach OpenAI as if it were one.
 *
 * THE ACTUAL INVARIANT, STATED PLAINLY (per explicit CTO correction —
 * this is a design/process rule, not a compiler-enforced guarantee):
 *   - SignalProvider.discoverSignals() returns GeoSignal[], never
 *     NewsArticle[].
 *   - GeoSignal values must never be placed into
 *     AnalysisProviderInput.articles (analysis-provider.interface.ts)
 *     — that field is typed NewsArticle[], so a GeoSignal cannot be
 *     assigned there without deliberately reshaping it into a fake
 *     article first. Nothing prevents a future developer from writing
 *     that reshaping code; this comment is the record of why that
 *     would be wrong, not a mechanism that stops it.
 *   - Any future use of signals BY OpenAI requires a new, separately
 *     labelled AnalysisProviderInput field (e.g. `contextSignals?:
 *     GeoSignal[]`) so the prompt layer can honestly describe them as
 *     signals, not sources. That field does not exist yet — adding it
 *     is explicitly out of M64.1's scope.
 */
export interface GeoSignal {
  /**
   * M64.2 — stable PROVIDER/GEOGRAPHIC identity, deliberately excluding
   * any measurement value or GlobalNews AI request context. Two
   * fetches of the same underlying provider observation must produce
   * the same id even if mentionCount differs between them (a later
   * fetch legitimately sees a higher count) and even if different
   * GlobalNews AI queries happened to surface the same observation
   * (query text is retrieval/request context — see raw.requestQuery
   * — never signal identity). See gdelt.provider.ts's own
   * buildStableSignalId() for the concrete canonicalization used by
   * that provider.
   */
  id: string;

  /** e.g. 'gdelt'. */
  providerId: string;

  eventType?: string;

  /** ISO2, joins CountryMeta (countries.ts). */
  countryCode?: string;

  latitude?: number;
  longitude?: number;

  /** Provider-reported sentiment/tone, on whatever scale the provider itself defines. Not normalized to a common shared meaning across providers in M64.1. */
  toneScore?: number;

  sourceUrl?: string;

  /** ISO-8601 — when the underlying event/mention occurred, per the provider. For a window-based provider (e.g. GDELT GEO 2.0), this is the observation window's end — a real, defensible boundary — not a discrete event time. See observationWindowStart/observationWindowEnd for the full honest range. */
  observedAt: string;

  /**
   * M64.2 — ISO-8601. Start of the aggregation window this record's
   * measurement covers, when the provider's semantics are window-based
   * rather than a discrete event time.
   */
  observationWindowStart?: string;

  /** M64.2 — ISO-8601. End of the aggregation window. */
  observationWindowEnd?: string;

  /**
   * ISO-8601 — when this backend retrieved the signal. This is a new
   * concept with no existing column to duplicate — unlike
   * NewsArticle/the Article Prisma model, which already has
   * `fetchedAt` for this purpose. GeoSignal is not Article-backed in
   * M64.1, so no naming collision applies here.
   */
  retrievedAt: string;

  /**
   * M64.2 — number of provider observations/mentions represented by
   * this signal when the upstream provider exposes an aggregate
   * count (e.g. GDELT GEO 2.0's `properties.count`). This is a
   * MEASUREMENT, not identity — two fetches of the same geographic
   * observation with different mentionCount values are still the
   * same signal (see id's own doc comment).
   */
  mentionCount?: number;

  /** Set only when this signal traces to an Official Source Registry entry. */
  sourceAuthorityClass?: OfficialSourceClass;

  /** Provider's own raw record, for audit/debugging only. Never shown to the frontend, never trusted as validated. */
  raw?: Record<string, unknown>;
}

export interface GeoSignalQueryOptions {
  countryCode?: string;
  eventType?: string;
  limit?: number;
}
