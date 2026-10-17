import { createElement } from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { getLocalizedCountryName, type ConflictObservation, type MarketRetainedProcurementNotice } from '@globalnews-ai/shared';
import { reviewedObservations } from '@/lib/conflict/retained';
import {
  ASK_EXPLORE_DRAWER,
  ASK_EXPLORE_HREF,
  askRegion,
  countryDisplayName,
  placeTitle,
  regionEvents,
  regionMapHref,
  regionMemberNames,
  reportingOutlets,
  tenderRows,
} from '@/lib/ask/askExploreRegions';
import { ASK_EXPLORE_QUALIFIED_UNCHANGED, askExploreStrings } from '@/lib/ask/askExploreStrings';
import { AskRegionSheet } from './AskRegionSheet';
import { AskTendersBlock } from './AskTendersBlock';
import { AskExploreLinks } from './AskExploreLinks';
import { AskPlatformPagesProvider } from './AskExploreContext';
import { AskWelcomeEntries } from './AskWelcomeEntries';
import { StoryPicker } from '@/components/ask/StoryPicker';
import CONFLICT from './r135.conflictFixture.json';
import TED from './r135.tedFixture.json';

/**
 * R135 ASK EXPLORE R1 (PO order 2026-10-17) — "What changed in my region", "Explain a story",
 * jobs and the Europe · East Africa · Middle East elements, clickable INSIDE Ask, from records
 * GlobalNewsAI already holds. Fixtures are real public rows read from Alpha's own read-only proxies
 * (/conflict-data = UCDP GED events, /market-data = TED notices). `fetch` is mocked at the wire:
 * the only reads are those two GETs; nothing is POSTed, no model, provider or quota.
 */
jest.mock('./askDashboard.module.css', () => new Proxy({}, { get: (_t, k) => String(k) }));
jest.mock('./askExplore.module.css', () => new Proxy({}, { get: (_t, k) => String(k) }));
jest.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(''),
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  usePathname: () => '/ask',
}));

type Call = { method: string; url: string };
let calls: Call[] = [];
let conflictStatus = 200;

afterEach(() => {
  const g = global as unknown as Record<string, unknown>;
  delete g.document;
  delete g.window;
});

beforeEach(() => {
  calls = [];
  conflictStatus = 200;
  (global as unknown as { fetch: unknown }).fetch = jest.fn(async (url: string, init?: { method?: string }) => {
    calls.push({ method: init?.method ?? 'GET', url: String(url) });
    if (String(url).startsWith('/conflict-data/observations')) {
      return { ok: conflictStatus === 200, status: conflictStatus, json: async () => CONFLICT };
    }
    if (String(url).startsWith('/market-data/procurement')) {
      return { ok: true, status: 200, json: async () => TED };
    }
    return { ok: false, status: 404, json: async () => ({}) };
  });
  /* No DOM in this suite (testEnvironment node): the sheets only add/remove a keydown listener and
     query for focus targets, and the market reader picks its browser URL when `window` exists. */
  const g = global as unknown as Record<string, unknown>;
  g.document = { addEventListener: () => undefined, removeEventListener: () => undefined, querySelector: () => null, activeElement: null };
  g.window = {};
  (global as unknown as { requestAnimationFrame: unknown }).requestAnimationFrame = (cb: () => void) => {
    cb();
    return 0;
  };
});

const byAsk = (root: ReactTestInstance, id: string): ReactTestInstance[] =>
  root.findAll((n) => n.props['data-ask'] === id && typeof n.type === 'string');
const text = (n: ReactTestInstance | ReactTestRenderer): string => {
  const json = (n as ReactTestRenderer).toJSON ? (n as ReactTestRenderer).toJSON() : null;
  const walk = (v: unknown): string =>
    v === null || v === undefined
      ? ''
      : typeof v === 'string'
        ? v
        : Array.isArray(v)
          ? v.map(walk).join('')
          : walk((v as { children?: unknown }).children);
  if (json !== null) return walk(json);
  return (n as ReactTestInstance).children.map((c) => (typeof c === 'string' ? c : text(c))).join('');
};
const flush = async (): Promise<void> => {
  for (let i = 0; i < 5; i++) await act(async () => Promise.resolve());
};

describe('R135 · region data (pure)', () => {
  it('EA OBS-2: a record whose source-stated country is COG (UCDP "Congo") never appears under East Africa', () => {
    const cog = JSON.parse(JSON.stringify(CONFLICT[0]));
    cog.observationKey = 'cfl:test:COG';
    cog.geography.countryIso3 = 'COG';
    cog.geography.sourceCountryName = 'Congo';
    /* appended AFTER validation: the filter itself must exclude COG, whatever the validator lets through */
    const withCog = [...reviewedObservations(CONFLICT), cog as ConflictObservation];
    expect(regionEvents(withCog, askRegion('east-africa'), 50).latest.some((e) => e.iso3 === 'COG')).toBe(false);
    expect(regionEvents(withCog, askRegion('middle-east'), 50).latest.some((e) => e.iso3 === 'COG')).toBe(false);
  });
  const rows = reviewedObservations(CONFLICT);
  it('East Africa lists only source-stated East African countries; COD is in, COG/Brazzaville never', () => {
    const ea = regionEvents(rows, askRegion('east-africa'), 10);
    expect(ea.latest.map((e) => e.iso3).sort()).toEqual(['COD', 'ETH']);
    expect(askRegion('east-africa').iso3.has('COG')).toBe(false);
  });
  it('Middle East and Europe are filtered the same way', () => {
    expect(regionEvents(rows, askRegion('middle-east'), 10).latest.map((e) => e.iso3).sort()).toEqual(['SYR', 'YEM']);
    expect(regionEvents(rows, askRegion('europe'), 10).latest.map((e) => e.iso3)).toEqual(['FRA']);
  });
  it('dates are the source-stated event day, never ingest or retrieval time', () => {
    for (const e of regionEvents(rows, askRegion('middle-east'), 10).latest) {
      const row = rows.find((r) => r.observationKey === e.key);
      expect(e.eventDate).toBe(row?.temporal.eventStartedAt.slice(0, 10));
      expect(e.eventDate).not.toBe(row?.temporal.ingestedAt.slice(0, 10));
    }
  });
  it('reported-by is outlet names only: social handles are dropped and no headline is carried', () => {
    expect(reportingOutlets('The New Times;Actualite.cd;@someone on X  ;Kivu Morning Post')).toEqual([
      'The New Times',
      'Actualite.cd',
      'Kivu Morning Post',
    ]);
    const event = regionEvents(rows, askRegion('east-africa'), 10).latest[0];
    expect(JSON.stringify(event)).not.toMatch(/citation/);
  });
  it('member names say "DR Congo", never bare "Congo" or "Congo - Kinshasa" (EA R135 ruling 3)', () => {
    const names = regionMemberNames(askRegion('east-africa'), 'en', askExploreStrings('en').drCongo);
    expect(names).toContain('DR Congo');
    expect(names.some((n) => /^Congo\b|Kinshasa|Brazzaville/.test(n))).toBe(false);
    expect(names).toHaveLength(11);
  });
  it('the map opens OVER the region at the EA-ruled cameras', () => {
    expect(regionMapHref(askRegion('east-africa'))).toBe('/conflict?cam=3.2/36/2');
    expect(regionMapHref(askRegion('middle-east'))).toBe('/conflict?cam=3.0/44/28');
    expect(regionMapHref(askRegion('europe'))).toBe('/conflict?cam=2.8/12/52');
  });
  it('tenders: open ones first by deadline; a passed deadline is "closed"; an unknown deadline is never open', () => {
    const notices = TED as unknown as MarketRetainedProcurementNotice[];
    const now = new Date('2026-10-17T03:00:00Z');
    const { latest } = tenderRows(notices, 'en', now, 5);
    const firstClosed = latest.findIndex((r) => r.closed);
    expect(latest.slice(0, firstClosed === -1 ? latest.length : firstClosed).every((r) => !r.closed)).toBe(true);
    for (const r of latest) expect(r.closed).toBe(r.deadline !== null && r.deadline < '2026-10-17');
    const noDeadline = tenderRows([{ ...notices[0], deadlineDate: null } as MarketRetainedProcurementNotice], 'en', now, 1);
    expect(noDeadline.latest[0]?.closed).toBe(false);
    expect(noDeadline.latest[0]?.deadline).toBeNull();
  });
});

describe('R135 · region sheet inside Ask', () => {
  const render = (platform: boolean, onAskRegion = jest.fn(), onClose = jest.fn()) => {
    let r!: ReactTestRenderer;
    act(() => {
      r = create(
        createElement(
          AskPlatformPagesProvider,
          { value: platform },
          createElement(AskRegionSheet, { locale: 'en', initialRegion: 'east-africa', onClose, onAskRegion }),
        ),
      );
    });
    return { r, onAskRegion, onClose };
  };

  it('opening reads the retained conflict set ONCE (GET) and lists the region\'s events with dates and places', async () => {
    const { r } = render(true);
    await flush();
    expect(calls).toEqual([{ method: 'GET', url: '/conflict-data/observations?limit=500' }]);
    const rows = byAsk(r.root, 'region-event');
    expect(rows).toHaveLength(2);
    expect(text(r)).toContain('DR Congo');
    expect(text(r)).toContain('not a news article');
    expect(text(r)).not.toMatch(/news from|coverage of East Africa/i);
  });
  it('switching region filters without a second read', async () => {
    const { r } = render(true);
    await flush();
    act(() => byAsk(r.root, 'region-choose-middle-east')[0]?.props.onClick());
    await flush();
    expect(calls).toHaveLength(1);
    expect(byAsk(r.root, 'region-event')).toHaveLength(2);
    expect(text(r)).toMatch(/Yemen|Syria/);
  });
  it('"Ask about <region>" only stages the draft; nothing is POSTed', async () => {
    const { r, onAskRegion } = render(true);
    await flush();
    act(() => byAsk(r.root, 'region-ask')[0]?.props.onClick());
    expect(onAskRegion).toHaveBeenCalledWith('What changed in East Africa over the last 7 days?');
    expect(calls.every((c) => c.method === 'GET')).toBe(true);
  });
  it('platform deployments link the map OVER the region and the region pages; Standalone shows no page links', async () => {
    const on = render(true);
    await flush();
    const map = byAsk(on.r.root, 'region-page-conflict')[0];
    expect(map?.props.href).toBe('/conflict?cam=3.2/36/2');
    expect(text(on.r)).toContain('Conflict map: opens over East Africa');
    expect(text(on.r)).toContain('Records worldwide');
    expect(byAsk(on.r.root, 'region-page-imihigo')).toHaveLength(1);
    const firstEvent = byAsk(on.r.root, 'region-event')[0];
    expect(firstEvent?.type).toBe('a');
    expect(String(firstEvent?.props.href).startsWith('/conflict?cam=3.2/36/2&observation=cfl%3A')).toBe(true);
    const off = render(false);
    await flush();
    expect(byAsk(off.r.root, 'region-pages')).toHaveLength(0);
    expect(byAsk(off.r.root, 'region-event')).toHaveLength(2);
    expect(byAsk(off.r.root, 'region-event').every((n) => n.type === 'div')).toBe(true);
  });
  it('E1 R135-C1: the UCDP note names the licence and links its URI on platform AND Standalone', async () => {
    for (const platform of [true, false]) {
      const { r } = render(platform);
      await flush();
      const licence = byAsk(r.root, 'region-events-licence');
      expect(licence).toHaveLength(1);
      expect(licence[0]?.type).toBe('a');
      expect(licence[0]?.props.href).toBe('https://creativecommons.org/licenses/by/4.0/');
      expect(licence[0]?.props.rel).toBe('noopener noreferrer');
      const note = byAsk(r.root, 'region-events-source')[0];
      expect(note).toBeDefined();
      const noteText = (note?.findAll(() => true) ?? []).flatMap((n) => n.children).filter((c) => typeof c === 'string').join('');
      expect(noteText).toContain('UCDP');
      expect(noteText).toContain('CC BY 4.0');
    }
  });
  it('a failed read says so and offers one retry; an empty region says it is a gap, not "nothing happened"', async () => {
    conflictStatus = 500;
    const { r } = render(false);
    await flush();
    expect(byAsk(r.root, 'region-events-error')).toHaveLength(1);
    expect(askExploreStrings('en').eventsNone('Europe')).toMatch(/gap in what we hold, not a finding that nothing happened/);
  });
});

describe('R135 · jobs sheet tenders, drawer Explore, welcome and story picker entries', () => {
  it('tenders render as TENDERS with an https TED link, never as vacancies', async () => {
    let r!: ReactTestRenderer;
    act(() => {
      r = create(createElement(AskPlatformPagesProvider, { value: true }, createElement(AskTendersBlock, { locale: 'en' })));
    });
    await flush();
    /* R38 U-3 — the sheet opens with zero network; the reader's tap is the only read. */
    expect(calls).toHaveLength(0);
    act(() => byAsk(r.root, 'job-tenders-show')[0]?.props.onClick());
    await flush();
    expect(calls).toEqual([{ method: 'GET', url: '/market-data/procurement' }]);
    expect(byAsk(r.root, 'job-tender').length).toBeGreaterThan(0);
    expect(byAsk(r.root, 'job-tender').length).toBeLessThanOrEqual(3);
    for (const a of byAsk(r.root, 'job-tender-open')) expect(String(a.props.href)).toMatch(/^https:\/\/ted\.europa\.eu\//);
    expect(text(r)).toContain('not job vacancies');
    expect(byAsk(r.root, 'job-tenders-all')[0]?.props.href).toBe('/market');
  });
  it('the drawer Explore list links every built page on platform deployments, and nothing on Standalone', () => {
    let on!: ReactTestRenderer;
    let off!: ReactTestRenderer;
    act(() => {
      on = create(createElement(AskPlatformPagesProvider, { value: true }, createElement(AskExploreLinks, { locale: 'en' })));
      off = create(createElement(AskExploreLinks, { locale: 'en' }));
    });
    const links = on.root.findAll((n) => typeof n.type === 'string' && n.props['data-ask-nav-explore'] !== undefined);
    expect(links.map((l) => l.props.href)).toEqual(ASK_EXPLORE_DRAWER.map((p) => ASK_EXPLORE_HREF[p]));
    expect(links).toHaveLength(13);
    expect(text(on)).toContain('Design preview, not live data');
    expect(off.toJSON()).toBeNull();
    expect(calls).toHaveLength(0);
  });
  it('welcome: G1 and the three region buttons open the region sheet; nothing is fetched or sent by the entries', () => {
    const onOpenRegion = jest.fn();
    const onStageDraft = jest.fn();
    let r!: ReactTestRenderer;
    act(() => {
      r = create(
        createElement(AskWelcomeEntries, { locale: 'en', onStageDraft, onOpenJobs: jest.fn(), onOpenRegion, placement: 'welcome' }),
      );
    });
    act(() => byAsk(r.root, 'cue-g1')[0]?.props.onClick());
    expect(onOpenRegion).toHaveBeenLastCalledWith('east-africa');
    for (const id of ['europe', 'east-africa', 'middle-east']) {
      act(() => byAsk(r.root, `coverage-region-${id}`)[0]?.props.onClick());
      expect(onOpenRegion).toHaveBeenLastCalledWith(id);
    }
    expect(onStageDraft).not.toHaveBeenCalled();
    expect(calls).toHaveLength(0);
  });
  it('welcome without onOpenRegion keeps the approved behaviour (G1 stages; G4 is plain text)', () => {
    const onStageDraft = jest.fn();
    let r!: ReactTestRenderer;
    act(() => {
      r = create(createElement(AskWelcomeEntries, { locale: 'en', onStageDraft, onOpenJobs: jest.fn(), placement: 'welcome' }));
    });
    act(() => byAsk(r.root, 'cue-g1')[0]?.props.onClick());
    expect(onStageDraft).toHaveBeenCalledTimes(1);
    expect(byAsk(r.root, 'coverage-region-europe')).toHaveLength(0);
  });
  it('Explain a story, held: the picker offers the recorded events by region and opens them; still no story list', () => {
    const onOpenRegions = jest.fn();
    let r!: ReactTestRenderer;
    act(() => {
      r = create(
        createElement(StoryPicker, { locale: 'en', onClose: jest.fn(), onStageDraft: jest.fn(), onOpenRegions }),
      );
    });
    const open = byAsk(r.root, 'picker-open-regions')[0];
    expect(open).toBeDefined();
    act(() => open?.props.onClick());
    expect(onOpenRegions).toHaveBeenCalledTimes(1);
    expect(calls).toHaveLength(0);
  });
});

describe('R135 · Claude L qualified copy (L_R135_ASK_EXPLORE_RETURN)', () => {
  const leaves = (v: unknown, path = ''): [string, string][] =>
    typeof v === 'string'
      ? [[path, v]]
      : typeof v === 'function'
        ? [[path, String((v as (a: string) => string)('§'))]]
        : v !== null && typeof v === 'object'
          ? Object.entries(v).flatMap(([k, c]) => leaves(c, path === '' ? k : `${path}.${k}`))
          : [];
  const en = new Map(leaves(askExploreStrings('en')));

  it('a value identical to English is exactly one L declared (FR "Europe" and four more), nothing else', () => {
    for (const locale of ['pl', 'fr', 'de', 'es', 'pt', 'ar']) {
      const same = leaves(askExploreStrings(locale))
        .filter(([path, value]) => en.get(path) === value)
        .map(([path]) => path)
        .sort();
      expect({ locale, same }).toEqual({ locale, same: [...(ASK_EXPLORE_QUALIFIED_UNCHANGED[locale] ?? [])].sort() });
    }
  });
  it('every locale has the same keys as English (62), and no direction-control character', () => {
    for (const locale of ['pl', 'fr', 'de', 'es', 'pt', 'ar']) {
      const l = leaves(askExploreStrings(locale));
      expect(l.map(([p]) => p).sort()).toEqual([...en.keys()].sort());
      expect(l.filter(([, v]) => /[‎‏‪-‮⁦-⁩]/.test(v))).toEqual([]);
    }
  });
  it('pt says licitação (a tender), never "concurso" (a civil-service exam in Brazil); BR forms', () => {
    const pt = leaves(askExploreStrings('pt'));
    expect(pt.filter(([, v]) => /concurso/i.test(v))).toEqual([]);
    expect(askExploreStrings('pt').tendersTitle).toBe('Licitações públicas para consultar');
    expect(askExploreStrings('pt').regionName['middle-east']).toBe('Oriente Médio');
    expect(pt.filter(([, v]) => /registos|A carregar|em direto/.test(v))).toEqual([]);
  });
  it('region names stay uninflected for the router (fr/de/pt use a "region" scaffold; PL unchanged)', () => {
    expect(askExploreStrings('fr').regionDraft('Moyen-Orient')).toBe('Qu’est-ce qui a changé dans la région Moyen-Orient au cours des 7 derniers jours ?');
    expect(askExploreStrings('de').regionDraft('Naher Osten')).toBe('Was hat sich in den letzten 7 Tagen in der Region Naher Osten verändert?');
    expect(askExploreStrings('pt').regionDraft('Europa')).toBe('O que mudou na região Europa nos últimos 7 dias?');
    expect(askExploreStrings('pl').drCongo).toBe('DR Konga');
  });
});

describe('R143 D1 · event country names are OUR localized rendering; UCDP\'s own label stays reachable', () => {
  const renderIn = (locale: 'en' | 'fr' | 'ar', initialRegion: 'middle-east' | 'east-africa') => {
    let r!: ReactTestRenderer;
    act(() => {
      r = create(
        createElement(
          AskPlatformPagesProvider,
          { value: true },
          createElement(AskRegionSheet, { locale, initialRegion, onClose: jest.fn(), onAskRegion: jest.fn() }),
        ),
      );
    });
    return r;
  };
  const places = (r: ReactTestRenderer) =>
    byAsk(r.root, 'region-event-place').map((n) => ({ shown: text(n), title: n.props.title as string | undefined }));

  it.each(['fr', 'ar'] as const)('%s: Yemen and Syria read in the reader\'s language, never UCDP\'s English label', async (locale) => {
    const r = renderIn(locale, 'middle-east');
    await flush();
    const got = places(r);
    expect(got).toHaveLength(2);
    expect(got.map((p) => p.shown).sort()).toEqual(
      [getLocalizedCountryName('YE', locale), getLocalizedCountryName('SY', locale)].sort(),
    );
    for (const p of got) expect(p.shown).not.toMatch(/Yemen|Syria|North/);
  });
  it('the source-stated label is kept as the title where it differs — "Yemen (North Yemen)" is not lost or restated', async () => {
    const r = renderIn('fr', 'middle-east');
    await flush();
    const yem = places(r).find((p) => p.shown === getLocalizedCountryName('YE', 'fr'));
    expect(yem?.title).toBe('Yemen (North Yemen)');
    expect(yem?.shown).not.toMatch(/Nord|North/);
  });
  it('COD keeps the explicit DR Congo label in every locale, with UCDP\'s "DR Congo (Zaire)" as the title', async () => {
    for (const locale of ['en', 'fr', 'ar'] as const) {
      const r = renderIn(locale, 'east-africa');
      await flush();
      const cod = places(r).find((p) => p.shown === askExploreStrings(locale).drCongo);
      expect(cod?.title).toBe('DR Congo (Zaire)');
    }
  });
  it('control: no title when our name equals the source label (en Syria / Ethiopia)', async () => {
    const r = renderIn('en', 'east-africa');
    await flush();
    expect(places(r).find((p) => p.shown === 'Ethiopia')?.title).toBeUndefined();
  });
  it('an unknown ISO3 falls back to the source label, never an empty name', () => {
    expect(countryDisplayName('XXX', 'fr', 'RD Congo')).toBeNull();
    expect(placeTitle({ key: 'k', eventDate: '2026-08-30', place: 'Somewhere', iso3: 'XXX', reportedBy: [] }, 'fr', 'RD Congo')).toBeUndefined();
  });
});
