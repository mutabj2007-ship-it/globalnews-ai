import { createElement } from 'react';
import { act, create } from 'react-test-renderer';
import {
  askV2Api,
  type AskR2Payload,
  type AskV2Operation,
  type AskV2RecentThread,
} from '@/lib/api/askV2Api';
import { askR2Strings } from './askR2Strings';
import { askR2View, dedupeChips, withoutTerms } from './askR2View';
import { askReopenHref, filterRecent, recentRowPreview } from './askRecentGrouping';
import { askContinuityStrings } from './askContinuityStrings';
import { cleanAskDestination, isAskConversationSurface, isPlainClick } from './askCleanNavigation';
import { useAskR2Conversation } from './useAskR2Conversation';

/**
 * ALPHA VISUAL ACCEPTANCE REPAIR R1 — the pure and hook-level halves of C, D, E, F and G.
 * (A, B and H are rendered in components/ask-nav/askNavShellRuntime.spec.ts.)
 */
jest.mock('@/lib/api/askV2Api', () => {
  const actual = jest.requireActual('@/lib/api/askV2Api');
  return {
    ...actual,
    askV2Api: {
      createThread: jest.fn(),
      submit: jest.fn(),
      operation: jest.fn(),
      accept: jest.fn(),
      reserve: jest.fn(),
      execute: jest.fn(),
      release: jest.fn(),
    },
  };
});
const api = jest.mocked(askV2Api);
beforeEach(() => jest.resetAllMocks());

const payload = (over: Partial<AskR2Payload> & { answer: AskR2Payload['answer'] }): AskR2Payload =>
  ({
    schema: 'ask-r2-result/1',
    route: {
      questionClass: 'CURRENT_REPORTING',
      terminalState: 'BROADENING_OFFERED',
      scopedBy: 'TYPED_GEOGRAPHY',
      refusals: [],
      disclosures: [],
      clarification: [],
      normalization: 'QUALIFIED',
      questionLanguage: 'en',
      personalScope: null,
    },
    chips: { kind: 'NONE' },
    checkedAt: '2026-09-29T10:00:00Z',
    aiExecuted: false,
    modelPriorCitable: false,
    analysis: null,
    ...over,
  }) as AskR2Payload;

const POLITICAL_TODAY = payload({
  answer: { state: 'CLARIFICATION_REQUIRED', basis: 'PLAN_BROADENING_OFFERED', missingRoles: [] },
  chips: {
    kind: 'SCOPED',
    chips: [
      { kind: 'TOPIC', value: 'political', source: 'READER_CATEGORY', applied: false },
      { kind: 'GEOGRAPHY', value: 'POL', source: 'TYPED', applied: true },
      { kind: 'TIME', value: 'today', source: 'STATED_PERIOD', applied: false },
      { kind: 'DOMAIN', value: 'political', source: 'ANALYTICAL_DOMAIN', applied: true },
    ],
  },
});
const Q2 =
  'What are the latest major political developments in Poland today? Give me the top 3 and cite the sources.';
const place = (iso3: string) => ({ POL: 'Poland', COD: 'DR Congo', COG: 'Congo' })[iso3] ?? iso3;
const placePl = (iso3: string) => ({ POL: 'Polska' })[iso3] ?? iso3;

describe('G — duplicate display chips', () => {
  it('EN: "Political · Poland · Today · Political" displays each label once, in reading order', () => {
    const v = askR2View(POLITICAL_TODAY, askR2Strings('en'), 'en', place, Q2);
    expect(v.chips.items.map((i) => i.label)).toEqual(['Political', 'Poland', 'Today']);
  });

  it('PL: the same payload in Polish is de-duplicated the same way', () => {
    const v = askR2View(POLITICAL_TODAY, askR2Strings('pl'), 'pl', placePl, Q2);
    expect(v.chips.items.map((i) => i.label)).toEqual(['Political', 'Polska', 'Today']);
  });

  it('a limit is never claimed as applied while one reading of it was not', () => {
    expect(
      dedupeChips([
        { kind: 'DOMAIN', label: 'Political', kept: false },
        { kind: 'TOPIC', label: 'political', kept: true },
      ]),
    ).toEqual([{ kind: 'DOMAIN', label: 'Political', kept: true }]);
  });

  it('distinct labels are untouched; the payload itself is not modified', () => {
    const before = JSON.stringify(POLITICAL_TODAY);
    askR2View(POLITICAL_TODAY, askR2Strings('en'), 'en', place, Q2);
    expect(JSON.stringify(POLITICAL_TODAY)).toBe(before);
  });
});

describe('F — no clarification renders without an actionable question', () => {
  it('BROADENING_OFFERED names what cannot be applied and offers the question without it', () => {
    const v = askR2View(POLITICAL_TODAY, askR2Strings('en'), 'en', place, Q2);
    expect(v.badge).toBe('clar');
    expect(v.clarification.lead).toContain('“political” and “today”');
    expect(v.clarification.suggestion).toBe(
      'What are the latest major developments in Poland? Give me the top 3 and cite the sources.',
    );
  });

  it('PL copy for the same offer', () => {
    const v = askR2View(POLITICAL_TODAY, askR2Strings('pl'), 'pl', placePl, Q2);
    expect(v.clarification.lead).toContain('„political” i „today”');
    expect(v.clarification.lead).toContain('proponowanego pytania');
  });

  it('when the words are not literally in the question, no rewrite is guessed — the lead still asks', () => {
    const v = askR2View(
      POLITICAL_TODAY,
      askR2Strings('en'),
      'en',
      place,
      'Jakie są wydarzenia w Polsce?',
    );
    expect(v.clarification.suggestion).toBeNull();
    expect(v.clarification.lead).toContain('rephrase without it');
  });

  const bases: Array<[string, Partial<AskR2Payload['route']>, AskR2Payload['answer']]> = [
    [
      'plan broadening, no chips',
      {},
      { state: 'CLARIFICATION_REQUIRED', basis: 'PLAN_BROADENING_OFFERED', missingRoles: [] },
    ],
    [
      'plan clarification, language',
      { clarification: ['LANGUAGE_UNSUPPORTED'] },
      { state: 'CLARIFICATION_REQUIRED', basis: 'PLAN_CLARIFICATION', missingRoles: [] },
    ],
    [
      'plan clarification, source frame',
      { clarification: ['SOURCE_FRAME_UNPARSED'] },
      { state: 'CLARIFICATION_REQUIRED', basis: 'PLAN_CLARIFICATION', missingRoles: [] },
    ],
    [
      'plan clarification, generic',
      { clarification: ['CLARIFICATION_REQUIRED'] },
      { state: 'CLARIFICATION_REQUIRED', basis: 'PLAN_CLARIFICATION', missingRoles: [] },
    ],
    [
      'executor, empty candidates',
      {},
      {
        state: 'CLARIFICATION_REQUIRED',
        basis: 'LANDED_AMBIGUOUS_COUNTRY',
        missingRoles: [],
        candidates: [],
      },
    ],
    [
      'executor, no prior subject',
      {},
      {
        state: 'CLARIFICATION_REQUIRED',
        basis: 'NO_PRIOR_SUBJECT',
        missingRoles: [],
        candidates: ['RWA'],
      },
    ],
  ];
  it.each(['en', 'pl'] as const)(
    '[%s] every clarification basis carries a lead or candidates',
    (locale) => {
      for (const [, route, answer] of bases) {
        const p = payload({ answer });
        const v = askR2View(
          { ...p, route: { ...p.route, ...route } } as AskR2Payload,
          askR2Strings(locale),
          locale,
          place,
          'Question?',
        );
        expect(v.badge).toBe('clar');
        const actionable =
          v.clarification.candidates.length > 0 || (v.clarification.lead ?? '').trim().length > 0;
        expect(actionable).toBe(true);
        expect(v.clarification.lead).not.toBe(askR2Strings(locale).freshness.nothingRan);
      }
    },
  );

  it('executor candidates are selectable drafts of the reader question, nothing sent', () => {
    const p = payload({
      answer: {
        state: 'CLARIFICATION_REQUIRED',
        basis: 'LANDED_AMBIGUOUS_COUNTRY',
        missingRoles: [],
        candidates: ['COD', 'COG'],
      },
    });
    const v = askR2View(p, askR2Strings('en'), 'en', place, 'What is happening in Congo?');
    expect(v.clarification.choices).toEqual([
      { label: 'DR Congo', question: 'What is happening in Congo (DR Congo)?' },
      { label: 'Congo', question: 'What is happening in Congo (Congo)?' },
    ]);
    expect(Object.values(api).every((fn) => (fn as jest.Mock).mock.calls.length === 0)).toBe(true);
  });

  it('withoutTerms removes whole words only, and refuses a partial match', () => {
    expect(withoutTerms('Is today a holiday today?', ['today'])).toBe('Is a holiday today?');
    expect(withoutTerms('Todays news?', ['today'])).toBeNull();
    expect(withoutTerms('Anything?', [])).toBeNull();
  });
});

describe('D — the Recent row names the question Open displays', () => {
  const row = (over: Partial<AskV2RecentThread>): AskV2RecentThread => ({
    id: 't1',
    language: 'pl',
    returnPath: null,
    createdAt: '2026-09-29T08:00:00Z',
    lastActiveAt: '2026-09-29T09:00:00Z',
    turnCount: 2,
    firstQuestion: 'Co to jest NATO?',
    firstQuestionTruncated: false,
    latestQuestion: 'Dlaczego artykuł 5 NATO jest ważny?',
    latestQuestionTruncated: false,
    latestTurnId: 'turn-2',
    latestOperationId: 'op-2',
    latestState: 'COMPLETED',
    latestComputeClass: 'FRESH_BOUNDED',
    ...over,
  });

  it('multi-turn: primary = latest question (what Open shows), origin kept as "Started with"', () => {
    const r = row({});
    expect(recentRowPreview(r)).toEqual({
      primary: 'Dlaczego artykuł 5 NATO jest ważny?',
      primaryTruncated: false,
      startedWith: 'Co to jest NATO?',
      startedWithTruncated: false,
    });
    expect(askReopenHref(r)).toBe('/ask?operation=op-2');
    expect(askContinuityStrings('pl').startedWith).toBe('Rozpoczęto od:');
    expect(askContinuityStrings('en').startedWith).toBe('Started with:');
  });

  it('one-turn thread: displayed normally, no origin line', () => {
    const r = row({ turnCount: 1, latestQuestion: 'Co to jest NATO?' });
    expect(recentRowPreview(r)).toMatchObject({ primary: 'Co to jest NATO?', startedWith: null });
  });

  it('an older response without latestQuestion falls back to the first question', () => {
    const { latestQuestion: _l, latestQuestionTruncated: _t, ...old } = row({});
    expect(recentRowPreview(old as AskV2RecentThread).primary).toBe('Co to jest NATO?');
  });

  it('the Recent filter matches either question the row shows', () => {
    expect(filterRecent([row({})], 'artykuł')).toHaveLength(1);
    expect(filterRecent([row({})], 'co to jest')).toHaveLength(1);
    expect(filterRecent([row({})], 'kenya')).toHaveLength(0);
  });
});

describe('E — a follow-up from a reopened result continues its thread', () => {
  const op = (over: Partial<AskV2Operation> = {}): AskV2Operation => ({
    operationId: 'op-2',
    computeClass: 'FRESH_BOUNDED',
    status: 'COMPLETED',
    quotedSand: 0,
    chargingEnabled: false,
    requiresAcceptance: false,
    quoteExpiresAt: '2026-09-29T11:00:00Z',
    acceptedAt: null,
    storedResultId: 'sr',
    storedResultReused: false,
    failureCode: null,
    result: null,
    ...over,
  });
  type Hook = ReturnType<typeof useAskR2Conversation>;
  function mount(language: 'en' | 'pl' = 'en'): () => Hook {
    let latest: Hook | undefined;
    function Probe(): null {
      latest = useAskR2Conversation(language, null);
      return null;
    }
    act(() => {
      create(createElement(Probe));
    });
    return () => latest!;
  }

  it('reopen seeds the thread with ZERO requests; only the explicit Ask submits — into that thread', async () => {
    const hook = mount('en');
    act(() => hook().continueThread('thread-7', 'en'));
    expect(Object.values(api).every((fn) => (fn as jest.Mock).mock.calls.length === 0)).toBe(true);
    api.submit.mockResolvedValue({ ok: true, value: op() });
    await act(async () => {
      await hook().submit('What is slip in an induction motor?');
    });
    expect(api.createThread).not.toHaveBeenCalled();
    expect(api.submit).toHaveBeenCalledTimes(1);
    expect(api.submit.mock.calls[0]![0]).toBe('thread-7');
  });

  it('a conversation already started on this screen is never replaced by a seed', async () => {
    const hook = mount('en');
    api.createThread.mockResolvedValue({
      ok: true,
      value: { id: 'fresh', language: 'en', returnPath: null },
    });
    api.submit.mockResolvedValue({ ok: true, value: op() });
    await act(async () => {
      await hook().submit('First?');
    });
    act(() => hook().continueThread('thread-7', 'en'));
    await act(async () => {
      await hook().submit('Second?');
    });
    expect(api.submit.mock.calls.map((c) => c[0])).toEqual(['fresh', 'fresh']);
  });

  it('a thread in another language is not continued (a new thread, as for a language switch)', async () => {
    const hook = mount('pl');
    act(() => hook().continueThread('thread-en', 'en'));
    api.createThread.mockResolvedValue({
      ok: true,
      value: { id: 'nowy', language: 'pl', returnPath: null },
    });
    api.submit.mockResolvedValue({ ok: true, value: op() });
    await act(async () => {
      await hook().submit('Co to jest poślizg?');
    });
    expect(api.submit.mock.calls[0]![0]).toBe('nowy');
  });
});

describe('A/B — where a clean Ask screen lives', () => {
  it('the standalone root stays the root; every other surface lands on /ask', () => {
    expect(cleanAskDestination('/')).toBe('/');
    for (const p of ['/ask', '/ask/recent', '/saved', '/support', '/account/settings', null]) {
      expect(cleanAskDestination(p)).toBe('/ask');
    }
    expect(isAskConversationSurface('/ask')).toBe(true);
    expect(isAskConversationSurface('/')).toBe(true);
    expect(isAskConversationSurface('/saved')).toBe(false);
    expect(
      isPlainClick({ button: 0, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false }),
    ).toBe(true);
    expect(
      isPlainClick({ button: 0, metaKey: true, ctrlKey: false, shiftKey: false, altKey: false }),
    ).toBe(false);
  });
});
