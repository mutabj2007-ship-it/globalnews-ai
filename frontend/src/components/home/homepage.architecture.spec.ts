import { readFileSync } from 'fs';
import { join } from 'path';

const pageSource = readFileSync(join(__dirname, '../../app/page.tsx'), 'utf-8');
const globalDevelopmentsSource = readFileSync(join(__dirname, 'GlobalDevelopments.tsx'), 'utf-8');

/**
 * Milestone #53 regression repair — this file previously encoded the
 * OLDER M51 homepage architecture (NewsroomSection, CategoryCards,
 * LatestUpdatesFeed, WorldMapGateway — all retired, not imported by
 * page.tsx since the Master Frontend Recomposition round; see
 * page.tsx's own doc comment for the full retire/retain audit).
 * Rewritten to protect the CURRENT, real, rendered section order and
 * data-flow contract instead.
 *
 * The getHomeFeed-call-count check previously used a naive
 * `pageSource.match(/getHomeFeed\(/g)` count, which the real file
 * fails: page.tsx's own doc comment prose mentions "getHomeFeed()"
 * once in plain English before the real, single executable call —
 * two textual occurrences, one real call. Fixed by stripping comments
 * first, using the same helper convention already established
 * elsewhere in this codebase (see LatestNowRail.spec.ts).
 */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

describe('Homepage current architecture (Milestone #53 — post-recomposition)', () => {
  it('renders sections in the approved current order: NavBar, LiveStatusStrip, LatestNowRail, Hero, GlobalDevelopments, HomepageSituationMap, IntelligenceModulesDesktop, IntelligenceModulesMobile, HowItWorks, TrustSection, Footer, MobileBottomNav', () => {
    const order = [
      '<NavBar',
      '<LiveStatusStrip',
      '<LatestNowRail',
      '<Hero',
      '<GlobalDevelopments',
      '<HomepageSituationMap',
      '<IntelligenceModulesDesktop',
      '<IntelligenceModulesMobile',
      '<HowItWorks',
      '<TrustSection',
      '<Footer',
      '<MobileBottomNav',
    ];
    let lastIndex = -1;
    for (const marker of order) {
      const index = pageSource.indexOf(marker);
      expect(index).toBeGreaterThan(lastIndex);
      lastIndex = index;
    }
  });

  it('makes exactly one EXECUTABLE getHomeFeed call \u2014 comment/prose mentions of the same text do not count', () => {
    const codeOnly = stripComments(pageSource);
    const matches = codeOnly.match(/getHomeFeed\(/g) ?? [];
    expect(matches.length).toBe(1);
  });

  it('page.tsx contains no direct fetch() call \u2014 the single request stays inside getHomeFeed', () => {
    expect(stripComments(pageSource)).not.toMatch(/\bfetch\(/);
  });

  it('LatestNowRail and Hero both receive the SAME feed.latestUpdates \u2014 one derivation source, not a duplicated allocation', () => {
    expect(pageSource).toMatch(/<LatestNowRail updates=\{feed\.latestUpdates\}/);
    expect(pageSource).toMatch(/<Hero latestArticles=\{feed\.latestUpdates\}/);
  });

  it('GlobalDevelopments receives the real Phase B lead/secondary fields, not a fabricated shape', () => {
    expect(pageSource).toMatch(/lead=\{feed\.featured\}/);
    expect(pageSource).toMatch(/secondary=\{feed\.inFocus\}/);
  });
});

describe('DataMode/provider labeling (Milestone #53 \u2014 current owner)', () => {
  it('DataModeLabel is rendered by GlobalDevelopments, the current single homepage editorial surface (retired NewsroomSection/LatestUpdatesFeed are no longer part of this contract)', () => {
    expect(globalDevelopmentsSource).toMatch(/DataModeLabel/);
  });

  it('LatestNowRail carries no per-card data-mode badge', () => {
    const railSource = readFileSync(join(__dirname, 'LatestNowRail.tsx'), 'utf-8');
    expect(railSource).not.toMatch(/<DataModeLabel/);
  });
});

describe('Single-fetch architecture is preserved (Milestone #51/#53)', () => {
  it('page.tsx still uses the real HomeFeed semantic fields it currently depends on', () => {
    expect(pageSource).toMatch(/feed\.featured/);
    expect(pageSource).toMatch(/feed\.inFocus/);
    expect(pageSource).toMatch(/feed\.latestUpdates/);
    expect(pageSource).toMatch(/feed\.dataMode/);
    expect(pageSource).toMatch(/feed\.isLive/);
  });

  it('no old trending/categoryCards HomeFeed field names remain', () => {
    expect(pageSource).not.toMatch(/feed\.trending/);
    expect(pageSource).not.toMatch(/feed\.categoryCards/);
  });
});
