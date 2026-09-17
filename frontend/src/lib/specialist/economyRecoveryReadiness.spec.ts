import { execFileSync } from 'child_process';
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
const CANONICAL = '3db5a09';

const hasGit = existsSync(join(REPO, '.git')) || existsSync(join(REPO, '.git', 'HEAD'));
const describeGit = hasGit ? describe : describe.skip;

const git = (...args: string[]): string =>
  execFileSync('git', args, { cwd: REPO, encoding: 'utf-8' });

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

  describeGit('AND THE CANONICAL SIDE STILL SAYS WHAT B3 MEASURED', () => {
    it('shared/src/economy/index.ts needs both missing symbols', () => {
      const source = git('show', `${CANONICAL}:shared/src/economy/index.ts`);

      expect(source).toContain('SourceProvenance');
      expect(source).toMatch(/DisplayLocale|DISPLAY_LOCALES/);
    });

    it('the Economy route pages need ScriptRun, which this tree does not export', () => {
      /*
        The route pages are out of scope anyway — B3 forbids registering a live
        Economy route — so this collision is confined to files that must not be
        recovered yet. Recorded so it is not rediscovered at wiring time.
      */
      const page = git('show', `${CANONICAL}:frontend/src/app/economy/page.tsx`);

      expect(page).toContain("import { ScriptRun } from '@/lib/typography/runBoundary'");

      const runBoundary = readFileSync(
        join(REPO, 'frontend', 'src', 'lib', 'typography', 'runBoundary.tsx'),
        'utf-8',
      );

      expect(runBoundary).not.toContain('export function ScriptRun');
    });

    it('only one Economy file has no imports at all', () => {
      const tokens = git('show', `${CANONICAL}:frontend/src/components/economy/econTokens.ts`);

      expect(tokens).not.toContain("from '");
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
