import { readFileSync } from 'fs';
import { join } from 'path';

const heroSource = readFileSync(join(__dirname, 'Hero.tsx'), 'utf-8');
const mapSource = readFileSync(join(__dirname, 'HomepageSituationMap.tsx'), 'utf-8');
const engineSource = readFileSync(join(__dirname, 'IntelligenceEngineInteractive.tsx'), 'utf-8');
const shellSource = readFileSync(join(__dirname, 'IntelligenceModulesDesktop.tsx'), 'utf-8');
const worldVisualSource = readFileSync(join(__dirname, 'HeroWorldVisual.tsx'), 'utf-8');
const howItWorksSource = readFileSync(join(__dirname, 'HowItWorks.tsx'), 'utf-8');
const trustSource = readFileSync(join(__dirname, 'TrustSection.tsx'), 'utf-8');
const navSource = readFileSync(join(__dirname, '../navigation/NavBar.tsx'), 'utf-8');
const footerSource = readFileSync(join(__dirname, '../layout/Footer.tsx'), 'utf-8');

/**
 * CTO reference-locked reconstruction — a single pass touching Hero
 * proportions/search, world-visual density, Situation Map
 * proportions, Engine compaction, HUD geometry coverage, How It
 * Works/Trust/Nav/Footer tuning, and typography rhythm. This test
 * file protects the concrete, verifiable outcomes of that pass.
 */
describe('Reference-locked reconstruction — Hero', () => {
  it('the Hero grid gives the world visual clear dominance (~32/68 split), not the earlier ~40/60', () => {
    expect(heroSource).toMatch(/lg:grid-cols-\[0\.47fr_1fr\]/);
  });

  it('the search field uses the compact clipped HUD shell, not a plain large rounded input', () => {
    expect(heroSource).toMatch(/HUD_CARD_CLIP/);
    expect(heroSource).toMatch(/max-w-xl/);
  });

  it('the headline is tightened for the narrower column (smaller size, tighter line-height)', () => {
    expect(heroSource).toMatch(/text-3xl font-medium leading-\[1\.05\]/);
  });
});

describe('Reference-locked reconstruction — World visual', () => {
  it('has a distinct micro-particle layer beyond the dense dot-matrix grid', () => {
    expect(worldVisualSource).toMatch(/Micro-particles/);
  });
});

describe('Reference-locked reconstruction — Situation Map', () => {
  it('the map dominates at roughly 72/28, not the earlier more balanced ~62/38', () => {
    expect(mapSource).toMatch(/lg:grid-cols-\[2\.7fr_1fr\]/);
  });

  it('the Open Full Map CTA is integrated into the context panel\u2019s own frame, not a detached section-header button', () => {
    expect(mapSource).toMatch(/Open Full Map CTA — integrated/);
  });
});

describe('Reference-locked reconstruction — Intelligence Engine compaction', () => {
  it('heading-to-hub and hub-to-connector gaps are further reduced', () => {
    expect(shellSource).toMatch(/mb-2 flex flex-wrap items-end/);
    expect(engineSource).toMatch(/mb-1 flex flex-col items-center/);
  });

  it('the connector SVG height is reduced, shortening the routed distance to the card bank', () => {
    expect(engineSource).toMatch(/h-4 w-full max-w-3xl/);
  });
});

describe('Reference-locked reconstruction — HUD geometry coverage', () => {
  it('How It Works and Trust now carry corner brackets, extending the HUD geometry system beyond Hero/Modules/Map/Footer', () => {
    expect(howItWorksSource).toMatch(/hudCornerBracketClassName/);
    expect(trustSource).toMatch(/hudCornerBracketClassName/);
  });

  it('How It Works section padding/gaps are compressed', () => {
    expect(howItWorksSource).toMatch(/py-6 sm:px-6 sm:py-7/);
  });
});

describe('Reference-locked reconstruction — Nav/Footer', () => {
  it('nav height is reduced and a bottom technical scan-line rail is present', () => {
    expect(navSource).toMatch(/h-14 max-w/);
    expect(navSource).toMatch(/bg-gradient-to-r from-transparent via-cyan-400\/50 to-transparent/);
  });

  it('footer padding is further tightened and the status line carries a real indicator dot', () => {
    expect(footerSource).toMatch(/py-4 sm:px-6 lg:px-8/);
    expect(footerSource).toMatch(/bg-cyan-400" \/>/);
  });
});
