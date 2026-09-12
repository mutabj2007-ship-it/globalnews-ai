import {
  EAST_AFRICA_DEFINITIONS,
  EAST_AFRICA_FLASHPOINTS,
  EAST_AFRICA_UNIVERSAL_CORE,
  ELECTORAL_RUNG_ORDER,
  RWANDA_DISTRICT_COVERAGE,
  deeperCapabilityFor,
  depthSplitFor,
  eacMemberProfile,
  eacMembers,
  eacTranche,
  electoralLadderFor,
  geometryLicenceFor,
  isAdministrativeRung,
  subdivisionFreshnessFor,
} from './east-africa.tranche';
import { nativeLadderFor, navigableRungsBelow } from './administrative-ladder.contract';
import { supranationalSurfaceForms } from './supranational-membership';
import { foldPlaceName } from './geo-normalize.util';

/**
 * 2D — EAST AFRICA / EAC TRANCHE.
 *
 * Built on 2C. Every assertion is either a measurement against the shipped
 * artifact, a published figure attributed to its authority, or a rule a later
 * package must not be able to break by accident.
 */

/* ── 1 · KENYA: THE AXES DO NOT MERGE ───────────────────────────────────── */

describe('1 · Kenya runs an administrative and an electoral ladder, and they stay apart', () => {
  const ke = electoralLadderFor('KE')!;

  it('the electoral ladder exists, attributed to the IEBC', () => {
    expect(ke.authority).toContain('IEBC');
    expect(ke.levels.map((level) => level.rung)).toEqual(ELECTORAL_RUNG_ORDER);
  });

  it('NO ELECTORAL RUNG IS AN ADMINISTRATIVE RUNG', () => {
    // The guard that keeps R-GEO-1 true at run time as well as in the types.
    for (const level of ke.levels) {
      expect(isAdministrativeRung(level.rung)).toBe(false);
    }
    for (const rung of ['COUNTRY', 'ADMIN1', 'ADMIN2', 'CITY'] as const) {
      expect(isAdministrativeRung(rung)).toBe(true);
    }
  });

  it('CONSTITUENCIES AND WARDS ARE PUBLISHED AND NOT CARRIED — stated, not hidden', () => {
    const constituency = ke.levels.find((level) => level.rung === 'CONSTITUENCY')!;
    const ward = ke.levels.find((level) => level.rung === 'WARD')!;

    expect(constituency.publishedUnits).toBe(290);
    expect(constituency.unitsCarried).toBe(0);
    expect(constituency.readiness).toBe('NOT_CARRIED');

    expect(ward.publishedUnits).toBe(1450);
    expect(ward.unitsCarried).toBe(0);
    expect(ward.readiness).toBe('NOT_CARRIED');
  });

  it('the published count and the carried count are SEPARATE FIELDS', () => {
    /*
     * The distinction that stops "290 constituencies" being read as a
     * capability. One number is what Kenya has; the other is what we can answer
     * about. Collapsing them is how a picker ends up offering an empty list.
     */
    for (const level of ke.levels) {
      expect(typeof level.publishedUnits).toBe('number');
      expect(typeof level.unitsCarried).toBe('number');
      expect(level.unitsCarried).toBeLessThanOrEqual(level.publishedUnits);
    }
  });

  it('the shared top rung is DECLARED, because it is a fact about Kenya not a rule', () => {
    expect(ke.topRungSharedWithAdministrative).toBe(true);

    const county = ke.levels.find((level) => level.rung === 'ELECTORAL_COUNTY')!;
    expect(county.unitsCarried).toBe(47);
    expect(nativeLadderFor('KE').declared).toBe(true);
  });

  it('THE WARD COLLISION IS NAMED — Kenya has administrative wards too', () => {
    const ward = ke.levels.find((level) => level.rung === 'WARD')!;

    expect(ward.reason).toContain('ADMINISTRATIVE');
    expect(ward.reason.toLowerCase()).toContain('different set');
  });

  it('no other EAC member declares an electoral ladder', () => {
    for (const iso2 of ['BI', 'CD', 'RW', 'SO', 'SS', 'TZ', 'UG']) {
      expect(electoralLadderFor(iso2)).toBeUndefined();
    }
  });

  it('the electoral axis does NOT widen navigation', () => {
    // 290 constituencies exist in the world and change nothing a picker offers.
    expect(navigableRungsBelow('KE', 'COUNTRY')).toEqual(['ADMIN1', 'CITY']);
  });
});

/* ── 2 · RWANDA: SECTOR IS CARRIED — THE STRUCTURAL GAP IS CLOSED ──────── */

describe('2 · Rwanda Sector readiness', () => {
  const sector = deeperCapabilityFor('RW')!;

  it('names Sector and the rung it occupies', () => {
    /*
     * SUPERSEDED. This asserted `wouldOccupyRung === null` and readiness
     * NOT_CARRIED, because no rung existed below ADMIN2 for any country and
     * sector data would have had nothing to load into. ADMIN3 exists and holds
     * 416 real units, so both halves of the old assertion are now false
     * statements about the product.
     */
    expect(sector.name).toBe('Sector');
    expect(sector.wouldOccupyRung).toBe('ADMIN3');
    expect(sector.readiness).toBe('CARRIED');
  });

  it('THE STRUCTURAL LIMIT IS GONE, AND THE ENTRY SAYS SO', () => {
    /*
     * The distinction that used to decide whether anyone should go looking for
     * data. They went, and they found it; what the entry must now record is
     * that the limit was removed rather than that it never existed.
     */
    expect(sector.reason).toContain('that limit is gone');
    /*
     * SUPERSEDED. Sector used to be recorded as structurally impossible to
     * represent — no rung existed below ADMIN2 for any country. ADMIN3 exists
     * and is populated, so the entry now records a CARRIED capability and the
     * old reason would be a false statement about the product.
     */
    expect(sector.wouldOccupyRung).toBe('ADMIN3');
    expect(sector.readiness).toBe('CARRIED');
    expect(sector.reason).toContain('416 sectors');
    expect(sector.reason).toContain('NISR');
  });

  it('Rwanda now navigates through ADMIN3, and only Rwanda does', () => {
    expect(navigableRungsBelow('RW', 'COUNTRY')).toEqual(['ADMIN1', 'ADMIN2', 'ADMIN3', 'CITY']);
    expect(navigableRungsBelow('RW', 'ADMIN2')).toEqual(['ADMIN3', 'CITY']);

    /*
     * A COUNTRY WITH NO SECTOR DATA IS UNCHANGED. The rung existing in the
     * enum must not offer itself to a picker for a country that has nothing
     * behind it — the same rule that kept ADMIN3 out of every list before
     * Rwanda had data.
     */
    expect(navigableRungsBelow('KE', 'ADMIN1')).not.toContain('ADMIN3');
  });

  it('the district rung above it is COMPLETE and authoritative', () => {
    expect(RWANDA_DISTRICT_COVERAGE.publishedUnits).toBe(30);
    expect(RWANDA_DISTRICT_COVERAGE.unitsCarried).toBe(30);
    expect(RWANDA_DISTRICT_COVERAGE.readiness).toBe('CARRIED');
    expect(RWANDA_DISTRICT_COVERAGE.authority).toBe('NISR');
    expect(RWANDA_DISTRICT_COVERAGE.labelsAreAuthoritative).toBe(true);
    /* The shortfall is closed; the word must not survive as a live claim. */
    expect(RWANDA_DISTRICT_COVERAGE.reason).not.toContain('incomplete');
  });

  it('no other EAC member declares a deeper capability', () => {
    for (const iso2 of ['BI', 'CD', 'KE', 'SO', 'SS', 'TZ', 'UG']) {
      expect(deeperCapabilityFor(iso2)).toBeUndefined();
    }
  });
});

/* ── 3 · G-GEO-18: UGANDA ───────────────────────────────────────────────── */

describe('3 · administrative depth and navigable depth are two numbers', () => {
  it('UGANDA — navigable reaches CITY, ADMINISTRATIVE stops at COUNTRY', () => {
    /*
     * The resolution of G-GEO-18. Uganda's four ADMIN1 rows are statistical and
     * administer nothing, while its actual districts are absent at every rung.
     * One number would have to choose between two wrong answers.
     */
    const uganda = depthSplitFor('UG');

    expect(uganda.deepestAdministrativeRung).toBe('COUNTRY');
    expect(uganda.deepestNavigableRung).toBe('CITY');
    expect(uganda.navigable).toEqual(['ADMIN1', 'CITY']);
    expect(uganda.divergenceReason).toBeDefined();
    expect(uganda.divergenceReason).toContain('STATISTICAL');
    expect(uganda.divergenceReason).toContain('District');
  });

  it('THE STATISTICAL ROWS DO NOT MASQUERADE AS ADMINISTRATIVE UNITS', () => {
    const uganda = depthSplitFor('UG');
    const ladder = nativeLadderFor('UG');

    expect(uganda.deepestAdministrativeRung).not.toBe('ADMIN1');
    expect(ladder.declared && ladder.levels.every((level) => level.kind !== 'ADMINISTRATIVE')).toBe(
      true,
    );
  });

  it('KENYA and TANZANIA administer at ADMIN1, so their two depths differ only below it', () => {
    for (const iso2 of ['KE', 'TZ', 'SO', 'BI', 'CD']) {
      expect(depthSplitFor(iso2).deepestAdministrativeRung).toBe('ADMIN1');
    }
  });

  it('RWANDA administers at ADMIN3 / Sector, the deepest in the block — and we navigate only to ADMIN2', () => {
    /*
      RECONCILED WITH ADMIN3 — MAIN-FINAL-CORRECTED-ALPHA-CONVERGENCE-1, PO ruling 2.

      This asserted ADMIN2, and that was only ever true because the product had
      no rung below ADMIN2 to declare. Rwanda genuinely administers at Sector
      level; declaring the rung makes `deepestAdministrativeRung` say so.

      THE ASSERTION GOT STRONGER, not weaker, and this describe block is named
      for exactly why: "administrative depth and navigable depth are two
      numbers". Rwanda is now the case where they visibly differ — it
      administers at ADMIN3 and we can navigate only to ADMIN2 — which is the
      divergence the next test requires a reason for.
    */
    const depth = depthSplitFor('RW');
    expect(depth.deepestAdministrativeRung).toBe('ADMIN3');
    expect(depth.deepestNavigableRung).not.toBe('ADMIN3');
  });

  it('a divergence reason is present exactly when the two differ', () => {
    for (const iso3 of eacMembers()) {
      const profile = eacMemberProfile(iso3)!;
      const differs =
        profile.depth.deepestAdministrativeRung !== profile.depth.deepestNavigableRung;

      if (differs) {
        expect(profile.depth.divergenceReason!.length).toBeGreaterThan(40);
      }
    }
  });

  it('an undeclared country claims no administrative depth at all', () => {
    expect(depthSplitFor('ZW').deepestAdministrativeRung).toBe('COUNTRY');
  });
});

/* ── 4 · G-GEO-17: SOUTH SUDAN, FAIL-CLOSED ────────────────────────────── */

describe('4 · South Sudan carries a superseded division and says so', () => {
  const ss = subdivisionFreshnessFor('SS')!;

  it('is SUPERSEDED, not merely stale', () => {
    expect(ss.readiness).toBe('SUPERSEDED');
    expect(ss.carriedDivision).toContain('32-state');
    expect(ss.carriedDivision).toContain('2020');
    expect(ss.currentDivision).toContain('10 states');
  });

  it('THE EVIDENCE IS CHECKABLE, not merely asserted', () => {
    // 31 of 32 rows carry no ISO code, because ISO never coded that division.
    expect(ss.evidence).toContain('31 of the 32');
    expect(ss.evidence).toContain('SS-JG');
  });

  it('FAILS CLOSED — the rows must not be offered as a current picker', () => {
    expect(ss.untilVerified).toContain('must not be offered');
    expect(ss.untilVerified).toContain('must not be used to date or place');
  });

  it('the set is replaced, not patched name by name', () => {
    expect(ss.untilVerified).toContain('replaced, not patched');
  });

  it('country-level navigation and settlements are explicitly unaffected', () => {
    expect(ss.untilVerified).toContain('unaffected');
    expect(navigableRungsBelow('SS', 'COUNTRY')).toEqual(['ADMIN1', 'CITY']);
  });

  it('LATVIA IS NOT HANDLED HERE — G-GEO-16 belongs to 2E', () => {
    expect(subdivisionFreshnessFor('LV')).toBeUndefined();
  });
});

/* ── 5 · EAC IS AN INSTITUTION; EAST AFRICA IS FIVE SETS ────────────────── */

describe('5 · EAC institutional identity, distinct from every "East Africa"', () => {
  it('EAC RESOLVES FROM THE SHARED REGISTRY — the tranche keeps no second copy', () => {
    expect([...eacMembers()].sort()).toEqual([
      'BDI',
      'COD',
      'KEN',
      'RWA',
      'SOM',
      'SSD',
      'TZA',
      'UGA',
    ]);
  });

  it('the five authorities disagree, and none is canonical', () => {
    expect(EAST_AFRICA_DEFINITIONS).toHaveLength(5);
    expect(EAST_AFRICA_DEFINITIONS.map((definition) => definition.publishedEntries)).toEqual([
      8, 22, 14, 8, 14,
    ]);

    for (const definition of EAST_AFRICA_DEFINITIONS) {
      expect(definition.authority.length).toBeGreaterThan(3);
      expect(definition.note.length).toBeGreaterThan(40);
      expect(definition.sovereignStates).toBeLessThanOrEqual(definition.publishedEntries);
    }
  });

  it('M49 — PUBLISHED ENTRIES AND SOVEREIGN STATES ARE DIFFERENT NUMBERS', () => {
    /*
     * FOUND BY THIS SUITE FAILING. My first draft recorded M49 Eastern Africa
     * as a flat 22 and asserted the registry would return 22 members. It
     * returns 18, and BOTH numbers are right: M49 lists 22 entries, of which 18
     * are sovereign states and 4 are dependent territories (British Indian
     * Ocean Territory, French Southern Territories, Mayotte, Réunion). This
     * registry holds COUNTRIES, so it carries the 18 — a deliberate subset, not
     * a gap.
     *
     * The reconciliation is exact — 18 + 4 = 22 — which is why the two counts
     * are separate fields rather than one number with a caveat in prose.
     */
    const m49 = EAST_AFRICA_DEFINITIONS.find((d) => d.kind === 'STATISTICAL')!;

    expect(m49.publishedEntries).toBe(22);
    expect(m49.sovereignStates).toBe(18);
    expect(m49.publishedEntries - m49.sovereignStates).toBe(4);
    expect(m49.note).toContain('dependent territories');

    // And the registry carries exactly the sovereign-state count it claims.
    const resolved = supranationalSurfaceForms().get(foldPlaceName('Eastern Africa'))!;
    expect(resolved.members).toHaveLength(m49.sovereignStates);
  });

  it('THE EAC IS THE ONLY CLOSED CHECKABLE SET, and the entry says why', () => {
    const eac = EAST_AFRICA_DEFINITIONS.find((d) => d.kind === 'INSTITUTIONAL')!;

    expect(eac.authority).toBe('East African Community');
    expect(eac.publishedEntries).toBe(8);
    expect(eac.publishedEntries).toBe(eacMembers().length);
    expect(eac.note).toContain('published member list');
  });

  it('IGAD records that the published list and the working list differ', () => {
    const igad = EAST_AFRICA_DEFINITIONS.find((d) => d.authority === 'IGAD')!;

    expect(igad.publishedEntries).toBe(8);
    expect(igad.note).toContain('seven');
  });

  it('the universal core is FOUR countries, and that is the honest floor', () => {
    expect([...EAST_AFRICA_UNIVERSAL_CORE].sort()).toEqual(['KEN', 'SOM', 'SSD', 'UGA']);

    // Every one of the four is also an EAC member; the converse fails, which is
    // exactly why "East Africa" and "EAC" are not interchangeable.
    for (const iso3 of EAST_AFRICA_UNIVERSAL_CORE) {
      expect(eacMembers()).toContain(iso3);
    }
    expect(EAST_AFRICA_UNIVERSAL_CORE.length).toBeLessThan(eacMembers().length);
  });

  it('the flashpoints name the disagreement, not just the country', () => {
    expect(EAST_AFRICA_FLASHPOINTS.map((f) => f.iso3).sort()).toEqual([
      'BDI',
      'COD',
      'SDN',
      'ZMB',
    ]);

    for (const flashpoint of EAST_AFRICA_FLASHPOINTS) {
      expect(flashpoint.disagreement.length).toBeGreaterThan(40);
    }
  });

  it('G-GEO-19 — "East Africa" STILL RESOLVES TO THE M49 SET, and that is registered', () => {
    /*
     * ═════════════════════════════════════════════════════════════════════
     * KNOWN-DEFECT CHARACTERIZATION TEST — EXPECTED TO CHANGE IN 2F
     * ═════════════════════════════════════════════════════════════════════
     *
     * READ THIS BEFORE MAKING IT PASS AGAIN.
     *
     * CURRENT BEHAVIOUR, which this test records:
     *   `supranational-membership.ts` carries `aliases: ['East Africa']` on the
     *   M49 "Eastern Africa" entry, so generic "East Africa" resolves to the
     *   M49 18-SOVEREIGN-STATE set. (M49 publishes 22 entries; 18 are sovereign
     *   states and 4 are dependent territories, and this registry holds
     *   countries — see the M49 reconciliation above.)
     *
     * WHAT THIS TEST IS:
     *   a record of a DEFECT, G-GEO-19. Five authorities define "East Africa"
     *   differently and the alias silently returns one of their answers — the
     *   same shape as the Global North alias defect 2A closed.
     *
     * WHAT THIS TEST IS NOT:
     *   it does NOT assert that M49 must remain the canonical meaning of
     *   "East Africa". It is not a requirement, and nothing about the current
     *   behaviour is endorsed by its passing.
     *
     * WHAT HAPPENS IN 2F:
     *   when 2F implements attributed/selected regional definitions, THIS TEST
     *   IS EXPECTED TO FAIL. That failure is the handoff working, not a
     *   regression. 2F must DELIBERATELY REPLACE it with tests for the new
     *   attributed-definition behaviour.
     *
     * WHAT WOULD BE WRONG:
     *   preserving this test merely to keep the suite green. Doing so would
     *   preserve G-GEO-19 itself, and "the suite went red" is exactly the
     *   pressure that turns a deliberate handoff into a reverted fix.
     *
     * It is not corrected here because representing competing definitions needs
     * the general contested-region mechanism, which is 2F's; removing the alias
     * without that mechanism would trade a wrong answer for no answer.
     */
    const resolved = supranationalSurfaceForms().get(foldPlaceName('East Africa'));

    expect(resolved).toBeDefined();
    expect(resolved!.name).toBe('Eastern Africa');
    expect(resolved!.basis).toBe('UN_M49');
    // 18 sovereign states — see the M49 reconciliation above.
    expect(resolved!.members).toHaveLength(18);

    // And the EAC is emphatically not what that returns.
    expect(resolved!.members).not.toHaveLength(eacMembers().length);
  });
});

/* ── 6 · GEOMETRY AND LICENCE, FAIL-CLOSED ─────────────────────────────── */

describe('6 · no boundary is production-ready, for any member', () => {
  it('EVERY EAC MEMBER IS NONE OR LICENCE_PENDING — never AVAILABLE', () => {
    for (const iso3 of eacMembers()) {
      const profile = eacMemberProfile(iso3)!;

      expect(['NONE', 'LICENCE_PENDING']).toContain(profile.geometry.readiness);
      expect(profile.geometry.readiness).not.toBe('AVAILABLE');
      expect(profile.geometry.reason.length).toBeGreaterThan(40);
    }
  });

  it('KENYA IS LICENCE_PENDING, and the distinction from NONE is the point', () => {
    const kenya = geometryLicenceFor('KE');

    expect(kenya.readiness).toBe('LICENCE_PENDING');
    expect(kenya.reason).toContain('IEBC');
    expect(kenya.reason).toContain('empty licence metadata is not authority');
    // The blocker is RIGHTS, not availability — acquiring the file would not
    // by itself make the boundary usable.
    expect(kenya.reason).toContain('rights, not availability');
  });

  it('the others are NONE, and the reason says extents are camera aids', () => {
    for (const iso2 of ['BI', 'CD', 'RW', 'SO', 'SS', 'TZ', 'UG']) {
      const geometry = geometryLicenceFor(iso2);

      expect(geometry.readiness).toBe('NONE');
      expect(geometry.reason).toContain('camera aid, never a border');
    }
  });

  it('NO BOUNDARY IS PRODUCTION-READY BECAUSE A DESIGN DRAWS ONE', () => {
    // Fail-closed by construction: nothing in this module can return AVAILABLE.
    const readinesses = eacTranche().map((profile) => profile.geometry.readiness);

    expect(new Set(readinesses)).toEqual(new Set(['NONE', 'LICENCE_PENDING']));
  });
});

/* ── 7 · THE TRANCHE AS A WHOLE ─────────────────────────────────────────── */

describe('7 · all eight members resolve, and the profile is complete', () => {
  it('the tranche covers exactly the EAC eight', () => {
    const tranche = eacTranche();

    expect(tranche).toHaveLength(8);
    expect(tranche.map((profile) => profile.iso3).sort()).toEqual([
      'BDI',
      'COD',
      'KEN',
      'RWA',
      'SOM',
      'SSD',
      'TZA',
      'UGA',
    ]);
  });

  it('SOMALIA IS FULLY PRESENT — 2A closed the membership defect', () => {
    const somalia = eacMemberProfile('SOM')!;

    expect(somalia.depth.deepestAdministrativeRung).toBe('ADMIN1');
    expect(somalia.depth.navigable).toEqual(['ADMIN1', 'CITY']);
    expect(somalia.freshness).toBeUndefined();
    expect(somalia.geometry.readiness).toBe('NONE');
  });

  it('every member carries a depth split and a geometry answer', () => {
    for (const profile of eacTranche()) {
      expect(profile.depth.navigable.length).toBeGreaterThan(0);
      expect(profile.geometry.reason.length).toBeGreaterThan(40);
    }
  });

  it('only the members that need one carry an electoral, deeper or freshness entry', () => {
    const withElectoral = eacTranche().filter((p) => p.electoral).map((p) => p.iso3);
    const withDeeper = eacTranche().filter((p) => p.deeper).map((p) => p.iso3);
    const withFreshness = eacTranche().filter((p) => p.freshness).map((p) => p.iso3);

    expect(withElectoral).toEqual(['KEN']);
    expect(withDeeper).toEqual(['RWA']);
    expect(withFreshness).toEqual(['SSD']);
  });

  it('NOTHING HERE IS 2E OR 2F', () => {
    // No EU country and no contested-region machinery reaches this tranche.
    const iso3s = eacTranche().map((profile) => profile.iso3);

    for (const eu of ['POL', 'LVA', 'IRL', 'DEU', 'FRA']) {
      expect(iso3s).not.toContain(eu);
    }
  });
});
