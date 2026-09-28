import { existsSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { createElement } from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import type { NewsArticle } from '@globalnews-ai/shared';
import { getDictionary } from '@/lib/i18n/dictionaries';
import type { HomeSession } from './HomeSession';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * HOME WELCOME & DISCOVERY R1 REV A — THE RULINGS, ASSERTED
 * ════════════════════════════════════════════════════════════════════════════
 * Authority: r6/HOME-WELCOME-DISCOVERY-R1-REV-A (ZIP SHA256 ae143a26…9670) and
 * the CTO queued implementation authority (§3 rail, §5 hero, §7 60 s, §9
 * Explore, §10 bridge, §11 personalization, §12 Deep, §13 How/Trust, §16
 * sign-in/language, §17 D-rulings, §19 performance).
 */

let mockSession: HomeSession = { user: null, isLoading: false, follows: null, newSinceCount: null };
jest.mock('./HomeSession', () => ({
  useHomeSession: () => mockSession,
  HomeSessionProvider: ({ children }: { children: unknown }) => children,
}));
jest.mock('@/components/bookmark/StoryBookmark', () => ({ StoryBookmark: () => null }));
jest.mock('@/components/home/StoryVisual', () => {
  const react = jest.requireActual('react');
  return { StoryVisual: ({ className }: { className: string }) => react.createElement('span', { 'data-visual': '', className }) };
});
jest.mock('next/link', () => {
  const react = jest.requireActual('react');
  return { __esModule: true, default: ({ href, children, ...rest }: { href: string; children: unknown }) => react.createElement('a', { href, ...rest }, children) };
});

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { HomeProductRail } = require('./HomeProductRail') as typeof import('./HomeProductRail');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { HomeBridge } = require('./HomeBridge') as typeof import('./HomeBridge');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { WorldIn60Seconds, orderFollowedFirst } = require('./WorldIn60Seconds') as typeof import('./WorldIn60Seconds');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const model = require('./homeRevaModel') as typeof import('./homeRevaModel');

const DIR = __dirname;
const read = (path: string): string => readFileSync(join(DIR, path), 'utf8');
const code = (source: string): string => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const REVA_FILES = readdirSync(DIR).filter((f) => f.endsWith('.tsx') || (f.endsWith('.ts') && !f.endsWith('.spec.ts')));
const PAGE = readFileSync(join(DIR, '../../../app/page.tsx'), 'utf8');

let renderer: ReactTestRenderer;
const render = (element: ReturnType<typeof createElement>): void => {
  act(() => {
    renderer = create(element);
  });
};
const text = (node: ReactTestInstance | string): string =>
  typeof node === 'string' ? node : node.children.map((c) => text(c as ReactTestInstance | string)).join(' ');
const all = (predicate: (n: ReactTestInstance) => boolean): ReactTestInstance[] =>
  renderer.root.findAll((n) => typeof n.type === 'string' && predicate(n));

const article = (i: number, countryCode?: string): NewsArticle =>
  ({
    id: `a${i}`,
    title: `Story ${i}`,
    summary: '',
    url: `https://example.com/${i}`,
    sourceId: 's',
    sourceName: `Source ${i}`,
    category: 'world',
    sourcesCount: 1,
    publishedAt: new Date(Date.now() - i * 3600e3).toISOString(),
    ...(countryCode ? { countryCode } : {}),
  }) as NewsArticle;

afterEach(() => {
  if (renderer) act(() => renderer.unmount());
});

describe('§3 / §16 — the left product rail: destinations only, one Sign in (the header’s)', () => {
  it('anonymous: Account "Sign in to personalize", My Intelligence "Available after sign-in", no Sign in CTA or badge in the rail', () => {
    mockSession = { user: null, isLoading: false, follows: null, newSinceCount: null };
    render(createElement(HomeProductRail, { language: 'en' }));
    const rows = all((n) => n.props['data-home-rail-row'] !== undefined).map((n) => n.props.title ?? text(n));
    expect(rows).toContain('Account · Sign in to personalize');
    expect(rows).toContain('My Intelligence · Available after sign-in');
    expect(rows.some((r: string) => /^Sign in$/.test(r))).toBe(false);
    const body = text(renderer.root);
    expect(body).not.toMatch(/\bSign in\b(?! to personalize)/);
    /* No Plan & Usage, Preferences or Settings for an anonymous reader. */
    expect(rows.join('|')).not.toMatch(/Plan & Usage|Preferences|Settings/);
  });

  it('signed in: Account, Preferences, Language & region, Plan & Usage (Soon, not a link), Settings', () => {
    mockSession = { user: { id: 'u', email: 'r@x', displayName: 'Anna' }, isLoading: false, follows: [], newSinceCount: null };
    render(createElement(HomeProductRail, { language: 'en' }));
    const rows = all((n) => n.props['data-home-rail-row'] !== undefined);
    const names = rows.map((n) => n.props.title ?? n.props['aria-label'] ?? text(n));
    for (const expected of ['Account', 'Preferences', 'Language & region · Display language, date format', 'Plan & Usage · Soon', 'Settings']) {
      expect(names).toContain(expected);
    }
    const plan = rows.find((n) => n.props['data-home-rail-row'] === 'plan');
    expect(plan?.type).toBe('span');
    expect(plan?.props.href).toBeUndefined();
    expect(names).toContain('My Intelligence');
  });

  it('Language & region hands off to the header switch — it is never a second selector', () => {
    mockSession = { user: null, isLoading: false, follows: null, newSinceCount: null };
    render(createElement(HomeProductRail, { language: 'en' }));
    const language = all((n) => n.props['data-home-rail-row'] === 'language')[0];
    expect(language?.type).toBe('button');
    expect(all((n) => n.type === 'select')).toHaveLength(0);
    expect(code(read('HomeProductRail.tsx'))).toContain('HEADER_LANGUAGE_ID');
  });

  it('IA: primary, intelligence (7), specialists, deep — every row a real href; current page marked', () => {
    mockSession = { user: null, isLoading: false, follows: null, newSinceCount: null };
    render(createElement(HomeProductRail, { language: 'en' }));
    const hrefs = all((n) => n.type === 'a').map((n) => n.props.href);
    for (const href of ['/', '/map', '/ask', '/my-intelligence', '/politics-visual-preview', '/economy-visual-preview', '/energy', '/security-visual-preview', '/humanitarian', '/market', '/election-visual-preview', '/imihigo', '/search']) {
      expect(hrefs).toContain(href);
    }
    expect(hrefs).not.toContain('/search?q=');
    expect(all((n) => n.props['aria-current'] === 'page').map((n) => n.props.href)).toEqual(['/']);
  });

  it('geometry and D19: 248 / 64 px; collapse is page-session state only (no browser storage)', () => {
    expect(model.HOME_RAIL).toEqual({ expandedPx: 248, collapsedPx: 64 });
    const rail = read('HomeProductRail.tsx');
    expect(rail).toContain('lg:w-[64px]');
    expect(rail).toContain('xl:w-[248px]');
    expect(code(rail)).not.toMatch(/localStorage|sessionStorage|indexedDB|document\.cookie/);
  });
});

describe('§9 — Explore intelligence: seven product cards, truthful tags, per-card arrow', () => {
  it('seven domains resolve from the registry; World is the live country map', () => {
    expect(model.RESOLVED_DOMAINS.map((d) => d.key)).toEqual(['world', 'politics', 'economy', 'energy', 'security', 'humanitarian', 'markets']);
    expect(model.RESOLVED_DOMAINS.find((d) => d.key === 'world')?.href).toBe('/map');
    expect(model.RESOLVED_DOMAINS.every((d) => d.href !== null)).toBe(true);
  });

  it('Preview only while a domain has just a *-visual-preview route', () => {
    for (const domain of model.RESOLVED_DOMAINS) {
      expect(domain.preview).toBe(/-visual-preview$/.test(domain.href ?? ''));
    }
    expect(model.RESOLVED_DOMAINS.filter((d) => d.preview).map((d) => d.key)).toEqual(['politics', 'economy', 'security']);
  });

  it('CARD_ARROW_RULE accents verbatim; the arrow is aria-hidden, 40 px (26 px phone), inside the card', () => {
    expect(Object.fromEntries(model.EXPLORE_DOMAINS.map((d) => [d.key, d.accent]))).toEqual({
      world: '#5abff5',
      politics: '#9fc3ff',
      economy: '#7fd4c1',
      energy: '#f0c36a',
      security: '#f39a8f',
      humanitarian: '#c7a6f2',
      markets: '#8fd0f5',
    });
    const explore = read('ExploreIntelligence.tsx');
    expect(explore).toMatch(/aria-hidden="true"\s+data-home-explore-arrow/);
    expect(explore).toContain('h-[26px] w-[26px]');
    expect(explore).toContain('md:h-10 md:w-10');
    expect(explore).toContain('[@container(min-width:1000px)]:grid-cols-7');
    expect(explore).toContain('id="intelligence-modules"');
  });

  it('no invented KPI, count or live state on the cards', () => {
    expect(code(read('ExploreIntelligence.tsx'))).not.toMatch(/live|count|\d+\s*(stories|sources)/i);
  });
});

describe('§7 — Your world in 60 seconds: image-led, from Home’s loaded reporting', () => {
  it('lead + 4 rows (phone hides rows 3–4); spec image heights; followed places first when signed in', () => {
    mockSession = { user: { id: 'u', email: 'r@x', displayName: null }, isLoading: false, follows: ['KEN'], newSinceCount: null };
    render(createElement(WorldIn60Seconds, { items: [article(1, 'PL'), article(2, 'KE'), article(3), article(4), article(5), article(6)], language: 'en' }));
    const lead = all((n) => n.props['data-home-w60-lead'] !== undefined)[0];
    expect(lead?.props.href).toBe('https://example.com/2');
    expect(all((n) => n.props['data-home-w60-row'] !== undefined)).toHaveLength(4);
    const visual = all((n) => n.props['data-visual'] !== undefined)[0];
    for (const h of ['h-[120px]', 'min-[380px]:h-[140px]', 'min-[420px]:h-[156px]', 'lg:h-[150px]', 'gn-xl:h-[176px]', '[@container(min-width:520px)]:h-[190px]']) {
      expect(visual?.props.className).toContain(h);
    }
    expect(text(renderer.root)).toContain('Latest stories, places you follow first.');
  });

  it('orderFollowedFirst is stable and falls back to the given order', () => {
    const items = [article(1, 'PL'), article(2, 'KE'), article(3, 'KE')];
    expect(orderFollowedFirst(items, ['KEN']).map((a) => a.id)).toEqual(['a2', 'a3', 'a1']);
    expect(orderFollowedFirst(items, null).map((a) => a.id)).toEqual(['a1', 'a2', 'a3']);
  });

  it('page feeds it the ONE Home response, newest first — no extra fetch', () => {
    expect(PAGE).toMatch(/<WorldIn60Seconds items=\{newestFirst\}/);
    expect(code(PAGE).match(/getHomeFeed\(/g)).toHaveLength(1);
    expect(code(read('WorldIn60Seconds.tsx'))).not.toMatch(/fetch\(|accountFetch|analyzeNews/);
  });
});

describe('§10 — Home → My Intelligence bridge', () => {
  it('anonymous: "Make GlobalNewsAI yours", About My Intelligence, primary Sign in on the auth path back to "/"', () => {
    mockSession = { user: null, isLoading: false, follows: null, newSinceCount: null };
    render(createElement(HomeBridge, { language: 'en' }));
    const body = text(renderer.root);
    expect(body).toContain('Make GlobalNewsAI yours');
    const links = all((n) => n.type === 'a');
    expect(links.map((l) => text(l).trim())).toEqual(['About My Intelligence', 'Sign in']);
    expect(links[0]?.props.href).toBe('/my-intelligence');
    expect(String(links[1]?.props.href)).toMatch(/returnTo=%2F$|returnTo=\/$/);
  });

  it('signed in with a boundary and new stories: "{n} new since your previous visit" + Open My Intelligence', () => {
    mockSession = { user: { id: 'u', email: 'r@x', displayName: 'Anna' }, isLoading: false, follows: [], newSinceCount: 6 };
    render(createElement(HomeBridge, { language: 'en' }));
    const body = text(renderer.root).replace(/\s+/g, ' ');
    expect(body).toContain('Your intelligence, your way');
    expect(body).toContain('6 new since your previous visit');
    expect(all((n) => n.type === 'a').map((n) => n.props.href)).toEqual(['/my-intelligence']);
  });

  it('never "0 new": no count → no state line', () => {
    mockSession = { user: { id: 'u', email: 'r@x', displayName: 'Anna' }, isLoading: false, follows: [], newSinceCount: null };
    render(createElement(HomeBridge, { language: 'en' }));
    expect(all((n) => n.props['data-home-bridge-new-since'] !== undefined)).toHaveLength(0);
    expect(text(renderer.root)).not.toMatch(/\b0 new/);
    expect(read('HomeSession.tsx')).toContain('feed.newSinceCount > 0 ? feed.newSinceCount : null');
  });

  it('while the session resolves, the box keeps its size and shows no invitation', () => {
    mockSession = { user: null, isLoading: true, follows: null, newSinceCount: null };
    render(createElement(HomeBridge, { language: 'en' }));
    expect(text(renderer.root).trim()).toBe('');
  });
});

describe('§5 / D2 / D4 — Ask staging, zero compute', () => {
  it('the composer stages through the existing openGlobalAsk hand-off; nothing runs until Send', () => {
    const composer = code(read('HomeComposer.tsx'));
    expect(composer).toContain('openGlobalAsk(draft)');
    expect(composer).not.toMatch(/fetch\(|analyzeNews|\/search\?q=/);
    expect(getDictionary('en').homeReva.hero.note).toBe('Opens Ask AI with your question. Nothing runs until you press Send.');
  });

  it('suggestions only FILL the composer (a local event) from existing governed static copy', () => {
    const suggestions = code(read('SuggestedInvestigations.tsx'));
    expect(suggestions).toContain('STAGE_QUESTION_EVENT');
    expect(suggestions).not.toMatch(/openGlobalAsk|fetch\(|analyzeNews/);
    expect(PAGE).toMatch(/questions=\{dict\.hero\.exampleQuestions\}/);
  });

  it('the header Ask launcher shows only once the Hero composer is out of view', () => {
    const launcher = code(read('HeaderAskLauncher.tsx'));
    expect(launcher).toContain('IntersectionObserver');
    expect(launcher).toContain('if (composerVisible) return null;');
  });

  it('no Rev A file calls AI, a news provider or /search?q=, or writes browser storage', () => {
    for (const file of REVA_FILES) {
      const body = code(read(file));
      expect(body).not.toMatch(/analyzeNews|analysisApi|fetchTopHeadlines|fetchCountryNews|\/search\?q=/);
      expect(body).not.toMatch(/localStorage|sessionStorage|indexedDB/);
    }
  });

  it('account-aware islands share ONE account read; follows and the feed count only for a signed-in reader', () => {
    const session = code(read('HomeSession.tsx'));
    expect(session.match(/useAccount\(\)/g)).toHaveLength(1);
    expect(session).toContain('if (user === null) {');
    for (const file of REVA_FILES.filter((f) => f !== 'HomeSession.tsx')) {
      expect(code(read(file))).not.toMatch(/useAccount\(|useCountryFollows\(|useMyIntelligenceFeed\(/);
    }
  });
});

describe('§11 / §12 / §13 — personalization, Deep Intelligence, How it works + Built on trust', () => {
  it('For you uses Home’s own reporting + Follow data only; it does not copy My Intelligence interests', () => {
    const forYou = code(read('HomeForYou.tsx'));
    expect(forYou).not.toMatch(/interest|selectForYou|useIntelligenceInterests/i);
    expect(forYou).toContain('if (isLoading || user === null) return null;');
  });

  it('Deep Intelligence: low row, "Not in Beta" with the one violet edge; no price, credits, plans or gold', () => {
    const deep = read('DeepIntelligenceRow.tsx');
    expect(deep).toContain('border-[#8C86EE]');
    expect(code(deep)).not.toMatch(/price|credit|plan|href=|gold|#f5c542|#ffd700/i);
    expect(getDictionary('en').homeReva.deep.tag).toBe('Not in Beta');
  });

  it('How it works has 3 steps; Built on trust has the 5 ruled principles and a real methodology link', () => {
    const t = getDictionary('en').homeReva;
    expect(t.how.steps).toHaveLength(3);
    expect(t.trust.principles.map((p) => p.title)).toEqual(['Source links', 'Several viewpoints', 'AI clearly marked', 'Freshness shown', 'Reporting stays distinct']);
    expect(read('HomeHowAndTrust.tsx')).toContain("METHODOLOGY_HREF = '/source-policy'");
    expect(existsSync(join(DIR, '../../../app/source-policy/page.tsx'))).toBe(true);
  });

  it('copy avoids the unsupported claims in EN and PL', () => {
    for (const language of ['en', 'pl'] as const) {
      const all = JSON.stringify(getDictionary(language).homeReva);
      expect(all).not.toMatch(/all sources|always live|complete coverage|continuously updated|perfectly neutral|wszystkie źródła|zawsze na żywo|pełne pokrycie/i);
    }
  });
});

describe('EN / PL', () => {
  const keys = (value: unknown, prefix = ''): string[] =>
    value !== null && typeof value === 'object'
      ? Object.entries(value as Record<string, unknown>).flatMap(([k, v]) => keys(v, `${prefix}${k}.`))
      : [prefix];

  it('the Rev A dictionary has identical structure in both languages, and no empty strings', () => {
    const en = getDictionary('en').homeReva;
    const pl = getDictionary('pl').homeReva;
    expect(keys(pl).sort()).toEqual(keys(en).sort());
    for (const language of [en, pl]) {
      expect(JSON.stringify(language)).not.toMatch(/""/);
    }
    expect(pl.hero.titleA).toBe('Zrozum,');
    expect(pl.rail.myIntelligence).toBe('Moja analiza');
  });
});

describe('Home composition', () => {
  it('ONE H1 on the page, in the Hero', () => {
    expect((read('HomeWelcomeHero.tsx').match(/<h1\b/g) ?? []).length).toBe(1);
    for (const file of REVA_FILES.filter((f) => f !== 'HomeWelcomeHero.tsx')) {
      expect(read(file)).not.toMatch(/<h1\b/);
    }
  });

  it('the floating Ask launcher yields on Home (the header launcher / Ask AI tab replace it); the dock still opens', () => {
    const dock = readFileSync(join(DIR, '../../ask/AskAiDock.tsx'), 'utf8');
    expect(dock).toMatch(/LAUNCHER_SUPPRESSED_ROUTES[^=]*=\s*new Set\(\['\/my-intelligence', '\/'\]\)/);
    expect(dock).toContain('window.addEventListener(GLOBAL_ASK_OPEN_EVENT');
  });

  it('the hero globe is the current governed raster (ASSET HOLD), one link to /map, cropped never overflowing', () => {
    const hero = read('HomeWelcomeHero.tsx');
    expect(hero).toContain('<HeroGlobe />');
    expect(hero).toMatch(/href="\/map"\s+aria-label=\{t\.globeLabel\}/);
    expect(hero).toContain('overflow-x-clip');
  });
});
