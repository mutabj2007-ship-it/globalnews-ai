import { createElement } from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { analyzeNews } from '@/lib/api/analysisApi';
import { openGlobalAsk } from '@/lib/ask/openGlobalAsk';
import { publishGeographyContext, resetGeographyContextStoreForTest } from '@/lib/ask/geographyContextStore';
import { publishStoryContext, resetStoryContextStoreForTest } from '@/lib/ask/storyContextStore';

/**
 * MAP MOBILE R1 CONVERGENCE — the Global Ask dock and the map geography.
 *
 * Selecting a country / publishing the geography store = 0 requests. Opening
 * Ask = 0. Typing = 0. One explicit Send = exactly 1 analysis request, which
 * carries the geography only when no story context is published.
 */

jest.mock('@/lib/api/analysisApi', () => ({ analyzeNews: jest.fn() }));
jest.mock('@/components/search/SearchPageClient', () => ({
  resolveAnalysisErrorMessage: () => 'Request failed',
}));
jest.mock('next/navigation', () => ({ usePathname: () => '/map' }));
jest.mock('@/components/ask/useLauncherAnchor', () => ({
  useLauncherAnchor: () => ({ anchor: 'bottom', bottomOffset: 16, coveredByDialog: false }),
}));
jest.mock('@/components/ask/AskCompactResult', () => ({ AskCompactResult: () => 'result' }));
jest.mock('@/components/ui/AdaptiveTextarea', () => {
  const react = jest.requireActual('react');
  return {
    AdaptiveTextarea: react.forwardRef((props: Record<string, unknown>, ref: unknown) =>
      react.createElement('textarea', { ...props, ref }),
    ),
  };
});

const target = new EventTarget();
Object.assign(globalThis, {
  window: Object.assign(target, {
    innerHeight: 800,
    requestAnimationFrame: (cb: () => void) => {
      cb();
      return 0;
    },
  }),
  requestAnimationFrame: (cb: () => void) => {
    cb();
    return 0;
  },
});

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { AskAiDock } = require('./AskAiDock') as typeof import('./AskAiDock');

const transport = jest.mocked(analyzeNews);
const fetchSpy = jest.fn();
let renderer: ReactTestRenderer;

const byAsk = (value: string): ReactTestInstance[] =>
  renderer.root.findAll((node) => node.props['data-ask'] === value && typeof node.type === 'string');
const field = (): ReactTestInstance => renderer.root.findByProps({ id: 'ask-ai-question' });
const type = (value: string): void => {
  act(() => {
    field().props.onChange({ target: { value } });
  });
};
const send = (): void => {
  act(() => {
    byAsk('form')[0].props.onSubmit({ preventDefault() {} });
  });
};
const chipText = (): string => {
  const chip = byAsk('context-affordance')[0];
  return (chip.children as unknown[]).map(String).join('');
};

const ALGERIA = { countryCode: 'DZ', displayName: 'Algeria' };

function mount(language: 'en' | 'pl' = 'en'): void {
  act(() => {
    renderer = create(createElement(AskAiDock, { language }), { createNodeMock: () => ({ focus() {} }) });
  });
}

beforeEach(() => {
  transport.mockReset();
  transport.mockReturnValue(new Promise(() => undefined));
  fetchSpy.mockReset();
  global.fetch = fetchSpy as unknown as typeof fetch;
  resetGeographyContextStoreForTest();
  resetStoryContextStoreForTest();
});
afterEach(() => {
  act(() => renderer?.unmount());
  resetGeographyContextStoreForTest();
  resetStoryContextStoreForTest();
});

describe('zero compute before an explicit Send', () => {
  it('publishing / staging the geography store = 0 requests and 0 fetches', () => {
    mount();
    act(() => publishGeographyContext(Symbol('map'), ALGERIA));
    act(() => publishGeographyContext(Symbol('map'), { countryCode: 'PL', displayName: 'Poland' }));
    expect(transport).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('opening Ask with a country selected = 0; typing = 0', () => {
    mount();
    act(() => publishGeographyContext(Symbol('map'), ALGERIA));
    act(() => openGlobalAsk());
    type('W');
    type('What changed this week?');
    expect(transport).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('one explicit Send = exactly one analysis request', () => {
  it('carries the geography, and no story context, when only a country is selected', () => {
    mount();
    act(() => publishGeographyContext(Symbol('map'), ALGERIA));
    act(() => openGlobalAsk('What changed this week?'));
    send();

    expect(transport).toHaveBeenCalledTimes(1);
    const [question, language, story, prior, selection, geography] = transport.mock.calls[0];
    expect(question).toBe('What changed this week?');
    expect(language).toBe('en');
    expect(story).toBeUndefined();
    expect(prior).toBeUndefined();
    expect(selection).toBeUndefined();
    expect(geography).toEqual(ALGERIA);
  });

  it('story context wins over geography: the story is sent and the geography is not', () => {
    mount();
    act(() => publishGeographyContext(Symbol('map'), ALGERIA));
    act(() =>
      publishStoryContext(Symbol('story'), { title: 'Kenya election commission sets date', articleId: 'a-1', countryCode: 'KE' }),
    );
    act(() => openGlobalAsk('What happens next?'));
    send();

    expect(transport).toHaveBeenCalledTimes(1);
    const call = transport.mock.calls[0];
    expect(call[2]).toMatchObject({ title: 'Kenya election commission sets date', articleId: 'a-1' });
    expect(call[5]).toBeUndefined();
  });

  it('with neither context, the Send is a generic Ask', () => {
    mount();
    act(() => openGlobalAsk('What is happening in the world?'));
    send();
    expect(transport).toHaveBeenCalledTimes(1);
    expect(transport.mock.calls[0][2]).toBeUndefined();
    expect(transport.mock.calls[0][5]).toBeUndefined();
  });
});

describe('the chip names the country; the label stays presentation only', () => {
  it('EN: "Asking about Algeria"', () => {
    mount('en');
    act(() => publishGeographyContext(Symbol('map'), ALGERIA));
    act(() => openGlobalAsk());
    expect(byAsk('context-affordance')[0].props['data-ask-context']).toBe('geography');
    expect(chipText()).toBe('Asking about Algeria');
  });

  it('PL: "Pytasz o: Algieria"', () => {
    mount('pl');
    act(() => publishGeographyContext(Symbol('map'), { countryCode: 'DZ', displayName: 'Algieria' }));
    act(() => openGlobalAsk());
    expect(chipText()).toBe('Pytasz o: Algieria');
  });
});
