'use client';

import { useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import type { PlaceResult } from './placeSearch';

/**
 * THE PLACE-SEARCH COMBOBOX KEYBOARD CONTRACT — ONE IMPLEMENTATION, TWO FIELDS.
 *
 * ── WHY THIS MODULE EXISTS ────────────────────────────────────────────────
 *
 * The desktop field (`shell/PlaceSearch`) already carried this logic, and its
 * own note records why it had to be written: the field declared
 * `role="combobox"` with `aria-expanded` and `aria-controls` and then handled
 * no keys at all, so typing a country and pressing Enter did nothing. Only a
 * mouse worked.
 *
 * THE MOBILE FIELD SHIPPED WITH EXACTLY THE SAME DEFECT, and H measured it at
 * 390x844: pointer selection reached `/map?country=FRA`, `Enter` did nothing,
 * `ArrowDown` + `Enter` did nothing, and `aria-activedescendant` was null. The
 * desktop composition was unaffected — which is the signature of a behaviour
 * that lives in a component instead of in one shared place.
 *
 * So the logic is LIFTED here verbatim from the accepted desktop field rather
 * than re-derived, and both fields now call it. That is deliberate: a second
 * implementation of "what does Enter do" is how the two surfaces diverged in
 * the first place, and fixing mobile by writing a parallel handler would
 * rebuild the same trap one release later.
 *
 * ── WHAT IT DELIBERATELY DOES NOT OWN ─────────────────────────────────────
 *
 * Nothing about presentation, sizing, touch targets or which rows exist. The
 * two fields render differently on purpose — a 290 px HUD control and a
 * full-width phone field with 44 px rows — and this hook never sees any of
 * that. It owns the highlight index and the key semantics, and nothing else.
 */
/**
 * THE KEY TABLE AS A PURE FUNCTION, SO IT CAN BE TESTED WITHOUT A BROWSER.
 *
 * This repository's frontend Jest runs in the `node` environment and carries no
 * DOM testing library, so a combobox that is only correct "when rendered" is a
 * combobox nobody can prove. The decision — WHICH key does WHAT, given the
 * current highlight and how many rows exist — is separated here so the exact
 * cases H measured as failing (`Enter` alone, `ArrowDown` then `Enter`) are
 * asserted directly rather than inferred from markup.
 *
 * The hook below is the only caller. There is no second copy of this table.
 */
export type PlaceSearchKeyIntent =
  | { readonly kind: 'IGNORE' }
  /** Swallow the key so an enclosing form cannot submit, but do nothing else. */
  | { readonly kind: 'SUPPRESS' }
  | { readonly kind: 'DISMISS' }
  | { readonly kind: 'MOVE'; readonly nextIndex: number }
  | { readonly kind: 'COMMIT'; readonly index: number };

export interface PlaceSearchKeyState {
  readonly activeIndex: number;
  readonly resultCount: number;
  readonly showList: boolean;
}

export function resolvePlaceSearchKey(
  key: string,
  { activeIndex, resultCount, showList }: PlaceSearchKeyState,
): PlaceSearchKeyIntent {
  /* Escape dismisses whether or not there is anything to choose from. */
  if (key === 'Escape') return { kind: 'DISMISS' };

  if (!showList || resultCount === 0) {
    return key === 'Enter' ? { kind: 'SUPPRESS' } : { kind: 'IGNORE' };
  }

  if (key === 'ArrowDown') return { kind: 'MOVE', nextIndex: (activeIndex + 1) % resultCount };
  if (key === 'ArrowUp') {
    return { kind: 'MOVE', nextIndex: activeIndex <= 0 ? resultCount - 1 : activeIndex - 1 };
  }
  if (key === 'Home') return { kind: 'MOVE', nextIndex: 0 };
  if (key === 'End') return { kind: 'MOVE', nextIndex: resultCount - 1 };

  /*
    NO HIGHLIGHT YET MEANS THE FIRST ROW. Typing a country and pressing Enter is
    the single most common thing a person does with a search field, and
    requiring an ArrowDown first would leave that gesture as dead as it was.
  */
  if (key === 'Enter') return { kind: 'COMMIT', index: activeIndex >= 0 ? activeIndex : 0 };

  return { kind: 'IGNORE' };
}

export interface PlaceSearchKeyboardOptions {
  /** The ordered rows the arrow keys walk. `activeIndex` indexes THIS array. */
  readonly results: readonly PlaceResult[];
  /** Whether the listbox is currently showing; keys are inert when it is not. */
  readonly showList: boolean;
  /** The listbox's own id — option ids are derived from it, so they match. */
  readonly listId: string;
  /**
   * Commit a row. The SAME callback the row's own button calls.
   *
   * ── MAP-SEARCH-DROPDOWN-DISMISSAL ────────────────────────────────────────
   *
   * A COMMITTING CALLER MUST CLEAR ITS QUERY AS WELL AS CLOSING ITS LIST, and
   * this hook cannot do it for them because the query is their state, not
   * this hook's.
   *
   * Closing alone is not dismissal. Both fields compute `showList` as
   * `open && query.trim().length > 0` and both reopen on focus, so a committed
   * query that survives leaves the list one focus event away from covering the
   * map the commit just moved. `placeSearchDismissal.spec.ts` asserts every
   * caller does both, because there are two fields and a rule kept in two
   * places is a rule that drifts.
   */
  readonly onCommit: (result: PlaceResult) => void;
  /**
   * Close the list WITHOUT erasing the query — the deliberate opposite of
   * commit. Escape means "I did not mean to open this", and erasing what
   * someone typed is the behaviour `onKeyDown` already calls `preventDefault`
   * to stop the browser doing.
   */
  readonly onDismiss: () => void;
}

export interface PlaceSearchKeyboard {
  /** -1 is "none highlighted yet" — the state the field is in when rows appear. */
  readonly activeIndex: number;
  readonly setActiveIndex: (index: number) => void;
  readonly resetActiveIndex: () => void;
  readonly optionId: (index: number) => string;
  /** What Enter would take, announced rather than only painted. */
  readonly activeDescendantId: string | undefined;
  readonly onKeyDown: (event: ReactKeyboardEvent<HTMLInputElement>) => void;
  readonly commit: (result: PlaceResult | undefined) => void;
}

export function usePlaceSearchKeyboard({
  results,
  showList,
  listId,
  onCommit,
  onDismiss,
}: PlaceSearchKeyboardOptions): PlaceSearchKeyboard {
  /*
    -1 is "none highlighted yet", which is the state the field is in the moment
    results appear. It is an index into `results`, so the caller resets it
    whenever the query changes and the list underneath it is a different list.
  */
  const [activeIndex, setActiveIndex] = useState(-1);

  const optionId = (index: number): string => `${listId}-option-${index}`;

  const commit = (result: PlaceResult | undefined): void => {
    if (result === undefined) return;

    onCommit(result);
    setActiveIndex(-1);
  };

  const onKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>): void => {
    const intent = resolvePlaceSearchKey(event.key, {
      activeIndex,
      resultCount: results.length,
      showList,
    });

    if (intent.kind === 'IGNORE') return;

    /*
      Every non-ignored intent cancels the default. On `<input type="search">`
      Chromium and WebKit both implement Escape as "clear the field", so
      dismissing a dropdown would erase what someone just typed; and Enter with
      nothing to choose from must not submit an enclosing form and reload the
      route.
    */
    event.preventDefault();

    if (intent.kind === 'SUPPRESS') return;

    if (intent.kind === 'DISMISS') {
      onDismiss();
      setActiveIndex(-1);
      return;
    }

    if (intent.kind === 'MOVE') {
      setActiveIndex(intent.nextIndex);
      return;
    }

    commit(results[intent.index]);
  };

  return {
    activeIndex,
    setActiveIndex,
    resetActiveIndex: () => setActiveIndex(-1),
    optionId,
    activeDescendantId:
      showList && activeIndex >= 0 && activeIndex < results.length
        ? optionId(activeIndex)
        : undefined,
    onKeyDown,
    commit,
  };
}
