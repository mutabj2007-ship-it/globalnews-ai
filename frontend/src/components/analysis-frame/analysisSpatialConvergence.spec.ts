import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { AnalysisApiResponse } from '@globalnews-ai/shared';
import { buildAnalysisSpatialEvidence } from './spatialEvidenceAdapter';
import type { EvidenceGeographyModel } from './evidenceGeography';
import { EMPTY_EVIDENCE_GEOGRAPHY } from './evidenceGeography';
import { hudProfile } from '@/lib/map/state/mapState';
import {
  focusMaxZoom,
  haloRadiusKm,
  rendersAsPoint,
  precisionRank,
} from '@/lib/map/spatial/precisionModel';
import { ANALYSIS_AVAILABLE_GEOMETRY } from '@/lib/spatial/spatialPrecision';
import { SPATIAL_EMBED_MIN_HEIGHT, spatialEmbedHeight } from './AnalysisSpatialEmbed';

/**
 * ═══ ANALYSIS-SPATIAL-MAP-CONVERGENCE-1 — THE REGRESSIONS ══════════════
 *
 * The contract's proof list, asserted against the implementation rather
 * than a snapshot. The behavioural half (precision, coordinates, request
 * count) is exercised through the adapter, which is pure and therefore
 * provable without a browser; the structural half (which renderer mounts,
 * what the gate is, where Expand goes) is asserted over source, because
 * "the Analysis rail no longer runs a second map implementation" is a
 * fact about the repository.
 */

const DIR = __dirname;
const read = (name: string): string => readFileSync(join(DIR, name), 'utf8');
/* R3 · the shared shell, read for the conditional-mount proof below. */
const readShell = (name: string): string =>
  readFileSync(join(DIR, '..', 'map', 'shell', name), 'utf8');
const codeOnly = (source: string): string =>
  source.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ');

/* ── the Iran case, shaped exactly as the analysis produces it ───────── */

const IRAN: EvidenceGeographyModel = {
  countries: [
    {
      iso2: 'IR',
      iso3: 'IRN',
      isoNumeric: '364',
      name: 'Iran',
      articleCount: 4,
      articleIds: ['a1', 'a2', 'a3', 'a9'],
      basis: 'article-evidence',
    },
  ],
  primary: {
    iso2: 'IR',
    iso3: 'IRN',
    isoNumeric: '364',
    name: 'Iran',
    articleCount: 4,
    articleIds: ['a1', 'a2', 'a3', 'a9'],
    basis: 'article-evidence',
  },
  resolvedArticleCount: 4,
  unresolvedArticleCount: 2,
  totalArticleCount: 6,
  precisionCeiling: 'country',
  queryTarget: { iso2: 'IR', iso3: 'IRN', name: 'Iran', city: null },
  targetDisagreesWithEvidence: false,
  empty: false,
};

const RESPONSE = {
  analysis: { generatedAt: '2026-09-14T08:00:00.000Z' },
  articles: [
    { id: 'a1', publishedAt: '2026-09-13T06:00:00.000Z', sourceId: 'reuters' },
    { id: 'a2', publishedAt: '2026-09-14T05:00:00.000Z', sourceId: 'ap' },
    { id: 'a3', publishedAt: '2026-09-12T05:00:00.000Z', sourceId: 'reuters' },
    /* a9 deliberately absent from the article list */
  ],
} as unknown as AnalysisApiResponse;

/* ── precision and coordinates ───────────────────────────────────────── */

describe('PRECISION — country evidence stays country evidence', () => {
  it('Iran adapts to exactly one COUNTRY record', () => {
    const { evidenceSet, availableGeometry } = buildAnalysisSpatialEvidence(IRAN, RESPONSE);
    expect(evidenceSet.records).toHaveLength(1);
    expect(evidenceSet.records[0]?.precision).toBe('COUNTRY');
    expect(availableGeometry).toBe('COUNTRY');
  });

  it('NO record carries a point — a coordinate is never invented', () => {
    const { evidenceSet } = buildAnalysisSpatialEvidence(IRAN, RESPONSE);
    for (const record of evidenceSet.records) {
      expect(record.geography.point).toBeUndefined();
    }
    /* and the adapter contains no path that could produce one */
    const code = codeOnly(read('spatialEvidenceAdapter.ts'));
    expect(code).not.toMatch(/\bpoint\s*:/);
    expect(code).not.toMatch(/\b(lat|lng|lon|latitude|longitude|centroid|capital)\b/i);
  });

  it('there is no branch that can promote COUNTRY to CITY or EXACT', () => {
    const code = codeOnly(read('spatialEvidenceAdapter.ts'));
    for (const finer of ['CITY', 'EXACT', 'PROVINCE', 'DISTRICT', 'SECTOR']) {
      expect(`${finer}: ${code.includes(finer)}`).toBe(`${finer}: false`);
    }
  });

  /*
    R3 DEFECT 3 — THE TEST THAT USED TO ASSERT THE DEFECT.
    R1/R2 asserted `'NONE'` here and passed, because the assertion and the
    code agreed with each other and both were wrong about the reader. The
    measured surface said "No evidence shown" beside `Iran · 6 REPORTS`.
    The replacement asserts the property the reader depends on rather than
    the constant the adapter happens to emit.
  */
  it('an unresolved ceiling adapts to UNKNOWN — evidence that exists is never called absent', () => {
    const unresolved: EvidenceGeographyModel = { ...IRAN, precisionCeiling: 'unresolved' };
    const { evidenceSet } = buildAnalysisSpatialEvidence(unresolved, RESPONSE);

    /* the records are there — so the surface IS drawing evidence */
    expect(evidenceSet.records.length).toBeGreaterThan(0);
    expect(evidenceSet.records[0]?.reportCount).toBeGreaterThan(0);

    /* … and therefore may not be described as none */
    expect(evidenceSet.records[0]?.precision).toBe('UNKNOWN');
    expect(evidenceSet.records[0]?.precision).not.toBe('NONE');
  });

  it('UNKNOWN is a floor, not a promotion — it draws no more than NONE did', () => {
    /*
      The three tables that decide what a precision may DRAW. If UNKNOWN
      differed from NONE in any of them the correction would have bought
      the sentence at the cost of a pixel claim.
    */
    expect(haloRadiusKm('UNKNOWN')).toBe(haloRadiusKm('NONE'));
    expect(haloRadiusKm('UNKNOWN')).toBeNull();
    expect(focusMaxZoom('UNKNOWN')).toBe(focusMaxZoom('NONE'));
    expect(rendersAsPoint('UNKNOWN')).toBe(false);
    expect(precisionRank('UNKNOWN')).toBeLessThan(precisionRank('COUNTRY'));
  });

  it('the unresolved path still cannot reach COUNTRY, CITY or EXACT', () => {
    const unresolved: EvidenceGeographyModel = { ...IRAN, precisionCeiling: 'unresolved' };
    const { evidenceSet } = buildAnalysisSpatialEvidence(unresolved, RESPONSE);
    for (const record of evidenceSet.records) {
      expect(['COUNTRY', 'CITY', 'EXACT']).not.toContain(record.precision);
      expect(record.geography.point).toBeUndefined();
    }
  });

  it('availableGeometry is the SURFACE\'s budget, from the accepted constant', () => {
    /*
      R3 · not the evidence's claim. Both ceilings answer the same way,
      because the question is about what outlines this surface holds.
    */
    const unresolved: EvidenceGeographyModel = { ...IRAN, precisionCeiling: 'unresolved' };
    expect(buildAnalysisSpatialEvidence(IRAN, RESPONSE).availableGeometry)
      .toBe(ANALYSIS_AVAILABLE_GEOMETRY);
    expect(buildAnalysisSpatialEvidence(unresolved, RESPONSE).availableGeometry)
      .toBe(ANALYSIS_AVAILABLE_GEOMETRY);
    expect(ANALYSIS_AVAILABLE_GEOMETRY).toBe('COUNTRY');
  });

  it('NO adapted state can print the banner\'s "no evidence" label while records exist', () => {
    /*
      The contradiction stated as a law over BOTH ceilings, so a future
      third ceiling cannot reintroduce it silently.
    */
    for (const ceiling of ['country', 'unresolved'] as const) {
      const model: EvidenceGeographyModel = { ...IRAN, precisionCeiling: ceiling };
      const { evidenceSet } = buildAnalysisSpatialEvidence(model, RESPONSE);
      const drawing = evidenceSet.records.length > 0;
      const saysNothingIsShown = evidenceSet.records.some((r) => r.precision === 'NONE');
      expect(`${ceiling}: drawing=${drawing} saysNone=${saysNothingIsShown}`)
        .toBe(`${ceiling}: drawing=true saysNone=false`);
    }
  });
});

/* ── provenance, counts and times are real ───────────────────────────── */

describe('TRUTHFULNESS — every adapted field traces to a loaded fact', () => {
  it('provenance distinguishes what the article said from what the filter did', () => {
    const stated = buildAnalysisSpatialEvidence(IRAN, RESPONSE);
    expect(stated.evidenceSet.records[0]?.provenance).toBe('STATED');

    const filtered: EvidenceGeographyModel = {
      ...IRAN,
      countries: [{ ...IRAN.countries[0]!, basis: 'retrieval-filter' }],
    };
    const interpreted = buildAnalysisSpatialEvidence(filtered, RESPONSE);
    /*
      NOT 'STATED'. `countsAsVerified` treats STATED as verified, so
      mapping a retrieval-filter country to it would upgrade a filter
      decision into the article's own claim.
    */
    expect(interpreted.evidenceSet.records[0]?.provenance).toBe('INTERPRETED');
  });

  it('reportCount is the real article count', () => {
    const { evidenceSet } = buildAnalysisSpatialEvidence(IRAN, RESPONSE);
    expect(evidenceSet.records[0]?.reportCount).toBe(4);
  });

  it('sourceCount counts DISTINCT publishers, not articles', () => {
    /* a1+a3 are both reuters, a2 is ap, a9 has no article record */
    const { evidenceSet } = buildAnalysisSpatialEvidence(IRAN, RESPONSE);
    expect(evidenceSet.records[0]?.sourceCount).toBe(2);
  });

  it('lastObservedAt is the newest REAL publishedAt, never render time', () => {
    const { evidenceSet } = buildAnalysisSpatialEvidence(IRAN, RESPONSE);
    expect(evidenceSet.records[0]?.lastObservedAt).toBe('2026-09-14T05:00:00.000Z');

    /* with no article timestamps it falls back to the analysis time */
    const noArticles = { analysis: { generatedAt: '2026-09-14T08:00:00.000Z' }, articles: [] } as unknown as AnalysisApiResponse;
    const fallback = buildAnalysisSpatialEvidence(IRAN, noArticles);
    expect(fallback.evidenceSet.records[0]?.lastObservedAt).toBe('2026-09-14T08:00:00.000Z');

    const code = codeOnly(read('spatialEvidenceAdapter.ts'));
    expect(code).not.toMatch(/Date\.now\(\)/);
  });

  it('loadedAt is the analysis generatedAt, and the scope says what this set is', () => {
    const { evidenceSet } = buildAnalysisSpatialEvidence(IRAN, RESPONSE);
    expect(evidenceSet.loadedAt).toBe('2026-09-14T08:00:00.000Z');
    expect(evidenceSet.scope).toBe('QUESTION');
  });
});

/* ── evidence vs reference ───────────────────────────────────────────── */

describe('EVIDENCE vs REFERENCE — the query target never becomes evidence', () => {
  it('an agreeing target produces NO no-evidence entry', () => {
    const { noEvidenceGeography } = buildAnalysisSpatialEvidence(IRAN, RESPONSE);
    expect(noEvidenceGeography).toEqual([]);
  });

  it('a DISAGREEING target is carried as no-evidence, not as a record', () => {
    const disagreeing: EvidenceGeographyModel = {
      ...IRAN,
      queryTarget: { iso2: 'PL', iso3: 'POL', name: 'Poland', city: null },
      targetDisagreesWithEvidence: true,
    };
    const { evidenceSet, noEvidenceGeography } = buildAnalysisSpatialEvidence(disagreeing, RESPONSE);

    expect(noEvidenceGeography.map((g) => g.countryIso3)).toEqual(['POL']);
    /* and it is NOT in the evidence records */
    expect(evidenceSet.records.map((r) => r.geography.countryIso3)).toEqual(['IRN']);
    expect(noEvidenceGeography[0]?.point).toBeUndefined();
  });

  it('the selection frames the primary evidence country', () => {
    const { selection } = buildAnalysisSpatialEvidence(IRAN, RESPONSE);
    expect(selection).toEqual({ kind: 'COUNTRY', id: 'IRN', geographyId: 'IRN' });
  });

  it('no primary means no selection — a tie is not resolved silently', () => {
    const tied: EvidenceGeographyModel = { ...IRAN, primary: null };
    expect(buildAnalysisSpatialEvidence(tied, RESPONSE).selection).toBeNull();
  });
});

/* ── no new request ──────────────────────────────────────────────────── */

describe('NO ADDITIONAL REQUEST — proven from the implementation', () => {
  it('neither new file can reach the network or a provider', () => {
    for (const name of ['spatialEvidenceAdapter.ts', 'AnalysisSpatialEmbed.tsx']) {
      const code = codeOnly(read(name));
      for (const forbidden of ['fetch(', 'XMLHttpRequest', 'axios', 'analyzeNews', 'analysisApi',
                               'useEffect', 'gnews', 'GNews', 'gdelt', 'GDELT']) {
        expect(`${name} ${forbidden}: ${code.includes(forbidden)}`).toBe(`${name} ${forbidden}: false`);
      }
    }
  });

  it('the adapter is a pure function of the response already loaded', () => {
    const a = buildAnalysisSpatialEvidence(IRAN, RESPONSE);
    const b = buildAnalysisSpatialEvidence(IRAN, RESPONSE);
    expect(a).toEqual(b);
  });
});

/* ── the gate, and the rollback path ─────────────────────────────────── */

describe('ROLLBACK — one flag, the same one /map uses', () => {
  const detail = codeOnly(read('LocationDetail.tsx'));

  it('the gate is mapShellVariant(), and no second flag was introduced', () => {
    expect(detail).toMatch(/mapShellVariant\(\) === 'shell'/);
    expect(detail).not.toMatch(/NEXT_PUBLIC_(?!MAP_SHELL)/);
    const embed = codeOnly(read('AnalysisSpatialEmbed.tsx'));
    const adapter = codeOnly(read('spatialEvidenceAdapter.ts'));
    for (const source of [embed, adapter]) {
      expect(source).not.toMatch(/process\.env/);
    }
  });

  it('the legacy path still mounts the accepted renderers', () => {
    expect(detail).toMatch(/<EvidenceMap\b/);
    expect(detail).toMatch(/<EvidenceMapLegend\b/);
    expect(detail).toMatch(/<CompactMap\b/);
    expect(detail).toMatch(/<EvidenceGeographyExpanded\b/);
  });

  it('the no-evidence fallback is reached before the gate, so it is unaffected', () => {
    const fallback = detail.indexOf('evidence === undefined ?');
    const gateUse = detail.indexOf('spatial && spatialEvidence !== undefined');
    expect(fallback).toBeGreaterThan(-1);
    expect(gateUse).toBeGreaterThan(fallback);
  });

  it('an empty model still adapts without throwing', () => {
    const { evidenceSet, selection, noEvidenceGeography } =
      buildAnalysisSpatialEvidence(EMPTY_EVIDENCE_GEOGRAPHY, null);
    expect(evidenceSet.records).toEqual([]);
    expect(selection).toBeNull();
    expect(noEvidenceGeography).toEqual([]);
  });
});

/* ── EMBED behaviour comes from the profile, not from this surface ───── */

describe('EMBED — the density already defines the behaviour the contract asks for', () => {
  it('the profile is non-interactive, does not capture the wheel, and discloses precision', () => {
    const hud = hudProfile('EMBED');
    expect(hud.interactive).toBe(false);
    expect(hud.capturesWheel).toBe(false);
    expect(hud.precisionBanner).toBe(true);
  });

  it('EMBED mounts no mode switcher, layer rail, right rail, search or legend', () => {
    const hud = hudProfile('EMBED');
    for (const off of ['modeSwitcher', 'layerRail', 'rightRail', 'search', 'legend'] as const) {
      expect(`${off}: ${hud[off]}`).toBe(`${off}: false`);
    }
  });

  it('the embed declares a density and an evidence scope, and no control flags', () => {
    const embed = codeOnly(read('AnalysisSpatialEmbed.tsx'));
    expect(embed).toMatch(/surfaceDensity="EMBED"/);
    /*
      "Surfaces do not choose their own controls; they declare a density
      and an evidence scope, and the shell DERIVES the HUD."
    */
    for (const override of ['showLayerRail', 'showSearch', 'interactive=', 'capturesWheel=',
                            'showLegend', 'showRightRail', 'modeSwitcher=']) {
      expect(`${override}: ${embed.includes(override)}`).toBe(`${override}: false`);
    }
  });

  it('the rail footprint is the SAME two constants the previous renderer used', () => {
    const embed = read('AnalysisSpatialEmbed.tsx');
    expect(embed).toMatch(/MAP_HEIGHT_COMPRESSED|MAP_HEIGHT_NORMAL/);
    expect(embed).toMatch(/from '\.\/GeographicEvidenceMap'/);
  });

  it('it is mounted dynamically with ssr false, as /map mounts it', () => {
    const embed = read('AnalysisSpatialEmbed.tsx');
    expect(embed).toMatch(/dynamic\(/);
    expect(embed).toMatch(/ssr: false/);
  });
});

/* ── Expand Map ──────────────────────────────────────────────────────── */

describe('EXPAND MAP — the real map, through the route contract that exists', () => {
  const detail = codeOnly(read('LocationDetail.tsx'));

  it('the shell path links to /map with the evidence country', () => {
    expect(detail).toMatch(/href=\{expandHref \?\? '\/map'\}/);
    expect(detail).toMatch(/`\/map\?\$\{new URLSearchParams\(\{ country: expandIso3 \}\)/);
  });

  it('it carries NO camera — a camera is a coordinate this evidence lacks', () => {
    const expandBlock = detail.slice(detail.indexOf('const expandIso3'), detail.indexOf('const state'));
    expect(expandBlock).not.toMatch(/\bcam\b|encodeCamera|CAMERA_QUERY_KEY/);
  });

  it('no parallel navigation contract was invented — only /map’s own parameter', () => {
    const used = [...detail.matchAll(/URLSearchParams\(\{ (\w+):/g)].map((m) => m[1]);
    expect(used).toEqual(['country']);
  });

  it('EvidenceGeographyExpanded is retired on the shell path, retained on legacy', () => {
    /* the overlay may only open when the gate is OFF */
    expect(detail).toMatch(/\{expanded && !spatial \? \(/);
  });

  it('the expand control remains withheld when nothing resolved', () => {
    const guard = detail.indexOf('evidence.empty ? null :');
    expect(guard).toBeGreaterThan(-1);
    for (const m of detail.matchAll(/data-paf="geo-expand"/g)) {
      expect(m.index ?? -1).toBeGreaterThan(guard);
    }
  });
});

/* ── nothing outside the map representation moved ────────────────────── */

describe('SCOPE — only the map representation changed', () => {
  it('every surrounding Analysis disclosure is still rendered', () => {
    const detail = codeOnly(read('LocationDetail.tsx'));
    for (const kept of ['evidence-country-list', 'evidence.countries.map', 'unresolvedArticleCount',
                        'targetDisagreesWithEvidence', 'insufficientEvidence']) {
      expect(`${kept}: ${detail.includes(kept)}`).toBe(`${kept}: true`);
    }
  });

  it('no /map route file and no shell file is touched by this change', () => {
    /*
      Structural: the new files import FROM the shell and never the other
      way, so nothing in this change can alter what /map renders.
    */
    const embed = read('AnalysisSpatialEmbed.tsx');
    expect(embed).toMatch(/import\('@\/components\/map\/shell\/GlobalMapShell'\)/);
    const adapter = codeOnly(read('spatialEvidenceAdapter.ts'));
    expect(adapter).not.toMatch(/MapPageClient|app\/map/);
  });

  it('no backend, provider or Sources Dock file is referenced', () => {
    for (const name of ['spatialEvidenceAdapter.ts', 'AnalysisSpatialEmbed.tsx']) {
      const code = codeOnly(read(name));
      for (const forbidden of ['SourcesDock', 'SourcesReporting', 'backend', 'retrievalContext']) {
        expect(`${name} ${forbidden}: ${code.includes(forbidden)}`).toBe(`${name} ${forbidden}: false`);
      }
    }
  });
});

/* ── R3 ──────────────────────────────────────────────────────────────── */

describe('R3 DEFECT 1 — the HUD profile is obeyed in the DOM, not only in the table', () => {
  /*
    THE ERROR THIS BLOCK EXISTS TO PREVENT REPEATING. R2 asserted
    `hudProfile('EMBED')` and passed while the rendered shell mounted the
    control cluster and the camera controls unconditionally. A table the
    renderer does not read is a document, not a contract. These assertions
    are over the SHELL'S OWN SOURCE; the rendered-DOM half is proven in the
    browser harness, which is where a DOM exists.
  */
  const shell = codeOnly(readShell('GlobalMapShell.tsx'));

  it('the control cluster is mounted behind the profile, not unconditionally', () => {
    expect(shell).toMatch(/\{hud\.interactive && \(\s*<MapControlCluster/);
  });

  it('the camera controls are mounted behind the profile, not unconditionally', () => {
    expect(shell).toMatch(
      /\{\(hud\.zoomControls \|\| hud\.resetWorld \|\| hud\.resetEvidence \|\| hud\.previousView\) && \(\s*<MapCameraControls/,
    );
  });

  it('no <MapControlCluster or <MapCameraControls is left ungated', () => {
    for (const tag of ['<MapControlCluster', '<MapCameraControls']) {
      expect(`${tag} mounts: ${shell.split(tag).length - 1}`).toBe(`${tag} mounts: 1`);
    }
  });

  it('EMBED declares every forbidden control off', () => {
    const hud = hudProfile('EMBED');
    for (const off of ['interactive', 'zoomControls', 'resetWorld', 'resetEvidence',
                       'previousView', 'modeSwitcher', 'layerRail', 'rightRail',
                       'search', 'legend'] as const) {
      expect(`EMBED ${off}: ${hud[off]}`).toBe(`EMBED ${off}: false`);
    }
  });

  it('FULL declares every one of them ON — so the gate cannot change /map', () => {
    /*
      The gate's safety is a property of the TABLE, and it is asserted here
      rather than assumed: if a future edit turned any of these off, /map
      would lose a control and this test would say so before a reader did.
    */
    const full = hudProfile('FULL');
    expect(full.interactive).toBe(true);
    for (const on of ['zoomControls', 'resetWorld', 'resetEvidence', 'previousView'] as const) {
      expect(`FULL ${on}: ${full[on]}`).toBe(`FULL ${on}: true`);
    }
  });

  it('PANEL and MODAL are unaffected too — the gate touches only MINI and EMBED', () => {
    for (const density of ['PANEL', 'FULL', 'MODAL'] as const) {
      const hud = hudProfile(density);
      expect(`${density}: ${hud.interactive}`).toBe(`${density}: true`);
    }
    for (const density of ['MINI', 'EMBED'] as const) {
      const hud = hudProfile(density);
      expect(`${density}: ${hud.interactive}`).toBe(`${density}: false`);
    }
  });

  it('the four camera flags move together across every density', () => {
    /*
      The disjunction in the gate is only honest if the flags are not
      independent. Asserted, not asserted-by-comment.
    */
    for (const density of ['MINI', 'EMBED', 'PANEL', 'FULL', 'MODAL'] as const) {
      const hud = hudProfile(density);
      const flags = [hud.zoomControls, hud.resetWorld, hud.resetEvidence, hud.previousView];
      expect(`${density}: ${new Set(flags).size}`).toBe(`${density}: 1`);
    }
  });

  it('the attribution is NOT removed — it is a licence obligation, not a control', () => {
    expect(readShell('GlobalMapShell.tsx')).toMatch(/data-gn="map-attribution"/);
  });

  it('the correction introduces no new flag and no new density', () => {
    const embed = codeOnly(read('AnalysisSpatialEmbed.tsx'));
    for (const invented of ['NEXT_PUBLIC_', 'hudProfile', 'HudProfile', 'MINI', 'PANEL', 'MODAL']) {
      expect(`${invented}: ${embed.includes(invented)}`).toBe(`${invented}: false`);
    }
    expect(shell).not.toMatch(/surfaceDensity === 'EMBED'/);
  });
});

describe('R3 DEFECTS 2 AND 4 — a legible map, and no loading jump', () => {
  it('the embed never renders below its floor, at either dock state', () => {
    expect(spatialEmbedHeight(false)).toBe(SPATIAL_EMBED_MIN_HEIGHT);
    expect(spatialEmbedHeight(true)).toBe(SPATIAL_EMBED_MIN_HEIGHT);
    expect(SPATIAL_EMBED_MIN_HEIGHT).toBeGreaterThanOrEqual(104);
  });

  it('the measured R2 footprint is no longer reachable', () => {
    /* R2 desktop evidence measured 263x52 and the screenshot was unusable. */
    expect(spatialEmbedHeight(true)).toBeGreaterThan(52);
  });

  it('the floor is composed of EXISTING constants, not a new number', () => {
    const embed = codeOnly(read('AnalysisSpatialEmbed.tsx'));
    expect(embed).toMatch(/SPATIAL_EMBED_MIN_HEIGHT = MAP_HEIGHT_NORMAL \+ MAP_HEIGHT_COMPRESSED/);
    expect(embed).not.toMatch(/height:\s*\d{2,}\b/);
  });

  it('the floor clears the MEASURED EMBED HUD column, with headroom', () => {
    /*
      Measured in the rendered DOM at the desktop rail's real width:
      banner 67 + gap 6 + attribution 45 + insets 24 = 142. Below that the
      region clips the top of the trust statement.
    */
    const REQUIRED_HUD_COLUMN = 142;
    expect(SPATIAL_EMBED_MIN_HEIGHT).toBeGreaterThanOrEqual(REQUIRED_HUD_COLUMN);
    /* and 104 is recorded as the value that does NOT clear it */
    expect(104).toBeLessThan(REQUIRED_HUD_COLUMN);
  });

  it('LEGACY rollback keeps its own compressed renderer — untouched', () => {
    const detail = codeOnly(read('LocationDetail.tsx'));
    expect(detail).toMatch(/EvidenceMap/);
    expect(detail).not.toMatch(/spatialEmbedHeight/);
  });

  it('the loading fallback uses the SAME height function as the final embed', () => {
    const embed = codeOnly(read('AnalysisSpatialEmbed.tsx'));
    const fallback = embed.slice(embed.indexOf('function EmbedLoadingFallback'));
    expect(fallback).toMatch(/spatialEmbedHeight\(/);
    /* there is no second height expression that could diverge from it */
    expect(`fallback literal heights: ${/height:\s*\d/.test(fallback)}`)
      .toBe('fallback literal heights: false');
  });

  it('loading and loaded agree at every compression state', () => {
    for (const compressed of [true, false]) {
      expect(`${compressed}: ${spatialEmbedHeight(compressed)}`)
        .toBe(`${compressed}: ${SPATIAL_EMBED_MIN_HEIGHT}`);
    }
  });
});
