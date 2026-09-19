/**
 * Rights-enforcement and acquisition-policy tests.
 * Landed at ALPHA-MARKET-SCHEDULED-INGEST-PLATFORM-R1 from G-MARKET-DATA-ACQUISITION-R2.
 * G ran these with `node --test`; they run here under Jest. The assertions are unchanged.
 *
 * Every expectation is either an accepted contract clause (cited by its SI or M number),
 * a publisher's published figure, or a measurement from an earlier accepted G lane.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  RIGHTS_RECORDS,
  RATE_DECLARATIONS,
  CADENCE_DECLARATIONS,
  SEAM_DECLARATIONS,
  UNPUBLISHED_CONCURRENCY_CEILING,
  PROCUREMENT_TO_COMPANY_JOIN,
  MARKET_DECLARES_NO_SCORER,
  AcquisitionRefusal,
  assertProviderRightsPermitRunning,
  assertCadenceIsNotFasterThanPublisher,
  assertConcurrencyIsLawful,
  assertMergeIsAuthorised,
  seamDeclarationIsHonest,
  type CadenceDeclaration,
  type RateDeclaration,
} from './market-acquisition-declarations';
import {
  evaluateComextRequest,
  assertComextRequestIsPermitted,
  partnerBasedFilter_DO_NOT_USE,
  COMEXT_REPORTER_CARVE_OUTS,
  type ComextRequest,
} from './eurostat-comext-carveouts';

/*
  ── G'S ASSERTIONS, PRESERVED VERBATIM ───────────────────────────────────────
  G wrote these 23 tests against `node:test` + `node:assert/strict` and ran them with
  `node --experimental-strip-types`. This repository runs Jest, and the honest way to
  carry an acceptance bar across a runner is to change the RUNNER and not the
  ASSERTIONS — so every `assert.*` call below is byte-identical to G's, and this
  adapter is what makes them run here.

  Rewriting sixty-five assertions into `expect()` form would have been a silent
  opportunity to weaken one. This way, "G's 23/23 remain green" is a literal claim:
  the same test names, the same bodies, the same expectations.
*/
const assert = {
  equal: (actual: unknown, expected: unknown, message?: string): void => {
    expect(actual === expected ? expected : actual).toStrictEqual(expected);
    void message;
  },
  notEqual: (actual: unknown, expected: unknown): void => {
    expect(actual).not.toStrictEqual(expected);
  },
  deepEqual: (actual: unknown, expected: unknown): void => {
    expect(actual).toStrictEqual(expected);
  },
  ok: (value: unknown, message?: string): void => {
    expect(message === undefined ? Boolean(value) : [message, Boolean(value)]).toStrictEqual(
      message === undefined ? true : [message, true],
    );
  },
  match: (value: string, pattern: RegExp): void => {
    expect(value).toMatch(pattern);
  },
  throws: (fn: () => unknown, expected?: unknown): void => {
    expect(fn).toThrow(expected as never);
  },
  doesNotThrow: (fn: () => unknown): void => {
    expect(fn).not.toThrow();
  },
};
const comext = (over: Partial<ComextRequest>): ComextRequest => ({
  freq: 'M',
  reporter: 'DE',
  partner: 'PL',
  product: '8703',
  flow: '1',
  indicators: 'VALUE_IN_EUROS',
  ...over,
});

/* ── SI-17 · RIGHTS ───────────────────────────────────────────────────── */

test('SI-17.3 · an absent rights record is a refusal, not a permission', () => {
  assert.throws(() => assertProviderRightsPermitRunning('UNGM'), AcquisitionRefusal);
  assert.throws(() => assertProviderRightsPermitRunning(''), AcquisitionRefusal);
});

test('SI-17.2 · a provider whose recorded rights state is not E-5 does not run', () => {
  assert.equal(RIGHTS_RECORDS['WORLD_BANK']!.rightsClass, 'E-3');
  assert.equal(RIGHTS_RECORDS['ECB']!.rightsClass, 'E-2a');
  assert.throws(() => assertProviderRightsPermitRunning('WORLD_BANK'), AcquisitionRefusal);
  assert.throws(() => assertProviderRightsPermitRunning('ECB'), AcquisitionRefusal);
});

test('SI-17.4 · a rights state with no instrument is not a rights state', () => {
  for (const id of ['TED', 'GLEIF', 'EUROSTAT']) {
    const r = assertProviderRightsPermitRunning(id);
    assert.equal(r.rightsClass, 'E-5');
    assert.ok(r.instrument.trim().length > 0, `${id} carries a citable instrument`);
  }
});

test('SI-17.5 · product-side conditions are carried, not discharged', () => {
  const eurostat = RIGHTS_RECORDS['EUROSTAT']!;
  assert.ok(eurostat.productConditions.some((c) => /non-EU\/EFTA/.test(c)));
  assert.ok(eurostat.productConditions.some((c) => /does not version/.test(c)));
  // Eurostat does not retain history, so SI-10.4 snapshot retention is mandatory for it.
  assert.equal(eurostat.publisherRetainsHistory, false);
});

/* ── EUROSTAT CARVE-OUTS, ENFORCED ON `reporter` ──────────────────────── */

test('a carved-out REPORTER is refused, at every product level', () => {
  for (const reporter of ['CH', 'LI']) {
    const v = evaluateComextRequest(comext({ reporter }));
    assert.equal(v.permitted, false);
    assert.equal(v.axis, 'reporter');
    assert.throws(() => assertComextRequestIsPermitted(comext({ reporter })), AcquisitionRefusal);
  }
});

test('THE POINT · the same country as PARTNER is permitted, because the carve-out is not about it', () => {
  // Germany's trade with Switzerland is declared by Germany. Nothing carves it out.
  const v = evaluateComextRequest(comext({ reporter: 'DE', partner: 'CH' }));
  assert.equal(v.permitted, true);
  assert.equal(v.axis, 'none');
});

test('Austria is carved out at CN8 ONLY, and the length is what decides it', () => {
  assert.equal(
    evaluateComextRequest(comext({ reporter: 'AT', product: '87032190' })).permitted,
    false,
  ); // 8 digits
  assert.equal(
    evaluateComextRequest(comext({ reporter: 'AT', product: '870321' })).permitted,
    true,
  ); // CN6
  assert.equal(evaluateComextRequest(comext({ reporter: 'AT', product: '8703' })).permitted, true); // CN4
});

test('a PARTNER-BASED filter enforces nothing — demonstrated, not asserted', () => {
  // The request a partner filter is supposed to stop: Switzerland DECLARING a flow.
  const carvedOut = comext({ reporter: 'CH', partner: 'DE' });

  // The partner filter lets it straight through...
  assert.equal(partnerBasedFilter_DO_NOT_USE(carvedOut), true);
  // ...while the reporter-keyed enforcement refuses it.
  assert.equal(evaluateComextRequest(carvedOut).permitted, false);

  // And it refuses a request that was never carved out, so it is wrong in both directions.
  const permitted = comext({ reporter: 'DE', partner: 'CH' });
  assert.equal(partnerBasedFilter_DO_NOT_USE(permitted), false);
  assert.equal(evaluateComextRequest(permitted).permitted, true);
});

test('the non-EU/EFTA exclusion also keys on reporter', () => {
  const v = evaluateComextRequest(comext({ reporter: 'US' }));
  assert.equal(v.permitted, false);
  assert.equal(v.axis, 'reporter');
  assert.match(v.reason, /non-EU\/EFTA/);
  // A non-EU/EFTA PARTNER is not excluded — the grant is about whose data it is.
  assert.equal(evaluateComextRequest(comext({ reporter: 'PL', partner: 'US' })).permitted, true);
});

test('the carve-out list is data the predicate actually reads', () => {
  assert.equal(COMEXT_REPORTER_CARVE_OUTS.length, 3);
  for (const c of COMEXT_REPORTER_CARVE_OUTS) {
    assert.ok(c.instrument.trim().length > 0, `${c.reporter} carries its instrument`);
    const req = comext({
      reporter: c.reporter,
      product: c.scope.kind === 'PRODUCT_CODE_LENGTH' ? '0'.repeat(c.scope.length) : '8703',
    });
    assert.equal(evaluateComextRequest(req).permitted, false, `${c.reporter} is actually refused`);
  }
});

/* ── SI-2 · CADENCE ───────────────────────────────────────────────────── */

test('SI-2.2 · a declared cadence may never be faster than the publisher publishes', () => {
  for (const d of CADENCE_DECLARATIONS) assertCadenceIsNotFasterThanPublisher(d);

  const tooFast: CadenceDeclaration = {
    providerId: 'EUROSTAT',
    subjectClass: 'CORRIDOR',
    publisherReleaseCadence: 'MONTHLY',
    declaredCadence: 'DAILY',
    jitterFraction: 0.1,
    justification: 'none — this is the mutation',
    freshnessCeilingHours: null,
  };
  assert.throws(() => assertCadenceIsNotFasterThanPublisher(tooFast), AcquisitionRefusal);
});

test('SI-2.3 · IRREGULAR requires a declared check interval, it does not mean poll fast', () => {
  const sector = CADENCE_DECLARATIONS.find((d) => d.subjectClass === 'SECTOR')!;
  assert.equal(sector.publisherReleaseCadence, 'IRREGULAR');
  assert.equal(sector.irregularCheckIntervalHours, 24 * 30);

  const noInterval: CadenceDeclaration = { ...sector, irregularCheckIntervalHours: undefined };
  assert.throws(() => assertCadenceIsNotFasterThanPublisher(noInterval), AcquisitionRefusal);
});

test('SI-2.5 · every declaration carries a jitter fraction', () => {
  for (const d of CADENCE_DECLARATIONS) {
    assert.ok(d.jitterFraction > 0, `${d.providerId}/${d.subjectClass} declares jitter`);
    assert.ok(d.justification.trim().length > 0);
  }
});

test("GLEIF's freshness ceiling is 8 hours, so LIVE is unreachable and must not be implied", () => {
  const gleif = CADENCE_DECLARATIONS.find((d) => d.providerId === 'GLEIF')!;
  assert.equal(gleif.freshnessCeilingHours, 8);
  assert.notEqual(gleif.freshnessCeilingHours, 0);
});

/* ── SI-3 / SI-13 · RATE AND CONCURRENCY ──────────────────────────────── */

test("SI-3.2 · TED's ceiling is the publisher's published 3, and 4 is not configurable", () => {
  const ted = RATE_DECLARATIONS['TED']!;
  assert.equal(ted.maxConcurrent, 3);
  assert.equal(ted.concurrencyIsPublished, true);
  assertConcurrencyIsLawful(ted);

  const over: RateDeclaration = { ...ted, maxConcurrent: 4, concurrencyIsPublished: false };
  assert.throws(() => assertConcurrencyIsLawful(over), AcquisitionRefusal);
});

test('SI-3.3 · where no concurrency is published the ceiling is 1', () => {
  assert.equal(UNPUBLISHED_CONCURRENCY_CEILING, 1);
  for (const id of ['GLEIF', 'EUROSTAT']) {
    const d = RATE_DECLARATIONS[id]!;
    assert.equal(d.concurrencyIsPublished, false);
    assert.equal(d.maxConcurrent, 1);
    assertConcurrencyIsLawful(d);
    assert.throws(() => assertConcurrencyIsLawful({ ...d, maxConcurrent: 2 }), AcquisitionRefusal);
  }
});

test('accepted in-tree constants are reused, not re-derived', () => {
  for (const d of Object.values(RATE_DECLARATIONS)) {
    assert.equal(d.minRequestSpacingMs, 5_500);
    assert.equal(d.fetchTimeoutMs, 8_000);
    assert.equal(d.circuitCooldownMs, 60_000);
  }
});

test('GLEIF is acquired by bulk file, never by API traverse', () => {
  assert.equal(RATE_DECLARATIONS['GLEIF']!.acquisitionMode, 'BULK_FILE');
  // 60 req/min x 15 records per page against ~3.02m active LEIs is ~56 hours of polling.
  const recordsPerMinute = 60 * 15;
  const hours = 3_020_000 / recordsPerMinute / 60;
  assert.ok(hours > 50, `a full API traverse is ${hours.toFixed(0)} hours`);
});

/* ── SI-9 · VINTAGE HONESTY ───────────────────────────────────────────── */

test('SI-9 · no seam claims a publisher vintage it cannot retrieve', () => {
  for (const [id, seam] of Object.entries(SEAM_DECLARATIONS)) {
    const retains = RIGHTS_RECORDS[id]!.publisherRetainsHistory;
    assert.ok(seamDeclarationIsHonest(seam, retains), `${id} seam is honest`);
    assert.notEqual(seam.vintageProvenance, 'PUBLISHER_VINTAGE');
  }
});

test('SI-9 · a PUBLISHER_VINTAGE claim against a publisher with no history is refused', () => {
  const dishonest = {
    ...SEAM_DECLARATIONS['EUROSTAT']!,
    vintageProvenance: 'PUBLISHER_VINTAGE' as const,
  };
  assert.equal(seamDeclarationIsHonest(dishonest, false), false);
  assert.equal(seamDeclarationIsHonest(dishonest, true), true);
});

test("Comext's key dimensions are the collision shape eco:1 exists to fix", () => {
  const dims = SEAM_DECLARATIONS['EUROSTAT']!.sourceKeyDimensions;
  assert.equal(dims.length, 6);
  assert.ok(dims.includes('reporter'));
  assert.ok(dims.includes('partner'));
  // A naive join would collide: mixed-length digit strings plus values containing underscores.
  assert.notEqual(dims.join('_'), [...dims].reverse().join('_'));
});

/* ── C-15 · TED AND GLEIF STAY INDEPENDENT ────────────────────────────── */

test('C-15 · a merge without a cited deterministic authority is refused', () => {
  assert.equal(PROCUREMENT_TO_COMPANY_JOIN, 'NO_DETERMINISTIC_JOIN');
  assert.equal(MARKET_DECLARES_NO_SCORER, true);
  assert.throws(() => assertMergeIsAuthorised(undefined), AcquisitionRefusal);
  assert.throws(
    () => assertMergeIsAuthorised('LOOKS_LIKE_THE_SAME_COMPANY' as never),
    AcquisitionRefusal,
  );
  assert.doesNotThrow(() => assertMergeIsAuthorised('DOCUMENTED_AMENDMENT_OR_SUCCESSOR_CHAIN'));
});

test('C-15 · the prohibition is enforced by ABSENCE — these modules declare no scorer', () => {
  const here = __dirname;
  const sources = [
    readFileSync(join(here, 'market-acquisition-declarations.ts'), 'utf8'),
    readFileSync(join(here, 'eurostat-comext-carveouts.ts'), 'utf8'),
  ].join('\n');

  // The ban is on a scorer EXISTING, not on naming one. Comments explain why it is
  // forbidden, and a refusal message quotes the ruling it enforces — neither is a scorer.
  // So comments and string literals are stripped before the scan, and the one accepted
  // contract constant whose entire purpose is to declare the absence is allowed by name.
  const executable = sources
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((l) => !l.trimStart().startsWith('//'))
    .join('\n')
    // Template literals FIRST: they contain apostrophes ("the publisher's cadence"), and
    // stripping single-quoted strings before them mis-pairs those apostrophes and swallows
    // whole regions of real code. The negative control below is what caught that.
    .replace(/`(?:[^`\\]|\\.)*`/g, '``')
    .replace(/'(?:[^'\\\n]|\\.)*'/g, "''")
    .replace(/MARKET_DECLARES_NO_SCORER/g, '');

  const banned = ['similarity', 'confidence', 'matchStrength', 'probability', 'fuzzy', 'score'];
  for (const word of banned) {
    assert.ok(!new RegExp(word, 'i').test(executable), `no '${word}' in executable code`);
  }

  // NEGATIVE CONTROL: the scan can find a symbol that really is there.
  assert.ok(/assertMergeIsAuthorised/.test(executable));

  // POSITIVE CONTROL: the scan actually bites. A scorer written the way someone would
  // really write one is caught — otherwise the assertion above proves nothing.
  const withScorer =
    executable + '\nexport function entityMatchScore(a: string, b: string): number { return 0; }\n';
  const caught = banned.filter((w) => new RegExp(w, 'i').test(withScorer));
  assert.deepEqual(caught, ['score']);
});
