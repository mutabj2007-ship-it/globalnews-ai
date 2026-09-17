import { readFileSync } from 'fs';
import { join } from 'path';
import {
  DISPLAY_LOCALES,
  isDisplayLocale,
  directionFor,
  formattingProfileFor,
  DISPLAY_LOCALE_META,
} from '@globalnews-ai/shared';

import { ACTIVE_LANGUAGES, SELECTABLE_LOCALES } from './languages';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * B5-C — MULTILINGUAL INFRASTRUCTURE, DORMANT ONLY
 * ════════════════════════════════════════════════════════════════════════════
 *
 * L-MULTILINGUAL-RQ1-RECONCILIATION, visibility assertions V1–V5, plus the
 * three-set model the ruling requires be kept apart.
 *
 * ── DORMANT IS NOT A NEW MODE ────────────────────────────────────────────
 *
 * It is `SELECTABLE_LOCALES` doing the job it was designed for. A dictionary or
 * a contract EXISTING is not a deployment claim; only the selectable registry
 * is. That separation is the whole reason infrastructure can be recovered
 * without a single language becoming visible.
 *
 * ── AND IT IS A WITHDRAWAL, NAMED AS ONE ─────────────────────────────────
 *
 * Canonical's `SELECTABLE_LOCALES` is SEVEN. Adopting the contract at TWO is a
 * withdrawal relative to canonical, not a neutral dormancy. That is the
 * standing ruling — recovery must preserve the visible EN/PL runtime — and it
 * is recorded here rather than left to look like an accident.
 */

const HERE = readFileSync(join(__dirname, 'languages.ts'), 'utf-8');
const CODE = HERE.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

describe('B5-C · V1 — the deployment fact is exactly EN + PL', () => {
  it('SELECTABLE_LOCALES deep-equals [en, pl]', () => {
    /* An exact pin, not a length check and not a subset check. */
    expect([...SELECTABLE_LOCALES]).toEqual(['en', 'pl']);
  });

  it('ACTIVE_LANGUAGES was not widened either', () => {
    expect([...ACTIVE_LANGUAGES]).toEqual(['en', 'pl']);
  });

  it('and the registry is DERIVED, so the two cannot drift', () => {
    /*
      Re-authoring ['en','pl'] here would create two registries that agree only
      by discipline, and the next language would be added to one of them.
    */
    expect(CODE).toContain('ACTIVE_LANGUAGES.filter(');
    expect(CODE).not.toMatch(/SELECTABLE_LOCALES[^=]*=\s*\[/);
  });
});

describe('B5-C · V2 — the deployment fact can never widen beyond the contract', () => {
  it('SELECTABLE_LOCALES is a subset of DISPLAY_LOCALES', () => {
    for (const locale of SELECTABLE_LOCALES) {
      expect(DISPLAY_LOCALES).toContain(locale);
    }
  });

  it('asserted by test, not by convention', () => {
    expect(SELECTABLE_LOCALES.length).toBeLessThanOrEqual(DISPLAY_LOCALES.length);
  });
});

describe('B5-C · V3 / H2 — sw, rw, uk and ru are NOT display locales', () => {
  it('none of them is admitted by the contract guard', () => {
    /*
      The ruling is explicit: they are not to be forced into the display-locale
      type merely for symmetry. sw and rw are representable LanguageCodes — the
      backend has defined retrieval behaviour for them — and that is a different
      fact from being a locale this product can RENDER.
    */
    for (const value of ['sw', 'rw', 'uk', 'ru']) {
      expect(isDisplayLocale(value)).toBe(false);
      expect(DISPLAY_LOCALES).not.toContain(value);
    }
  });

  it('H2 IS CLOSED — the registry is type-guarded, not cast', () => {
    /*
      B4-A wrote `ACTIVE_LANGUAGES as readonly DisplayLocale[]`: sound by value,
      unsound by type. ACTIVE_LANGUAGES is LanguageCode[], which INCLUDES sw and
      rw, so the cast asserted a membership the compiler never checked — and the
      day somebody added sw to ACTIVE_LANGUAGES it would have become a
      DisplayLocale silently, with no error anywhere.

      This is the assertion that would have caught it, and the filter is what
      makes it impossible rather than merely unlikely.
    */
    expect(CODE).not.toMatch(/as readonly DisplayLocale\[\]/);
    expect(CODE).toContain('isDisplayLocale(code)');
  });

  it('and a non-display LanguageCode would be DROPPED, not admitted', () => {
    /*
      Executed, not read: the guard's actual behaviour on the exact values the
      ruling names. If the filter were ever replaced by a cast again, this stays
      green — which is why the source assertion above exists beside it.
    */
    const hypothetical = ['en', 'sw', 'pl', 'rw'];

    expect(hypothetical.filter(isDisplayLocale)).toEqual(['en', 'pl']);
  });
});

describe('B5-C · the three concepts stay separate', () => {
  it('LanguageCode (representable) is not DisplayLocale (contracted)', () => {
    /*
      THE SETS OVERLAP WITHOUT EITHER CONTAINING THE OTHER, which is precisely
      why one type cannot serve both jobs:

        only LanguageCode : sw, rw   — representable, never renderable today
        only DisplayLocale: de, pt   — contracted, not representable as a
                                       retrieval language
    */
    expect(isDisplayLocale('sw')).toBe(false);
    expect(isDisplayLocale('rw')).toBe(false);
    expect(DISPLAY_LOCALES).toContain('de');
    expect(DISPLAY_LOCALES).toContain('pt');
  });

  it('and neither is the deployment fact', () => {
    expect(SELECTABLE_LOCALES.length).toBe(2);
    expect(DISPLAY_LOCALES.length).toBe(7);
  });

  it('SOURCE LANGUAGE READINESS IS NOT CLAIMED', () => {
    /*
      The ruling is explicit, and the reason is that "arrives in language X" and
      "can be displayed in language X" are different capabilities with different
      evidence. Two of the seven display locales have no retrieval representation
      at all, which is the clearest possible demonstration that display
      readiness cannot stand in for source readiness.

      This checkpoint recovered DISPLAY infrastructure. It measured nothing
      about source-language handling and claims nothing about it.
    */
    for (const locale of ['de', 'pt']) {
      expect(DISPLAY_LOCALES).toContain(locale);
      expect(ACTIVE_LANGUAGES).not.toContain(locale);
    }
  });
});

describe('B5-C · the infrastructure recovered is real, and dormant', () => {
  it('RTL run-boundary infrastructure is present for all seven', () => {
    /*
      Recovered as INFRASTRUCTURE, activating nothing: `ar` has a direction and
      a formatting profile, and no path makes it selectable.
    */
    expect(directionFor('ar')).toBe('rtl');

    for (const locale of ['en', 'pl', 'fr', 'de', 'es', 'pt'] as const) {
      expect(directionFor(locale)).toBe('ltr');
    }
  });

  it('every display locale carries metadata and a formatting profile', () => {
    for (const locale of DISPLAY_LOCALES) {
      expect(DISPLAY_LOCALE_META[locale]).toBeDefined();
      expect(formattingProfileFor(locale).length).toBeGreaterThan(0);
    }
  });

  it('but only two are selectable — infrastructure is not a claim', () => {
    /*
      THE POINT OF THE WHOLE SECTION, in one assertion: five display locales
      have complete direction and formatting support and are invisible to every
      reader, because visibility is SELECTABLE_LOCALES and nothing else.
    */
    const supportedButNotOffered = DISPLAY_LOCALES.filter(
      (l) => !(SELECTABLE_LOCALES as readonly string[]).includes(l),
    );

    expect(supportedButNotOffered).toEqual(['fr', 'de', 'es', 'pt', 'ar']);

    for (const locale of supportedButNotOffered) {
      expect(directionFor(locale)).toBeDefined();
    }
  });
});

describe('B5-C · what was NOT recovered, and why it is not safely separable', () => {
  it('no additional dictionary was installed', () => {
    /*
      H1, MEASURED BY L: this lineage's en.ts has diverged from the one the
      recovered locales were authored against. A locale that no longer compiles
      against `Dictionary = typeof en` invites `{ ...en }` to make it build —
      which converts "this locale is total" into "this locale renders English
      for everything nobody re-authored", AND IT COMPILES, and it would be
      selectable.

      Closing that needs catalogueCompleteness.spec.ts to land FIRST. Installing
      dictionaries before their instrument is the one ordering that cannot be
      corrected afterwards, so no dictionary was installed here.
    */
    const dir = join(__dirname, 'dictionaries');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const files = (require('fs').readdirSync(dir) as string[]).filter((f) =>
      /^(en|pl|fr|de|es|pt|ar)\.ts$/.test(f),
    );

    expect(files.sort()).toEqual(['en.ts', 'pl.ts']);
  });

  it('and pluralize.ts was NOT deleted, because its replacement was not installed', () => {
    /*
      H4. Canonical's plural.ts/format.ts supersede this file, and C32 deleted
      it once already. But deleting it HERE, without installing the replacement,
      would leave the product with no plural implementation at all — and
      installing the replacement belongs to the dictionary phase that is
      deliberately not being done.

      Two live plural implementations is a real hazard; zero is an outage. The
      hazard is carried, named, and left for the phase that can close it
      properly.
    */
    expect(() => readFileSync(join(__dirname, 'pluralize.ts'), 'utf-8')).not.toThrow();
  });
});
