import { type DisplayLocale } from '@globalnews-ai/shared';
import {
  SHELL_LOCALES,
  isShellTemplatePath,
  mergeShell,
  shellFallbacks,
  shellKeyPaths,
  shellPathWithoutMarker,
  type ShellAdditiveOverlay,
  type ShellLocaleOverlay,
  type ShellQualification,
} from '@/lib/ask/shell/askShellOverlay';
import { askProductNameFor } from '@/lib/ask/askBrand';
import {
  ASK_SHELL_PROPER_NOUNS,
  askShellPolish,
  askShellSource,
  brandCanonical,
  type AskShellSource,
} from '@/lib/ask/shell/askShellSource';
import { frShellOverlay } from '@/lib/ask/shell/locales/fr';
import { deShellOverlay } from '@/lib/ask/shell/locales/de';
import { esShellOverlay } from '@/lib/ask/shell/locales/es';
import { ptShellOverlay } from '@/lib/ask/shell/locales/pt';
import { arShellOverlay } from '@/lib/ask/shell/locales/ar';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * R4 · PHASE B — THE ONE RESOLVER THE WHOLE ASK SHELL READS FROM
 * ════════════════════════════════════════════════════════════════════════════
 *
 * `selectedLocale` drives the entire Ask UI catalogue. That is the Product Owner's
 * requirement in his own words, and it is why this module exists: before it, the Ask shell
 * had NINE catalogues behind `AskR2Locale = 'en' | 'pl'` and a tenth seven-locale catalogue
 * for the hero, so a French reader got a French hero over an English application.
 *
 * There is no second interface locale here. A surface asks for the reader's locale and gets
 * the whole shell in it, as far as the shell has been authored — and exactly how far that is
 * is reported, never guessed.
 *
 * ── THE THREE QUALIFICATIONS, AND WHY THEY ARE SEPARATE ───────────────────
 *
 *   `SOURCE`                  English and Polish. Fully authored catalogues that predate
 *                             this mechanism and are already qualified. Read directly; the
 *                             overlay path is not used, so shipped EN/PL copy cannot move.
 *   `CLAUDE_L_QUALIFIED`      wording Claude L has delivered.
 *   `DRAFT_PENDING_CLAUDE_L`  H's own drafts. Present so the shell can be wired, tested and
 *                             proven, never presented as finished translation.
 *
 * The CTO's instruction was explicit: *"Do not silently label H-authored machine/draft
 * translations as linguistically qualified."* Which is why qualification is a per-LOCALE and
 * per-KEY fact this module reports, rather than a comment in a file nobody runs.
 */

const OVERLAYS: Readonly<Partial<Record<DisplayLocale, ShellLocaleOverlay>>> = Object.freeze({
  fr: frShellOverlay,
  de: deShellOverlay,
  es: esShellOverlay,
  pt: ptShellOverlay,
  ar: arShellOverlay,
});

/**
 * THE LOCALES WHOSE OVERLAY CONTENT IS CLAUDE L'S QUALIFIED WORDING.
 *
 * ── WHAT CHANGED WHEN L DELIVERED, AND WHY THE SHAPE OF THIS CHANGED TOO ──
 *
 * These five were `ASK_SHELL_DRAFT_LOCALES` while their overlays held H's drafts. L has now
 * delivered, every H draft string has been REPLACED rather than kept alongside, and the
 * draft list is empty — which is the evidence for the ruling's step 3 ("remove corresponding
 * `DRAFT_PENDING_CLAUDE_L` entries") rather than a claim about it.
 *
 * But "qualified" and "complete" are not the same fact, and collapsing them is exactly the
 * kind of thing that lets an incomplete surface look finished:
 *
 *   QUALIFIED   every string this locale renders from its overlay is L's wording. True of
 *               all five today — no H draft survives in any overlay file.
 *   COMPLETE    every reachable key has one. NOT true of any of the five: L worked from
 *               manifest Revision 2 and 144 keys per locale are outside it, so those keys
 *               still fall through to English.
 *
 * `askShellCoverage(locale)` reports both, and a key with no qualified wording is absent
 * from the overlay rather than filled with a draft — so it is REPORTED by `shellFallbacks()`
 * instead of a reader meeting an unreviewed sentence that looks finished.
 */
export const ASK_SHELL_L_QUALIFIED_LOCALES: readonly DisplayLocale[] = Object.freeze([
  'fr',
  'de',
  'es',
  'pt',
  'ar',
] as const);

/**
 * Locales still carrying H-authored draft strings. EMPTY since L delivered, and kept as a
 * list rather than deleted because a future round that needs a draft to wire a surface must
 * declare it here, where `askShellQualification` and the acceptance spec can both see it.
 */
export const ASK_SHELL_DRAFT_LOCALES: readonly DisplayLocale[] = Object.freeze([] as const);

/** English and Polish: authored catalogues, not overlays. */
export const ASK_SHELL_SOURCE_LOCALES: readonly DisplayLocale[] = Object.freeze([
  'en',
  'pl',
] as const);

/**
 * What the wording in this locale IS — not how much of it there is.
 *
 * A locale is `CLAUDE_L_QUALIFIED` when every string it renders from its overlay came from
 * Claude L, whether or not the overlay covers every key. Coverage is the separate question
 * `askShellCoverage(locale).complete` answers, and the two are deliberately not merged: a
 * locale that is qualified but incomplete falls back to ENGLISH on the keys it lacks, which
 * is a different and more honest failure than rendering an unreviewed draft.
 */
export function askShellQualification(locale: DisplayLocale): ShellQualification {
  if (ASK_SHELL_SOURCE_LOCALES.includes(locale)) return 'SOURCE';
  if (ASK_SHELL_DRAFT_LOCALES.includes(locale)) return 'DRAFT_PENDING_CLAUDE_L';
  return 'CLAUDE_L_QUALIFIED';
}

/**
 * The whole Ask shell in one locale.
 *
 * Polish is read from its own catalogues (see `askShellPolish`); every other non-English
 * locale is the English source with that locale's overlay merged over it. A locale with no
 * overlay is English — reported, not hidden.
 */
export function askShellStrings(locale: DisplayLocale): AskShellSource {
  if (locale === 'en') return askShellSource();
  if (locale === 'pl') return askShellPolish();
  /*
    R4 · CTO BRAND RULING — the canonical name is re-projected AFTER the merge. L's delivery
    carries the dictionary's own "Ask GlobalNews AI" spelling for the dock title, which she
    correctly left untranslated; without this the overlay would reintroduce a second spelling
    of a name the ruling says has exactly one.
  */
  return brandCanonical(mergeShell(askShellSource(), OVERLAYS[locale], locale));
}

/**
 * R4 + EAST AFRICA CONVERGENCE · CTO SINGLE-SOURCE RULING — the Ask-reachable strings OUTSIDE the
 * shell tree (Claude L's R6 additive delivery: product-dictionary keys an Ask surface renders, and
 * the comparison-coverage templates), read from the SAME locale overlay files through this SAME
 * module. EN/PL have none: their catalogues are authored. A locale without an `additive` block is
 * English for those keys, which the rendered-surface acceptance test reports.
 */
export function askShellAdditive(locale: DisplayLocale): ShellAdditiveOverlay | undefined {
  return OVERLAYS[locale]?.additive;
}

/**
 * THE WORDMARK — one canonical name, in every locale.
 *
 * R4 · CTO BRAND RULING. This read the name out of the per-locale catalogue, which was
 * correct while the name was a catalogue entry and is exactly what let three authorities give
 * three different answers. It now returns the one constant, and `askShellSource` projects the
 * same constant over the catalogue keys, so the header and the catalogue cannot disagree
 * whichever one a surface happens to read.
 *
 * Still a function of the locale: callers hold one, and the signature keeps them honest about
 * what varies. `ASK_BRAND_KEYS` is the list that would follow if a ruling ever changed it.
 */
export function askProductName(locale: DisplayLocale): string {
  return askProductNameFor(locale);
}

/* ────────────────────────────────────────────────────────────────────────────
   COVERAGE — the number the CTO asked to be able to see
   ──────────────────────────────────────────────────────────────────────────── */

export interface AskShellCoverage {
  readonly locale: DisplayLocale;
  readonly qualification: ShellQualification;
  /** Every reader-visible key in the Ask shell. The manifest's own denominator. */
  readonly totalKeys: number;
  /** Keys this locale renders in its own language. */
  readonly localizedKeys: number;
  /** Provider and product names, which no locale translates. */
  readonly properNouns: number;
  /** Keys that fall through to English, by path. Declared, never silent. */
  readonly fallbacks: readonly string[];
  /** True only when nothing falls through. */
  readonly complete: boolean;
}

/** Every reader-visible key path in the Ask shell, in `shellKeyPaths` form. */
export function askShellKeyPaths(): readonly string[] {
  return shellKeyPaths(askShellSource());
}

export function askShellCoverage(locale: DisplayLocale): AskShellCoverage {
  const source = askShellSource();
  const total = shellKeyPaths(source);
  const properNouns = total.filter((path) =>
    ASK_SHELL_PROPER_NOUNS.includes(shellPathWithoutMarker(path)),
  );
  /*
    EN and PL are authored catalogues, so "what fell through" is not a question about an
    overlay: it is answered by the catalogue itself, and both are complete.
  */
  const fallbacks = ASK_SHELL_SOURCE_LOCALES.includes(locale)
    ? []
    : shellFallbacks(source, OVERLAYS[locale]).filter(
        (path) => !ASK_SHELL_PROPER_NOUNS.includes(shellPathWithoutMarker(path)),
      );
  return {
    locale,
    qualification: askShellQualification(locale),
    totalKeys: total.length,
    localizedKeys: total.length - properNouns.length - fallbacks.length,
    properNouns: properNouns.length,
    fallbacks,
    complete: fallbacks.length === 0,
  };
}

/** Coverage for all seven, in the shared contract's order. */
export function askShellCoverageAll(): readonly AskShellCoverage[] {
  return SHELL_LOCALES.map(askShellCoverage);
}

/**
 * The template keys among the shell's paths.
 *
 * Exposed because a template is the one kind of key a reviewer cannot eyeball in a
 * screenshot: its wording only appears for particular argument values, and its plural
 * behaviour only appears for particular counts.
 */
export function askShellTemplatePaths(): readonly string[] {
  return askShellKeyPaths().filter(isShellTemplatePath);
}
