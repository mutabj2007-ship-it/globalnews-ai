import { DISPLAY_LOCALES, type DisplayLocale } from '@globalnews-ai/shared';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * THE PRODUCT NAME — ONE CONSTANT, NOT SEVEN TRANSLATED COPIES
 * ════════════════════════════════════════════════════════════════════════════
 *
 * R4 · CTO BRAND RULING. *"The canonical product name is `Ask GlobalNewsAI` in all seven
 * locales. Do not translate the brand itself. Localize the action/button and surrounding UI
 * copy. Prefer a single canonical brand constant rather than maintaining seven translated
 * brand copies."*
 *
 * ── WHAT THIS REPLACES, AND WHY A CONSTANT RATHER THAN A CATALOGUE KEY ────
 *
 * The product title was a per-locale catalogue entry, so it was seven strings that merely
 * happened to agree, and they stopped agreeing twice:
 *
 *   `askR2Strings.askTitle`  EN "Ask GlobalNewsAI"  ·  PL "Zapytaj GlobalNewsAI"
 *   H's Phase B drafts       "Interroger GlobalNewsAI", "GlobalNewsAI fragen", …
 *   Claude L's delivery      "Ask GlobalNewsAI" in all five — brand is brand
 *
 * Three different answers to one question, from three authorities, because the name was
 * stored somewhere a translator is asked to fill in. A key in a translation catalogue is an
 * INVITATION to translate; the only durable fix is to stop asking. So the name lives here,
 * every Ask surface reads this, and no locale can hold a different one.
 *
 * ── WHAT IS STILL LOCALIZED, WHICH IS ALMOST EVERYTHING ──────────────────
 *
 * The brand is the NOUN. The verb, the button, the aria-labels and the surrounding sentence
 * are all localized exactly as before — Polish keeps `Zapytaj` for the Ask action, French
 * keeps `Demander`, Arabic keeps `اسأل`. Nothing about this ruling makes a control read
 * English; it makes the product's NAME read the same everywhere, which is what a name is.
 */

/** The canonical product name. One spelling, no locale variants, never translated. */
export const ASK_PRODUCT_NAME = 'Ask GlobalNewsAI' as const;

/**
 * The product name, by locale.
 *
 * Takes a locale and ignores it ON PURPOSE rather than being a bare constant at every call
 * site: callers already hold a locale and the signature keeps them honest about what varies.
 * If a future ruling ever does give one market its own name, this is the one place it
 * changes, and `ASK_BRAND_KEYS` below is the list of keys that would need to follow.
 */
export function askProductNameFor(_locale: DisplayLocale): string {
  return ASK_PRODUCT_NAME;
}

/**
 * The catalogue keys that carry the product NAME rather than copy.
 *
 * They are projected from `ASK_PRODUCT_NAME` for every locale, and they are excluded from
 * Claude L's scope — asking a translator to render a brand is how the divergence started.
 * Enumerated rather than matched by substring: `askR2Strings.ask` is the VERB and must stay
 * localized, and a rule clever enough to tell the two apart by looking at the string would
 * be wrong the first time a locale's verb happened to contain the noun.
 */
export const ASK_BRAND_KEYS: readonly string[] = Object.freeze([
  'askR2Strings.askTitle',
  'dict.askAi.title',
  'dict.askAi.panelLabel',
]);

/** Asserted by the brand spec: the name is the same in every contracted locale. */
export const ASK_BRAND_LOCALES: readonly DisplayLocale[] = DISPLAY_LOCALES;
