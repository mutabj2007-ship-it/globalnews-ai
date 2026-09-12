/**
 * R6 — THE MOBILE SPATIAL SEARCH KEYBOARD PATH.
 *
 * H measured this at 390x844 on the R5 build:
 *
 *     pointer                    PASS   France selected, /map?country=FRA, sheet populated
 *     Enter                      FAIL
 *     ArrowDown + Enter          FAIL
 *     aria-activedescendant      null
 *     desktop Spatial            keyboard commit works normally
 *
 * Two halves are asserted, because the defect had two halves:
 *
 *   1. THE DECISION — which key does what. Asserted against the pure table the
 *      hook routes through, so H's exact failing gestures are tested directly
 *      rather than inferred from markup. This frontend's Jest runs in the
 *      `node` environment with no DOM testing library, so a combobox that is
 *      only correct "once rendered" is one nobody can prove.
 *
 *   2. THE WIRING — that the mobile field actually calls it, announces the
 *      active option, and gives its rows real option identity. A correct table
 *      nothing calls is exactly what R5 shipped.
 *
 * AND ONE MORE: that there is only ONE implementation. The two fields diverged
 * because the logic lived inside the desktop component; a test that let a
 * second handler appear would permit the same drift again.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { resolvePlaceSearchKey } from '@/lib/map/search/placeSearchKeyboard';

const FRONTEND_ROOT = join(__dirname, '..', '..', '..', '..');

function codeOf(relativePath: string): string {
  return readFileSync(join(FRONTEND_ROOT, relativePath), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\/\/[^\n]*/g, ' ');
}

const OPEN_WITH = (resultCount: number, activeIndex = -1) => ({
  activeIndex,
  resultCount,
  showList: true,
});

describe('THE MEASURED FAILURES — both now commit', () => {
  it('ENTER ALONE COMMITS THE FIRST ROW (H: Enter = FAIL)', () => {
    expect(resolvePlaceSearchKey('Enter', OPEN_WITH(3))).toEqual({ kind: 'COMMIT', index: 0 });
  });

  it('ARROWDOWN THEN ENTER COMMITS THE HIGHLIGHTED ROW (H: ArrowDown + Enter = FAIL)', () => {
    const moved = resolvePlaceSearchKey('ArrowDown', OPEN_WITH(3));
    expect(moved).toEqual({ kind: 'MOVE', nextIndex: 0 });

    const movedAgain = resolvePlaceSearchKey('ArrowDown', OPEN_WITH(3, 0));
    expect(movedAgain).toEqual({ kind: 'MOVE', nextIndex: 1 });

    expect(resolvePlaceSearchKey('Enter', OPEN_WITH(3, 1))).toEqual({ kind: 'COMMIT', index: 1 });
  });

  it('the one-result case — the France shape H drove — commits that result', () => {
    expect(resolvePlaceSearchKey('Enter', OPEN_WITH(1))).toEqual({ kind: 'COMMIT', index: 0 });
    expect(resolvePlaceSearchKey('ArrowDown', OPEN_WITH(1))).toEqual({ kind: 'MOVE', nextIndex: 0 });
    expect(resolvePlaceSearchKey('Enter', OPEN_WITH(1, 0))).toEqual({ kind: 'COMMIT', index: 0 });
  });
});

describe('THE REST OF THE CONTRACT', () => {
  it('ArrowUp from nothing wraps to the last row', () => {
    expect(resolvePlaceSearchKey('ArrowUp', OPEN_WITH(3))).toEqual({ kind: 'MOVE', nextIndex: 2 });
    expect(resolvePlaceSearchKey('ArrowUp', OPEN_WITH(3, 0))).toEqual({ kind: 'MOVE', nextIndex: 2 });
  });

  it('ArrowDown wraps at the end', () => {
    expect(resolvePlaceSearchKey('ArrowDown', OPEN_WITH(3, 2))).toEqual({ kind: 'MOVE', nextIndex: 0 });
  });

  it('Home and End jump to the ends', () => {
    expect(resolvePlaceSearchKey('Home', OPEN_WITH(4, 2))).toEqual({ kind: 'MOVE', nextIndex: 0 });
    expect(resolvePlaceSearchKey('End', OPEN_WITH(4, 0))).toEqual({ kind: 'MOVE', nextIndex: 3 });
  });

  it('Escape DISMISSES and never erases — it is cancelled even with no results', () => {
    expect(resolvePlaceSearchKey('Escape', OPEN_WITH(3, 1))).toEqual({ kind: 'DISMISS' });
    expect(resolvePlaceSearchKey('Escape', { activeIndex: -1, resultCount: 0, showList: false }))
      .toEqual({ kind: 'DISMISS' });
  });

  it('Enter with nothing to choose from is SUPPRESSED, not ignored — no stray form submit', () => {
    expect(resolvePlaceSearchKey('Enter', { activeIndex: -1, resultCount: 0, showList: true }))
      .toEqual({ kind: 'SUPPRESS' });
    expect(resolvePlaceSearchKey('Enter', { activeIndex: -1, resultCount: 3, showList: false }))
      .toEqual({ kind: 'SUPPRESS' });
  });

  it('ordinary typing is untouched', () => {
    for (const key of ['a', 'F', '1', ' ', 'Backspace', 'Tab']) {
      expect(resolvePlaceSearchKey(key, OPEN_WITH(3, 1))).toEqual({ kind: 'IGNORE' });
    }
  });

  it('arrow keys are inert while the list is closed, so they do not steal the caret', () => {
    const closed = { activeIndex: -1, resultCount: 3, showList: false };
    expect(resolvePlaceSearchKey('ArrowDown', closed)).toEqual({ kind: 'IGNORE' });
    expect(resolvePlaceSearchKey('ArrowUp', closed)).toEqual({ kind: 'IGNORE' });
  });
});

describe('THE MOBILE FIELD IS WIRED TO IT — a correct table nothing calls is R5', () => {
  const mobile = codeOf('src/components/map/mobile/MobilePlaceSearch.tsx');

  it('the field handles keys at all', () => {
    expect(mobile).toContain('onKeyDown={keyboard.onKeyDown}');
  });

  it('the active option is REPRESENTED ACCESSIBLY (H measured null)', () => {
    expect(mobile).toContain('aria-activedescendant={keyboard.activeDescendantId}');
  });

  it('rows carry real option identity, not a hardcoded aria-selected={false}', () => {
    expect(mobile).toContain('id={keyboard.optionId(index)}');
    expect(mobile).toContain('aria-selected={index === keyboard.activeIndex}');
    expect(mobile).not.toContain('aria-selected={false}');
  });

  it('the highlight is visible, not only announced', () => {
    expect(mobile).toContain('data-gn-highlighted');
  });

  it('a new query resets the highlight — Enter cannot commit a row from the old list', () => {
    expect(mobile).toContain('keyboard.resetActiveIndex()');
  });

  it('POINTER BEHAVIOUR IS UNCHANGED — the row still commits on click', () => {
    expect(mobile).toContain('onClick={() => keyboard.commit(result)}');
  });

  it('the M4-A press/blur repair is untouched', () => {
    expect(mobile).toContain('onMouseDown={(event) => event.preventDefault()}');
  });

  it('the field is still keyboard-reachable with a valid accessible name', () => {
    expect(mobile).toContain('role="combobox"');
    expect(mobile).toContain('htmlFor={`${listId}-input`}');
    expect(mobile).toContain('{labels.label}');
    expect(mobile).not.toContain('tabIndex={-1}');
  });
});

describe('ONE IMPLEMENTATION — the reason the two fields diverged', () => {
  const mobile = codeOf('src/components/map/mobile/MobilePlaceSearch.tsx');
  const desktop = codeOf('src/components/map/shell/PlaceSearch.tsx');

  it('BOTH fields consume the same primitive', () => {
    for (const source of [mobile, desktop]) {
      expect(source).toContain('usePlaceSearchKeyboard');
      expect(source).toContain("from '@/lib/map/search/placeSearchKeyboard'");
    }
  });

  it('NEITHER field carries its own key table any more', () => {
    for (const source of [mobile, desktop]) {
      expect(source).not.toMatch(/if \(event\.key === 'ArrowDown'\)/);
      expect(source).not.toMatch(/if \(event\.key === 'Enter'\)/);
    }
  });

  it('the desktop field keeps the behaviour it already had', () => {
    expect(desktop).toContain('aria-activedescendant={keyboard.activeDescendantId}');
    expect(desktop).toContain('role="combobox"');
  });
});
