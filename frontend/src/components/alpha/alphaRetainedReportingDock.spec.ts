import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SRC = join(__dirname, '..', '..');
const read = (path: string): string => readFileSync(path, 'utf-8');

describe('Alpha Product Owner retained-reporting overlay', () => {
  const dock = read(join(SRC, 'components', 'alpha', 'AlphaRetainedReportingDock.tsx'));

  it('has exactly one same-origin retained review read and no provider / AI route', () => {
    expect(dock).toContain("fetch('/api/admin/alpha-review'");
    expect([...dock.matchAll(/\bfetch\s*\(/g)]).toHaveLength(1);
    expect(dock).toContain("credentials: 'same-origin'");
    expect(dock).not.toMatch(/https?:\/\/|\/analysis\/|\/news\/|gnews|openai/i);
  });

  it('labels the evidence as unassessed context and leaves the public gate closed', () => {
    expect(dock).toContain('CONTEXT ONLY · PUBLIC CLOSED');
    expect(dock).toContain('candidates · unassessed');
    expect(dock).not.toMatch(/verified incident|confirmed incident|public open/i);
  });

  it.each([
    ['politics', 'app/politics-visual-preview/page.tsx'],
    ['politics', 'app/politics-visual-preview/compact/page.tsx'],
    ['security', 'app/security-visual-preview/page.tsx'],
    ['security', 'app/security-visual-preview/compact/page.tsx'],
    ['conflict', 'app/conflict/page.tsx'],
    ['market', 'app/market/page.tsx'],
    ['market', 'app/market/compact/page.tsx'],
    ['energy', 'app/energy/page.tsx'],
    ['humanitarian', 'app/humanitarian/page.tsx'],
    ['humanitarian', 'app/humanitarian/compact/page.tsx'],
  ] as const)('%s retained reporting is mounted on %s', (domain, relativePath) => {
    const page = read(join(SRC, relativePath));
    expect(page).toContain(`<AlphaRetainedReportingDock domain="${domain}" />`);
  });
});
