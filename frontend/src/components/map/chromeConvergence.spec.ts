import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { en } from '@/lib/i18n/dictionaries/en';
import { pl } from '@/lib/i18n/dictionaries/pl';
import { GOVERNED_EAST_AFRICA_ID, governedRegionLabelKey } from '@/lib/map/navigation/breadcrumbs';
import { declaredRegionSelection } from '@/lib/map/region/regionSelection';
import { localisedGovernedRegion } from '@/lib/map/region/governedRegionLabel';

/**
 * ══ PHASE C — HUD GEOMETRY AND DISPLAY LANGUAGE ═══════════════════════════
 *
 * MAP-LAYERS-EVIDENCE-GRAMMAR-COLLISION-1 · MAP-PL-ACTIVE-REGION-LABEL-1 ·
 * MAP-PL-MIXED-LANGUAGE-CHROME-1
 */

const SRC = resolve(__dirname, '..', '..');

const raw = (...parts: string[]): string => readFileSync(join(SRC, ...parts), 'utf-8');

const code = (...parts: string[]): string =>
  raw(...parts)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

const SHELL = code('components', 'map', 'shell', 'GlobalMapShell.tsx');

/* ══════════════════════════════════════════════════════════════════════════
   THE LOWER-LEFT COLLISION
   ══════════════════════════════════════════════════════════════════════════ */

describe('the lower-left corner is one column, so its panels cannot overlap', () => {
  it('the three islands share a single stack', () => {
    expect(SHELL).toContain('data-gn="map-lower-left-stack"');
    expect(SHELL).toContain('flex-col-reverse');
    expect(SHELL).toContain('data-gn="map-scale-island"');
    expect(SHELL).toContain('data-gn="map-legend-island"');
  });

  it('the anchors that caused the collision are gone', () => {
    /*
      The defect, precisely: three islands pinned to the same bottom edge at
      16px, 104px and 128px, each growing UPWARD. The layers panel is seven
      44px rows plus a heading — past 128px — so it grew through both
      neighbours and the legend's z-20 drew over it.
    */
    expect(SHELL).not.toContain('bottom-[128px]');
    expect(SHELL).not.toContain('bottom-[104px]');
  });

  it('the cluster no longer anchors itself — it flows inside the stack', () => {
    const cluster = code('components', 'map', 'shell', 'd1', 'MapControlCluster.tsx');

    expect(cluster).toContain('positioned = true');
    expect(cluster).toContain("positioned ? ' absolute bottom-4 left-4 z-10' : ''");
    expect(SHELL).toContain('positioned={false}');
  });

  it('the stack is bounded, so it cannot run off a short viewport', () => {
    const stack = SHELL.slice(
      SHELL.indexOf('data-gn="map-lower-left-stack"'),
      SHELL.indexOf('{hud.interactive && (', SHELL.indexOf('data-gn="map-lower-left-stack"')),
    );

    expect(stack).toMatch(/max-h-\[/);
    expect(stack).toContain('overflow-y-auto');
    expect(stack).toContain('bottom-4');
    expect(stack).toContain('left-4');
  });

  it('the stack contains ONLY the lower-left items — no foreign island was swallowed', () => {
    /*
      A first attempt at this closed the column too late and wrapped the
      breadcrumbs island and the top-right readout, which would have re-based
      their `absolute` offsets against the column. Pinned so that cannot recur.
    */
    const stack = SHELL.slice(
      SHELL.indexOf('data-gn="map-lower-left-stack"'),
      SHELL.indexOf('data-gn="map-legend-island"'),
    );

    expect(stack).not.toMatch(/absolute (left|right|top)-/);
  });
});

/* ══════════════════════════════════════════════════════════════════════════
   MAP-PL-ACTIVE-REGION-LABEL-1
   ══════════════════════════════════════════════════════════════════════════ */

describe('a governed region is named by the dictionary, not by its declaration', () => {
  const region = declaredRegionSelection(GOVERNED_EAST_AFRICA_ID, null);

  it('the declaration carries an English label, which is DATA rather than copy', () => {
    expect(region?.name).toBe('East Africa');
  });

  it('PL renders the localised name — the chip and the rail agree', () => {
    const localised = localisedGovernedRegion(
      region,
      GOVERNED_EAST_AFRICA_ID,
      pl.map.spatial.breadcrumbs.targets,
    );

    expect(localised?.name).toBe('Afryka Wschodnia');
    expect(localised?.name).not.toBe('East Africa');
    // The same string the secondary control already used.
    expect(pl.map.spatial.breadcrumbs.targets.eastAfrica).toBe('Afryka Wschodnia');
  });

  it('EN is unchanged', () => {
    expect(
      localisedGovernedRegion(region, GOVERNED_EAST_AFRICA_ID, en.map.spatial.breadcrumbs.targets)
        ?.name,
    ).toBe('East Africa');
  });

  it('a gazetteer region keeps G’s published name — nothing is renamed blindly', () => {
    const gazetteer = {
      geographyId: 'region:eastern-africa',
      name: 'Eastern Africa',
      regionType: 'STATISTICAL' as const,
      definition: 'UN M49',
      extent: null,
      memberCount: 20,
      definitionId: null,
    };

    expect(governedRegionLabelKey('region:eastern-africa')).toBeNull();
    expect(
      localisedGovernedRegion(gazetteer, 'region:eastern-africa', pl.map.spatial.breadcrumbs.targets)
        ?.name,
    ).toBe('Eastern Africa');
  });

  it('never blanks a name when a locale lacks the entry', () => {
    expect(localisedGovernedRegion(region, GOVERNED_EAST_AFRICA_ID, {})?.name).toBe('East Africa');
    expect(localisedGovernedRegion(null, GOVERNED_EAST_AFRICA_ID, {})).toBeNull();
  });
});

/* ══════════════════════════════════════════════════════════════════════════
   MAP-PL-MIXED-LANGUAGE-CHROME-1 — CLASSIFICATION, NOT BLIND TRANSLATION
   ══════════════════════════════════════════════════════════════════════════ */

describe('§7 — the chrome tokens, classified individually and corrected', () => {
  /*
    ══ THE CORRECTED CLASSIFICATION ═══════════════════════════════════════

    A first pass grouped all seven visible rail tokens as "accepted compact
    abbreviations". That was wrong and the CTO rejected it. EVID, SRC, WATCH
    and SITU are truncations; WATER, LABEL and GRID are ORDINARY ENGLISH
    WORDS, and appearing in a 52px rail does not make a word an abbreviation.

    THE CITE-OR-LOCALISE TEST WAS APPLIED, AND NOTHING COULD BE CITED. The
    repository holds no Design or spec authority defining any of these as
    fixed, language-invariant compact codes:

      · the only provenance was a code comment calling them "the prototype's
        short technical codes" — a comment, not an authority;
      · `golden-authority.manifest.json` contains no rail code (its three
        "EVID" hits are the word EVIDENCE matching as a substring);
      · and the product settles it the other way, because it ALREADY localises
        its own mode vocabulary: EVIDENCE -> "Dowody", SOURCES -> "Źródła",
        WATCH -> "Obserwowane".

    So all seven are treated as PL display-language leakage and the VISIBLE
    label is localised. The internal layer id is untouched, which is what keeps
    the registry, the canvas and the canonical layer state unaffected.

    ADM0 / ADM1 / ADM2 remain identical in both locales DELIBERATELY: those are
    international administrative-level codes, not English words.

    REGION in Polish search remains accepted as linguistically valid.
  */

  it('no Design or spec authority defines the rail codes as language-invariant', () => {
    const manifest = readFileSync(
      join(SRC, '..', '..', 'scripts', 'spatial-visual', 'golden-authority.manifest.json'),
      'utf-8',
    );

    for (const token of ['"GRID"', '"WATER"', '"LABEL"', '"SITU"', '"SRC"']) {
      expect(manifest).not.toContain(token);
    }
  });

  it('the product already localises its mode vocabulary, so the rail must follow', () => {
    expect(pl.map.spatial.modes.modes.EVIDENCE).toBe('Dowody');
    expect(pl.map.spatial.modes.modes.SOURCES).toBe('Źródła');
    expect(pl.map.spatial.modes.modes.WATCH).toBe('Obserwowane');
    expect(pl.map.spatial.modes.modes.EVIDENCE).not.toBe(en.map.spatial.modes.modes.EVIDENCE);
  });

  it('the ORDINARY ENGLISH WORDS are localised — WATER, LABEL, GRID', () => {
    expect(en.map.spatial.layers.codes.hydrography).toBe('WATER');
    expect(en.map.spatial.layers.codes.labels).toBe('LABEL');
    expect(en.map.spatial.layers.codes.graticule).toBe('GRID');

    expect(pl.map.spatial.layers.codes.hydrography).toBe('WODA');
    expect(pl.map.spatial.layers.codes.labels).toBe('NAZWY');
    expect(pl.map.spatial.layers.codes.graticule).toBe('SIATKA');

    for (const id of ['hydrography', 'labels', 'graticule'] as const) {
      expect(pl.map.spatial.layers.codes[id]).not.toBe(en.map.spatial.layers.codes[id]);
    }
  });

  it('the truncated product codes are localised too, since none could be cited', () => {
    expect(pl.map.spatial.layers.codes.countryEvidence).toBe('DOWODY');
    expect(pl.map.spatial.layers.codes.sourceDensity).toBe('ŹRÓDŁA');
    expect(pl.map.spatial.layers.codes.watch).toBe('OBSERW.');
    expect(pl.map.spatial.layers.codes.situations).toBe('SYTUAC.');
  });

  it('no invented bare truncation — a shortened form carries the Polish abbreviation period', () => {
    /*
      JEZI / ETYK were explicitly ruled out. Where no short whole word exists
      ("Obserwowane" is 11 characters, "Sytuacje" 8, against a 38px control at
      8px mono) the conventional Polish trailing-period abbreviation is used
      instead of a bare clipped stem. FLAGGED FOR L: these two are abbreviation
      forms rather than whole words.
    */
    const plCodes = pl.map.spatial.layers.codes;

    for (const [id, value] of Object.entries(plCodes)) {
      if (['admin0', 'admin1', 'admin2'].includes(id)) continue;
      // Either a whole word, or an explicit abbreviation.
      expect(value.endsWith('.') || /^[A-ZĄĆĘŁŃÓŚŹŻ]+$/.test(value)).toBe(true);
      expect(value).not.toBe('JEZI');
      expect(value).not.toBe('ETYK');
    }
  });

  it('the administrative-level codes stay identical in both locales, by intent', () => {
    for (const id of ['admin0', 'admin1', 'admin2'] as const) {
      expect(pl.map.spatial.layers.codes[id]).toBe(en.map.spatial.layers.codes[id]);
    }
  });

  it('the rail renders the localised code and keeps the internal id untouched', () => {
    const rail = code('components', 'map', 'shell', 'LayerToggleRail.tsx');

    expect(rail).toContain('labels.codes?.[layer.id]');
    // The registry id is still what drives state and the canvas.
    expect(rail).toContain('onToggle(layer.id, !on)');
  });

  it('every layer still carries a FULL LOCALISED name in its accessible name', () => {
    const rail = code('components', 'map', 'shell', 'LayerToggleRail.tsx');

    expect(rail).toContain('aria-label={reason ? `${labels.layers[layer.id]');
    expect(rail).toContain('title={reason ? `${labels.layers[layer.id]');

    const ids = ['countryEvidence', 'graticule', 'hydrography', 'labels'] as const;

    for (const id of ids) {
      expect(pl.map.spatial.layers.layers[id]).not.toBe(en.map.spatial.layers.layers[id]);
    }
  });

  it('the search taxonomy is already Polish — REGION is valid, not a defect', () => {
    expect(pl.map.spatial.search.kinds.CITY).toBe('Miasto');
    expect(pl.map.spatial.search.kinds.COUNTRY).toBe('Kraj');
    expect(pl.map.spatial.search.kinds.REGION).toBe('Region');
    expect(en.map.spatial.search.kinds.REGION).toBe('Region');
  });

  it('the new city card copy is genuinely translated, not copied across', () => {
    const enCity = en.map.spatial.city;
    const plCity = pl.map.spatial.city;

    for (const key of Object.keys(enCity) as (keyof typeof enCity)[]) {
      expect(plCity[key].length).toBeGreaterThan(0);
      expect(plCity[key]).not.toBe(enCity[key]);
    }
  });

  it('the GOVERNED region type reads as a product declaration in both locales', () => {
    expect(en.map.spatial.region.types.GOVERNED).toMatch(/product coverage region/i);
    expect(pl.map.spatial.region.types.GOVERNED).toMatch(/zakres produktu/i);
    expect(pl.map.spatial.region.types.GOVERNED).not.toBe(en.map.spatial.region.types.GOVERNED);
  });
});
