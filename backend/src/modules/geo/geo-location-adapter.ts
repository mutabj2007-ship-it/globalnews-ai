import type { LocationContext } from '@globalnews-ai/shared';
import { foldPlaceName } from './geo-normalize.util';
import { resolveGeography, toPlaceFromCountry, type GeoResolution } from './geo-resolver';
import { localizedCountriesNamedIn } from './language/localized-country-surface';

/**
 * RUNTIME ADAPTER — resolveGeography() BEHIND THE EXISTING LocationContext SHAPE.
 *
 * This is what makes the new resolver LIVE rather than a parallel module nobody
 * calls. `AnalysisService.detectLocation()` dispatches through here, so the
 * Ask/Search -> retrieval -> Analysis -> evidence geography -> Spatial map chain
 * runs on the 48,702-settlement gazetteer instead of the curated table.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE MAPPING, AND THE ONE PLACE IT DELIBERATELY DECLINES
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   CITY       -> { country, city }   the finest thing the caller can consume
 *   REGION     -> { country }         LocationContext has no subdivision slot;
 *                                     the full GeoResolution carries it for H
 *   COUNTRY    -> { country }
 *   CONTESTED  -> undefined           DECLINES. See below.
 *   UNKNOWN    -> undefined
 *
 * WHY CONTESTED DECLINES RATHER THAN PICKING THE LARGEST. Returning a country
 * for an ambiguous mention would silently answer a question the reader did not
 * ask - "Aberdeen" would fetch Scottish news for someone writing about Aberdeen,
 * South Dakota. Declining sends the question down the generic path, and the Ask
 * layer (routeAskQuestion) turns the same CONTESTED signal into a request for
 * clarification. Losing a guess is the point.
 *
 * `city` IS LOWERCASED to match the existing contract exactly:
 * LocationContext.city is documented as "lowercase canonical form of the matched
 * text", and CountryNewsService builds its city-scoped search term from it. The
 * canonical-cased name is on the GeoResolution for anything that wants to
 * display it.
 */
export function toLocationContext(resolution: GeoResolution): LocationContext | undefined {
  if (resolution.provenance === 'CONTESTED') return undefined;

  const place = resolution.place;

  if (!place) return undefined;

  switch (resolution.precision) {
    case 'CITY':
      return {
        country: place.country,
        /*
         * FOLDED, not merely lowercased. LocationContext.city is documented as
         * "lowercase canonical form of the matched text" and is used to build a
         * provider search term. A naive toLowerCase leaves "washington, d.c." -
         * punctuation and all - which is neither canonical nor searchable.
         */
        city: place.cityName ? foldPlaceName(place.cityName) : undefined,
        /*
         * THE TYPO CORRECTION MUST TRAVEL WITH THE RESULT.
         *
         * The approved Spatial spec requires a fuzzy-resolved record be "drawn
         * and described as unverified", and the existing retrieval context
         * surfaces that through geoMatch. Dropping it here would leave a guess
         * presented as a fact - which is the one thing the provenance model
         * exists to prevent.
         */
        ...(resolution.geoMatch ? { geoMatch: resolution.geoMatch } : {}),
      };

    case 'PROVINCE':
    case 'COUNTRY':
      return {
        country: place.country,
        ...(resolution.geoMatch ? { geoMatch: resolution.geoMatch } : {}),
      };

    default:
      return undefined;
  }
}

/**
 * The live entry point. Resolves and adapts in one call.
 *
 * `contextCountryIso3` is passed through for tie-breaking ONLY - it can choose
 * between candidates the text already produced, and can never manufacture a
 * location from text that names no place. That is the M1.0A rule that retrieval
 * geography must never become article geography, and the resolver enforces it.
 */
export function detectLocationV2(
  query: string,
  contextCountryIso3?: string,
): LocationContext | undefined {
  /*
   * requireGeographicContext: TRUE because this is the USER QUERY path. A
   * country name that is also an ordinary word - Chad, Georgia, Turkey, Jordan -
   * must sit behind a preposition before it routes retrieval into that country's
   * feed. Article resolution uses resolveArticleGeography, which does not gate.
   */
  return toLocationContext(
    resolveGeography(query, { contextCountryIso3, requireGeographicContext: true }),
  );
}

/**
 * The full resolution, for callers that want geometry rather than a country.
 *
 * `detectLocationV2` deliberately throws away coordinates, subdivision and
 * district because LocationContext cannot hold them. Anything building evidence
 * geography or a map camera should call this instead and consume the
 * GeoResolution directly - see the H join contract.
 */
export function resolveArticleGeography(
  text: string,
  contextCountryIso3?: string,
  /*
   * G-LANG-FR-3 — the EVIDENCE'S own language, when the provider declared one.
   * Optional, so every existing caller compiles and behaves identically: with
   * no language there is no localized rung and this function is exactly what it
   * was.
   */
  evidenceLanguage?: string,
): GeoResolution {
  const base = resolveGeography(text, { contextCountryIso3, evidenceLanguage });

  /*
   * ═══════════════════════════════════════════════════════════════════════
   * THE LOCALIZED COUNTRY RUNG — CONSULTED ONLY WHERE THERE IS NO ANSWER.
   * ═══════════════════════════════════════════════════════════════════════
   *
   * MEASURED ON C27: the evidence path resolves 170 of 196 countries when the
   * text spells them in English and ZERO when it spells them in Arabic, because
   * the country index holds one surface form per country and it is the English
   * one. 67 French, 62 Spanish, 86 Polish and 189 Arabic country names resolve
   * to nothing at all.
   *
   * WHY IT RUNS LAST AND ONLY ON UNKNOWN, AND WHY THAT IS THE WHOLE SAFETY
   * ARGUMENT. A resolution the resolver reached on its own is never revisited:
   * this branch is unreachable unless `place` is absent and precision is
   * UNKNOWN. So no currently-correct answer can regress, no weight moves, no
   * ordering changes, and the English path — which has an answer — never enters
   * it. That is a structural property, not a promise, and the FR-3 proof suite
   * asserts it against the full pre-change corpus.
   *
   * WHY IT DOES NOT SUPPRESS CONTESTED. `CONTESTED` is an answer: the text
   * named places and none dominated. Filling that in from a country name would
   * be overriding a judgement, not filling a gap.
   */
  if (base.place || base.precision !== 'UNKNOWN') return base;

  const named = localizedCountriesNamedIn(text, evidenceLanguage).filter(
    /*
     * G-GEO-D14-B1-RUNG · MAIN-GEO-D14-1 — A DECLINE IS AN ANSWER, NOT A GAP.
     *
     * The resolver may have reached this UNKNOWN by deliberately refusing a
     * country claim it could see. This rung must not resurrect THAT claim.
     *
     * SURFACE-SCOPED, AND THE SCOPE IS THE WHOLE POINT. Two blunter keys were
     * measured and both are wrong:
     *
     *   BLANKET "never fire after a refusal" breaks `Guinea Ecuatorial firmó el
     *   acuerdo comercial.` — the resolver declines the surface "guinea" while
     *   this rung legitimately names EQUATORIAL GUINEA from the longer surface.
     *
     *   COUNTRY-KEYED suppression never fires on `Georgia Meloni`, because the
     *   refusal there comes from the SUBDIVISION tier, whose country is the
     *   United States while this rung asserts Georgia.
     *
     * The refusal declines a SURFACE. So the rung declines the same surface,
     * and nothing else.
     */
    (entry) => foldPlaceName(entry.surface) !== base.refusedSurface,
  );

  if (named.length === 0) return base;

  if (named.length > 1) {
    const candidates = named.map((entry) => toPlaceFromCountry(entry.country));

    return {
      precision: 'COUNTRY',
      provenance: 'CONTESTED',
      candidates,
      reason: 'COUNTRY_BY_LOCALIZED_NAME',
      detail: `${named.length} countries named in ${evidenceLanguage} and none is the subject`,
    };
  }

  const only = named[0];
  const place = toPlaceFromCountry(only.country);

  /*
   * PROVENANCE IS STATED, AND THAT IS DELIBERATE. The source wrote the
   * country's name; that it wrote it in its own language does not make the
   * statement an interpretation. Compare fuzzy correction, which is
   * INTERPRETED because the resolver guessed what the source meant. Nothing is
   * guessed here — "Belgique" IS Belgium's name.
   */
  return {
    precision: 'COUNTRY',
    provenance: 'STATED',
    place,
    candidates: [place],
    matchedText: foldPlaceName(only.surface),
    reason: 'COUNTRY_BY_LOCALIZED_NAME',
    detail: `"${only.surface}" names ${only.country.name} in ${evidenceLanguage}`,
  };
}
