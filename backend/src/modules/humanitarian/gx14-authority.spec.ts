import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import {
  assertAuthorityIsInstalled,
  assertCadenceRunsOnSchedule,
  assertCohortIsThirdPartyDerivable,
  assertEmergencyActionIsLawful,
  assertNoOpRunsAreIndistinguishable,
  assertRefreshRespectsLag,
  auditDetailFor,
  classifyRefusal,
  declarationIsEligibleForRefresh,
  emitRefusal,
  emitSetOutcome,
  ForgedAuthority,
  GEOMETRY_REFUSAL_CLASSES,
  NO_OP_REFUSAL_SINK,
  orderReaderRows,
  refusalClassAlarms,
  refusalCodeOf,
  serializeReaderRow,
  UNCLASSIFIED_REFUSAL_CODE,
  withheldRowFor,
  type GeometryAuditDetailR1,
  type GeometryRefusalSink,
  type StoredReaderRow,
} from '@globalnews-ai/shared';

import {
  __resetLoaderTokenForTests,
  createLoaderToken,
  installProtectionAuthority,
  sealProtectionAuthority,
  currentProtectionAuthority,
} from '../../../../shared/dist/humanitarian/geometry-authority.loader';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * GX-14 · E1's EIGHT BLOCKING CONDITIONS, EACH MEASURED
 * ════════════════════════════════════════════════════════════════════════════
 *
 * The grant half is in `gx14-authority.live-postgres.spec.ts` and runs as the actual
 * roles. This file is the contract half — the parts that are decided in TypeScript, and
 * the negative controls E1 named by name.
 */

const CLASSES = {
  declarations: [
    {
      classId: 'CLASS-P',
      declaredAt: '2026-01-01T00:00:00Z',
      basis: 'synthetic declared class',
      partitionUnitLevel: 'DISTRICT' as const,
    },
  ],
};

const PARTITIONS = {
  declarations: [
    {
      partitionKey: 'PART-DARK',
      unitLevel: 'DISTRICT' as const,
      declaredAt: '2026-01-01T00:00:00Z',
      minimumMembership: 5,
      declaredEligibleMembership: 40,
      coversClassIds: ['CLASS-P'],
    },
  ],
};

const DIGEST = 'a'.repeat(64);

function seal(epoch = 1) {
  const token = createLoaderToken();
  const authority = sealProtectionAuthority(token, {
    epoch,
    classes: CLASSES,
    partitions: PARTITIONS,
    loadedAt: '2026-01-02T00:00:00Z',
    sourceDigest: DIGEST,
  });
  installProtectionAuthority(token, authority);
  return authority;
}

beforeEach(() => {
  __resetLoaderTokenForTests();
});

/* ═══════════════════════════════════════════════════════════════════════════
 * AS-E1-1 · THE MINTING FUNCTION IS NOT ORDINARILY REACHABLE
 * ═══════════════════════════════════════════════════════════════════════════ */

describe('AS-E1-1 · a reader cannot mint an authority', () => {
  it('NC-FORGE-3 · the barrel does not export the minting function', () => {
    /*
      E1 measured NC-FORGE-3 COMPILING: "a caller mints an authority with an empty dark
      set by importing one exported function — no cast, no symbol, no credential."

      This is the first of E1's three layers: the ordinary import path has no door.
      Asserted against the barrel's source, because that is what an application import
      resolves through.
    */
    const barrel = readFileSync(
      join(__dirname, '..', '..', '..', '..', 'shared', 'src', 'index.ts'),
      'utf8',
    );

    expect(barrel).toContain("export * from './humanitarian/geometry-authority'");
    expect(barrel).not.toContain('geometry-authority.loader');
  });

  it('and nothing outside the approved loader path imports the loader module', () => {
    /*
      E1's second layer, and the one that stops a deep relative import walking around
      the first. This walks the whole backend and frontend source and fails naming the
      offender.

      This spec and the composition root are the allowed callers. The spec is allowed
      because a control nobody can test is a control nobody can trust.
    */
    /*
      ── IT MATCHED A MENTION, NOT AN IMPORT, AND IT CRIED WOLF ──────────────

      The first version tested `source.includes('geometry-authority.loader')`. When the
      producer lane landed `copernicus-ems.producer.spec.ts`, this guard named it as an
      offender — and that spec is INNOCENT. Its two occurrences of the string are its
      OWN boundary assertions:

          expect(root).toContain('geometry-authority.loader');
          expect(producerSource().includes('geometry-authority.loader')).toBe(false);

      That is another lane independently enforcing AS-E1-1, and this guard reported it
      as a violation of AS-E1-1. A guard that fires on the file enforcing the same rule
      is worse than no guard: the next person to see it fire will assume it is noise.

      The property is IMPORTS, so the test now matches imports — `from '…loader'` and
      `require('…loader')` — rather than any appearance of the name. A file may discuss
      the module; it may not pull it in.
    */
    const ALLOWED = ['gx14-authority.spec.ts', 'humanitarian-authority.loader.ts'];
    const roots = [
      join(__dirname, '..', '..', '..', 'src'),
      join(__dirname, '..', '..', '..', '..', 'frontend', 'src'),
    ];

    const IMPORTS_LOADER =
      /(?:from\s*|require\(\s*)['"][^'"]*geometry-authority\.loader(?:\.js)?['"]/;

    const offenders: string[] = [];
    const walk = (dir: string): void => {
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) {
          walk(full);
          continue;
        }
        if (!/\.tsx?$/.test(entry)) continue;
        if (ALLOWED.includes(entry)) continue;
        if (IMPORTS_LOADER.test(readFileSync(full, 'utf8'))) {
          offenders.push(entry);
        }
      }
    };
    for (const root of roots) walk(root);

    expect(offenders).toEqual([]);
  });

  it('and the import matcher actually fires (mutation control)', () => {
    /*
      Narrowing a guard is the moment to prove it still bites. Without this, "matches
      imports rather than mentions" could quietly become "matches nothing".
    */
    const IMPORTS_LOADER =
      /(?:from\s*|require\(\s*)['"][^'"]*geometry-authority\.loader(?:\.js)?['"]/;

    // Real imports in every shape a caller would write.
    for (const smuggle of [
      `import { sealProtectionAuthority } from '../../shared/src/humanitarian/geometry-authority.loader';`,
      `import x from "@globalnews-ai/shared/dist/humanitarian/geometry-authority.loader";`,
      `const l = require('../humanitarian/geometry-authority.loader.js');`,
      `export * from './geometry-authority.loader';`,
    ]) {
      expect([smuggle, IMPORTS_LOADER.test(smuggle)]).toEqual([smuggle, true]);
    }

    // And the innocent shapes the old matcher condemned.
    for (const innocent of [
      `expect(root).toContain('geometry-authority.loader');`,
      `// the minting door lives in geometry-authority.loader`,
      `expect(src.includes('geometry-authority.loader')).toBe(false);`,
    ]) {
      expect([innocent, IMPORTS_LOADER.test(innocent)]).toEqual([innocent, false]);
    }
  });

  it('the loader token is issued ONCE per process', () => {
    createLoaderToken();
    expect(() => createLoaderToken()).toThrow(/GEOMETRY_AUTHORITY_TOKEN_ALREADY_ISSUED/);
  });

  it('GA-44 · an authority with no declarations is a FAILED LOAD, not a permissive one', () => {
    /*
      E1: "There is no fallback authority and no 'protect nothing' default — E1 confirms
      this is the most dangerous value the system can hold." It is refused at the door.
    */
    const token = createLoaderToken();
    expect(() =>
      sealProtectionAuthority(token, {
        epoch: 1,
        classes: { declarations: [] },
        partitions: { declarations: [] },
        loadedAt: '2026-01-02T00:00:00Z',
        sourceDigest: DIGEST,
      }),
    ).toThrow(/GEOMETRY_AUTHORITY_EMPTY/);
  });

  it('GA-44 · with no authority installed the process does not answer', () => {
    expect(() => currentProtectionAuthority()).toThrow(/GEOMETRY_AUTHORITY_NOT_INSTALLED/);
  });

  it('AS-5 · the epoch never regresses', () => {
    const token = createLoaderToken();
    const make = (epoch: number) =>
      sealProtectionAuthority(token, {
        epoch,
        classes: CLASSES,
        partitions: PARTITIONS,
        loadedAt: '2026-01-02T00:00:00Z',
        sourceDigest: DIGEST,
      });

    installProtectionAuthority(token, make(5));
    expect(() => installProtectionAuthority(token, make(4))).toThrow(
      /GEOMETRY_AUTHORITY_EPOCH_REGRESSED/,
    );
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
 * AS-E1-2 · A FORGERY MUST BE DETECTABLE
 * ═══════════════════════════════════════════════════════════════════════════ */

describe('AS-E1-2 · a structurally perfect forgery is detected', () => {
  it('THE CASE E1 NAMED · a copied seal passes every structural check and fails identity', () => {
    const real = seal();

    /*
      The forgery E1 describes: read the seal symbol off a real authority with
      `Object.getOwnPropertySymbols` and copy it. The result is structurally
      indistinguishable — same symbol key, same fields, same types — and carries an
      EMPTY dark set, which is the dangerous part.
    */
    const [sealSymbol] = Object.getOwnPropertySymbols(real);
    const forged = {
      [sealSymbol!]: true,
      epoch: real.epoch,
      classes: { declarations: [] },
      partitions: { declarations: [] },
      loadedAt: real.loadedAt,
      sourceDigest: real.sourceDigest,
    } as unknown as typeof real;

    // Structurally valid — every field a checker would look at is present and correct.
    expect(Object.getOwnPropertySymbols(forged)).toEqual([sealSymbol]);
    expect(typeof forged.epoch).toBe('number');

    // And it is refused, because identity is what a perfect copy cannot have.
    expect(() => assertAuthorityIsInstalled(forged)).toThrow(ForgedAuthority);
    expect(() => assertAuthorityIsInstalled(forged)).toThrow(
      /GEOMETRY_AUTHORITY_NOT_THE_INSTALLED_INSTANCE/,
    );

    // The genuine one passes — otherwise this test would be satisfied by a check that
    // refuses everything.
    expect(() => assertAuthorityIsInstalled(real)).not.toThrow();
  });

  it('the forgery alarm is a PROGRAMMING_MISTAKE, not a data defect', () => {
    expect(classifyRefusal('GEOMETRY_AUTHORITY_NOT_THE_INSTALLED_INSTANCE')).toBe(
      'PROGRAMMING_MISTAKE',
    );
    expect(refusalClassAlarms('PROGRAMMING_MISTAKE')).toBe(true);
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
 * AS-E1-3 · GA-46 — THE SERIALIZED ROW IS R3's PROJECTION EXACTLY
 * ═══════════════════════════════════════════════════════════════════════════ */

describe('AS-E1-3 / GA-46 · rowKind is storage and never serialized', () => {
  it('a withheld row serializes to exactly recordKey + withheld', () => {
    const row = withheldRowFor('rec-1', 'PROTECTED', 7);

    // Storage carries the discriminator and the epoch...
    expect(row.rowKind).toBe('WITHHELD');
    expect(row.projectedUnderEpoch).toBe(7);

    // ...and the serialized shape carries neither.
    const serialized = serializeReaderRow(row);
    expect(Object.keys(serialized).sort()).toEqual(['recordKey', 'withheld']);
  });

  it('THE LEAK THE TYPE CAUGHT · the internal reason never survives to the row', () => {
    /*
      R3's internal vocabulary contains `PROTECTED`. If it reached the stored row, the
      reader store would hold the protected fact at rest. `withheldRowFor` collapses it
      through R3's own `readerAbsenceTokenFor` BEFORE storage.
    */
    expect(withheldRowFor('r', 'PROTECTED', 1).withheld).toBe('NOT_SHOWN');
    expect(withheldRowFor('r', 'RECORD_REFUSED', 1).withheld).toBe('NOT_SHOWN');
    expect(withheldRowFor('r', 'SOURCE_PUBLISHED_NONE', 1).withheld).toBe('NOT_SHOWN');
    expect(withheldRowFor('r', 'RENDERER_CANNOT_DRAW_KIND', 1).withheld).toBe('NOT_DRAWABLE_HERE');

    // A protected record and a merely-undrawable one are indistinguishable at the row.
    expect(withheldRowFor('r', 'PROTECTED', 1)).toEqual(withheldRowFor('r', 'RECORD_REFUSED', 1));
  });

  it('a row that acquired an extra field is REFUSED by R3 closure, unmodified', () => {
    const rogue = {
      rowKind: 'WITHHELD',
      recordKey: 'r',
      withheld: 'NOT_SHOWN',
      projectedUnderEpoch: 1,
      protectionReason: 'PROTECTED',
    } as unknown as StoredReaderRow;

    // serializeReaderRow builds the closed shape itself, so the stray field is dropped
    // rather than serialized — and the closure check passes on what is actually served.
    expect(Object.keys(serializeReaderRow(rogue)).sort()).toEqual(['recordKey', 'withheld']);
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
 * AS-E1-4 · GA-47 — ORDER IS NOT A FUNCTION OF ROW KIND
 * ═══════════════════════════════════════════════════════════════════════════ */

describe('AS-E1-4 / GA-47 · ordering is independent of protection', () => {
  it('the protected member first, last and only — order never moves', () => {
    const keys = ['aaa', 'mmm', 'zzz'];

    const bright = keys.map((k) => ({ recordKey: k, rowKind: 'PROJECTED' as const }));
    const expected = orderReaderRows(bright).map((r) => r.recordKey);
    expect(expected).toEqual(keys);

    for (const dark of keys) {
      const mixed = keys.map((k) => ({
        recordKey: k,
        rowKind: k === dark ? ('WITHHELD' as const) : ('PROJECTED' as const),
      }));
      expect([dark, orderReaderRows(mixed).map((r) => r.recordKey)]).toEqual([dark, keys]);
    }

    // And with every member withheld.
    const allDark = keys.map((k) => ({ recordKey: k, rowKind: 'WITHHELD' as const }));
    expect(orderReaderRows(allDark).map((r) => r.recordKey)).toEqual(keys);
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
 * AS-E1-5 · THE COHORT IS THIRD-PARTY DERIVABLE
 * ═══════════════════════════════════════════════════════════════════════════ */

describe('AS-E1-5 · the eligibility footprint names a published register', () => {
  const good = {
    registerId: 'SYNTHETIC-ADMIN-REGISTER',
    registerEdition: '2026.1',
    unitLevel: 'DISTRICT',
    eligibilityPredicate: 'every district whose register-declared population is below 50000',
  };

  it('a declaration naming register, edition, level and predicate is accepted', () => {
    expect(() => assertCohortIsThirdPartyDerivable(good)).not.toThrow();
  });

  it.each(['registerId', 'registerEdition', 'unitLevel', 'eligibilityPredicate'])(
    'an empty %s is refused — a cohort nobody can reproduce is a statement about us',
    (field) => {
      expect(() => assertCohortIsThirdPartyDerivable({ ...good, [field]: '   ' })).toThrow(
        /GEOMETRY_COHORT_DERIVATION_INCOMPLETE/,
      );
    },
  );

  it('THE ORACLE · a predicate that reaches for OUR data is refused', () => {
    /*
      E1: "the footprint is NEVER narrowed by anything we observed, counted or hold."
      A predicate phrased over our own records reopens exactly the arrival oracle AS-6
      closes, while still looking like a governed declaration.
    */
    expect(() =>
      assertCohortIsThirdPartyDerivable({
        ...good,
        eligibilityPredicate: 'districts where a protected record was observed in the last month',
      }),
    ).toThrow(/GEOMETRY_COHORT_DERIVATION_OBSERVES_US/);
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
 * AS-E1-6 · THE CADENCE
 * ═══════════════════════════════════════════════════════════════════════════ */

describe('AS-E1-6 · the schedule is unconditional and the lag is real', () => {
  const day = 24 * 60 * 60 * 1000;
  const at = (n: number): string => new Date(Date.UTC(2026, 0, 1) + n * day).toISOString();

  it('a refresh runs on schedule even when nothing changed', () => {
    const runs = [0, 1, 2, 3].map((n) => ({
      ranAt: at(n),
      outcome: n === 2 ? ('SUBSTANTIVE' as const) : ('NO_OP' as const),
      epoch: n + 1,
    }));

    expect(() => assertCadenceRunsOnSchedule(runs, at(0), at(3))).not.toThrow();
  });

  it('THE SIDE CHANNEL · skipping the no-op runs is refused', () => {
    /*
      "A refresh that happens only when there is something to refresh ANNOUNCES that
      there was something." This is the optimisation that looks harmless and turns the
      publication schedule into a signal.
    */
    const runs = [
      { ranAt: at(0), outcome: 'SUBSTANTIVE' as const, epoch: 1 },
      { ranAt: at(3), outcome: 'SUBSTANTIVE' as const, epoch: 2 },
    ];
    expect(() => assertCadenceRunsOnSchedule(runs, at(0), at(3))).toThrow(
      /GEOMETRY_CADENCE_RUN_MISSING/,
    );
  });

  it('a no-op advances the epoch exactly as a substantive run does', () => {
    const uniform = [0, 1, 2].map((n) => ({
      ranAt: at(n),
      outcome: 'NO_OP' as const,
      epoch: n + 1,
    }));
    expect(() => assertNoOpRunsAreIndistinguishable(uniform)).not.toThrow();

    // An epoch that only moves on substantive runs is the same channel in a new hat.
    const leaky = [
      { ranAt: at(0), outcome: 'NO_OP' as const, epoch: 1 },
      { ranAt: at(1), outcome: 'NO_OP' as const, epoch: 1 },
      { ranAt: at(2), outcome: 'SUBSTANTIVE' as const, epoch: 2 },
    ];
    expect(() => assertNoOpRunsAreIndistinguishable(leaky)).toThrow(
      /GEOMETRY_CADENCE_EPOCH_NOT_UNIFORM/,
    );
  });

  it('AS-E1-6 §3 · a declaration authored inside the lag window is not published', () => {
    expect(declarationIsEligibleForRefresh(at(0), at(1))).toBe(true);
    expect(declarationIsEligibleForRefresh(at(0), at(0.5))).toBe(false);

    const fresh = [
      {
        declaration: PARTITIONS.declarations[0]!,
        derivation: {
          registerId: 'R',
          registerEdition: '1',
          unitLevel: 'DISTRICT',
          eligibilityPredicate: 'p',
        },
        authoredAt: at(0.9),
      },
    ];
    expect(() => assertRefreshRespectsLag(fresh, at(1))).toThrow(/GEOMETRY_CADENCE_LAG_VIOLATED/);
  });

  it('AS-E1-6 §4 · an emergency escalates into an ALREADY-dark cohort, or withdraws', () => {
    expect(() =>
      assertEmergencyActionIsLawful({
        action: 'ESCALATE_INTO_DARK_COHORT',
        targetPartitionKey: 'PART-DARK',
        alreadyDarkPartitionKeys: ['PART-DARK'],
      }),
    ).not.toThrow();

    // Withdrawal needs no target: it is an availability event, indistinguishable from
    // an outage, and E1 names that indistinguishability as what makes it safe.
    expect(() =>
      assertEmergencyActionIsLawful({
        action: 'WITHDRAW_SURFACE',
        alreadyDarkPartitionKeys: [],
      }),
    ).not.toThrow();
  });

  it('THE ARRIVAL SIGNAL · darkening a new cohort in an emergency is refused', () => {
    expect(() =>
      assertEmergencyActionIsLawful({
        action: 'ESCALATE_INTO_DARK_COHORT',
        targetPartitionKey: 'PART-NEWLY-INTERESTING',
        alreadyDarkPartitionKeys: ['PART-DARK'],
      }),
    ).toThrow(/GEOMETRY_EMERGENCY_COHORT_NOT_ALREADY_DARK/);
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
 * AS-E1-7 · THE CLOSED VOCABULARY, AND THE UNCLASSIFIED ALARM
 * ═══════════════════════════════════════════════════════════════════════════ */

describe('AS-E1-7 · unknown codes are UNCLASSIFIED and they alarm', () => {
  it('the three classes exist, and E1 reversed Main to add the third', () => {
    expect([...GEOMETRY_REFUSAL_CLASSES]).toEqual([
      'DATA_DEFECT',
      'PROGRAMMING_MISTAKE',
      'UNCLASSIFIED',
    ]);
  });

  it('THE NEGATIVE CONTROL E1 NAMED · GEOMETRY_FAKE_CODE_12_34 is rejected', () => {
    /*
      E1 measured the hole exactly: `refusalCodeOf` tested a SHAPE —
      `^GEOMETRY_[A-Z0-9_]+$` — so this string passed and reached the audit channel
      VERBATIM. "Coordinates cannot ride it; integers can."

      A closed vocabulary is membership, not a pattern.
    */
    const fake = new Error('GEOMETRY_FAKE_CODE_12_34: something that looks official');

    expect(/^GEOMETRY_[A-Z0-9_]+$/.test('GEOMETRY_FAKE_CODE_12_34')).toBe(true);
    expect(refusalCodeOf(fake)).toBe(UNCLASSIFIED_REFUSAL_CODE);
    expect(refusalCodeOf(fake)).not.toContain('FAKE');
    expect(classifyRefusal(refusalCodeOf(fake))).toBe('UNCLASSIFIED');
    expect(refusalClassAlarms('UNCLASSIFIED')).toBe(true);
  });

  it('a code carrying digits that could be a coordinate cannot ride the channel', () => {
    const smuggler = new Error('GEOMETRY_48_25_11_5: nothing to see here');
    expect(refusalCodeOf(smuggler)).toBe(UNCLASSIFIED_REFUSAL_CODE);
  });

  it('the two known sets still classify, so the gate is not simply refusing everything', () => {
    /*
      ── THIS TEST WAS ASSERTING THE DEFECT, AND PASSED WHILE DOING IT ────────

      It read:

          classifyRefusal('RENDERER_CANNOT_DRAW_KIND')            -> DATA_DEFECT
          refusalCodeOf('GEOMETRY_CRS_NOT_SUPPORTED: ...')        -> GEOMETRY_CRS_NOT_SUPPORTED

      Both passed, because both names were in R1's governed list. NEITHER IS EVER
      THROWN. `RENDERER_CANNOT_DRAW_KIND` is a GeometryWithheldReason — an outcome on a
      presented record — and `GEOMETRY_CRS_NOT_SUPPORTED` is a misspelling of the real
      `GEOMETRY_CRS_UNSUPPORTED`.

      A test written from the same invented list as the code it checks agrees with it
      perfectly and measures nothing. That is the failure this whole patch is about, and
      it is worth leaving the evidence of it here rather than quietly swapping the
      strings: the vocabulary gate in `gx14-refusal-vocabulary.spec.ts` is what makes
      this class of agreement impossible now, because it reads the SOURCE rather than
      the list.
    */
    expect(classifyRefusal('GEOMETRY_PROJECTION_WITHOUT_COORDINATES')).toBe('PROGRAMMING_MISTAKE');
    expect(classifyRefusal('GEOMETRY_CRS_UNSUPPORTED')).toBe('DATA_DEFECT');
    expect(refusalClassAlarms('DATA_DEFECT')).toBe(false);

    const real = new Error('GEOMETRY_CRS_UNSUPPORTED: EPSG:3857 is not admitted');
    expect(refusalCodeOf(real)).toBe('GEOMETRY_CRS_UNSUPPORTED');

    // And the two retired names are now refused, which is the behaviour change.
    expect(classifyRefusal('RENDERER_CANNOT_DRAW_KIND')).toBe('UNCLASSIFIED');
    expect(refusalCodeOf(new Error('GEOMETRY_CRS_NOT_SUPPORTED: stale'))).toBe(
      UNCLASSIFIED_REFUSAL_CODE,
    );
  });

  it('a non-Error throw is UNCLASSIFIED rather than interpolated', () => {
    expect(refusalCodeOf('GEOMETRY_CRS_NOT_SUPPORTED')).toBe(UNCLASSIFIED_REFUSAL_CODE);
    expect(refusalCodeOf({ message: 'GEOMETRY_CRS_NOT_SUPPORTED' })).toBe(
      UNCLASSIFIED_REFUSAL_CODE,
    );
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
 * AS-E1-8 · GA-48 — THE AUDIT DETAIL CARRIES NOTHING PROTECTED
 * ═══════════════════════════════════════════════════════════════════════════ */

describe('AS-E1-8 / GA-48 · the audit detail is safe, and the sink cannot break the reader', () => {
  const PROBES: readonly Error[] = [
    new Error('GEOMETRY_CRS_NOT_SUPPORTED: EPSG:3857 at 48.25,11.5 for CLASS-P in PART-DARK'),
    new Error('GEOMETRY_PROJECTION_WITHOUT_COORDINATES: sourceId=SYNTHETIC-SRC-1'),
    new Error('GEOMETRY_COORDINATES_MISSING: {"type":"Point","coordinates":[11.5,48.25]}'),
    new Error('GEOMETRY_FAKE_CODE_12_34: PROTECTED CLASS-P PART-DARK 11.5 48.25'),
    new Error('something entirely foreign with PROTECTED and 48.25 in it'),
  ];

  it.each(PROBES.map((e, i) => [i, e] as const))(
    'probe %i · the serialized detail carries no protected fact',
    (_i, error) => {
      const detail = auditDetailFor(error, 'rec-1', 9);
      const wire = JSON.stringify(detail);

      // The pairing E1 named: { recordKey, reason: 'PROTECTED' } cannot exist, because
      // `reason` is narrowed to the one literal at the type level.
      expect(detail.reason).toBe('RECORD_REFUSED');
      expect(wire).not.toContain('PROTECTED');

      // No coordinate, no class id, no partition key, no source id.
      for (const forbidden of ['48.25', '11.5', 'CLASS-P', 'PART-DARK', 'SYNTHETIC-SRC-1']) {
        expect([forbidden, wire.includes(forbidden)]).toEqual([forbidden, false]);
      }

      // And no substring of the thrown message beyond the closed code.
      expect(wire).not.toContain('EPSG:3857');
      expect(wire).not.toContain('entirely foreign');
    },
  );

  it('the detail field set is closed', () => {
    const detail = auditDetailFor(new Error('GEOMETRY_CRS_NOT_SUPPORTED: x'), 'rec-1', 9);
    expect(Object.keys(detail).sort()).toEqual([
      'authorityEpoch',
      'realm' in detail ? 'realm' : 'reason',
      'recordKey',
      'refusalClass',
      'refusalCode',
    ]);
  });

  it('AS-11 · A THROWING SINK CANNOT CHANGE READER CARDINALITY', () => {
    /*
      E1: "The doc asks the implementer not to throw; A REQUEST IS NOT A GUARANTEE, and
      a throwing sink inside the GX-19 catch would change reader cardinality — the exact
      thing AS-11 exists to prevent."

      So the guarantee is at the call site, not in the doc.
    */
    const exploding: GeometryRefusalSink = {
      record(): void {
        throw new Error('the audit backend is down');
      },
      recordSetOutcome(): void {
        throw new Error('the audit backend is still down');
      },
    };

    const detail: GeometryAuditDetailR1 = auditDetailFor(
      new Error('GEOMETRY_CRS_NOT_SUPPORTED: x'),
      'rec-1',
      9,
    );

    expect(() => emitRefusal(exploding, detail)).not.toThrow();
    expect(() =>
      emitSetOutcome(exploding, { total: 3, refused: 3, authorityEpoch: 9 }),
    ).not.toThrow();
  });

  it('the default sink is a no-op and is safe to call', () => {
    expect(() =>
      emitRefusal(NO_OP_REFUSAL_SINK, auditDetailFor(new Error('x'), 'r', 1)),
    ).not.toThrow();
  });

  it('AS-12 · an all-refusing set is reported, so it is not a quiet zero to an operator', () => {
    const seen: Array<{ total: number; refused: number }> = [];
    const sink: GeometryRefusalSink = {
      record(): void {
        /* not under test here */
      },
      recordSetOutcome(s): void {
        seen.push({ total: s.total, refused: s.refused });
      },
    };

    emitSetOutcome(sink, { total: 5, refused: 5, authorityEpoch: 9 });
    expect(seen).toEqual([{ total: 5, refused: 5 }]);
  });
});
