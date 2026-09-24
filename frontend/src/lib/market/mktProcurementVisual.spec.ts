import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SRC = join(__dirname, '..', '..');
const read = (relative: string): string => readFileSync(join(SRC, relative), 'utf8');

describe('Market Procurement R1 native composition', () => {
  it.each([
    ['app/market/page.tsx', 'MarketScreen'],
    ['app/market/compact/page.tsx', 'MarketCompactScreen'],
  ] as const)('%s reads retained procurement and passes it into %s', (route, screen) => {
    const source = read(route);
    expect(source).toContain('readMarketProcurement()');
    expect(source).toContain(`<${screen}`);
    expect(source).toContain('procurement={procurement}');
    expect(source).not.toMatch(/api\.ted\.europa\.eu|ted\.europa\.eu\/v3/);
  });

  it.each([
    'components/market/MarketScreen.tsx',
    'components/market/MarketCompactScreen.tsx',
  ])('%s keeps procurement inside the existing substrate', (screen) => {
    const source = read(screen);
    expect(source).toContain("<SubstratePanel t={t}>");
    expect(source).toContain('<ProcurementCard');
    expect(source).toContain("procurement.kind === 'PROCUREMENT'");
    expect(source).toContain('procurementCount={procurementCount}');
    expect(source).not.toContain('AlphaRetainedReportingDock');
  });

  it('the procurement card renders source facts but no rank, score or inferred change state', () => {
    const source = read('components/market/MktReader.tsx');
    expect(source).toContain('data-mkt="procurement-observation"');
    expect(source).toContain('notice.publicationNumber');
    expect(source).toContain('notice.noticeType');
    expect(source).toContain('notice.buyerCountries');
    expect(source).toContain('notice.cpvCodes');
    expect(source).toContain('notice.totalValue');
    expect(source).toContain('procurementSourceHref');
    expect(source).not.toMatch(/procurement.*(?:score|rank|similarity)/i);
  });

  it('Watch remains unavailable for the procurement subject', () => {
    const screen = read('components/market/MarketScreen.tsx');
    expect(screen).toContain('t.labels.watchUnavailable');
    const shared = readFileSync(
      join(SRC, '..', '..', 'shared', 'src', 'market', 'index.ts'),
      'utf8',
    );
    expect(shared).toContain("PROCUREMENT_OPPORTUNITY: 'NEW_SUBJECT_TYPE_REQUIRED'");
  });
});
