/**
 * ════════════════════════════════════════════════════════════════════════════
 * WHAT A COMPLETED COUNTRY READ LOOKS LIKE ON THE MODERN CARD
 * ════════════════════════════════════════════════════════════════════════════
 *
 * `MAIN-COUNTRY-READER-RETRIEVAL-CONTRACT-R1` §6 lists what a successful
 * retrieval populates, and closes with the rule that matters most: **"No field
 * is invented to justify ACTIVE."**
 *
 * Main's table maps each item onto the LEGACY panel's slots —
 * `CountryContextShelf`, the `CountryArticleCard` stream. The modern shell does
 * not render either of those. It renders `EvidenceSelectionCard`, whose Design
 * Revision 1.2 blocks are the same information under different names, and every
 * one of them already has a landed adapter taking exactly the response
 * `fetchCountryNews` returns:
 *
 *     Main §6 asked for      modern block   adapter (all pre-existing)
 *     ─────────────────      ────────────   ──────────────────────────
 *     coverage               05             coverageStateFrom
 *     provenance / provider  02             providerStatusFrom
 *     available intelligence 09             retainedItemsFrom
 *     category context       06             categoryDistribution
 *     layer / context        10             retainedTopics
 *     country name, ISO      01             already rendered from the selection
 *
 * SO NOTHING IS BUILT HERE. This module is the join between a response and
 * props that already exist, kept out of the route component so that the mapping
 * is readable and testable on its own, and so the route holds state rather than
 * presentation logic.
 */
import type { CountryNewsResponse } from '@globalnews-ai/shared';
import type { MapPeriod } from '@/lib/map/state/mapState';
import type { LanguageCode } from '@globalnews-ai/shared';
import {
  categoryDistribution,
  coverageStateFrom,
  providerStatusFrom,
  retainedItemsFrom,
  retainedTopics,
  type CategoryCount,
  type CoverageState,
  type ProviderStatus,
  type RetainedItem,
} from '@/lib/map/selection/selectionIntelligence';
import type { CountryReadState } from '@/lib/map/retrieval/countryReadRequest';

/**
 * Everything the card needs in order to show a read, and nothing else.
 *
 * `state` and `onLoad` are always present; the five data blocks are present
 * only in `READY`, because Design's rule for this card is that *"a block with
 * no data is omitted"* and `undefined` is how a caller says it has none. A
 * caller that passed empty shapes instead would make the card render headings
 * over nothing.
 */
export interface CountryReadPresentation {
  readonly state: CountryReadState;
  /** The explicit reader action. The only thing that may start a read. */
  readonly onLoad: () => void;
  readonly providerStatus?: ProviderStatus;
  readonly coverage?: CoverageState;
  readonly categories?: readonly CategoryCount[];
  readonly items?: readonly RetainedItem[];
  readonly topics?: readonly string[];
}

/**
 * Build the presentation.
 *
 * THE DATA BLOCKS APPEAR ONLY IN `READY`, AND THAT IS THE POINT OF THE STATE
 * MACHINE. `READY_NO_COVERAGE` is a governed gap — we asked and there was
 * nothing — so it carries the provider status (which says who was asked) and no
 * item stream. Rendering an empty stream there would turn *"no verified
 * coverage"* into *"nothing is happening"*, which §5 forbids and which is the
 * distinction this whole round exists to keep.
 */
export function countryReadPresentationFrom(input: {
  readonly state: CountryReadState;
  readonly response: CountryNewsResponse | null;
  readonly period: MapPeriod;
  readonly language: LanguageCode;
  readonly now: number;
  readonly onLoad: () => void;
}): CountryReadPresentation {
  const { state, response, onLoad } = input;

  if (response === null || (state !== 'READY' && state !== 'READY_NO_COVERAGE')) {
    return { state, onLoad };
  }

  /*
    PROVIDER STATUS IS CARRIED IN BOTH READY STATES. "We asked nobody" and "we
    asked and there was nothing" are different answers and only one of them is
    about the world — `selectionIntelligence` says so in its own header, and
    dropping the status on the empty case would collapse them.
  */
  const providerStatus = providerStatusFrom(response);
  if (state === 'READY_NO_COVERAGE') return { state, onLoad, providerStatus };

  return {
    state,
    onLoad,
    providerStatus,
    coverage: coverageStateFrom(response, input.period, input.now, input.language),
    categories: categoryDistribution(response.articles),
    items: retainedItemsFrom(response.articles),
    topics: retainedTopics(response.articles),
  };
}
