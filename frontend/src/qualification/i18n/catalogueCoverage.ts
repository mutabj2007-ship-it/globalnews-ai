import { DISPLAY_LOCALES, type DisplayLocale } from '@globalnews-ai/shared';
import { en as dictionaryEn } from '@/lib/i18n/dictionaries/en';
import { pl as dictionaryPl } from '@/lib/i18n/dictionaries/pl';
import { QUALIFIED_DICTIONARY_OVERLAYS } from '@/lib/i18n/qualifiedDictionaryOverlays';
import { DICTIONARY_DECLARED_KEY_STATES } from '@/lib/i18n/declaredKeyStates';
import { conflictStrings } from '@/lib/conflict/strings';
import { deliveryStrings } from '@/lib/delivery/deliveryStrings';
import { electionStrings } from '@/lib/election/electionStrings';
import { ENERGY_LOCALES, energyStrings } from '@/lib/energy/energyStrings';
import { resolveEconomyStrings, retainedEconomyStrings } from '@/lib/economy/strings';
import { resolveHumStrings } from '@/lib/humanitarian/humStrings';
import { resolveMktStrings } from '@/lib/market/mktStrings';
import { resolvePolStrings } from '@/lib/politics/politicsStrings';
import { resolveSecStrings } from '@/lib/security/securityStrings';
import { getFailureCopy } from '@/lib/i18n/failureCopy';
import { returnStringsFor } from '@/lib/navigation/returnStrings';
import { COOKIES_PAGE } from '@/lib/privacy/cookiesPageStrings';
import { TRUST_REASON_LABELS, TRUST_REASON_LABELS_PL } from '@/lib/trustReasonLabels';
import { briefingStrings } from '@/lib/ask/briefingStrings';
import { askShellCoverage, askShellKeyPaths } from '@/lib/ask/shell/askShellCatalogue';
import { askSevenStrings } from '@/lib/ask/askSevenStrings';
import { HISTORY_CATALOGUE } from '@/lib/history/historyStrings';
import { ECONOMY_INLINE_ENGLISH } from '@/lib/economy/economyInlineInventory';
import { FALLBACK_NOTICE } from '@/lib/i18n/fallbackNotice';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * T2 · CATALOGUE COVERAGE — WHICH LOCALES EACH NAMESPACE CAN RENDER COMPLETELY
 * ════════════════════════════════════════════════════════════════════════════
 *
 * The effective-locale rule (surfaceLocale.ts) asks one question of every namespace a surface
 * uses: "is this namespace complete for locale L?". This module answers it by MEASURING, never by
 * a hand-written list:
 *
 *   gaps(ns, L) = every English leaf key of `ns` that L's catalogue does not carry as a
 *                 non-empty value AND that is not declared QUALIFIED_UNCHANGED /
 *                 NOT_TRANSLATED_BY_DESIGN (declaredKeyStates.ts).
 *   complete    = gaps is empty.
 *
 * English is the source of every catalogue and is complete by definition.
 *
 * NAMESPACES. The main dictionary (`getDictionary`) is split into one namespace per top-level
 * object (`dict:navBar`, `dict:map`, …) plus `dict:root` for its flat keys, so a surface can
 * become complete in a locale as soon as the namespaces IT uses are — not only when all 2,800
 * keys are. Every other catalogue module is one namespace. The Ask shell is H's, measured by
 * H's own `askShellCoverage` (consumed, not re-implemented).
 *
 * THE MAIN DICTIONARY FOR fr/de/es/pt/ar is `QUALIFIED_DICTIONARY_OVERLAYS` — Claude L's
 * qualified wording only. The recovered C55 catalogues are NOT read here: their English source
 * text is not carried, so their provenance cannot be established (see the T2 dossier and
 * docs/convergence/stage2/t2/translation-manifest.json).
 */

type Tree = { readonly [key: string]: unknown };

const isPlural = (value: unknown): boolean =>
  value !== null && typeof value === 'object' && !Array.isArray(value) && 'other' in (value as Tree);

/** Leaf paths of a catalogue tree. Strings, functions, arrays and plural records are leaves. */
export function leafEntries(tree: unknown, prefix = ''): Map<string, unknown> {
  const out = new Map<string, unknown>();
  if (tree === null || typeof tree !== 'object' || Array.isArray(tree)) return out;
  for (const [key, value] of Object.entries(tree as Tree)) {
    const path = prefix === '' ? key : `${prefix}.${key}`;
    if (typeof value === 'string' || typeof value === 'function' || Array.isArray(value) || isPlural(value)) {
      out.set(path, value);
    } else if (value !== null && typeof value === 'object') {
      for (const [p, v] of leafEntries(value, path)) out.set(p, v);
    } else if (value !== undefined) {
      /* `null` is kept: an explicit null in a locale tree is a deliberate "not used in this
         locale" (e.g. energy's Polish `metaRecencyDayUnit`, by L's template), not a gap. */
      out.set(path, value);
    }
  }
  return out;
}

/**
 * A leaf carries a value: a non-empty string, a function, a non-empty array, a plural record —
 * or an explicit `null` (a deliberate by-design absence in that locale). `undefined` (the key is
 * not there) is a gap.
 */
export function hasValue(value: unknown): boolean {
  if (value === undefined) return false;
  if (value === null) return true;
  if (typeof value === 'string') return value.trim().length > 0;
  if (typeof value === 'function') return true;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'number' || typeof value === 'boolean') return true;
  return value !== null && typeof value === 'object';
}

/** English leaves that carry something a translator would translate. */
function hasTranslatableText(value: unknown): boolean {
  return value !== null && hasValue(value);
}

export type NamespaceKind = 'DICTIONARY' | 'MODULE' | 'ASK_SHELL';

export interface NamespaceCoverage {
  readonly id: string;
  readonly kind: NamespaceKind;
  /** The file a translator edits. */
  readonly source: string;
  /** English leaf key paths (relative to the namespace). */
  englishKeys(): readonly string[];
  /** English text for a key (for the translation manifest). */
  englishText(key: string): unknown;
  /** Keys with no qualified value and no declared state, for `locale`. */
  gaps(locale: DisplayLocale): readonly string[];
}

/* ─────────────────────────── the main dictionary ─────────────────────────── */

const DICTIONARY_SOURCE = 'frontend/src/lib/i18n/dictionaries/{en,pl,adminEn,adminPl,supportEn,supportPl,myIntelligenceEn,myIntelligencePl,homeR1En,homeR1Pl,homeRevaEn,homeRevaPl}.ts';

const dictionaryEnglish = new Map(
  [...leafEntries(dictionaryEn)].filter(([, value]) => hasTranslatableText(value)),
);

function dictionaryTreeFor(locale: DisplayLocale): unknown {
  if (locale === 'en') return dictionaryEn;
  if (locale === 'pl') return dictionaryPl;
  return QUALIFIED_DICTIONARY_OVERLAYS[locale] ?? {};
}

const dictionaryLeavesByLocale = new Map<DisplayLocale, Map<string, unknown>>();
function dictionaryLeaves(locale: DisplayLocale): Map<string, unknown> {
  let leaves = dictionaryLeavesByLocale.get(locale);
  if (leaves === undefined) {
    leaves = leafEntries(dictionaryTreeFor(locale));
    dictionaryLeavesByLocale.set(locale, leaves);
  }
  return leaves;
}

/** `dict:root` for flat top-level keys, `dict:<key>` for each top-level object. */
export function dictionaryNamespaceOf(path: string): string {
  const dot = path.indexOf('.');
  return dot === -1 ? 'dict:root' : `dict:${path.slice(0, dot)}`;
}

function dictionaryNamespace(id: string): NamespaceCoverage {
  const keys = [...dictionaryEnglish.keys()].filter((path) => dictionaryNamespaceOf(path) === id);
  return {
    id,
    kind: 'DICTIONARY',
    source: DICTIONARY_SOURCE,
    englishKeys: () => keys,
    englishText: (key) => dictionaryEnglish.get(key),
    gaps: (locale) => {
      if (locale === 'en') return [];
      const own = dictionaryLeaves(locale);
      return keys.filter(
        (key) => !hasValue(own.get(key)) && DICTIONARY_DECLARED_KEY_STATES[key] === undefined,
      );
    },
  };
}

/* ─────────────────────────── module catalogues ──────────────────────────── */

/**
 * A module catalogue: its English tree and, per locale, the tree it AUTHORS (undefined when the
 * module would serve English for that locale — the module's own fallback is not a translation).
 */
function moduleNamespace(
  id: string,
  source: string,
  english: unknown,
  authored: (locale: DisplayLocale) => unknown,
): NamespaceCoverage {
  const englishLeaves = leafEntries(english);
  /* An English leaf with nothing to translate (empty or null) can never be a gap. */
  const keys = [...englishLeaves.keys()].filter((key) => hasTranslatableText(englishLeaves.get(key)));
  const cache = new Map<DisplayLocale, readonly string[]>();
  return {
    id,
    kind: 'MODULE',
    source,
    englishKeys: () => keys,
    englishText: (key) => englishLeaves.get(key),
    gaps: (locale) => {
      if (locale === 'en') return [];
      const hit = cache.get(locale);
      if (hit !== undefined) return hit;
      const tree = authored(locale);
      const own = tree === undefined || tree === english ? new Map<string, unknown>() : leafEntries(tree);
      const result = keys.filter((key) => !hasValue(own.get(key)));
      cache.set(locale, result);
      return result;
    },
  };
}

const enPlOnly =
  <T,>(read: (locale: 'en' | 'pl') => T) =>
  (locale: DisplayLocale): T | undefined =>
    locale === 'en' || locale === 'pl' ? read(locale) : undefined;

const fellBackOr = (resolution: { strings: unknown; fellBack: boolean }): unknown =>
  resolution.fellBack ? undefined : resolution.strings;

const MODULES: readonly NamespaceCoverage[] = [
  moduleNamespace('conflict', 'frontend/src/lib/conflict/strings.ts', conflictStrings.en, (l) =>
    (conflictStrings as Partial<Record<DisplayLocale, unknown>>)[l],
  ),
  moduleNamespace('delivery', 'frontend/src/lib/delivery/deliveryStrings.ts', deliveryStrings('en'), enPlOnly(deliveryStrings)),
  moduleNamespace('election', 'frontend/src/lib/election/electionStrings.ts', electionStrings('en'), enPlOnly(electionStrings)),
  moduleNamespace('energy', 'frontend/src/lib/energy/energyStrings.ts', energyStrings('en'), (l) =>
    (ENERGY_LOCALES as readonly string[]).includes(l) ? energyStrings(l) : undefined,
  ),
  moduleNamespace('economy', 'frontend/src/lib/economy/strings.ts', resolveEconomyStrings('en').strings, (l) =>
    fellBackOr(resolveEconomyStrings(l)),
  ),
  moduleNamespace('economyRetained', 'frontend/src/lib/economy/strings.ts#retainedCopy', retainedEconomyStrings('en'), (l) =>
    retainedEconomyStrings(l),
  ),
  moduleNamespace('economyInline', 'frontend/src/lib/economy/economyInlineInventory.ts (inline literals)', ECONOMY_INLINE_ENGLISH, () =>
    undefined,
  ),
  moduleNamespace('humanitarian', 'frontend/src/lib/humanitarian/humStrings.ts', resolveHumStrings('en').strings, (l) =>
    fellBackOr(resolveHumStrings(l)),
  ),
  moduleNamespace('market', 'frontend/src/lib/market/mktStrings.ts', resolveMktStrings('en').strings, (l) =>
    fellBackOr(resolveMktStrings(l)),
  ),
  moduleNamespace('politics', 'frontend/src/lib/politics/politicsStrings.ts', resolvePolStrings('en').strings, (l) =>
    fellBackOr(resolvePolStrings(l)),
  ),
  moduleNamespace('security', 'frontend/src/lib/security/securityStrings.ts', resolveSecStrings('en').strings, (l) =>
    fellBackOr(resolveSecStrings(l)),
  ),
  moduleNamespace('failureCopy', 'frontend/src/lib/i18n/failureCopy.ts', getFailureCopy('en'), enPlOnly(getFailureCopy)),
  moduleNamespace('returnStrings', 'frontend/src/lib/navigation/returnStrings.ts', returnStringsFor('en'), enPlOnly(returnStringsFor)),
  moduleNamespace('cookiesPage', 'frontend/src/lib/privacy/cookiesPageStrings.ts', COOKIES_PAGE.en, (l) =>
    (COOKIES_PAGE as Partial<Record<DisplayLocale, unknown>>)[l],
  ),
  moduleNamespace('trustReasons', 'frontend/src/lib/trustReasonLabels.ts', TRUST_REASON_LABELS, (l) =>
    l === 'pl' ? TRUST_REASON_LABELS_PL : undefined,
  ),
  moduleNamespace('briefing', 'frontend/src/lib/ask/briefingStrings.ts', briefingStrings('en'), enPlOnly(briefingStrings)),
  moduleNamespace('askSeven', 'frontend/src/lib/ask/askSevenStrings.ts (H)', askSevenStrings('en'), (l) => askSevenStrings(l)),
  moduleNamespace('history', 'frontend/src/lib/history/historyStrings.ts', HISTORY_CATALOGUE.en, (l) => HISTORY_CATALOGUE[l]),
  moduleNamespace('fallbackNotice', 'frontend/src/lib/i18n/fallbackNotice.ts', FALLBACK_NOTICE.en, (l) => FALLBACK_NOTICE[l]),
];

/* ─────────────────────────── the Ask shell (H) ──────────────────────────── */

/** H's measurement, consumed as-is: `askShellCoverage(locale).fallbacks` IS the gap list. */
const ASK_SHELL: NamespaceCoverage = {
  id: 'askShell',
  kind: 'ASK_SHELL',
  source: 'frontend/src/lib/ask/shell/locales/*.ts (H+R4; Claude L wording)',
  englishKeys: () => askShellKeyPaths(),
  englishText: () => undefined,
  gaps: (locale) => (locale === 'en' ? [] : askShellCoverage(locale).fallbacks),
};

/* ─────────────────────────── the registry ───────────────────────────────── */

const DICTIONARY_NAMESPACE_IDS: readonly string[] = [
  ...new Set([...dictionaryEnglish.keys()].map(dictionaryNamespaceOf)),
].sort();

export const NAMESPACES: ReadonlyMap<string, NamespaceCoverage> = new Map(
  [...DICTIONARY_NAMESPACE_IDS.map(dictionaryNamespace), ...MODULES, ASK_SHELL].map((ns) => [ns.id, ns]),
);

export function namespaceIds(): readonly string[] {
  return [...NAMESPACES.keys()];
}

export function dictionaryNamespaceIds(): readonly string[] {
  return DICTIONARY_NAMESPACE_IDS;
}

export function namespace(id: string): NamespaceCoverage {
  const ns = NAMESPACES.get(id);
  if (ns === undefined) throw new Error(`T2-COVERAGE-1: unknown catalogue namespace "${id}"`);
  return ns;
}

const completeCache = new Map<string, readonly DisplayLocale[]>();

/** The locales in which `id` is complete, in contract order. English always. */
export function completeLocalesOf(id: string): readonly DisplayLocale[] {
  const hit = completeCache.get(id);
  if (hit !== undefined) return hit;
  const ns = namespace(id);
  const result = DISPLAY_LOCALES.filter((locale) => ns.gaps(locale).length === 0);
  completeCache.set(id, result);
  return result;
}

export function isNamespaceComplete(id: string, locale: DisplayLocale): boolean {
  return completeLocalesOf(id).includes(locale);
}
