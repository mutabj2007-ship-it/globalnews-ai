import type { DisplayLocale } from '@globalnews-ai/shared';

/**
 * T2 · THE /history CATALOGUE — ENGLISH ONLY, AND DECLARED AS SUCH.
 *
 * `/history` rendered five hard-coded English strings to every reader in every language, with no
 * notice. The strings are moved here VERBATIM (English output is byte-identical) so the surface
 * reads them through a catalogue the effective-locale rule can measure.
 *
 * No other locale is authored here on purpose: T2 does not translate application copy. Every
 * other locale is listed in the translation work manifest for Claude L, and until it arrives the
 * effective-locale rule renders `/history` in English WITH the declared fallback notice in the
 * reader's selected language — a declared state instead of a silent one.
 */
export interface HistoryStrings {
  readonly title: string;
  readonly signedOut: string;
  readonly empty: string;
  readonly clear: string;
}

const en: HistoryStrings = {
  title: 'History',
  signedOut: 'Sign in to see your saved question history.',
  empty: "You haven't asked any questions yet.",
  clear: 'Clear history',
};

/** Authored content only. A locale absent here is REPORTED by the coverage registry. */
export const HISTORY_CATALOGUE: Readonly<Partial<Record<DisplayLocale, HistoryStrings>>> = { en };

export function historyStrings(locale: DisplayLocale): HistoryStrings {
  return HISTORY_CATALOGUE[locale] ?? en;
}
