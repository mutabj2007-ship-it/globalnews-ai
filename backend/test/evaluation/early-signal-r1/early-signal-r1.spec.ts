/**
 * ER1 T2 — OFFLINE DETERMINISTIC HARNESS (CTO R17 limited GO).
 *
 * QUEUED, NOT RUN. R17: executable suites wait for the single heavy runner and CTO authorisation.
 * Run (later, one process):  npx jest -c backend/test/evaluation/early-signal-r1/jest.config.json --runInBand
 *
 * Not picked up by the default backend run (`rootDir: src`) nor by e2e (`.e2e-spec.ts$`).
 * No network, no clock, no DB, no provider, no model. Fixtures are metadata-only.
 * Passing this harness is NOT evidence of monitoring, coverage or early detection.
 */
import ea from './fixtures/ea-17-cases.fixture.json';
import eight from './fixtures/eight-row-coverage.fixture.json';
import regions from './fixtures/regions.fixture.json';
import synthetic from './fixtures/synthetic-27.fixture.json';
import {
  CASUALTY_UNITS,
  DERIVABLE_CHANGE_STATES,
  type AccessState,
  type AlertTruthState,
} from './contract/early-signal.contract';
import {
  absenceWordingCode,
  alertTruth,
  assignReportingChain,
  associateCoverage,
  benchmarkRegionOf,
  bringsNewChainEvidence,
  canBeClaimOrigin,
  classifyReplay,
  combineQuantities,
  corroborate,
  evaluationChange,
  eventCountryFromEvidence,
  firstDiscoveryClaimSupported,
  forbiddenKeyPaths,
  leakageViolations,
  liveBringsNewEvidence,
  liveChangeStateOf,
  relationAllowed,
  sameEvent,
  type ChainEvidence,
  type RegisterRow,
} from './derive/early-signal.derive';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;
const S = (id: string): Any => (synthetic.cases as Any[]).find((c) => c.id === id);
const rows: RegisterRow[] = (eight.eaRegisterRows as Any[]).map((r) => ({
  sourceId: r.sourceId,
  iso3: r.iso3,
  host: r.host,
  duplicateOf: r.duplicateOf,
  technicalStatus: r.technicalStatus,
  checkedAt: r.checkedAt,
  isDirectoryListing: r.isDirectoryListing,
}));
const association = associateCoverage(rows);
const publisherOf = (id: string) => association.publishers.find((p) => p.registryIds.includes(id))!;
const deficitsOf = (id: string) => association.deficits.filter((d) => d.sourceId === id).map((d) => d.deficit).sort();

describe('ER1 T2 · fixture integrity (inventory, not behaviour)', () => {
  it('EA set: 17 cases, 6 replays, pinned to EA original sha256', () => {
    expect(ea.provenance.sha256).toBe('e13f8f84a21625164c9d22be002d55c0eb5073ab821124b79dba0b751b57de03');
    expect(ea.cases).toHaveLength(17);
    expect(ea.cases.filter((c: Any) => c.replay).map((c: Any) => c.id)).toEqual(['EA-ES-01', 'EA-ES-03', 'EA-ES-05', 'EA-ES-07', 'EA-ES-08', 'EA-ES-09']);
  });
  it('synthetic set: exactly 27 unique cases S-01..S-27, 8 of them the dropped-row associations', () => {
    const ids = (synthetic.cases as Any[]).map((c) => c.id);
    expect(ids).toEqual(Array.from({ length: 27 }, (_, i) => `S-${String(i + 1).padStart(2, '0')}`));
    expect((synthetic.cases as Any[]).filter((c) => c.group === 'EIGHT_ROW')).toHaveLength(8);
  });
  it('regions: 11 / 16 / 27 = 54, disjoint', () => {
    const all = [...regions.EAST_AFRICA, ...regions.MIDDLE_EAST, ...regions.EU27];
    expect([regions.EAST_AFRICA.length, regions.MIDDLE_EAST.length, regions.EU27.length]).toEqual([11, 16, 27]);
    expect(new Set(all).size).toBe(54);
  });
  it('no fixture carries a forbidden probability/forecast key', () => {
    expect(forbiddenKeyPaths(ea)).toEqual([]);
    expect(forbiddenKeyPaths(eight)).toEqual([]);
  });
});

describe('ER1 T2 · eight-row coverage association (CTO R17 §2A)', () => {
  it('runtime admission: 298 candidates, 290 admitted, exactly these 8 refused', () => {
    expect(eight.admission.candidates).toBe(298);
    expect(eight.admission.admittedRecords).toBe(290);
    expect(eight.canonicalIdentities).toHaveLength(290);
    expect((eight.admission.rejected as Any[]).map((r) => r.originalSourceId).sort()).toEqual(
      (synthetic.cases as Any[]).filter((c) => c.group === 'EIGHT_ROW').map((c) => c.input.sourceId).sort(),
    );
  });

  for (const id of ['S-01', 'S-02', 'S-03', 'S-04', 'S-05', 'S-06', 'S-07', 'S-08']) {
    it(`${id} · ${S(id).title}`, () => {
      const c = S(id);
      const p = publisherOf(c.input.sourceId);
      expect(p.publisherKey).toBe(c.expected.publisherKey);
      expect(deficitsOf(c.input.sourceId)).toEqual([...c.expected.deficits].sort());
      if (c.expected.countries) expect(p.countries).toEqual(c.expected.countries);
      if (c.expected.hostsInclude) for (const h of c.expected.hostsInclude) expect(p.hosts).toContain(h);
    });
  }

  it('the eight refused rows are NOT eight independent sources: 86 rows → 80 publishers (runtime keeps 78)', () => {
    // 86 research rows − 4 explicit aliases − 2 shared-host merges (unocha.org, ifrc.org) = 80 publishers.
    // The runtime register (78) drops the 4 shared-host rows outright; the association keeps them as
    // 2 publishers with multi-country coverage roles. Restoring them as 8 independent sources (86) is impossible.
    expect(rows).toHaveLength(86);
    expect(association.independenceUnits).toBe(80);
    expect(association.independenceUnits).not.toBe(86);
  });

  it('ALIAS_EVIDENCE_LOST is a coverage loss, not a permission (S-02): every row stays not-enabled and uncleared', () => {
    const ess = (eight.eaRegisterRows as Any[]).filter((r) => r.sourceId.startsWith('ea-r1:eth:ess'));
    expect(ess.map((r) => r.rightsStatus)).not.toContain('CLEARED');
    expect((eight.canonicalIdentities as Any[]).every((c) => c.activationStatus === 'DISABLED' && c.transport === 'NONE')).toBe(true);
  });

  it('NEGATIVE CONTROL: the 290 admitted identities have no host or name collision', () => {
    const ids = eight.canonicalIdentities as Any[];
    expect(new Set(ids.map((c) => c.canonicalHost)).size).toBe(290);
    expect(new Set(ids.map((c) => c.nameKey)).size).toBe(290);
    expect(new Set(ids.map((c) => c.sourceId)).size).toBe(290);
  });

  it('NEGATIVE CONTROL: outside the eight, no EA row gets a deficit', () => {
    const flagged = [...new Set(association.deficits.map((d) => d.sourceId))].sort();
    expect(flagged).toEqual(['ea-r1:cod:ocha', 'ea-r1:dji:redcrescent', 'ea-r1:eri:ministry', 'ea-r1:eri:redcross', 'ea-r1:eth:ess-current', 'ea-r1:ken:capital-current', 'ea-r1:rwa:nisr-apex', 'ea-r1:ssd:ocha']);
  });
});

describe('ER1 T2 · reporting chain and corroboration (CTO R17 §2C, E1 S-6)', () => {
  const run = (id: string) => corroborate((S(id).input.items as ChainEvidence[]).map(assignReportingChain));
  for (const id of ['S-09', 'S-10', 'S-11']) {
    it(`${id} · ${S(id).title}`, () => {
      const out = run(id);
      expect(out.state).toBe(S(id).expected.state);
      expect(out.independentChains).toEqual(S(id).expected.independentChains);
    });
  }
  it('host count never changes the chain decision (same evidence, different hosts → same chain)', () => {
    const base = (S('S-10').input.items as ChainEvidence[])[0];
    expect(assignReportingChain({ ...base, host: 'a.test' }).chainId).toBe(assignReportingChain({ ...base, host: 'b.test' }).chainId);
  });
  it('POSITIVE CONTROL: two genuinely independent first-party chains corroborate', () => {
    const out = corroborate([
      assignReportingChain({ itemId: 'p1', host: 'apnews.com', declaredWireOrigin: 'AP', declaredSyndicationOf: null, similarityClusterId: null, humanLinkedChainId: null, originSelf: true }),
      assignReportingChain({ itemId: 'p2', host: 'reuters.com', declaredWireOrigin: 'Reuters', declaredSyndicationOf: null, similarityClusterId: null, humanLinkedChainId: null, originSelf: true }),
    ]);
    expect(out.state).toBe('CORROBORATED');
  });
  it(`S-12 · ${S('S-12').title}`, () => {
    const c = S('S-12');
    expect(bringsNewChainEvidence(c.input.presentChains, assignReportingChain(c.input.incoming))).toBe(c.expected.newEvidence);
    // Arm A (documented gap): the live host rule counts a syndicated copy on a new host as new evidence.
    expect(liveBringsNewEvidence(c.input.presentHosts, [c.input.incoming.host])).toBe(c.armA.liveNewEvidence);
  });
});

describe('ER1 T2 · Story Alert truth (CTO R17 §2D, H D-1/D-2)', () => {
  for (const id of ['S-13', 'S-14', 'S-15']) {
    it(`${id} · ${S(id).title}`, () => {
      const c = S(id);
      expect(alertTruth(c.input)).toBe(c.expected.state as AlertTruthState);
      if (c.armA) expect(liveChangeStateOf(c.input)).toBe(c.armA.liveState);
    });
  }
});

describe('ER1 T2 · access states are never absence (F-1, F-3, D-28)', () => {
  for (const id of ['S-16', 'S-17', 'S-18']) {
    it(`${id} · ${S(id).title}`, () => {
      const c = S(id);
      expect(evaluationChange(c.input.access as AccessState, c.input.newEvidenceCount, c.input.hasBaseline)).toBe(c.expected.change);
      expect(absenceWordingCode(c.input.access as AccessState)).toBe(c.expected.wording);
    });
  }
  it('only the two derivable WatchChangeState members can ever be produced', () => {
    const produced = new Set<string | null>();
    for (const a of ['COMPLETED_MATCH', 'COMPLETED_NO_MATCH', 'PARTIAL', 'PROVIDER_FAILED', 'RIGHTS_WITHHELD', 'SEARCH_NOT_RUN', 'ACCESS_LIMITED'] as AccessState[])
      for (const n of [0, 1]) for (const b of [true, false]) produced.add(evaluationChange(a, n, b));
    expect([...produced].filter((x) => x !== null).sort()).toEqual([...DERIVABLE_CHANGE_STATES].sort());
  });
});

describe('ER1 T2 · geography and FRN (EA D1, CTO R17 §3)', () => {
  for (const id of ['S-19', 'S-20']) {
    it(`${id} · ${S(id).title}`, () => {
      for (const v of S(id).input.variants) expect(eventCountryFromEvidence(v.places)).toBe(v.expected);
    });
  }
  it(`S-21 · ${S('S-21').title}`, () => {
    const c = S('S-21');
    expect(benchmarkRegionOf(c.input.reportedAnnouncementPlace.iso3, regions)).toBe(c.expected.benchmarkRegion);
    expect(benchmarkRegionOf(c.input.reportedAnnouncementPlace.iso3, regions)).not.toBe(c.expected.notRegion);
    expect(eventCountryFromEvidence([c.input.reportedAnnouncementPlace])).toBe(c.expected.eventCountryFromEvidence);
    expect(canBeClaimOrigin(c.input.artefactKind)).toBe(c.expected.screenshotIsOrigin);
    expect(c.input.coalitionCountryCode).toBeNull();
  });
  it(`S-22 · ${S('S-22').title}`, () => {
    const c = S('S-22');
    expect(relationAllowed(c.input.relation)).toBe(false);
    expect(relationAllowed(c.expected.allowedAlternative)).toBe(true);
  });
});

describe('ER1 T2 · claims, events, replay, structure', () => {
  it(`S-23 · ${S('S-23').title}`, () => expect(sameEvent(S('S-23').input.a, S('S-23').input.b)).toBe(false));
  it(`S-24 · ${S('S-24').title}`, () => {
    const c = S('S-24');
    expect(sameEvent(c.input.reuters.event, c.input.bwiza.event)).toBe(false);
    expect(combineQuantities(c.input.reuters.quantity, c.input.bwiza.quantity).combined).toBe(false);
    expect(CASUALTY_UNITS).toContain(c.input.reuters.quantity.unit);
  });
  it(`S-25 · ${S('S-25').title}`, () => {
    const c = S('S-25');
    expect(firstDiscoveryClaimSupported(c.input.claimedFirstDiscoveredAt, c.input.loggedFirstObservedAt)).toBe(false);
    expect(classifyReplay(c.input.nzHerald)).toBe(c.expected.nzHeraldOutcome);
  });
  it(`S-26 · ${S('S-26').title}`, () => expect(forbiddenKeyPaths(S('S-26').input.candidate)).toEqual(S('S-26').expected.paths));
  it(`S-27 · ${S('S-27').title}`, () =>
    expect(leakageViolations(S('S-27').input.termsUsedBeforeCutoff, S('S-27').input.leakGuard).sort()).toEqual([...S('S-27').expected.violations].sort()));
});

describe('ER1 T2 · EA 17 real cases — structural rules only (not a system score)', () => {
  for (const c of ea.cases as Any[]) {
    it(`${c.id} · event country never taken from a not-event role; no COG by default; no coalition code`, () => {
      const v = c.eventCountry?.value;
      const codes = typeof v === 'string' ? [v.slice(0, 3)] : Array.isArray(v) ? v.map((x: string) => x.slice(0, 3)) : [];
      for (const code of codes) expect(Object.keys(c.notEventCountryRoles ?? {})).not.toContain(code);
      expect(codes).not.toContain('COG');
      for (const code of codes) expect(['FRN', 'AFC', 'ARC']).not.toContain(code);
    });
    it(`${c.id} · casualty units are typed, never summed`, () => {
      for (const k of c.claims) if (k.unit) expect(CASUALTY_UNITS as readonly string[]).toContain(k.unit);
    });
    if (c.replay)
      it(`${c.id} · replay protocol: every cutoff present; leak guard list well formed`, () => {
        expect(c.replayCutoffs.length).toBeGreaterThan(0);
        for (const r of c.replayCutoffs) expect(Array.isArray(r.leakGuard)).toBe(true);
      });
  }
  it('EA-ES-03 (FRN) is an East Africa benchmark', () => expect(benchmarkRegionOf('COD', regions)).toBe('EAST_AFRICA'));
});
