import { execFileSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * PHASE 2 — THE INVENTORY, GUARDED
 * ════════════════════════════════════════════════════════════════════════════
 *
 * The parity matrix and the capability tree are documents, and a document that
 * nothing checks rots the moment the code moves. This pins the LOAD-BEARING
 * CLAIMS in both of them — the ones a reader would act on — so that a change
 * which invalidates one fails here instead of being discovered later.
 *
 * It deliberately does NOT re-state every row. A test per sentence would be
 * noise; these are the facts the classifications rest on.
 *
 * ─── THE BASELINE RULING ──────────────────────────────────────────────────
 *
 * Local `main` is NOT the Production proxy. The governed Production source
 * baseline is C911-V1, and the deployed Alpha candidate descends from it, so
 * the comparison is exact rather than inferred.
 */

const REPO = join(__dirname, '..', '..');

/** C911-V1 — the governed Production source baseline. */
const C911_V1_COMMIT = 'fc162e2';
const C911_V1_TREE = '64f42a52aaa756cfea395c2cf60312c8f600d7c6';

/** The deployed Alpha candidate, recovered under DOMAIN-1. */
const ALPHA_COMMIT = '2c4b6ce';
const ALPHA_TREE = '654be554715627974c0426e8a74f927917d40926';

const git = (...args: string[]): string =>
  execFileSync('git', args, { cwd: REPO, encoding: 'utf-8' }).trim();

/**
 * Git history is only present in a real checkout. In an environment without it
 * these assertions cannot be MEASURED, and a test that silently passes when it
 * could not run is worse than one that is skipped.
 */
const hasGit = existsSync(join(REPO, '.git')) || existsSync(join(REPO, '.git', 'HEAD'));
const describeGit = hasGit ? describe : describe.skip;

const doc = (name: string): string => readFileSync(join(REPO, 'docs', name), 'utf-8');

describeGit('PHASE 2.1 — the three source layers are what the matrix says', () => {
  it('C911-V1 resolves to the tree the Phase 0 manifest verified', () => {
    expect(git('rev-parse', `${C911_V1_COMMIT}^{tree}`)).toBe(C911_V1_TREE);
  });

  it('the deployed Alpha candidate resolves to the DOMAIN-1 tree', () => {
    expect(git('rev-parse', `${ALPHA_COMMIT}^{tree}`)).toBe(ALPHA_TREE);
  });

  it('and the Alpha candidate DESCENDS from the governed baseline', () => {
    /*
      This is what makes the comparison exact. If it ever stops being true, the
      matrix is comparing two unrelated lineages and every row is suspect.
    */
    const base = git('merge-base', C911_V1_COMMIT, ALPHA_COMMIT);

    expect(base.startsWith(git('rev-parse', C911_V1_COMMIT))).toBe(true);
  });

  describe('THE HEADLINE FINDING — L1 -> L2 IS TWO FILES', () => {
    const changed = (): readonly string[] =>
      git('diff', '--name-only', C911_V1_COMMIT, ALPHA_COMMIT).split('\n').filter(Boolean);

    it('exactly two files differ', () => {
      expect(changed()).toHaveLength(2);
    });

    it('and both are the home cache in the news service', () => {
      expect([...changed()].sort()).toEqual([
        'backend/src/modules/news/news.service.home-cache.spec.ts',
        'backend/src/modules/news/news.service.ts',
      ]);
    });

    it('so no FRONTEND file differs between the two layers at all', () => {
      /*
        The fact that reframes the whole matrix: every "Alpha has X, Production
        does not" claim about a frontend surface is false.
      */
      expect(changed().filter((f) => f.startsWith('frontend/'))).toHaveLength(0);
    });
  });

  describe('THE CORRECTION THE RULING FORCED', () => {
    it('Ask AI is present in the GOVERNED BASELINE, not Alpha-only', () => {
      /*
        The original Checkpoint M finding compared against local `main` and
        concluded ALPHA-ONLY. `main` is a different lineage with no ask/
        directory; the governed baseline has all six files.
      */
      const askFiles = git('ls-tree', '-r', '--name-only', C911_V1_COMMIT, '--', 'frontend/src/components/ask/')
        .split('\n')
        .filter(Boolean);

      expect(askFiles.length).toBeGreaterThanOrEqual(6);
      expect(askFiles).toContain('frontend/src/components/ask/AskAiDock.tsx');
    });

    it('and it is mounted in the baseline’s own layout', () => {
      const layout = git('show', `${C911_V1_COMMIT}:frontend/src/app/layout.tsx`);

      expect(layout).toContain('AskAiDock');
    });

    it('while `main` is a DIFFERENT LINEAGE that has none of it', () => {
      /* Recorded so the rejected proxy cannot quietly return. */
      const onMain = git('ls-tree', '-r', '--name-only', 'main', '--', 'frontend/src/components/ask/');

      expect(onMain).toBe('');
    });
  });
});

describe('PHASE 2.2 — the capability claims the tree rests on', () => {
  const appModule = readFileSync(join(__dirname, 'app.module.ts'), 'utf-8');
  const modulePath = (name: string): string => join(__dirname, 'modules', name);

  describe('IMPLEMENTED BUT HIDDEN — registered, and serving no route', () => {
    for (const name of ['situation', 'signals', 'conflict-claim']) {
      it(`${name} has a module and NO controller`, () => {
        const controllers = existsSync(modulePath(name))
          ? readFileSync(join(modulePath(name), `${name}.module.ts`), 'utf-8')
          : '';

        expect(existsSync(modulePath(name))).toBe(true);
        expect(controllers).not.toMatch(/controllers:\s*\[\s*\w/);
      });
    }

    it('and each is nevertheless registered in the application', () => {
      expect(appModule).toContain('SituationModule');
      expect(appModule).toContain('SignalsModule');
      expect(appModule).toContain('ConflictClaimModule');
    });
  });

  describe('NOT IMPLEMENTED — Watch has no runtime at all', () => {
    it('no WatchModule is registered', () => {
      /*
        The tree says NOT IMPLEMENTED rather than "hidden", and this is why:
        there is nothing registered to hide.
      */
      expect(appModule).not.toMatch(/^\s*WatchModule,/m);
    });

    it('and the application says so in its own words', () => {
      expect(appModule).toMatch(/nothing here reaches Watch: no WatchModule, no scheduler, no route/);
    });
  });

  describe('DESIGNED ONLY — the specialist slots exist and nothing occupies them', () => {
    const registry = readFileSync(
      join(REPO, 'frontend', 'src', 'lib', 'specialist', 'specialistDomain.ts'),
      'utf-8',
    );

    it('three domain ids are declared', () => {
      expect(registry).toContain(
        "export type SpecialistDomainId = 'CONFLICT' | 'ELECTION' | 'DELIVERY';",
      );
    });

    it('and the registration function is never called in the product', () => {
      /*
        The load-bearing fact behind "DESIGNED ONLY". A registry with no
        registrations is a platform layer, not a feature.
      */
      const callers = execFileSync(
        'git',
        ['grep', '-l', 'registerSpecialistDomain(', '--', 'frontend/src'],
        { cwd: REPO, encoding: 'utf-8' },
      )
        .split('\n')
        .filter(Boolean)
        .filter((f) => !f.includes('.spec.') && !f.endsWith('specialistDomain.ts'));

      expect(callers).toEqual([]);
    });
  });
});

describe('PHASE 2 — the documents exist and carry their honesty markers', () => {
  const matrix = doc('ALPHA_PRODUCTION_PARITY_MATRIX.md');
  const tree = doc('MASTER_CAPABILITY_TREE.md');
  const register = doc('ALPHA_CONVERGENCE_R1_OPEN_ITEMS.md');

  it('the matrix records the live deployment commit as UNVERIFIED', () => {
    /*
      Railway exposes no commit hash for these deployments, and no Git ref is
      manufactured for them.
    */
    expect(matrix).toContain('**Live deployment commit**');
    expect(matrix).toContain('**UNVERIFIED**');
    expect(matrix).toContain('d1d564d3-3416-454e-8963-2216c9f30d32');
    expect(matrix).toContain('241e7157-7fec-47a6-b2d5-e3ca0d4d84c0');
  });

  it('it names C911-V1 as the governed baseline, not main', () => {
    expect(matrix).toContain('C911-V1');
    expect(matrix).toContain('do not use local `main` as the\nProduction proxy');
  });

  it('the capability tree classifies every named domain', () => {
    for (const domain of [
      'Home / Public Today',
      'Analysis',
      'Complete Analysis Record',
      'Spatial',
      'Watch / Follow',
      'Economy',
      'Market',
      'Security',
      'Conflict',
      'Imihigo',
      'Kenya Elections',
      'Admin',
      'Support',
      'Multilingual backbone',
      'PWA / offline',
      'Domain / SEO',
    ]) {
      expect(tree).toContain(domain);
    }
  });

  describe('THE SIX LOCKED OPEN ITEMS SURVIVE', () => {
    /* CTO: "Do not lose them from ALPHA_CONVERGENCE_R1_OPEN_ITEMS.md." */
    for (const item of [
      'SPATIAL-EVIDENCE-MODE-AFFORDANCE-1',
      'SPATIAL-COUNTRY-EVIDENCE-LAYER-TOGGLE-1',
      'SUPPORT-PRODUCT-KNOWLEDGE-ROUTING-1',
      'AUTH-OAUTH-ERROR-REASON-VISIBILITY-1',
      'ANALYSIS-NON-ENGLISH-MATERIAL-RELEVANCE-1',
    ]) {
      it(`${item} is still recorded`, () => {
        expect(register).toContain(item);
      });
    }

    it('and both live-Alpha validations are still pending', () => {
      expect(register).toContain('live-Alpha validation pending');
    });

    it('Phase 1 is recorded as audit COMPLETE, functionality PARTIAL', () => {
      expect(register).toContain('**Phase 1 audit**');
      expect(register).toContain('**COMPLETE**');
      expect(register).toContain('**PARTIAL**');
    });
  });
});
