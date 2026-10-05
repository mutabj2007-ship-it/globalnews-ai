import type { DisplayLocale } from '@globalnews-ai/shared';
import { getDictionary, type Dictionary } from '@/lib/i18n/dictionaries';
import { askShellStrings } from './askShellCatalogue';
import { ASK_DICTIONARY_ADDITIONS } from './askDictionaryAdditions';
import {
  ASK_DICTIONARY_ADDITIONS_L_R6,
  ASK_DICTIONARY_CANONICAL_ALIASES,
} from './askDictionaryAdditionsL';

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
 *                   shell: C55 reuse (askDictionaryAdditions.ts) and Claude L's R6 delivery
 *                   (askDictionaryAdditionsL.ts) — each value L-qualified, never authored here
 *                 · seven keys whose English is byte-identical to an already-qualified shell key,
 *                   resolved FROM that shell key (ASK_DICTIONARY_CANONICAL_ALIASES): one
 *                   authority, not a further copy
 * Anything neither supplies keeps English and is FOUND by the rendered-surface acceptance test
 * (askRenderedLocale.*.acceptance.spec.ts), which is the language acceptance authority.
 *
 * The platform / Home paths keep calling `getDictionary` and are untouched.
 */
export function askDictionary(locale: DisplayLocale): Dictionary {
  if (locale === 'en' || locale === 'pl') return getDictionary(locale);
  const shell = askShellStrings(locale);
  const withShell = merge(getDictionary('en'), shell.dict);
  const withC55 = merge(withShell, ASK_DICTIONARY_ADDITIONS[locale] ?? {});
  const withL = merge(withC55, ASK_DICTIONARY_ADDITIONS_L_R6[locale] ?? {});
  const aliased: Record<string, unknown> = {};
  for (const [key, shellKey] of Object.entries(ASK_DICTIONARY_CANONICAL_ALIASES)) {
    const value = valueAt(shell, shellKey);
    if (typeof value === 'string') setAt(aliased, key, value);
  }
  return merge(withL, aliased) as Dictionary;
}

const valueAt = (tree: unknown, path: string): unknown =>
  path
    .split('.')
    .reduce<unknown>(
      (node, key) =>
        node !== null && typeof node === 'object'
          ? (node as Record<string, unknown>)[key]
          : undefined,
      tree,
    );

function setAt(tree: Record<string, unknown>, path: string, value: unknown): void {
  const keys = path.split('.');
  let node = tree;
  for (const key of keys.slice(0, -1)) {
    if (!isPlain(node[key])) node[key] = {};
    node = node[key] as Record<string, unknown>;
  }
  node[keys[keys.length - 1]] = value;
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
