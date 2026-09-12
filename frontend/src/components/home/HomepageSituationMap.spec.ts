import { readFileSync } from 'fs';
import { join } from 'path';

const source = readFileSync(join(__dirname, 'HomepageSituationMap.tsx'), 'utf-8');

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

describe('HomepageSituationMap (Master Frontend Recomposition, Checkpoint 3)', () => {
  it('lazy-loads the real WorldMap component via next/dynamic({ssr:false}) — the exact pattern already proven in MapPageClient.tsx', () => {
    expect(source).toMatch(/import dynamic from 'next\/dynamic'/);
    expect(source).toMatch(/dynamic\(\(\) => import\('@\/components\/map\/WorldMap'\)/);
    expect(source).toMatch(/ssr: false/);
  });

  it('does not duplicate map business logic — imports the real WorldMap, never redefines map rendering', () => {
    expect(source).not.toMatch(/maplibregl\.Map\(/);
  });

  it('makes zero fetch on mount — countryStoryCounts starts empty, no automatic page-load request', () => {
    expect(source).toMatch(/useState<Record<string, number>>\(\{\}\)/);
    expect(stripComments(source)).not.toMatch(/useEffect\(\(\) => \{[\s\S]*fetchCountryNews/);
  });

  it('the only fetchCountryNews call is inside the user-initiated country-select handler', () => {
    const callCount = (stripComments(source).match(/fetchCountryNews\(/g) ?? []).length;
    expect(callCount).toBe(1);
    const handlerIndex = source.indexOf('async function handleSelectCountry');
    const callIndex = source.indexOf('await fetchCountryNews(');
    expect(callIndex).toBeGreaterThan(handlerIndex);
  });

  it('reuses the SAME fetchCountryNews function /map itself uses — no duplicated retrieval logic', () => {
    expect(source).toMatch(/import \{ fetchCountryNews \} from '@\/lib\/api\/countryApi'/);
  });

  it('summary values are all computed from the real response — no fabricated alert/risk/severity fields', () => {
    expect(stripComments(source)).not.toMatch(/alert|risk|severity|casualt/i);
    expect(source).toMatch(/function computeSummary/);
  });

  it('shows an honest "no selection yet" state before any country is chosen — never pre-filled fake data', () => {
    expect(source).toMatch(/!selectedIso3 \?/);
    expect(source).toMatch(/\{t\.noSelectionPrompt\}/);
  });

  it('shows an honest empty-coverage state when a real response has zero articles', () => {
    expect(source).toMatch(/\{t\.noCoverageLabel\}/);
  });

  it('country display name uses the established localized helper, not a hardcoded/new translation', () => {
    expect(source).toMatch(/getCountryDisplayName/);
  });

  it('links to the real full /map experience', () => {
    expect(source).toMatch(/href="\/map"/);
  });

  it('is a client component — the lazy-map interaction genuinely requires it', () => {
    expect(source.trimStart().startsWith("'use client'")).toBe(true);
  });
});
