/**
 * ════════════════════════════════════════════════════════════════════════════
 * T2 · KEYS THAT ARE COMPLETE IN EVERY LOCALE WITHOUT A TRANSLATION
 * ════════════════════════════════════════════════════════════════════════════
 *
 * A key counts as complete for a locale when it is translated, or when it is declared here:
 *
 *   NOT_TRANSLATED_BY_DESIGN  a brand or proper noun. The product name ("GlobalNews AI",
 *                             "Ask GlobalNewsAI" — canonical in all seven by the CTO brand
 *                             ruling), provider and institution names. Localize the surrounding
 *                             UI, never the name.
 *   QUALIFIED_UNCHANGED       a protocol token a reader reads aloud and types back (probe
 *                             statuses, window labels, readout codes, symbols). The localisation
 *                             lane's catalogue rule — "IDENTIFIERS ARE NOT TRANSLATED" — and every
 *                             one of these is also unchanged in all five recovered L-LANG-CATALOG-1
 *                             catalogues (measured by the reconciliation script).
 *
 * Declaring a key here is a claim about the KEY, so it applies to all seven locales. A key whose
 * value is ordinary prose must never be declared here to make a surface look complete:
 * `catalogueCoverage.spec.ts` asserts every declared key's English value matches the identifier
 * shape below, and the dossier lists every entry.
 *
 * Keys are main-dictionary leaf paths (the shape `leafPaths()` in catalogueCoverage.ts produces).
 */
export type DeclaredKeyState = 'NOT_TRANSLATED_BY_DESIGN' | 'QUALIFIED_UNCHANGED';

export const DICTIONARY_DECLARED_KEY_STATES: Readonly<Record<string, DeclaredKeyState>> = {
  /* Brand and proper nouns. */
  'admin.brand.name': 'NOT_TRANSLATED_BY_DESIGN',
  'admin.brand.accent': 'NOT_TRANSLATED_BY_DESIGN',
  'map.spatial.topBar.brand': 'NOT_TRANSLATED_BY_DESIGN',
  'footer.linkLabels./api': 'NOT_TRANSLATED_BY_DESIGN',
  'admin.screens.payments.tabs.ksef': 'NOT_TRANSLATED_BY_DESIGN',
  'admin.screens.settings.groups.ksef': 'NOT_TRANSLATED_BY_DESIGN',

  /* Protocol tokens, window labels, readout codes and symbols. */
  'admin.states.unknown': 'QUALIFIED_UNCHANGED',
  'admin.states.notImplemented': 'QUALIFIED_UNCHANGED',
  'admin.states.unavailable': 'QUALIFIED_UNCHANGED',
  'admin.screens.overview.windows.h24': 'QUALIFIED_UNCHANGED',
  'admin.screens.overview.windows.d7': 'QUALIFIED_UNCHANGED',
  'admin.screens.overview.windows.d30': 'QUALIFIED_UNCHANGED',
  'admin.screens.payments.ksefStatusValue': 'QUALIFIED_UNCHANGED',
  'admin.screens.systemHealth.statuses.HEALTHY': 'QUALIFIED_UNCHANGED',
  'admin.screens.systemHealth.statuses.DEGRADED': 'QUALIFIED_UNCHANGED',
  'admin.screens.systemHealth.statuses.FAILING': 'QUALIFIED_UNCHANGED',
  'admin.screens.systemHealth.statuses.UNKNOWN': 'QUALIFIED_UNCHANGED',
  'admin.screens.systemHealth.statuses.NOT_IMPLEMENTED': 'QUALIFIED_UNCHANGED',
  'analysisWorkspace.uncountable': 'QUALIFIED_UNCHANGED',
  'map.spatial.topBar.periods.24H': 'QUALIFIED_UNCHANGED',
  'map.spatial.topBar.periods.7D': 'QUALIFIED_UNCHANGED',
  'map.spatial.topBar.periods.30D': 'QUALIFIED_UNCHANGED',
  'map.spatial.readout.zoom': 'QUALIFIED_UNCHANGED',
  'map.spatial.readout.centre': 'QUALIFIED_UNCHANGED',
  'map.spatial.readout.periods.24H': 'QUALIFIED_UNCHANGED',
  'map.spatial.readout.periods.7D': 'QUALIFIED_UNCHANGED',
  'map.spatial.readout.periods.30D': 'QUALIFIED_UNCHANGED',
  'map.spatial.monetization.composer.neverRun': 'QUALIFIED_UNCHANGED',
  'map.spatial.monetization.composer.instMark': 'QUALIFIED_UNCHANGED',
  'map.spatial.monetization.timeline.proMark': 'QUALIFIED_UNCHANGED',
  'map.spatial.monetization.deck.tierMark.PROFESSIONAL': 'QUALIFIED_UNCHANGED',
  'map.spatial.monetization.deck.tierMark.INSTITUTIONAL': 'QUALIFIED_UNCHANGED',
};

/**
 * The identifier shape a declared key's ENGLISH value must have: a short token of capitals,
 * digits, unit letters and symbols, or one of the named brands. Prose cannot match.
 */
export const DECLARED_BRANDS: readonly string[] = [
  'GlobalNews',
  'AI',
  'GlobalNews AI',
  'GlobalNewsAI',
  'Ask GlobalNewsAI',
  'API',
  'KSeF',
];

export function looksLikeIdentifier(value: string): boolean {
  if (DECLARED_BRANDS.includes(value)) return true;
  return value.length <= 16 && /^[A-Z0-9 _.\-—·%]*[A-Z0-9—·%][A-Z0-9 _.\-—·%hd]*$/.test(value);
}
