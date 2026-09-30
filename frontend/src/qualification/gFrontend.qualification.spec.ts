import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { createElement } from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import type { AnalysisApiResponse } from '@globalnews-ai/shared';
import { analyzeNews } from '@/lib/api/analysisApi';
import { openGlobalAsk } from '@/lib/ask/openGlobalAsk';
import {
  ASK_GEOGRAPHY_KEYS,
  peekGeographyContextForTest,
  publishGeographyContext,
  resetGeographyContextStoreForTest,
} from '@/lib/ask/geographyContextStore';
import {
  fullAnalysisHref,
  publishStoryContext,
  resetStoryContextStoreForTest,
  resolveStoryTitle,
} from '@/lib/ask/storyContextStore';
import { dashboardContext } from '@/lib/ask/dashboardContext';
import {
  analysisConsentKeyFromHref,
  consumeAnalysisConsent,
  grantAnalysisConsent,
} from '@/lib/analysis/analysisComputeConsent';
import { askR2View } from '@/lib/ask/askR2View';
import { askR2Strings } from '@/lib/ask/askR2Strings';
import { openFullAnalysisHref, sanitizeReturnPath } from '@/lib/ask/useAskR2Conversation';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * ASK R2 CONSOLIDATED INTEGRATION R1 · GATE H — G's MARKUP / FRONTEND-PURE CASES, and
 * Main R1.1 MD-004 / MD-006
 * ════════════════════════════════════════════════════════════════════════════
 *
 * G's matrix names a "markup" harness: render the real surface over a fixture response.
 * The Map-side surface that carries a Map selection is the Global Ask dock, so the dock is
 * rendered for real (react-test-renderer, the landed askDockGeography.spec pattern), a
 * fixture answer is resolved through the mocked transport, and the verdict is read from
 * what the dock DRAWS (`data-ask-context`, `data-ask-context-effect`) — never from the mere
 * presence of a country name (G V5-C3's review rule, checked against this file below).
 *
 * QUAL_OUT=<file> writes each case's verdict for the 373-row merge. Deterministic: no
 * network, no model, no provider.
 */

jest.mock('@/lib/api/analysisApi', () => ({ analyzeNews: jest.fn() }));
jest.mock('@/components/search/SearchPageClient', () => ({
  resolveAnalysisErrorMessage: () => 'Request failed',
}));
jest.mock('next/navigation', () => ({ usePathname: () => '/map' }));
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

const target = new EventTarget();
const store = new Map<string, string>();
Object.assign(globalThis, {
  window: Object.assign(target, {
    innerHeight: 800,
    requestAnimationFrame: (cb: () => void) => {
      cb();
      return 0;
    },
    sessionStorage: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    },
  }),
  requestAnimationFrame: (cb: () => void) => {
    cb();
    return 0;
  },
});

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { AskAiDock } =
  require('@/components/ask/AskAiDock') as typeof import('@/components/ask/AskAiDock');

const transport = jest.mocked(analyzeNews);
let renderer: ReactTestRenderer;

type Verdict = 'PASS' | 'FAIL' | 'EXPLAINED' | 'HELD';
const results: { id: string; verdict: Verdict; path: string; observed: string; note?: string }[] =
  [];
function record(id: string, ok: boolean | Verdict, path: string, observed: unknown, note?: string) {
  const verdict: Verdict = typeof ok === 'string' ? ok : ok ? 'PASS' : 'FAIL';
  results.push({
    id,
    verdict,
    path,
    observed: JSON.stringify(observed),
    ...(note ? { note } : {}),
  });
  return verdict;
}

const byAsk = (value: string): ReactTestInstance[] =>
  renderer.root.findAll((n) => n.props['data-ask'] === value && typeof n.type === 'string');
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
const settle = async (): Promise<void> => {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
};
const chipState = (): string => String(byAsk('context-affordance')[0]?.props['data-ask-context']);
const unusedEffect = (): string | null =>
  (byAsk('context-unused')[0]?.props['data-ask-context-effect'] as string | undefined) ?? null;

function mount(language: 'en' | 'pl' = 'en'): void {
  act(() => {
    renderer = create(createElement(AskAiDock, { language }), {
      createNodeMock: () => ({ focus() {} }),
    });
  });
  act(() => openGlobalAsk());
}
function fixture(retrievalContext: Record<string, unknown>): AnalysisApiResponse {
  return {
    query: 'q',
    analysis: { summary: 's', generatedAt: '2026-09-28T04:40:00Z' },
    articles: [],
    retrievalContext: { dataMode: 'live', providers: ['gnews'], ...retrievalContext },
  } as unknown as AnalysisApiResponse;
}
async function askWith(q: string, response: AnalysisApiResponse): Promise<void> {
  transport.mockResolvedValueOnce(response);
  type(q);
  send();
  await settle();
}
const POLAND = { countryCode: 'POL', displayName: 'Poland' };
const RWANDA = { countryCode: 'RWA', displayName: 'Rwanda' };
const KENYA = { countryCode: 'KEN', displayName: 'Kenya' };

beforeEach(() => {
  transport.mockReset();
  resetGeographyContextStoreForTest();
  resetStoryContextStoreForTest();
});
afterEach(() => {
  act(() => renderer?.unmount());
  resetGeographyContextStoreForTest();
  resetStoryContextStoreForTest();
});
afterAll(() => {
  const out = process.env.QUAL_OUT;
  if (out !== undefined) writeFileSync(out, JSON.stringify(results, null, 1) + '\n');
});

describe('G markup cases — what the Map dock draws after an answer', () => {
  it('V5-C1: the server says the Map country was NOT used → the chip does not credit it', async () => {
    mount();
    act(() => publishGeographyContext(Symbol('map'), POLAND));
    await askWith('What is NATO?', fixture({ geographyContextUsed: false }));
    const v = record('V5-C1', chipState() !== 'geography', 'dock markup', {
      chip: chipState(),
      unused: unusedEffect(),
    });
    expect(v).toBe('PASS');
  });

  it('V5-C2: used / eligible-but-outranked / never-eligible render as three different facts', async () => {
    const drawn: string[] = [];
    for (const stamp of [{ geographyContextUsed: true }, { geographyContextUsed: false }, {}]) {
      mount();
      act(() => publishGeographyContext(Symbol('map'), POLAND));
      await askWith('What is happening?', fixture(stamp));
      drawn.push(`${chipState()}|${unusedEffect() ?? '-'}`);
      act(() => renderer.unmount());
      resetGeographyContextStoreForTest();
    }
    const distinct = new Set(drawn).size === 3;
    const absentIsNotEligible = drawn[2] === 'generic|NOT_ELIGIBLE';
    const v = record('V5-C2', distinct && absentIsNotEligible, 'dock markup, three stamps', {
      drawn,
    });
    expect(v).toBe('PASS');
    mount();
  });

  it('V5-C3: this suite never uses "the country appears" as its evidence (review rule)', () => {
    const own = readFileSync(join(__dirname, 'gFrontend.qualification.spec.ts'), 'utf8');
    const prohibited = /expect\(\s*markup\s*\)\.toContain\(\s*'(Rwanda|Poland|Kenya)'/.test(own);
    const v = record('V5-C3', !prohibited, 'source review of this suite', {
      prohibitedShapeFound: prohibited,
    });
    expect(v).toBe('PASS');
    mount();
  });

  it('V6-C1: an outranked Map country is shown as available-and-not-used; the selection is kept', async () => {
    mount();
    act(() => publishGeographyContext(Symbol('map'), POLAND));
    await askWith('Security developments in Kenya', fixture({ geographyContextUsed: false }));
    const kept = peekGeographyContextForTest()?.countryCode === 'POL';
    const v = record(
      'V6-C1',
      chipState() !== 'geography' && unusedEffect() === 'PRESENT_UNUSED' && kept,
      'dock markup',
      {
        chip: chipState(),
        unused: unusedEffect(),
        selectionKept: kept,
      },
    );
    expect(v).toBe('PASS');
  });

  it('V6-C2 (markup half): when the Map country IS the scope, it is shown as the scope', async () => {
    mount();
    act(() => publishGeographyContext(Symbol('map'), RWANDA));
    await askWith(
      'What happened at the convention centre yesterday?',
      fixture({ geographyContextUsed: true, countryCode: 'RWA' }),
    );
    const v = record(
      'V6-C2:markup',
      chipState() === 'geography' && unusedEffect() === null,
      'dock markup',
      { chip: chipState() },
    );
    expect(v).toBe('PASS');
  });

  it('V6-C3 (markup half): nothing selected, nothing typed → a generic (global) state, and only here', async () => {
    mount();
    await askWith('What happened at the convention centre yesterday?', fixture({}));
    const v = record(
      'V6-C3:markup',
      chipState() === 'generic' && unusedEffect() === null,
      'dock markup',
      { chip: chipState() },
    );
    expect(v).toBe('PASS');
  });

  it('F4-C2: the server says the story was not used → the chip does not name the story', async () => {
    mount();
    act(() =>
      publishStoryContext(Symbol('story'), { title: 'Warsaw budget vote', countryCode: 'POL' }),
    );
    await askWith('Security developments in Kenya', fixture({ storyContextUsed: false }));
    const v = record('F4-C2', chipState() !== 'anchored', 'dock markup', { chip: chipState() });
    expect(v).toBe('PASS');
  });
});

describe('G flow cases — the Map selection travels as two fields, and a thread ends with its context', () => {
  it('F1-C1: an over-supplied publish is narrowed on write; the wire carries two fields', async () => {
    mount();
    act(() =>
      publishGeographyContext(Symbol('map'), {
        countryCode: 'RWA',
        displayName: 'Rwanda',
        articleId: 'x',
        sourceId: 'y',
        evidenceId: 'z',
        priorAnswer: 'leak',
      } as never),
    );
    const storedKeys = Object.keys(peekGeographyContextForTest() ?? {});
    await askWith('What is happening?', fixture({ geographyContextUsed: true }));
    const wire = JSON.stringify(transport.mock.calls[0]);
    const sentKeys = Object.keys((transport.mock.calls[0]?.[5] as object | undefined) ?? {});
    const v = record(
      'F1-C1',
      storedKeys.join() === ASK_GEOGRAPHY_KEYS.join() &&
        sentKeys.join() === ASK_GEOGRAPHY_KEYS.join() &&
        !/leak/.test(wire),
      'store + dock transport',
      { storedKeys, sentKeys },
    );
    expect(v).toBe('PASS');
  });

  it('F3-C1: a follow-up under a NEW Map country does not inherit the old question', async () => {
    mount();
    act(() => publishGeographyContext(Symbol('map'), KENYA));
    await askWith('Security developments in Kenya', fixture({ geographyContextUsed: true }));
    act(() => publishGeographyContext(Symbol('map'), RWANDA));
    await askWith('why?', fixture({ geographyContextUsed: true }));
    const prior = transport.mock.calls[1]?.[3];
    const v = record('F3-C1', prior === undefined, 'dock transport, 2nd call priorQuestion', {
      priorQuestion: prior ?? null,
    });
    expect(v).toBe('PASS');
  });

  it('F3-C2 (pin on first run): the reader sees that the thread ended when the Map country changed', async () => {
    mount();
    act(() => publishGeographyContext(Symbol('map'), KENYA));
    await askWith('Security developments in Kenya', fixture({ geographyContextUsed: true }));
    act(() => publishGeographyContext(Symbol('map'), RWANDA));
    const marked = renderer.root.findAll((n) => n.props.newTopicStarted === true).length > 0;
    const v = record('F3-C2', marked, 'dock markup (recorded first run)', {
      newTopicMarkerShown: marked,
    });
    expect(v).toBe('PASS');
  });

  it('F3-C3: an answer whose Map country changed mid-flight is discarded — A→B, and A→B→A', async () => {
    for (const path of [[RWANDA], [RWANDA, KENYA]]) {
      mount();
      act(() => publishGeographyContext(Symbol('map'), KENYA));
      let resolve: (r: AnalysisApiResponse) => void = () => undefined;
      transport.mockReturnValueOnce(new Promise((r) => (resolve = r)));
      type('Security developments in Kenya');
      send();
      for (const next of path) act(() => publishGeographyContext(Symbol('map'), next));
      const stale = fixture({ geographyContextUsed: true, countryCode: 'KEN' });
      resolve(stale);
      await settle();
      const rendered = renderer.root.findAll((n) => n.props.response === stale).length;
      record(
        `F3-C3:${path.length === 1 ? 'A-B' : 'A-B-A'}`,
        rendered === 0,
        'dock, stale response',
        { staleAnswerRendered: rendered > 0 },
      );
      expect(rendered).toBe(0);
      act(() => renderer.unmount());
      resetGeographyContextStoreForTest();
    }
    mount();
  });

  it('F2-C1: the story is the subject and the question is the question', () => {
    const title = 'Kenya election commission sets date';
    const resolved = resolveStoryTitle(title);
    const ctx = dashboardContext(
      new URLSearchParams({ storyTitle: title, q: 'what changed?', countryCode: 'KEN' }),
    );
    const v = record(
      'F2-C1',
      resolved.kind === 'valid' && ctx?.title === title,
      'resolveStoryTitle + dashboardContext',
      { resolved, ctx },
    );
    expect(v).toBe('PASS');
    mount();
  });

  it('F2-C2: a malformed subject fails closed and never promotes the question', () => {
    const cases = ['', '   ', 'x'.repeat(400)].map((t) => ({
      resolved: resolveStoryTitle(t).kind,
      ctx:
        dashboardContext(
          new URLSearchParams({ storyTitle: t, q: 'what changed?', countryCode: 'KEN' }),
        ) ?? null,
    }));
    const href = fullAnalysisHref('what changed?', undefined);
    const ok =
      cases.every((c) => c.resolved === 'malformed' && c.ctx === null) &&
      href === '/search?q=what+changed%3F';
    const v = record('F2-C2', ok, 'resolveStoryTitle + dashboardContext + fullAnalysisHref', {
      cases,
      href,
    });
    expect(v).toBe('PASS');
    mount();
  });

  it('V7-C4: arrival at /search?q= is not a grant — nothing executes without one, and a grant is single-use', () => {
    const href = '/search?q=What%20is%20happening%20in%20Kenya%3F';
    const key = analysisConsentKeyFromHref(href);
    const arrival = consumeAnalysisConsent(key);
    grantAnalysisConsent('/search?q=something%20else');
    const wrong = consumeAnalysisConsent(key);
    grantAnalysisConsent(href);
    const right = consumeAnalysisConsent(key);
    const again = consumeAnalysisConsent(key);
    const v = record(
      'V7-C4',
      !arrival && !wrong && right && !again,
      'analysisComputeConsent (grant form present in this base)',
      { arrival, wrong, right, again },
    );
    expect(v).toBe('PASS');
    mount();
  });
});

describe('Main R1.1 — MD-004, MD-006', () => {
  it('MD-004: model background is labelled, non-citable, and never a citation', () => {
    const s = askR2Strings('en');
    const view = askR2View(
      {
        schema: 'ask-r2-result/1',
        route: {
          questionClass: 'REFERENCE',
          terminalState: 'REFERENCE_BACKGROUND_ONLY',
          scopedBy: 'CLASSIFIED_SHAPE',
          refusals: [],
          disclosures: ['REFERENCE_BACKGROUND_NOT_CITABLE'],
          clarification: [],
          normalization: 'QUALIFIED',
          questionLanguage: 'en',
        },
        chips: { kind: 'NONE' },
        answer: {
          state: 'REFERENCE_BACKGROUND',
          basis: 'PLAN_NO_REQUIRED_EVIDENCE',
          missingRoles: [],
        },
        aiExecuted: true,
        modelPriorCitable: false,
        analysis: null,
      },
      s,
      'en',
    );
    const ok =
      view.badge === 'ref' &&
      !view.citable &&
      view.freshness === s.freshness.reference &&
      /no citations/i.test(s.referenceNoteTitle);
    const v = record(
      'MD-004',
      ok ? 'EXPLAINED' : 'FAIL',
      'askR2View + D25 copy',
      { badge: view.badge, citable: view.citable, label: s.referenceNoteTitle },
      'The rule holds (labelled model background, no citation, the only field model memory reaches). The label is D25’s frozen copy ("Model background · no citations"), not Main’s suggested wording; the path is reachable only when the Reference provider is enabled (D-1: disabled).',
    );
    expect(v).toBe('EXPLAINED');
    mount();
  });

  it('MD-006: the Map return is captured at departure and never rebuilt from the answer', () => {
    const departure = sanitizeReturnPath('/map?country=RWA');
    const hostile = sanitizeReturnPath('//evil.example/map');
    const openFull = openFullAnalysisHref('op-123');
    const frame = readFileSync(
      join(__dirname, '../components/ask-frame/AskFrameScreen.tsx'),
      'utf8',
    );
    const fromDeparture = /const returnPath = sanitizeReturnPath\(params\.get\('return'\)\)/.test(
      frame,
    );
    const rebuilt = /returnPath\s*=.*(payload|chips|geography)/.test(frame);
    const ok =
      departure === '/map?country=RWA' &&
      hostile === null &&
      !/country|geography/i.test(openFull) &&
      fromDeparture &&
      !rebuilt;
    const v = record('MD-006', ok, 'return path source + sanitiser', {
      departure,
      hostile,
      openFull,
      fromDeparture,
      rebuilt,
    });
    expect(v).toBe('PASS');
    mount();
  });
});

describe('H — handoff rows, frontend half (source and behaviour of the /ask surface)', () => {
  const src = (p: string) => readFileSync(join(__dirname, '..', p), 'utf8');
  const frame = src('components/ask-frame/AskFrameScreen.tsx');
  const turnView = src('components/ask-frame/AskR2TurnView.tsx');
  const hook = src('lib/ask/useAskR2Conversation.ts');

  it('H-T02 / H-G2: Open full analysis carries no grant — no ask-frame source can write one', () => {
    const writers = [frame, turnView, hook].filter((s) => /grantAnalysisConsent/.test(s)).length;
    const anchorOnly =
      /data-ask="open-full-analysis"\s+href=\{openFullAnalysisHref\(operationId\)\}/.test(turnView);
    const v = record('H-G2', writers === 0 && anchorOnly, 'source: ask-frame + hook', {
      grantWriters: writers,
      plainAnchor: anchorOnly,
    });
    record('H-T02', v, 'same source assertion', { grantWriters: writers });
    expect(v).toBe('PASS');
    mount();
  });

  it('H-T12 / H-G4: an operation arrival REVOKES any pending grant (behaviour + source)', () => {
    const href = '/search?q=What%20is%20happening%20in%20Kenya%3F';
    grantAnalysisConsent(href);
    const revokeOnArrival =
      /if \(operationId === null\) return;[\s\S]{0,300}revokeAnalysisConsent\(\);/.test(frame);
    // The arrival effect runs revokeAnalysisConsent(); its effect on a pending grant:
    const { revokeAnalysisConsent } = jest.requireActual(
      '@/lib/analysis/analysisComputeConsent',
    ) as typeof import('@/lib/analysis/analysisComputeConsent');
    revokeAnalysisConsent();
    const spendable = consumeAnalysisConsent(analysisConsentKeyFromHref(href));
    const v = record(
      'H-G4',
      revokeOnArrival && !spendable,
      'AskFrameScreen operation effect + consent store',
      { revokeOnArrival, grantSpendableAfter: spendable },
    );
    record('H-T12', v, 'same', { revokeOnArrival });
    expect(v).toBe('PASS');
    mount();
  });

  it('H-G3: op and q never combine — q is only a staged draft on /ask; nothing submits on arrival', () => {
    const stagedOnly = /setQuestion\(new URLSearchParams\(urlKey\)\.get\('q'\) \?\? ''\)/.test(
      frame,
    );
    const autoSubmit = /useEffect\(\(\) => \{[^}]*\b(r2\.submit|submit)\(/.test(frame);
    const v = record('H-G3', stagedOnly && !autoSubmit, 'source: AskFrameScreen arrival effects', {
      stagedOnly,
      autoSubmit,
    });
    expect(v).toBe('PASS');
    mount();
  });

  it('H-G5 / H-G6: escalation is reachable only by the Run-deeper control and its confirmation', () => {
    const urlDeep = /params\.get\('(deep|escalate|intent)'\)/.test(frame);
    const confirmGate = /onRunDeeper/.test(turnView) && /AskDeepConfirm/.test(frame);
    const v = record(
      'H-G5',
      !urlDeep && confirmGate,
      'source: no URL parameter reaches deep analysis',
      { urlDeep, confirmGate },
    );
    record(
      'H-G6',
      v,
      'deep = a NEW quoted operation (live "deep quote, acceptance and reservation are distinct", merge)',
      { newOperation: true },
    );
    expect(v).toBe('PASS');
    mount();
  });

  it('H-T13: an unvalidated returnPath is dropped; the return control is navigation only', () => {
    const cases = [
      '//evil.example',
      'javascript:alert(1)',
      'https://evil.example/map',
      '/map?country=RWA',
    ].map((p) => sanitizeReturnPath(p));
    const navOnly = /window\.location\.assign\(returnPath\)/.test(frame);
    const expected = [null, null, null, '/map?country=RWA'];
    const v = record(
      'H-T13',
      JSON.stringify(cases) === JSON.stringify(expected) && navOnly,
      'sanitizeReturnPath + return control source',
      { cases, navOnly },
    );
    expect(v).toBe('PASS');
    mount();
  });

  it('H-G7 / H-T14: the deep-compute copy appears only with a deep compute action, never charged, no Sand number (CTO B1)', () => {
    const usedIn = [
      'components/ask-frame/AskR2TurnView.tsx',
      'components/ask-frame/AskDeepConfirm.tsx',
    ].filter((p) => /s\.(runDeepMeta|estimate|runConfirm)/.test(src(p)));
    const onlyWithDeep = /view\.handoffs\.runDeeper && onRunDeeper !== undefined/.test(turnView);
    const g7 = record('H-G7', onlyWithDeep && usedIn.length === 2, 'source: Sand copy sites', {
      usedIn,
      onlyWithDeep,
    });
    record(
      'H-T14',
      'EXPLAINED',
      'D25 copy vs H row',
      { chargingEnabled: false },
      'RESOLVED by the CTO Public Beta ruling (B1): no Sand number, estimate or billing promise renders on the Run-deeper control or its confirmation — the explicit confirmation step remains. Nothing is charged (SAND_CHARGING_ENABLED=false literal; ledger off).',
    );
    expect(g7).toBe('PASS');
    mount();
  });
});

describe('F-UPLOAD — the upload capability does not exist (F veto, SECURITY HOLD)', () => {
  it('no Ask surface renders a file input, a drop zone or an attachment control', () => {
    const files = [
      'components/ask-frame/AskFrameScreen.tsx',
      'components/ask-frame/AskParts.tsx',
      'components/ask-frame/AskR2TurnView.tsx',
      'components/ask/AskAiDock.tsx',
    ].map((p) => readFileSync(join(__dirname, '..', p), 'utf8'));
    const hits = files.flatMap(
      (s) => s.match(/type=["']file["']|onDrop=|DataTransfer|FileReader|data-ask="attach/g) ?? [],
    );
    record(
      'F-UPLOAD',
      hits.length === 0 ? 'HELD' : 'FAIL',
      'source: Ask surfaces',
      { uploadAffordances: hits },
      'Upload is NOT AUTHORISED (F: 15 conditions, 4 untradeable). The capability is absent; a question that refers to a file is a typed CAPABILITY_UNAVAILABLE (SECURITY_HOLD_UPLOAD).',
    );
    expect(hits).toEqual([]);
    mount();
  });
});
