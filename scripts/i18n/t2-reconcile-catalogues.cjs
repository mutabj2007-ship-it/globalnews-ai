#!/usr/bin/env node
/**
 * T2 · GLOBAL LANGUAGE FOUNDATION — recovered-catalogue reconciliation + translation work manifest.
 *
 * Usage (from the repo root):   node scripts/i18n/t2-reconcile-catalogues.cjs
 *
 * Writes (deterministically, sorted):
 *   docs/convergence/stage2/t2/reconciled/<fr|de|es|pt|ar>.json   per-locale reconciled catalogue
 *   docs/convergence/stage2/t2/translation-manifest.json           work manifest for Claude L
 *   docs/convergence/stage2/t2/reconciliation-summary.json         the counts the dossier quotes
 *   frontend/src/lib/i18n/surfaceRenderable.generated.ts           the RUNTIME surface table
 *                                                                  (measured here, read by surfaceLocale.ts)
 *
 * THE RULE (T2 brief §5). A recovered translation may be KEPT only if (a) its key still exists in
 * today's English AND (b) the English source text it was translated from is unchanged. The C55
 * catalogues (frontend/src/lib/i18n/recovered/) do NOT carry their English source, and the C55
 * snapshot `3db5a09` is not reachable from this repository, so (b) cannot be established for ANY
 * key. Every surviving recovered value is therefore PROVENANCE_UNKNOWN: it is handed to Claude L as
 * a CANDIDATE and is never wired into the runtime. Stale keys (absent from today's English) are
 * DROPPED. Nothing here translates anything.
 *
 * LINEAGE HINT (advisory only, for L's triage — not provenance). For each candidate the script
 * compares today's English with the English at this line's root commit (c9473e32, 2026-09-13,
 * "C907 R1 — Alpha-validation candidate (frozen)"):
 *   EN_UNCHANGED_SINCE_LINE_ROOT   same text at the line root and today
 *   EN_CHANGED_SINCE_LINE_ROOT     the text changed on this line — the candidate is likely stale
 *   KEY_ADDED_AFTER_LINE_ROOT      the key did not exist at the line root
 */
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const SRC = path.join(ROOT, 'frontend', 'src');
const OUT = path.join(ROOT, 'docs', 'convergence', 'stage2', 't2');
const LINE_ROOT = 'c9473e32';
const LOCALES = ['en', 'pl', 'fr', 'de', 'es', 'pt', 'ar'];
const RECOVERED_LOCALES = ['fr', 'de', 'es', 'pt', 'ar'];

function loader(srcRoot, sharedRoot) {
  return require(path.join(ROOT, 'node_modules', 'jiti'))(__filename, {
    alias: { '@/': srcRoot + '/', '@globalnews-ai/shared': sharedRoot },
    cache: false,
    requireCache: false,
    interopDefault: true,
  });
}

const jiti = loader(SRC, path.join(ROOT, 'shared', 'src'));
const load = (p) => jiti(path.join(SRC, p));

const coverage = load('qualification/i18n/catalogueCoverage.ts');
const surfaces = load('lib/i18n/surfaceLocale.ts');
const surfaceCoverage = load('qualification/i18n/surfaceCoverage.ts');
const declared = load('lib/i18n/declaredKeyStates.ts');
const recovered = load('lib/i18n/recovered/recoveredCatalogue.ts');
const { en: dictionaryEn } = load('lib/i18n/dictionaries/en.ts');
/* R4 + EA CONVERGENCE (preflight S4, CTO L ruling): the Ask scope's dictionary, whose fr–ar values
   are Claude L's (shell projection, R6 additive, C55 reuse). Read to CLASSIFY manifest gaps only. */
const { askDictionary } = load('lib/ask/shell/askDictionary.ts');
const unchanged = load('lib/ask/shell/askShellQualifiedUnchanged.ts');
/* L's declared QUALIFIED_UNCHANGED (a value she chose to leave identical to English), shell + R6. */
const askScopeUnchanged = (locale, key) =>
  [...unchanged.qualifiedUnchangedFor(locale), ...unchanged.additiveQualifiedUnchangedFor(locale)].includes(
    `dict.${key}`,
  );
const askScopeValue = (locale, key) =>
  key.split('.').reduce((n, k) => (n !== null && typeof n === 'object' ? n[k] : undefined), askDictionary(locale));

const leaves = coverage.leafEntries;
const serial = (v) =>
  typeof v === 'function' ? `[template] ${v.toString().replace(/\s+/g, ' ')}` : v;

/* ── the line-root English, for the lineage hint ───────────────────────── */
function lineRootEnglish() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 't2-lineroot-'));
  try {
    const tar = execFileSync('git', ['archive', LINE_ROOT, 'frontend/src/lib/i18n/dictionaries', 'shared/src'], {
      cwd: ROOT,
      maxBuffer: 64 * 1024 * 1024,
    });
    execFileSync('tar', ['-x', '-C', dir], { input: tar });
    const rootJiti = loader(path.join(dir, 'frontend', 'src'), path.join(dir, 'shared', 'src'));
    return leaves(rootJiti(path.join(dir, 'frontend/src/lib/i18n/dictionaries/en.ts')).en);
  } catch (error) {
    console.warn(`lineage hint unavailable (${String(error).split('\n')[0]})`);
    return null;
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

const english = new Map([...leaves(dictionaryEn)].filter(([, v]) => v !== null && coverage.hasValue(v)));
const rootEnglish = lineRootEnglish();
const same = (a, b) => JSON.stringify(serial(a)) === JSON.stringify(serial(b));
function lineage(key) {
  if (rootEnglish === null) return 'UNAVAILABLE';
  if (!rootEnglish.has(key)) return 'KEY_ADDED_AFTER_LINE_ROOT';
  return same(rootEnglish.get(key), english.get(key)) ? 'EN_UNCHANGED_SINCE_LINE_ROOT' : 'EN_CHANGED_SINCE_LINE_ROOT';
}

/* ── reconciliation of the recovered main/admin/support catalogues ─────── */
const summary = { t2Base: '266007c930e8293638bc7971670ee0264923c18c', lineRoot: LINE_ROOT, englishDictionaryLeaves: english.size, locales: {} };
fs.mkdirSync(path.join(OUT, 'reconciled'), { recursive: true });

const candidatesByLocale = {};
for (const locale of RECOVERED_LOCALES) {
  const own = leaves(recovered[locale]);
  const candidates = {};
  const dropped = [];
  const lineageCounts = {};
  for (const [key, value] of own) {
    if (!english.has(key)) {
      dropped.push(key);
      continue;
    }
    if (!coverage.hasValue(value) || value === null) continue;
    /* A declared key (QUALIFIED_UNCHANGED / NOT_TRANSLATED_BY_DESIGN) is complete without a value. */
    if (declared.DICTIONARY_DECLARED_KEY_STATES[key] !== undefined) continue;
    const hint = lineage(key);
    lineageCounts[hint] = (lineageCounts[hint] ?? 0) + 1;
    candidates[key] = { value: serial(value), status: 'PROVENANCE_UNKNOWN', lineage: hint };
  }
  const declaredKeys = Object.keys(declared.DICTIONARY_DECLARED_KEY_STATES).filter((k) => english.has(k));
  const missing = [...english.keys()].filter(
    (k) => candidates[k] === undefined && declared.DICTIONARY_DECLARED_KEY_STATES[k] === undefined,
  );
  candidatesByLocale[locale] = candidates;
  summary.locales[locale] = {
    recoveredLeaves: own.size,
    keptForRuntime: 0,
    declaredQualifiedUnchangedOrNotTranslated: declaredKeys.length,
    candidatesProvenanceUnknown: Object.keys(candidates).length,
    candidateLineage: lineageCounts,
    droppedStale: dropped.length,
    missingNoCandidate: missing.length,
  };
  const sorted = Object.fromEntries(Object.entries(candidates).sort(([a], [b]) => a.localeCompare(b)));
  fs.writeFileSync(
    path.join(OUT, 'reconciled', `${locale}.json`),
    JSON.stringify(
      {
        locale,
        source: `frontend/src/lib/i18n/recovered/c55-*${locale}* (L-LANG-CATALOG-1, recovered from C55 3db5a09)`,
        rule: 'KEPT only when the key exists today AND the English source it was translated from is unchanged. The C55 set carries no English source, so no key qualifies: every surviving value is a PROVENANCE_UNKNOWN candidate for Claude L, never wired at runtime.',
        keptForRuntime: {},
        droppedStale: dropped.sort(),
        candidates: sorted,
      },
      null,
      1,
    ) + '\n',
  );
}

/* ── the translation work manifest: every gap, per namespace, per locale ─ */
const manifest = {
  purpose: 'Translation work manifest for Claude L (language-qualification authority). Every key listed has no qualified PRODUCT-WIDE value and no declared state in the locales named; until it does, every surface using its namespace renders English with the declared fallback notice in that locale. Keys marked QUALIFIED_IN_ASK_SCOPE are already qualified by Claude L for the Ask scope and are NOT translation work (pendingKeys excludes them).',
  t2Base: summary.t2Base,
  generatedBy: 'scripts/i18n/t2-reconcile-catalogues.cjs',
  states: {
    MISSING: 'no value and no candidate',
    CANDIDATE_PROVENANCE_UNKNOWN: 'a recovered C55 value exists (see reconciled/<locale>.json); its English source is unknown — qualify or replace',
    QUALIFIED_IN_ASK_SCOPE:
      'Claude L already qualified this key for the Ask scope (askDictionary: Ask-shell overlay / R6 additive / C55 reuse). Do NOT re-request it from L. Product-wide surfaces still render English until a separate product decision adopts the Ask-scope value; it is not counted in pendingKeys.',
  },
  locales: LOCALES.filter((l) => l !== 'en'),
  namespaces: {},
  totals: {},
};
for (const locale of manifest.locales)
  manifest.totals[locale] = { pendingKeys: 0, namespacesIncomplete: 0, qualifiedInAskScope: 0 };

for (const id of coverage.namespaceIds()) {
  const ns = coverage.namespace(id);
  const entry = { source: ns.source, kind: ns.kind, englishKeys: ns.englishKeys().length, gapCounts: {}, keys: {} };
  for (const locale of manifest.locales) {
    const gaps = [...ns.gaps(locale)].sort();
    if (gaps.length === 0) continue;
    entry.gapCounts[locale] = gaps.length;
    manifest.totals[locale].namespacesIncomplete += 1;
    for (const key of gaps) {
      entry.keys[key] ??= { en: ns.kind === 'ASK_SHELL' ? undefined : serial(ns.englishText(key)), locales: {} };
      const askValue = ns.kind === 'DICTIONARY' ? askScopeValue(locale, key) : undefined;
      if (
        typeof askValue === 'string' &&
        (askValue !== ns.englishText(key) || askScopeUnchanged(locale, key))
      ) {
        entry.keys[key].locales[locale] = 'QUALIFIED_IN_ASK_SCOPE';
        manifest.totals[locale].qualifiedInAskScope += 1;
        continue;
      }
      manifest.totals[locale].pendingKeys += 1;
      const candidate = ns.kind === 'DICTIONARY' ? candidatesByLocale[locale]?.[key] : undefined;
      entry.keys[key].locales[locale] = candidate ? 'CANDIDATE_PROVENANCE_UNKNOWN' : 'MISSING';
    }
  }
  if (Object.keys(entry.gapCounts).length > 0) manifest.namespaces[id] = entry;
}

/* Per-surface rendered state, the table the dossier carries. */
manifest.surfaces = {};
for (const id of surfaces.surfaceIds()) {
  const renderable = surfaceCoverage.measuredRenderableLocalesOf(id);
  manifest.surfaces[id] = Object.fromEntries(
    LOCALES.map((l) => [
      l,
      renderable.includes(l)
        ? 'FULL'
        : { state: 'DECLARED_FALLBACK', blocking: surfaceCoverage.blockingNamespaces(id, l) },
    ]),
  );
}

/* The runtime table. Product code reads this, never the catalogues of other surfaces. */
const generated = [
  "import type { DisplayLocale } from '@globalnews-ai/shared';",
  "import type { SurfaceId } from '@/lib/i18n/surfaceLocale';",
  '',
  '/**',
  ' * GENERATED by scripts/i18n/t2-reconcile-catalogues.cjs — DO NOT EDIT BY HAND.',
  ' *',
  ' * The locales each surface renders COMPLETELY (English first), MEASURED by',
  ' * src/qualification/i18n/surfaceCoverage.ts over every catalogue namespace the surface uses.',
  ' * surfaceLocale.spec.ts asserts this table equals the live measurement; re-run the script',
  ' * after any catalogue change.',
  ' */',
  'export const SURFACE_RENDERABLE: Readonly<Record<SurfaceId, readonly DisplayLocale[]>> = {',
  ...surfaces.surfaceIds().map(
    (id) => `  ${id}: [${surfaceCoverage.measuredRenderableLocalesOf(id).map((l) => `'${l}'`).join(', ')}],`,
  ),
  '};',
  '',
].join('\n');
fs.writeFileSync(path.join(SRC, 'lib', 'i18n', 'surfaceRenderable.generated.ts'), generated);

fs.writeFileSync(path.join(OUT, 'translation-manifest.json'), JSON.stringify(manifest, null, 1) + '\n');
summary.manifestTotals = manifest.totals;
fs.writeFileSync(path.join(OUT, 'reconciliation-summary.json'), JSON.stringify(summary, null, 2) + '\n');
console.log(JSON.stringify(summary, null, 2));
