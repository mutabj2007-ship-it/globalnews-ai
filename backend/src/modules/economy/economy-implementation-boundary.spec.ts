import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * ECON-DATA-1 - GATE 6 - THE IMPLEMENTATION BOUNDARY, ASSERTED RATHER THAN
 * PROMISED.
 *
 * Every prohibition in the activation is checked against the Economy module's
 * own source. A boundary that is only stated in a report drifts; one that
 * fails a test does not.
 *
 * TWO EXCLUSIONS, BOTH DELIBERATE AND BOTH LEARNED THE HARD WAY HERE.
 *
 * 1. COMMENTS ARE STRIPPED. A guard that matches the prose describing it fires
 *    on its own documentation. That has happened in this codebase before (the
 *    OD-1 and no-detection scans) and the fix was the same.
 *
 * 2. THIS FILE EXCLUDES ITSELF. Stripping comments is not enough, because the
 *    forbidden tokens appear here as REGEX LITERALS - live code, not prose - so
 *    the scan matched itself on the first run and failed four of its own
 *    assertions. Recorded rather than quietly worked around: the alternative
 *    was to weaken the patterns until they no longer matched their own source,
 *    which would have weakened them against product code too. A test file that
 *    ships no product behaviour is the right thing to exempt; every file that
 *    does is still scanned, and the positive control below proves the set is
 *    not empty.
 */
const MODULE_DIR = __dirname;
const SELF = 'economy-implementation-boundary.spec.ts';

function sourceFilesWithoutComments(): Array<[string, string]> {
  return readdirSync(MODULE_DIR)
    .filter((f) => f.endsWith('.ts') && f !== SELF)
    .map((f) => {
      const raw = readFileSync(join(MODULE_DIR, f), 'utf8');
      const stripped = raw.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');

      return [f, stripped] as [string, string];
    });
}

describe('ECON-DATA-1 Gate 6 - what this module may not do', () => {
  const files = sourceFilesWithoutComments();

  it('scans a non-empty file set (positive control)', () => {
    /*
     * ADAPT-1: `economy-read-model.contract.ts` and
     * `economy-value-semantics.contract.ts` are GONE, and their absence is the
     * point — every member they declared moved to the accepted shared contract,
     * so a local file re-declaring any of them would be the duplicate semantics
     * this adaptation removes. Asserted below as an absence, not just dropped
     * from the list.
     */
    expect(files.length).toBeGreaterThanOrEqual(4);
    for (const gone of ['economy-read-model.contract.ts', 'economy-value-semantics.contract.ts']) {
      expect([gone, files.some(([n]) => n === gone)]).toEqual([gone, false]);
    }
    for (const required of [
      'economy-corridor.contract.ts',
      'economy-capability.contract.ts',
      'economy-observation-ledger.ts',
      'economy-source-class.adapter.ts',
    ]) {
      expect([required, files.some(([n]) => n === required)]).toEqual([required, true]);
    }
    expect(files.some(([n]) => n === SELF)).toBe(false);
  });

  /*
   * RE-AIMED BY ECON-DATA-CONTRACT-ADAPT-1, AND THE REASON MATTERS.
   *
   * This rule used to be "import TYPES only from shared". That was correct while
   * Economy declared its own semantics locally: a value import would have meant
   * Economy reaching into a shared runtime it had no business in.
   *
   * The accepted ECON-CONTRACT-1 inverts that premise. Economy is now REQUIRED to
   * consume shared runtime helpers - `economyObservationKey`,
   * `assertCorridorIsHonest`, `economyEvidenceRoleFor`, `economyHasObservationSource`
   * - because those ARE the canonical semantics, and re-implementing them locally
   * is exactly the duplicate-semantics failure the adaptation removes.
   *
   * So the guard is re-aimed rather than deleted, and it is now STRICTER in the
   * direction that still matters: Economy may consume the shared ECONOMY contract,
   * and may take TYPES from the platform's provenance model, but may not reach into
   * any OTHER shared runtime domain. A value import from watch, situation, conflict,
   * signals or analysis would be Economy behaving as part of another domain, which
   * is the thing the original rule was protecting.
   */
  it('takes runtime only from the shared ECONOMY contract and the provenance model', () => {
    const ECONOMY_RUNTIME = [
      'economyObservationKey',
      'economySeriesPeriodKey',
      'economyRetainVintages',
      'economyEvidenceRoleFor',
      'economyHasObservationSource',
      'assertConsensusIsNotObservation',
      'assertReleaseStatusIsApplicable',
      'assertAssessmentIsAccountable',
      'assertCorridorIsHonest',
      'ECONOMY_KEY_ENCODING_VERSION',
      'ECONOMY_CORRIDOR_CAPABILITIES',
      'ECONOMY_CATEGORIES',
    ];

    for (const [name, src] of files) {
      /*
         * BOUNDED DELIBERATELY. A lazy `[\s\S]*?` here spans from an EARLIER
         * import statement to the shared one, so `readFileSync` from 'node:fs'
         * was read as a shared binding. `[^;]*?` cannot cross a statement
         * boundary, which is what makes the clause the shared import's own.
         */
        const sharedImports = [
          ...src.matchAll(/import\s+([^;]*?)from\s+'@globalnews-ai\/shared'/g),
        ];

      for (const [, clause] of sharedImports) {
        // Every VALUE binding (one not prefixed `type`) must be a declared
        // Economy-contract runtime member.
        const bindings = [...clause.matchAll(/(?:^|[{,])\s*(type\s+)?([A-Za-z_][A-Za-z0-9_]*)/g)]
          .filter((m) => m[1] === undefined)
          .map((m) => m[2])
          .filter((n) => n !== 'import' && n !== 'type');

        for (const binding of bindings) {
          expect([name, binding, ECONOMY_RUNTIME.includes(binding)]).toEqual([name, binding, true]);
        }
      }
    }
  });

  it('reaches into no OTHER shared runtime domain', () => {
    for (const [name, src] of files) {
      for (const domain of ['watch', 'situation', 'conflict', 'signals', 'analysis', 'specialist']) {
        const pattern = new RegExp(`import[^;]*?from\\s+'[^']*shared[^']*${domain}[^']*'`, 'i');
        expect([name, domain, pattern.test(src)]).toEqual([name, domain, false]);
      }
    }
  });

  it('mutates no shared contract - nothing here writes to shared/', () => {
    for (const [name, src] of files) {
      expect([name, /shared\/src|writeFileSync\([^)]*shared/i.test(src)]).toEqual([name, false]);
    }
  });

  it('computes no attentionRank', () => {
    for (const [name, src] of files) {
      expect([name, /attentionRank/i.test(src)]).toEqual([name, false]);
    }
  });

  /*
   * The first version of this guard also matched the literal `watch.ts`, and it
   * fired on economy-corridor-geography.spec.ts - which READS that file to
   * prove ROUTE and TRADE_LANE are vocabulary with no geometry payload.
   *
   * Reading a shared file as evidence is not building Watch infrastructure, so
   * that one token was wrong, not the code it caught. It is removed and
   * replaced by something stricter rather than looser: the four tokens below
   * are the actual infrastructure surface, and the separate assertion after
   * them forbids IMPORTING the shared watch contract at all - which is what
   * "creates no Watch domain event infrastructure" actually means.
   */
  it('creates no Watch domain-event infrastructure', () => {
    for (const [name, src] of files) {
      expect([name, /WatchEvent|watchDomainEvent|emitWatch|WatchSubject/i.test(src)]).toEqual([
        name,
        false,
      ]);
    }
  });

  it('imports no Watch contract, in any form', () => {
    for (const [name, src] of files) {
      expect([name, /import[\s\S]*?from\s+'[^']*watch[^']*'/i.test(src)]).toEqual([name, false]);
      expect([name, /require\(\s*'[^']*watch[^']*'\s*\)/i.test(src)]).toEqual([name, false]);
    }
  });

  it('defines no Economy scorer - no score, weight, rank or threshold is computed', () => {
    for (const [name, src] of files) {
      if (name.endsWith('.spec.ts')) continue;
      expect([name, /\bscore\b|\bscoring\b|\bweight\b|\bthreshold\b|\brank\b/i.test(src)]).toEqual([
        name,
        false,
      ]);
    }
  });

  it('builds no map geometry architecture', () => {
    for (const [name, src] of files) {
      if (name.endsWith('.spec.ts')) continue;
      expect([name, /LineString|polyline|GeoJSON|FeatureCollection|maplibre|addLayer/i.test(src)]).toEqual(
        [name, false],
      );
    }
  });

  it('activates no provider and reads no secret', () => {
    for (const [name, src] of files) {
      expect([name, /process\.env|apiKey|API_KEY|secret|token\s*=/i.test(src)]).toEqual([name, false]);
    }
  });

  it('opens no second evidence pipeline - nothing here fetches', () => {
    for (const [name, src] of files) {
      expect([name, /\bfetch\(|axios|httpService|HttpService|\.get\(\s*['"]https?:/i.test(src)]).toEqual([
        name,
        false,
      ]);
    }
  });

  it('does not reuse the Design authority illustrative figures as production values', () => {
    for (const [name, src] of files) {
      if (name.endsWith('.spec.ts')) continue;
      // No numeric literal is presented as an economic value anywhere in the
      // non-test source: the module ships zero observations by construction.
      expect([name, /value:\s*-?\d/.test(src)]).toEqual([name, false]);
    }
  });
});
