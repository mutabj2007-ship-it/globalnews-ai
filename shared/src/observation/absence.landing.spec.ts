/**
 * ════════════════════════════════════════════════════════════════════════════
 * M08 LANDING — ONE SHARED ABSENCE AUTHORITY, AND THE PROPERTIES THAT SURVIVE
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Main's own 27 probes run against the delivered package and prove the contract.
 * They ran green against the landed bytes too. What they cannot cover is the
 * LANDING: that this lineage has exactly one such authority, that Security's
 * meaning survived an alias migration that changed four member VALUES, and that
 * the two properties most easily lost in integration still have teeth.
 *
 * Every guard here carries a control. A guard that cannot fail is not a guard —
 * Main caught that in their own `F-3` draft, and the lesson is cheap to reuse.
 */
import { execSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, statSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import {
  OBSERVATION_ABSENCE_STATES,
  OBSERVATION_ABSENCE_FLOOR,
  ONLY_REASSURING_ABSENCE_STATE,
  INTERNAL_ONLY_ABSENCE_STATES,
  readerAbsence,
  admitAssessedNothingQualified,
  degradeTo,
  ABSENCE_FORBIDDEN_CHANGE_STATE,
  type ObservationAbsenceState,
  type ReaderAbsenceState,
} from './absence';
import {
  SECURITY_ABSENCE_STATES,
  SECURITY_ABSENCE_FALLBACK,
  SECURITY_ABSENCE_LABELS,
  SECURITY_ABSENCE_ASSERTS,
  SECURITY_ABSENCE_REACHABLE_AT_ALPHA,
  SEC_ASSESSED_NO_QUALIFYING_INCIDENT,
  SEC_NOT_ASSESSED,
  securityAbsenceLabel,
} from '../security/absence';

const SRC = join(__dirname, '..');

/* ═══ 1 · EXACT DECLARATION CENSUS — ONE AUTHORITY ═══════════════════════ */

describe('1 · exactly one shared absence authority exists in this lineage', () => {
  /** Every first-party source file under shared/src, specs excluded. */
  const files: string[] = [];
  (function walk(dir: string) {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.ts$/.test(name) && !/\.spec\.ts$/.test(name)) files.push(p);
    }
  })(SRC);

  const declares = (sym: string) =>
    files.filter((f) =>
      new RegExp(`export\\s+(?:declare\\s+)?(?:type|const|interface|function)\\s+${sym}\\b`).test(
        readFileSync(f, 'utf-8'),
      ),
    ).map((f) => f.slice(SRC.length + 1).replace(/\\/g, '/'));

  it('the neutral union and its floor are declared exactly ONCE each', () => {
    for (const sym of [
      'OBSERVATION_ABSENCE_STATES',
      'ObservationAbsenceState',
      'OBSERVATION_ABSENCE_FLOOR',
      'ReaderAbsenceState',
      'readerAbsence',
    ]) {
      const sites = declares(sym);
      expect(`${sym}: ${sites.length} site(s) ${sites.join(',')}`)
        .toBe(`${sym}: 1 site(s) observation/absence.ts`);
    }
  });

  it('NO domain minted a parallel absence union — the M08 condition, re-measured', () => {
    /*
      Main's input authority measured this repository-wide and found exactly one
      absence vocabulary: Security's. The landing must not have created a second
      one while resolving the first.
    */
    for (const forbidden of [
      'ENERGY_ABSENCE_STATES', 'EnergyAbsenceState',
      'SHARED_ABSENCE_STATES', 'DOMAIN_ABSENCE_STATES',
      'CONFLICT_ABSENCE_STATES', 'POLITICS_ABSENCE_STATES',
    ]) {
      expect(`${forbidden}: ${declares(forbidden).length}`).toBe(`${forbidden}: 0`);
    }
  });

  it('POSITIVE CONTROL · the census finds a declaration that IS present', () => {
    expect(declares('SECURITY_ABSENCE_STATES')).toEqual(['security/absence.ts']);
  });

  it('Security declares aliases, not a second union — each VALUE is a shared member', () => {
    /*
      Four of the five resolve into the shared union. The fifth is the exception
      the whole ruling turns on and is asserted separately below.
    */
    const shared = new Set<string>(OBSERVATION_ABSENCE_STATES);
    const resolving = SECURITY_ABSENCE_STATES.filter((s) => shared.has(s));
    expect(`${resolving.length} of ${SECURITY_ABSENCE_STATES.length} resolve into the shared union`)
      .toBe('4 of 5 resolve into the shared union');
  });
});

/* ═══ 2 · SECURITY SEMANTICS PRESERVED ACROSS THE ALIAS MIGRATION ════════ */

describe('2 · Security means exactly what it meant, though four VALUES changed', () => {
  it('SEC_ASSESSED_NO_QUALIFYING_INCIDENT stays Security-specific and is NOT a shared member', () => {
    /*
      The instruction is explicit: it must not become a generic "no event"
      state. Main's matrix agrees — it is shape-neutral but denotation-specific,
      because "no qualifying INCIDENT" is a security claim, and Energy's
      equivalent must denote something else.
    */
    expect(SEC_ASSESSED_NO_QUALIFYING_INCIDENT).toBe('SEC_ASSESSED_NO_QUALIFYING_INCIDENT');
    expect((OBSERVATION_ABSENCE_STATES as readonly string[]))
      .not.toContain(SEC_ASSESSED_NO_QUALIFYING_INCIDENT);
  });

  it('every reader sentence is character-for-character what it was before M08', () => {
    /*
      The migration changed member SPELLINGS, not meaning. If a single label had
      drifted, Security's reader-facing behaviour would have changed — which the
      round forbids — and this is where that shows up.
    */
    expect(SECURITY_ABSENCE_LABELS[SEC_NOT_ASSESSED])
      .toBe('Not assessed. This is not a statement that conditions are safe.');
    expect(SECURITY_ABSENCE_LABELS[SEC_ASSESSED_NO_QUALIFYING_INCIDENT])
      .toBe('Checked {when}. Reviewed {what}. No qualifying incident. Sources adequate - not a coverage gap.');
    /* N-11's second sentence is the load-bearing half; assert it cannot be dropped */
    expect(securityAbsenceLabel(SEC_NOT_ASSESSED))
      .toContain('This is not a statement that conditions are safe');
  });

  it('the label, asserts and reachability tables still cover all five members', () => {
    for (const s of SECURITY_ABSENCE_STATES) {
      expect(`label ${s}: ${typeof SECURITY_ABSENCE_LABELS[s]}`).toBe(`label ${s}: string`);
      expect(`asserts ${s}: ${typeof SECURITY_ABSENCE_ASSERTS[s]}`).toBe(`asserts ${s}: string`);
      expect(`reach ${s}: ${typeof SECURITY_ABSENCE_REACHABLE_AT_ALPHA[s]}`).toBe(`reach ${s}: boolean`);
    }
    /* still four of five unreachable at Alpha — unchanged by the landing */
    const reachable = SECURITY_ABSENCE_STATES.filter((s) => SECURITY_ABSENCE_REACHABLE_AT_ALPHA[s]);
    expect(reachable).toEqual([SEC_NOT_ASSESSED]);
  });

  it('NO_MATERIAL_CHANGE is still excluded, and now declared once', () => {
    expect(ABSENCE_FORBIDDEN_CHANGE_STATE).toBe('NO_MATERIAL_CHANGE');
    expect((OBSERVATION_ABSENCE_STATES as readonly string[])).not.toContain('NO_MATERIAL_CHANGE');
    expect((SECURITY_ABSENCE_STATES as readonly string[])).not.toContain('NO_MATERIAL_CHANGE');
  });
});

/* ═══ 3 · SHARED-ONLY MEMBERS STAY OFF SECURITY'S READER SURFACE ═════════ */

describe('3 · shared-only members are not forced onto Security', () => {
  it('SOURCE_NOT_CONNECTED and SOURCE_TEMPORARILY_UNAVAILABLE exist in the union', () => {
    for (const m of ['SOURCE_NOT_CONNECTED', 'SOURCE_TEMPORARILY_UNAVAILABLE']) {
      expect(`${m}: ${(OBSERVATION_ABSENCE_STATES as readonly string[]).includes(m)}`).toBe(`${m}: true`);
    }
  });

  it('and Security exposes NEITHER as one of its own reader-facing states', () => {
    for (const m of ['SOURCE_NOT_CONNECTED', 'SOURCE_TEMPORARILY_UNAVAILABLE']) {
      expect(`Security exposes ${m}: ${(SECURITY_ABSENCE_STATES as readonly string[]).includes(m)}`)
        .toBe(`Security exposes ${m}: false`);
    }
    /* which is the same thing as saying they have no Security label */
    expect(Object.keys(SECURITY_ABSENCE_LABELS).sort())
      .toEqual([...SECURITY_ABSENCE_STATES].sort());
  });

  it('they ARE internal-only, so they never reach a reader as themselves', () => {
    for (const m of ['SOURCE_NOT_CONNECTED', 'SOURCE_TEMPORARILY_UNAVAILABLE'] as ObservationAbsenceState[]) {
      expect((INTERNAL_ONLY_ABSENCE_STATES as readonly string[])).toContain(m);
      expect(`${m} reaches a reader as itself: ${(readerAbsence(m) as string) === m}`)
        .toBe(`${m} reaches a reader as itself: false`);
    }
  });
});

/* ═══ 4 · THE ANTI-ORACLE PROJECTION — LOSSY ON PURPOSE ══════════════════ */

describe('4 · seven internal states reach a reader as three, and that is the protection', () => {
  it('the projection is NON-INJECTIVE — strictly fewer reader states than internal', () => {
    const readers = new Set<ReaderAbsenceState>(
      OBSERVATION_ABSENCE_STATES.map((s) => readerAbsence(s)),
    );
    expect(`${OBSERVATION_ABSENCE_STATES.length} internal -> ${readers.size} reader`)
      .toBe('7 internal -> 3 reader');
  });

  it('a protected WITHHOLD is indistinguishable from an ordinary absence', () => {
    /*
      THE ORACLE THIS PREVENTS. If EVIDENCE_WITHHELD had its own reader label, a
      reader could infer that something exists and is being withheld — which is
      the fact the withhold exists to protect. It must land on a projection that
      other, benign states also reach.
    */
    const withheld = readerAbsence('EVIDENCE_WITHHELD');
    const benign = OBSERVATION_ABSENCE_STATES
      .filter((s) => s !== 'EVIDENCE_WITHHELD' && readerAbsence(s) === withheld);
    expect(`states sharing the withhold's reader projection: ${benign.length > 0}`)
      .toBe("states sharing the withhold's reader projection: true");
    expect(`withhold reaches a reader as itself: ${(withheld as string) === 'EVIDENCE_WITHHELD'}`)
      .toBe('withhold reaches a reader as itself: false');
  });

  it('MUTATION CONTROL · a one-label-per-state projection WOULD be detected', () => {
    /*
      The guard above is only meaningful if it can fail. An injective projection
      is exactly the regression this round must prevent, so it is constructed
      here and the same measurement is shown to catch it.
    */
    const injective = (s: ObservationAbsenceState): string => s;
    const readers = new Set(OBSERVATION_ABSENCE_STATES.map(injective));
    expect(`injective projection collapses: ${readers.size < OBSERVATION_ABSENCE_STATES.length}`)
      .toBe('injective projection collapses: false');
    /* i.e. it would have failed the 7->3 assertion, which is the point */
    expect(readers.size).toBe(7);
  });

  it('silence cannot imply safety: the reassuring member needs all three facts', () => {
    /*
      The field is `reviewed`, not `reviewedScope` — my first draft of this test
      guessed the name and the admitter correctly refused it, returning the
      floor. That refusal is the gate doing its job on a caller that could not
      supply the evidence, which is precisely the behaviour under test.
    */
    const complete = { checkedAt: '2026-09-20T00:00:00Z', reviewed: 'PL national wire', sourcesAdequate: true };
    expect(admitAssessedNothingQualified(complete)).toBe(ONLY_REASSURING_ABSENCE_STATE);

    /* NEGATIVE CONTROLS — remove each fact in turn; none may still reassure */
    expect(admitAssessedNothingQualified({ ...complete, sourcesAdequate: false })).toBe(OBSERVATION_ABSENCE_FLOOR);
    expect(admitAssessedNothingQualified({ ...complete, reviewed: '   ' })).toBe(OBSERVATION_ABSENCE_FLOOR);
    expect(admitAssessedNothingQualified({ ...complete, checkedAt: '' })).toBe(OBSERVATION_ABSENCE_FLOOR);
    expect(admitAssessedNothingQualified({})).toBe(OBSERVATION_ABSENCE_FLOOR);
  });

  it('degradation travels one way only — a stronger claim is refused with null', () => {
    /*
      `degradeTo(from, to)` takes two STATES and returns `null` when the move is
      illegal — it is not Security's `(intended, admissible)` accessor, which is
      a different function with a different job. Ordering is the union's own
      order, weakest first.
    */
    expect(degradeTo(ONLY_REASSURING_ABSENCE_STATE, OBSERVATION_ABSENCE_FLOOR)).toBe(OBSERVATION_ABSENCE_FLOOR);
    expect(degradeTo(ONLY_REASSURING_ABSENCE_STATE, ONLY_REASSURING_ABSENCE_STATE)).toBe(ONLY_REASSURING_ABSENCE_STATE);
    /* the illegal direction: floor -> the one reassuring member */
    expect(degradeTo(OBSERVATION_ABSENCE_FLOOR, ONLY_REASSURING_ABSENCE_STATE)).toBeNull();
  });
});

/* ═══ 5 · THE LITERAL FLOOR, PROVED AT COMPILE TIME ══════════════════════ */

describe('5 · the fallback floor is a LITERAL type, and moving it fails to compile', () => {
  it('Security’s fallback IS the shared floor, by value', () => {
    expect(SECURITY_ABSENCE_FALLBACK).toBe(OBSERVATION_ABSENCE_FLOOR);
    expect(OBSERVATION_ABSENCE_FLOOR).toBe('NOT_ASSESSED');
  });

  it('the floor is declared as a LITERAL, not as the wide union', () => {
    /*
      Main's §7: typed wide, the floor could later be moved to a member a
      consuming domain lacks, and every alias built on it would break at a
      distance. Declared as a literal, that becomes a type error at the seam.
    */
    const src = readFileSync(join(SRC, 'observation', 'absence.ts'), 'utf-8');
    expect(src).toMatch(/OBSERVATION_ABSENCE_FLOOR = 'NOT_ASSESSED' as const satisfies ObservationAbsenceState/);
    expect(`floor typed as the wide union: ${/OBSERVATION_ABSENCE_FLOOR:\s*ObservationAbsenceState\b/.test(src)}`)
      .toBe('floor typed as the wide union: false');
  });

  it('COMPILE-TIME MUTATION · assigning a non-floor member to the floor is rejected by tsc', () => {
    /*
      The strongest available form of "no broad union fallback": the claim is
      about the type system, so it is measured by running the type system rather
      than by reading the source.
    */
    const dir = mkdtempSync(join(tmpdir(), 'm08-floor-'));
    try {
      mkdirSync(join(dir, 'observation'), { recursive: true });
      writeFileSync(join(dir, 'observation', 'absence.ts'),
        readFileSync(join(SRC, 'observation', 'absence.ts'), 'utf-8'));

      const probe = join(dir, 'probe.ts');
      const compiles = (body: string): boolean => {
        writeFileSync(probe, body);
        try {
          execSync(`npx tsc --strict --noEmit --target ES2020 --module commonjs --lib ES2020 "${probe}"`,
            { cwd: process.cwd(), stdio: 'pipe' });
          return true;
        } catch { return false; }
      };

      /* POSITIVE CONTROL — the floor itself must be assignable, or the probe proves nothing */
      expect(compiles(
        `import { OBSERVATION_ABSENCE_FLOOR } from './observation/absence';\n` +
        `const ok: typeof OBSERVATION_ABSENCE_FLOOR = OBSERVATION_ABSENCE_FLOOR;\nvoid ok;\n`,
      )).toBe(true);

      /* THE MUTATION — a different, perfectly valid union member must NOT be assignable */
      expect(compiles(
        `import { OBSERVATION_ABSENCE_FLOOR } from './observation/absence';\n` +
        `const moved: typeof OBSERVATION_ABSENCE_FLOOR = 'COVERAGE_GAP';\nvoid moved;\n`,
      )).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 120_000);
});

/* ═══ 6 · ENERGY'S DEPENDENCY, AS A CONTRACT ════════════════════════════ */

describe('6 · Energy can consume the shared union and mint no ENE_* twins', () => {
  it('the union is domain-neutral — no member names a domain', () => {
    for (const s of OBSERVATION_ABSENCE_STATES) {
      expect(`${s} names a domain: ${/^(SEC|ENE|CFL|POL|MKT|HUM)_/.test(s)}`)
        .toBe(`${s} names a domain: false`);
    }
  });

  it('the shared module carries NO reader-facing label — language is not hoisted', () => {
    /*
      Main's B-group. A shared authority that carried sentences would make every
      domain read in the same voice, and would put Security's N-11 disclaimer
      where Energy would inherit it without deciding to.
    */
    /*
      SCANNED ON EXECUTABLE BYTES, AND THE FIRST DRAFT WAS NOT. The module's own
      docblock says *"Note what is NOT here: reader LABELS"* — so a raw-source
      scan matches `ABSENCE_LABELS` inside the very comment promising it is
      absent, and reports the opposite of the truth. Comments are stripped.
    */
    const raw = readFileSync(join(SRC, 'observation', 'absence.ts'), 'utf-8');
    const code = raw.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1');
    const DECLARES_LABELS = /(?:export\s+const\s+\w*_LABELS|readerLabel|absenceLabel)\s*[:=(]/;
    expect(`shared module declares labels: ${DECLARES_LABELS.test(code)}`)
      .toBe('shared module declares labels: false');

    /* POSITIVE CONTROL · the scan does fire on a real label declaration */
    expect(DECLARES_LABELS.test("export const ABSENCE_LABELS: Record<string, string> = {")).toBe(true);
    /* and Security, which legitimately HAS labels, is where they live */
    const sec = readFileSync(join(SRC, 'security', 'absence.ts'), 'utf-8')
      .replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1');
    expect(DECLARES_LABELS.test(sec)).toBe(true);
  });

  it('retained Energy contracts mint no domain-specific absence twins', () => {
    const energyDir = join(SRC, 'energy');
    expect(statSync(energyDir).isDirectory()).toBe(true);
    const declaresTwin = /\b(?:type|interface|const|enum)\s+(?:ENE_\w*|EnergyAbsence\w*)\b/;
    const inspect = (dir: string): void => {
      for (const name of readdirSync(dir)) {
        const file = join(dir, name);
        if (statSync(file).isDirectory()) inspect(file);
        else if (name.endsWith('.ts') && !name.endsWith('.spec.ts')) {
          const code = readFileSync(file, 'utf-8')
            .replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1');
          expect({ file: name, duplicateAbsence: declaresTwin.test(code) })
            .toEqual({ file: name, duplicateAbsence: false });
        }
      }
    };
    inspect(energyDir);
    expect(declaresTwin.test("export const ENE_NOT_ASSESSED = 'NOT_ASSESSED';")).toBe(true);
    expect(declaresTwin.test("export type EnergyAbsenceState = 'NOT_ASSESSED';")).toBe(true);
  });
});
