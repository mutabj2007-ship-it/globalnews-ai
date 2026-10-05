import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

/**
 * UNIFIED INTELLIGENCE BINDING R2G — LEGACY RETIREMENT GUARD (server side).
 *
 * ONE Ask engine: the canonical Ask V2 adapter is the only Ask caller of the analysis engine.
 * Exactly three production call sites of `AnalysisService.analyzeNews` exist, each named here:
 *
 *   1. analysis/controller/analysis.controller.ts — POST /analysis/news. KEPT as a public
 *      COMPATIBILITY route. STAGE 2 / T4 (measured at Alpha 5513275f and Production frontend
 *      58f80fd4): no mounted frontend surface calls it any more — the dock, /ask, /search and
 *      My Intelligence all send to Ask V2, and `analyzeNews` in lib/api/analysisApi.ts is
 *      imported only by unmounted code (useAskConversation.ts, AnalysisFrameClient.tsx). It is
 *      not deleted or 410'd (contract R2G): unknown/external callers and stale clients are now
 *      MEASURED by the PII-free legacy-usage interceptor (GET /admin/analytics/legacy-usage),
 *      and it becomes internal-only per docs/convergence/stage2/T4-LEGACY-ASK-CONVERGENCE.md
 *      once /history and admin analytics have migrated and the observation window is clean.
 *   2. ask-v2/ask-r2-execution.adapter.ts — the canonical engine (one private analyze()).
 *   3. support/support-ai.service.ts — Support AI's one reporting category: a documented
 *      non-Ask exception (REMAINING-EXCEPTIONS.md).
 *
 * A fourth call site (a second Ask engine) fails this guard.
 */

const SRC = join(__dirname, '..', '..');
const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
const code = (text: string) =>
  text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

describe('R2G — the analysis engine has exactly the three named callers', () => {
  const production = walk(SRC)
    .filter(
      (p) =>
        p.endsWith('.ts') && !/\.spec\.ts$/.test(p) && !p.includes(`${sep}qualification${sep}`),
    )
    .map((p) => ({
      rel: relative(SRC, p).split(sep).join('/'),
      text: code(readFileSync(p, 'utf8')),
    }));

  it('only the legacy route, the canonical adapter and Support AI call analyzeNews', () => {
    const callers = production
      .filter((f) => /\b(?:analysis|analysisService)\.analyzeNews\s*\(/.test(f.text))
      .map((f) => f.rel)
      .sort();
    expect(callers).toEqual([
      'modules/analysis/controller/analysis.controller.ts',
      'modules/ask-v2/ask-r2-execution.adapter.ts',
      'modules/support/support-ai.service.ts',
    ]);
  });

  it('the legacy route is still served (not deleted, not 410) — real callers may depend on it', () => {
    const controller = production.find(
      (f) => f.rel === 'modules/analysis/controller/analysis.controller.ts',
    )!.text;
    expect(controller).toMatch(/@Controller\('analysis'\)/);
    expect(controller).toMatch(/@Post\('news'\)/);
    expect(controller).not.toMatch(/HttpStatus\.GONE|GoneException/);
  });
});
