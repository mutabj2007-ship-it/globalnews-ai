import type { DisplayLocale } from '@globalnews-ai/shared';

/**
 * T2 · THE MAIN DICTIONARY'S QUALIFIED OVERLAYS FOR FR / DE / ES / PT / AR — EMPTY TODAY.
 *
 * This is where Claude L's QUALIFIED wording for the main dictionary lands, one partial tree per
 * locale in the `en` dictionary's shape (`dictionaries/en.ts` key paths). It is deliberately
 * empty at T2:
 *
 *   - T2 does not translate application copy.
 *   - The recovered C55 catalogues (lib/i18n/recovered/) do not carry the English source text
 *     they were translated from, so for no key can it be established that the translation still
 *     matches today's English. Every surviving recovered value is therefore handed to Claude L as
 *     a CANDIDATE in docs/convergence/stage2/t2/reconciled/<locale>.json and
 *     docs/convergence/stage2/t2/translation-manifest.json — never wired here unqualified.
 *
 * A namespace becomes complete for a locale (and every surface using only complete namespaces
 * starts rendering in that locale, with `<html lang>`/`dir` following) the moment its keys are
 * present here. `getDictionary` will then serve the merged tree for that locale.
 */
export type DictionaryOverlay = { readonly [key: string]: unknown };

export const QUALIFIED_DICTIONARY_OVERLAYS: Readonly<
  Partial<Record<Exclude<DisplayLocale, 'en' | 'pl'>, DictionaryOverlay>>
> = Object.freeze({});
