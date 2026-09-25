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

  it('makes zero provider-capable country read on mount OR selection', () => {
    expect(source).toMatch(/useState<Record<string, number>>\(\{\}\)/);
    const code = stripComments(source);
    expect(code).not.toMatch(/fetchCountryNews/);
    expect(code).not.toMatch(/performCountryRead/);
  });

  it('country selection changes scope only and directs deeper work to the full map', () => {
    const code = stripComments(source);
    expect(code).toMatch(/function handleSelectCountry/);
    expect(code).toMatch(/setSelectedIso3\(country\.iso3\)/);
    expect(code).toMatch(/setSelectedName/);
    expect(code).not.toMatch(/async function handleSelectCountry/);
    /*
      C3 RE-POINT, per BETA-DESIGN-AUTHORITY-R5.1 §3 — the assertion is kept,
      not deleted; only what it points at moved.

      It used to pin the English sentence as a source literal. Restoring this
      card to Home made that string reachable again, and a Polish reader was
      answered in English the moment they selected a country, which the
      contract's EN/PL parity rule forbids. The sentence is now the governed
      `situationMap.selectionScopeNote` key, so the behaviour this test
      protects — selection states that it changed scope only, and sends deeper
      work to the full map — is asserted through the key, while the wording is
      asserted in the dictionary alongside every other string.
    */
    expect(code).toMatch(/\{t\.selectionScopeNote\}/);
  });

  it('does not fabricate alert, risk, severity or story-summary metrics', () => {
    expect(stripComments(source)).not.toMatch(/alert|risk|severity|casualt/i);
    expect(stripComments(source)).not.toMatch(/computeSummary/);
  });

  it('shows an honest "no selection yet" state before any country is chosen — never pre-filled fake data', () => {
    expect(source).toMatch(/!selectedIso3 \?/);
    expect(source).toMatch(/\{t\.noSelectionPrompt\}/);
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
