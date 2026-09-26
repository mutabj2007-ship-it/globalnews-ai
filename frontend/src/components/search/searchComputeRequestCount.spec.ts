import { StrictMode, createElement } from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { analyzeNews } from '@/lib/api/analysisApi';
import {
  analysisConsentKey,
  consumeAnalysisConsent,
  grantAnalysisConsent,
  resetAnalysisConsentForTests,
  ANALYSIS_CONSENT_TTL_MS,
} from '@/lib/analysis/analysisComputeConsent';
import { fullAnalysisHref } from '@/lib/ask/storyContextStore';
import { SearchPageClient } from './SearchPageClient';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * ASK/SEARCH ENGINEERING R1 — REQUEST COUNTS ON THE MOUNTED /search CLIENT
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Counted, not inferred: `analyzeNews` is the single browser transport for
 * `POST /analysis/news`, so every assertion below is the number of analysis
 * requests a real arrival or interaction causes.
 *
 * Contract: navigation to /search = 0 unless an explicit accepted compute event
 * occurred through the governed mechanism; one explicit Send / Run = exactly 1.
 */

jest.mock('@/lib/api/analysisApi', () => {
  class AnalysisApiError extends Error {}
  return { analyzeNews: jest.fn(), AnalysisApiError };
});

let currentParams = new URLSearchParams();
const router = { push: jest.fn(), replace: jest.fn(), refresh: jest.fn(), back: jest.fn() };
jest.mock('next/navigation', () => ({
  useRouter: () => router,
  useSearchParams: () => currentParams,
}));

jest.mock('@/lib/i18n/languages', () => ({
  ...jest.requireActual('@/lib/i18n/languages'),
  resolveInitialLanguage: () => 'en',
}));
jest.mock('@/components/search/LoadingStages', () => ({ LoadingStages: () => 'loading' }));
jest.mock('@/components/analysis-frame/AnalysisFrameSurface', () => ({
  AnalysisFrameSurface: () => 'frame',
}));
jest.mock('@/components/analysis-frame/ZeroReportRecovery', () => ({
  ZeroReportRecovery: () => 'recovery',
}));
jest.mock('@/components/analysis-frame/analysisFrameState', () => ({
  resolveFrameEvidence: () => ({ evidenceSurvives: true, state: 'ok' }),
}));
jest.mock('@/components/ui/AdaptiveTextarea', () => {
  const react = jest.requireActual('react');
  return { AdaptiveTextarea: (props: Record<string, unknown>) => react.createElement('textarea', props) };
});

const transport = jest.mocked(analyzeNews);
let renderer: ReactTestRenderer;

function arrive(search: string, strict = false): void {
  currentParams = new URLSearchParams(search);
  const element = createElement(SearchPageClient, { initialLanguage: 'en' });
  act(() => {
    renderer = create(strict ? createElement(StrictMode, null, element) : element);
  });
}

function navigateTo(search: string): void {
  currentParams = new URLSearchParams(search);
  act(() => {
    renderer.update(createElement(SearchPageClient, { initialLanguage: 'en' }));
  });
}

const byData = (value: string): ReactTestInstance[] =>
  renderer.root.findAll((node) => node.props['data-search'] === value);

beforeEach(() => {
  transport.mockReset();
  transport.mockReturnValue(new Promise(() => undefined));
  router.push.mockReset();
  router.replace.mockReset();
  resetAnalysisConsentForTests();
});

afterEach(() => {
  act(() => renderer?.unmount());
});

describe('ARRIVAL — a URL is not compute consent', () => {
  it.each([
    ['plain question', 'q=What+is+happening+in+Sudan%3F'],
    ['map Analysis action', 'q=Poland&countryCode=PL'],
    ['map / story "Ask about this"', 'q=Poland+revives+tax+proposal&articleId=gnews-1&countryCode=PL'],
    ['history re-open', 'q=Kenya+elections&countryCode=KE'],
    ['NavBar topic link', 'q=economy'],
    ['dock transition opened by URL alone (reload, new tab, shared link)', fullAnalysisHref('Why?', { title: 'Rwanda budget', articleId: 'a1', countryCode: 'RW' }).slice('/search?'.length)],
  ])('%s → 0 analysis requests, question staged', (_, search) => {
    arrive(search);
    expect(transport).toHaveBeenCalledTimes(0);
    expect(byData('staged')).toHaveLength(1);
  });

  it('queryless /search (header Search, workspace links) → 0 requests, no staged panel', () => {
    arrive('');
    expect(transport).toHaveBeenCalledTimes(0);
    expect(byData('staged')).toHaveLength(0);
  });

  it('a grant for a DIFFERENT question never runs this one, and is cleared', () => {
    grantAnalysisConsent('/search?q=Something+else');
    arrive('q=Poland');
    expect(transport).toHaveBeenCalledTimes(0);
    expect(consumeAnalysisConsent(analysisConsentKey({ q: 'Something else' }))).toBe(false);
  });

  it('a grant for the same question but a different story anchor does not run it', () => {
    grantAnalysisConsent('/search?q=Poland&articleId=a1');
    arrive('q=Poland&articleId=a2');
    expect(transport).toHaveBeenCalledTimes(0);
  });
});

describe('EXPLICIT COMPUTE — exactly one execution', () => {
  it('staged → Run → exactly 1 request, and re-renders do not add more', () => {
    arrive('q=Poland&countryCode=PL');
    act(() => byData('run-staged')[0].props.onClick());
    expect(transport).toHaveBeenCalledTimes(1);
    expect(transport.mock.calls[0][0]).toBe('Poland');
    navigateTo('q=Poland&countryCode=PL');
    expect(transport).toHaveBeenCalledTimes(1);
  });

  it('workspace Analyze → grant → arrival → exactly 1 request', () => {
    arrive('');
    const field = renderer.root.findByProps({ id: 'search-workspace-question' });
    act(() => field.props.onChange({ target: { value: 'What changed in Sudan?' } }));
    expect(transport).toHaveBeenCalledTimes(0);

    const form = renderer.root.findByProps({ role: 'search' });
    act(() => form.props.onSubmit({ preventDefault() {} }));
    expect(router.push).toHaveBeenCalledWith('/search?q=What%20changed%20in%20Sudan%3F');
    expect(transport).toHaveBeenCalledTimes(0);

    navigateTo('q=What%20changed%20in%20Sudan%3F');
    expect(transport).toHaveBeenCalledTimes(1);
  });

  it('dock "Open full analysis" grant → full navigation → exactly 1 request with the anchor', () => {
    const href = fullAnalysisHref('What happens next?', { title: 'Rwanda budget', articleId: 'a1', countryCode: 'RW' });
    grantAnalysisConsent(href);
    arrive(href.slice('/search?'.length));
    expect(transport).toHaveBeenCalledTimes(1);
    expect(transport.mock.calls[0][0]).toBe('What happens next?');
    expect(transport.mock.calls[0][2]).toEqual({ title: 'Rwanda budget', articleId: 'a1', countryCode: 'RW' });
  });

  it('React Strict Mode double effects still produce exactly 1 request for one grant', () => {
    grantAnalysisConsent('/search?q=Poland');
    arrive('q=Poland', true);
    expect(transport).toHaveBeenCalledTimes(1);
  });

  it('a grant is one-shot: back/forward to an analysed question re-stages it at 0 cost', () => {
    grantAnalysisConsent('/search?q=Poland');
    arrive('q=Poland');
    expect(transport).toHaveBeenCalledTimes(1);

    navigateTo('q=Kenya');
    expect(transport).toHaveBeenCalledTimes(1);
    expect(byData('staged')).toHaveLength(1);

    navigateTo('q=Poland');
    expect(transport).toHaveBeenCalledTimes(1);
    expect(byData('staged')).toHaveLength(1);
  });

  it('a remount (reload) of an analysed URL is 0 requests', () => {
    grantAnalysisConsent('/search?q=Poland');
    arrive('q=Poland');
    act(() => renderer.unmount());
    arrive('q=Poland');
    expect(transport).toHaveBeenCalledTimes(1);
  });
});

describe('PR #40 R2 F1 — leaving the authorized identity revokes consent, including via queryless /search', () => {
  it('Codex sequence 1: run Poland → bare /search → back to ?q=Poland requires a fresh Run', () => {
    grantAnalysisConsent('/search?q=Poland');
    arrive('q=Poland');
    expect(transport).toHaveBeenCalledTimes(1);

    navigateTo('');
    expect(transport).toHaveBeenCalledTimes(1);

    navigateTo('q=Poland');
    expect(transport).toHaveBeenCalledTimes(1);
    expect(byData('staged')).toHaveLength(1);

    act(() => byData('run-staged')[0].props.onClick());
    expect(transport).toHaveBeenCalledTimes(2);
  });

  it('Codex sequence 2: a pending Poland grant does not survive arrival at bare /search', () => {
    grantAnalysisConsent('/search?q=Poland');
    arrive('');
    expect(transport).toHaveBeenCalledTimes(0);

    navigateTo('q=Poland');
    expect(transport).toHaveBeenCalledTimes(0);
    expect(byData('staged')).toHaveLength(1);
  });

  it('…nor a later full-document arrival (the pending grant itself is revoked, not just hidden)', () => {
    grantAnalysisConsent('/search?q=Poland');
    arrive('');
    act(() => renderer.unmount());
    arrive('q=Poland');
    expect(transport).toHaveBeenCalledTimes(0);
    expect(consumeAnalysisConsent(analysisConsentKey({ q: 'Poland' }))).toBe(false);
  });

  it('Strict Mode: bare /search then a same-tab granted handoff still runs exactly once', () => {
    arrive('', true);
    grantAnalysisConsent('/search?q=Poland');
    act(() => {
      currentParams = new URLSearchParams('q=Poland');
      renderer.update(createElement(StrictMode, null, createElement(SearchPageClient, { initialLanguage: 'en' })));
    });
    expect(transport).toHaveBeenCalledTimes(1);
  });

  it('the workspace Analyze on bare /search still hands off exactly once', () => {
    arrive('');
    act(() => renderer.root.findByProps({ id: 'search-workspace-question' }).props.onChange({ target: { value: 'Poland' } }));
    act(() => renderer.root.findByProps({ role: 'search' }).props.onSubmit({ preventDefault() {} }));
    navigateTo('q=Poland');
    expect(transport).toHaveBeenCalledTimes(1);
  });
});

describe('CTO RULING 1 — a language switch is presentation, not compute consent', () => {
  const switchLanguage = (language: 'en' | 'pl'): void => {
    act(() => {
      renderer.update(createElement(SearchPageClient, { initialLanguage: language }));
    });
  };

  it('after a completed run, switching EN → PL adds 0 requests and stages the question', () => {
    grantAnalysisConsent('/search?q=Poland');
    arrive('q=Poland');
    expect(transport).toHaveBeenCalledTimes(1);
    expect(transport.mock.calls[0][1]).toBe('en');

    switchLanguage('pl');
    expect(transport).toHaveBeenCalledTimes(1);
    expect(byData('staged')).toHaveLength(1);
    expect(renderer.root.findByProps({ 'data-search': 'run-staged' }).props.children).toBe('Uruchom analizę');
  });

  it('then an explicit Run executes exactly once, in the newly selected language', () => {
    grantAnalysisConsent('/search?q=Poland');
    arrive('q=Poland');
    switchLanguage('pl');
    act(() => byData('run-staged')[0].props.onClick());
    expect(transport).toHaveBeenCalledTimes(2);
    expect(transport.mock.calls[1][0]).toBe('Poland');
    expect(transport.mock.calls[1][1]).toBe('pl');
  });

  it('switching back to the already-run language does not replay a run either', () => {
    grantAnalysisConsent('/search?q=Poland');
    arrive('q=Poland');
    switchLanguage('pl');
    switchLanguage('en');
    expect(transport).toHaveBeenCalledTimes(1);
  });
});

describe('CTO RULING 3 — Map entry points stage; none of them can grant consent', () => {
  const { readFileSync } = jest.requireActual('fs') as typeof import('fs');
  const { join } = jest.requireActual('path') as typeof import('path');
  const map = (file: string): string => readFileSync(join(__dirname, '..', 'map', file), 'utf-8');

  it.each([
    'MapPageClient.tsx',
    'CountryPanel.tsx',
    'CountryArticleCard.tsx',
    join('shell', 'SourceCard.tsx'),
    join('shell', 'GlobalMapShell.tsx'),
  ])('%s never imports the consent grant or the analysis transport', (file) => {
    const source = map(file);
    expect(source).not.toContain('grantAnalysisConsent');
    expect(source).not.toContain('analysisComputeConsent');
    expect(source).not.toContain('analyzeNews(');
  });

  it('the exact Map Analysis shape (q + countryCode) arrives staged at 0 requests', () => {
    arrive('q=Poland&countryCode=PL');
    expect(transport).toHaveBeenCalledTimes(0);
    expect(byData('run-staged')).toHaveLength(1);
  });
});

describe('THE GRANT — bounded, one-shot, identity-bound', () => {
  it('expires after the TTL', () => {
    grantAnalysisConsent('/search?q=Poland', 1_000);
    expect(
      consumeAnalysisConsent(analysisConsentKey({ q: 'Poland' }), 1_000 + ANALYSIS_CONSENT_TTL_MS + 1),
    ).toBe(false);
  });

  it('is consumed exactly once, even immediately afterwards', () => {
    grantAnalysisConsent('/search?q=Poland', 1_000);
    const key = analysisConsentKey({ q: 'Poland' });
    expect(consumeAnalysisConsent(key, 1_100)).toBe(true);
    expect(consumeAnalysisConsent(key, 1_101)).toBe(false);
  });

  it('survives a same-tab full navigation (sessionStorage), never a new tab', () => {
    const store = new Map<string, string>();
    const sessionStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    };
    const globalWithWindow = globalThis as unknown as { window?: unknown };
    globalWithWindow.window = { sessionStorage };
    try {
      const key = analysisConsentKey({ q: 'Poland' });
      jest.isolateModules(() => {
        // the page that navigates away (plain <a href>: module memory is lost after)
        require('@/lib/analysis/analysisComputeConsent').grantAnalysisConsent('/search?q=Poland');
      });
      jest.isolateModules(() => {
        // the freshly loaded /search document in the SAME tab
        expect(require('@/lib/analysis/analysisComputeConsent').consumeAnalysisConsent(key)).toBe(true);
      });
      jest.isolateModules(() => {
        // a reload of that document afterwards
        expect(require('@/lib/analysis/analysisComputeConsent').consumeAnalysisConsent(key)).toBe(false);
      });
      store.clear(); // a new tab starts with its own, empty sessionStorage
      jest.isolateModules(() => {
        expect(require('@/lib/analysis/analysisComputeConsent').consumeAnalysisConsent(key)).toBe(false);
      });
    } finally {
      delete globalWithWindow.window;
    }
  });

  it('trims the question the same way /search does', () => {
    expect(analysisConsentKey({ q: '  Poland ' })).toBe(analysisConsentKey({ q: 'Poland' }));
  });
});
