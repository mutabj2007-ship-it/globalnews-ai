'use client';

import { useId, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import type { GeographyTotal } from '@/lib/map/evidence/evidenceModel';
import type { PlaceResult } from '@/lib/map/search/placeSearch';
import { useNavigatorPlaceSearch } from '@/lib/map/search/navigatorPlaceSearch';
import { usePlaceSearchKeyboard } from '@/lib/map/search/placeSearchKeyboard';

/**
 * SPATIAL M2 — PLACE SEARCH, FROM DESIGN PART I §C AND PART II §8 Q7.
 *
 * "One field over countries, cities, water bodies and situations. Results are
 * typed and SHOW EVIDENCE COUNTS WHERE THEY EXIST, so a search result already
 * tells the user whether the platform knows anything there."
 *
 * ── THE ANSWER THAT MAKES THIS A FEATURE RATHER THAN A LOOKUP ─────────────
 *
 * Part II §8 question 7, which this component's whole shape follows:
 *
 *     "the card reads NO RETAINED EVIDENCE FOR THIS AREA with the period
 *      stated ... Search must never be limited to places the platform has
 *      evidence for — the ability to look somewhere and BE TOLD PLAINLY THAT
 *      NOTHING IS KNOWN is itself an intelligence answer."
 *
 * So a place with no evidence is a result annotated REFERENCE, never a missing
 * row. The two annotations render differently in kind — a count versus a word
 * — because a count of zero and "we have nothing retained here in this period"
 * are different statements and must not look alike.
 *
 * ── WHAT IT DOES NOT SEARCH, AND SAYS SO ──────────────────────────────────
 *
 * The gazetteer is "Partial · M2" in Part II §4 and is G's to build. Cities,
 * water bodies and situations are therefore NOT searched today, and the field
 * states that rather than letting its placeholder imply a coverage it does not
 * have. A user who types a city name and gets nothing must be able to tell
 * "not indexed yet" from "nothing happening there".
 *
 * ── AND WHAT IT DOES NOT DO ───────────────────────────────────────────────
 *
 * It does not move the camera. Part II §3: "Search and breadcrumbs call
 * FOCUS." It emits a result; the shell turns that into a focus intent, which
 * is what puts the move in the camera history like every other move.
 */

export interface PlaceSearchLabels {
  readonly label: string;
  readonly placeholder: string;
  readonly resultsLabel: string;
  readonly noResults: string;
  /**
   * WHAT THIS FIELD ACTUALLY COVERS, STATED AS A FACT AND NOT AS A CEILING.
   *
   * It used to read "Countries and regions only", which was true and which
   * described the coverage as permanent. G's navigator resolves the whole
   * ladder now — region, country, admin1, admin2, city — so the note names the
   * rungs that are searchable rather than the ones that are not.
   */
  readonly coverageNote: string;
  /** Shown while the navigator request for the current query is outstanding. */
  readonly searching: string;
  readonly reference: string;
  readonly reports: string;
  /**
   * The preposition in "12 reports IN Rwanda", for a row whose evidence belongs
   * to the containing country rather than to the place itself.
   */
  readonly inCountry: string;
  readonly kinds: Readonly<Record<string, string>>;
}

export interface PlaceSearchProps {
  readonly totals: readonly GeographyTotal[];
  readonly onSelectResult: (result: PlaceResult) => void;
  readonly labels: PlaceSearchLabels;
  readonly countryNames?: Readonly<Record<string, string>>;
  readonly regionNames?: Readonly<Record<string, string>>;
  readonly className?: string;
}

export function PlaceSearch({
  totals,
  onSelectResult,
  labels,
  countryNames,
  regionNames,
  className = '',
}: PlaceSearchProps): JSX.Element {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const listId = useId();

  /*
    ── THE ENGINE IS NOW LOCAL + NAVIGATOR ───────────────────────────────────

    `searchPlaces` alone could only ever return countries and configured
    regions, which is why this field's coverage note named that as a ceiling.
    The hook keeps those rows — they are the ones carrying real evidence for the
    current mode and period — and merges G's ladder underneath them, so admin1,
    admin2 and city rungs arrive without anything here learning what a place is.

    KEYBOARD NAVIGATION IS UNCHANGED. `results` is still one ordered array and
    `activeIndex` still indexes it; rows appended when the navigator answers
    extend the list the arrow keys already walk. The highlight is reset on every
    query change (see the note above `activeIndex`), which is also what keeps a
    late arrival from moving the highlight under the reader's fingers.
  */
  const { results, deepening, deepSearched } = useNavigatorPlaceSearch({
    query,
    totals,
    countryNames,
    regionNames,
  });

  const showList = open && query.trim().length > 0;

  /*
    "NO RESULTS" WAITS FOR THE NAVIGATOR TO HAVE ANSWERED. An empty list with a
    request still outstanding means "not yet", and saying "no place matches
    that name" before looking is a claim this field has not earned.
  */
  const sayNoResults = results.length === 0 && !deepening && deepSearched;

  /*
    ── PO-2 — THE KEYBOARD PATH, NOW ONE SHARED IMPLEMENTATION ──────────────

    This field declared `role="combobox"` with `aria-expanded` and
    `aria-controls` and then handled no keys at all. Measured on the integrated
    build: typing "Poland" produced its result row, ArrowDown did nothing,
    Enter did nothing, the camera never moved and the list stayed open. Only a
    mouse click worked.

    R6 — THE MOBILE FIELD HAD THE IDENTICAL DEFECT, because this logic lived in
    this component instead of in one place. It now lives in
    `usePlaceSearchKeyboard`, lifted from here VERBATIM, and both fields call
    it. Nothing about this field's behaviour changes: same keys, same
    first-row-on-Enter rule, same Escape semantics, same option ids.

    The commit path is still the SAME `onSelectResult` the row's own button
    calls. Keyboard and mouse are one behaviour, not two.
  */
  const keyboard = usePlaceSearchKeyboard({
    results,
    showList,
    listId,
    onCommit: (result) => {
      onSelectResult(result);
      /*
        ══ COMMITTING DISMISSES THE FIELD — MAP-SEARCH-DROPDOWN-DISMISSAL ════

        `setOpen(false)` alone was not dismissal, and the reopen path is plain
        in this component: `showList` is `open && query.trim().length > 0`, and
        `onFocus` sets `open` back to true. A committed query therefore left
        the list one focus event away from returning — over the map the commit
        had just moved, and over the rail identity it had just established.

        Committing a row ANSWERS the question the field was asking. The place
        the reader chose is now named in the rail and in the breadcrumbs, so
        the query has nothing left to say and the field is ready for the next
        one. Escape still closes WITHOUT clearing, because that means the
        opposite — see `onDismiss`.
      */
      setQuery('');
      setOpen(false);
    },
    onDismiss: () => setOpen(false),
  });

  const { activeIndex, setActiveIndex, optionId, onKeyDown } = keyboard;

  return (
    <div
      data-gn="map-place-search"
      data-gn-hud=""
      /* The prototype's own sizing: `flex:0 1 290px; min-width:158px`. */
      className={`relative w-[290px] min-w-[158px] shrink ${className}`}
    >
      <label className="sr-only" htmlFor={`${listId}-input`}>
        {labels.label}
      </label>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute left-[9px] top-[7px] font-gn-mono text-[11px] text-sp-ink-3"
      >
        &#9906;
      </span>
      <input
        id={`${listId}-input`}
        type="search"
        role="combobox"
        autoComplete="off"
        aria-expanded={showList}
        aria-controls={listId}
        aria-describedby={`${listId}-coverage`}
        aria-autocomplete="list"
        /* PO-2 — what Enter would take, announced rather than only painted. */
        aria-activedescendant={keyboard.activeDescendantId}
        value={query}
        placeholder={labels.placeholder}
        onKeyDown={onKeyDown}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
          /* A new query is a new list; nothing in it is highlighted yet. */
          setActiveIndex(-1);
        }}
        onFocus={() => setOpen(true)}
        /*
          ── M4-A — WHY THIS IS NO LONGER A RACE AGAINST THE USER'S HAND ──────

          This used to be the ONLY thing keeping a result alive long enough to
          be clicked: blur fires at mousedown, so the list was scheduled to
          unmount 120ms later and the mouseup had to beat that timer.

          A synthetic click beats it. A person does not. Measured on the
          integrated build with a real press: move to the row, press, hold
          250ms, release — after the hold the option was ALREADY UNMOUNTED
          (`survived: false`), nothing was under the cursor at mouse-up, no
          click was ever delivered, and the camera did not move. Type "r",
          press Romania, hold like a human: nothing happens.

          The list now cancels the press's blur outright (see the listbox's own
          `onMouseDown` below), so this timer no longer stands between a person
          and a result. It is kept for the case it was always meant for —
          clicking or tabbing AWAY from the field — where 120ms is simply the
          grace period before the list tidies itself up.
        */
        onBlur={() => window.setTimeout(() => setOpen(false), 120)}
        /*
          DESIGN v1.6 — SEARCH IS A PRIMARY NAVIGATION CONTROL, NOT CHROME.

          The revision's finding: a working control rendered on the passive text
          ramp reads as decoration. The field is lifted OFF the bar rather than
          recessed into it — a #101E28 fill against the #0C151C bar, a .45
          border strengthening to .62 on hover, a cyan focus border with a 2 px
          ring — so it reads as an affordance before it is touched.

          Tokens are v1.6's own, transposed to this field's 11.5 px scale.
        */
        className="w-full rounded-[2px] border border-[rgba(126,166,186,.45)] bg-[#101E28] py-[7px] pl-[26px] pr-[10px] font-gn-mono text-[11.5px] tracking-[0.04em] text-[#E9F3F8] outline-none transition-[background-color,border-color] duration-[140ms] placeholder:text-[#7C93A2] hover:border-[rgba(126,166,186,.62)] hover:bg-[#13232E] focus:border-[rgba(58,214,230,.7)] focus:bg-[#13242F] focus:shadow-[0_0_0_2px_rgba(58,214,230,.16)]"
      />


      {showList && (
        <ul
          id={listId}
          role="listbox"
          aria-label={labels.resultsLabel}
          data-gn="place-search-results"
          /*
            M4-A — THE FIX, AND WHY IT IS HERE RATHER THAN ON EACH ROW.

            Preventing the default of `mousedown` inside the list stops the
            browser moving focus, so the input never blurs, the 120ms unmount
            timer never starts, and the `click` this press is going to produce
            lands on a row that is still mounted — however long the person holds
            the button down.

            It is on the LISTBOX so it covers the rows, the coverage note, the
            padding between them and the scrollbar gutter: a press that begins
            anywhere in the dropdown must not destroy the dropdown. It also
            leaves focus in the field, which is what the `combobox` role says
            should happen.

            COMMIT STILL HAPPENS ON `click`, through the same `commit()` the
            keyboard uses. Committing on `mousedown` instead would fire before
            the person had finished pressing and would remove their ability to
            change their mind by sliding off the row — a different behaviour,
            not a fix.
          */
          onMouseDown={(event) => event.preventDefault()}
          className="absolute left-0 right-0 top-[34px] z-[60] max-h-[280px] overflow-auto border border-sp-line-2 bg-sp-panel-2"
        >
          {/*
            THE COVERAGE NOTE, IN THE RESULTS RATHER THAN UNDER THE FIELD.

            It still always appears the moment a user searches — it is the
            difference between "not indexed yet" and "nothing there", and it is
            wired to the input by `aria-describedby` so it is announced either
            way. It moved because the top bar is 44 px: rendered beneath the
            field it spilled out of the HUD row and overlapped the map.
          */}
          <li
            id={`${listId}-coverage`}
            data-gn="place-search-coverage"
            className="border-b border-sp-line-3 px-[10px] py-[5px] font-gn-mono text-[8.5px] uppercase tracking-[0.14em] text-sp-ink-3/80"
          >
            {labels.coverageNote}
          </li>

          {deepening && (
            <li
              data-gn="place-search-deepening"
              className="border-b border-sp-line-3 px-[10px] py-[5px] font-gn-mono text-[9px] uppercase tracking-[0.1em] text-sp-ink-3"
            >
              {labels.searching}
            </li>
          )}

          {sayNoResults && (
            <li
              data-gn="place-search-empty"
              className="px-[10px] py-[7px] font-gn-mono text-[10px] uppercase tracking-[0.1em] text-sp-ink-3"
            >
              {labels.noResults}
            </li>
          )}

          {results.map((result, index) => (
            <li
              key={result.id}
              id={optionId(index)}
              role="option"
              aria-selected={index === activeIndex}
            >
              <button
                type="button"
                data-gn="place-search-result"
                data-gn-kind={result.kind}
                data-gn-annotation={result.annotation.kind}
                data-gn-highlighted={index === activeIndex ? 'true' : undefined}
                /* Pointer and keyboard highlight the same row the same way. */
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => keyboard.commit(result)}
                className={`flex w-full items-center justify-between gap-[8px] border-b border-sp-line-3 px-[10px] py-[7px] text-left text-[11.5px] text-sp-ink last:border-b-0 hover:bg-sp-cyan/[0.08] ${
                  index === activeIndex ? 'bg-sp-cyan/[0.08]' : ''
                }`}
              >
                <span className="min-w-0 truncate">
                  {result.label}
                  <span className="ml-[6px] font-gn-mono text-[8.5px] uppercase tracking-[0.12em] text-sp-ink-3">
                    {labels.kinds[result.kind] ?? result.kind}
                  </span>
                  {/* See `PlaceResult.context` — the rungs are real, the ambiguity was not. */}
                  {result.context !== undefined && (
                    <span
                      data-gn="place-search-context"
                      className="ml-[6px] font-gn-mono text-[8.5px] tracking-[0.06em] text-sp-ink-3"
                    >
                      {result.context}
                    </span>
                  )}
                </span>

                {result.annotation.kind === 'EVIDENCE' ? (
                  <span
                    data-gn="place-search-count"
                    className="shrink-0 font-gn-mono text-[9.5px] tracking-[0.08em] text-sp-cyan"
                  >
                    {result.annotation.reportCount} {labels.reports}
                  </span>
                ) : result.annotation.kind === 'IN_COUNTRY' ? (
                  /*
                    THE COUNT IS ABOUT THE COUNTRY, SO IT SAYS THE COUNTRY.

                    A Kigali row inside a Rwanda holding 34 reports reads "34
                    reports in Rwanda". Rendering it as "34 reports" would
                    assert city-level evidence the platform does not hold —
                    navigation precision silently becoming evidence precision,
                    in a list the reader cannot check.

                    It is deliberately NOT cyan. Cyan is this surface's verified
                    -evidence-here value, and this is evidence somewhere else.
                  */
                  <span
                    data-gn="place-search-in-country"
                    className="shrink-0 font-gn-mono text-[8.5px] uppercase tracking-[0.1em] text-sp-ink-3"
                  >
                    {result.annotation.reportCount} {labels.reports} {labels.inCountry}{' '}
                    {result.annotation.countryLabel}
                  </span>
                ) : (
                  /*
                    REFERENCE, NOT "0". Part II §8 q7 requires the word; a zero
                    reads as a measurement rather than as the statement that
                    nothing is retained for this area.
                  */
                  <span
                    data-gn="place-search-reference"
                    className="shrink-0 font-gn-mono text-[8.5px] uppercase tracking-[0.12em] text-sp-muted"
                  >
                    {labels.reference}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
