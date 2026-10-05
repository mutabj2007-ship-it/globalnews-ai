import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { DISPLAY_LOCALES, type DisplayLocale } from '@globalnews-ai/shared';

/**
 * R4 · CTO DOCK-DIRECTION RULING — the floating Ask launcher on platform pages takes the reader's
 * display direction from the canonical authority (askDirectionProps over the layout's
 * resolveAskLocale): LTR locales LTR, Arabic RTL. Direction only — its wording is untouched.
 */
jest.mock('next/navigation', () => ({
  usePathname: () => '/account/settings',
  useRouter: () => ({ refresh: jest.fn(), push: jest.fn(), replace: jest.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
jest.mock('@/lib/hooks/useAccount', () => ({
  useAccount: () => ({
    user: null,
    isLoading: false,
    signOut: jest.fn(),
    deleteAccount: jest.fn(),
    refresh: jest.fn(),
  }),
}));
jest.mock('@/lib/api/askV2Api', () => ({
  ...jest.requireActual('@/lib/api/askV2Api'),
  askV2Api: new Proxy({}, { get: () => () => new Promise(() => undefined) }),
}));

import { AskAiDock } from './AskAiDock';
import { askIsRtl } from '@/lib/ask/askDirection';

beforeAll(() => {
  jest.useFakeTimers();
  Object.assign(globalThis, {
    location: {
      pathname: '/account/settings',
      search: '',
      hash: '',
      href: 'http://localhost/account/settings',
    },
    matchMedia: () => ({
      matches: false,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      addListener: jest.fn(),
      removeListener: jest.fn(),
    }),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    innerWidth: 1440,
    requestAnimationFrame: (cb: () => void) => setTimeout(cb, 0),
    cancelAnimationFrame: (id: number) => clearTimeout(id),
    getComputedStyle: () => ({ getPropertyValue: () => '' }),
    ResizeObserver: class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
    MutationObserver: class {
      observe() {}
      disconnect() {}
      takeRecords() {
        return [];
      }
    },
    IntersectionObserver: class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
    visualViewport: {
      height: 900,
      width: 1440,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    },
    innerHeight: 900,
  });
  (globalThis as unknown as { window: unknown }).window = globalThis;
  (globalThis as unknown as { document: unknown }).document = {
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    querySelector: () => null,
    body: {
      style: {},
      classList: { add: jest.fn(), remove: jest.fn() },
      setAttribute: jest.fn(),
      removeAttribute: jest.fn(),
    },
    documentElement: {
      style: {},
      setAttribute: jest.fn(),
      removeAttribute: jest.fn(),
      dataset: {},
    },
    activeElement: null,
  };
});

const launcher = (locale: DisplayLocale) => {
  let r!: ReactTestRenderer;
  act(() => {
    r = create(createElement(AskAiDock, { language: 'en', displayLocale: locale }));
  });
  return r.root.find((n) => typeof n.type === 'string' && n.props['data-ask'] === 'launcher');
};

describe('the floating Ask launcher follows the reader’s display direction', () => {
  it.each(DISPLAY_LOCALES)('%s', (locale) => {
    const button = launcher(locale);
    expect(button.props.dir).toBe(askIsRtl(locale) ? 'rtl' : 'ltr');
    expect(button.props.lang).toBe(locale);
  });
  it('Arabic is RTL by the direction table, not by a language special case', () => {
    expect(launcher('ar').props.dir).toBe('rtl');
    expect(launcher('fr').props.dir).toBe('ltr');
  });
});
