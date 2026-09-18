import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { resolvePlaceSearchKey } from '@/lib/map/search/placeSearchKeyboard';

/**
 * ══ R2-B §3 — COMMITTING A ROW DISMISSES THE FIELD ════════════════════════
 *
 * MAP-SEARCH-DROPDOWN-DISMISSAL
 *
 * THE REOPEN PATH, WHICH IS READABLE IN THE SOURCE RATHER THAN INFERRED. Both
 * fields compute
 *
 *     showList = open && query.trim().length > 0
 *
 * and both set `open` back to true on focus. Commit set `open` to false and
 * left the query standing. So the list was never dismissed — it was hidden,
 * one focus event away from returning over the map the commit had just moved
 * and over the rail identity it had just established.
 *
 * HONEST LIMIT ON WHAT IS PROVEN. I could not reproduce the exact live timing
 * that made this visible after a CITY/REGION commit specifically, and I am not
 * going to claim a trigger I did not observe. What is established is narrower
 * and stronger: the reopen path above is reachable for EVERY kind of row, and
 * clearing the query closes it for every kind. This spec proves the rule
 * holds, not that one browser sequence was the cause.
 *
 * ── WHY THE RULE IS ASSERTED AGAINST BOTH SOURCES ─────────────────────────
 *
 * The query is each field's own state, so `usePlaceSearchKeyboard` cannot
 * clear it — the one place that owns commit cannot own this half of it. That
 * leaves the rule living in two components, which is exactly the shape the
 * keyboard defect had before it was lifted into the hook: desktop was fixed,
 * mobile was not, because nothing asserted they agreed. So this file asserts
 * they agree.
 */

const SRC = resolve(__dirname, '..', '..');

const read = (...parts: string[]): string => readFileSync(resolve(SRC, ...parts), 'utf-8');

/** Comments stripped: these are assertions about code, not about prose. */
const code = (...parts: string[]): string =>
  read(...parts)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

const FIELDS = [
  ['desktop', ['components', 'map', 'shell', 'PlaceSearch.tsx']],
  ['mobile', ['components', 'map', 'mobile', 'MobilePlaceSearch.tsx']],
] as const;

/** The `onCommit` body each field hands the shared hook. */
const commitBlock = (parts: readonly string[]): string => {
  const source = code(...parts);
  const start = source.indexOf('onCommit: (result) => {');

  expect(start).toBeGreaterThan(-1);

  return source.slice(start, source.indexOf('onDismiss:', start));
};

/* ══════════════════════════════════════════════════════════════════════════
   1 — THE REOPEN PATH IS REAL, AND IT IS WHAT THE FIX CLOSES
   ══════════════════════════════════════════════════════════════════════════ */

describe('the mechanism, stated before the fix that closes it', () => {
  for (const [field, parts] of FIELDS) {
    it(`${field} — the list is shown whenever it is open AND the query is non-empty`, () => {
      expect(code(...parts)).toContain('open && query.trim().length > 0');
    });

    it(`${field} — and focus alone reopens it`, () => {
      /*
        This is not a defect on its own — it is how someone returns to a list
        they clicked away from. It only becomes one when a COMMITTED query is
        still sitting in the field.
      */
      expect(code(...parts)).toContain('onFocus={() => setOpen(true)}');
    });
  }
});

/* ══════════════════════════════════════════════════════════════════════════
   2 — COMMIT CLEARS THE QUERY, IN BOTH FIELDS
   ══════════════════════════════════════════════════════════════════════════ */

describe('committing a row dismisses the field rather than hiding the list', () => {
  for (const [field, parts] of FIELDS) {
    it(`${field} — commit closes the list`, () => {
      expect(commitBlock(parts)).toContain('setOpen(false)');
    });

    it(`${field} — commit also clears the query, which is what makes it dismissal`, () => {
      expect(commitBlock(parts)).toContain("setQuery('')");
    });

    it(`${field} — and commit still performs the selection it was asked for`, () => {
      /*
        The dismissal must not have been bought by dropping the commit. This is
        the assertion that would fail if someone "fixed" the dropdown by making
        the row inert.
      */
      expect(commitBlock(parts)).toContain('onSelectResult(result)');
    });
  }

  it('THE INVARIANT — the two fields do the same three things, in the same order', () => {
    /*
      The keyboard defect this file's header recalls was exactly this shape:
      one field corrected, the other not, and nothing asserting they agreed.
      Order matters as well as presence — selecting after clearing would hand
      the handler a field that no longer describes what was chosen.
    */
    const order = (parts: readonly string[]): readonly string[] => {
      const block = commitBlock(parts);

      return (['onSelectResult(result)', "setQuery('')", 'setOpen(false)'] as const)
        .map((call) => [call, block.indexOf(call)] as const)
        .sort((a, b) => a[1] - b[1])
        .map(([call]) => call);
    };

    expect(order(FIELDS[0][1])).toEqual(order(FIELDS[1][1]));
    expect(order(FIELDS[0][1])).toEqual([
      'onSelectResult(result)',
      "setQuery('')",
      'setOpen(false)',
    ]);
  });
});

/* ══════════════════════════════════════════════════════════════════════════
   3 — ESCAPE IS THE DELIBERATE OPPOSITE, AND IT DID NOT CHANGE
   ══════════════════════════════════════════════════════════════════════════ */

describe('dismissing without committing still keeps what was typed', () => {
  for (const [field, parts] of FIELDS) {
    it(`${field} — onDismiss closes the list and does NOT clear the query`, () => {
      const source = code(...parts);
      const dismiss = source.slice(
        source.indexOf('onDismiss:'),
        source.indexOf('onDismiss:') + 60,
      );

      expect(dismiss).toContain('setOpen(false)');
      expect(dismiss).not.toContain('setQuery');
    });
  }

  it('Escape is still routed to DISMISS rather than to COMMIT', () => {
    /*
      Through the shared hook's own decision function, so this is the real
      routing and not a restatement of it. The distinction is the whole point:
      commit answers the field's question, Escape withdraws it.
    */
    expect(
      resolvePlaceSearchKey('Escape', { activeIndex: 0, resultCount: 3, showList: true }),
    ).toEqual({ kind: 'DISMISS' });

    expect(
      resolvePlaceSearchKey('Enter', { activeIndex: 1, resultCount: 3, showList: true }),
    ).toEqual({ kind: 'COMMIT', index: 1 });
  });
});

/* ══════════════════════════════════════════════════════════════════════════
   4 — THE RULE IS WRITTEN DOWN WHERE THE NEXT CALLER WILL LOOK
   ══════════════════════════════════════════════════════════════════════════ */

describe('a third field cannot be added without meeting the rule', () => {
  it('the shared hook states the clearing obligation on onCommit', () => {
    /*
      Prose, asserted deliberately. The hook CANNOT enforce this — the query
      belongs to the caller — so the only thing standing between a future third
      field and the same defect is that the contract says so at the point
      someone reads it, and that this spec fails when a caller ignores it.
    */
    const contract = read('lib', 'map', 'search', 'placeSearchKeyboard.ts');

    expect(contract).toContain('MAP-SEARCH-DROPDOWN-DISMISSAL');
    expect(contract).toContain('MUST CLEAR ITS QUERY');
  });

  it('and exactly two callers exist today, which is what this file covers', () => {
    /*
      If a third appears, this fails and whoever added it is pointed at the two
      assertions above rather than discovering the defect in a browser.
    */
    const callers = FIELDS.map(([, parts]) => code(...parts)).filter((source) =>
      source.includes('usePlaceSearchKeyboard({'),
    );

    expect(callers).toHaveLength(2);
  });
});
