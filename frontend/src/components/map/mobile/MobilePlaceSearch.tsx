'use client';

import { useId, useState } from 'react';
import type { GeographyTotal } from '@/lib/map/evidence/evidenceModel';
import type { PlaceResult } from '@/lib/map/search/placeSearch';
import { useNavigatorPlaceSearch } from '@/lib/map/search/navigatorPlaceSearch';
import { usePlaceSearchKeyboard } from '@/lib/map/search/placeSearchKeyboard';
import type { PlaceSearchLabels } from '@/components/map/shell/PlaceSearch';
import { MIN_TOUCH_PX } from './MobileBottomSheet';

/**
 * MOBILE SPATIAL MVP — SEARCH.
 *
 * ── THE SAME CONTRACT, NOT THE SAME COMPONENT ─────────────────────────────
 *
 * `useNavigatorPlaceSearch` is imported, not reimplemented, and
 * `PlaceSearchLabels` is the desktop bundle. So the coverage statement, the
 * ranking, the evidence annotations and the typed kinds are one behaviour with
 * two presentations. Nothing here knows what a place IS; it only knows how to
 * show one on a phone.
 *
 * ── THE CEILING IS GONE, AND IT WAS REMOVED BY THE BACKEND ────────────────
 *
 * This surface used to say "countries and regions only", because that was all
 * the frontend table held. G's navigator now resolves the whole ladder —
 * region, country, admin1, admin2, city — so the hook queries it and this list
 * shows what comes back. The removal is real: no local settlement table was
 * added here to make the placeholder true.
 *
 * NOTHING IS INVENTED. Every row below came from either the shipped country
 * table or G's gazetteer. If the data does not hold a place, no row appears for
 * it — there is no fallback list and no "did you mean".
 *
 * ── AND A CITY ROW NEVER CLAIMS THE COUNTRY'S EVIDENCE ────────────────────
 *
 * A row for Kigali inside a Rwanda that has 34 retained reports is annotated
 * "34 reports in Rwanda", not "34 reports". Navigating to a city is not the
 * same as knowing something about it, and a suggestion list is the worst place
 * to blur that.
 *
 * ── WHY IT IS NOT THE DESKTOP FIELD SHRUNK ────────────────────────────────
 *
 * The desktop field is 290 px in a 44 px HUD row with a dropdown that must not
 * cover the map. Here the field is the full width of the phone, every row is a
 * 44 px target, and the result list is allowed to take the screen — on a phone
 * the list IS the task while it is open, and pretending otherwise produces the
 * 30 px rows that make mobile search feel broken.
 *
 * The M4-A repair is carried over deliberately: a press inside the list cancels
 * its own blur, so the row a finger is on cannot be unmounted before the tap
 * completes. That defect was measured on the desktop field with a 250 ms press;
 * a touch press is longer, not shorter.
 */

export interface MobilePlaceSearchProps {
  readonly totals: readonly GeographyTotal[];
  readonly onSelectResult: (result: PlaceResult) => void;
  readonly labels: PlaceSearchLabels;
  readonly countryNames?: Readonly<Record<string, string>>;
  readonly regionNames?: Readonly<Record<string, string>>;
}

export function MobilePlaceSearch({
  totals,
  onSelectResult,
  labels,
  countryNames,
  regionNames,
}: MobilePlaceSearchProps): JSX.Element {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const listId = useId();

  const { results, deepening, deepSearched } = useNavigatorPlaceSearch({
    query,
    totals,
    countryNames,
    regionNames,
  });

  const showList = open && query.trim().length > 0;

  /*
    "NO RESULTS" IS A CLAIM, AND IT WAITS FOR THE EVIDENCE TO MAKE IT.

    While the navigator request is outstanding, an empty list means "not yet",
    not "nowhere". Telling a reader their place does not exist and then showing
    it 200 ms later is worse than showing nothing for 200 ms.
  */
  const sayNoResults = results.length === 0 && !deepening && deepSearched;

  /*
    ── R6 — THE KEYBOARD PATH, WHICH DID NOT EXIST ON THIS FIELD ────────────

    MEASURED by H at 390x844. Pointer selection worked end to end — France
    selected, `/map?country=FRA&sel=country%3AFRA`, sheet populated. Keyboard
    did not: `Enter` committed nothing, `ArrowDown` + `Enter` committed
    nothing, and `aria-activedescendant` was null. The desktop composition was
    unaffected.

    THE CAUSE WAS NOT A MOBILE-SPECIFIC BUG. This field declared
    `role="combobox"` with `aria-expanded` and `aria-controls` — the same ARIA
    promise the desktop field makes — and then handled no keys at all. That is
    the identical defect the desktop field already had and already fixed; the
    fix simply never reached here, because it lived inside that component.

    SO IT IS NOT RE-DERIVED HERE. `usePlaceSearchKeyboard` is the accepted
    desktop logic lifted into one module, and both fields call it: same keys,
    same "no highlight yet means the first row" rule, same Escape semantics,
    same option ids. Writing a second handler for this field is what would
    guarantee the two surfaces drift apart again.

    POINTER BEHAVIOUR IS UNCHANGED. The row button still commits on click,
    through the same commit path the keyboard uses — one behaviour, two
    gestures — and the M4-A press/blur repair below is untouched.
  */
  const keyboard = usePlaceSearchKeyboard({
    results,
    showList,
    listId,
    onCommit: (result) => {
      onSelectResult(result);
      /*
        MAP-SEARCH-DROPDOWN-DISMISSAL — the identical rule, and identical on
        purpose. This field had the identical keyboard defect before the logic
        was lifted into `usePlaceSearchKeyboard`, for the identical reason: a
        behaviour kept in two components is a behaviour that drifts. The query
        is each field's own state so the hook cannot clear it, and
        `placeSearchDismissal.spec.ts` asserts BOTH call sites do.

        It matters more here, not less: on a phone the dropdown covers most of
        the map, so a list that returns on focus hides the place that was just
        selected.
      */
      setQuery('');
      setOpen(false);
    },
    onDismiss: () => setOpen(false),
  });

  return (
    <div data-gn="mobile-place-search" className="relative w-full">
      <label className="sr-only" htmlFor={`${listId}-input`}>
        {labels.label}
      </label>

      <input
        id={`${listId}-input`}
        type="search"
        role="combobox"
        autoComplete="off"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        /* What Enter would take, announced rather than only painted. */
        aria-activedescendant={keyboard.activeDescendantId}
        value={query}
        placeholder={labels.placeholder}
        onKeyDown={keyboard.onKeyDown}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
          /*
            The highlight indexes THIS list. A new query is a different list, so
            a stale index would let Enter commit a row the reader never saw.
          */
          keyboard.resetActiveIndex();
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 120)}
        style={{ minHeight: `${MIN_TOUCH_PX}px` }}
        /*
          DESIGN v1.6 — SEARCH AS A PRIMARY NAVIGATION CONTROL.

          The revision's finding was that a working control rendered on the
          passive text ramp reads as decoration. So the field is LIFTED off the
          surface rather than recessed into it: a #101E28 fill against the
          panel, a .45 border that strengthens to .62 on press, and a cyan focus
          border with a 2 px ring. It is an affordance before it is touched.

          v1.6's desktop tokens are transposed, not shrunk. Type is 13 px rather
          than the desktop's 11.5 px because a phone is held further from the
          eye than a monitor is, and `hover` is expressed as `active` because a
          touch surface has no hover state to strengthen into.
        */
        className="w-full rounded-[3px] border border-[rgba(126,166,186,.45)] bg-[#101E28] px-[12px] py-[11px] font-gn-mono text-[13px] tracking-[0.04em] text-[#E9F3F8] outline-none transition-[background-color,border-color] duration-[140ms] placeholder:text-[#7C93A2] active:border-[rgba(126,166,186,.62)] focus:border-[rgba(58,214,230,.7)] focus:bg-[#13242F] focus:shadow-[0_0_0_2px_rgba(58,214,230,.16)]"
      />

      {showList && (
        <ul
          id={listId}
          role="listbox"
          aria-label={labels.resultsLabel}
          data-gn="mobile-search-results"
          /*
            M4-A, CARRIED OVER. Cancelling the default of a press inside the
            list stops the field blurring, so the 120 ms unmount never starts
            and the row under the finger is still mounted when the tap
            completes. A touch press is longer than the 250 ms that broke the
            desktop field, not shorter.
          */
          onMouseDown={(event) => event.preventDefault()}
          className="absolute inset-x-0 top-[calc(100%+6px)] z-50 max-h-[52dvh] overflow-y-auto overscroll-contain rounded-[3px] border border-sp-line-2 bg-sp-panel-2"
        >
          <li
            data-gn="mobile-search-coverage"
            className="border-b border-sp-line-3 px-[12px] py-[7px] font-gn-mono text-[9px] uppercase tracking-[0.14em] text-sp-ink-3/80"
          >
            {labels.coverageNote}
          </li>

          {deepening && (
            <li
              data-gn="mobile-search-deepening"
              className="border-b border-sp-line-3 px-[12px] py-[9px] font-gn-mono text-[10px] uppercase tracking-[0.1em] text-sp-ink-3"
            >
              {labels.searching}
            </li>
          )}

          {sayNoResults && (
            <li
              data-gn="mobile-search-empty"
              className="px-[12px] py-[12px] font-gn-mono text-[11px] uppercase tracking-[0.1em] text-sp-ink-3"
            >
              {labels.noResults}
            </li>
          )}

          {results.map((result, index) => (
            <li
              key={result.id}
              id={keyboard.optionId(index)}
              role="option"
              aria-selected={index === keyboard.activeIndex}
            >
              <button
                type="button"
                data-gn="mobile-search-result"
                data-gn-kind={result.kind}
                data-gn-highlighted={index === keyboard.activeIndex ? 'true' : undefined}
                onClick={() => keyboard.commit(result)}
                style={{ minHeight: `${MIN_TOUCH_PX}px` }}
                className={`flex w-full items-center justify-between gap-[10px] border-b border-sp-line-3 px-[12px] py-[11px] text-left text-[13.5px] text-sp-ink last:border-b-0 active:bg-sp-cyan/[0.08] ${
                  index === keyboard.activeIndex ? 'bg-sp-cyan/[0.08]' : ''
                }`}
              >
                <span className="min-w-0 truncate">
                  {result.label}
                  <span className="ml-[7px] font-gn-mono text-[9px] uppercase tracking-[0.12em] text-sp-ink-3">
                    {labels.kinds[result.kind] ?? result.kind}
                  </span>
                  {/*
                    WHERE IT IS. Three real rungs of one place — city, province,
                    district — arrive with the same name, and without this they
                    read as a search returning the same row three times.
                  */}
                  {result.context !== undefined && (
                    <span
                      data-gn="mobile-search-context"
                      className="mt-[2px] block truncate text-[10.5px] text-sp-ink-3"
                    >
                      {result.context}
                    </span>
                  )}
                </span>

                {/*
                  THREE ANSWERS, AND THE MIDDLE ONE IS THE POINT.

                  EVIDENCE     the count is about THIS place
                  IN_COUNTRY   the count is about the country CONTAINING it, and
                               says so — a Kigali row reads "34 reports in
                               Rwanda", never "34 reports"
                  REFERENCE    the platform holds nothing here, which is itself
                               an intelligence answer (Part II §8 q7)
                */}
                <span className="shrink-0 font-gn-mono text-[9px] uppercase tracking-[0.12em] text-sp-ink-3">
                  {result.annotation.kind === 'EVIDENCE' &&
                    `${result.annotation.reportCount} ${labels.reports}`}
                  {result.annotation.kind === 'IN_COUNTRY' &&
                    `${result.annotation.reportCount} ${labels.reports} ${labels.inCountry} ${result.annotation.countryLabel}`}
                  {result.annotation.kind === 'REFERENCE' && labels.reference}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
