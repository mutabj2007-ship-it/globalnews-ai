import { readFileSync } from 'fs';
import { join } from 'path';
import {
  DISPLAY_LOCALES,
  DISPLAY_LOCALE_META,
  directionFor,
  formattingProfileFor,
  type DisplayLocale,
} from '@globalnews-ai/shared';
import {
  ASK_ANSWER_LOCALES,
  ASK_DISPLAY_LOCALES,
  ASK_FALLBACK_LOCALE,
  answerIsInReaderLanguage,
  askClientLanguage,
  askLanguageDisposition,
  askLocaleForLegacyCatalogue,
  askRequestLanguage,
  resolveAskLocale,
} from './askLocale';
import { ASK_SEVEN_LOCALES, askCopyCoverage, askSevenStrings } from './askSevenStrings';
import { askShellStrings } from './shell/askShellCatalogue';
import {
  askChipProps,
  askForeignCopyProps,
  isolatedAuto,
  askDirectionProps,
  askFormatCount,
  askFormatDate,
  askFormatUtcInstant,
  askIsRtl,
  askPluralCategory,
  askTextAlignEnd,
  askTextAlignStart,
  isolatedLtr,
} from './askDirection';
import { askR2Strings } from './askR2Strings';
import { SELECTABLE_LOCALES } from '@/lib/i18n/languages';
import { renderableLocalesOf, resolveSurfaceLocale, surfaceIds } from '@/lib/i18n/surfaceLocale';

/**
 * R4 · CLAUDE H — SEVEN-LANGUAGE ASK FRONTEND + ARABIC RTL.
 *
 * The suite is organised by the contract's own testing list: selector / request language for
 * all seven, EN/PL regression, FR–PT render, Arabic RTL desktop and mobile, source chips RTL
 * safety, and clarification copy.
 */

const SRC = join(__dirname, '..', '..');
function src(...p: string[]): string {
  return readFileSync(join(SRC, ...p), 'utf8');
}
/** Comments stripped, so prose explaining a prohibition cannot satisfy it. */
function code(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

const SEVEN: readonly DisplayLocale[] = ['en', 'pl', 'fr', 'de', 'es', 'pt', 'ar'];

describe('H-1 · the selector and the request language cover all seven', () => {
  it('the deployment registry is the contracted seven, in contract order', () => {
    expect([...SELECTABLE_LOCALES]).toEqual([...SEVEN]);
    expect([...ASK_DISPLAY_LOCALES]).toEqual([...DISPLAY_LOCALES]);
    expect([...ASK_SEVEN_LOCALES]).toEqual([...DISPLAY_LOCALES]);
  });

  it('resolves every one of the seven without clamping it to EN or PL', () => {
    for (const locale of SEVEN) {
      expect(resolveAskLocale(locale)).toBe(locale);
      const disposition = askLanguageDisposition(locale);
      expect(disposition.requested).toBe(locale);
      expect(disposition.interfaceLocale).toBe(locale);
      expect(askRequestLanguage(disposition)).toBe(locale);
    }
  });

  it('a value the contract does not contain resolves to the fallback, which is a resolution', () => {
    for (const value of ['', ' ', 'sw', 'rw', 'uk', 'ru', 'zz', 'EN', undefined, null]) {
      expect(resolveAskLocale(value as string | undefined)).toBe(ASK_FALLBACK_LOCALE);
    }
  });

  it('the answer set is the whole seven, and the copy-catalogue pair is named exactly once', () => {
    /* PO RULING — the answer comes back in the reader's selected language, all seven. */
    expect([...ASK_ANSWER_LOCALES]).toEqual([...ASK_DISPLAY_LOCALES]);
    /* The remaining two-locale list is COPY COVERAGE, and it is still named exactly once. */
    const occurrences =
      code(src('lib', 'ask', 'askLocale.ts')).match(/'en',\s*'pl',?/g) ?? [];
    expect(occurrences).toHaveLength(1);
  });

  /*
    CORRECTED (PO ruling). This test previously asserted the opposite for FR–AR: that the
    answer came back in English and the reader was told so. That was measured against this
    lane's base `c7e8c03`, whose backend was EN/PL-gated, and it is false on the current
    integration head, which routes fr/de/es/pt/ar. The old assertion is not relaxed — it is
    INVERTED, because the fact it encoded was stale.
  */
  it('every one of the seven is answered in the reader own language', () => {
    for (const locale of ASK_DISPLAY_LOCALES) {
      const d = askLanguageDisposition(locale);
      expect(d.requested).toBe(locale);
      expect(d.interfaceLocale).toBe(locale);
      expect(d.answerLocale).toBe(locale);
      expect(answerIsInReaderLanguage(d)).toBe(true);
      /* And the client carries the reader's own locale, not a narrowed one. */
      expect(askClientLanguage(d)).toBe(locale);
    }
  });

  it('the only remaining narrowing is which COPY catalogue is indexed, and it is reported', () => {
    for (const locale of ['en', 'pl'] as const) {
      const d = askLanguageDisposition(locale);
      expect(d.catalogueLocale).toBe(locale);
      expect(d.fullAskCopy).toBe(true);
    }
    for (const locale of ['fr', 'de', 'es', 'pt', 'ar'] as const) {
      const d = askLanguageDisposition(locale);
      /*
        R4 · PHASE B — THIS ASSERTION USED TO READ `expect(d.catalogueLocale).toBe('en')`,
        AND IT WAS CORRECT WHEN IT WAS WRITTEN.

        It pinned the behaviour that `catalogueLocale` borrows English for the five locales
        with no copy catalogue of their own. The P0 correction's ruling removed the thing it
        pinned: `selectedLocale` must drive the entire Ask UI catalogue, so the shell is now
        indexable by all seven and `catalogueLocale` is the reader's own locale. An assertion
        that the chrome reads English for a French reader is now an assertion that the
        defect is still present, so it is replaced rather than relaxed.

        What it checked is NOT lost — it has moved to where it can be precise. The wording
        gap is still real for these five, and `fullAskCopy` still reports it; but it is now a
        per-KEY fact measured by `askShellCoverage(locale).fallbacks` against a declared
        manifest, rather than a whole-catalogue substitution. `askShellCoverage.spec.ts`
        asserts the measured and declared sets are EQUAL for all seven.
      */
      expect(d.catalogueLocale).toBe(locale);
      /*
        NOW TRUE, AND THAT IS THE WHOLE POINT OF THE LANE. This assertion has moved three
        times and each move was a fact about the delivery, not a relaxation: it read
        `catalogueLocale === 'en'` while the shell was EN/PL-only, then `fullAskCopy === false`
        while Claude L's wording was outstanding, and now the shell is complete in all seven.
        `fullAskCopy` is computed from `askShellCoverage(locale).complete` — a measurement of
        the overlay, not a flag anyone sets — so it cannot be true unless nothing falls back.
      */
      expect(d.fullAskCopy).toBe(true);
      /* ...which says nothing about the answer. */
      expect(d.answerLocale).toBe(locale);
    }
  });

  it('no surface can tell a reader their answer comes back in another language', () => {
    for (const file of ['AskFrameScreen.tsx']) {
      const body = src('components', 'ask-frame', file);
      expect(body).not.toContain('answerInEnglish');
      expect(body).not.toContain('answerInPolish');
      expect(body).not.toContain('data-ask-language-disclosed');
    }
    const strings = src('lib', 'ask', 'askSevenStrings.ts');
    expect(strings).not.toMatch(/answerInEnglish:|answerInPolish:/);
  });

  it('the legacy five-member catalogue crossing is enumerated, never cast', () => {
    expect(askLocaleForLegacyCatalogue('fr')).toBe('fr');
    expect(askLocaleForLegacyCatalogue('es')).toBe('es');
    expect(askLocaleForLegacyCatalogue('ar')).toBe('ar');
    /* `de` and `pt` are not LanguageCode members, so they cannot be expressed. */
    expect(askLocaleForLegacyCatalogue('de')).toBe('en');
    expect(askLocaleForLegacyCatalogue('pt')).toBe('en');
  });

  it('no Ask surface still carries the ten clamps this replaced', () => {
    const surfaces = [
      ['app', 'ask', 'page.tsx'],
      ['app', 'ask', 'recent', 'page.tsx'],
      ['app', 'saved', 'page.tsx'],
      ['app', 'saved', 'briefing', 'page.tsx'],
      ['app', 'account', 'settings', 'page.tsx'],
      ['app', 'page.tsx'],
      ['components', 'ask-frame', 'AskFrameScreen.tsx'],
      ['components', 'ask', 'AskAiDock.tsx'],
      ['components', 'search', 'SearchPageClient.tsx'],
    ];
    for (const path of surfaces) {
      const body = code(src(...path));
      expect(body).not.toMatch(/\?\s*'pl'\s*:\s*'en'/);
      expect(body).not.toMatch(/r2Locale:\s*'en'\s*\|\s*'pl'/);
    }
  });
});

describe('H-2 · EN and PL regression — nothing about them changed', () => {
  it('the bounded catalogue READS the frozen EN/PL authority rather than copying it', () => {
    for (const locale of ['en', 'pl'] as const) {
      const frozen = askR2Strings(locale);
      const seven = askSevenStrings(locale);
      expect(seven.reasoning).toBe(frozen.badges);
      expect(seven.evidence.sources).toBe(frozen.sources);
      expect(seven.evidence.answer).toBe(frozen.answer);
      expect(seven.evidence.scope).toBe(frozen.scope);
      expect(seven.evidence.noScope).toBe(frozen.noScope);
      expect(seven.evidence.noCitableSources).toBe(frozen.noCitable);
      expect(seven.emptyNoAnswer).toBe(frozen.noAnswer);
      expect(seven.clarificationWhichOne).toBe(frozen.whichOne);
    }
  });

  it('the released English reasoning labels are exactly what they were', () => {
    expect(askSevenStrings('en').reasoning).toEqual({
      ref: 'REFERENCE BACKGROUND',
      ver: 'CURRENTLY VERIFIED',
      cur: 'CURRENT INTELLIGENCE',
      clar: 'CLARIFICATION REQUIRED',
      part: 'PARTIAL EVIDENCE',
      insuf: 'INSUFFICIENT EVIDENCE',
      unavail: 'CAPABILITY UNAVAILABLE',
      rec: 'RETAINED RECORD',
      calc: 'CALCULATION',
      /* CURRENT-REPORTING TRUTH R1 (B1) — the new state's badge; the nine released labels above
         are unchanged. */
      retrep: 'RETAINED REPORTING',
    });
    expect(askSevenStrings('pl').reasoning.clar).toBe('WYMAGA DOPRECYZOWANIA');
  });

  it('EN and PL timestamps are byte-identical to the format they have always had', () => {
    /* The released shape: day, short month, year, 24h clock, literal UTC. */
    expect(askFormatUtcInstant('2026-09-28T04:52:00.000Z', 'en')).toBe('28 Sep 2026, 04:52 UTC');
    expect(askFormatUtcInstant('2026-09-28T04:52:00.000Z', 'pl')).toBe('28 wrz 2026, 04:52 UTC');
    expect(askFormatUtcInstant('2026-01-02T23:07:00.000Z', 'en')).toBe('2 Jan 2026, 23:07 UTC');
    expect(askFormatUtcInstant('2026-01-02T23:07:00.000Z', 'pl')).toBe('2 sty 2026, 23:07 UTC');
  });

  it('an absent or unparseable instant is still null, so callers do not change', () => {
    for (const locale of SEVEN) {
      expect(askFormatUtcInstant(undefined, locale)).toBeNull();
      expect(askFormatUtcInstant(null, locale)).toBeNull();
      expect(askFormatUtcInstant('not a date', locale)).toBeNull();
      expect(askFormatDate(undefined, locale)).toBeNull();
    }
  });
});

describe('H-3 · FR / DE / ES / PT render completely', () => {
  it('every bounded key is authored in every locale, with no English leaking through', () => {
    const english = askSevenStrings('en');
    for (const locale of ['fr', 'de', 'es', 'pt'] as const) {
      const t = askSevenStrings(locale);
      expect(t.composerHint).not.toBe(english.composerHint);
      expect(t.clarificationNeeded).not.toBe(english.clarificationNeeded);
      expect(t.interpretationUnresolved).not.toBe(english.interpretationUnresolved);
      expect(t.errorRequestFailed).not.toBe(english.errorRequestFailed);
      expect(t.emptyNothingAsked).not.toBe(english.emptyNothingAsked);
      expect(t.evidence.answer).not.toBe(english.evidence.answer);
      for (const key of Object.keys(english.reasoning) as (keyof typeof english.reasoning)[]) {
        expect(t.reasoning[key].length).toBeGreaterThan(0);
        expect(t.reasoning[key]).not.toBe(english.reasoning[key]);
      }
    }
  });

  it('no bounded value is empty, in any of the seven', () => {
    for (const locale of SEVEN) {
      const t = askSevenStrings(locale);
      const flat = [
        t.composerHint,
        t.clarificationNeeded,
        t.clarificationWhichOne,
        t.emptyNothingAsked,
        t.emptyNoAnswer,
        t.errorRequestFailed,
        t.errorRetry,
        t.interpretationUnresolved,
        ...Object.values(t.reasoning),
        ...Object.values(t.evidence),
      ];
      for (const value of flat) expect(value.trim().length).toBeGreaterThan(0);
    }
  });

  it('coverage is reported as data: bounded copy complete, the copy gap named for Claude L', () => {
    for (const locale of ['en', 'pl'] as const) {
      expect(askCopyCoverage(locale)).toEqual({
        locale,
        boundedCopy: true,
        fullAskCopy: true,
        catalogueLocale: locale,
      });
    }
    for (const locale of ['fr', 'de', 'es', 'pt', 'ar'] as const) {
      expect(askCopyCoverage(locale)).toEqual({
        locale,
        boundedCopy: true,
        fullAskCopy: false,
        catalogueLocale: 'en',
      });
    }
  });

  it('dates and counts render in each locale rather than in one', () => {
    const rendered = SEVEN.map((l) => askFormatUtcInstant('2026-03-09T08:05:00.000Z', l));
    expect(new Set(rendered).size).toBeGreaterThan(3);
    for (const value of rendered) expect(value).toMatch(/UTC$/);
    expect(askFormatCount(12345, 'de')).toBe('12.345');
    expect(askFormatCount(12345, 'fr')).not.toBe('12345');
    expect(askFormatCount(12345, 'en')).toBe('12,345');
  });
});

describe('H-4 · Arabic RTL', () => {
  it('ar is the only RTL member, and direction comes from the shared table', () => {
    expect(askIsRtl('ar')).toBe(true);
    for (const locale of ['en', 'pl', 'fr', 'de', 'es', 'pt'] as const) {
      expect(askIsRtl(locale)).toBe(false);
    }
    for (const locale of SEVEN) {
      expect(askDirectionProps(locale)).toEqual({ lang: locale, dir: directionFor(locale) });
    }
  });

  /*
    H-4 SUPERSEDED BY T2 + SPEC-T2-H-3 + CTO ARABIC RTL RULING (2026-10-05).
    The original assertion ("product chrome untouched; app/layout.tsx contains no dir=") predates
    T2. The CTO ruling makes Arabic APPLICATION CHROME RTL, and T2 derives <html lang/dir> from the
    EFFECTIVE surface locale. This is a SPEC correction: no product code changed to satisfy it.
  */
  it('root document direction comes from the effective-locale authority: Arabic → rtl, the rest → ltr', () => {
    for (const locale of SEVEN) {
      const surface = resolveSurfaceLocale('askStandalone', locale);
      expect([locale, surface.document.dir]).toEqual([locale, locale === 'ar' ? 'rtl' : 'ltr']);
    }
    /* EFFECTIVE, not requested: a surface that cannot render Arabic falls back to English → ltr. */
    const noArabic = surfaceIds().find((id) => !renderableLocalesOf(id).includes('ar'));
    if (noArabic !== undefined) {
      const fellBack = resolveSurfaceLocale(noArabic, 'ar');
      expect(fellBack.fellBack).toBe(true);
      expect(fellBack.document.dir).toBe('ltr');
    }
    const layout = code(src('app', 'layout.tsx'));
    expect(layout).toMatch(/<html lang=\{surface\.document\.lang\} dir=\{surface\.document\.dir\}/);
    expect(layout).toMatch(/documentSurfaceLocale\(\)/);
    expect(layout).not.toMatch(/dir="(rtl|ltr)"/); /* never a literal: one authority decides */
  });

  it('Ask adds no competing direction mechanism: its scope uses the same shared table as the document', () => {
    for (const locale of SEVEN) {
      expect(askDirectionProps(locale).dir).toBe(resolveSurfaceLocale('askStandalone', locale).document.dir);
    }
    const frame = code(src('components', 'ask-frame', 'AskFrameScreen.tsx'));
    expect(frame).toMatch(/lang=\{askScope\.lang\}/);
    expect(frame).toMatch(/dir=\{askScope\.dir\}/);
  });

  it('mixed source / URL content stays isolated by the existing bidi helpers', () => {
    expect(isolatedLtr()).toEqual({ dir: 'ltr', style: { unicodeBidi: 'isolate', direction: 'ltr' } });
    expect(isolatedAuto()).toEqual({ style: { unicodeBidi: 'isolate' } });
    expect(isolatedAuto()).not.toHaveProperty('dir'); /* inherits; never a second authority */
  });

  it('the surface exposes its locale, direction and answer language for a proof to read', () => {
    const frame = code(src('components', 'ask-frame', 'AskFrameScreen.tsx'));
    expect(frame).toMatch(/data-ask-locale=\{interfaceLocale\}/);
    expect(frame).toMatch(/data-ask-dir=\{askScope\.dir\}/);
    expect(frame).toMatch(/data-ask-answer-locale=\{disposition\.answerLocale\}/);
    /* The copy-coverage fact, for Claude L's lane — never an answer-language claim. */
    expect(frame).toMatch(/data-ask-full-copy=/);
    expect(frame).not.toMatch(/data-ask-language-disclosed/);
  });

  it('Arabic numerals and dates come from the contract profile, not from a branch', () => {
    expect(formattingProfileFor('ar')).toBe('ar-u-nu-arab-ca-gregory');
    expect(DISPLAY_LOCALE_META.ar.direction).toBe('rtl');
    /* Eastern-Arabic digits: a template literal would have rendered 12 as "12". */
    expect(askFormatCount(12, 'ar')).toBe('١٢');
    const stamp = askFormatUtcInstant('2026-09-28T04:52:00.000Z', 'ar');
    expect(stamp).not.toBeNull();
    expect(stamp).toMatch(/UTC$/);
    expect(stamp).toMatch(/[٠-٩]/);
  });

  it('plural category comes from the locale rules, not from n === 1', () => {
    /* Arabic has six categories; Polish four. A one-or-many branch is wrong in both. */
    expect(askPluralCategory(0, 'ar')).toBe('zero');
    expect(askPluralCategory(2, 'ar')).toBe('two');
    expect(askPluralCategory(3, 'ar')).toBe('few');
    expect(askPluralCategory(2, 'pl')).toBe('few');
    expect(askPluralCategory(5, 'pl')).toBe('many');
    expect(askPluralCategory(1, 'en')).toBe('one');
  });

  it('no component decides its own direction', () => {
    const direction = code(src('lib', 'ask', 'askDirection.ts'));
    expect(direction).not.toMatch(/locale === 'ar'/);
    expect(direction).toMatch(/directionFor\(/);
    expect(direction).toMatch(/formattingProfileFor\(/);
    /* Logical alignment, so one value is correct in both directions. */
    expect(askTextAlignStart()).toBe('start');
    expect(askTextAlignEnd()).toBe('end');
  });

  it('the Arabic chrome is authored, so the surface is not an RTL frame around English', () => {
    const t = askSevenStrings('ar');
    for (const value of [t.composerHint, t.interpretationUnresolved, t.evidence.answer]) {
      expect(value).toMatch(/[؀-ۿ]/);
    }
    expect(t.evidence.sources).toMatch(/[؀-ۿ]/);
  });
});

describe('H-5 · source chips and mixed LTR/RTL URLs are direction-safe', () => {
  it('a chip isolates in its own direction so its punctuation cannot leak', () => {
    expect(askChipProps('ar')).toEqual({ dir: 'rtl', style: { unicodeBidi: 'isolate' } });
    expect(askChipProps('en')).toEqual({ dir: 'ltr', style: { unicodeBidi: 'isolate' } });
  });

  it('a URL run is pinned LTR and ISOLATED — embed is not a substitute', () => {
    expect(isolatedLtr()).toEqual({
      dir: 'ltr',
      style: { unicodeBidi: 'isolate', direction: 'ltr' },
    });
    const direction = code(src('lib', 'ask', 'askDirection.ts'));
    expect(direction).not.toMatch(/unicodeBidi:\s*'embed'/);
    /* Bidi control characters are not the fix and must not be smuggled in as one. */
    expect(direction).not.toMatch(/‎|‏|&lrm;|&rlm;/);
  });

  it('EN/PL copy still inside an RTL scope is isolated, so its punctuation stays put', () => {
    /*
      MEASURED IN THE ARABIC SCREENSHOT before the fix: "…has not been assessed." rendered as
      ".…has not been assessed" because a period is a NEUTRAL character and took the
      paragraph's direction. Chrome outside the bounded catalogue is still EN/PL, so inside an
      RTL scope it isolates.
    */
    expect(askForeignCopyProps('ar')).toEqual({
      dir: 'ltr',
      style: { unicodeBidi: 'isolate', direction: 'ltr' },
    });
    /* Nothing is added for a left-to-right reader — their markup is untouched. */
    for (const locale of ['en', 'pl', 'fr', 'de', 'es', 'pt'] as const) {
      expect(askForeignCopyProps(locale)).toBeUndefined();
    }
  });

  it('the Ask frame applies it to the copy it has not translated yet', () => {
    const frame = code(src('components', 'ask-frame', 'AskFrameScreen.tsx'));
    expect(frame).toMatch(/const foreignCopy = askForeignCopyProps\(interfaceLocale\)/);
    expect(frame).toMatch(/costNoteProps=\{foreignCopy\}/);
    expect(frame).toMatch(/\{\.\.\.\(foreignCopy \?\? \{\}\)\}/);
  });

  it('every chip and URL helper is locale-driven, with no hardcoded left or right', () => {
    const direction = code(src('lib', 'ask', 'askDirection.ts'));
    expect(direction).not.toMatch(/textAlign:\s*'(left|right)'/);
  });
});

describe('H-7 · the authorized client pin — Ask SENDS the selected language', () => {
  const api = code(src('lib', 'api', 'askV2Api.ts'));

  it('the client language type is the contracted seven, not a two-member union', () => {
    expect(api).toMatch(/export type AskV2Language = DisplayLocale;/);
    expect(api).not.toMatch(/export type AskV2Language = 'en' \| 'pl';/);
  });

  it('the request bodies still carry `language`, unchanged in shape', () => {
    /* The widening is ONE type. Every body, route and outcome shape is untouched. */
    expect(api).toMatch(/createThread\(language: AskV2Language, returnPath: string \| null/);
    expect(api).toMatch(/'\/ask-v2\/threads', 'POST', \{\s*idempotencyKey: key,\s*language,/);
    expect(api).toMatch(/guestCreateThread\(language: AskV2Language/);
  });

  it('every Ask host passes the READER SELECTION to the conversation, not the chrome locale', () => {
    for (const path of [
      ['components', 'ask-frame', 'AskFrameScreen.tsx'],
      ['components', 'ask', 'AskAiDock.tsx'],
      ['components', 'search', 'SearchPageClient.tsx'],
      ['components', 'my-intelligence', 'MyIntelligenceClient.tsx'],
    ]) {
      const body = code(src(...path));
      expect(body).toMatch(/useAskR2Conversation\(\s*(ask)?[Dd]isposition\.requested/);
      /* and none of them still narrows before the request */
      expect(body).not.toMatch(/useAskR2Conversation\(r2Locale/);
      expect(body).not.toMatch(/r2Locale:\s*'en'\s*\|\s*'pl'/);
    }
  });

  it('the conversation hook itself is untouched — its 58f80 pin still holds', () => {
    /* The hook already accepted AskV2Language, so widening the type needed no edit here.
       Asserted so a future round cannot quietly claim the deviation it did not need. */
    const hook = code(src('lib', 'ask', 'useAskR2Conversation.ts'));
    expect(hook).toMatch(/language: AskV2Language,/);
    expect(hook).not.toMatch(/\? 'pl' : 'en'/);
  });

  it('the disposition keeps the request, the answer and the copy catalogue apart', () => {
    for (const locale of ['fr', 'de', 'es', 'pt', 'ar'] as const) {
      const d = askLanguageDisposition(locale);
      /* what the server is told */
      expect(askRequestLanguage(d)).toBe(locale);
      /* what comes back */
      expect(d.answerLocale).toBe(locale);
      /*
        and, separately, which copy catalogue the chrome reads — the reader's own since
        Phase B. See the longer note above: this read `.toBe('en')`, which pinned the
        borrowing the P0 correction ordered removed.
      */
      expect(d.catalogueLocale).toBe(locale);
      /* Complete since Claude L's Revision 4 answer; measured, not asserted. See above. */
      expect(d.fullAskCopy).toBe(true);
    }
  });
});

describe('H-8 · chips, source rows and the thread are direction-safe', () => {
  it('isolatedAuto bounds a run without deciding its direction', () => {
    expect(isolatedAuto()).toEqual({ style: { unicodeBidi: 'isolate' } });
    /* No `dir`: the scope decides, this only bounds. A component that set `dir` here would
       be the second direction authority the shared contract exists to prevent. */
    expect(Object.keys(isolatedAuto())).toEqual(['style']);
  });

  it('every chip surface isolates its label', () => {
    const turn = code(src('components', 'ask-frame', 'AskR2TurnView.tsx'));
    const frame = code(src('components', 'ask-frame', 'AskFrameScreen.tsx'));
    /* the scope chip row, its note, and the phone context strip */
    expect(turn.match(/\{\.\.\.isolatedAuto\(\)\}/g) ?? []).toHaveLength(2);
    expect(frame).toMatch(/\{\.\.\.isolatedAuto\(\)\}/);
  });

  it('source rows isolate the citation number, the headline and the publisher/date run', () => {
    const column = code(src('components', 'ask-frame', 'AskSourcesColumn.tsx'));
    /* the number is always a left-to-right token */
    expect(column).toMatch(/\{\.\.\.isolatedLtr\(\)\}/);
    /* the headline and the publisher · date run inherit direction and are bounded */
    expect(column.match(/\{\.\.\.isolatedAuto\(\)\}/g) ?? []).toHaveLength(2);

    const compact = code(src('components', 'ask', 'AskCompactResult.tsx'));
    /* "[1]" — brackets around a digit, the classic reorder */
    expect(compact).toMatch(/\{\.\.\.isolatedLtr\(\)\}/);
    expect(compact.match(/\{\.\.\.isolatedAuto\(\)\}/g) ?? []).toHaveLength(2);
  });

  it('no Ask surface reaches for a bidi control character instead of isolation', () => {
    for (const path of [
      ['components', 'ask-frame', 'AskR2TurnView.tsx'],
      ['components', 'ask-frame', 'AskSourcesColumn.tsx'],
      ['components', 'ask-frame', 'AskFrameScreen.tsx'],
      ['components', 'ask', 'AskCompactResult.tsx'],
      ['lib', 'ask', 'askDirection.ts'],
    ]) {
      /* Comment-stripped: `askDirection.ts` NAMES `&lrm;` in a docblock to say it is not the
         fix, and prose explaining a prohibition must not be able to trip it. */
      const body = code(src(...path));
      expect(body).not.toMatch(/\u200E|\u200F|&lrm;|&rlm;/);
      expect(body).not.toMatch(/unicodeBidi:\s*'embed'/);
    }
  });
});

describe('H-6 · clarification, empty and error copy', () => {
  it('clarification and INTERPRETATION_UNRESOLVED are different statements in all seven', () => {
    for (const locale of SEVEN) {
      const t = askSevenStrings(locale);
      expect(t.interpretationUnresolved).not.toBe(t.clarificationNeeded);
      expect(t.interpretationUnresolved).not.toBe(t.clarificationWhichOne);
    }
  });

  it('an empty state is a state and an error names no cause it cannot know', () => {
    for (const locale of SEVEN) {
      const t = askSevenStrings(locale);
      expect(t.emptyNothingAsked).not.toBe(t.errorRequestFailed);
      /* Never blames the reader, and never guesses at a reason. */
      expect(t.errorRequestFailed.toLowerCase()).not.toMatch(/you |twoj|votre |ihre |tu |sua /);
    }
  });

  it('the bounded copy is written in the reader language, never in English only', () => {
    for (const locale of ['fr', 'de', 'es', 'pt', 'ar'] as const) {
      const t = askSevenStrings(locale);
      const en = askSevenStrings('en');
      for (const key of ['composerHint', 'interpretationUnresolved', 'errorRetry'] as const) {
        expect(t[key]).not.toBe(en[key]);
      }
    }
  });

  it('nothing in this lane translates a question or routes on its text', () => {
    for (const file of ['askLocale.ts', 'askSevenStrings.ts', 'askDirection.ts']) {
      const body = code(src('lib', 'ask', file));
      expect(body).not.toMatch(/translate|translation|detectLanguage|franc|langdetect/i);
      expect(body).not.toMatch(/\bfetch\s*\(/);
      /*
        THE SCAN IS ON IDENTIFIERS, NOT ON THE WORD. Reader copy legitimately contains the
        word "question" — the French composer hint is "Posez une question sur ce qui se
        passe". What must not exist is a code path that RECEIVES or READS question text, so
        the assertion is on the shapes that would: a parameter, a property access, a member.
      */
      expect(body).not.toMatch(/\bquestion\s*[:.)]/i);
      expect(body).not.toMatch(/questionText|\.question\b/i);
    }
  });
});

describe('R4 · ONE TRANSLATION AUTHORITY — askSevenStrings never re-authors a shell key (CTO, H 266007c integration)', () => {
  it('in all seven, every shell-owned key is the merged shell’s own value — read, not a second copy', () => {
    for (const locale of SEVEN) {
      const shell = askShellStrings(locale);
      const seven = askSevenStrings(locale);
      expect(seven.composerHint).toBe(shell.dict.askAi.inputPlaceholder);
      expect(seven.emptyNoAnswer).toBe(shell.askR2Strings.noAnswer);
      expect(seven.clarificationWhichOne).toBe(shell.askR2Strings.whichOne);
      expect(seven.reasoning).toEqual(shell.askR2Strings.badges);
      expect(seven.evidence.sources).toBe(shell.askR2Strings.sources);
      expect(seven.evidence.answer).toBe(shell.askR2Strings.answer);
      expect(seven.evidence.scope).toBe(shell.askR2Strings.scope);
      expect(seven.evidence.noScope).toBe(shell.askR2Strings.noScope);
      expect(seven.evidence.noCitableSources).toBe(shell.askR2Strings.noCitable);
    }
  });

  it('the source file holds no FR / DE / ES / PT / AR copy of a shell-owned key', () => {
    const src = readFileSync(join(__dirname, 'askSevenStrings.ts'), 'utf8');
    expect(src).not.toMatch(/NEW_LOCALES/);
    expect(src).not.toMatch(/^\s+(?:composerHint|emptyNoAnswer|clarificationWhichOne):\s*'/m);
    expect(src).not.toMatch(/^\s+(?:clar|sources|noCitableSources):\s*'/m);
  });

  it('the drift this closes: pt-BR "você" and the French hint now come from Claude L’s overlay', () => {
    expect(askSevenStrings('pt').clarificationWhichOne).toBe('A qual você se refere?');
    expect(askSevenStrings('fr').composerHint).toBe('Que souhaitez-vous comprendre ?');
  });
});
