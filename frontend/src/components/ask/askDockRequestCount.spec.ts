import { createElement } from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { askV2Api } from '@/lib/api/askV2Api';
import { openGlobalAsk } from '@/lib/ask/openGlobalAsk';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * ASK/SEARCH ENGINEERING R1 — REQUEST COUNTS ON THE MOUNTED GLOBAL ASK DOCK
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Opening Home Ask = 0. Typing = 0. Suggestion selection = 0. One ordinary
 * explicit Send = exactly 1. A second submit while a turn is in flight = 0 more.
 * The second turn carries the prior USER question, never the model's output.
 *
 * UNIFIED INTELLIGENCE BINDING R2C — the dock's one transport is now the canonical Ask V2 turn
 * (`askV2Api.submit` → POST /ask-v2/threads/:id/turns = one operation), counted here through the
 * REAL conversation hook. Continuity is the Ask thread's: a follow-up is sent in the SAME thread
 * (the server derives the prior USER question from that thread's own turns — never the client,
 * never the model output); "New topic" starts a new thread at the next Send.
 */

jest.mock('@/lib/api/analysisApi', () => ({ analyzeNews: jest.fn() }));
jest.mock('@/lib/api/askV2Api', () => ({
  ...jest.requireActual('@/lib/api/askV2Api'),
  askV2Api: {
    createThread: jest.fn(),
    submit: jest.fn(),
    guestStatus: jest.fn(),
  },
}));
jest.mock('@/components/ask-frame/AskR2TurnView', () => ({ AskR2TurnView: () => 'turn' }));
jest.mock('@/components/search/SearchPageClient', () => ({
  resolveAnalysisErrorMessage: () => 'Request failed',
}));
jest.mock('next/navigation', () => ({ usePathname: () => '/' }));
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

const transport = jest.mocked(askV2Api.submit);
const createThread = jest.mocked(askV2Api.createThread);
let renderer: ReactTestRenderer;
let threadSeq = 0;

/* A completed canonical operation whose stored answer carries model output. */
const answer = {
  ok: true as const,
  value: {
    operationId: 'op-1',
    status: 'COMPLETED',
    result: { payload: { schema: 'ask-r2-result/1', analysis: { summary: 'MODEL OUTPUT MUST NEVER BE SENT BACK' } } },
  },
} as never;
/* [threadId, question, language, intent, idempotencyKey, context] */
const threadOf = (call: number): unknown => transport.mock.calls[call][0];

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
  createThread.mockReset();
  threadSeq = 0;
  createThread.mockImplementation(async () => ({ ok: true, value: { id: `thread-${(threadSeq += 1)}` } }) as never);
  act(() => {
    renderer = create(createElement(AskAiDock, { language: 'en' }), { createNodeMock: () => ({ focus() {} }) });
  });
});
afterEach(() => {
  act(() => renderer.unmount());
});

describe('Home Ask dock — request counts', () => {
  it('opening from Home (Hero CTA / rail launch) = 0 requests', async () => {
    act(() => openGlobalAsk());
    expect(byAsk('panel')).toHaveLength(1);
    expect(transport).toHaveBeenCalledTimes(0);
  });

  it('staging a Hero draft or selecting a rail suggestion = 0 requests', async () => {
    act(() => openGlobalAsk('What’s happening in the Middle East right now?'));
    expect(field().props.value).toBe('What’s happening in the Middle East right now?');
    expect(transport).toHaveBeenCalledTimes(0);
  });

  it('typing = 0 requests', async () => {
    act(() => openGlobalAsk());
    type('W');
    type('What changed in Sudan this week?');
    expect(transport).toHaveBeenCalledTimes(0);
  });

  it('one explicit Send = exactly 1 request; a repeat submit while in flight adds 0', async () => {
    transport.mockReturnValue(new Promise(() => undefined));
    act(() => openGlobalAsk('What changed in Sudan?'));
    await act(async () => send());
    expect(transport).toHaveBeenCalledTimes(1);
    type('What changed in Sudan?');
    await act(async () => send());
    expect(transport).toHaveBeenCalledTimes(1);
  });

  it('the second turn sends the prior USER question and never the prior model output', async () => {
    transport.mockResolvedValueOnce(answer).mockReturnValueOnce(new Promise(() => undefined));
    act(() => openGlobalAsk('What is happening in Sudan?'));
    await act(async () => send());
    type('Why does it matter?');
    await act(async () => send());

    expect(transport).toHaveBeenCalledTimes(2);
    const [, question] = transport.mock.calls[1];
    expect(question).toBe('Why does it matter?');
    /* the follow-up continues the SAME thread — its prior USER question is the server's to derive */
    expect(threadOf(1)).toBe(threadOf(0));
    expect(JSON.stringify(transport.mock.calls[1])).not.toContain('MODEL OUTPUT');
  });

  it('the composer stays bounded to the 1,000-character transport limit', async () => {
    act(() => openGlobalAsk());
    expect(field().props.maxLength).toBe(1000);
  });
});

describe('TOPIC CONTINUITY R1 — the dock carries the subject, visibly and reversibly', () => {
  const continuing = answer;

  it('a chain keeps the subject: turn 3 sends the question that ESTABLISHED it, still user text only', async () => {
    transport
      .mockResolvedValueOnce(answer)
      .mockResolvedValueOnce(continuing)
      .mockReturnValueOnce(new Promise(() => undefined));
    act(() => openGlobalAsk('Explain the new EU AI regulation in plain English'));
    await act(async () => send());
    type('How will this affect GlobalNewsAI?');
    await act(async () => send());
    type('What about businesses?');
    await act(async () => send());

    expect(transport).toHaveBeenCalledTimes(3);
    /* one thread for the whole chain: the server keeps the subject from its own turns */
    expect(threadOf(1)).toBe(threadOf(0));
    expect(threadOf(2)).toBe(threadOf(0));
    expect(transport.mock.calls[2][1]).toBe('What about businesses?');
    expect(createThread).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(transport.mock.calls)).not.toContain('MODEL OUTPUT');
  });

  it('"Start a new topic" costs 0 requests, and the next Send carries no prior question', async () => {
    transport.mockResolvedValueOnce(continuing).mockReturnValueOnce(new Promise(() => undefined));
    act(() => openGlobalAsk('How will this affect GlobalNewsAI?'));
    await act(async () => send());
    expect(transport).toHaveBeenCalledTimes(1);

    act(() => byAsk('new-topic')[0].props.onClick());
    expect(transport).toHaveBeenCalledTimes(1);
    expect(createThread).toHaveBeenCalledTimes(1);

    type('What about inflation in Poland?');
    await act(async () => send());
    expect(transport).toHaveBeenCalledTimes(2);
    /* a NEW thread: nothing earlier continues into the new topic */
    expect(createThread).toHaveBeenCalledTimes(2);
    expect(threadOf(1)).not.toBe(threadOf(0));
  });

  it('without a continued subject, the ordinary follow-up rule is unchanged', async () => {
    transport.mockResolvedValueOnce(answer).mockReturnValueOnce(new Promise(() => undefined));
    act(() => openGlobalAsk('What is happening in Sudan?'));
    await act(async () => send());
    type('Why does it matter?');
    await act(async () => send());
    expect(threadOf(1)).toBe(threadOf(0));
  });
});

describe('LANE E — every shipped Home suggestion: tap = 0, edit = 0, explicit Ask = exactly 1', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { HOME_SUGGESTIONS } = require('@globalnews-ai/shared') as typeof import('@globalnews-ai/shared');
  const ALL = [...HOME_SUGGESTIONS.en, ...HOME_SUGGESTIONS.pl];

  it.each(ALL)('"%s" stages in the composer and costs nothing until Send', async (suggestion) => {
    transport.mockReturnValue(new Promise(() => undefined));
    act(() => openGlobalAsk(suggestion));
    expect(field().props.value).toBe(suggestion);
    expect(transport).toHaveBeenCalledTimes(0);

    type(`${suggestion} — for Poland`);
    expect(transport).toHaveBeenCalledTimes(0);

    await act(async () => send());
    expect(transport).toHaveBeenCalledTimes(1);
    expect(transport.mock.calls[0][1]).toBe(`${suggestion} — for Poland`);
  });
});
