import { existsSync, readFileSync } from 'fs';
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

describe('Homepage current architecture (M60 Phase 2 — LatestNowRail removed as a duplicate presentation of feed.latestUpdates)', () => {
  it('renders sections in the approved current order: NavBar, LiveStatusStrip, Hero, GlobalDevelopments, IntelligenceEngineSection, HowItWorks, TrustSection, Footer, MobileBottomNav', () => {
    // M65.1 — the two per-breakpoint Intelligence Engine renderers were
    // replaced by ONE section that serves every breakpoint.
    // M66.8c — HomepageSituationMap is retired from this render path. The
    // ORDER contract this test protects is otherwise unchanged; the marker
    // was removed, not reordered, and its component file remains on disk.
    const order = [
      '<NavBar',
      '<LiveStatusStrip',
      '<Hero',
      '<GlobalDevelopments',
      '<IntelligenceEngineSection',
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

  it('M65.1 — the retired per-breakpoint Intelligence Engine renderers are no longer wired into the homepage (their files are retained, unimported)', () => {
    expect(stripComments(pageSource)).not.toMatch(/<IntelligenceModulesDesktop/);
    expect(stripComments(pageSource)).not.toMatch(/<IntelligenceModulesMobile/);
    expect(stripComments(pageSource)).not.toMatch(/import \{ IntelligenceModulesDesktop \}/);
    expect(stripComments(pageSource)).not.toMatch(/import \{ IntelligenceModulesMobile \}/);
  });

  it('M66.8c — HomepageSituationMap is retired from the homepage, and its file is RETAINED', () => {
    // Exactly the shape of the M65.1 test above: unwired here, kept on disk.
    // The doc comment still names it, which is why both guards run on
    // comment-stripped source.
    const code = stripComments(pageSource);
    expect(code).not.toMatch(/<HomepageSituationMap/);
    expect(code).not.toMatch(/import \{ HomepageSituationMap \}/);
    expect(code).not.toMatch(/HomepageSituationMap/);
    // RETAINED, not deleted. If a later cleanup removes the file, this fails —
    // and so would five direct specs that read it and are outside M66.8c's
    // scope. "Retired from the page" must never quietly become "deleted".
    expect(existsSync(join(__dirname, 'HomepageSituationMap.tsx'))).toBe(true);
  });

  it('M66.8c — no duplicate situation-map surface was left behind or re-added elsewhere', () => {
    const code = stripComments(pageSource);
    expect(code).not.toMatch(/SituationMap|WorldMap|situationMap/);
    // And /map itself is untouched: the route file still renders the real
    // client, so the capability moved nowhere.
    const mapRoute = readFileSync(join(__dirname, '../../app/map/page.tsx'), 'utf-8');
    expect(mapRoute).toMatch(/MapPageClient/);
  });

  it('M66.8c — the World Map remains reachable from the homepage, five ways, none of them the retired section', () => {
    const navModel = readFileSync(join(__dirname, '../../lib/navModel.ts'), 'utf-8');
    expect(navModel).toMatch(/label: 'World Map'/);
    const bottomNav = readFileSync(join(__dirname, '../navigation/MobileBottomNav.tsx'), 'utf-8');
    expect(bottomNav).toMatch(/href: '\/map'/);
    const hero = readFileSync(join(__dirname, 'Hero.tsx'), 'utf-8');
    expect((hero.match(/href="\/map"/g) ?? []).length).toBe(2);
    const feedPanel = readFileSync(join(__dirname, 'HeroLiveFeedPanel.tsx'), 'utf-8');
    expect(feedPanel).toMatch(/href="\/map"/);
  });

  it('makes exactly one EXECUTABLE getHomeFeed call \u2014 comment/prose mentions of the same text do not count', () => {
    const codeOnly = stripComments(pageSource);
    const matches = codeOnly.match(/getHomeFeed\(/g) ?? [];
    expect(matches.length).toBe(1);
  });

  it('page.tsx contains no direct fetch() call \u2014 the single request stays inside getHomeFeed', () => {
    expect(stripComments(pageSource)).not.toMatch(/\bfetch\(/);
  });

  it('Hero is the sole presentation of feed.latestUpdates (M60 Phase 2 deduplication — the former separate LatestNowRail import/render was removed from page.tsx; the source file itself is preserved, unimported, per the "do not destroy potentially reusable code" instruction)', () => {
    expect(pageSource).not.toMatch(/<LatestNowRail/);
    expect(pageSource).not.toMatch(/import \{ LatestNowRail \}/);
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
