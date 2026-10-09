import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { act, create, type ReactTestRenderer, type ReactTestInstance } from 'react-test-renderer';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { AnalysisSourceRef, NewsAnalysisResult } from '@globalnews-ai/shared';

/**
 * ASK DESIGN COMPLETENESS R1 — the original Claude Design package
 * (GLOBALNEWSAI-ASK-READING-EXPERIENCE-R1-DESIGN, SHA-256 e06a8278…3bf1), implemented on the
 * Production Reading frontend 270fab8. These are the behaviours the Design adds, each pinned:
 * the tokens, the header, the welcome group, the conversations list, the toolbar (and what is
 * CAPABILITY-BLOCKED), the Sources panel / sheet, the answer's depth (inline uncertainty, More
 * detail, jump links), the footer line and the reopened-answer date line.
 */

jest.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(''),
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), refresh: jest.fn() }),
  usePathname: () => '/ask',
}));
/* next/link schedules an idle-callback prefetch the node test environment has no `self` for. */
jest.mock('next/link', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const react = require('react') as typeof import('react');
  return {
    __esModule: true,
    default: ({ prefetch: _prefetch, ...props }: Record<string, unknown>) => react.createElement('a', props),
  };
});
const threads = jest.fn();
jest.mock('@/lib/api/askV2Api', () => {
  const actual = jest.requireActual('@/lib/api/askV2Api');
  return { ...actual, askV2Api: { ...actual.askV2Api, threads: () => threads() } };
});

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { AskConversations } = require('./AskConversations') as typeof import('./AskConversations');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { AskNavProvider, useAskNav } = require('@/components/ask-nav/AskNavShell') as typeof import('@/components/ask-nav/AskNavShell');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { AskSourcesList, ASK_SIDE_PANEL_QUERY } = require('./AskSourcesPanel') as typeof import('./AskSourcesPanel');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { AskAnswerDetail } = require('@/components/ask/AskAnswerDetail') as typeof import('@/components/ask/AskAnswerDetail');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { AskAnswerProse } = require('@/components/ask/AskAnswerProse') as typeof import('@/components/ask/AskAnswerProse');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { askR2Strings } = require('@/lib/ask/askR2Strings') as typeof import('@/lib/ask/askR2Strings');

const root = join(__dirname, '..', '..');
const read = (...p: string[]) => readFileSync(join(root, ...p), 'utf8');
const code = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

const sources = [
  { articleId: 'a1', title: 'One', publisher: 'P1', url: 'https://one.example/a', publishedAt: '2026-10-05T10:00:00.000Z', publishedAtBasis: 'publisher' },
  { articleId: 'a2', title: 'Two', publisher: 'P2', url: 'https://two.example/b', publishedAt: null },
] as unknown as AnalysisSourceRef[];

describe('tokens — the Design roles, light and navy, scoped to the standalone Ask', () => {
  const css = read('components', 'ask-frame', 'askDashboard.module.css');
  it('carries tokens.css values for both sets on the Ask theme scope', () => {
    const block = css.slice(css.indexOf('.page[data-ask-standalone] {'));
    /* CTO NAVY CORRECTION — the alternate is visibly navy blue, not the package's near-black
       #080B12 (tertiary text lifted to #9AABC0 for 4.5:1 on the #163A5F surface). */
    expect(block).toMatch(/--ad-bg: #102a43;/);
    expect(block).toMatch(/--ad-bg-2: #0d2238;/);
    expect(block).toMatch(/--ad-surface: #163a5f;/);
    expect(block).toMatch(/--ad-surface-2: #1d466c;/);
    expect(block).toMatch(/--ad-q-bg: #173b5b;/);
    expect(block).toMatch(/--ad-line: #2d5575;/);
    expect(block).toMatch(/--ad-line-strong: #3a6789;/);
    expect(block).toMatch(/--ad-ink: #f3f7fb;/);
    expect(block).toMatch(/--ad-ink-2: #c1d0dc;/);
    expect(block).toMatch(/--ad-ink-3: #9aabc0;/);
    expect(block).toMatch(/--ad-accent: #6c93ff;/);
    expect(block.slice(0, block.indexOf('}'))).not.toMatch(/--ad-bg: #080b12;/);
    expect(css).toMatch(/\[data-gna-theme='light'\][\s\S]*--ad-bg: #faf9f7;[\s\S]*--ad-accent: #2d7077;[\s\S]*--ad-ink: #292923;/);
    expect(css).toMatch(/prefers-color-scheme: light[\s\S]*\[data-gna-theme='system'\]/);
  });
  it('maps the accepted reading roles onto the Design roles (no second literal palette)', () => {
    expect(css).toMatch(/--ask-read-ink: var\(--ad-ink/);
    expect(css).toMatch(/--ask-read-answer-bg: var\(--ad-surface/);
  });
  it('the desktop layout is the persistent 280 conversations column + reading column + 380 panel', () => {
    expect(css).toMatch(/grid-template-columns: var\(--ad-history-w, 280px\) minmax\(0, 1fr\) auto;/);
    expect(css).toMatch(/--ad-reading-max: 660px;/);
    expect(css).toMatch(/width: var\(--ad-sources-w, 380px\);/);
    expect(ASK_SIDE_PANEL_QUERY).toBe('(min-width: 1024px) and (orientation: landscape), (min-width: 1101px)');
  });
});

describe('header and welcome group (A1/A2, F2)', () => {
  const frame = code(read('components', 'ask-frame', 'AskFrameScreen.tsx'));
  it('the header is menu · static 24 px mark + the canonical name · New', () => {
    expect(frame).toMatch(/<AskEmblemMark \/>[\s\S]*\{r2s\.askTitle\}/);
    /* R2 CTO correction: the control reads "New question" and is disabled while Ask is empty. */
    expect(frame).toMatch(/data-ask="new-question"\s+onClick=\{newQuestion\}\s+disabled=\{entryState \|\| isPending\}/);
    const emblem = code(read('components', 'ask-frame', 'AskEmblem.tsx'));
    expect(emblem).toMatch(/<AskEmblemSvg id=\{id\} size=\{24\} still \/>/);
    expect(emblem).toMatch(/still \? \{ style: \{ animation: 'none' \} \} : \{\}/);
  });
  it('the welcome group is headline, support line and a quiet example; typing collapses it', () => {
    expect(frame).toMatch(/data-ask-welcome=""[\s\S]*sevenStrings\.composerHint[\s\S]*r2s\.read\.welcomeSupport[\s\S]*r2s\.read\.welcomeExample/);
    expect(frame).toMatch(/const typing = entryState && \(composerFocused \|\| question\.trim\(\) !== ''\);/);
    expect(frame).toMatch(/data-ask-typing=\{typing \? 'true' : undefined\}/);
    expect(read('components', 'ask-frame', 'askDashboard.module.css')).toMatch(
      /\.frame\[data-ask-typing='true'\] \.welcomeCollapsible \{\s*max-height: 0;\s*opacity: 0;/,
    );
  });
  it('the placeholder is "Ask anything…" before the first question and "Ask a follow-up…" after', () => {
    expect(frame).toMatch(/placeholder=\{entryState \? r2s\.read\.placeholderFirst : r2s\.read\.placeholderFollowUp\}/);
    expect(askR2Strings('en').read.placeholderFirst).toBe('Ask anything…');
  });
  it('a failed Send is said in the conversation with Try again; the draft stays in the composer', () => {
    expect(frame).toMatch(/data-ask="failure" role="alert"[\s\S]*data-ask="retry-kept"[\s\S]*data-ask="try-again" onClick=\{\(\) => void ask\(\)\}/);
    expect(frame).toMatch(/setQuestion\(draft\);\s*setRetryKept\(true\);/);
  });
});

describe('conversations (D4 drawer · F2 column) — real reads only, no dummy controls', () => {
  let renderer: ReactTestRenderer;
  const g = globalThis as Record<string, unknown>;
  beforeAll(() => {
    g.window = globalThis;
  });
  afterEach(() => act(() => renderer?.unmount()));

  function Harness({ account }: { readonly account: 'signed-in' | 'signed-out' }) {
    const nav = useAskNav();
    if (nav.account !== account) nav.setAccount(account);
    return createElement(AskConversations, { locale: 'en', currentThreadId: 't-1' });
  }
  const mount = async (account: 'signed-in' | 'signed-out') => {
    await act(async () => {
      renderer = create(createElement(AskNavProvider, null, createElement(Harness, { account })));
    });
    await act(async () => undefined);
  };
  const byAsk = (v: string): ReactTestInstance[] =>
    renderer.root.findAll((n) => n.props['data-ask'] === v && typeof n.type === 'string');

  it('signed out: says so, and never reads the threads endpoint', async () => {
    threads.mockReset();
    await mount('signed-out');
    expect(threads).not.toHaveBeenCalled();
    expect(byAsk('conversations-note')).toHaveLength(1);
    expect(byAsk('conversations-new')).toHaveLength(1);
  });

  it('signed in: one read, Today/Earlier groups, the current conversation marked, Delete per row, no Rename', async () => {
    threads.mockReset();
    const now = Date.now();
    threads.mockResolvedValue({
      ok: true,
      value: [
        { id: 't-1', language: 'en', returnPath: null, createdAt: new Date(now).toISOString(), lastActiveAt: new Date(now).toISOString(), turnCount: 1, firstQuestion: 'First question', firstQuestionTruncated: false, latestQuestion: 'First question', latestQuestionTruncated: false, latestTurnId: 'tu', latestOperationId: 'op-1', latestState: 'COMPLETED' },
        { id: 't-2', language: 'en', returnPath: null, createdAt: '2026-01-02T10:00:00Z', lastActiveAt: '2026-01-02T10:00:00Z', turnCount: 2, firstQuestion: 'Older question', firstQuestionTruncated: false, latestQuestion: 'Older question', latestQuestionTruncated: false, latestTurnId: 'tu2', latestOperationId: 'op-2', latestState: 'COMPLETED' },
      ],
    });
    await mount('signed-in');
    expect(threads).toHaveBeenCalledTimes(1);
    const current = renderer.root.findAll((n) => n.props['aria-current'] === 'page' && typeof n.type === 'string');
    expect(current).toHaveLength(1);
    expect(byAsk('conversations-search')).toHaveLength(1);
    const html = JSON.stringify(renderer.toJSON());
    expect(html).not.toMatch(/Rename|Options for/);
    /* REASON TO RETURN R1 · G7 — Delete is a real endpoint now: one control per row */
    expect(byAsk('conversation-delete')).toHaveLength(2);
  });

  it('REASON TO RETURN R1 — Delete is backed by DELETE /ask-v2/threads/:id; Rename still has no endpoint', () => {
    const api = code(read('lib', 'api', 'askV2Api.ts'));
    expect(api).toMatch(/threads\/\$\{encodeURIComponent\(threadId\)\}`,\s*'DELETE'/);
    expect(api).not.toMatch(/threads\/\$\{[^}]*\}`,\s*'PATCH'/);
    const list = code(read('components', 'ask-frame', 'AskConversations.tsx'));
    expect(list).toMatch(/askV2Api\.deleteThread\(id\)/);
    /* deleting is confirmed first */
    expect(list).toMatch(/window\.confirm\(/);
    expect(list).not.toMatch(/rename/i);
  });
});

describe('the toolbar (B1, C1–C5) — only real capability renders', () => {
  const toolbar = code(read('components', 'ask-frame', 'AskAnswerToolbar.tsx'));
  it('is role="toolbar": Copy · Share · Save · Sources (n) · More, in that order', () => {
    /*
      SUPERSEDED BY CLAUDE DESIGN R3 §10 (D06 revision 2) · this read
      `/data-ask="turn-actions" role="toolbar"/`, which held only while the two attributes sat on
      one source line. R3 §10 gave the element a ref, a key handler and two state attributes, so
      its attributes are now one per line. The assertion was coupled to the formatting, not to the
      guarantee; both attributes are still asserted, and the row is still the only `role="toolbar"`
      in the file — "do not create a second toolbar".
    */
    expect(toolbar).toMatch(/data-ask="turn-actions"/);
    expect(toolbar).toMatch(/role="toolbar"/);
    expect(toolbar.match(/role="toolbar"/g)).toHaveLength(1);
    /* R3 §10 · one line at every width, and Follow is no longer one of the row's actions. */
    expect(toolbar).not.toMatch(/flex-wrap/);
    expect(toolbar).toMatch(/data-ask="turn-continuity"/);
    const order = ['<AskTurnCopy', 'data-ask="share"', '<AskTurnSave', 'data-ask="open-sources"', 'data-ask="more"'].map((n) => toolbar.indexOf(n));
    expect(order.every((i) => i > -1)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });
  it('More holds Refresh reporting (a new explicit turn) and Use in a briefing; no Download / remembered preferences', () => {
    expect(toolbar).toMatch(/data-ask="refresh-reporting-action"[\s\S]*onRefresh\(turn\.question\)/);
    expect(toolbar).toMatch(/label=\{r\.useInBriefing\}/);
    expect(toolbar).not.toMatch(/download|remember/i);
  });
  it('Saved feedback is the server-confirmed bookmark with Undo (the real unbookmark)', () => {
    const save = code(read('components', 'ask-frame', 'AskTurnSave.tsx'));
    expect(save).toMatch(/if \(!wasSaved && outcome\.value\.bookmarked\)/);
    expect(save).toMatch(/action: \{ label: read\.undo, run: \(\) => void toggle\(true\) \}/);
  });
});

describe('Sources (C1, C6, F3)', () => {
  it('each item: number, title, publisher · date or "Date not provided", Open original (governed href)', () => {
    const html = renderToStaticMarkup(createElement(AskSourcesList, { sources, locale: 'en' }));
    expect(html).toMatch(/P1 · Published 5 Oct 2026, 10:00 UTC/);
    expect(html).toMatch(/P2 · Date not provided/);
    expect(html.match(/data-ask="source-open" href="https:\/\/(?:one|two)\.example\/[ab]" target="_blank" rel="noopener noreferrer"/g)).toHaveLength(2);
  });
  it('≥1024 is a non-modal side panel; below is the modal sheet; "About this answer" is collapsed', () => {
    const panel = code(read('components', 'ask-frame', 'AskSourcesPanel.tsx'));
    expect(panel).toMatch(/data-ask="sources-panel"[\s\S]*aria-labelledby=\{titleId\}/);
    expect(panel).not.toMatch(/data-ask="sources-panel"[^>]*aria-modal/);
    expect(panel).toMatch(/<details data-ask="about-answer"/);
    expect(panel).toMatch(/window\.matchMedia\(ASK_SIDE_PANEL_QUERY\)\.matches/);
  });
});

describe('answer depth (B1–B3, B6) — validated fields only, nothing generated', () => {
  const analysis = {
    sources,
    uncertainties: [{ description: 'one outlet reports tentative terms', sourceArticleIds: ['a2'] }],
    context: [{ claim: 'Earlier rounds stalled.', sourceArticleIds: ['a1'] }],
    relevance: [],
    affectedParties: [{ party: 'Importers', partyType: 'group', effect: 'face delays.', sourceArticleIds: ['a1'] }],
    watchNext: [],
  } as unknown as NewsAnalysisResult;

  it('an uncertainty is an inline "Not yet confirmed:" note, never inside the disclosure', () => {
    const html = renderToStaticMarkup(createElement(AskAnswerDetail, { analysis, locale: 'en' }));
    expect(html).toMatch(/data-ask="uncertainty-note"><strong>Not yet confirmed:<\/strong> one outlet reports tentative terms/);
    expect(html.indexOf('uncertainty-note')).toBeLessThan(html.indexOf('more-detail'));
    expect(html).toMatch(/data-citation="2"/);
  });
  it('More detail names what it holds, is collapsed, and keeps its content in the DOM', () => {
    const html = renderToStaticMarkup(createElement(AskAnswerDetail, { analysis, locale: 'en' }));
    expect(html).toMatch(/aria-expanded="false"/);
    expect(html).toMatch(/More detail: background and who is affected/);
    expect(html).toMatch(/data-ask="more-detail-body" hidden="">[\s\S]*Earlier rounds stalled\.[\s\S]*<strong[^>]*>Importers <\/strong>face delays\./);
  });
  it('nothing to show → nothing rendered', () => {
    const empty = { ...analysis, uncertainties: [], context: [], affectedParties: [] } as unknown as NewsAnalysisResult;
    expect(renderToStaticMarkup(createElement(AskAnswerDetail, { analysis: empty, locale: 'en' }))).toBe('');
  });
  it('"In this answer" jump buttons appear for 3+ authored sections, after the opening', () => {
    const long = 'Opening paragraph.\n\n## First\n\nA.\n\n## Second\n\nB.\n\n## Third\n\nC.';
    const html = renderToStaticMarkup(createElement(AskAnswerProse, { source: long, sources: [], language: 'en' }));
    expect(html).toMatch(/<p data-ask="brief-paragraph">Opening paragraph\.<\/p><nav data-ask="answer-nav"/);
    expect(html.match(/data-ask="answer-jump"/g)).toHaveLength(3);
    expect(html.match(/tabindex="-1"/g)).toHaveLength(3);
    const short = renderToStaticMarkup(createElement(AskAnswerProse, { source: 'A.\n\n## One\n\nB.', sources: [], language: 'en' }));
    expect(short).not.toMatch(/answer-nav/);
  });
});

describe('footer line and reopened answer (B1, D7)', () => {
  const turn = code(read('components', 'ask-frame', 'AskR2TurnView.tsx'));
  it('the footer counts this answer’s own records: reports, publishers, newest date', () => {
    expect(turn).toMatch(/new Set\(answerSources\.map\(\(source\) => source\.publisher\)\.filter\(Boolean\)\)\.size/);
    expect(turn).toMatch(/r\.footerReports\(answerSources\.length\)/);
    expect(askR2Strings('en').read.footerReports(4)).toBe('Based on 4 cited reports');
    expect(askR2Strings('en').read.footerPublishers(1)).toBe('from 1 publisher.');
  });
  it('the date line shows only for a stored answer read back, with Refresh reporting', () => {
    expect(turn).toMatch(/reopenedAt == null \|\| Number\.isNaN\(Date\.parse\(reopenedAt\)\)/);
    expect(turn).toMatch(/data-ask="refresh-reporting" onClick=\{\(\) => onRefresh\(turn\.question\)\}/);
    const frame = code(read('components', 'ask-frame', 'AskFrameScreen.tsx'));
    expect(frame).toMatch(/reopenedAt=\{opened\.operation\?\.acceptedAt \?\? null\}/);
    expect(frame.match(/reopenedAt=/g)).toHaveLength(1);
  });
});
