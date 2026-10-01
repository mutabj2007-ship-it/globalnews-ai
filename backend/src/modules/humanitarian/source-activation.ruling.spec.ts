import {
  ADMITTED_HUMANITARIAN_DENOTATIONS,
  FEED_LEVEL_COVERED_SCOPES,
  HUMANITARIAN_SOURCE_IDS,
  HUMANITARIAN_SOURCE_RULINGS,
  PRODUCT_OWNER_RIGHTS_QUESTIONS,
  PROTECTED_INFERENCE_SURFACES,
  REFUSED_HUMANITARIAN_DENOTATIONS,
  RIGHTS_SCOPES,
  RUNTIME_PERMITTING_VERDICT,
  SOURCE_ACTIVATION_VERDICTS,
  assertAcquisitionPermitted,
  assertDenotationAdmitted,
  assertFeedLevelLicenceCovers,
  assertFieldAdmitted,
  assertNoCompletenessClaim,
  assertRightsBasisIsAnInstrument,
  devCaptureImpliesRuntime,
  verdictPermitsRuntimeAcquisition,
  type HumanitarianSourceId,
  type RightsScope,
  type SourceActivationVerdict,
} from './source-activation.ruling';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * THE RULING, MEASURED
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Every assertion below is about the ruling's BEHAVIOUR, not its wording. E1's
 * standing rules apply to this file as much as to anything it reviews:
 *
 *   R-A  a guard is not evidence until a mutation proves it binds
 *   R-B  an empty or incomplete set satisfies every "contains no forbidden X"
 *        assertion vacuously
 *   R-C  a check that could not run is UNMEASURED, never PASS
 *   R-D  a probe reporting the unmutated or a uniform result did not fire
 *
 * R-B is why the first block counts the ruled sources before asserting anything
 * about them: "no source is cleared for runtime" is trivially true of an empty
 * table, and that is the exact shape of a vacuous pass.
 *
 * THE BITING MUTATIONS, NAMED so a reviewer can run them rather than trust this
 * paragraph:
 *
 *   M1  change any `verdict` to 'CLEARED_FOR_ALPHA_RUNTIME'
 *         -> "no source is cleared for Alpha runtime" FAILS, and the per-source
 *            acquisition refusal FAILS for that source.
 *   M2  make `verdictPermitsRuntimeAcquisition` return `true` unconditionally
 *         -> all three per-source acquisition refusals FAIL.
 *   M3  add 'body' to RELIEFWEB.admittedFields
 *         -> the third-party-text refusal FAILS.
 *   M4  add 'ASSET_OR_FACILITY' to ADMITTED_HUMANITARIAN_DENOTATIONS
 *         -> the facility refusal FAILS and the disjointness check FAILS.
 *   M5  empty `blockingConditions` on any ruling
 *         -> the "every unruled-for-runtime source carries a condition" check FAILS.
 */

describe('HUMANITARIAN-E1-SOURCE-ACTIVATION-R1 — the ruling', () => {
  /* ─── R-B: the set is non-empty and complete before anything is asserted ── */

  it('rules exactly the three sources in scope, and each exactly once', () => {
    expect(HUMANITARIAN_SOURCE_IDS).toHaveLength(3);
    expect([...HUMANITARIAN_SOURCE_IDS].sort()).toEqual([
      'COPERNICUS_EMS',
      'GDACS',
      'RELIEFWEB',
    ]);
    expect(Object.keys(HUMANITARIAN_SOURCE_RULINGS).sort()).toEqual([
      'COPERNICUS_EMS',
      'GDACS',
      'RELIEFWEB',
    ]);
    for (const id of HUMANITARIAN_SOURCE_IDS) {
      expect(HUMANITARIAN_SOURCE_RULINGS[id].sourceId).toBe(id);
    }
  });

  it('gives each source exactly one verdict, drawn from the fixed vocabulary', () => {
    expect(SOURCE_ACTIVATION_VERDICTS).toHaveLength(6);
    for (const id of HUMANITARIAN_SOURCE_IDS) {
      const verdict: SourceActivationVerdict = HUMANITARIAN_SOURCE_RULINGS[id].verdict;
      expect(SOURCE_ACTIVATION_VERDICTS).toContain(verdict);
    }
  });

  /* ─── "Do not activate anything", as a measurement ───────────────────────── */

  it('clears NO source for Alpha runtime (M1)', () => {
    const cleared = HUMANITARIAN_SOURCE_IDS.filter((id) =>
      verdictPermitsRuntimeAcquisition(HUMANITARIAN_SOURCE_RULINGS[id].verdict),
    );
    expect(cleared).toEqual([]);
  });

  it.each([...HUMANITARIAN_SOURCE_IDS])('refuses acquisition for %s (M2)', (id) => {
    expect(() => assertAcquisitionPermitted(id)).toThrow(
      /HUMANITARIAN_ACQUISITION_NOT_PERMITTED/,
    );
  });

  it('refuses an unruled source rather than defaulting it (R-B)', () => {
    expect(() => assertAcquisitionPermitted('WORLDPOP')).toThrow(/HUMANITARIAN_SOURCE_NOT_RULED/);
    expect(() => assertAcquisitionPermitted('')).toThrow(/HUMANITARIAN_SOURCE_NOT_RULED/);
  });

  it('keeps dev capture distinct from runtime acquisition', () => {
    expect(devCaptureImpliesRuntime()).toBe(false);
    expect(verdictPermitsRuntimeAcquisition('CLEARED_FOR_DEV_CAPTURE')).toBe(false);
    expect(verdictPermitsRuntimeAcquisition(RUNTIME_PERMITTING_VERDICT)).toBe(true);
  });

  it('carries at least one blocking condition for every source (M5)', () => {
    for (const id of HUMANITARIAN_SOURCE_IDS) {
      expect(HUMANITARIAN_SOURCE_RULINGS[id].blockingConditions.length).toBeGreaterThan(0);
    }
  });

  /* ─── Rights ─────────────────────────────────────────────────────────────── */

  it('states an instrument as the rights basis for every source', () => {
    for (const id of HUMANITARIAN_SOURCE_IDS) {
      const { rightsBasis, rightsEvidenceUrl } = HUMANITARIAN_SOURCE_RULINGS[id];
      expect(() => assertRightsBasisIsAnInstrument(rightsBasis)).not.toThrow();
      expect(new URL(rightsEvidenceUrl).protocol).toBe('https:');
    }
  });

  it.each(['curated', 'Curated', '  CURATION  ', 'publicly available', 'fair use', ''])(
    'refuses %p as a rights basis',
    (basis) => {
      expect(() => assertRightsBasisIsAnInstrument(basis)).toThrow(/RIGHTS_BASIS_/);
    },
  );

  it('does not let a feed-level instrument reach a third party’s item', () => {
    expect(RIGHTS_SCOPES).toHaveLength(4);
    for (const scope of FEED_LEVEL_COVERED_SCOPES) {
      expect(() => assertFeedLevelLicenceCovers(scope)).not.toThrow();
    }
    const uncovered: readonly RightsScope[] = ['THIRD_PARTY_ITEM', 'THIRD_PARTY_BINARY'];
    for (const scope of uncovered) {
      expect(() => assertFeedLevelLicenceCovers(scope)).toThrow(
        /RIGHTS_SCOPE_NOT_COVERED_BY_FEED_INSTRUMENT/,
      );
      expect(FEED_LEVEL_COVERED_SCOPES).not.toContain(scope);
    }
  });

  it('records attribution verbatim, or null, and never a reworded placeholder', () => {
    expect(HUMANITARIAN_SOURCE_RULINGS.COPERNICUS_EMS.attributionVerbatim).toBe(
      'Copernicus Emergency Management Service On-Demand Mapping (© European Union, 2012-present_year)',
    );
    expect(HUMANITARIAN_SOURCE_RULINGS.GDACS.attributionVerbatim).toBe(
      'Global Disaster Alert and Coordination System, GDACS',
    );
    // Not retrieved, therefore null — not an invented string and not an empty one.
    expect(HUMANITARIAN_SOURCE_RULINGS.RELIEFWEB.attributionVerbatim).toBeNull();
  });

  it('states each Product Owner question exactly once', () => {
    expect(PRODUCT_OWNER_RIGHTS_QUESTIONS).toHaveLength(2);
    expect(new Set(PRODUCT_OWNER_RIGHTS_QUESTIONS).size).toBe(2);
    for (const question of PRODUCT_OWNER_RIGHTS_QUESTIONS) {
      expect(question.trimEnd().endsWith('yes or no?')).toBe(true);
    }
  });

  /* ─── Fields ─────────────────────────────────────────────────────────────── */

  it('refuses ReliefWeb report full text and partner binaries (M3)', () => {
    for (const field of ['body', 'body-html', 'file', 'image', 'headline']) {
      expect(() => assertFieldAdmitted('RELIEFWEB', field)).toThrow(
        /HUMANITARIAN_FIELD_NOT_ADMITTED/,
      );
      expect(HUMANITARIAN_SOURCE_RULINGS.RELIEFWEB.admittedFields).not.toContain(field);
    }
    expect(() => assertFieldAdmitted('RELIEFWEB', 'source.name')).not.toThrow();
  });

  it('refuses GDACS impact estimates and prose', () => {
    for (const field of ['severitydata', 'sendai', 'impacts', 'description', 'htmldescription']) {
      expect(() => assertFieldAdmitted('GDACS', field)).toThrow(/HUMANITARIAN_FIELD_NOT_ADMITTED/);
    }
    expect(() => assertFieldAdmitted('GDACS', 'eventid')).not.toThrow();
  });

  it('admits for Copernicus exactly the fields the existing producer reads', () => {
    expect([...HUMANITARIAN_SOURCE_RULINGS.COPERNICUS_EMS.admittedFields].sort()).toEqual([
      'activationCode',
      'coordinates',
      'crs',
      'featureId',
      'geometryType',
      'productId',
    ]);
    for (const field of ['population', 'severity', 'classification', 'thirdPartyLayer']) {
      expect(() => assertFieldAdmitted('COPERNICUS_EMS', field)).toThrow(
        /HUMANITARIAN_FIELD_NOT_ADMITTED/,
      );
    }
  });

  it('refuses an undeclared field for every source, with no default', () => {
    for (const id of HUMANITARIAN_SOURCE_IDS) {
      expect(() => assertFieldAdmitted(id as HumanitarianSourceId, 'exactSiteName')).toThrow(
        /HUMANITARIAN_FIELD_NOT_ADMITTED/,
      );
    }
  });

  it('keeps admitted and refused field sets disjoint per source', () => {
    for (const id of HUMANITARIAN_SOURCE_IDS) {
      const { admittedFields, refusedFields } = HUMANITARIAN_SOURCE_RULINGS[id];
      for (const field of Object.keys(refusedFields)) {
        expect(admittedFields).not.toContain(field);
        expect(refusedFields[field]!.length).toBeGreaterThan(20);
      }
    }
  });

  /* ─── Protected geometry ─────────────────────────────────────────────────── */

  it('refuses facility, footprint and point-substitute denotations (M4)', () => {
    for (const denotation of Object.keys(REFUSED_HUMANITARIAN_DENOTATIONS)) {
      expect(() => assertDenotationAdmitted('COPERNICUS_EMS', denotation)).toThrow(
        /HUMANITARIAN_DENOTATION_NOT_ADMITTED/,
      );
      expect(ADMITTED_HUMANITARIAN_DENOTATIONS).not.toContain(denotation);
    }
    expect(Object.keys(REFUSED_HUMANITARIAN_DENOTATIONS)).toContain('ASSET_OR_FACILITY');
    expect(Object.keys(REFUSED_HUMANITARIAN_DENOTATIONS)).toContain('OBSERVATION_FOOTPRINT');
  });

  it('admits only the three denotations these sources may assert', () => {
    expect([...ADMITTED_HUMANITARIAN_DENOTATIONS].sort()).toEqual([
      'ADMINISTRATIVE_UNIT',
      'AFFECTED_AREA',
      'EVENT_LOCATION',
    ]);
    for (const denotation of ADMITTED_HUMANITARIAN_DENOTATIONS) {
      expect(() => assertDenotationAdmitted('GDACS', denotation)).not.toThrow();
    }
  });

  it('refuses an unknown denotation rather than admitting it', () => {
    expect(() => assertDenotationAdmitted('GDACS', 'CAMP_PERIMETER')).toThrow(
      /HUMANITARIAN_DENOTATION_NOT_ADMITTED/,
    );
  });

  it('names every protected inference surface the ruling closes', () => {
    expect(PROTECTED_INFERENCE_SURFACES).toHaveLength(6);
    expect(PROTECTED_INFERENCE_SURFACES).toContain('EXHAUSTIVE_ACTIVATION_INVENTORY');
    expect(PROTECTED_INFERENCE_SURFACES).toContain('ABSENCE_ASSERTION_FOR_AN_AREA');
  });

  /* ─── Completeness ───────────────────────────────────────────────────────── */

  it('lets no source claim ALL_ACTIVE_FOR_SCOPE, and refuses the claim if made', () => {
    for (const id of HUMANITARIAN_SOURCE_IDS) {
      const state = HUMANITARIAN_SOURCE_RULINGS[id].scopeCompleteness;
      expect(state).not.toBe('ALL_ACTIVE_FOR_SCOPE');
      expect(() => assertNoCompletenessClaim(id, state)).not.toThrow();
    }
    expect(() => assertNoCompletenessClaim('COPERNICUS_EMS', 'ALL_ACTIVE_FOR_SCOPE')).toThrow(
      /HUMANITARIAN_COMPLETENESS_CLAIM_REFUSED/,
    );
  });

  /* ─── Transport is declared, never registered ────────────────────────────── */

  it('declares a governed host without registering one, and no endpoint off it', () => {
    for (const id of HUMANITARIAN_SOURCE_IDS) {
      const { governedHost, permittedEndpoints } = HUMANITARIAN_SOURCE_RULINGS[id];
      expect(governedHost).toMatch(/^[a-z0-9.-]+$/);
      for (const endpoint of permittedEndpoints) {
        const url = new URL(endpoint);
        expect(url.protocol).toBe('https:');
        // The accepted gate compares the hostname EXACTLY: a subdomain is a
        // different host. An endpoint off the declared host would be unfetchable
        // by construction, which is a ruling that could never be executed.
        expect(url.hostname).toBe(governedHost);
      }
    }
    // Copernicus is blocked upstream of transport, so it rules no endpoint at all.
    expect(HUMANITARIAN_SOURCE_RULINGS.COPERNICUS_EMS.permittedEndpoints).toEqual([]);
  });
});
