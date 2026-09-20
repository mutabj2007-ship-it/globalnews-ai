/**
 * ════════════════════════════════════════════════════════════════════════════
 * THE RETURN CONTROL'S OWN VOCABULARY — DELIBERATELY SELF-CONTAINED
 * ════════════════════════════════════════════════════════════════════════════
 *
 * WHY THIS IS NOT IN `lib/i18n/dictionaries`. It was, first, and that was
 * measurably wrong. The shared return control is hosted on the SPECIALIST
 * surfaces, and every one of those surfaces carries a sealed-closure guard:
 *
 *   politicsVisualFrame.spec  "reaches exactly N modules outside its own tree"
 *   politicsVisualFrame.spec  "nothing in the reachable graph performs a
 *                              network call"
 *   securityVisualFrame.spec  "no provider or AI name appears in the graph"
 *
 * Importing `getDictionary` pulls `en.ts`, `pl.ts`, `adminEn`, `adminPl`,
 * `supportEn` and `supportPl` into every specialist surface's dependency
 * closure. Those files legitimately contain `https://` literals and provider
 * names, so the surfaces' own provider-reachability guards fired — correctly.
 * The guards were right; hanging the product dictionary off a chrome control
 * was the mistake.
 *
 * SO THE VOCABULARY IS LOCAL, TINY AND HAS NO IMPORTS. Six strings in two
 * languages cost less than the coupling they replace, and a specialist surface
 * that renders a return control now reaches four small navigation modules
 * instead of the entire product string table.
 *
 * THE LANGUAGE SET MATCHES THE PRODUCT'S ACTIVE SET (`en`, `pl`). Surfaces
 * whose own locale type is wider — Economy's `DisplayLocale` admits `de`, `pt`
 * and `ar` — resolve to English here, which is what the product does elsewhere
 * for a locale it has no translation for.
 */

export interface ReturnStrings {
  /** Visible label when a product page is behind the reader. */
  label: string;
  /** Visible label when there is not — the control offers the root instead. */
  homeName: string;
  /** Accessible name for the back branch. Never abbreviated. */
  ariaLabelBack: string;
  /** Accessible name for the fallback branch. Never abbreviated. */
  ariaLabelHome: string;
  /** Accessible name when the press clears a sub-state instead of navigating. */
  ariaLabelClearSelection: string;
}

const EN: ReturnStrings = {
  label: 'Back',
  homeName: 'Home',
  ariaLabelBack: 'Go back to the previous page',
  ariaLabelHome: 'Go to GlobalNews AI home',
  ariaLabelClearSelection: 'Clear the selected country and stay on the map',
};

const PL: ReturnStrings = {
  label: 'Wstecz',
  homeName: 'Strona główna',
  ariaLabelBack: 'Wróć do poprzedniej strony',
  ariaLabelHome: 'Przejdź do strony głównej GlobalNews AI',
  ariaLabelClearSelection: 'Wyczyść wybrany kraj i pozostań na mapie',
};

/**
 * Resolves any surface's locale to the return vocabulary.
 *
 * Total by construction: every input returns a complete `ReturnStrings`, so the
 * control can never render with a missing label. A locale the product does not
 * translate resolves to English rather than throwing — an English label on a
 * working control beats a crash or a dead affordance.
 */
export function returnStringsFor(locale: string): ReturnStrings {
  return locale === 'pl' ? PL : EN;
}

/** The locales this vocabulary genuinely translates, for the guard to assert. */
export const TRANSLATED_RETURN_LOCALES = ['en', 'pl'] as const;
