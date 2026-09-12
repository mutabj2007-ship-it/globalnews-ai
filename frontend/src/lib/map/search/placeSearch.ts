import { COUNTRIES, type CountryMeta } from '@globalnews-ai/shared';
import type { Bounds } from '@/lib/map/camera/cameraState';
import { selectionCameraFor } from '@/lib/map/coveragePaint';
import type { GeographyTotal } from '@/lib/map/evidence/evidenceModel';
import { DEPLOYMENT_JUMP_TARGETS } from '@/lib/map/navigation/breadcrumbs';
import type { RegionSelection } from '@/lib/map/region/regionSelection';

/**
 * SPATIAL M2 — PLACE SEARCH, FROM DESIGN PART I §C AND PART II §8 Q7.
 *
 * "One field over countries, cities, water bodies and situations. Results are
 * TYPED and show evidence counts where they exist, so a search result already
 * tells the user whether the platform knows anything there."
 *
 * ── THE RULE THAT MAKES THIS AN INTELLIGENCE FEATURE ──────────────────────
 *
 * Part II §8 question 7, which is the whole reason this module annotates
 * rather than filters:
 *
 *     "Search must NEVER be limited to places the platform has evidence for —
 *      the ability to look somewhere and be told plainly that nothing is known
 *      is itself an intelligence answer."
 *
 * So a place with no retained evidence is a RESULT, annotated `REFERENCE`,
 * not an absence. `annotation` is a discriminated value rather than a count of
 * zero for exactly that reason: zero and "we did not look" must not render the
 * same, and a number cannot carry the difference.
 *
 * ── AND WHAT IT WILL NOT INVENT ───────────────────────────────────────────
 *
 * Cities and water bodies are declared in the result union because the spec
 * names them, and they are produced by NOTHING today: the gazetteer is
 * "Partial · M2" in Part II §4 and G owns it. A search over countries is what
 * the frontend can honestly serve, so that is what it serves — with the other
 * kinds typed and empty rather than faked from country centroids.
 */

export type PlaceKind = 'COUNTRY' | 'CITY' | 'WATER' | 'SITUATION' | 'REGION';

/**
 * Whether the platform has retained evidence for this place, in the CURRENT
 * mode and period — which is why the count arrives from the caller's qualifying
 * set rather than from a global index.
 */
export type PlaceAnnotation =
  | { readonly kind: 'EVIDENCE'; readonly reportCount: number; readonly geographyCount: number }
  /**
   * EVIDENCE EXISTS IN THE CONTAINING COUNTRY, NOT AT THIS PLACE.
   *
   * ── WHY THIS IS A THIRD KIND AND NOT A COUNT ON THE SECOND ──────────────
   *
   * G's navigator can now return a city, a province or a district. The
   * platform's retained evidence for almost all of them is COUNTRY-level: it
   * knows 34 reports concern Rwanda, and it does NOT know that any of them
   * concern Kigali.
   *
   * Annotating a Kigali row with "34 reports" would say the second thing while
   * meaning the first, and it would do it in the one place a reader is least
   * able to check — a suggestion list, mid-keystroke. NAVIGATION PRECISION IS
   * NOT EVIDENCE PRECISION: a reader may fly the camera to a city while
   * everything known there is known only about its country.
   *
   * So the count is carried WITH THE NAME OF THE THING IT IS ACTUALLY ABOUT,
   * and the surface renders it as evidence in that country rather than as
   * evidence here. `REFERENCE` remains the answer when the containing country
   * has nothing either.
   */
  | {
      readonly kind: 'IN_COUNTRY';
      readonly reportCount: number;
      readonly countryLabel: string;
    }
  /** Part II §8 q7: "annotated REFERENCE rather than with a count". */
  | { readonly kind: 'REFERENCE' };

export interface PlaceResult {
  readonly id: string;
  readonly kind: PlaceKind;
  readonly label: string;
  /** Present when the place has real geometry to fly to. */
  readonly bounds?: Bounds;
  readonly countryIso3?: string;
  /**
   * WHERE THIS PLACE SITS, WHEN THE NAME ALONE IS NOT AN ANSWER.
   *
   * MEASURED. Searching "Kigali" against G's navigator returns three real rows
   * — the city, the province and the district — and rendered as a name plus a
   * kind they read as "Kigali, Kigali, Kigali": one place listed three times by
   * a broken search, rather than three genuine rungs of one place.
   *
   * The rungs are not a defect and must not be collapsed; what was missing was
   * the sentence that tells them apart. This carries the ancestors G already
   * publishes, so a row says "Kigali · CITY · Kigali City, Rwanda".
   *
   * Optional, because a country row needs no context and adding one would be
   * noise: "Rwanda, Rwanda" is worse than "Rwanda".
   */
  readonly context?: string;
  readonly annotation: PlaceAnnotation;
  /**
   * RSC-1 — THE CANONICAL REGION BEHIND THIS ROW, WHEN THERE IS ONE.
   *
   * Present ONLY on rows built from a navigator node, because only those carry
   * a `geographyId`, a published basis and a derived extent. A row built from
   * the local jump table has `kind: 'REGION'` and NO `region`, and that is the
   * honest difference: `{ id: 'eastAfrica' }` is a dictionary label key over a
   * hard-coded box, not a region identity (RSC-1's alias trap; H-GEO-2).
   *
   * So the shell branches on THIS field, not on `kind`. A jump target keeps
   * doing exactly what it did — move the camera — and cannot accidentally
   * acquire an identity it does not have.
   */
  readonly region?: RegionSelection;
}

/** Diacritic- and case-insensitive, so "Cote" finds "Côte d'Ivoire". */
const fold = (value: string): string =>
  value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

const matches = (haystack: string, needle: string): boolean => fold(haystack).includes(needle);

export interface PlaceSearchInput {
  readonly query: string;
  /** Totals for the records that currently qualify. Empty is a valid, meaningful input. */
  readonly totals: readonly GeographyTotal[];
  readonly limit?: number;
  /** Country display names in the reader's language, keyed by ISO3. */
  readonly countryNames?: Readonly<Record<string, string>>;
  /** Labels for the configured jump targets, keyed by target id. */
  readonly regionNames?: Readonly<Record<string, string>>;
}

const annotationFor = (
  iso3: string,
  totals: readonly GeographyTotal[],
): PlaceAnnotation => {
  const here = totals.filter((total) => total.countryIso3 === iso3);

  if (here.length === 0) return { kind: 'REFERENCE' };

  return {
    kind: 'EVIDENCE',
    reportCount: here.reduce((sum, total) => sum + total.reportCount, 0),
    geographyCount: here.length,
  };
};

const countryLabel = (country: CountryMeta, names?: Readonly<Record<string, string>>): string =>
  names?.[country.iso3] ?? country.name;

/**
 * Search results, ranked.
 *
 * RANKED, NOT FILTERED, BY EVIDENCE. A place with evidence sorts above one
 * without — that is a useful ordering — but nothing is removed for having
 * none. Within each group the ordering is by how early the match falls in the
 * name, so typing "pol" puts Poland above Polynesia.
 */
export function searchPlaces(input: PlaceSearchInput): readonly PlaceResult[] {
  const needle = fold(input.query);

  if (needle.length === 0) return [];

  const limit = input.limit ?? 8;
  const results: PlaceResult[] = [];

  for (const country of COUNTRIES) {
    const label = countryLabel(country, input.countryNames);

    if (!matches(label, needle) && !matches(country.name, needle) && fold(country.iso3) !== needle) {
      continue;
    }

    /*
      REUSES THE ACCEPTED SELECTION GEOMETRY, rather than deriving a second
      set of country bounds. `selectionCameraFor` already carries the four
      antimeridian exceptions the World Map has always had; a parallel bounds
      lookup here would frame Fiji and Kiribati differently from a click on
      the same country, which is exactly the kind of drift a search box
      quietly introduces.

      A country whose geometry we do not hold is still a RESULT — it just
      carries no bounds, so selecting it selects without flying. Dropping it
      would violate the rule above: the user asked about a place, and "we
      cannot draw it" is not the same answer as "it does not exist".
    */
    const target = selectionCameraFor(country.iso3);

    results.push({
      id: country.iso3,
      kind: 'COUNTRY',
      label,
      bounds: target?.kind === 'bounds' ? target.bounds : undefined,
      countryIso3: country.iso3,
      annotation: annotationFor(country.iso3, input.totals),
    });
  }

  /*
    Configured regions are searchable too — "East Africa" is a thing a user
    types. They carry no evidence annotation of their own: a supranational
    region's evidence would have to be summed across countries, and Part I §G
    forbids REGION rendering without a controlled gazetteer, so claiming a
    count for one would assert exactly what the precision model refuses.

    COUNTRY-RUNG TARGETS ARE SKIPPED, and the browser run is why. Rwanda,
    Kenya and Poland are configured jump targets AND real countries, so a
    search for "rwanda" returned it twice — once as a COUNTRY carrying its
    evidence annotation, once as a REGION carrying only REFERENCE. The
    duplicate was not merely untidy: the second row states "no retained
    evidence" about a place the first row may have just reported evidence for.
    The country result is strictly better, so the target is dropped from
    search. It remains a breadcrumb jump, which is where a country-scale
    destination belongs.
  */
  for (const target of DEPLOYMENT_JUMP_TARGETS) {
    if (target.rung === 'COUNTRY') continue;

    const label = input.regionNames?.[target.id];

    if (label === undefined || !matches(label, needle)) continue;

    results.push({
      id: `region:${target.id}`,
      kind: 'REGION',
      label,
      bounds: target.bounds,
      annotation: { kind: 'REFERENCE' },
    });
  }

  const rank = (result: PlaceResult): number => {
    const position = fold(result.label).indexOf(needle);

    return (result.annotation.kind === 'EVIDENCE' ? 0 : 1000) + (position < 0 ? 500 : position);
  };

  return results.sort((a, b) => rank(a) - rank(b) || a.label.localeCompare(b.label)).slice(0, limit);
}

/**
 * The kinds the gazetteer cannot serve yet, so the UI can say so rather than
 * appear to have searched them.
 *
 * Part II §4 lists the place index as "Partial — ~250 places now, ~50k
 * target", owned by G. A search box that silently covers only countries while
 * its placeholder promises cities is a small lie that compounds: the user
 * concludes the platform has no data for a city it simply never looked up.
 */
export const UNAVAILABLE_PLACE_KINDS: readonly PlaceKind[] = ['CITY', 'WATER', 'SITUATION'];
