import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DISPLAY_LOCALES, directionFor, formattingProfileFor } from '@globalnews-ai/shared';
import { askDirectionProps, askFormatCount, askFormatDate, askFormatUtcInstant, askIsRtl, askPluralCategory } from '@/lib/ask/askDirection';
import { askShellStrings } from '@/lib/ask/shell/askShellCatalogue';
import { declaredFallbacksFor } from '@/lib/ask/shell/askShellDeclaredFallbacks';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * R4 · PHASE B · B-12 — ARABIC RTL ACROSS THE ENTIRE LOCALIZED ASK SURFACE
 * ════════════════════════════════════════════════════════════════════════════
 *
 * The P0 correction's requirement, verbatim: *"Arabic requires RTL across the entire
 * localized Ask surface."*
 *
 * ── WHAT WAS ACTUALLY WRONG, AND IT WAS NOT THE MECHANISM ────────────────
 *
 * `askDirection.ts` has been correct since the direction round: direction comes from the
 * shared contract's table, URLs and chips isolate, and every formatter is built from the
 * locale's `Intl` profile. What was wrong was WHERE it was applied. Exactly one scope
 * carried `lang`/`dir` — the Ask FRAME — and the navigation shell, the phone header, Recent
 * and Saved all sit outside it. Those surfaces are where every defect the Product Owner
 * named by hand lives: New question, Recent, Saved, Help & feedback, Settings, Account, the
 * language menu.
 *
 * So an Arabic reader got RTL answers under a left-to-right navigation bar. That is the
 * mixed-direction form of the same defect as the French hero over the English application,
 * and a spec that only checked the frame would have passed throughout.
 *
 * This spec therefore asserts the SCOPES, not just the helper.
 */

const src = join(__dirname, '..', '..', '..');
const read = (...parts: string[]): string => readFileSync(join(src, ...parts), 'utf-8');
const code = (text: string): string =>
  text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

describe('B-12 · every localized Ask scope declares its own direction', () => {
  /*
    Each entry is a surface a Standalone Ask reader can reach, and the attribute pair it must
    carry. Asserted on the SOURCE because these are server/client components with no DOM in
    this test environment — and because what matters is that the pair is DERIVED, never
    literal: a hard-coded `dir="rtl"` would be a second direction authority.
  */
  const SCOPES: ReadonlyArray<readonly [string, readonly string[], string]> = [
    ['components/ask-frame/AskFrameScreen.tsx', ['lang={askScope.lang}', 'dir={askScope.dir}'], 'askDirectionProps(interfaceLocale)'],
    ['components/ask-nav/AskNavShell.tsx', ['lang={shellDirection.lang}', 'dir={shellDirection.dir}'], 'askDirectionProps(language)'],
    ['components/ask-nav/AskContinuityHeader.tsx', ['lang={direction.lang}', 'dir={direction.dir}'], 'askDirectionProps(locale)'],
    ['components/ask/SavedClient.tsx', ['lang={direction.lang}', 'dir={direction.dir}'], 'askDirectionProps(locale)'],
    ['components/ask/AskRecentClient.tsx', ['lang={direction.lang}', 'dir={direction.dir}'], 'askDirectionProps(locale)'],
  ];

  it.each(SCOPES.map(([file]) => file))('%s carries a derived lang/dir pair', (file) => {
    const entry = SCOPES.find(([f]) => f === file);
    if (entry === undefined) throw new Error(`no scope entry for ${file}`);
    const [, attributes, source] = entry;
    const text = code(read(file));
    for (const attribute of attributes) expect(text).toContain(attribute);
    expect(text).toContain(source);
  });

  it('no Ask surface hard-codes a direction', () => {
    /*
      THE ASSERTION THAT MATTERS MOST. `dir="rtl"` or `dir="ltr"` written as a literal is
      how a surface stops following the reader's locale, and it is invisible in a
      left-to-right review. The one exception is `isolatedLtr()`, which returns `dir: 'ltr'`
      BY DESIGN for a run that is always left-to-right — a URL, a host, an identifier — and
      lives in `askDirection.ts` where it can be reasoned about.
    */
    for (const [file] of SCOPES) {
      expect(code(read(file))).not.toMatch(/dir="(rtl|ltr)"/);
    }
  });
});

describe('B-12 · the direction itself comes from the shared contract, never a branch', () => {
  it('Arabic is the only RTL member of the contracted seven', () => {
    const rtl = DISPLAY_LOCALES.filter(askIsRtl);
    expect(rtl).toEqual(['ar']);
    expect(directionFor('ar')).toBe('rtl');
    for (const locale of DISPLAY_LOCALES) {
      expect(askDirectionProps(locale)).toEqual({ lang: locale, dir: directionFor(locale) });
    }
  });

  it('askDirection contains no per-language branch', () => {
    const text = code(read('lib', 'ask', 'askDirection.ts'));
    expect(text).not.toMatch(/locale\s*===\s*'(ar|fr|de|es|pt|pl)'/);
    expect(text).not.toMatch(/\[\s*'en'\s*,\s*'pl'/);
  });

  it("Arabic's formatting profile is the shared contract's", () => {
    expect(formattingProfileFor('ar')).toBe('ar-u-nu-arab-ca-gregory');
  });
});

describe('B-12 · Arabic reads as Arabic, including its numbers', () => {
  it('the chrome the Product Owner named is Arabic', () => {
    const s = askShellStrings('ar');
    expect(s.askNavStrings.newQuestion).toBe('سؤال جديد');
    expect(s.askNavStrings.recent).toBe('الأخيرة');
    expect(s.askNavStrings.saved).toBe('المحفوظة');
    expect(s.askNavStrings.help).toBe('المساعدة والملاحظات');
    expect(s.askNavStrings.settings).toBe('الإعدادات');
    expect(s.askNavStrings.account).toBe('الحساب');
    expect(s.askR2Strings.ask).toBe('اسأل');
    expect(s.askR2Strings.privacyLink).toBe('الخصوصية');
    /*
      `dict.navBar.signIn` is NOT asserted Arabic here. It is on the Product Owner's own
      defect list and still renders English, because it is one of the 38 `dict.navBar`
      members manifest Revision 2 under-listed and Claude L therefore never saw. That gap is
      declared and asserted in `askShellCoverage.spec.ts`; asserting Arabic for it here would
      be asserting something untrue in a file whose whole job is direction, not coverage.
    */
    expect(s.askNavStrings.newQuestion).toBe('سؤال جديد');
  });

  it('counts render in Eastern-Arabic numerals', () => {
    /* ١٢ — because the count goes through Intl.NumberFormat with the locale's profile. */
    expect(askFormatCount(12, 'ar')).toBe('١٢');
    expect(askFormatCount(12, 'fr')).toBe('12');
  });

  it('dates and instants render in Arabic, in the product’s frozen arrangement', () => {
    const iso = '2026-09-28T04:52:00Z';
    const ar = askFormatUtcInstant(iso, 'ar');
    expect(ar).not.toBeNull();
    /* The suffix is literal on purpose: Ask states instants in UTC deliberately. */
    expect(ar).toContain('UTC');
    /* Arabic numerals, so no ASCII digit survives outside the literal suffix. */
    expect((ar ?? '').replace(' UTC', '')).not.toMatch(/[0-9]/);
    /* EN and PL are byte-identical to the hand-written tables this replaced. */
    expect(askFormatUtcInstant(iso, 'en')).toBe('28 Sep 2026, 04:52 UTC');
    expect(askFormatDate(iso, 'en')).toBe('28 Sep 2026');
  });

  it('Arabic plural categories are the language’s, not a count branch', () => {
    /* Six categories; a `n === 1 ? a : b` branch is wrong in five of them. */
    const categories = [0, 1, 2, 3, 11, 100].map((n) => askPluralCategory(n, 'ar'));
    expect(new Set(categories).size).toBeGreaterThan(3);
    expect(askPluralCategory(1, 'ar')).toBe('one');
    expect(askPluralCategory(2, 'ar')).toBe('two');
    /*
      The CATEGORIES above are the language's and are proven. Claude L has now delivered all
      six forms, so the shell's own template follows them — ٢ and ٣ and ١١ each select a
      different Arabic form, which a `n === 1 ? a : b` branch could never have produced.
    */
    const s = askShellStrings('ar');
    expect(s.askR2Strings.sourcesLabel(2)).toMatch(/[\u0600-\u06FF]/);
    expect(s.askR2Strings.sourcesLabel(2)).not.toBe(s.askR2Strings.sourcesLabel(3));
    expect(s.askR2Strings.sourcesLabel(3)).not.toBe(s.askR2Strings.sourcesLabel(11));
    expect(declaredFallbacksFor('ar')).toEqual([]);
  });
});

describe('B-12 · un-worded chrome inside an RTL scope is isolated, not left to drift', () => {
  it('the frame still carries the foreign-copy isolation', () => {
    /*
      469 keys per locale are still English, declared. Inside an RTL scope their trailing
      punctuation attaches to the paragraph's direction rather than the sentence's — measured
      in the Arabic screenshot, where "…has not been assessed." was drawn as ".…has not been
      assessed". `askForeignCopyProps` isolates such a run in its own direction, and it must
      keep existing for exactly as long as the declared fallback list does.
    */
    const text = code(read('components', 'ask-frame', 'AskFrameScreen.tsx'));
    expect(text).toContain('askForeignCopyProps(interfaceLocale)');
  });

  it('no string in any locale carries a bidi control character', () => {
    /*
      Direction is the renderer's job. A U+200E/200F or an isolate control embedded in COPY is
      a second, invisible direction authority inside a paragraph that already has one, and it
      survives translation review because it does not print. Asserted across all seven so a
      future delivery from Claude L cannot introduce one either.
    */
    const forbidden = /[‎‏‪-‮⁦-⁩]/;
    for (const locale of DISPLAY_LOCALES) {
      const walk = (node: unknown): void => {
        if (typeof node === 'string') {
          expect(node).not.toMatch(forbidden);
          return;
        }
        if (typeof node === 'function') return;
        if (Array.isArray(node)) {
          node.forEach(walk);
          return;
        }
        if (node !== null && typeof node === 'object') Object.values(node).forEach(walk);
      };
      walk(askShellStrings(locale));
    }
  });
});
