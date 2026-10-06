import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { act, create } from 'react-test-renderer';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  ASK_INPUT_MAX_CHARS,
  ASK_INPUT_TOO_LONG,
  askInputLength,
} from '@globalnews-ai/shared';
import { askV2Api, namedInputRefusal } from '@/lib/api/askV2Api';
import { askQuestionLimitState } from '@/components/ask/AskQuestionLimit';
import { AskSubmittedQuestion, isLongQuestion } from '@/components/ask-frame/AskSubmittedQuestion';
import { askR2Strings } from './askR2Strings';
import { failedTurnCopy } from './askR2View';
import { useAskR2Conversation } from './useAskR2Conversation';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * ASK RETRIEVAL / CONVERSATION R2 — INPUT INTEGRITY (contract §5, gate A)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Observed (Alpha 2026-10-06, ComputeOperation rows read read-only):
 *   06:36:33 UTC  the corridor prompt (1,093 chars) was STORED as exactly 1,000 characters ending
 *                 "Finish with three practica" — every Ask composer had `maxLength={1000}`;
 *   06:36 / 06:45 both corridor prompts were QUOTED as DEEP_ANALYSIS (breadth) and the hook
 *                 rendered the payload-less quote as "Ask is unavailable right now. Nothing was run."
 */
jest.mock('@/lib/api/askV2Api', () => {
  const actual = jest.requireActual('@/lib/api/askV2Api');
  return {
    ...actual,
    askV2Api: { createThread: jest.fn(), submit: jest.fn(), operation: jest.fn() },
  };
});
const api = jest.mocked(askV2Api);

/* The contract's benchmark prompts, verbatim (TEST B and TEST C). */
const TEST_B = `As of 6 October 2026, what developments reported during the previous seven days could materially affect a small business importing goods into Rwanda through either Mombasa, Kenya, or Dar es Salaam, Tanzania?
Investigate port and border operations, transport disruptions, customs or trade-policy changes, fuel costs, and security. Include developments in the EU or Middle East only when evidence establishes a relevant connection to these routes.
Select up to five developments, prioritizing official notices and credible local reporting. Present a concise table showing: development; event date and publication date; affected route or location; reported facts; likely business impact; and a clickable supporting source.
Distinguish confirmed changes from forecasts and your own analysis. Do not assume a disruption exists. If you find no relevant update for a category or route, explain the coverage gap rather than treating silence as proof that conditions are normal.
Finish with three practical checks the importer should make next, explaining why. Keep the complete answer under 600 words.`;
const TEST_C = `As of 6 October 2026, identify up to five developments reported in the past seven days affecting a small business importing into Rwanda via Mombasa or Dar es Salaam. Cover ports, borders, transport, customs, fuel and security. Include EU or Middle East events only with an evidenced link to these routes.
Prioritize official and credible local sources. Use a concise table: development, event/publication dates, affected route, facts, likely impact and source link. Separate facts, forecasts and analysis. Flag coverage gaps; no reports does not mean no disruption. End with three practical checks for the importer. Under 600 words.`;

const read = (rel: string): string => readFileSync(join(__dirname, '..', '..', rel), 'utf8');

describe('A1 · one documented limit, never a silent cut', () => {
  it('both benchmark corridor prompts fit the documented limit whole', () => {
    expect(TEST_B.length).toBeGreaterThan(1000); /* the old cut point */
    expect(askQuestionLimitState(TEST_B).over).toBe(false);
    expect(askQuestionLimitState(TEST_C).over).toBe(false);
  });

  it('the boundary: exactly the limit is accepted, one more is over, and the draft is never shortened', () => {
    const at = 'a'.repeat(ASK_INPUT_MAX_CHARS);
    const over = `${at}b`;
    expect(askQuestionLimitState(at)).toMatchObject({ over: false, near: true });
    expect(askQuestionLimitState(over)).toMatchObject({ over: true, length: ASK_INPUT_MAX_CHARS + 1 });
    /* the state is computed FROM the draft; nothing returns a shortened copy of it */
    expect(over.length).toBe(ASK_INPUT_MAX_CHARS + 1);
  });

  it('counts by code point — emoji, Arabic, Polish and Kinyarwanda diacritics count once each', () => {
    expect(askInputLength('Rwanda 🇷🇼')).toBe(9);
    expect(askInputLength('Ź')).toBe(1);
    expect(askInputLength('رواندا')).toBe(6);
    expect(askInputLength('😀'.repeat(ASK_INPUT_MAX_CHARS))).toBe(ASK_INPUT_MAX_CHARS);
    expect(askQuestionLimitState('😀'.repeat(ASK_INPUT_MAX_CHARS)).over).toBe(false);
  });

  it('no Ask composer carries a silent maxLength any more (standalone, dock — both skins)', () => {
    const parts = read('components/ask-frame/AskParts.tsx');
    const dock = read('components/ask/AskAiDock.tsx');
    expect(parts).not.toMatch(/maxLength=\{1000\}/);
    expect(dock).not.toMatch(/maxLength=\{1000\}/);
    expect(parts).toContain('<AskQuestionLimitNote');
    expect(dock.match(/<AskQuestionLimitNote/g)).toHaveLength(2);
    /* the dock holds an over-limit submit in the CAPTURE phase; the pinned R2 handler is unchanged */
    expect(dock.match(/onSubmitCapture={holdOverLimit}/g)).toHaveLength(2);
  });

  it('the typed server refusal is NAMED, never "unavailable"', () => {
    const en = askR2Strings('en');
    expect(failedTurnCopy(ASK_INPUT_TOO_LONG, en)).toBe(en.questionTooLong(ASK_INPUT_MAX_CHARS));
    expect(failedTurnCopy(ASK_INPUT_TOO_LONG, en)).not.toBe(en.unavailable);
    expect(en.questionTooLong(4000)).toContain('4000');
    expect(askR2Strings('pl').questionTooLong(4000)).toContain('4000');
  });
});

describe('A2 · the submitted question: compact preview, the full original on request', () => {
  const en = askR2Strings('en');
  const render = (q: string) =>
    renderToStaticMarkup(
      createElement(AskSubmittedQuestion, {
        question: q,
        headingClassName: 'D25-HEADING',
        showFullLabel: en.showFullQuestion,
        showLessLabel: en.showLessQuestion,
      }),
    );

  it('an ordinary question keeps the D25 heading unchanged', () => {
    const html = render('What changed in Kenya this week?');
    expect(html).toBe('<h2 class="D25-HEADING">What changed in Kenya this week?</h2>');
  });

  it('a long multi-paragraph question is reading-size, clamped, with an accessible full-question control', () => {
    expect(isLongQuestion(TEST_B)).toBe(true);
    const html = render(TEST_B);
    expect(html).not.toContain('D25-HEADING');
    expect(html).toContain('line-clamp-3');
    expect(html).toContain('whitespace-pre-line');
    expect(html).toMatch(/<button type="button"[^>]*aria-expanded="false"[^>]*aria-controls="[^"]+"/);
    expect(html).toContain('Show full question');
    /* the COMPLETE original is in the document (the clamp is visual) — final sentence included */
    expect(html).toContain('Keep the complete answer under 600 words.');
  });
});

describe('A3 · the typed length refusal is named on the turn (never "Ask is unavailable")', () => {
  beforeEach(() => jest.resetAllMocks());
  type Hook = ReturnType<typeof useAskR2Conversation>;
  function mount(): () => Hook {
    let latest: Hook | undefined;
    function Probe(): null {
      latest = useAskR2Conversation('en', null);
      return null;
    }
    act(() => {
      create(createElement(Probe));
    });
    return () => latest!;
  }

  it('the API client turns the server code into the outcome reason; other outcomes are untouched', () => {
    const refused = { ok: false as const, reason: 'REFUSED' as const, status: 400, code: ASK_INPUT_TOO_LONG };
    expect(namedInputRefusal(refused)).toMatchObject({ reason: ASK_INPUT_TOO_LONG, code: ASK_INPUT_TOO_LONG });
    const other = { ok: false as const, reason: 'REFUSED' as const, status: 409, code: 'SOMETHING_ELSE' };
    expect(namedInputRefusal(other)).toBe(other);
    const ok = { ok: true as const, value: 1 };
    expect(namedInputRefusal(ok)).toBe(ok);
  });

  it('the (byte-pinned) conversation records that reason as the failed turn, which the view names', async () => {
    api.createThread.mockResolvedValue({ ok: true, value: { id: 't-1' } } as never);
    api.submit.mockResolvedValue({ ok: false, reason: ASK_INPUT_TOO_LONG, status: 400, code: ASK_INPUT_TOO_LONG } as never);
    const hook = mount();
    await act(async () => {
      await hook().submit('x'.repeat(ASK_INPUT_MAX_CHARS + 1));
    });
    expect(hook().turns[0]?.failure).toBe(ASK_INPUT_TOO_LONG);
    const en = askR2Strings('en');
    expect(failedTurnCopy(hook().turns[0]?.failure, en)).toBe(en.questionTooLong(ASK_INPUT_MAX_CHARS));
  });
});
