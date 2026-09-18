import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { lookupNavigatorPlace, type NavigatorPlace } from '@/lib/api/geoNavigatorApi';
import {
  REGION_TYPES,
  regionSelectionFrom,
  type RegionSelection,
} from '@/lib/map/region/regionSelection';
import { decodeSelection, encodeSelection } from '@/lib/map/state/mapUrl';
import { RegionIdentityCard } from '@/components/map/shell/RegionIdentityCard';
import { en } from '@/lib/i18n/dictionaries/en';
import { pl } from '@/lib/i18n/dictionaries/pl';

/**
 * ══ R2-B §1 — KIGALI REGION RESOLVES ══════════════════════════════════════
 *
 * MAP-KIGALI-REGION-RESOLUTION
 *
 * THE DEFECT AS THE READER MET IT. Committing "Kigali REGION" set the address
 * correctly — `sel=region:admin1:RW-01` — and the rail then said, in Polish,
 * "Nie udało się rozpoznać tego regionu" above a raw identifier. The product
 * was holding the answer and reporting a failure.
 *
 * THE CAUSE WAS AN ASYMMETRY, not a missing feature. The semantic-selection
 * work taught the SEARCH path that a province is a REGION; it left the
 * RESOLUTION path rejecting the same node:
 *
 *     if (place.kind !== 'region') return null;
 *
 * So `useResolvedRegion` asked `/geo/place` for the id, GOT the node, and threw
 * it away.
 *
 * ── WHY THIS FILE EMBEDS WIRE PAYLOADS RATHER THAN HAND-BUILT OBJECTS ─────
 *
 * Every fixture below is a VERBATIM response from the deployed backend,
 * captured while preparing this correction. A hand-built `NavigatorPlace`
 * would let the test agree with my reading of the contract instead of with the
 * service, and the whole defect was a disagreement about what one real node
 * looks like. They are driven through `lookupNavigatorPlace` with `fetch`
 * stubbed, so what is proven runs from the wire shape through the parser and
 * the selection to the rendered card — not from the middle of that chain.
 *
 * ── WHAT THE PAYLOADS REVEALED THAT THE FIX WAS FIRST WRITTEN WITHOUT ─────
 *
 * `memberCount` is read from `bounds.members`, which G publishes for any node
 * with an extent. `bounds.source` says what it counted:
 *
 *     region:eastern-africa   members 18   derived-from-member-country-extents
 *     admin1:RW-01            members  2   derived-from-settlements
 *
 * Eighteen is a membership. Two is the number of settlements G had
 * coordinates for. Passing a province straight through would not have produced
 * an empty "Members" row — it would have produced the number 2 under a heading
 * meaning member countries. §3 pins that.
 */

/* ══════════════════════════════════════════════════════════════════════════
   THE MEASURED NODES
   ══════════════════════════════════════════════════════════════════════════ */

/** GET /geo/place?id=admin1:RW-01 — the node the rail could not resolve. */
const KIGALI_PROVINCE = {
  found: true,
  node: {
    geographyId: 'admin1:RW-01',
    kind: 'admin1',
    precision: 'PROVINCE',
    name: 'Kigali',
    searchLabel: 'Kigali',
    aliases: [],
    matchedOn: 'Kigali',
    matchKind: 'EXACT',
    hierarchy: [
      { geographyId: 'region:eastern-africa', kind: 'region', name: 'Eastern Africa' },
      { geographyId: 'region:sub-saharan-africa', kind: 'region', name: 'Sub-Saharan Africa' },
      {
        geographyId: 'region:east-african-community',
        kind: 'region',
        name: 'East African Community',
      },
      { geographyId: 'country:RWA', kind: 'country', name: 'Rwanda', code: 'RWA' },
    ],
    center: [30.05885, -1.94995],
    bounds: {
      bbox: [30.05885, -1.94995, 30.1697, -1.9495],
      centroid: [30.05885, -1.94995],
      members: 2,
      antimeridian: false,
      source: 'derived-from-settlements',
    },
    provenance: {
      dataset: 'iso3166-2-db@2.3.11',
      admittedBy: 'iso3166-2',
      attribution: 'Contains data from the GeoNames geographical database, licensed CC BY 4.0.',
    },
  },
};

/** GET /geo/place?id=region:eastern-africa — a published statistical region. */
const EASTERN_AFRICA = {
  found: true,
  node: {
    geographyId: 'region:eastern-africa',
    kind: 'region',
    precision: 'REGION',
    name: 'Eastern Africa',
    aliases: ['East Africa'],
    matchedOn: 'Eastern Africa',
    matchKind: 'EXACT',
    hierarchy: [],
    bounds: {
      bbox: [22.67926, -25.96553, 63.41667, 15.77792],
      centroid: [43.047965, -5.093805],
      members: 18,
      antimeridian: false,
      source: 'derived-from-member-country-extents',
    },
    provenance: {
      dataset:
        'UN Statistics Division, Standard Country or Area Codes for Statistical Use (M49)',
      admittedBy: 'un-m49',
    },
  },
};

/** GET /geo/place?id=region:middle-east — contested, and served with NO bounds. */
const MIDDLE_EAST = {
  found: true,
  node: {
    geographyId: 'region:middle-east',
    kind: 'region',
    precision: 'REGION',
    name: 'Middle East',
    aliases: ['Near East'],
    matchedOn: 'Middle East',
    matchKind: 'EXACT',
    hierarchy: [],
    provenance: {
      dataset:
        'No agreed membership. UN M49 has no "Middle East"; usage disagrees over Egypt, Turkey, Iran, Afghanistan and the Maghreb.',
      admittedBy: 'contested-membership',
    },
  },
};

/** GET /geo/place?id=country:RWA — a country, which this path must still refuse. */
const RWANDA = {
  found: true,
  node: {
    geographyId: 'country:RWA',
    kind: 'country',
    precision: 'COUNTRY',
    name: 'Rwanda',
    aliases: ['RW', 'RWA'],
    matchedOn: 'Rwanda',
    matchKind: 'EXACT',
    hierarchy: [],
    bounds: {
      bbox: [28.9075, -2.6924, 30.5427, -1.29289],
      centroid: [29.89378, -1.97325],
      members: 48,
      antimeridian: false,
      source: 'derived-from-settlements',
    },
    provenance: { dataset: 'shared/COUNTRIES (ISO 3166-1)', admittedBy: 'gazetteer' },
  },
};

/**
 * The real client, fed the real payload. Nothing here constructs a
 * `NavigatorPlace` by hand, so a change to G's wire shape or to the parser
 * reaches these assertions instead of passing under them.
 */
async function place(payload: unknown): Promise<NavigatorPlace> {
  const original = globalThis.fetch;

  globalThis.fetch = (async () => ({
    ok: true,
    json: async () => payload,
  })) as unknown as typeof fetch;

  try {
    const resolved = await lookupNavigatorPlace('irrelevant — the stub answers everything');

    if (resolved === null) throw new Error('the parser rejected a measured payload');

    return resolved;
  } finally {
    globalThis.fetch = original;
  }
}

const select = async (payload: unknown): Promise<RegionSelection | null> =>
  regionSelectionFrom(await place(payload));

/* ══════════════════════════════════════════════════════════════════════════
   1 — THE PROVINCE RESOLVES, AND THE OLD GUARD IS PINNED AS THE CAUSE
   ══════════════════════════════════════════════════════════════════════════ */

describe('a subnational navigator node resolves to a readable region', () => {
  it('Kigali resolves — name, type, scale and evidence country all from the node', async () => {
    const region = await select(KIGALI_PROVINCE);

    expect(region).not.toBeNull();
    expect(region!.name).toBe('Kigali');
    expect(region!.scale).toBe('SUBNATIONAL');
    expect(region!.regionType).toBe('ADMINISTRATIVE');
    expect(region!.withinCountryIso3).toBe('RWA');
  });

  it('the opaque id is preserved verbatim — copied, never parsed or rebuilt', async () => {
    const region = await select(KIGALI_PROVINCE);

    expect(region!.geographyId).toBe('admin1:RW-01');
  });

  it('it is framed from G’s own published bounds, not from an invented box', async () => {
    const region = await select(KIGALI_PROVINCE);

    expect(region!.extent).toEqual([30.05885, -1.94995, 30.1697, -1.9495]);
  });

  it('the published definition is carried, so the card stops claiming there is none', async () => {
    /*
      The old `admittedBy: 'iso3166-2'` fell to the UNDEFINED arm, whose copy
      reads "No definition is encoded for this region". ISO 3166-2 is a
      published international standard; that sentence was simply false.
    */
    const region = await select(KIGALI_PROVINCE);

    expect(region!.definition).toBe('iso3166-2-db@2.3.11');
    expect(region!.regionType).not.toBe('UNDEFINED');
  });

  it('NEGATIVE CONTROL — the retired guard still matches this node, so it is the cause', async () => {
    /*
      The proof that this file is testing the right thing. `place.kind !==
      'region'` is TRUE of the measured Kigali node, so the deleted line would
      discard it today exactly as it did live. Reinstating the guard fails the
      four tests above, and this one says why.
    */
    const node = await place(KIGALI_PROVINCE);

    expect(node.kind).toBe('admin1');
    expect(node.kind !== 'region').toBe(true);
  });

  it('and the guard is gone from the source, not merely bypassed', () => {
    /*
      COMMENTS STRIPPED FIRST, and a first draft of this test failed because
      they were not. The header of `regionSelectionFrom` QUOTES the retired
      line so a reader can see what was removed, and a raw substring search
      cannot tell that quotation from the code it describes. Stripping is what
      makes this an assertion about REACHABILITY rather than about text.
    */
    const source = readFileSync(
      resolve(__dirname, '..', '..', 'lib', 'map', 'region', 'regionSelection.ts'),
      'utf-8',
    )
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:])\/\/.*$/gm, '$1');

    expect(source).not.toContain("if (place.kind !== 'region') return null;");
    /* Classification happens in the one place that owns the ladder. */
    expect(source).toContain('regionScaleFor(place.kind)');

    /* POSITIVE CONTROL — stripping did not simply empty the file. */
    expect(source).toContain('export function regionSelectionFrom');
  });
});

/* ══════════════════════════════════════════════════════════════════════════
   2 — WHAT MUST NOT HAVE CHANGED
   ══════════════════════════════════════════════════════════════════════════ */

describe('widening the door did not widen anything else', () => {
  it('a published statistical region is untouched — type, members and extent', async () => {
    const region = await select(EASTERN_AFRICA);

    expect(region!.scale).toBe('SUPRANATIONAL');
    expect(region!.regionType).toBe('STATISTICAL');
    expect(region!.memberCount).toBe(18);
    expect(region!.extent).toEqual([22.67926, -25.96553, 63.41667, 15.77792]);
    /* No single evidence country. That is an answer, not a gap. */
    expect(region!.withinCountryIso3).toBeNull();
  });

  it('a CONTESTED region is still refused an extent — the rule this fix preserves', async () => {
    /*
      The guard that was widened protected THIS. Middle East is served with no
      bounds at all and would be refused one even if it had them, because
      flying a confident frame around a region whose membership is disputed is
      a claim the map would be making on the product's behalf.
    */
    const region = await select(MIDDLE_EAST);

    expect(region!.scale).toBe('SUPRANATIONAL');
    expect(region!.regionType).toBe('OPERATIONAL');
    expect(region!.extent).toBeNull();
    expect(region!.memberCount).toBeNull();
  });

  it('a COUNTRY is still not a region — it has its own evidence path', async () => {
    expect(await select(RWANDA)).toBeNull();
  });

  it('a CITY is still not a region — it has its own card and its own ceiling', async () => {
    const city = {
      ...KIGALI_PROVINCE,
      node: { ...KIGALI_PROVINCE.node, kind: 'city', precision: 'CITY' },
    };

    expect(await select(city)).toBeNull();
  });
});

/* ══════════════════════════════════════════════════════════════════════════
   3 — THE NUMBER THAT WOULD HAVE BEEN FABRICATED
   ══════════════════════════════════════════════════════════════════════════ */

describe('a province is never asked how many member countries it has', () => {
  it('the wire really does publish a members figure for Kigali', () => {
    /*
      Stated as a fixture assertion so the next reader does not have to take
      the comment on trust. This is why the row is omitted rather than left to
      render an empty state: there was no empty state to render.
    */
    expect(KIGALI_PROVINCE.node.bounds.members).toBe(2);
    expect(KIGALI_PROVINCE.node.bounds.source).toBe('derived-from-settlements');
  });

  it('and the selection refuses to carry it', async () => {
    const region = await select(KIGALI_PROVINCE);

    expect(region!.memberCount).toBeNull();
  });

  it('where the figure IS a membership it is carried unchanged', () => {
    expect(EASTERN_AFRICA.node.bounds.source).toBe('derived-from-member-country-extents');
  });
});

/* ══════════════════════════════════════════════════════════════════════════
   4 — REFRESH RESTORES THE READABLE IDENTITY
   ══════════════════════════════════════════════════════════════════════════ */

describe('the address survives a refresh and still names the node the lookup wants', () => {
  it('a subnational region round-trips without being folded into a node that does not exist', () => {
    const encoded = encodeSelection({ kind: 'REGION', id: 'admin1:RW-01' });

    expect(encoded).toBe('region:admin1:RW-01');
    expect(decodeSelection(encoded)).toEqual({ kind: 'REGION', id: 'admin1:RW-01' });
  });

  it('and the restored id is exactly what resolves against the live service', async () => {
    /*
      The join between the two halves of the refresh. The decoder produces
      `admin1:RW-01`; that is the id this suite's measured payload answers to.
    */
    const restored = decodeSelection('region:admin1:RW-01');
    const region = await select(KIGALI_PROVINCE);

    expect(restored!.id).toBe(region!.geographyId);
  });

  it('a supranational region still folds and unfolds as before', () => {
    const encoded = encodeSelection({ kind: 'REGION', id: 'region:eastern-africa' });

    expect(encoded).toBe('region:eastern-africa');
    expect(decodeSelection(encoded)).toEqual({ kind: 'REGION', id: 'region:eastern-africa' });
  });
});

/* ══════════════════════════════════════════════════════════════════════════
   5 — THE RAIL, RENDERED, IN BOTH LANGUAGES
   ══════════════════════════════════════════════════════════════════════════ */

const LOCALES = [
  ['en', en],
  ['pl', pl],
] as const;

/** Reader-facing text only. Attributes are diagnostics and are excluded here. */
const textOf = (html: string): string => html.replace(/<[^>]*>/g, ' ');

const card = (
  region: RegionSelection | null,
  dict: typeof en,
  withinCountryName?: string,
): string =>
  renderToStaticMarkup(
    createElement(RegionIdentityCard, {
      region,
      geographyId: 'admin1:RW-01',
      withinCountryName,
      labels: dict.map.spatial.region,
    }),
  );

describe('the REGION rail presents a resolved subnational identity', () => {
  for (const [locale, dict] of LOCALES) {
    it(`${locale} — the card is resolved and names the place`, async () => {
      const html = card(await select(KIGALI_PROVINCE), dict, 'Rwanda');

      expect(html).toContain('data-gn-region-resolved="true"');
      expect(html).toContain('Kigali');
    });

    it(`${locale} — the unresolved copy is nowhere on the surface`, async () => {
      /*
        The sentence the reader actually saw. Taken from the dictionary rather
        than typed here, so the assertion cannot drift from the copy and so no
        Polish literal is transcribed by hand.
      */
      const html = card(await select(KIGALI_PROVINCE), dict, 'Rwanda');

      expect(html).not.toContain(dict.map.spatial.region.unresolvedHeading);
      expect(html).not.toContain(dict.map.spatial.region.unresolvedBody);
    });

    it(`${locale} — the raw identifier is diagnostic metadata, not reader-facing copy`, async () => {
      const html = card(await select(KIGALI_PROVINCE), dict, 'Rwanda');

      expect(html).toContain('data-gn-geography-id="admin1:RW-01"');
      expect(textOf(html)).not.toContain('admin1:RW-01');
    });

    it(`${locale} — the evidence ceiling is named, and it is the country`, async () => {
      const html = card(await select(KIGALI_PROVINCE), dict, 'Rwanda');

      expect(html).toContain('data-gn="region-evidence-geography"');
      expect(textOf(html)).toContain('Rwanda');
      expect(html).toContain(dict.map.spatial.region.evidenceScopeBodySubnational);
      expect(html).not.toContain(dict.map.spatial.region.evidenceScopeBody);
    });

    it(`${locale} — no member-country row is offered for a province`, async () => {
      const html = card(await select(KIGALI_PROVINCE), dict, 'Rwanda');

      expect(html).not.toContain('data-gn="region-members"');
      expect(textOf(html)).not.toContain(dict.map.spatial.region.membersHeading);
      /* And above all, not the settlement count dressed as a membership. */
      expect(html).not.toContain('>2<');
    });

    it(`${locale} — the boundary refusal is the one that is true of a subdivision`, async () => {
      const html = card(await select(KIGALI_PROVINCE), dict, 'Rwanda');

      expect(html).toContain(dict.map.spatial.region.noBoundarySubnational);
      expect(html).not.toContain(dict.map.spatial.region.noBoundary);
    });

    it(`${locale} — the type line describes an administrative subdivision`, async () => {
      const html = card(await select(KIGALI_PROVINCE), dict, 'Rwanda');

      expect(html).toContain('data-gn-region-scale="SUBNATIONAL"');
      expect(html).toContain(dict.map.spatial.region.types.ADMINISTRATIVE);
      expect(html).not.toContain(dict.map.spatial.region.types.UNDEFINED);
    });

    it(`${locale} — POSITIVE CONTROL: an unresolved region still says so`, async () => {
      /*
        The fix must not have made the honest failure state unreachable. A null
        region is still the card that names the identifier and claims nothing.
      */
      const html = card(null, dict);

      expect(html).toContain('data-gn-region-resolved="false"');
      expect(html).toContain(dict.map.spatial.region.unresolvedHeading);
      expect(textOf(html)).toContain('admin1:RW-01');
    });

    it(`${locale} — POSITIVE CONTROL: a supranational region still renders as before`, async () => {
      const html = card(await select(EASTERN_AFRICA), dict, undefined);

      expect(html).toContain('data-gn-region-scale="SUPRANATIONAL"');
      expect(html).toContain('data-gn="region-members"');
      expect(html).toContain('>18<');
      expect(html).toContain(dict.map.spatial.region.evidenceScopeBody);
      expect(html).toContain(dict.map.spatial.region.noBoundary);
      expect(html).not.toContain('data-gn="region-evidence-geography"');
    });
  }
});

/* ══════════════════════════════════════════════════════════════════════════
   6 — THE COPY EXISTS IN BOTH LANGUAGES AND SAYS DIFFERENT THINGS
   ══════════════════════════════════════════════════════════════════════════ */

describe('the region dictionary is symmetric and complete', () => {
  it('EN and PL carry exactly the same keys', () => {
    expect(Object.keys(pl.map.spatial.region).sort()).toEqual(
      Object.keys(en.map.spatial.region).sort(),
    );
  });

  it('every region type has copy in both languages', () => {
    for (const [, dict] of LOCALES) {
      for (const type of REGION_TYPES) {
        expect(dict.map.spatial.region.types[type].length).toBeGreaterThan(0);
      }
    }
  });

  it('the two new sentences are genuinely translated, not copied across', () => {
    /*
      The cheap failure this catches: adding a key to `pl` with the English
      string in it. Both locales are checked for a Polish-only character rather
      than for inequality alone, which a typo would also satisfy.
    */
    for (const key of ['evidenceScopeBodySubnational', 'noBoundarySubnational'] as const) {
      expect(pl.map.spatial.region[key]).not.toBe(en.map.spatial.region[key]);
      expect(pl.map.spatial.region[key]).toMatch(/[ąćęłńóśźż]/);
    }

    expect(pl.map.spatial.region.types.ADMINISTRATIVE).not.toBe(
      en.map.spatial.region.types.ADMINISTRATIVE,
    );
  });

  it('the ADMINISTRATIVE line names its authority and claims no membership', () => {
    for (const [, dict] of LOCALES) {
      expect(dict.map.spatial.region.types.ADMINISTRATIVE).toContain('ISO 3166-2');
    }

    /* It must not have been written as a membership claim. */
    expect(en.map.spatial.region.types.ADMINISTRATIVE.toLowerCase()).not.toContain('member');
  });
});
