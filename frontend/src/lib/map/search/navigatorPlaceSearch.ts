'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { COUNTRIES } from '@globalnews-ai/shared';
import {
  navigatorCameraTarget,
  navigatorCountryIso3,
  searchNavigator,
  type NavigatorKind,
  type NavigatorPlace,
} from '@/lib/api/geoNavigatorApi';
import type { GeographyTotal } from '@/lib/map/evidence/evidenceModel';
import { regionSelectionFrom } from '@/lib/map/region/regionSelection';
import { searchPlaces, type PlaceKind, type PlaceResult } from '@/lib/map/search/placeSearch';

/**
 * SEARCH OVER THE WHOLE LADDER — LOCAL FIRST, NAVIGATOR SECOND.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY BOTH, AND NOT EITHER ALONE
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * `searchPlaces` is synchronous, needs no backend, and knows the reader's
 * CURRENT qualifying evidence set — the thing the backend cannot know, because
 * it depends on the mode and period the reader has selected. It covers
 * countries and configured regions and nothing below them.
 *
 * G's navigator covers region -> country -> admin1 -> admin2 -> city, and knows
 * nothing about what this reader is currently looking at.
 *
 * Each is missing exactly what the other has, so this merges them: the local
 * result paints on the keystroke, and the navigator's deeper rungs arrive when
 * the request returns. A reader typing "kig" sees something immediately and
 * sees Kigali a moment later, rather than seeing nothing for 200 ms and then
 * everything.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE COUNTRY ROW IS THE LOCAL ONE, ALWAYS
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Both engines return countries. The local row is kept and the navigator's is
 * dropped, because only the local row carries the real evidence annotation for
 * the current mode and period. Deduplication is by ISO3 — read from published
 * fields, never parsed out of a `geographyId`.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHAT IS DELIBERATELY NOT DONE HERE
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * No folding, no matching, no ranking of the navigator's own results, and no
 * id construction. All four live behind the route. This module orders the two
 * lists relative to each other and nothing more.
 *
 * And NOTHING IS INVENTED. If G returns no city for a query, no city appears —
 * there is no local settlement table, no derived name, no "did you mean". A
 * place the data does not hold must not show up because a suggestion list
 * looks better populated.
 */

/** How long a reader has to stop typing before a request is worth spending. */
const DEBOUNCE_MS = 180;

/** The navigator's share of the list. The local rows are never truncated away. */
const NAVIGATOR_LIMIT = 12;

/**
 * G's rungs, mapped onto the result vocabulary the surfaces already render.
 *
 * ADMIN1 AND ADMIN2 BOTH BECOME `REGION`, and that is not a loss: `PlaceKind`
 * is a RENDERING vocabulary — it decides which word appears next to a row — and
 * a reader does not need "admin2" as a category name. The precise rung stays on
 * `navigationPrecision`, which is what a caller reasons about.
 */
const KIND_OF: Readonly<Record<NavigatorKind, PlaceKind>> = {
  region: 'REGION',
  country: 'COUNTRY',
  admin1: 'REGION',
  admin2: 'REGION',
  city: 'CITY',
};

export interface NavigatorSearchState {
  readonly results: readonly PlaceResult[];
  /** True while a navigator request for the CURRENT query is outstanding. */
  readonly deepening: boolean;
  /**
   * True when the navigator answered for this query. The surfaces use it to
   * decide whether "no results" is a fact or merely "not yet".
   */
  readonly deepSearched: boolean;
}

export interface NavigatorPlaceSearchInput {
  readonly query: string;
  readonly totals: readonly GeographyTotal[];
  readonly countryNames?: Readonly<Record<string, string>>;
  readonly regionNames?: Readonly<Record<string, string>>;
  /** Off by default so a surface opts in rather than inherits network traffic. */
  readonly deep?: boolean;
}

const reportsInCountry = (iso3: string, totals: readonly GeographyTotal[]): number =>
  totals
    .filter((total) => total.countryIso3 === iso3)
    .reduce((sum, total) => sum + total.reportCount, 0);

/**
 * One navigator node as a result row.
 *
 * The annotation is the careful part. A city inside a country that has retained
 * evidence is annotated `IN_COUNTRY` — the count, carried with the name of the
 * country it is actually about — and never `EVIDENCE`, which would claim the
 * reports concern the city itself. See `PlaceAnnotation`'s own note.
 */
function toResult(
  place: NavigatorPlace,
  totals: readonly GeographyTotal[],
  countryNames?: Readonly<Record<string, string>>,
): PlaceResult {
  const iso3 = navigatorCountryIso3(place);
  const bounds = navigatorCameraTarget(place) ?? undefined;
  /*
    RSC-1. `null` for everything that is not a region, so a country row cannot
    carry one and a region row cannot lack one. Built HERE, in the adapter that
    already owns the navigator-to-result translation, rather than in the shell —
    the shell would then need G's vocabulary, which is exactly the coupling
    `regionSelection.ts` exists to hold in one place.
  */
  const region = regionSelectionFrom(place) ?? undefined;
  const reports = iso3 === undefined ? 0 : reportsInCountry(iso3, totals);
  const countryName =
    iso3 === undefined
      ? undefined
      : (countryNames?.[iso3] ?? COUNTRIES.find((c) => c.iso3 === iso3)?.name);

  /*
    THE CONTEXT LINE, BUILT FROM G'S OWN ANCESTORS.

    Coarsest-first is how G publishes `hierarchy`, and the reverse is how a
    reader needs it: the nearest container first, the country last, the way an
    address is spoken. Supranational regions are dropped — "Kigali · Eastern
    Africa" locates nothing a reader was asking about — and the place's own name
    is dropped where it repeats an ancestor, so an admin1 called Kigali inside a
    Kigali does not render "Kigali, Kigali".

    Two rungs at most. This sits under a 13 px row on a phone.
  */
  const context = place.hierarchy
    .filter((ancestor) => ancestor.kind !== 'region' && ancestor.name !== place.name)
    .reverse()
    .slice(0, 2)
    .map((ancestor) => ancestor.name)
    .reverse()
    .join(', ');

  return {
    id: place.geographyId,
    kind: KIND_OF[place.kind],
    label: place.name,
    context: context.length > 0 ? context : undefined,
    bounds,
    countryIso3: iso3,
    region,
    annotation:
      reports > 0 && countryName !== undefined
        ? { kind: 'IN_COUNTRY', reportCount: reports, countryLabel: countryName }
        : { kind: 'REFERENCE' },
  };
}

/**
 * The merged list.
 *
 * ORDER: local rows first, navigator rows after, each keeping its own engine's
 * ranking. The local rows are the ones carrying real evidence for the current
 * view, and a reader searching a map is usually looking for one of them; a
 * merged re-rank across two different scoring schemes would produce an order
 * neither engine intended.
 */
export function mergePlaceResults(
  local: readonly PlaceResult[],
  navigator: readonly NavigatorPlace[],
  totals: readonly GeographyTotal[],
  countryNames?: Readonly<Record<string, string>>,
): readonly PlaceResult[] {
  const localCountries = new Set(
    local.filter((r) => r.kind === 'COUNTRY').map((r) => r.countryIso3 ?? r.id),
  );

  /*
    ══ RSC-1 — WHEN A REAL REGION IS AVAILABLE, THE CAMERA SHORTCUT STANDS DOWN
    ═════════════════════════════════════════════════════════════════════════

    MEASURED on the wired build, searching "East Africa", 1440x900:

      1  East Africa               Region  Reference     <- LOCAL jump target
      2  Eastern Africa            Region  Reference     <- region:eastern-africa
      3  East African Community    Region  Reference     <- region:east-african-community

    Row 1 is `{ id: 'eastAfrica' }` from `DEPLOYMENT_JUMP_TARGETS` — a
    DICTIONARY LABEL KEY over the hard-coded box [28.8, -11.8, 42, 5.5]. It has
    no geographyId, no type, no membership and no published definition, so
    committing it moved the camera to 3.89/35.4/-3.15 and selected nothing,
    while rows 2 and 3 — the same three words to a reader — performed the whole
    RSC-1 transition. One label, two behaviours, and the inert one ranked first
    because local rows are listed first by design.

    Nor is the box either region: EAC's derived extent is
    [12.37, -11.76, 41.86, 9.53], which reaches the DRC at about 12E and South
    Sudan at about 9.5N; M49's Eastern Africa is [22.68, -25.97, 63.42, 15.78].
    The shortcut frames a third area that agrees with neither.

    THE NARROW CORRECTION: a local REGION row is suppressed WHEN AND ONLY WHEN
    the navigator returned regions for this query. The identity-carrying rows
    are strictly better answers, and they exist. When the navigator is
    unreachable the jump rows are still there and still work — which is the
    reason H-GEO-2 says not to delete the table, honoured here without keeping a
    row that competes with a real region.

    NOT a rename, NOT a merge, and NOT an id minted from a label: "East Africa"
    is an ALIAS of `region:eastern-africa`, and only G may resolve it (RSC-1's
    alias trap). This drops a duplicate; it never converts one.
  */
  const navigatorHasRegion = navigator.some((place) => place.kind === 'region');
  const kept = navigatorHasRegion ? local.filter((r) => r.kind !== 'REGION') : local;

  const seen = new Set(kept.map((r) => r.id));
  const merged: PlaceResult[] = [...kept];

  for (const place of navigator) {
    /* The local country row already covers this, and carries the better annotation. */
    if (place.kind === 'country' && localCountries.has(navigatorCountryIso3(place) ?? '')) continue;
    if (seen.has(place.geographyId)) continue;

    seen.add(place.geographyId);
    merged.push(toResult(place, totals, countryNames));
  }

  return merged;
}

/**
 * Search state for a live field.
 *
 * ── EVERY SUPERSEDED KEYSTROKE IS CANCELLED ───────────────────────────────
 *
 * Two guards, because they fail differently. The AbortController stops the
 * request itself, so a fast typist does not hold five sockets open. The
 * sequence number stops a slow response from overwriting a newer one after it
 * has already resolved — the out-of-order arrival that shows results for a
 * query the reader has finished editing.
 */
export function useNavigatorPlaceSearch(input: NavigatorPlaceSearchInput): NavigatorSearchState {
  const { query, totals, countryNames, regionNames, deep = true } = input;

  const local = useMemo(
    () => searchPlaces({ query, totals, countryNames, regionNames }),
    [query, totals, countryNames, regionNames],
  );

  const [deepPlaces, setDeepPlaces] = useState<readonly NavigatorPlace[]>([]);
  const [deepening, setDeepening] = useState(false);
  const [answeredFor, setAnsweredFor] = useState<string | null>(null);
  const sequence = useRef(0);

  const trimmed = query.trim();

  useEffect(() => {
    if (!deep || trimmed.length < 2) {
      setDeepPlaces([]);
      setDeepening(false);
      setAnsweredFor(null);

      return undefined;
    }

    const ticket = (sequence.current += 1);
    const controller = new AbortController();

    setDeepening(true);

    const timer = window.setTimeout(() => {
      void searchNavigator(trimmed, { limit: NAVIGATOR_LIMIT, signal: controller.signal }).then(
        (result) => {
          /* A response for a query the reader has moved past is discarded. */
          if (ticket !== sequence.current) return;

          setDeepPlaces(result.places);
          setDeepening(false);
          setAnsweredFor(trimmed);
        },
      );
    }, DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [deep, trimmed]);

  const results = useMemo(
    () => mergePlaceResults(local, deepPlaces, totals, countryNames),
    [local, deepPlaces, totals, countryNames],
  );

  return { results, deepening, deepSearched: answeredFor === trimmed && trimmed.length >= 2 };
}
