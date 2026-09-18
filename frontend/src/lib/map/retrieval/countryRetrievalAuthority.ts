import type { MapSelection } from '@/lib/map/state/mapState';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * COUNTRY RETRIEVAL AUTHORITY — WHO IS ALLOWED TO SPEND PROVIDER QUOTA
 * ════════════════════════════════════════════════════════════════════════════
 *
 * `MAP-GNEWS-QUOTA-REGRESSION-1`. `GET /news/country/:iso3` executes a news
 * provider on every distinct country — measured live at **4 calls, 0 cache
 * hits, 4 provider executions**, one of which came back
 * `[rate-limited] GNews rate limit exceeded`.
 *
 * ── THE DEFECT THIS CLOSES, EXACTLY ──────────────────────────────────────
 *
 * Retrieval was reachable by ARRIVING AT A COUNTRY, not by CHOOSING one. Three
 * of the four live retrievals were for countries the reader never selected —
 * SWZ, COD and CAF — and the last of those is the East Africa collapse.
 *
 * The chain that made a transient mistake permanent:
 *
 *   1. something sets `selectedCountry` to a positionally-derived country
 *   2. the URL writer writes `country=<it>` from `selectedCountry` ALONE,
 *      without consulting the semantic selection
 *   3. hydration reads `country=` and retrieves UNCONDITIONALLY
 *
 * So one wrong frame became a URL, and that URL re-spent quota on every load,
 * share and restore. **Step 3 is where the money was spent, and it is the step
 * that had no user in it at all.**
 *
 * ── WHY A REASON TOKEN, AND NOT A BOOLEAN OR A CHECK ─────────────────────
 *
 * A boolean argument is something a future caller passes `true` to because the
 * compiler asked for an argument. This type cannot be produced by accident: the
 * only values that satisfy it are the three named below, each documented with
 * the user action it stands for, and each created at a real event handler.
 *
 * The rule is therefore enforced by CONSTRUCTION rather than by a check that
 * could be forgotten — the same discipline `geographyScope.ts` already applies
 * to the ladder, and for the same reason: this defect class has now returned
 * twice, and a check is exactly what it walked around both times.
 *
 * ── NO COUNTRY IS SPECIAL-CASED ──────────────────────────────────────────
 *
 * Neither `CAF` nor any other ISO-3 appears in this file. CAF was a symptom of
 * positional derivation, not a value to filter, and East Africa's membership is
 * untouched.
 */

/**
 * ══ THE BOUNDARY MOVED — SELECTION IS NO LONGER A RETRIEVAL REASON ════════
 *
 * WHAT LIVE ACCEPTANCE PROVED. Selecting Kenya and Rwanda on the Map issued
 * `GET /news/country/KEN` and `GET /news/country/RWA`, and the backend log
 * showed GNews Search executing for each. That was PERMITTED by the three
 * reasons this type used to carry — MAP_COUNTRY_CLICK,
 * EXPLICIT_COUNTRY_SELECTION and CATEGORY_CHANGE_ON_SELECTED_COUNTRY — so it
 * was not a defect against the old authority. It is a defect against the
 * product's explicit-cost direction, and the CTO ruling moves the line:
 *
 *     NAVIGATION AND SELECTION ARE PROVIDER-FREE.
 *     EXTERNAL RETRIEVAL HAPPENS ONLY BEHIND AN EXPLICIT READER ACTION.
 *
 * So all three old reasons are RETIRED, and they join the forbidden list below
 * by name rather than merely vanishing — a reason that disappears quietly is a
 * reason someone re-adds.
 *
 * WHAT A COUNTRY SELECTION DOES NOW: establishes semantic COUNTRY scope, frames
 * the camera, writes the URL, opens the rail, and shows RETAINED corpus and
 * `/geo/map-feed` evidence if either is already held. None of that touches a
 * provider.
 *
 * WHAT STILL RETRIEVES: an explicitly labelled research action. Deliberate
 * country analysis is NOT removed — it moves entirely behind the reader's own
 * request.
 */
export type CountryRetrievalReason =
  /** The reader pressed Open Analysis, or submitted an Ask AI question. */
  | 'EXPLICIT_ANALYSIS_REQUEST'
  /** Another explicitly labelled research / retrieval control. */
  | 'EXPLICIT_RETRIEVAL_ACTION';

export const COUNTRY_RETRIEVAL_REASONS: readonly CountryRetrievalReason[] = [
  'EXPLICIT_ANALYSIS_REQUEST',
  'EXPLICIT_RETRIEVAL_ACTION',
];

/**
 * Everything that must NEVER authorize retrieval, named so the prohibition is
 * readable rather than implied by absence.
 *
 * These are not parameters to anything. They are the list from the ruling,
 * written down where the rule lives, and asserted by test against the reasons
 * above — so the two sets can never overlap.
 */
export const FORBIDDEN_RETRIEVAL_TRIGGERS: readonly string[] = [
  /*
    THE THREE RETIRED REASONS, NAMED RATHER THAN DELETED. Live acceptance
    showed each of them executing GNews from an act the reader understood as
    navigation. They are prohibitions now, and keeping the old spellings here
    is what makes a re-introduction fail a test instead of passing review.
  */
  'COUNTRY_SELECTION',
  'MAP_COUNTRY_CLICK',
  'EXPLICIT_COUNTRY_SELECTION',
  'CATEGORY_CHANGE_ON_SELECTED_COUNTRY',
  'SEARCH_COUNTRY_COMMIT',
  'REGION_SELECTION',
  /*
    CITY_SELECTION joins the prohibition alongside the CITY selection kind.

    §11 makes it a release gate — "zero executing-provider calls for CITY
    selection" — and it is also the honest outcome. The evidence ceiling is
    COUNTRY, so retrieving Rwanda's articles because a reader looked at Kigali
    would spend a provider call on a country they did not choose, and then show
    the result under the city's name. The city card NAMES Rwanda as the
    evidence geography instead; naming is not retrieving.
  */
  'CITY_SELECTION',
  'CAMERA_MOTION',
  'MAP_CENTERING',
  'HYDRATION',
  'URL_RECONCILIATION',
  'BREADCRUMB_RECONSTRUCTION',
  'ZOOM',
  'PAN',
  'POSITIONAL_GEOGRAPHY',
];

export function isCountryRetrievalReason(value: unknown): value is CountryRetrievalReason {
  return (
    typeof value === 'string' &&
    (COUNTRY_RETRIEVAL_REASONS as readonly string[]).includes(value)
  );
}

/**
 * ── THE SECOND HALF: THE URL MAY ONLY NAME A SEMANTICALLY SELECTED COUNTRY ──
 *
 * `country=` used to be written from `selectedCountry` alone, so a region
 * selection could produce `?country=CAN&sel=region:eastern-africa` — the panel
 * describing one place, the rail another, and a shared link restoring both.
 *
 * Writing it only when the SEMANTIC selection is that same country makes the
 * disagreement unrepresentable, and it is what stops a camera-derived country
 * from being persisted into a link that later re-spends quota.
 */
export function countryParamFor(
  selection: MapSelection | null,
  selectedIso3: string | null,
): string | null {
  if (selectedIso3 === null) return null;
  if (selection === null) return null;
  if (selection.kind !== 'COUNTRY') return null;
  if (selection.id !== selectedIso3) return null;

  return selectedIso3;
}
