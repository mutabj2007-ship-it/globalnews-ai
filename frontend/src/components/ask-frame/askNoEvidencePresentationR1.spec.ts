import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import type { AnalysisApiResponse } from '@globalnews-ai/shared';
import type { AskR2Payload } from '@/lib/api/askV2Api';
import { AskR2TurnView } from '@/components/ask-frame/AskR2TurnView';
import {
  partialOutageWithNoMatches,
  reportingWhollyUnavailable,
  someLaneAnswered,
} from '@/components/search/evidenceDisplay';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * CTO — ASK ALPHA NO-EVIDENCE PRESENTATION R1 (Alpha 3e92398, op 51794ad5, 2026-10-09)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * GNews and the publisher feeds answered with zero matching reports, GDELT was refused, the
 * answer was INSUFFICIENT with no AI. The screen stacked: the turn's own "couldn't verify" title,
 * "not a complete search", the lanes' "verification was incomplete", a "LIVE DATA UNAVAILABLE"
 * badge, "Live reporting is temporarily unavailable" and "ask a narrower question about a place,
 * event, or time period" — for a question that named two countries, a topic and 30 days.
 *
 * Pinned: ONE statement of the outcome, ONE "not a complete search" line, every lane disclosed by
 * name, "unavailable" only when NO lane answered, never the generic narrowing advice inside an Ask
 * R2 turn — and no answer, citation or AI invented for an empty result.
 */
const PO_QUESTION =
  'What changed in trade and transportation between Tanzania and Rwanda during the past 30 days?';

const trace = (succeeded: string[], unavailable: Array<[string, string]>) => ({
  queryVariants: [],
  timeWindow: null,
  languages: ['en'],
  lanesAttempted: [...succeeded, ...unavailable.map(([lane]) => lane)],
  lanesSucceeded: succeeded,
  lanesUnavailable: unavailable.map(([lane, reason]) => ({ lane, reason })),
  candidatesSeen: 0,
  candidatesAdmitted: 0,
  independentClusters: 0,
});

/** the live op 51794ad5 shape: two lanes answered (zero matches), GDELT refused */
const PARTIAL = {
  dataMode: 'unavailable',
  providers: ['gnews', 'rss-feeds', 'gdelt-doc'],
  providerFailures: [{ providerId: 'gdelt-doc', kind: 'unavailable' }],
  fallbackReason: 'provider-error',
  outcome: 'PROVIDER_UNAVAILABLE',
  articlesRetrieved: 0,
  evidenceState: 'degraded-fallback',
  verificationNotice: 'COVERAGE_INCOMPLETE',
  retrievalTrace: trace(['gnews', 'rss-feeds'], [['gdelt-doc', 'unavailable']]),
};
/** every lane refused */
const TOTAL = {
  dataMode: 'unavailable',
  providers: ['gnews', 'gdelt-doc'],
  providerFailures: [
    { providerId: 'gnews', kind: 'rate-limited' },
    { providerId: 'gdelt-doc', kind: 'rate-limited' },
  ],
  fallbackReason: 'provider-error',
  outcome: 'PROVIDER_RATE_LIMITED',
  articlesRetrieved: 0,
  evidenceState: 'degraded-fallback',
  verificationNotice: 'COVERAGE_INCOMPLETE',
  retrievalTrace: trace([], [['gnews', 'rate-limited'], ['gdelt-doc', 'rate-limited']]),
};
/** healthy search, nothing matching */
const HEALTHY_ZERO = {
  dataMode: 'live',
  providers: ['gnews', 'rss-feeds'],
  outcome: 'NO_RELEVANT_EVIDENCE',
  articlesRetrieved: 0,
  evidenceState: 'no-relevant-evidence',
  verificationNotice: 'NOT_VERIFIED',
  retrievalTrace: trace(['gnews', 'rss-feeds'], []),
};

function payload(retrievalContext: Record<string, unknown>): AskR2Payload {
  return {
    schema: 'ask-r2-result/1',
    route: {
      questionClass: 'CURRENT_REPORTING',
      terminalState: 'EXECUTABLE',
      scopedBy: 'NONE',
      refusals: [],
      disclosures: [],
      clarification: [],
      normalization: 'QUALIFIED',
      questionLanguage: 'en',
    },
    chips: { kind: 'NONE' },
    answer: { state: 'INSUFFICIENT', basis: 'NO_ADMITTED_REPORTING', missingRoles: [] },
    checkedAt: '2026-10-09T13:56:00Z',
    aiExecuted: false,
    modelPriorCitable: false,
    analysis: {
      query: PO_QUESTION,
      analysis: null,
      articles: [],
      retrievalContext,
      provenance: { provider: 'none', executionMode: 'production', analysisMode: 'live-ai', status: 'success', cached: false },
    } as unknown as AnalysisApiResponse,
    background: null,
    intelligence: null,
  } as unknown as AskR2Payload;
}
function render(p: AskR2Payload, question = PO_QUESTION): ReactTestRenderer {
  let r!: ReactTestRenderer;
  act(() => {
    r = create(
      createElement(AskR2TurnView, {
        turn: { question, payload: p } as never,
        locale: 'en',
        context: undefined,
        onUseQuestion: () => undefined,
      } as never),
    );
  });
  return r;
}
const text = (r: ReactTestRenderer): string => {
  const out: string[] = [];
  const walk = (node: unknown): void => {
    if (typeof node === 'string') out.push(node);
    else if (Array.isArray(node)) node.forEach(walk);
    else if (node !== null && typeof node === 'object') walk((node as { children?: unknown }).children);
  };
  walk(r.toJSON());
  return out.join(' ');
};
const count = (haystack: string, needle: RegExp) => (haystack.match(new RegExp(needle.source, 'gi')) ?? []).length;
const byData = (r: ReactTestRenderer, name: string) =>
  r.root.findAll((n) => typeof n.type === 'string' && n.props['data-ask'] === name);

describe('the lane authority: partial vs total vs healthy', () => {
  it('reads lanes from the server trace', () => {
    expect(someLaneAnswered(PARTIAL as never)).toBe(true);
    expect(someLaneAnswered(TOTAL as never)).toBe(false);
    expect(partialOutageWithNoMatches(PARTIAL as never, 0)).toBe(true);
    expect(reportingWhollyUnavailable(PARTIAL as never, 0)).toBe(false);
    expect(reportingWhollyUnavailable(TOTAL as never, 0)).toBe(true);
    expect(partialOutageWithNoMatches(HEALTHY_ZERO as never, 0)).toBe(false);
    expect(reportingWhollyUnavailable(HEALTHY_ZERO as never, 0)).toBe(false);
  });
  it('without a trace: providers minus named failures; nothing named → the stricter reading', () => {
    const { retrievalTrace: _t, ...noTrace } = PARTIAL;
    void _t;
    expect(someLaneAnswered(noTrace as never)).toBe(true);
    expect(someLaneAnswered({ ...noTrace, providerFailures: undefined } as never)).toBe(false);
  });
});

describe('PARTIAL outage, zero matches — the live op 51794ad5 shape', () => {
  const r = () => render(payload(PARTIAL));
  it('states the outcome ONCE and says "not a complete search" ONCE', () => {
    const t = text(r());
    /* the main answer flow (the collapsed "About this answer" metadata keeps its own freshness line) */
    const main = t.split(/About this answer/)[0];
    expect(count(main, /couldn.t verify relevant reporting/)).toBe(1);
    expect(count(main, /not a complete search|verification was incomplete/)).toBe(1);
  });
  it('never claims live data / live reporting is unavailable — two lanes answered', () => {
    const t = text(r());
    expect(t).not.toMatch(/live data unavailable/i);
    expect(t).not.toMatch(/live reporting is temporarily unavailable/i);
  });
  it('never tells a reader who named two countries, a topic and a period to name a place, event or period', () => {
    const t = text(r());
    expect(t).not.toMatch(/narrower question|name(?:ing)? (?:a|the) place|place, event, or time period/i);
  });
  it('every lane stays disclosed by name, the refused one as unavailable', () => {
    const lanes = byData(r(), 'verification')[0];
    const t = text(r());
    expect(lanes).toBeDefined();
    expect(t).toMatch(/GNews/);
    expect(t).toMatch(/Publisher feeds/);
    expect(t).toMatch(/GDELT/);
    expect(t).toMatch(/unavailable/);
  });
  it('the zero-evidence firewall: no answer body, no source, no AI, and Edit question is offered', () => {
    const v = r();
    expect(byData(v, 'no-answer')).toHaveLength(0);
    expect(byData(v, 'insufficient-title')).toHaveLength(1);
    expect(byData(v, 'edit-question')).toHaveLength(1);
    expect(text(v)).not.toMatch(/\[1\]/);
  });
});

describe('TOTAL outage — every lane refused', () => {
  it('says live reporting is unavailable (true), still without the generic narrowing advice', () => {
    const t = text(render(payload(TOTAL)));
    expect(count(t, /live reporting is temporarily unavailable/)).toBe(1);
    expect(t).not.toMatch(/narrower question|place, event, or time period/i);
    expect(count(t, /couldn.t verify relevant reporting/)).toBe(1);
  });
});

describe('HEALTHY search, zero matches', () => {
  it('no outage language at all; one outcome statement; no "this claim" for an open question', () => {
    const t = text(render(payload(HEALTHY_ZERO)));
    expect(t).not.toMatch(/unavailable|not a complete search|incomplete/i);
    expect(t).not.toMatch(/this claim/i);
    expect(count(t, /couldn.t verify relevant reporting/)).toBe(1);
    expect(t).not.toMatch(/narrower question|place, event, or time period/i);
  });
});

describe('a GENUINELY underspecified question is still asked about, not searched', () => {
  it('the asked-not-searched sentence and its place choices survive inside the turn', () => {
    const p = payload({
      dataMode: 'live',
      providers: [],
      articlesRetrieved: 0,
      retrievalOutcome: 'CLARIFICATION_REQUIRED',
      clarificationReason: 'NO_PRIOR_SUBJECT',
      clarificationCandidates: ['KEN', 'UGA'],
    });
    const v = render(p, 'And there?');
    expect(byData(v, 'no-answer')).toHaveLength(1);
    expect(byData(v, 'asked-places')).toHaveLength(1);
  });
});
