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

describe('§7 — every visible chrome token is classified, and only defects are corrected', () => {
  /*
    THE RULING ASKS FOR A CLASSIFICATION BEFORE A CORRECTION, and explicitly
    warns against translating established product labels. This is that
    classification, asserted rather than asserted-in-prose:

      EVID SRC WATCH SITU WATER LABEL GRID
        ACCEPTED COMPACT ABBREVIATION. A 52px rail cannot hold a sentence. The
        registry calls these "the prototype's short technical codes"; each is a
        fixed-width code, and the FULL LOCALISED NAME travels with the control
        in `aria-label` and `title`, so a Polish reader and a screen reader both
        get the translated label. Translating the codes would produce SIAT /
        JEZI / ETYK, which is less legible and not more Polish.

      Region / Miasto in search
        NOT A DEFECT. `search.kinds` is fully translated in PL —
        `CITY: 'Miasto'` — and `REGION` is itself a Polish word with the same
        spelling. Nothing to correct.

      EAST AFRICA on the active chip and in the rail
        UNTRANSLATED DEFECT. A place name with an existing PL translation that
        the secondary control was already using. Corrected above.
  */
  const RAIL_CODES = ['EVID', 'SRC', 'WATCH', 'SITU', 'WATER', 'LABEL', 'GRID'];

  it('the rail codes are a declared code table, not leaked identifiers', () => {
    const rail = raw('components', 'map', 'shell', 'LayerToggleRail.tsx');

    expect(rail).toContain("The prototype's short technical codes");
    for (const codeToken of RAIL_CODES) expect(rail).toContain(`'${codeToken}'`);
  });

  it('and every one of them carries a FULL LOCALISED name to the reader', () => {
    const rail = code('components', 'map', 'shell', 'LayerToggleRail.tsx');

    // The accessible name and tooltip are the dictionary label, never the code.
    expect(rail).toContain('aria-label={reason ? `${labels.layers[layer.id]');
    expect(rail).toContain('title={reason ? `${labels.layers[layer.id]');

    // And those labels really are translated.
    const ids = ['countryEvidence', 'graticule', 'hydrography', 'labels'] as const;

    for (const id of ids) {
      const enLabel = en.map.spatial.layers.layers[id];
      const plLabel = pl.map.spatial.layers.layers[id];

      expect(typeof plLabel).toBe('string');
      expect(plLabel.length).toBeGreaterThan(0);
      expect(plLabel).not.toBe(enLabel);
    }
  });

  it('the search taxonomy is already Polish — no blind translation was applied', () => {
    expect(pl.map.spatial.search.kinds.CITY).toBe('Miasto');
    expect(pl.map.spatial.search.kinds.COUNTRY).toBe('Kraj');
    /*
      REGION is spelled identically in both languages. Asserted so a future
      reviewer does not "fix" a token that is already correct.
    */
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
