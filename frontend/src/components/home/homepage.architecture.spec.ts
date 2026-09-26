import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const pageSource = readFileSync(join(__dirname, '../../app/page.tsx'), 'utf-8');
const whatsHappeningNowSource = readFileSync(join(__dirname, 'WhatsHappeningNow.tsx'), 'utf-8');

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
  it('renders sections in the approved current order: NavBar, BetaHero, WhatsHappeningNow, ExploreByTopic, HowItWorks, TrustSection, Footer, MobileBottomNav', () => {
    // M65.1 — the two per-breakpoint Intelligence Engine renderers were
    // replaced by ONE section that serves every breakpoint.
    // M66.8c — HomepageSituationMap is retired from this render path. The
    // ORDER contract this test protects is otherwise unchanged; the marker
    // was removed, not reordered, and its component file remains on disk.
    const order = [
      '<NavBar',
      /* H2 · Issue #29 — BetaHero replaces Hero at this mount point
         (H0 zone Z6-Z9). The ORDER contract this list protects is
         unchanged; only the section's identity moved. */
      '<BetaHero',
      /* H3 · Issue #29 — the approved R4.1 composition. LiveStatusStrip and
         GlobalDevelopments are retired from Home (files kept on disk), and
         WhatsHappeningNow carries the editorial area plus the degraded-feed
         state the strip used to carry. The ORDER contract is unchanged. */
      '<WhatsHappeningNow',
      /* DESKTOP COMPOSITION RULING §3 — the Global Situation Map sits to the
         RIGHT of the story cards, not below them, so it is mounted inside
         HomeSideRail rather than in this file. Its marker leaves this list
         because the list protects THIS file's order; the map's placement is
         now asserted where it lives. */
      /* DESKTOP COMPOSITION RULING §1 — ExploreByTopic moves INSIDE the
         left main column, directly beneath the story rail, so the right rail
         spans the same vertical band as stories + topics. The ruling calls
         that relationship "the key design", and a sibling section could only
         ever begin after the rail ended. */
      '<ExploreByTopic',
      /* DESKTOP COMPOSITION RULING §6/§7 — the nine-card Intelligence Engine
         LEAVES HOME for a future separate intelligence/topics page:
         "the full nine-card Intelligence Engine is no longer required inside
         this first high-engagement Home composition". IntelligenceModulesSection
         and EngineEnergyField are retired from this render path, not deleted;
         both files stay on disk and their own specs read those files rather
         than this one. */
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

  /*
    C3 RE-POINT (BETA HOME CLOSURE R2), per BETA-DESIGN-AUTHORITY-R5.1 §3.

    These two tests pinned the M66.8c decision that HomepageSituationMap is
    retired from Home. The R2 contract reverses that decision: the Global
    Situation Map card is required on Home, with a four-module legend. The
    assertions are therefore re-pointed rather than deleted — the subject is
    still "where does the situation map live, and is the file still on disk",
    which is exactly what M66.8c cared about.

    M66.8c's reasoning also rested on a premise that no longer holds. It
    retired the section partly because it was "a strict subset of /map: the
    same WorldMap component, the same fetchCountryNews() call". There is no
    fetchCountryNews() call any more — the card makes ZERO provider-capable
    reads on mount and on selection — so the section is no longer a cheaper
    copy of /map; it is a quota-free gateway to it.
  */
  it('SIMPLIFICATION RULING — HomepageSituationMap is NOT mounted on Home, and its file is RETAINED', () => {
    /*
      ══════════════════════════════════════════════════════════════════════
      THIS TEST WAS INVERTED, DELIBERATELY.
      ══════════════════════════════════════════════════════════════════════

      It used to assert the opposite — that the map IS mounted on Home — under
      DESKTOP COMPOSITION RULING §3. The Product Owner superseded that:

        "The `Global Situation Map` is no longer required on Home. Remove it
         from the Home composition at all responsive breakpoints. This does not
         remove the Map product or `/map`. `Open Map` remains a prominent Hero
         action and is the correct gateway to the full geographic intelligence
         experience."

      So the assertion follows the newer ruling. What the test is FOR is
      unchanged: it pins where the situation map is and is not, so neither a
      quiet re-mount nor a quiet deletion can happen without a failure here.
    */
    const railSource = stripComments(readFileSync(join(__dirname, 'HomeSideRail.tsx'), 'utf-8'));
    expect(stripComments(pageSource)).toMatch(/<HomeSideRail/);
    expect(railSource).not.toMatch(/<HomepageSituationMap/);
    expect(railSource).not.toMatch(/import \{ HomepageSituationMap \}/);
    /* RETAINED, not deleted — the convention this repository already applies
       to Hero, GlobalDevelopments, LiveStatusStrip and the engine section. If
       a later cleanup removes the file this fails, and so would the direct
       specs that read it. */
    expect(existsSync(join(__dirname, 'HomepageSituationMap.tsx'))).toBe(true);
  });

  it('SIMPLIFICATION RULING — Home mounts NO situation-map surface, and /map is untouched', () => {
    /*
      The invariant this test exists for is the same one it always had: Home
      must never carry more than one situation-map surface, and must never
      reach for MapLibre itself. The ruled count is now zero rather than one,
      and the count is still taken across the whole Home render path rather
      than in a single file, so a future move cannot reintroduce one quietly.
    */
    const railSource = readFileSync(join(__dirname, 'HomeSideRail.tsx'), 'utf-8');
    const code = stripComments(pageSource) + stripComments(railSource);
    expect(code.match(/<HomepageSituationMap/g)).toBeNull();
    expect(code).not.toMatch(/<WorldMap/);
    /*
      AND THE CAPABILITY MOVED NOWHERE. This is the half of the ruling that
      matters most — "This does not remove the Map product or `/map`" — so the
      route is asserted here rather than assumed.
    */
    const mapRoute = readFileSync(join(__dirname, '../../app/map/page.tsx'), 'utf-8');
    expect(mapRoute).toMatch(/MapPageClient/);
    /* And the Hero still carries "Open Map" as the gateway the ruling names. */
    const heroSource = readFileSync(join(__dirname, 'BetaHero.tsx'), 'utf-8');
    expect(heroSource).toMatch(/href="\/map"/);
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
    expect(pageSource).toMatch(/<BetaHero language=\{language\} latestUpdates=\{feed\.briefUpdates\}/);
  });

  /*
    CONVERTED UNDER CTO-APPROVED STEP 4. `discovery` joins the two roles this
    already protected. It was allocated on every request and rendered by
    nothing — six real current stories discarded per page load — so this
    assertion now also guards against silently dropping it again.
  */
  it('WhatsHappeningNow receives the real curated roles (featured/inFocus/discovery), not a fabricated shape', () => {
    expect(pageSource).toMatch(/lead=\{feed\.featured\}/);
    expect(pageSource).toMatch(/secondary=\{feed\.inFocus\}/);
    expect(pageSource).toMatch(/discovery=\{feed\.discovery\}/);
  });

  it('STEP 4 — the two surfaces read DIFFERENT roles of the same single response', () => {
    /*
      The role separation, stated where the wiring lives. The Hero's Live Feed
      takes `latestUpdates` — allocateHomeFeed documents it as 'everything, in
      time order', deliberately exempt from the distinctness rule. Global
      Developments takes the three CURATED roles, which that same module
      guarantees are mutually distinct. One response, two jobs.
    */
    expect(pageSource).toMatch(/<BetaHero language=\{language\} latestUpdates=\{feed\.briefUpdates\}/);
    expect(pageSource).not.toMatch(/latestUpdates=\{feed\.(featured|inFocus|discovery)\}/);
    expect(pageSource).not.toMatch(/(lead|secondary|discovery)=\{feed\.latestUpdates\}/);
  });
});

describe('DataMode/provider labeling (Milestone #53 \u2014 current owner)', () => {
  it('DataModeLabel is rendered by WhatsHappeningNow, the single homepage editorial surface', () => {
    /* H3 · Issue #29 — the surface moved; the duty did not. Provenance is
       still stated exactly once on Home, through the governed component. */
    expect(whatsHappeningNowSource).toMatch(/DataModeLabel/);
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
    // STEP 4 — no longer allocated and thrown away.
    expect(pageSource).toMatch(/feed\.discovery/);
    expect(pageSource).toMatch(/feed\.latestUpdates/);
    expect(pageSource).toMatch(/feed\.dataMode/);
    /*
      H3 · Issue #29 — `feed.isLive` is no longer asserted, and that is a real
      change rather than a relaxation.

      It had exactly two consumers, LiveStatusStrip and GlobalDevelopments, and
      the approved R4.1 composition retires both. Nothing else needs it,
      because it is DERIVABLE: `isLive` is `dataMode === 'live'`, and the
      governed `DataModeLabel` that WhatsHappeningNow renders computes that
      from `dataMode` itself.

      Passing a redundant prop purely to keep this line green would have made
      the page assert a dependency it does not have. The single-fetch contract
      this test protects is untouched: one getHomeFeed() call, every semantic
      role still consumed.
    */
  });

  it('no old trending/categoryCards HomeFeed field names remain', () => {
    expect(pageSource).not.toMatch(/feed\.trending/);
    expect(pageSource).not.toMatch(/feed\.categoryCards/);
  });
});
