import type { DisplayLocale } from '@globalnews-ai/shared';
import { getDictionary, type Dictionary } from '@/lib/i18n/dictionaries';
import { askShellStrings } from './askShellCatalogue';
import { ASK_DICTIONARY_ADDITIONS } from './askDictionaryAdditions';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * THE ASK DICTIONARY — ONE LOCALE AUTHORITY FOR EVERY REACHABLE ASK SURFACE
 * ════════════════════════════════════════════════════════════════════════════
 *
 * R4 · CTO "COMPLETE R4 LOCALIZATION CONVERGENCE". `getDictionary(language)` knows two
 * catalogues (en, pl) and silently answers English for everything else, and the legacy
 * `askLocaleForLegacyCatalogue` collapses de / pt to English before it is even asked. Surfaces
 * that read it — the sourced answer card, the account settings body, the theme control — showed
 * English chrome to French, German, Spanish, Portuguese and Arabic readers while Claude L's
 * qualified overlay held their words.
 *
 * This is the dictionary those surfaces read on the standalone Ask path, keyed by the reader's
 * DisplayLocale:
 *   en / pl     the released catalogues, unchanged
 *   fr … ar     the English source shape, with
 *                 · Claude L's qualified shell overlay for the namespaces it governs
 *                   (askShellStrings(locale).dict — the SAME values the Ask shell renders), and
 *                 · the additive, L-governed values for Ask-reachable keys outside the 535-key
 *                   shell (askDictionaryAdditions.ts — each value L-qualified, never authored here)
 * Anything neither supplies keeps English and is FOUND by the rendered-surface acceptance test
 * (askRenderedLocale.*.acceptance.spec.ts), which is the language acceptance authority.
 *
 * The platform / Home paths keep calling `getDictionary` and are untouched.
 */
export function askDictionary(locale: DisplayLocale): Dictionary {
  if (locale === 'en' || locale === 'pl') return getDictionary(locale);
  const withShell = merge(getDictionary('en'), askShellStrings(locale).dict) as Dictionary;
  return merge(withShell, ASK_DICTIONARY_ADDITIONS[locale] ?? {}) as Dictionary;
}

const isPlain = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === 'object' && !Array.isArray(v);

/** Plain objects merge key by key; any other value (string, array, function) replaces. */
function merge(base: unknown, over: unknown): unknown {
  if (!isPlain(base) || !isPlain(over)) return over === undefined ? base : over;
  const out: Record<string, unknown> = { ...base };
  for (const [k, v] of Object.entries(over)) out[k] = merge(base[k], v);
  return out;
}
