import { createElement, type ReactElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import type { DisplayLocale } from '@globalnews-ai/shared';
import { ASK_PRODUCT_NAME } from './askBrand';
import { askBackGlyph, askIsRtl } from './askDirection';
import { askShellStrings } from './shell/askShellCatalogue';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * R4 · RENDERED-SURFACE LANGUAGE ACCEPTANCE — THE REACHABLE ASK SHELL PAGES
 * ════════════════════════════════════════════════════════════════════════════
 *
 * The REAL route components (`/ask`, `/ask/recent`, `/saved`, `/saved/briefing`,
 * `/account/settings`) are rendered with the reader's language cookie, exactly as the server
 * renders them, and the localized render is compared with the English render of the same page.
 * Only the boundary is mocked: cookies, the router, the signed-in account and the API (fixed
 * data). See askRenderedLocale.acceptance.spec.ts for the leak rule.
 */

const mockCookie: { language?: string } = {};
jest.mock('next/headers', () => ({
  cookies: () => ({
    get: (name: string) =>
      name === 'globalnews-ai-language' && mockCookie.language !== undefined
        ? { name, value: mockCookie.language }
        : undefined,
  }),
}));
jest.mock('next/navigation', () => ({
  usePathname: () => '/ask',
  useRouter: () => ({ refresh: jest.fn(), push: jest.fn(), replace: jest.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
jest.mock('next/link', () => {
  const { createElement: h } = jest.requireActual('react');
  return {
    __esModule: true,
    default: ({ children, prefetch: _p, ...rest }: Record<string, unknown>) =>
      h('a', rest, children),
  };
});
jest.mock(
  '@/components/ask-frame/askDashboard.module.css',
  () =>
    new Proxy(
      {},
      { get: (_t: object, k: string | symbol) => (typeof k === 'string' ? k : undefined) },
    ),
);
jest.mock(
  '@/components/ask-nav/askNav.module.css',
  () =>
    new Proxy(
      {},
      { get: (_t: object, k: string | symbol) => (typeof k === 'string' ? k : undefined) },
    ),
);
jest.mock('@/lib/hooks/useAccount', () => ({
  useAccount: () => ({
    user: { id: 'u', email: 'reader@example.invalid', displayName: 'Reader' },
    isLoading: false,
    signOut: jest.fn(),
    deleteAccount: jest.fn(),
    refresh: jest.fn(),
  }),
}));
const THREAD = {
  id: '11111111-1111-4111-8111-111111111111',
  title: 'Rwanda Tanzania trade relations',
  lastActiveAt: '2026-10-03T10:00:00Z',
  createdAt: '2026-10-03T09:00:00Z',
  turnCount: 2,
};
jest.mock('@/lib/api/askV2Api', () => ({
  ...jest.requireActual('@/lib/api/askV2Api'),
  /* every API read stays pending: the surfaces render their own chrome, no row data */
  askV2Api: new Proxy({}, { get: () => () => new Promise(() => undefined) }),
}));

import {
  LOCALES,
  dataStrings,
  englishLeaks,
  textDirections,
  visibleValues,
} from './testing/renderedLocale.testkit';

beforeAll(() => {
  jest.useFakeTimers();
  process.env.GNA_PUBLIC_ROOT = 'standalone';
  const store = (): Storage => {
    const m = new Map<string, string>();
    return {
      getItem: (k: string) => m.get(k) ?? null,
      setItem: (k: string, v: string) => void m.set(k, v),
      removeItem: (k: string) => void m.delete(k),
      clear: () => m.clear(),
      key: () => null,
      length: 0,
    } as Storage;
  };
  Object.assign(globalThis, {
    location: {
      pathname: '/ask',
      search: '',
      hash: '',
      href: 'http://localhost/ask',
      assign: jest.fn(),
      replace: jest.fn(),
    },
    history: { replaceState: jest.fn(), pushState: jest.fn(), state: null },
    matchMedia: () => ({
      matches: false,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      addListener: jest.fn(),
      removeListener: jest.fn(),
    }),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    localStorage: store(),
    sessionStorage: store(),
    requestAnimationFrame: (cb: () => void) => setTimeout(cb, 0),
    cancelAnimationFrame: jest.fn(),
    innerWidth: 1280,
    innerHeight: 800,
    scrollTo: jest.fn(),
    getComputedStyle: () => ({ getPropertyValue: () => '' }),
  });
  (globalThis as unknown as { window: unknown }).window = globalThis;
  (globalThis as unknown as { document: unknown }).document = {
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    querySelector: () => null,
    activeElement: null,
    documentElement: {
      setAttribute: jest.fn(),
      removeAttribute: jest.fn(),
      getAttribute: () => null,
      dataset: {},
      classList: { add: jest.fn(), remove: jest.fn(), toggle: jest.fn(), contains: () => false },
      style: {},
    },
  };
});

async function renderPage(
  load: () => Promise<{ default: unknown }>,
  locale: DisplayLocale | 'en',
  props = {},
) {
  mockCookie.language = locale;
  const Page = (await load()).default as (p: unknown) => ReactElement;
  let r!: ReactTestRenderer;
  let failure: unknown = null;
  act(() => {
    try {
      r = create(createElement(() => Page(props) as never));
    } catch (error) {
      failure = error;
    }
  });
  if (failure !== null) throw failure;
  /* open every disclosure (drawer, account menu, theme menu) so its labels are measured too */
  for (let pass = 0; pass < 3; pass++) {
    const closed = r.root.findAll(
      (n) =>
        typeof n.type === 'string' &&
        n.props['aria-expanded'] === false &&
        typeof n.props.onClick === 'function',
    );
    if (closed.length === 0) break;
    for (const n of closed) {
      try {
        act(() =>
          n.props.onClick({
            preventDefault: () => undefined,
            stopPropagation: () => undefined,
            button: 0,
          }),
        );
      } catch {
        /* a control that needs a real DOM event is measured closed */
      }
    }
  }
  return r;
}

const PAGES: Record<string, { load: () => Promise<{ default: unknown }>; props?: unknown }> = {
  ask: { load: () => import('@/app/ask/page') },
  settings: { load: () => import('@/app/account/settings/page') },
  recent: { load: () => import('@/app/ask/recent/page') },
  saved: { load: () => import('@/app/saved/page'), props: { searchParams: {} } },
  briefing: {
    load: () => import('@/app/saved/briefing/page'),
    props: { searchParams: { id: '22222222-2222-4222-8222-222222222222' } },
  },
};

describe('R4 · rendered-surface language acceptance — reachable Ask shell pages', () => {
  it.each(Object.keys(PAGES).flatMap((p) => LOCALES.map((l) => [p, l] as const)))(
    '%s · %s: no English chrome reaches the reader',
    async (page, locale) => {
      const spec = PAGES[page];
      const en = visibleValues(await renderPage(spec.load, 'en', spec.props ?? {}));
      const loc = visibleValues(await renderPage(spec.load, locale, spec.props ?? {}));
      expect(
        englishLeaks(en, loc, dataStrings(THREAD, 'reader@example.invalid', 'Reader'), locale),
      ).toEqual([]);
    },
  );
});

describe('R4 · Arabic: full-surface RTL on every reachable Ask shell page', () => {
  it.each(Object.keys(PAGES))(
    '%s · ar: every word sits in an rtl scope (isolated runs excepted)',
    async (page) => {
      const spec = PAGES[page];
      const texts = textDirections(await renderPage(spec.load, 'ar', spec.props ?? {}));
      expect(texts.length).toBeGreaterThan(0);
      expect(texts.filter((t) => t.dir !== 'rtl' && !t.isolated)).toEqual([]);
    },
  );
  it.each(Object.keys(PAGES))('%s · fr: nothing is rtl', async (page) => {
    const spec = PAGES[page];
    const texts = textDirections(await renderPage(spec.load, 'fr', spec.props ?? {}));
    expect(texts.filter((t) => t.dir === 'rtl')).toEqual([]);
  });
});

describe('R4 · CTO brand ruling — one canonical product name on the Ask shell', () => {
  it.each(['en', 'pl', ...LOCALES] as DisplayLocale[])(
    '%s: the entry wordmark is ASK_PRODUCT_NAME, and no page renders a second spelling',
    async (locale) => {
      const ask = await renderPage(PAGES.ask.load, locale);
      const brand = ask.root.findAll(
        (n) => typeof n.type === 'string' && n.props['data-ask'] === 'entry-brand',
      );
      expect(brand).toHaveLength(1);
      expect(brand[0].children).toEqual([ASK_PRODUCT_NAME]);
      for (const page of Object.keys(PAGES)) {
        const spec = PAGES[page];
        const values = visibleValues(await renderPage(spec.load, locale, spec.props ?? {}));
        expect(values.filter((v) => v === 'GlobalNews AI' || v === 'Ask GlobalNews AI')).toEqual(
          [],
        );
      }
    },
  );
  it('page titles are composed from the one constant, never an authored variant', async () => {
    for (const load of [
      () => import('@/app/ask/page'),
      () => import('@/app/ask/recent/page'),
      () => import('@/app/saved/page'),
      () => import('@/app/saved/briefing/page'),
    ]) {
      const title = String(((await load()) as { metadata: { title: unknown } }).metadata.title);
      expect(title).toContain(ASK_PRODUCT_NAME);
      expect(title).not.toMatch(/GlobalNews AI/);
    }
  });
});

describe('R4 · CTO RTL ruling — the briefing back control points the way the reader reads', () => {
  const backLink = (r: ReactTestRenderer) =>
    r.root
      .find((n) => typeof n.type === 'string' && n.props['data-briefing'] === 'surface')
      .find((n) => typeof n.type === 'string' && n.props.href === '/saved');
  it.each(['en', 'pl', ...LOCALES] as DisplayLocale[])('%s', async (locale) => {
    const r = await renderPage(PAGES.briefing.load, locale, PAGES.briefing.props ?? {});
    const link = backLink(r);
    const glyph = link.find((n) => typeof n.type === 'string' && n.props['aria-hidden'] === 'true');
    expect(glyph.children).toEqual([askIsRtl(locale) ? '→' : '←']);
    expect(askBackGlyph(locale)).toBe(askIsRtl(locale) ? '→' : '←');
    /* the accessible name is the localized label; the glyph is decoration */
    const label = askShellStrings(locale).briefingStrings.back;
    const linkText = link.children.filter((c): c is string => typeof c === 'string').join('');
    expect(linkText).toContain(label);
  });
  it('Arabic is the RTL locale of the seven, so its back glyph points right', () => {
    expect(askBackGlyph('ar')).toBe('→');
    expect(askBackGlyph('fr')).toBe('←');
  });
});
