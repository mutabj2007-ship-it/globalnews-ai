/*
  ── B4-A · PENDING-SUBJECT TESTS ──────────────────────────────────────────

  The tests marked `it.skip` below are NOT failing assertions about the
  recovered Economy substrate. Each one reads a file that B4-A is forbidden by
  ruling to recover — the public route, the domain-local IndicatorStrip, or the
  deferred ScriptRun/multilingual block.

  They are skipped WITH A STATED REASON rather than deleted, so the work each one
  is waiting for stays visible and re-enabling it is a one-word edit. A recovered
  spec that silently disappears is how a contract stops being enforced.
*/
import { readFileSync } from 'fs';
import { join } from 'path';
import { DISPLAY_LOCALES, type DisplayLocale } from '@globalnews-ai/shared';
import { SELECTABLE_LOCALES } from '@/lib/i18n/languages';
import {
  economyLocalesAwaitingContent,
  economyStrings,
  resolveEconomyStrings,
  type EconomyLocale,
} from './strings';

/**
 * LANG-CATALOG-IMPLEMENT-1 — ECONOMY READS THE CANONICAL DISPLAY LOCALE.
 *
 * ECON-A8-1 corrected `EconomyLocale` from `LanguageCode` to `DisplayLocale`.
 * That correction is easy to undo by accident — the two are both "language"
 * types of similar shape — and undoing it is invisible until a German or
 * Portuguese reader meets a screen that cannot represent their locale, or a
 * Swahili source-language value reaches a display surface that has no contract
 * for it. These tests pin the corrected binding in both directions.
 */

const ECONOMY_DIR = __dirname;

/** Comment-stripped: a forbidding guard must read code, never prose about it. */
function code(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
}

describe('Economy binds the display set, not the source-intelligence set', () => {
  it('accepts every contracted display locale, including the two LanguageCode omits', () => {
    // `de` and `pt` are contracted DISPLAY locales with no source-intelligence
    // counterpart. Under the old binding they were not expressible at all.
    for (const locale of DISPLAY_LOCALES) {
      const resolution = resolveEconomyStrings(locale);
      expect(resolution.requested).toBe(locale);
      expect(typeof economyStrings(locale).relation.ORIGIN_OF).toBe('string');
    }
    const accepts: EconomyLocale[] = ['de', 'pt'];
    for (const locale of accepts) expect(DISPLAY_LOCALES).toContain(locale);
  });

  it('does not admit the source-language values that are not display locales', () => {
    // `sw` and `rw` remain exactly where they belong — in `LanguageCode`, for
    // source intelligence and retrieval strategy. They are not display locales
    // and Economy is a display surface.
    for (const value of ['sw', 'rw']) {
      expect(DISPLAY_LOCALES).not.toContain(value as DisplayLocale);
    }
  });

  it('the alias is the shared display type, asserted on the source', () => {
    const src = code(readFileSync(join(ECONOMY_DIR, 'strings.ts'), 'utf8'));
    expect(src).toContain('export type EconomyLocale = DisplayLocale;');
    expect(src).not.toContain('export type EconomyLocale = LanguageCode;');
  });

  /* B4-A PENDING — reads app/economy/* — no route is registered in B4-A. */
  it.skip('the Economy route reads the platform locale decision rather than making its own', () => {
    // One language mechanism. Economy introduces no selector, cookie, storage
    // key or resolution order: it reads the cookie the platform writes and
    // narrows it through the platform's own selectable-registry predicate.
    const page = code(readFileSync(join(ECONOMY_DIR, '..', '..', 'app', 'economy', 'page.tsx'), 'utf8'));
    expect(page).toContain('LANGUAGE_COOKIE_NAME');
    expect(page).toContain('isActiveLanguageCode');
    expect(page).not.toMatch(/localStorage|navigator\.language/);
  });
});

describe('Economy reports its content gap rather than hiding it', () => {
  /**
   * A MEASURED, PRE-EXISTING GAP, RECORDED HERE SO IT CANNOT BE MISTAKEN FOR DONE.
   *
   * `ECONOMY_CATALOGUE` holds `en` alone. Its own header states the condition
   * for folding into the shared dictionaries — "when LANG-UI-7 promotes, this
   * catalogue folds into the shared dictionaries as one move" — and LANG-UI-7
   * promoted at C35. The trigger has come due.
   *
   * It cannot be discharged in this lane. The fold needs the 83 Economy strings
   * authored in six further languages, and the localisation lane's catalogues
   * were authored against `en.ts`, which carries five Economy MODULE labels and
   * none of the Economy SURFACE strings. Authoring them here would be inventing
   * translations, which this lane does not do.
   *
   * So the gap is asserted rather than closed: Polish is the live case, because
   * `pl` is selectable today and a Polish reader currently meets English
   * Economy strings on an otherwise Polish page. `resolveEconomyStrings` at
   * least says so instead of pretending otherwise.
   */
  it('the fold is discharged — every contracted locale is authored, so nothing awaits content', () => {
    // The figure this test used to pin was ['pl','fr','de','es','pt','ar'].
    // L-LANG-CATALOG-ECON-AR-CLOSURE-1 supplied all six, 83 fields each. The
    // REPORT is unchanged and still the point; there is simply nothing left for
    // it to report.
    expect(economyLocalesAwaitingContent([...DISPLAY_LOCALES])).toEqual([]);
  });

  it('no contracted locale falls back, and none falls back SILENTLY either', () => {
    for (const locale of DISPLAY_LOCALES) {
      const resolution = resolveEconomyStrings(locale);
      expect(resolution.requested).toBe(locale);
      expect(resolution.resolved).toBe(locale);
      expect(resolution.fellBack).toBe(false);
    }
    // The disclosure mechanism itself is untouched and still reachable: a value
    // outside the catalogue resolves to English and SAYS so.
    const off = resolveEconomyStrings('zz' as DisplayLocale);
    expect(off.resolved).toBe('en');
    expect(off.fellBack).toBe(true);
  });

  it('every SELECTABLE locale now has its own Economy content', () => {
    // The live consequence, inverted: a Polish reader used to meet English
    // Economy strings on an otherwise Polish page. None of the seven does now.
    const affected = SELECTABLE_LOCALES.filter((l) => resolveEconomyStrings(l).fellBack);
    expect(affected).toEqual([]);
  });

  it('L\'s two deliberate special cases survived transcription', () => {
    // Both look like mistakes and are not. A future "tidy-up" that trims the
    // French no-break space or unifies the two Arabic REVISED words fails here.
    const fr = economyStrings('fr').wasPriorState;
    expect(fr.charCodeAt(fr.length - 1)).toBe(0x00a0);
    const ar = economyStrings('ar');
    expect(ar.releaseStatus.REVISED).not.toBe(ar.watchTrigger.REVISED);
  });

  it('all 83 fields are present in all seven locales, with no empty value', () => {
    for (const locale of DISPLAY_LOCALES) {
      const flat: string[] = [];
      const walk = (o: Record<string, unknown>): void => {
        for (const v of Object.values(o)) {
          if (typeof v === 'string') flat.push(v);
          else if (v && typeof v === 'object') walk(v as Record<string, unknown>);
        }
      };
      walk(economyStrings(locale) as unknown as Record<string, unknown>);
      expect(flat).toHaveLength(83);
      // `wasPriorState` is intentionally whitespace-terminated, so length not trim.
      expect(flat.filter((s) => s.length === 0)).toEqual([]);
    }
  });

  it('Economy still has no second resolution pipeline of its own', () => {
    // The constraint that matters is not "no catalogue object" but "no second
    // MECHANISM": no lookup fallback chain of its own, no per-locale branching
    // in components, no string assembled from fragments.
    const src = code(readFileSync(join(ECONOMY_DIR, 'strings.ts'), 'utf8'));
    expect(src).not.toMatch(/locale\s*===\s*'(pl|fr|de|es|pt|ar)'/);
    // Exactly ONE place in Economy decides to fall back. Two would be two
    // rules that can drift apart, which is what makes a second pipeline.
    expect((src.match(/fellBack: true/g) ?? []).length).toBe(1);
    expect((src.match(/fellBack: false/g) ?? []).length).toBe(1);
  });
});
