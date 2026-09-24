import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SRC = join(__dirname, '..', '..');

describe('specialist dashboards do not mount generic retained-reporting overlays', () => {
  const routes = [
    'app/politics-visual-preview/page.tsx',
    'app/politics-visual-preview/compact/page.tsx',
    'app/security-visual-preview/page.tsx',
    'app/security-visual-preview/compact/page.tsx',
    'app/conflict/page.tsx',
    'app/market/page.tsx',
    'app/market/compact/page.tsx',
    'app/energy/page.tsx',
    'app/humanitarian/page.tsx',
    'app/humanitarian/compact/page.tsx',
  ];

  it.each(routes)('%s contains no generic Alpha review feed', (relativePath) => {
    const source = readFileSync(join(SRC, relativePath), 'utf-8');
    expect(source).not.toContain('AlphaRetainedReportingDock');
    expect(source).not.toContain('/api/admin/alpha-review');
  });
});
