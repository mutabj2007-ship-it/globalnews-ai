import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { HOME_REGION_ORDER, type HomeStoryCard } from '@globalnews-ai/shared';
import { routeGateDecision } from '@/lib/routing/standaloneRouteGate';
import { visualEn } from '@/lib/i18n/dictionaries/visualEn';
import { visualPl } from '@/lib/i18n/dictionaries/visualPl';
import { keyboardOverlap } from '@/components/ui/ViewportKeyboardSync';
import { briefStoryOfCard, freshnessLabel, isAttention, otherReportsLabel, storiesHref } from './homeStoryView';
import { degradedRows } from './degradedRows';

/**
 * PHONE-FIRST HOME CORRECTION R1 — acceptance rows A02, A04 (presentation side), A05, A06, A07,
 * A10 (shared keyboard/viewport), A11 (amber token), A13 (owner bar is server-driven).
 */
const SRC = join(__dirname, '..', '..', '..');
const read = (rel: string): string => readFileSync(join(SRC, rel), 'utf8');
const code = (rel: string): string => read(rel).replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');

describe('A02 — Explore intelligence is gone from Home, the modules are not', () => {
  it('neither /visual nor the served Alpha / composition (Home R1, gate ON) mounts an Explore section', () => {
    expect(code('components/visual/VisualHomePage.tsx')).not.toMatch(/Explore/);
    expect(code('components/home/r1/HomeR1Page.tsx')).not.toMatch(/HomeR1Explore/);
    /* The Rev A composition in app/page.tsx is the frozen ROLLBACK, served only with GNA_HOME_R1 off
       (never on Alpha, and Production serves Standalone Ask at /) — deliberately left unchanged. */
  });
  it('the module implementations remain', () => {
    expect(read('components/home/r1/HomeR1Sections.tsx')).toMatch(/export function HomeR1Explore/);
    expect(read('components/home/reva/ExploreIntelligence.tsx')).toMatch(/export function ExploreIntelligence/);
  });
});

describe('composition order: hero (search + 60 s + map) → three region rows → Ask', () => {
  it('renders in the governed order', () => {
    const page = code('components/visual/VisualHomePage.tsx');
    const hero = page.indexOf('<HomeHeroSection');
    const rows = page.indexOf('<HomeRegionRows');
    const ask = page.indexOf('<HomeAskSection');
    expect(hero).toBeGreaterThan(-1);
    expect(rows).toBeGreaterThan(hero);
    expect(ask).toBeGreaterThan(rows);
  });
  it('A06 — the row order is East Africa, European Union, Middle East', () => {
    expect(HOME_REGION_ORDER).toEqual(['region:east-africa', 'region:european-union', 'region:middle-east']);
    expect(degradedRows().map((r) => r.id)).toEqual([...HOME_REGION_ORDER]);
    expect(degradedRows().every((r) => r.state === 'UNAVAILABLE' && r.stories.length === 0)).toBe(true);
  });
  it('A07 — the legacy world map is in the hero and nowhere in the rows or cards', () => {
    expect(code('components/visual/home/HomeHeroSection.tsx')).toMatch(/<VisualHeroMap/);
    for (const f of ['HomeRegionRows.tsx', 'HomeStoryCardView.tsx', 'BriefEditorialContext.tsx', 'StorySearchPage.tsx']) {
      expect(code(`components/visual/home/${f}`)).not.toMatch(/Map\b|WorldMap|maplibre/);
    }
  });
});

describe('A05 — the large Home input is STORY SEARCH, never Ask', () => {
  const hero = code('components/visual/home/HomeHeroSection.tsx');
  it('is a GET form to /stories with the governed labels', () => {
    expect(hero).toMatch(/action="\/stories" method="get" role="search"/);
    expect(visualEn.home.searchLabel).toBe('Search stories');
    expect(visualEn.home.searchPlaceholder).toBe('Search a story, country, company or topic');
    expect(visualEn.home.searchButton).toBe('Search');
  });
  it('the hero and the search page cannot start Ask, AI or a provider request', () => {
    for (const f of ['components/visual/home/HomeHeroSection.tsx', 'components/visual/home/StorySearchPage.tsx', 'app/stories/page.tsx', 'lib/api/homeEditorialApi.ts']) {
      const c = code(f);
      expect(c).not.toMatch(/submitGlobalAsk|openGlobalAsk|ask-v2|\/analysis|fetchTopHeadlines|\/news\/search/);
    }
  });
  it('a no-results Ask offer only STAGES the question (explicit Send required)', () => {
    const offer = code('components/visual/home/AskAboutQuery.tsx');
    expect(offer).toMatch(/openGlobalAsk\(query\)/);
    expect(offer).not.toMatch(/submitGlobalAsk/);
  });
  it('the lower Ask section is the ONE shared Ask', () => {
    expect(code('components/visual/home/HomeAskSection.tsx')).toMatch(/submitGlobalAsk\(draft\)/);
  });
  it('/stories is Alpha-only like /visual (Standalone redirects it)', () => {
    expect(routeGateDecision(true, '/stories')).toBe('REDIRECT_ROOT');
    expect(routeGateDecision(false, '/stories')).toBe('PASS');
  });
  it('See all opens the region list in story search', () => {
    expect(storiesHref({ region: 'region:east-africa' })).toBe('/stories?q=&region=region%3Aeast-africa');
  });
});

describe('§12 — click contract on the compact card', () => {
  const card = code('components/visual/home/HomeStoryCardView.tsx');
  it('image is inert, title is a heading, the ONE anchor is Read Original', () => {
    expect(card).toMatch(/aria-hidden="true" data-home-card-image="" className="pointer-events-none/);
    expect((card.match(/<a\b/g) ?? []).length).toBe(1);
    expect(card).toMatch(/data-home-action="read-original"[\s\S]{0,40}|href=\{safeExternalHref\(card\.url\)\}/);
    expect(card).not.toMatch(/<article[^>]*onClick/);
  });
  it('Read brief and Discuss open the in-app Brief', () => {
    expect(card).toMatch(/openVisualBrief\(story, 'top'\)/);
    expect(card).toMatch(/openVisualBrief\(story, 'discussion'\)/);
  });
});

describe('A11 — amber is the attention marker and is defined in every theme', () => {
  const css = read('app/globals.css');
  it('--gt-amber / --gt-amberOn exist in light, dark and system scopes with the design value', () => {
    expect((css.match(/--gt-amber: #F2B441;/g) ?? []).length).toBe(3);
    expect((css.match(/--gt-amberOn: #10213A;/g) ?? []).length).toBe(3);
  });
  it('freshness "New / Developing" is attention; "Earlier" is not', () => {
    expect(isAttention('LAST_72H')).toBe(true);
    expect(isAttention('DEVELOPING')).toBe(true);
    expect(isAttention('EARLIER')).toBe(false);
    expect(freshnessLabel('EARLIER', visualEn.home)).toBe('Earlier');
  });
});

describe('A10 — shared phone fixes', () => {
  it('viewport-fit=cover is set (safe-area insets become real on iPhone); zoom is not disabled', () => {
    const layout = code('app/layout.tsx');
    expect(layout).toMatch(/viewportFit: 'cover'/);
    expect(layout).not.toMatch(/maximumScale|userScalable/);
    expect(layout).toMatch(/<ViewportKeyboardSync \/>/);
  });
  it('keyboard overlap ignores browser-bar movement and measures a real keyboard', () => {
    expect(keyboardOverlap(926, 926, 0)).toBe(0);
    expect(keyboardOverlap(926, 880, 0)).toBe(0);
    expect(keyboardOverlap(926, 520, 0)).toBe(406);
    expect(keyboardOverlap(926, 520, 40)).toBe(366);
  });
  it('the comment composer lifts above the keyboard and uses 16 px (no iOS focus zoom)', () => {
    const d = code('components/home/r1/stageb/DiscussionPanel.tsx');
    expect(d).toMatch(/bottom: 'var\(--gna-kb, 0px\)'/);
    expect(d).not.toMatch(/<textarea[^>]*text-\[14px\]/);
  });
  it('page-level horizontal overflow is clipped centrally', () => {
    expect(read('app/globals.css')).toMatch(/body \{\n  padding-left: env\(safe-area-inset-left, 0px\);\n  padding-right: env\(safe-area-inset-right, 0px\);\n  overflow-x: clip;/);
  });
});

describe('copy parity and helpers', () => {
  it('every Home string exists in EN and PL', () => {
    expect(Object.keys(visualPl.home).sort()).toEqual(Object.keys(visualEn.home).sort());
  });
  it('Brief receives the editorial context with the canonical identity', () => {
    const card = {
      articleRef: 'a'.repeat(64),
      storyId: null,
      url: 'https://example.org/x',
      title: 'T',
      summary: null,
      imageUrl: null,
      publisher: 'P',
      sourceId: null,
      publishedAt: '2026-10-05T00:00:00Z',
      publishedAtBasis: 'publisher',
      firstSeenAt: '2026-10-05T00:00:00Z',
      category: 'business',
      primaryDomain: 'business',
      domains: ['business'],
      signals: ['tariffs'],
      countries: [],
      regions: [],
      freshness: 'LAST_72H',
      otherReports: { count: 2, publishers: [], firstReportedAt: '2026-10-04T00:00:00Z' },
      discussion: null,
      sourceStatus: 'RETAINED_PUBLISHER_REPORT',
    } satisfies HomeStoryCard;
    const b = briefStoryOfCard(card);
    expect(b.articleRef).toBe(card.articleRef);
    expect(b.editorial).toBe(card);
    expect(b.sourcesCount).toBe(3);
    expect(otherReportsLabel(2, visualEn.home)).toBe('+2 other reports');
  });
  it('the owner bar renders only from the server mode (no client-side grant)', () => {
    const bar = code('components/visual/home/OwnerAccessBar.tsx');
    expect(bar).toMatch(/accountFetch\('\/users\/me\/access'\)/);
    expect(bar).not.toMatch(/localStorage|mutabj|@gmail/);
  });
});
