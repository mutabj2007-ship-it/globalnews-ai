import {
  RUNG_ORDER,
  admin2PriorityListForAudit,
  assertNavigationDoesNotRaiseEvidence,
  countryLadderContract,
  declaredLadderCountries,
  ladderDepthFor,
  nativeLadderFor,
  nativeLevelFor,
  navigableRungsBelow,
  precisionForRung,
  type EvidencePrecision,
  type NativeLadder,
  type NavigationPrecision,
} from './administrative-ladder.contract';
import { admin2Coverage } from './admin-name-corrections';
import { deriveScopeChain } from '../watch/geography-scope-chain';

/**
 * 2C — REGIONAL SEMANTICS / DEPTH CONTRACT.
 *
 * The contract 2D/2E/2F consume. Every assertion here is either a measurement
 * against the shipped artifact or a rule that a later package must not be able
 * to break by accident.
 */

/**
 * Narrows to a declared ladder, failing loudly if it is not one.
 *
 * A helper rather than a cast, because a cast would let an UNDECLARED result
 * through and then read `undefined` off it — turning a contract regression into
 * a confusing property error three lines later.
 */
function declaredLadder(iso2: string): NativeLadder {
  const result = nativeLadderFor(iso2);
  if (!result.declared) throw new Error(`expected a declared ladder for ${iso2}`);

  return result;
}

/* ── 1 · THE MACHINE RUNG IS NOT THE NATIVE LABEL ───────────────────────── */

describe('1 · a normalized rung is a coordinate, not a claim about the world', () => {
  it('maps rungs onto the presentation vocabulary, and that vocabulary is OURS', () => {
    expect(precisionForRung('COUNTRY')).toBe('COUNTRY');
    expect(precisionForRung('ADMIN1')).toBe('PROVINCE');
    expect(precisionForRung('ADMIN2')).toBe('DISTRICT');
    /*
     * THE TEMPORARY STAND-IN IS REMOVED. ADMIN3 reported DISTRICT while
     * GeoNodePrecision had no SECTOR token; it has one now, and reporting a
     * sector as a district would put a 45 km halo around a 4.5 km place.
     */
    expect(precisionForRung('ADMIN3')).toBe('SECTOR');
    expect(precisionForRung('CITY')).toBe('CITY');
  });

  it('THE SAME RUNG IS SIX DIFFERENT THINGS, AND THE CONTRACT SAYS SO', () => {
    /*
     * The measurement that forced this package. ADMIN1 holds an administrative
     * county in Kenya, a statistical region in Uganda, a traditional province
     * in Ireland, and the LOWEST administrative rung in Malta and Slovenia.
     */
    expect(nativeLevelFor('KE', 'ADMIN1')).toMatchObject({
      name: 'County',
      kind: 'ADMINISTRATIVE',
    });
    expect(nativeLevelFor('UG', 'ADMIN1')).toMatchObject({
      name: 'Region',
      kind: 'STATISTICAL',
    });
    expect(nativeLevelFor('IE', 'ADMIN1')).toMatchObject({
      name: 'Province',
      kind: 'TRADITIONAL',
    });
    expect(nativeLevelFor('MT', 'ADMIN1')).toMatchObject({
      name: 'Local council',
      kind: 'ADMINISTRATIVE',
    });
    expect(nativeLevelFor('SI', 'ADMIN1')).toMatchObject({ name: 'Municipality' });
    expect(nativeLevelFor('PL', 'ADMIN1')).toMatchObject({ name: 'Voivodeship' });
  });

  it('"PROVINCE: MUNSTER" IS NOW UNSAYABLE FROM THE CONTRACT', () => {
    // Ireland's provinces are real and govern nothing. A surface reading the
    // native level gets the right name AND the fact that it administers nothing.
    const ie = nativeLevelFor('IE', 'ADMIN1');

    expect(ie!.name).toBe('Province');
    expect(ie!.kind).toBe('TRADITIONAL');
    expect(ie!.kind).not.toBe('ADMINISTRATIVE');
  });

  it('UGANDA IS THE SHARPEST CASE — statistical rows above absent districts', () => {
    expect(nativeLevelFor('UG', 'ADMIN1')!.kind).toBe('STATISTICAL');
    expect(declaredLadder('UG').absentBelow.map((entry) => entry.name)).toContain('District');
  });

  it('an undeclared country gets a stated absence, never a guess', () => {
    const result = nativeLadderFor('ZW');

    expect(result.declared).toBe(false);
    expect((result as { reason: string }).reason.length).toBeGreaterThan(40);
    expect(JSON.stringify(result)).not.toContain('Province');
  });

  it('every declared level carries a name, a plural and a non-empty note', () => {
    for (const iso2 of declaredLadderCountries()) {
      for (const level of declaredLadder(iso2).levels) {
        expect(level.name.length).toBeGreaterThan(0);
        expect(level.plural.length).toBeGreaterThan(0);
        expect(level.note.length).toBeGreaterThan(30);
      }
    }
  });

  it('every absent level explains itself', () => {
    for (const iso2 of declaredLadderCountries()) {
      for (const gap of declaredLadder(iso2).absentBelow) {
        expect(gap.name.length).toBeGreaterThan(0);
        expect(gap.reason.length).toBeGreaterThan(30);
      }
    }
  });

  it('the freshness holds are carried on the level itself, not in a side note', () => {
    // R-GEO-FRESHNESS-LV and -SSD. A consumer reading only the ladder still
    // learns that the SET is unverified even though the NAME is right.
    expect(nativeLevelFor('LV', 'ADMIN1')!.note).toContain('FRESHNESS HOLD');
    expect(nativeLevelFor('SS', 'ADMIN1')!.note).toContain('FRESHNESS HOLD');
  });

  it('Kenya keeps its electoral axis SEPARATE from its administrative one', () => {
    // R-GEO-1: a constituency is not a sub-county even where boundaries coincide.
    const constituency = declaredLadder('KE').absentBelow.find(
      (entry) => entry.name === 'Constituency',
    );

    expect(constituency).toBeDefined();
    expect(constituency!.reason).toContain('ELECTORAL');
    expect(constituency!.reason).toContain('not a sub-county');
    expect(constituency!.reason).toContain('IEBC');
  });
});

/* ── 2 · DEPTH IS MEASURED, NOT LISTED ──────────────────────────────────── */

describe('2 · deepestSupportedLevel is driven by data, never by a country list', () => {
  it('R-GEO-DEPTH — DEPTH IGNORES admin2Priority IN BOTH DIRECTIONS', () => {
    /*
     * The prohibition, asserted mechanically. `admin2Priority` is a BUILD input
     * naming which countries the gazetteer builder was told to complete. If
     * depth were read from it, "supporting" a country would mean appending its
     * code — which is the expansion the ruling forbids.
     *
     * Direction 1: a country IN the list is deep because it has UNITS.
     * Direction 2: every country with units is deep whether or not it is listed.
     */
    const priority = admin2PriorityListForAudit();
    expect([...priority].sort()).toEqual(['PL', 'RW']);

    const measured = admin2Coverage()
      .filter((entry) => entry.units > 0)
      .map((entry) => entry.cc)
      .sort();

    for (const cc of measured) {
      const depth = ladderDepthFor(cc);
      const admin2 = depth.rungs.find((rung) => rung.rung === 'ADMIN2');

      expect(admin2!.supported).toBe(true);
      expect(admin2!.units).toBeGreaterThan(0);
    }

    // And a listed country with no units would NOT be deep. Nothing in the
    // implementation reads the list, which is what makes that true.
    for (const cc of priority) {
      const hasUnits = measured.includes(cc);
      const depth = ladderDepthFor(cc);
      expect(depth.rungs.find((r) => r.rung === 'ADMIN2')!.supported).toBe(hasUnits);
    }
  });

  it('ADMIN2 is supported for exactly the countries that have units — RW and PL today', () => {
    const supported = admin2Coverage()
      .filter((entry) => entry.units > 0)
      .map((entry) => entry.cc)
      .sort();

    expect(supported).toEqual(['PL', 'RW']);
    /*
     * 30, NOT 21. Rwanda's districts come from NISR now; `admin2Coverage()`
     * still reports the 21 GeoNames rows because that is what the artifact
     * holds, and the LADDER reports the authority. The two numbers differing is
     * the replacement working: one counts a gazetteer, the other counts
     * Rwanda's districts.
     */
    expect(ladderDepthFor('RW').rungs.find((r) => r.rung === 'ADMIN2')!.units).toBe(30);
    expect(ladderDepthFor('PL').rungs.find((r) => r.rung === 'ADMIN2')!.units).toBe(380);
  });

  it('EVERY UNSUPPORTED RUNG CARRIES A REASON — this is the deliverable', () => {
    for (const cc of ['KE', 'UG', 'TZ', 'SO', 'BI', 'CD', 'SS', 'IE', 'MT', 'SI', 'LU', 'LV']) {
      const depth = ladderDepthFor(cc);

      expect(depth.unsupportedBelow.length).toBeGreaterThan(0);
      for (const entry of depth.unsupportedBelow) {
        expect(entry.reason.length).toBeGreaterThan(40);
      }
    }
  });

  it('RW is complete to ADMIN3; PL still has the empty Sector rung below it', () => {
    /*
      RECONCILED WITH ADMIN3 — MAIN-FINAL-CORRECTED-ALPHA-CONVERGENCE-1, PO ruling 2.

      This used to read "RW and PL have NO unsupported rung, because their data
      is there", and its subject was ADMIN2: both countries carry second-level
      units, so neither had a hole. That is still asserted, and still the point.

      What changed is that the ladder now HAS a rung below ADMIN2. Sector is a
      declared rung with no dataset behind it for any country, so it appears as
      an honest hole for RW and PL exactly as it does for everyone else. An
      empty list here would now mean the new rung was being quietly hidden for
      the two countries whose data is best — the opposite of what this test is for.
    */
    /*
     * SUPERSEDED IN ONE DIRECTION ONLY. Sector used to be an honest hole for
     * every country including these two. Rwanda now has 416 real sectors, so
     * the hole is closed FOR RWANDA and stays open for Poland, which has no
     * sector dataset. Asserting both in one test is the point: a change that
     * closed the rung globally would pass a Rwanda-only assertion.
     */
    const rwanda = ladderDepthFor('RW');
    expect(rwanda.unsupportedBelow).toEqual([]);
    expect(rwanda.rungs.find((r) => r.rung === 'ADMIN2')?.supported).toBe(true);
    expect(rwanda.rungs.find((r) => r.rung === 'ADMIN3')?.supported).toBe(true);
    expect(rwanda.rungs.find((r) => r.rung === 'ADMIN3')?.units).toBe(416);

    const poland = ladderDepthFor('PL');
    expect(poland.unsupportedBelow.map((entry) => entry.rung)).toEqual(['ADMIN3']);
    expect(poland.rungs.find((r) => r.rung === 'ADMIN2')?.supported).toBe(true);
    expect(poland.rungs.find((r) => r.rung === 'ADMIN3')?.supported).toBe(false);
  });

  it("KENYA'S REASON NAMES THE LICENSING DEPENDENCY, not merely missing data", () => {
    expect(declaredLadder('KE').absentBelow.some((entry) => entry.reason.includes('IEBC'))).toBe(
      true,
    );
  });

  it('a picker is never offered a rung with a hole in it', () => {
    // Kenya has cities but no admin2, so ADMIN2 must not reach a dropdown even
    // though CITY below it is supported.
    expect(navigableRungsBelow('KE', 'COUNTRY')).toEqual(['ADMIN1', 'CITY']);
    expect(navigableRungsBelow('RW', 'COUNTRY')).toEqual(['ADMIN1', 'ADMIN2', 'ADMIN3', 'CITY']);
    expect(navigableRungsBelow('PL', 'ADMIN1')).toEqual(['ADMIN2', 'CITY']);
    expect(navigableRungsBelow('IE', 'ADMIN1')).toEqual(['CITY']);
  });

  it('THE LADDER TABLE CANNOT WIDEN DEPTH — naming a level is not supporting it', () => {
    /*
     * The guard that keeps section 2 of this module from becoming a second
     * admin2Priority. Ireland, Uganda, Malta and Kenya all have DECLARED
     * ladders and none of them gains an ADMIN2 rung from being declared.
     */
    for (const cc of declaredLadderCountries()) {
      const namesAdmin2 = declaredLadder(cc).levels.some((level) => level.rung === 'ADMIN2');
      const hasUnits = (admin2Coverage().find((entry) => entry.cc === cc)?.units ?? 0) > 0;

      // A ladder may only name ADMIN2 where the data actually carries it.
      if (namesAdmin2) expect(hasUnits).toBe(true);
    }
  });
});

/* ── 3 · THE THREE AXES STAY THREE ──────────────────────────────────────── */

describe('3 · navigation, evidence and entitlement precision never collapse', () => {
  it('NAVIGATION NEVER RAISES EVIDENCE — R-GEO-3, executable', () => {
    const evidence = 'COUNTRY' as EvidencePrecision;
    const navigation = 'CITY' as NavigationPrecision;

    // A map that can drill to a city does not make the story city-precise.
    expect(assertNavigationDoesNotRaiseEvidence(evidence, navigation)).toBe('COUNTRY');
  });

  it('the guard is total — evidence survives every navigation depth unchanged', () => {
    for (const navigation of ['COUNTRY', 'PROVINCE', 'DISTRICT', 'CITY'] as NavigationPrecision[]) {
      expect(assertNavigationDoesNotRaiseEvidence('COUNTRY' as EvidencePrecision, navigation)).toBe(
        'COUNTRY',
      );
    }
  });

  it('NO ENTITLEMENT VALUE EXISTS IN THIS MODULE', async () => {
    /*
     * R2 requires tier ceilings be read from configuration and never
     * hard-coded. The strongest way to keep that true here is for the module to
     * contain no tier vocabulary at all, asserted against its own source.
     */
    const source = await import('node:fs/promises').then((fs) =>
      fs.readFile(`${__dirname}/administrative-ladder.contract.ts`, 'utf-8'),
    );

    /*
     * WORD BOUNDARIES, NOT SUBSTRINGS. A naive `toContain('PRO')` matches
     * "PROVINCE" and would fail on correct code — which it did, on the first
     * run of this test. A guard that cries wolf gets deleted, so it is written
     * to match tier VOCABULARY rather than letters.
     */
    for (const forbidden of [
      /\bFREE\b/,
      /\bPRO\b/,
      /\bTEAM\b/,
      /\btier\b/i,
      /\bplan\b/i,
      /\bsubscription\b/i,
      /\bentitlementCeiling\b/,
    ]) {
      expect(source).not.toMatch(forbidden);
    }
  });

  it('depth is described as a DATA limit, never as a ceiling an upgrade lifts', () => {
    const depth = ladderDepthFor('KE');

    for (const entry of depth.unsupportedBelow) {
      expect(entry.reason.toLowerCase()).not.toContain('upgrade');
      expect(entry.reason.toLowerCase()).not.toContain('plan');
      expect(entry.reason).toMatch(/gazetteer|licens/i);
    }
  });
});

/* ── 4 · AGREEMENT WITH THE EXISTING WATCH IMPLEMENTATION ───────────────── */

describe('4 · the contract agrees with the Watch scope chain it will replace', () => {
  it.each(['RWA', 'KEN', 'POL', 'UGA'])(
    '%s — the DISTRICT gap is reported the same way by both',
    (iso3) => {
      /*
       * TWO IMPLEMENTATIONS OF ONE MEASUREMENT IS THE FAILURE THIS PROJECT KEEPS
       * HITTING — two folds, two verifiers. 2C does not rewire the Watch lane,
       * because Watch architecture is fenced; instead it asserts the two agree,
       * so a divergence fails here rather than being discovered later.
       */
      const watch = deriveScopeChain(`country:${iso3}`);
      const iso2 = { RWA: 'RW', KEN: 'KE', POL: 'PL', UGA: 'UG' }[iso3]!;
      const depth = ladderDepthFor(iso2);

      const watchBlocksDistrict = (watch.chain?.unsupportedBelow ?? []).some(
        (entry: { level: string }) => entry.level === 'DISTRICT',
      );
      const contractBlocksAdmin2 = depth.unsupportedBelow.some((entry) => entry.rung === 'ADMIN2');

      expect(contractBlocksAdmin2).toBe(watchBlocksDistrict);
    },
  );
});

/* ── 5 · THE SHAPE 2D/2E/2F CONSUME ─────────────────────────────────────── */

describe('5 · the per-country contract the regional packages will read', () => {
  it('carries identity, semantics and depth together', () => {
    const contract = countryLadderContract('rw');

    expect(contract.iso2).toBe('RW');
    expect(contract.ladder.declared).toBe(true);
    expect(contract.depth.deepestSupportedRung).toBe('CITY');
    /*
     * ADMIN3 joins the list for Rwanda, and only because 416 real sector units
     * are behind it. The rule that a rung with a hole never reaches a picker is
     * unchanged -- it is now satisfied rather than blocking.
     */
    expect(contract.navigableFromCountry).toEqual(['ADMIN1', 'ADMIN2', 'ADMIN3', 'CITY']);
  });

  it('CARRIES NO GEOMETRY AND NO LICENCE FIELD, deliberately', () => {
    /*
     * There is no boundary polygon anywhere in the artifact — all 215 country
     * extents and all 3,020 region extents are derived-from-settlements, and
     * 920 regions have none. Geometry is a readiness COLUMN in 2D/2E/2F, not a
     * field this contract could honestly populate, so it has none to be filled
     * in later by something that assumed it meant a border.
     */
    const contract = countryLadderContract('KE');
    const keys = new Set(Object.keys(contract));

    expect(keys.has('geometry')).toBe(false);
    expect(keys.has('bounds')).toBe(false);
    expect(keys.has('licence')).toBe(false);
    expect(keys.has('license')).toBe(false);
  });

  it('works for an undeclared country without inventing anything', () => {
    const contract = countryLadderContract('ZW');

    expect(contract.ladder.declared).toBe(false);
    expect(contract.depth.deepestSupportedRung).toBe('CITY');
    expect(contract.navigableFromCountry).toEqual(['ADMIN1', 'CITY']);
  });

  it('the rung order is coarse to fine and has exactly five members', () => {
    /*
      RECONCILED WITH ADMIN3 — PO ruling 2: "ADMIN3 / SECTOR becomes a
      first-class geography rung." The ORDER is what this test protects and the
      order is unchanged where it existed: ADMIN3 sits between ADMIN2 and CITY,
      which is where a sector is.
    */
    expect(RUNG_ORDER).toEqual(['COUNTRY', 'ADMIN1', 'ADMIN2', 'ADMIN3', 'CITY']);
  });

  it('EVERY EAC MEMBER RESOLVES — including Somalia, converged in 2A', () => {
    for (const iso2 of ['BI', 'CD', 'KE', 'RW', 'SO', 'SS', 'TZ', 'UG']) {
      expect(nativeLadderFor(iso2).declared).toBe(true);
    }
  });
});
