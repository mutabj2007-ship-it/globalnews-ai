import { COUNTRIES } from '@globalnews-ai/shared';

import type { CameraState } from '@/lib/map/camera/cameraState';
import { REFERENCE_PLACE_SEEDS } from '@/lib/map/labels/referencePlaces';
import {
  DECLARED_PRODUCT_REGIONS,
  membersFor,
  type DeclaredProductRegion,
} from '@/lib/map/region/declaredProductRegions';

import type { JumpTarget, ScaleRung } from './breadcrumbs';
import {
  UNRESOLVED,
  declaredRegionFor,
  resolveCameraPlace,
  type ResolvedPlace,
} from './resolvedLadder';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * EXPLICIT GEOGRAPHY SCOPE — SELECTION IS AUTHORITATIVE, THE CAMERA IS NOT
 * ════════════════════════════════════════════════════════════════════════════
 *
 * CTO RULING (ALPHA CONVERGENCE R1, Checkpoint A):
 *
 *   "explicit user geography selection is authoritative; camera state must not
 *    redefine it … countryAt(lon,lat) may support free-pan/view context when
 *    appropriate, but it must not overwrite an explicit CONTINENT, SUBREGION,
 *    COUNTRY or CITY selection."
 *
 * ─── THE DEFECT THIS CLOSES ────────────────────────────────────────────────
 *
 * `resolveCameraPlace()` rebuilt the ENTIRE ladder from one point-in-polygon
 * test at the camera centre, and `SUBREGION` was then derived from whatever
 * country that test returned. The direction of truth ran backwards: the region
 * was inferred from a guessed country, which was itself inferred from a pixel.
 *
 * Selecting AFRICA therefore could not survive, because the selection was never
 * stored — it was re-derived every frame from a coordinate. A jump to AFRICA
 * cleared the selection to `null` (correctly: a continent is not a selectable
 * evidence geography) and flew the camera to Africa's bounds, and the ladder
 * then named whichever country happened to sit under the resulting centre.
 * Africa's bounds centre is ~(17°E, 1.2°N), beside Central African Republic —
 * and because the committed camera depends on viewport aspect ratio, padding
 * and any later pan, WHICH country got named was not even deterministic. That
 * is how EAST AFRICA could read as Chad: Chad is not, and cannot be, reachable
 * from the East Africa member list, so it can only have come from a positional
 * lookup.
 *
 * ─── THE CORRECTION, AND WHY IT IS STRUCTURAL RATHER THAN DEFENSIVE ────────
 *
 * A scope carries an IDENTITY at a RUNG. The place is then built from that
 * identity and from governed data only. A CONTINENT scope has `country: null`
 * BY CONSTRUCTION — there is no code path that can put a country on it — so
 * "AFRICA must not resolve to Central African Republic" is not enforced by a
 * check that could be forgotten, it is unrepresentable.
 *
 * NO COUNTRY IS SPECIAL-CASED. The ruling is explicit: *"Do not hard-code
 * special-case exclusions for CAF/Chad."* Neither string appears here. The
 * defect class is removed instead of two of its symptoms.
 *
 * ─── EVERY IDENTITY IS DERIVED, NOT TRANSCRIBED ───────────────────────────
 *
 * There is no label table in this file, because a second place where "Africa"
 * or "East Africa" is written down is a second source of truth that can drift
 * from the governed one. Each name is looked up:
 *
 *   CONTINENT  matched against the distinct `region` values of the shared
 *              country registry (Africa, Americas, Asia, Europe, Oceania)
 *   SUBREGION  matched against DECLARED_PRODUCT_REGIONS labels, so East Africa
 *              means exactly the governed eleven and nothing else
 *   COUNTRY    the registry's own `name`
 *   CITY       the reference seed's own `name`, and its parent from the seed's
 *              OWN `iso3` — never from the camera
 *
 * Membership is READ here and never written. `declaredProductRegions.ts`
 * remains the only place a member list may exist.
 *
 * ─── WHAT THIS DELIBERATELY DOES NOT DO ───────────────────────────────────
 *
 * It does not decide WHICH rungs are visible. `breadcrumbLadder()` still does
 * that from zoom alone, and `rungName()` still refuses to name a rung the
 * camera has not reached. So the original "you are in Rwanda while the camera
 * is over the Pacific" lie remains impossible: this module changes what a
 * REACHED rung is called, never whether it is shown.
 *
 * It is not an intelligence selection either. A scope is the SELECTED
 * INTELLIGENCE GEOGRAPHY as the ladder must describe it; `MapSelection`
 * remains what makes an evidence claim, and a CONTINENT or SUBREGION scope
 * still carries no evidence claim at all.
 */

/**
 * WORLD is excluded deliberately. It is the one rung that is always true and
 * never names a place — `rungName` returns null for it and the navigator
 * prints its own word — so a WORLD scope would be a scope that scopes nothing.
 */
export type ScopeRung = Exclude<ScaleRung, 'WORLD'>;

export interface GeographyScope {
  readonly rung: ScopeRung;
  /**
   * The identity at that rung: a jump-target id for CONTINENT/SUBREGION/CITY,
   * or an ISO-3 for COUNTRY. It is matched against governed data below, so an
   * id that resolves to nothing yields UNRESOLVED rather than a guess.
   */
  readonly id: string;
}

/**
 * Comparison key that ignores nothing and invents nothing. Used so the shell
 * can avoid re-setting an identical scope, which would otherwise churn state.
 */
export function scopesEqual(a: GeographyScope | null, b: GeographyScope | null): boolean {
  if (a === null || b === null) return a === b;

  return a.rung === b.rung && a.id === b.id;
}

/** Case- and separator-insensitive, so `eastAfrica` matches the label `East Africa`. */
function normalise(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * The continent name, matched against the registry's own `region` values
 * rather than a table written here. `africa` -> `Africa`, `europe` -> `Europe`.
 */
function continentNameFor(id: string): string | null {
  const wanted = normalise(id);
  const match = COUNTRIES.find((country) => normalise(country.region) === wanted);

  return match?.region ?? null;
}

/** The governed region whose LABEL this scope id names. */
function declaredRegionByScopeId(id: string): DeclaredProductRegion | null {
  const wanted = normalise(id);

  return (
    DECLARED_PRODUCT_REGIONS.find((region) => normalise(region.label) === wanted) ?? null
  );
}

/**
 * The continent a governed region sits in, DERIVED FROM ITS MEMBERS.
 *
 * Every member of East Africa is `Africa` in the registry, so the answer is
 * Africa without anyone writing that down twice. A region whose members span
 * more than one continent — the Middle East spans Asia, Africa and Europe —
 * returns null rather than picking one, because there is no honest single
 * answer and a majority vote would invent one. A region with no enumerable
 * membership (BACKEND_PUBLISHED, unresolved on this client) also returns null,
 * for the reason `declaredRegionFor` already states: an empty list means "this
 * region cannot answer here", not "it has no members".
 */
function continentOfRegion(region: DeclaredProductRegion): string | null {
  const members = membersFor(region.id);
  if (members.length === 0) return null;

  const continents = new Set(
    members
      .map((iso3) => COUNTRIES.find((country) => country.iso3 === iso3)?.region)
      .filter((value): value is string => typeof value === 'string'),
  );

  return continents.size === 1 ? [...continents][0] : null;
}

function placeForCountry(iso3: string): ResolvedPlace {
  const meta = COUNTRIES.find((country) => country.iso3 === iso3);
  if (meta === undefined) return UNRESOLVED;

  return {
    continent: meta.region,
    subregion: declaredRegionFor(iso3),
    country: meta.name,
    countryIso3: iso3,
    city: null,
  };
}

/**
 * A city keeps its PARENT, which is the whole point of the CITY rung.
 *
 * The parent comes from the seed's own `iso3`, so Kigali is in Rwanda because
 * the gazetteer says so, not because the viewport happened to be over Rwanda.
 * That is what lets the ladder read `AFRICA · EAST AFRICA · RWANDA · KIGALI`
 * without the city identity collapsing into whatever country the camera is
 * centred on.
 */
function placeForCity(id: string): ResolvedPlace {
  const wanted = normalise(id);
  const seed = REFERENCE_PLACE_SEEDS.find(
    (place) => place.kind === 'city' && normalise(place.name) === wanted,
  );

  if (seed === undefined) return UNRESOLVED;

  const parent = seed.iso3 === undefined ? UNRESOLVED : placeForCountry(seed.iso3);

  return { ...parent, city: seed.name };
}

/** The place an explicit scope names. Pure, and never reads a camera. */
export function placeForScope(scope: GeographyScope): ResolvedPlace {
  switch (scope.rung) {
    case 'CONTINENT':
      /*
        `country` and `city` stay null BY CONSTRUCTION. This single line is what
        makes "AFRICA must not resolve to an arbitrary country" structural.
      */
      return { ...UNRESOLVED, continent: continentNameFor(scope.id) };

    case 'SUBREGION': {
      const region = declaredRegionByScopeId(scope.id);
      if (region === null) return UNRESOLVED;

      return {
        ...UNRESOLVED,
        continent: continentOfRegion(region),
        subregion: region.label,
      };
    }

    case 'COUNTRY':
      return placeForCountry(scope.id);

    case 'CITY':
      return placeForCity(scope.id);

    default:
      return UNRESOLVED;
  }
}

/**
 * The scope a jump target establishes.
 *
 * `JumpTarget` IS NOT MODIFIED — the CTO ruling holds the bounds-only AFRICA
 * and EAST AFRICA definitions correct and unchangeable, so the scope is read
 * FROM the existing target rather than stored on it. A COUNTRY target answers
 * with its declared ISO-3; every other rung answers with its own id, which is
 * matched against governed data by `placeForScope`.
 *
 * WORLD establishes no scope: returning null is what makes "Reset World" and a
 * world jump fall back to free-navigation context, which is the correct
 * behaviour for a view that names no place.
 */
export function scopeForJumpTarget(target: JumpTarget): GeographyScope | null {
  if (target.rung === 'WORLD') return null;

  if (target.rung === 'COUNTRY') {
    return target.countryIso3 === undefined
      ? null
      : { rung: 'COUNTRY', id: target.countryIso3 };
  }

  return { rung: target.rung, id: target.id };
}

/**
 * THE ONE ENTRY POINT THE LADDER USES.
 *
 * With an explicit scope the camera is not consulted at all — that is the
 * ruling, stated as code. Without one the reader is navigating freely and
 * `resolveCameraPlace` supplies view context exactly as before, which is the
 * "when appropriate" the ruling preserves.
 */
export function resolveLadderPlace(
  camera: CameraState,
  scope: GeographyScope | null,
): ResolvedPlace {
  return scope === null ? resolveCameraPlace(camera) : placeForScope(scope);
}
