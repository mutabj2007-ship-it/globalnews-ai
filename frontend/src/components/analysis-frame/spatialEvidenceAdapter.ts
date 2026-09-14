import type { AnalysisApiResponse } from '@globalnews-ai/shared';
import type { EvidenceGeography, EvidenceRecord, EvidenceSet } from '@/lib/map/evidence/evidenceModel';
import type { MapSelection } from '@/lib/map/state/mapState';
import type { DisplayPrecision } from '@/lib/map/spatial/precisionModel';
import { ANALYSIS_AVAILABLE_GEOMETRY } from '@/lib/spatial/spatialPrecision';
import type { LocationProvenance } from '@/lib/spatial/spatialPrecision';
import type { EvidenceCountry, EvidenceGeographyModel } from './evidenceGeography';

/**
 * ═══ ANALYSIS-SPATIAL-MAP-CONVERGENCE-1 — THE NARROW ADAPTER ═══════════
 *
 * WHAT THIS IS. One pure function that expresses the evidence geography the
 * Analysis response ALREADY carries in the vocabulary the shared Spatial
 * shell already speaks. It is an adapter and nothing else: it issues no
 * request, reads no state, and cannot reach a provider — the Analysis
 * response is its only input.
 *
 * WHY AN ADAPTER RATHER THAN A SECOND MAP. The Analysis rail had its own
 * inline-SVG renderer (`EvidenceMap` + `EvidenceMapLegend`, over
 * `buildEvidenceMapGeometry`), which is how the workspace came to look
 * like a second map product. The correction is not to restyle that
 * renderer to match; it is to stop having one. The shell draws the map,
 * and this file is the only new code the change needs.
 *
 * ── WHAT IT REFUSES TO DO, AND WHY EACH REFUSAL MATTERS ────────────────
 *
 * NO POINT. EVER. `EvidenceGeography.point` is optional and is left
 * UNSET on every record this produces. The Analysis model holds country
 * identity — `iso2`, `iso3`, `isoNumeric`, a canonical name — and no
 * coordinate at all. Emitting a centroid, a capital, or "Tehran" for Iran
 * would be inventing the one thing the contract forbids by name, and the
 * shell would then be entitled to draw it as a located event.
 *
 * NO PRECISION PROMOTION. `precision` is derived from the model's own
 * `precisionCeiling` and can only be `'COUNTRY'` or `'UNKNOWN'`. There is
 * no branch in this file that can produce `CITY`, `EXACT`, `PROVINCE` or
 * `SECTOR`. Iran's evidence is country-level, so Iran draws as a country
 * and says so.
 *
 * R3 · UNRESOLVED IS NOT ABSENT — THE CORRECTION THAT CLOSES DEFECT 3.
 * R1/R2 mapped the `'unresolved'` ceiling to `'NONE'`. `precisionModel.ts`
 * defines those as different states in its own words: `NONE` is "the state
 * where a surface is drawing no evidence at all, WHICH IS DIFFERENT FROM a
 * record whose level is UNKNOWN". A record only exists here because a
 * country carries reporting, so the surface IS drawing evidence, and
 * `'NONE'` printed `"No evidence shown"` beside a rail reading
 * `Iran · 6 REPORTS`. That is the measured contradiction, and it was the
 * adapter's, not the shell's.
 *
 * `'UNKNOWN'` is the honest floor, and it is not a promotion. Check the
 * three tables that decide what a precision is ALLOWED to draw: NONE and
 * UNKNOWN both have `HALO_RADIUS_KM: null`, both have `FOCUS_MAX_ZOOM: 2`,
 * and neither is point-eligible — only EXACT and CITY are. So nothing the
 * reader sees gains resolution. What changes is only the sentence: from a
 * false claim that there is no evidence to the true one, "No resolvable
 * location". COUNTRY, CITY and EXACT remain unreachable from an
 * `'unresolved'` ceiling.
 *
 * NO INVENTED TIME. `lastObservedAt` is the newest REAL `publishedAt`
 * among the articles that country's evidence rests on, read from the
 * response. Where an article carries no timestamp the record falls back
 * to the analysis's own `generatedAt` — a time that genuinely exists —
 * and never to `Date.now()`, which would convert render time into an
 * observation time.
 *
 * NO INVENTED SOURCE COUNT. `sourceCount` counts DISTINCT `sourceId`
 * values among that country's articles. `evidenceModel.ts` warns in its
 * own comment that `NewsArticle.sourcesCount` is hard-coded to 1 by all
 * three providers and is unusable as a distinct-outlet count; this counts
 * publishers instead, from data already loaded.
 *
 * NO EVIDENCE/REFERENCE COLLAPSE. The query target is NOT evidence and
 * does not become a record. It is returned separately as a selection, so
 * the shell frames what the question aimed at while drawing only what the
 * reporting supports — the same distinction the Analysis rail already
 * makes in words, now made in the map as well.
 */

/** Scope is declared on the set itself: this is one question's evidence. */
const ANALYSIS_EVIDENCE_SCOPE = 'QUESTION' as const;

/**
 * `basis` says where a country's support came from, and it maps onto the
 * shell's provenance vocabulary without either side inventing anything:
 *
 *   `article-evidence`  the article itself asserted this country  -> STATED
 *   `retrieval-filter`  the retrieval filter did, not the article -> INTERPRETED
 *
 * The second case matters: `countsAsVerified` treats STATED (and absent)
 * as verified, so mapping a retrieval-filter country to STATED would
 * quietly upgrade a filter decision into the article's own claim.
 */
function provenanceFor(country: EvidenceCountry): LocationProvenance {
  return country.basis === 'article-evidence' ? 'STATED' : 'INTERPRETED';
}

function precisionFor(model: EvidenceGeographyModel): DisplayPrecision {
  /*
    Two values, and no path to a third. `precisionCeiling` is itself
    `'country' | 'unresolved'`, so this is total rather than defensive.

    R3 · THE FALLBACK IS `'UNKNOWN'`, NOT `'NONE'`. See the header. The
    reachable production case is a country admitted on the
    `'retrieval-filter'` basis: the country is listed and its reports are
    counted, while no article resolved a location of its own, so the
    ceiling is `'unresolved'` and evidence is nevertheless on screen.
    `'NONE'` is reserved for a surface drawing nothing, which is a state
    this adapter never produces — with no countries there are no records.
  */
  return model.precisionCeiling === 'country' ? 'COUNTRY' : 'UNKNOWN';
}

interface ArticleFacts {
  readonly newestPublishedAt: string | null;
  readonly distinctSources: number;
}

/**
 * Real per-country facts, read from the articles the response already
 * carries. Keyed by article id because that is what `EvidenceCountry`
 * holds — the country's support is expressed as the ids it rests on.
 */
function articleFactsFor(
  country: EvidenceCountry,
  byId: ReadonlyMap<string, { readonly publishedAt?: string; readonly sourceId?: string }>,
): ArticleFacts {
  const sources = new Set<string>();
  let newest: number | null = null;
  let newestIso: string | null = null;

  for (const id of country.articleIds) {
    const article = byId.get(id);
    if (article === undefined) continue;

    if (typeof article.sourceId === 'string' && article.sourceId.length > 0) {
      sources.add(article.sourceId);
    }

    if (typeof article.publishedAt === 'string') {
      const at = Date.parse(article.publishedAt);
      if (Number.isFinite(at) && (newest === null || at > newest)) {
        newest = at;
        newestIso = article.publishedAt;
      }
    }
  }

  return { newestPublishedAt: newestIso, distinctSources: sources.size };
}

export interface AnalysisSpatialEvidence {
  readonly evidenceSet: EvidenceSet;
  /**
   * Geography the analysis QUERIED and retained nothing for. Never
   * inferred: populated only when the query target names a country the
   * evidence does not support, which is the model's own
   * `targetDisagreesWithEvidence`.
   */
  readonly noEvidenceGeography: readonly EvidenceGeography[];
  /** What to frame. The primary evidence country, or nothing. */
  readonly selection: MapSelection | null;
  /** The finest level this evidence can honestly be drawn at. */
  readonly availableGeometry: DisplayPrecision;
}

export function buildAnalysisSpatialEvidence(
  model: EvidenceGeographyModel,
  response: AnalysisApiResponse | null,
): AnalysisSpatialEvidence {
  const generatedAt = response?.analysis?.generatedAt ?? null;
  /*
    `loadedAt` is when this evidence set was assembled, and the analysis's
    own `generatedAt` is exactly that fact. It is also the horizon
    `qualifyingRecords` measures a period against, so using a real
    analysis time keeps that arithmetic meaningful.
  */
  const loadedAt = generatedAt ?? new Date(0).toISOString();

  const byId = new Map<string, { publishedAt?: string; sourceId?: string }>();
  for (const article of response?.articles ?? []) {
    const withId = article as unknown as { id?: string; publishedAt?: string; sourceId?: string };
    if (typeof withId.id === 'string') {
      byId.set(withId.id, { publishedAt: withId.publishedAt, sourceId: withId.sourceId });
    }
  }

  const precision = precisionFor(model);

  const records: EvidenceRecord[] = model.countries.map((country) => {
    const facts = articleFactsFor(country, byId);

    return {
      id: `analysis-evidence:${country.iso3}`,
      geography: {
        id: country.iso3,
        countryIso3: country.iso3,
        displayName: country.name,
        /* no `point` — see this module's header. */
      },
      precision,
      provenance: provenanceFor(country),
      reportCount: country.articleCount,
      sourceCount: facts.distinctSources,
      lastObservedAt: facts.newestPublishedAt ?? loadedAt,
    };
  });

  /*
    THE QUERY TARGET IS NOT EVIDENCE. It becomes a no-evidence entry only
    in the case the model itself has already decided — the target names a
    country, evidence exists, and the target is not among the countries
    the evidence supports. Anything looser would put a country on the map
    because a question mentioned it.
  */
  const target = model.queryTarget;
  const noEvidenceGeography: EvidenceGeography[] =
    model.targetDisagreesWithEvidence && target !== null && target.iso3 !== null
      ? [
          {
            id: target.iso3,
            countryIso3: target.iso3,
            displayName: target.name ?? target.iso3,
          },
        ]
      : [];

  const primary = model.primary;
  const selection: MapSelection | null =
    primary === null
      ? null
      : /*
           `id` IS the ISO3 and `geographyId` names the same geography, which
           is how `/map`'s own country selection is shaped. No `recordId`: the
           selection is a country, not one report inside it.
        */
        { kind: 'COUNTRY', id: primary.iso3, geographyId: primary.iso3 };

  return {
    evidenceSet: { records, scope: ANALYSIS_EVIDENCE_SCOPE, loadedAt },
    noEvidenceGeography,
    selection,
    /*
      R3 · THE SURFACE'S GEOMETRY BUDGET IS NOT THE EVIDENCE'S CLAIM.
      R2 passed `precision` here, conflating "what the reporting supports"
      with "what this surface holds outlines for". They are different
      questions and the accepted answer to the second already exists and is
      named: `ANALYSIS_AVAILABLE_GEOMETRY`, "the geometry the Analysis
      Workspace actually holds — country outlines, and nothing finer". With
      the R3 fallback the old expression would have told the banner the
      surface holds no geometry at all while it draws country outlines.
      Reading the constant removes the second statement of the same
      contradiction. It raises no record: every record keeps its own
      `precision`, and `drawnCoarser` stays false either way.
    */
    availableGeometry: ANALYSIS_AVAILABLE_GEOMETRY,
  };
}
