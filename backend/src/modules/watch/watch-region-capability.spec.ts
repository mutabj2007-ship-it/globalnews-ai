import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { WATCH_RUNTIME_ACTIVE } from './watch-runtime.policy';

/**
 * CTO R-5 (2026-10-05) — the governed East Africa REGION Watch does not exist yet and must not be
 * faked. Story-level follow-up is the in-app story Alert (stories/alerts); a region Watch over a
 * PRODUCT-GOVERNED scope (region:east-africa, region:middle-east, …) is UNAVAILABLE until a
 * monitoring tranche implements it. This pins both facts so a quiet "11-country Watch" fails here.
 */
describe('R-5 · regional Watch is honestly unavailable', () => {
  it('the Watch runtime is dormant', () => {
    expect(WATCH_RUNTIME_ACTIVE).toBe(false);
  });

  it('no Watch file treats a product-governed scope as a watchable subject', () => {
    const files = readdirSync(__dirname).filter((f) => f.endsWith('.ts') && !f.endsWith('.spec.ts'));
    const offenders = files.filter((f) =>
      /region:east-africa|region:middle-east|region:european-union|PRODUCT_COVERAGE_SCOPES|EAST_AFRICA_MEMBERS|MIDDLE_EAST_MEMBERS/.test(
        readFileSync(join(__dirname, f), 'utf8'),
      ),
    );
    expect(offenders).toEqual([]);
  });
});
