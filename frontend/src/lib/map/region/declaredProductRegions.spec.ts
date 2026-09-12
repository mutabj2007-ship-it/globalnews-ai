import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  DECLARED_PRODUCT_REGION,
  DECLARED_PRODUCT_REGIONS,
  REGIONAL_NO_CLAIM,
  coverageAccountingFor,
  declaredProductRegion,
  isDeclaredProductRegion,
  mayAggregateMemberEvidence,
  membersFor,
} from './declaredProductRegions';
import { regionEvidenceScope, regionMayHighlight, type RegionSelection } from './regionSelection';

const selection = (geographyId: string): RegionSelection =>
  ({ geographyId, regionType: 'STATISTICAL' } as unknown as RegionSelection);

/*
  The registry is read as TEXT rather than imported. Importing
  `@globalnews-ai/shared` pulls the whole package — gazetteer included — through
  ts-jest for one Set of three-letter codes, and on this validation host that
  alone exceeded the suite timeout. The regex is anchored on the registry's own
  field so it cannot match anything else in the file.
*/
const ISO3 = new Set(
  [...readFileSync(join(__dirname, '../../../../../shared/src/countries.ts'), 'utf8')
    .matchAll(/iso3: '([A-Z]{3})'/g)].map((m) => m[1]),
);

/*
  PO ruling 2 permits aggregation for the first time. A rule that GRANTS
  capability needs a tighter guard than one that withholds it, because the
  failure mode is a claim nobody notices being made. Everything below is written
  from that direction.
*/

describe('RSC-1 is narrowed, not repealed', () => {
  /* Of the seven labels the ruling named, two have since been GOVERNED by the
     Product Owner with explicit membership. The other five have not, and this
     is what keeps them ungoverned. */
  const UNGOVERNED = [
    'region:sahel',
    'region:balkans',
    'region:horn-of-africa',
    'region:great-lakes',
    'region:gulf-states',
    'region:global-south',
  ];

  it.each(UNGOVERNED)('%s still makes NO evidence claim', (id) => {
    expect(regionEvidenceScope(selection(id))).toBe(REGIONAL_NO_CLAIM);
    expect(isDeclaredProductRegion(id)).toBe(false);
  });

  it('an unrecognised region defaults to NO CLAIM rather than to capability', () => {
    expect(regionEvidenceScope(selection('region:something-new-from-G'))).toBe(REGIONAL_NO_CLAIM);
  });
});

describe('the four declared regions', () => {
  it('are exactly the four the Product Owner declared, and no more', () => {
    expect(DECLARED_PRODUCT_REGIONS.map((r) => r.id)).toEqual([
      'region:middle-east',
      'region:east-africa',
      'region:east-african-community',
      'region:europe',
    ]);
  });

  it.each(DECLARED_PRODUCT_REGIONS.map((r) => r.id))('%s aggregates, and is governed', (id) => {
    expect(regionEvidenceScope(selection(id))).toBe(DECLARED_PRODUCT_REGION);
  });

  it.each(DECLARED_PRODUCT_REGIONS)('$id names an authority, a version and a provenance path', (region) => {
    expect(region.authority.length).toBeGreaterThan(0);
    expect(region.authorityVersion.length).toBeGreaterThan(0);
    expect(region.provenance.length).toBeGreaterThan(0);
  });

  it('a BACKEND_PUBLISHED region never restates membership in the frontend', () => {
    /* Two sources of truth for membership is the failure RSC-1 refused to
       aggregate over. EAC and Europe are published by the backend; this file
       must not hold a second copy that can drift. */
    for (const region of DECLARED_PRODUCT_REGIONS.filter((r) => r.membershipSource === 'BACKEND_PUBLISHED')) {
      expect(region.members).toBeNull();
    }
  });

  it('a PRODUCT_GOVERNED region says so in its own provenance line', () => {
    for (const region of DECLARED_PRODUCT_REGIONS.filter((r) => r.membershipSource === 'PRODUCT_GOVERNED')) {
      expect(region.provenance).toMatch(/[Pp]roduct-governed/);
      expect(region.members).not.toBeNull();
    }
  });
});

describe('MIDDLE EAST — the declared Alpha coverage baseline', () => {
  const region = declaredProductRegion('region:middle-east');

  it('is exactly the sixteen countries declared, in the order declared', () => {
    expect(region?.members).toEqual([
      'BHR', 'EGY', 'IRN', 'IRQ', 'ISR', 'JOR', 'KWT', 'LBN',
      'OMN', 'PSE', 'QAT', 'SAU', 'SYR', 'TUR', 'ARE', 'YEM',
    ]);
  });

  it('records that it is an operational product decision, not an agreed geography', () => {
    expect(region?.authority).toBe('GlobalNews AI Alpha regional coverage baseline');
    expect(region?.provenance).toMatch(/not a claim that this membership is universally agreed/i);
  });

  it.each(['CYP', 'AFG', 'PAK', 'DZA', 'LBY', 'MAR', 'TUN', 'SDN'])(
    '%s is NOT a member, and is recorded as excluded rather than merely missing',
    (iso3) => {
      /* "Do not silently add … unless separately approved." Silence is what a
         later quiet addition would rely on, so each one is named. */
      expect(region?.members).not.toContain(iso3);
      expect(region?.excludedPending.map((e) => e.iso3)).toContain(iso3);
    },
  );
});

describe('EAST AFRICA — governed, and deliberately not the EAC', () => {
  const region = declaredProductRegion('region:east-africa');

  it('is exactly the eleven countries declared', () => {
    expect(region?.members).toEqual([
      'BDI', 'COD', 'DJI', 'ERI', 'ETH', 'KEN', 'RWA', 'SOM', 'SSD', 'TZA', 'UGA',
    ]);
  });

  it('is a DIFFERENT region from the East African Community', () => {
    expect(declaredProductRegion('region:east-african-community')?.membershipSource).toBe('BACKEND_PUBLISHED');
    expect(region?.membershipSource).toBe('PRODUCT_GOVERNED');
    expect(region?.id).not.toBe('region:east-african-community');
  });

  it.each(['SDN', 'ZMB'])('%s stays adjacent context, never a member', (iso3) => {
    expect(region?.members).not.toContain(iso3);
    const excluded = region?.excludedPending.find((e) => e.iso3 === iso3);
    expect(excluded?.reason).toMatch(/flashpoint|adjacent/i);
  });
});

describe('every declared member resolves in the shared country registry', () => {
  /* A member that does not resolve would be dropped silently by coverage
     accounting — it would neither be covered nor reported uncovered, which is
     the quietest possible way to lose a country. */
  it.each(
    DECLARED_PRODUCT_REGIONS.flatMap((r) => (r.members ?? []).map((iso3) => [r.id, iso3] as const)),
  )('%s member %s is a known country', (_regionId, iso3) => {
    expect(ISO3.has(iso3)).toBe(true);
  });
});

describe('the two things a governed scope still does NOT buy', () => {
  it('a declared region with no enumerated members may not aggregate', () => {
    expect(mayAggregateMemberEvidence('region:europe', [])).toBe(false);
    expect(mayAggregateMemberEvidence('region:europe', ['FRA', 'DEU'])).toBe(true);
    expect(mayAggregateMemberEvidence('region:sahel', ['MLI', 'NER'])).toBe(false);
  });

  it('no region may be painted, declared or not — knowing the members is not a boundary', () => {
    expect(regionMayHighlight(selection('region:middle-east'))).toBe(false);
    expect(regionMayHighlight(selection('region:sahel'))).toBe(false);
  });
});

describe('membersFor keeps the two membership sources apart', () => {
  it('a product-governed region answers from its own list and ignores the backend', () => {
    expect(membersFor('region:east-africa', ['XXX'])).toHaveLength(11);
  });

  it('a backend-published region answers from what the backend enumerated', () => {
    expect(membersFor('region:europe', ['FRA', 'DEU'])).toEqual(['FRA', 'DEU']);
  });

  it('an unresolved backend region is empty rather than guessed', () => {
    expect(membersFor('region:europe')).toEqual([]);
  });
});

describe('coverage accounting names the gap rather than counting it', () => {
  const members = ['BDI', 'COD', 'DJI', 'ERI', 'ETH'];

  it('uncovered members come back BY NAME, not as a number', () => {
    const acc = coverageAccountingFor('region:east-africa', members, new Set(['KEN', 'BDI', 'COD']));
    expect(acc.coveredMembers).toEqual(['BDI', 'COD']);
    expect(acc.uncoveredMembers).toEqual(['DJI', 'ERI', 'ETH']);
    expect(acc.complete).toBe(false);
  });

  it('silence is not zero activity — a member with no evidence is uncovered, never covered-with-0', () => {
    const acc = coverageAccountingFor('region:east-africa', members, new Set());
    expect(acc.coveredMembers).toEqual([]);
    expect(acc.uncoveredMembers).toEqual(members);
  });

  it('carries the provenance and the exclusions alongside the numbers they qualify', () => {
    const acc = coverageAccountingFor('region:middle-east', ['ISR', 'PSE'], new Set(['ISR']));
    expect(acc.provenance).toMatch(/[Pp]roduct-governed/);
    expect(acc.excludedPending.map((e) => e.iso3)).toContain('CYP');
    expect(acc.uncoveredMembers).toEqual(['PSE']);
  });

  it('complete requires every declared member, and an empty region is never complete', () => {
    expect(coverageAccountingFor('region:east-africa', members, new Set(members)).complete).toBe(true);
    expect(coverageAccountingFor('region:east-africa', [], new Set()).complete).toBe(false);
  });
});
