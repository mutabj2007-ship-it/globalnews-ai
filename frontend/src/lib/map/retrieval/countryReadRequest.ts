/**
 * ════════════════════════════════════════════════════════════════════════════
 * THE COUNTRY READ REQUEST — MAIN-COUNTRY-READER-RETRIEVAL-CONTRACT-R1
 * ════════════════════════════════════════════════════════════════════════════
 *
 * PROPOSED for `frontend/src/lib/map/retrieval/countryReadRequest.ts`.
 * Nothing lands without authorization. No provider activation. No deployment.
 *
 *     COUNTRY SELECTED  ->  explicit reader action  ->  the governed seam
 *                       ->  CountryPanel.response
 *
 * ── THE SEAM WAS ALREADY BUILT. WHAT IS MISSING IS A CALLER. ──────────────
 *
 * `countryRetrievalAuthority.ts` is accepted and landed, and it already carries
 * the reason this round was asked to define:
 *
 *     'EXPLICIT_RETRIEVAL_ACTION'   "Another explicitly labelled research /
 *                                    retrieval control."
 *
 * beside `'EXPLICIT_ANALYSIS_REQUEST'`, under the ruling it records verbatim:
 *
 *     "NAVIGATION AND SELECTION ARE PROVIDER-FREE.
 *      EXTERNAL RETRIEVAL HAPPENS ONLY BEHIND AN EXPLICIT READER ACTION."
 *
 * Measured: **nothing in production constructs `EXPLICIT_RETRIEVAL_ACTION`.**
 * It is a reserved reason with zero call sites, and that — not a missing
 * contract — is why a newly selected country never obtains a response.
 *
 * `MapPageClient` states the mechanical cause in its own bytes: *"`fetchCountryNews`
 * executes GNews. With the import gone the Map has no way to …"*. The import was
 * removed deliberately to close the quota regression, and nothing replaced it
 * behind an explicit control. **The door was locked and no handle was fitted.**
 *
 * So this module adds no retrieval mechanism, no client, no cache and no state
 * machine. It is the narrow, typed request that the one missing call site
 * constructs, and it exists so the call site cannot be written any other way.
 */

import type { CountryRetrievalReason } from '@/lib/map/retrieval/countryRetrievalAuthority';
import type { MapSelection } from '@/lib/map/state/mapState';

/* ═══════════════════════════════════════════════════════════════════════════
 * 1 · THE COST CLASS, STATED RATHER THAN DISCOVERED
 * ═══════════════════════════════════════════════════════════════════════════ */

/**
 * What an action is allowed to spend. Three classes, closed, and ordered by
 * what they cost the reader — so a surface can state the cost BEFORE the reader
 * commits rather than after.
 */
export type CountryReadCostClass =
  /** Nothing leaves the browser. The retained corpus answers, or it does not. */
  | 'RETAINED_ONLY'
  /**
   * The browser calls OUR API and nothing else. The API may execute a NEWS
   * provider server-side. **No model. No OpenAI. No browser-to-provider call.**
   */
  | 'API_ORIGIN_READ'
  /**
   * The separate, explicitly invoked Ask / Analysis action, which may execute a
   * model. NOT reachable from country loading, and named here only so the two
   * can never be confused for one another.
   */
  | 'ANALYSIS';

/**
 * THE COST OF LOADING A COUNTRY, FIXED.
 *
 * `API_ORIGIN_READ`, and the number that matters is derived rather than
 * asserted: the transitive import closure of `country-news.service.ts` is 29
 * files, four of which contain the string "OpenAI" — and in EXECUTABLE bytes
 * those four contain it **zero** times, except one log scrubber whose two uses
 * are a regex that REMOVES `sk-…` keys from log output. Stripping a key is not
 * calling a model.
 *
 * So: **0 OpenAI on the country read path**, measured, not assumed.
 */
export const COUNTRY_READ_COST_CLASS: CountryReadCostClass = 'API_ORIGIN_READ';

/* ═══════════════════════════════════════════════════════════════════════════
 * 2 · THE REQUEST
 * ═══════════════════════════════════════════════════════════════════════════ */

/**
 * A country read the reader asked for.
 *
 * ── ENFORCEMENT BY ABSENCE ────────────────────────────────────────────────
 *
 * `reason` is `'EXPLICIT_RETRIEVAL_ACTION'` and nothing else. The wider
 * `CountryRetrievalReason` also admits `'EXPLICIT_ANALYSIS_REQUEST'`, and that
 * one belongs to Analysis — a country LOAD must not be constructible with an
 * Analysis reason, because the two have different cost classes and a reader who
 * pressed "load coverage" has not consented to the second.
 *
 * The narrowing is the guarantee. There is no boolean to pass `true` to, no
 * `force`, no `auto`, and no default: a caller cannot ask for this without
 * naming the reader action that produced it.
 */
export interface CountryReadRequest {
  readonly reason: Extract<CountryRetrievalReason, 'EXPLICIT_RETRIEVAL_ACTION'>;
  /** The ISO3 of the SEMANTICALLY selected country. Never camera-derived. */
  readonly iso3: string;
  /** The reader's current category filter, carried unchanged. */
  readonly category: string | null;
  readonly language: string;
}

/**
 * Build the request, or refuse.
 *
 * REFUSES WHEN THE SELECTION IS NOT THAT COUNTRY — the same predicate
 * `countryParamFor` already applies to the URL, for the same reason recorded
 * there: *"a camera-derived country … persisted into a link that later re-spends
 * quota."* A read must be authorised by what the reader CHOSE, never by where
 * the map happens to be pointing.
 */
export function countryReadRequestFor(
  selection: MapSelection | null,
  selectedIso3: string | null,
  category: string | null,
  language: string,
): CountryReadRequest | null {
  if (selectedIso3 === null || selection === null) return null;
  if (selection.kind !== 'COUNTRY') return null;
  if (selection.id !== selectedIso3) return null;

  return { reason: 'EXPLICIT_RETRIEVAL_ACTION', iso3: selectedIso3, category, language };
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 3 · THE READER STATE — THE PANEL'S OWN BRANCHES, NAMED
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `CountryPanel` already implements every one of these; what it lacks is a name
 * for them and a way to reach the loaded ones. The names below are Main's, the
 * branches are the panel's, and no new branch is added.
 *
 *   UNSELECTED           the panel is not rendered at all
 *   SELECTED_NOT_LOADED  `!response`      -> the prompt slot
 *   LOADING              `isLoading`      -> the existing spinner, role=status
 *   READY                `response.articles.length > 0`
 *   READY_NO_COVERAGE    `response.articles.length === 0` -> the existing
 *                        no-coverage copy. A GOVERNED GAP, not an error
 *   FAILED               `error !== null` -> the existing alert slot, but see
 *                        the rule below: a reader never reads a stack
 */
export type CountryReadState =
  | 'UNSELECTED'
  | 'SELECTED_NOT_LOADED'
  | 'LOADING'
  | 'READY'
  | 'READY_NO_COVERAGE'
  | 'FAILED';

export interface CountryPanelInputs {
  readonly selected: boolean;
  readonly isLoading: boolean;
  readonly error: unknown;
  readonly response: { readonly articles: readonly unknown[] } | null;
}

/**
 * The state the panel is in, derived from the props it already takes.
 *
 * THE ORDER IS THE PANEL'S ORDER, and it is load-bearing: `isLoading` is tested
 * before `error`, and `error` before `!response`, exactly as the landed
 * component does. Deriving them in a different order would describe a component
 * that does not exist.
 */
export function countryReadState(input: CountryPanelInputs): CountryReadState {
  if (!input.selected) return 'UNSELECTED';
  if (input.isLoading) return 'LOADING';
  if (input.error !== null && input.error !== undefined) return 'FAILED';
  if (input.response === null) return 'SELECTED_NOT_LOADED';

  return input.response.articles.length === 0 ? 'READY_NO_COVERAGE' : 'READY';
}

/** The states in which the explicit load control is offered. */
export function loadActionIsOffered(state: CountryReadState): boolean {
  return state === 'SELECTED_NOT_LOADED' || state === 'READY_NO_COVERAGE' ||
    state === 'FAILED' || state === 'READY';
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 4 · WHAT MAY BE SHOWN WITHOUT SPENDING ANYTHING
 * ═══════════════════════════════════════════════════════════════════════════ */

/**
 * `RETAINED_ONLY` answers first, always.
 *
 * The retained corpus is already keyed by country with a 300 s TTL, and it
 * already REFUSES to retain an empty corpus — so a cache hit can never present
 * "nothing" as an answer. That refusal is the reason the cache is trustworthy
 * here and is not re-implemented.
 *
 * `null` means "ask the reader", never "show an empty country".
 */
export type CountryCacheOutcome =
  /** A retained corpus exists and is within TTL. Render it. Cost: RETAINED_ONLY. */
  | 'HIT'
  /** Nothing retained, or the TTL expired. Offer the explicit action. */
  | 'MISS';

export function countryCacheOutcome(retained: unknown | null | undefined): CountryCacheOutcome {
  return retained === null || retained === undefined ? 'MISS' : 'HIT';
}
