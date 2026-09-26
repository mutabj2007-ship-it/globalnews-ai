import { createElement } from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import type { AnalysisApiResponse } from '@globalnews-ai/shared';
import { analyzeNews } from '@/lib/api/analysisApi';
import { openGlobalAsk } from '@/lib/ask/openGlobalAsk';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * ASK/SEARCH ENGINEERING R1 — REQUEST COUNTS ON THE MOUNTED GLOBAL ASK DOCK
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Opening Home Ask = 0. Typing = 0. Suggestion selection = 0. One ordinary
 * explicit Send = exactly 1. A second submit while a turn is in flight = 0 more.
 * The second turn carries the prior USER question, never the model's output.
 */

jest.mock('@/lib/api/analysisApi', () => ({ analyzeNews: jest.fn() }));
jest.mock('@/components/search/SearchPageClient', () => ({
  resolveAnalysisErrorMessage: () => 'Request failed',
}));
jest.mock('next/navigation', () => ({ usePathname: () => '/' }));
jest.mock('@/components/ask/useLauncherAnchor', () => ({
  useLauncherAnchor: () => ({ anchor: 'bottom', bottomOffset: 16, coveredByDialog: false }),
}));
jest.mock('@/components/search/LoadingStages', () => ({ LoadingStages: () => 'loading' }));
jest.mock('@/components/ask/AskCompactResult', () => ({ AskCompactResult: () => 'result' }));
jest.mock('@/components/ui/AdaptiveTextarea', () => {
  const react = jest.requireActual('react');
  return {
    AdaptiveTextarea: react.forwardRef((props: Record<string, unknown>, ref: unknown) =>
      react.createElement('textarea', { ...props, ref }),
    ),
  };
});

/* A minimal browser window: the dock listens for the launcher event on it. */
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
let renderer: ReactTestRenderer;

const answer = {
  analysis: { summary: 'MODEL OUTPUT MUST NEVER BE SENT BACK' },
  articles: [],
  retrievalContext: { storyContextUsed: false },
} as unknown as AnalysisApiResponse;

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

beforeEach(() => {
  transport.mockReset();
  act(() => {
    renderer = create(createElement(AskAiDock, { language: 'en' }), { createNodeMock: () => ({ focus() {} }) });
  });
});
afterEach(() => {
  act(() => renderer.unmount());
});

describe('Home Ask dock — request counts', () => {
  it('opening from Home (Hero CTA / rail launch) = 0 requests', () => {
    act(() => openGlobalAsk());
    expect(byAsk('panel')).toHaveLength(1);
    expect(transport).toHaveBeenCalledTimes(0);
  });

  it('staging a Hero draft or selecting a rail suggestion = 0 requests', () => {
    act(() => openGlobalAsk('What’s happening in the Middle East right now?'));
    expect(field().props.value).toBe('What’s happening in the Middle East right now?');
    expect(transport).toHaveBeenCalledTimes(0);
  });

  it('typing = 0 requests', () => {
    act(() => openGlobalAsk());
    type('W');
    type('What changed in Sudan this week?');
    expect(transport).toHaveBeenCalledTimes(0);
  });

  it('one explicit Send = exactly 1 request; a repeat submit while in flight adds 0', () => {
    transport.mockReturnValue(new Promise(() => undefined));
    act(() => openGlobalAsk('What changed in Sudan?'));
    send();
    expect(transport).toHaveBeenCalledTimes(1);
    type('What changed in Sudan?');
    send();
    expect(transport).toHaveBeenCalledTimes(1);
  });

  it('the second turn sends the prior USER question and never the prior model output', async () => {
    transport.mockResolvedValueOnce(answer).mockReturnValueOnce(new Promise(() => undefined));
    act(() => openGlobalAsk('What is happening in Sudan?'));
    await act(async () => {
      send();
    });
    type('Why does it matter?');
    send();

    expect(transport).toHaveBeenCalledTimes(2);
    const [question, , , priorQuestion] = transport.mock.calls[1];
    expect(question).toBe('Why does it matter?');
    expect(priorQuestion).toBe('What is happening in Sudan?');
    expect(JSON.stringify(transport.mock.calls[1])).not.toContain('MODEL OUTPUT');
  });

  it('the composer stays bounded to the 1,000-character transport limit', () => {
    act(() => openGlobalAsk());
    expect(field().props.maxLength).toBe(1000);
  });
});
