import { readFileSync } from 'fs';
import { join } from 'path';

const mapSource = readFileSync(join(__dirname, 'HomepageSituationMap.tsx'), 'utf-8');
const heroSource = readFileSync(join(__dirname, 'Hero.tsx'), 'utf-8');
const globalDevSource = readFileSync(join(__dirname, 'GlobalDevelopments.tsx'), 'utf-8');
const cardSource = readFileSync(join(__dirname, 'IntelligenceModuleCard.tsx'), 'utf-8');

/**
 * CTO reference-locked reconstruction — real browser screenshots
 * showed three sections rendering as large, mostly-empty panels
 * (Situation Map's no-selection state, Hero's live-feed-unavailable
 * state, and Global Developments' unavailable state) plus
 * near-invisible comingSoon module cards. This test file protects
 * the fixes made in response to that concrete evidence.
 *
 * Every added row/tile is a real, truthful system-state description
 * — never a fabricated headline, count, or event. These tests check
 * that discipline is maintained alongside the density fix.
 */
describe('Situation Map no-selection state — filled with real structural rows, not empty space', () => {
  it('shows real system-state rows (country coverage, map mode) instead of two sparse lines', () => {
    expect(mapSource).toMatch(/t\.countryCoverageLabel/);
    expect(mapSource).toMatch(/t\.mapModeLabel/);
    expect(mapSource).toMatch(/t\.mapModeValue/);
  });

  it('never fabricates a story count or coverage number in this default state', () => {
    const defaultStateBlock = mapSource.slice(mapSource.indexOf('{!selectedIso3 ?'), mapSource.indexOf('isLoading ?'));
    expect(defaultStateBlock).not.toMatch(/\d+\s*(stories|articles|reports)/i);
  });
});

describe('Hero live-feed-unavailable panel — filled with real structural status rows', () => {
  it('shows real availability rows for search/country/map intelligence, not just 2-3 short sentences', () => {
    expect(heroSource).toMatch(/t\.feedPanelSearchStatus/);
    expect(heroSource).toMatch(/t\.feedPanelCountryStatus/);
    expect(heroSource).toMatch(/t\.feedPanelMapStatus/);
    expect(heroSource).toMatch(/t\.feedPanelAvailable/);
  });

  it('status rows are rendered from a real array, not fabricated per-row content', () => {
    expect(heroSource).toMatch(/\[t\.feedPanelSearchStatus, t\.feedPanelCountryStatus, t\.feedPanelMapStatus\]\.map/);
  });
});

describe('Global Developments unavailable state — compact status-tile rail instead of one large empty box', () => {
  it('renders a horizontal rail of real system-state tiles, not a single tall sparse panel', () => {
    expect(globalDevSource).toMatch(/statusFeedUnavailable/);
    expect(globalDevSource).toMatch(/statusCountryAvailable/);
    expect(globalDevSource).toMatch(/statusSearchAvailable/);
    expect(globalDevSource).toMatch(/statusMapAvailable/);
    expect(globalDevSource).toMatch(/statusWaitingProvider/);
  });

  it('the status tile rail is horizontally compact (fixed tile width, overflow-x-auto), matching the reference\u2019s trending-rail density', () => {
    expect(globalDevSource).toMatch(/w-\[160px\] shrink-0/);
    expect(globalDevSource).toMatch(/overflow-x-auto/);
  });

  it('every tile shows a real ok/not-ok status, never an invented headline', () => {
    expect(globalDevSource).toMatch(/ok: false/);
    expect(globalDevSource).toMatch(/ok: true/);
    expect(globalDevSource).not.toMatch(/fake|dummy|placeholder.*headline/i);
  });
});

describe('Coming Soon module cards — visible, not near-invisible', () => {
  it('comingSoon opacity is high enough to remain clearly readable (0.85), not the earlier too-dim 0.60', () => {
    expect(cardSource).toMatch(/border-border-strong\/70 opacity-85/);
  });

  it('the module title always uses the bright primary ink color regardless of state, so titles never disappear', () => {
    expect(cardSource).toMatch(/<h3 className="text-sm font-semibold text-ink-primary">/);
  });
});
