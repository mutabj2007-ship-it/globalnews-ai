import type { LanguageCode } from '@globalnews-ai/shared';

/**
 * Milestone #47 — Retrieval Language Strategy Resolver.
 *
 * Represents STRATEGY, not merely a language string: which languages
 * have native GNews Search support, which use the staged Polish
 * Top-Headlines-then-Search architecture, and which fall directly to a
 * configured English/French fallback because GNews supports neither
 * endpoint for that language. Verified directly against GNews's current
 * official documentation (docs.gnews.io/endpoints/search-endpoint and
 * .../top-headlines-endpoint), not assumed:
 *
 * - Search endpoint supports: en, fr, es, ar (among ~26 others) — does
 *   NOT support pl, sw, rw.
 * - Top Headlines endpoint supports: pl (among ~40 others) — does NOT
 *   support sw or rw.
 *
 * PRODUCTION STATUS: only 'en' and 'pl' strategies are actually
 * exercised by AnalysisService as of Milestone #47 (see
 * analysis.service.ts's generic branch). The strategies below for
 * 'fr'/'es'/'ar'/'sw'/'rw' are architecturally complete and tested in
 * isolation here, but not yet wired into AnalysisService's retrieval
 * orchestration — do not present them as production-supported.
 */

/** Native GNews Search support — no fallback needed. */
export interface NativeSearchStrategy {
  kind: 'native-search';
  lang: LanguageCode;
}

/**
 * Milestone #47 Polish architecture: GNews Top Headlines (which DOES
 * support pl and DOES support a `q` keyword filter, per current
 * official docs) is tried first; only on zero relevant evidence does
 * AnalysisService fall back to English Search. See
 * analysis.service.ts's Polish branch for the exact call sequence and
 * the explicit "never a third call" guard.
 */
export interface StagedTopHeadlinesThenSearchFallbackStrategy {
  kind: 'staged-top-headlines-then-search-fallback';
  primaryLang: LanguageCode;
  primaryEndpoint: 'top-headlines';
  fallbackLang: LanguageCode;
  fallbackEndpoint: 'search';
}

/**
 * For languages GNews supports on NEITHER endpoint (sw, rw as of this
 * milestone) — go directly to the configured fallback language's
 * Search, never attempting an unsupported-language call at all.
 */
export interface DirectSearchFallbackStrategy {
  kind: 'direct-search-fallback';
  fallbackLang: LanguageCode;
  /**
   * True only for languages where no repository/provider evidence
   * currently justifies preferring one fallback language over another
   * (Kinyarwanda: English vs. French). This is a factual disclosure,
   * never a claim that the chosen fallbackLang is inherently superior.
   */
  fallbackChoiceUnproven: boolean;
}

export type RetrievalStrategy =
  | NativeSearchStrategy
  | StagedTopHeadlinesThenSearchFallbackStrategy
  | DirectSearchFallbackStrategy;

/**
 * Milestone #47 — configurable, not hard-coded as a "correct" choice.
 * No repository or provider evidence currently distinguishes English
 * vs. French as the better Kinyarwanda fallback; this constant exists
 * so that decision can be revisited later without touching every call
 * site that depends on it.
 */
export const KINYARWANDA_FALLBACK_LANGUAGE: LanguageCode = 'en';

export function resolveRetrievalStrategy(language: LanguageCode): RetrievalStrategy {
  switch (language) {
    case 'en':
    case 'fr':
    case 'es':
    case 'ar':
      return { kind: 'native-search', lang: language };

    case 'pl':
      return {
        kind: 'staged-top-headlines-then-search-fallback',
        primaryLang: 'pl',
        primaryEndpoint: 'top-headlines',
        fallbackLang: 'en',
        fallbackEndpoint: 'search',
      };

    case 'sw':
      return {
        kind: 'direct-search-fallback',
        fallbackLang: 'en',
        fallbackChoiceUnproven: false,
      };

    case 'rw':
      return {
        kind: 'direct-search-fallback',
        fallbackLang: KINYARWANDA_FALLBACK_LANGUAGE,
        fallbackChoiceUnproven: true,
      };

    default: {
      // Exhaustiveness guard — if LanguageCode ever gains a member
      // without a corresponding strategy here, this is a compile error,
      // not a silent runtime fallback to a guessed strategy.
      const exhaustiveCheck: never = language;
      throw new Error(`No retrieval strategy defined for language: ${String(exhaustiveCheck)}`);
    }
  }
}
