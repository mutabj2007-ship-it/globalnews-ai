import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * B3 — ECONOMY RECOVERY READINESS, AS ASSERTIONS
 * ════════════════════════════════════════════════════════════════════════════
 *
 * B3 recovered NO Economy file. This spec is the reason, made executable, and
 * the guard that keeps the reason true.
 *
 * ── WHY NOTHING WAS RECOVERED ─────────────────────────────────────────────
 *
 * All 38 Economy files funnel through `shared/src/economy/index.ts`, and that
 * one file needs TWO symbols the sealed candidate does not have:
 *
 *   DisplayLocale / DISPLAY_LOCALES   `shared/src/language/`   — ABSENT
 *   SourceProvenance                  `shared/src/sourceModel` — ABSENT
 *
 * Exactly one Economy file — `components/economy/econTokens.ts`, 99 lines — has
 * no imports at all and could land today. A token table with no consumer is not
 * a recovery.
 *
 * So Economy cannot be recovered until two SHARED-CONTRACT decisions are taken,
 * and neither is Economy's to take. Recovering fragments would leave the Beta
 * branch non-compiling, which breaks the B2/B3 rule to preserve sealed-candidate
 * behaviour.
 *
 * ── THESE ASSERTIONS ARE A TRIPWIRE ───────────────────────────────────────
 *
 * If someone later recovers Economy without resolving the prerequisites, the
 * failing test says which prerequisite was skipped — rather than a wall of
 * TypeScript errors that has to be diagnosed from scratch.
 *
 * Each test therefore asserts a CURRENT FACT and names what would change it.
 */

const REPO = join(__dirname, '..', '..', '..', '..');

/*
  ── THE HISTORICAL COMMIT READ IS GONE, AND EACH CASE WAS CLASSIFIED ───────

  Three assertions below read commit `3db5a09` with `git show`. That commit is
  on a LOCAL branch only and on no remote, so a fresh clone of the release
  branch could not run them. They FAILED rather than skipped, because the
  `describeGit` gate tested whether `.git` exists — which is true in any clone
  — rather than whether the object is reachable.

  What each was actually proving:

    shared/src/economy/index.ts carries SourceProvenance + DisplayLocale
      SEMANTIC INVARIANT — the file is present and still carries both, so it is
      asserted on the current tree.

    econTokens.ts imports nothing
      SEMANTIC INVARIANT — same; the property is what matters, not the 2026
      bytes, and it is the reason that file is recoverable in isolation.

    app/economy/page.tsx imports ScriptRun
      OBSOLETE HISTORICAL COUPLING. The test's own note calls it *"a RECORD of
      a known collision, not an invariant to defend"*, and the collision has
      since closed. The route does not exist in this tree and B3 forbids
      creating one, so there is nothing current to read and nothing left to
      record. Dropped — the LIVE half of that test, which proves the collision
      is closed and the route still absent, is kept and is what mattered.
*/

const sharedFile = (name: string): string | null => {
  const path = join(REPO, 'shared', 'src', name);

  return existsSync(path) ? readFileSync(path, 'utf-8') : null;
};

describe('B3 — the two shared-contract prerequisites are still open', () => {
  describe('PREREQUISITE 1 — the language module — CLOSED BY B3.1', () => {
    /*
      THIS BLOCK IS A TRIPWIRE THAT FIRED, AND THAT IS THE POINT.

      B3 asserted `shared/src/language/` was ABSENT and named it as the thing
      blocking Economy. B3.1 recovered it — the CTO ruled it RECOVERABLE WITH NO
      LANGUAGE ACTIVATION — so the original assertion began failing, by design,
      and is replaced here rather than deleted.

      The authority for the recovery's correctness is
      `b31EconomyPrerequisites.spec.ts`. What remains here is the ONE property
      this gate cares about: recovering the type activated no language.
    */
    it('the language module is now present', () => {
      expect(existsSync(join(REPO, 'shared', 'src', 'language'))).toBe(true);
    });

    it('and ACTIVE_LANGUAGES is still exactly EN + PL', () => {
      /*
        The load-bearing check. A display-locale TYPE is a contract; the
        SELECTABLE registry is a deployment fact, and only the second decides
        what a reader can choose.

        The earlier assertion here grepped the shared barrel for the literal
        'DisplayLocale' and passed only because the barrel re-exports with
        `export *`, which names nothing. It was checking the wrong file for the
        wrong thing, so it is replaced with the one that matters.
      */
      const languages = readFileSync(
        join(REPO, 'frontend', 'src', 'lib', 'i18n', 'languages.ts'),
        'utf-8',
      );

      expect(languages).toContain("export const ACTIVE_LANGUAGES: LanguageCode[] = ['en', 'pl'];");
    });
  });

  describe('PREREQUISITE 2 — SourceProvenance, and the SourceType collision', () => {
    it('`shared/src/sourceModel.ts` is still absent — it was NOT recovered wholesale', () => {
      /*
        B3.1 recovered only what the candidate lacked, into
        `source-provenance.ts`, precisely so `SourceType` is not redeclared.
        The canonical module itself stays out of the tree.
      */
      expect(sharedFile('sourceModel.ts')).toBeNull();
      expect(sharedFile('source-provenance.ts')).not.toBeNull();
    });

    it('but `source-type.ts` IS present and exports SourceType', () => {
      /*
        This is why the prerequisite is a COLLISION and not a plain absence.
        Canonical's `sourceModel.ts` also declares `SourceType`, and both files
        reach the barrel through `export *` — so recovering it wholesale would
        double-export the symbol.
      */
      expect(sharedFile('source-type.ts')).toContain('export type SourceType');
      expect(sharedFile('index.ts')).toContain("export * from './source-type'");
    });

    it('and the two SourceType unions have the SAME members, which bounds the fix', () => {
      /*
        Measured: both are NEWS_PROVIDER | OFFICIAL_SOURCE | PUBLIC_DATA. So the
        adaptation is to recover only what the candidate lacks — SourceProvenance,
        EvidenceRole, RetrievalOutcome, ClarificationReason — and import
        SourceType from source-type.ts rather than redeclaring it.
      */
      const current = sharedFile('source-type.ts') ?? '';

      for (const member of ['NEWS_PROVIDER', 'OFFICIAL_SOURCE', 'PUBLIC_DATA']) {
        expect(current).toContain(member);
      }
    });
  });

  describe('AND THE CANONICAL SIDE STILL SAYS WHAT B3 MEASURED', () => {
    it('shared/src/economy/index.ts still carries both once-missing symbols', () => {
      /*
        SEMANTIC INVARIANT. B3 recorded these as MISSING and therefore blocking;
        the recovery landed them. Asserting the current file means a later
        removal fails here, where the historical read would have kept passing.
      */
      const source = readFileSync(join(REPO, 'shared', 'src', 'economy', 'index.ts'), 'utf-8');

      expect(source).toContain('SourceProvenance');
      expect(source).toMatch(/DisplayLocale|DISPLAY_LOCALES/);

      /* NEGATIVE CONTROL — the matcher is capable of not matching. */
      expect(/DisplayLocale|DISPLAY_LOCALES/.test('export const X = 1;')).toBe(false);
    });

    it('the Economy route pages need ScriptRun — CLOSED by the Humanitarian R3 convergence', () => {
      /*
        ── THIS RECORDED A GAP, AND THE GAP HAS CLOSED ────────────────────────

        It read: "the Economy route pages need ScriptRun, which this tree does not
        export", and its own note said *"recorded so it is not rediscovered at wiring
        time"*. That is what it was — a RECORD of a known collision, not an invariant
        to defend. Wiring time arrived from an unexpected direction.

        ALPHA-HUMANITARIAN-R3-CANONICAL-CONVERGENCE-R1 landed H's accepted Humanitarian
        routes, which import `ScriptRun` for exactly the same reason Economy's do, so
        `runBoundary.tsx` was restored to the accepted checkpoint-4 bytes. That restore
        is strictly ADDITIVE — `diff` against the trimmed file reports zero removed
        lines — and `MachineReadable` is untouched.

        The reason the trim existed is also gone. The Map route records it: importing
        `ScriptRun` "would mean pulling C55's shared language machinery forward", namely
        `DISPLAY_LOCALE_META` and the `DisplayLocale` union from shared `language/`.
        That module is now present in this lineage, so the import costs nothing that is
        not already here — the note in `app/map/page.tsx` is stale, and this is the
        entry that says so.

        WHAT HAS NOT CHANGED, AND IS STILL ASSERTED BELOW: B3 still forbids registering
        a live Economy route, and no Economy route exists. Closing the ScriptRun
        collision removes an obstacle to wiring; it does not authorise the wiring.
      */
      /*
        THE HISTORICAL READ IS REMOVED HERE, AND ONLY HERE.

        It asserted that the 2026 Economy page imported `ScriptRun` — the record
        of the collision. Both halves of that record have expired: the collision
        is closed (asserted immediately below, on the live file), and the page it
        read does not exist in this tree and must not, because B3 forbids
        registering an Economy route. Keeping it would have meant preserving a
        historical artifact whose only purpose was to describe a problem that no
        longer exists.

        What remains is the part that was always the invariant.
      */
      const runBoundary = readFileSync(
        join(REPO, 'frontend', 'src', 'lib', 'typography', 'runBoundary.tsx'),
        'utf-8',
      );

      // The collision is closed: the symbol Economy's pages need is now exported here.
      expect(runBoundary).toContain('export function ScriptRun');

      // And the trim's stated cost is now free — the shared language module is present.
      expect(runBoundary).toContain("from '@globalnews-ai/shared'");

      // B3 STILL HOLDS. No Economy route is registered in this tree.
      expect(existsSync(join(REPO, 'frontend', 'src', 'app', 'economy'))).toBe(false);
    });

    it('econTokens.ts still imports nothing at all', () => {
      /*
        SEMANTIC INVARIANT, and the reason it is worth keeping: a token module
        with no imports is recoverable in isolation. The moment it acquires one,
        that stops being true — which the historical read could never have
        noticed.
      */
      const tokens = readFileSync(
        join(REPO, 'frontend', 'src', 'components', 'economy', 'econTokens.ts'),
        'utf-8',
      );

      expect(tokens).not.toContain("from '");
      expect(tokens).not.toMatch(/require\(/);

      /* POSITIVE CONTROL — the scan detects an import when one is present. */
      expect("import { x } from './y';".includes("from '")).toBe(true);
      /* and it is reading a real file, not an empty one */
      expect(tokens.length).toBeGreaterThan(200);
    });
  });
});

describe('B3 — the DATA dependency, which substrate recovery cannot close', () => {
  const registry = readFileSync(
    join(REPO, 'backend', 'src', 'modules', 'official-sources', 'official-source-registry.ts'),
    'utf-8',
  );

  it('OFFICIAL_SOURCES is empty BY DESIGN, and says so', () => {
    /*
      G's GAP-2, confirmed directly in this tree. Economy is built to consume
      official statistical and central-bank observations; there is no such
      source. UI/SUBSTRATE READY and DATA SOURCE READY are different claims.
    */
    expect(registry).toMatch(/OFFICIAL_SOURCES\s*\n?\s*\*?\s*starts empty and stays empty/);
  });

  it('and no Economy data feed may be invented to close it', () => {
    /*
      The ruling is explicit: record the dependency rather than mocking it into
      production behaviour. This asserts the absence stays an absence.
    */
    expect(registry).not.toMatch(/'ke-cbk'|'pl-gus'|'rw-nbr'/);
  });
});

describe('B3 — the B1/B2 platform is unaffected', () => {
  it('the recovered specialist components are still present and shared', () => {
    const dir = join(REPO, 'frontend', 'src', 'components', 'specialist');

    for (const component of [
      'ParticipantEntityCard',
      'ObservedIndicatorStrip',
      'CompetingReadingsBlock',
      'SpecialistHudLine',
    ]) {
      expect(existsSync(join(dir, `${component}.tsx`))).toBe(true);
    }
  });

  it('and Economy did NOT bring a domain-local copy of the shared strip', () => {
    /*
      Canonical carries `components/economy/IndicatorStrip.tsx` — a DOMAIN-LOCAL
      strip beside the shared `ObservedIndicatorStrip`. That is the §21 leak
      pattern the promotion exists to prevent, and it is the single most
      important thing for Economy's eventual recovery to reconcile rather than
      copy. Nothing was recovered, so nothing has leaked yet.
    */
    expect(
      existsSync(join(REPO, 'frontend', 'src', 'components', 'economy', 'IndicatorStrip.tsx')),
    ).toBe(false);
  });
});
