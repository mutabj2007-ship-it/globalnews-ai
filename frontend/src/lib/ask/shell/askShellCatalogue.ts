import { type DisplayLocale } from '@globalnews-ai/shared';
import {
  SHELL_LOCALES,
  isShellTemplatePath,
  mergeShell,
  shellFallbacks,
  shellKeyPaths,
  shellPathWithoutMarker,
  type ShellLocaleOverlay,
  type ShellQualification,
} from '@/lib/ask/shell/askShellOverlay';
import {
  ASK_SHELL_PROPER_NOUNS,
  askShellPolish,
  askShellSource,
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
 * The locales whose overlay content is, today, H's draft rather than L's wording.
 *
 * Declared as a list rather than inferred from "is there an overlay", because the moment L
 * delivers one locale the other four must keep reporting honestly, and the difference has to
 * be visible in one place a reviewer can read.
 */
export const ASK_SHELL_DRAFT_LOCALES: readonly DisplayLocale[] = Object.freeze([
  'fr',
  'de',
  'es',
  'pt',
  'ar',
] as const);

/** English and Polish: authored catalogues, not overlays. */
export const ASK_SHELL_SOURCE_LOCALES: readonly DisplayLocale[] = Object.freeze([
  'en',
  'pl',
] as const);

export function askShellQualification(locale: DisplayLocale): ShellQualification {
  if (ASK_SHELL_SOURCE_LOCALES.includes(locale)) return 'SOURCE';
  return ASK_SHELL_DRAFT_LOCALES.includes(locale)
    ? 'DRAFT_PENDING_CLAUDE_L'
    : 'CLAUDE_L_QUALIFIED';
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
  return mergeShell(askShellSource(), OVERLAYS[locale], locale);
}

/**
 * THE WORDMARK — read from the frozen D25 title, in the reader's own language.
 *
 * It lives here rather than in `askNavStrings.ts`, where it used to, for one structural
 * reason: that file is a SOURCE catalogue and the shell source reads it, so importing the
 * resolver back into it would be a cycle. The property the original helper existed to
 * guarantee is unchanged and is the reason it is still a function — the wordmark is READ from
 * `askTitle` rather than copied, so the standalone header can never drift from the frozen
 * title.
 */
export function askProductName(locale: DisplayLocale): string {
  return askShellStrings(locale).askR2Strings.askTitle;
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
