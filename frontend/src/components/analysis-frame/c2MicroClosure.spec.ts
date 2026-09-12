import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { AnalysisApiResponse } from '@globalnews-ai/shared';
import { AnalysisFrameSurface } from './AnalysisFrameSurface';
import { ZeroReportRecovery } from './ZeroReportRecovery';
import { resolveFrameEvidence } from './analysisFrameState';
import {
  TRUST_LINE_MAX_DESKTOP,
  TRUST_LINE_MAX_PHONE,
  TRUST_SEGMENT_GAP,
  TRUST_SEGMENT_H,
  TRUST_SEGMENT_W,
} from './TrustSummaryLine';
import { fixture } from './frameFixtures';
import { getDictionary } from '@/lib/i18n/dictionaries';

/**
 * H-C2 FINAL MICRO-CLOSURE — three integration items and nothing else.
 *
 *   1  Main's `analysisFailureKind`, wired into the H-owned frame.
 *   2  DESIGN-C2 LOCK 6, the compact trust summary and its RANK.
 *   3  G's `retrievalOutcome=CLARIFICATION_REQUIRED`, given a state of its
 *      own instead of the generic no-evidence sentence.
 *
 * Nothing in the accepted H-3 metric work is re-asserted here; those suites
 * are unchanged and still run.
 */

const src = (name: string): string => readFileSync(join(__dirname, name), 'utf8');
const codeOnly = (s: string): string =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');

const FRAME = codeOnly(src('AnalysisFrame.tsx'));
const BRIEF = codeOnly(src('BriefRow.tsx'));
const TRUST = codeOnly(src('TrustSummaryLine.tsx'));
const RECOVERY = codeOnly(src('ZeroReportRecovery.tsx'));

const render = (response: AnalysisApiResponse, width = 390, height = 844): string =>
  renderToStaticMarkup(
    createElement(AnalysisFrameSurface as never, {
      response,
      initialViewport: { width, height },
    } as never),
  );

/** A response whose analysis is absent but whose reporting survived. */
const failedWith = (failureReason?: string): AnalysisApiResponse => {
  const base = fixture({ analysisNull: true }) as AnalysisApiResponse;
  return {
    ...base,
    provenance: { ...base.provenance, status: 'failed', failureReason },
  } as AnalysisApiResponse;
};

/** A zero-evidence response carrying G's clarification codes. */
const clarification = (reason?: string): AnalysisApiResponse => {
  const base = fixture({ analysisNull: true }) as AnalysisApiResponse;
  return {
    ...base,
    articles: [],
    retrievalContext: {
      ...base.retrievalContext,
      dataMode: 'unavailable',
      fallbackReason: 'no-live-results',
      articlesRetrieved: 0,
      retrievalOutcome: 'CLARIFICATION_REQUIRED',
      ...(reason === undefined ? {} : { clarificationReason: reason }),
    },
  } as unknown as AnalysisApiResponse;
};

/* ── 1 — MAIN'S FAILURE-KIND HANDOFF ───────────────────────────────── */
describe('1 — the AI-provider-unavailable vs unusable-answer distinction is rendered', () => {
  it('the resolver classifies every provider-side reason as UNAVAILABLE', () => {
    for (const reason of [
      'provider-not-configured',
      'provider-auth',
      'provider-timeout',
      'provider-unavailable',
      'provider-rate-limited',
    ]) {
      expect({
        reason,
        kind: resolveFrameEvidence(failedWith(reason), true).analysisFailureKind,
      }).toEqual({ reason, kind: 'ai-provider-unavailable' });
    }
  });

  it('a provider that ANSWERED badly is UNUSABLE, and so is an unknown reason', () => {
    for (const reason of ['malformed-output', 'validation-rejected', undefined, 'something-new']) {
      expect(resolveFrameEvidence(failedWith(reason), true).analysisFailureKind).toBe(
        'ai-response-unusable',
      );
    }
  });

  it('the kind is null wherever no AI call was attempted — never a fabricated cause', () => {
    expect(resolveFrameEvidence(null, false).analysisFailureKind).toBeNull();
    expect(resolveFrameEvidence(fixture(), true).analysisFailureKind).toBeNull();
    expect(resolveFrameEvidence(clarification(), true).analysisFailureKind).toBeNull();
  });

  it('an unreachable provider gets its own HEADING and its own sentence', () => {
    const html = render(failedWith('provider-unavailable'));
    const t = getDictionary('en').analysisFrame;
    expect(html).toContain(t.stateAiProviderUnavailable);
    expect(html).toContain(t.stateAiProviderUnavailableBody);
    expect(html).not.toContain(t.stateAiResponseUnusableBody);
  });

  it('an unusable answer keeps the accepted heading and takes its own sentence', () => {
    const html = render(failedWith('malformed-output'));
    const t = getDictionary('en').analysisFrame;
    expect(html).toContain(t.stateAnalysisFailed);
    expect(html).toContain(t.stateAiResponseUnusableBody);
    expect(html).not.toContain(t.stateAiProviderUnavailableBody);
  });

  it('both sentences exist in PL and differ from EN', () => {
    const en = getDictionary('en').analysisFrame;
    const pl = getDictionary('pl').analysisFrame;
    expect(pl.stateAiProviderUnavailableBody).not.toBe(en.stateAiProviderUnavailableBody);
    expect(pl.stateAiResponseUnusableBody).not.toBe(en.stateAiResponseUnusableBody);
    expect(pl.stateAiProviderUnavailableBody).not.toBe(pl.stateAiResponseUnusableBody);
    const html = renderToStaticMarkup(
      createElement(AnalysisFrameSurface as never, {
        response: failedWith('provider-timeout'),
        language: 'pl',
        initialViewport: { width: 390, height: 844 },
      } as never),
    );
    expect(html).toContain(pl.stateAiProviderUnavailableBody);
  });

  it('the fallback tables still cover every path the kind does not', () => {
    /* nothing was deleted: a null kind still resolves through the tables */
    expect(FRAME).toMatch(/: STATE_HEADING\[evidence\.state\]\(t\)/);
    expect(FRAME).toMatch(/: STATE_BODY\[evidence\.state\]\(t\)/);
  });
});

/* ── 2 — DESIGN-C2 LOCK 6 ──────────────────────────────────────────── */
describe('2 — LOCK 6, the compact trust summary', () => {
  it('C2-26 — on phone its rect top is BELOW the first paragraph', () => {
    const html = render(fixture());
    const firstPara = html.indexOf('data-paf="brief-synthesis-paragraph"');
    const trust = html.indexOf('data-paf="trust-summary"');
    expect(firstPara).toBeGreaterThan(-1);
    expect(trust).toBeGreaterThan(firstPara);
    /* and it is the READING placement, not the band, on phone */
    expect(html).toMatch(/data-paf="trust-summary" data-placement="reading"/);
    expect(html).not.toMatch(/data-paf="trust-summary" data-placement="band"/);
  });

  it('C2-26 — the band is where it sits on desktop, and only there', () => {
    /* ── AMENDED BY MAIN-FINAL-CORRECTED-ALPHA-CONVERGENCE-1, PO DECISION 4 ──
       THE LOCK IS UNCHANGED; ONLY THE WINDOW AROUND THE FRAME GREW.
       R4 §4's compression is restored, and the compressed brief tier
       retains the thesis title, the evidence meter and `▾ FULL` — the
       trust-summary band is not on that retained list, so at a genuinely
       constrained height it is correctly absent. 1440x900 is now such a
       height (900 - 62 NavBar - 48 command bar = 790, below the 852
       threshold). 962 restores the same 852px frame this lock was
       written against, so it asserts exactly what it always asserted. */
    const html = render(fixture(), 1440, 962);
    expect(html).toMatch(/data-paf="trust-summary" data-placement="band"/);
    expect(html).not.toMatch(/data-paf="trust-summary" data-placement="reading"/);
    /*
      The band's line is gated in JS on the frame's own measured viewport,
      not by `hidden`. A CSS-hidden element has no rect and would pass
      C2-26's probe while still sitting in the phone DOM ahead of the
      answer — which is the appearance of compliance, not compliance.
    */
    expect(BRIEF).toMatch(/showTrustSummary \? \(/);
    expect(FRAME).toMatch(/showTrustSummary=\{!isPhone\}/);
  });

  it('C2-27 — the height is capped at 24px phone and 22px desktop, structurally', () => {
    expect(TRUST_LINE_MAX_PHONE).toBe(24);
    expect(TRUST_LINE_MAX_DESKTOP).toBe(22);
    expect(render(fixture())).toMatch(/max-h-\[24px\][^"]*md:max-h-\[22px\]/);
  });

  it('LOCK 6 — one line: 3 segments at 13x4 with a 3px gap, the word, the counts', () => {
    expect(TRUST_SEGMENT_W).toBe(13);
    expect(TRUST_SEGMENT_H).toBe(4);
    expect(TRUST_SEGMENT_GAP).toBe(3);
    const html = render(fixture());
    const line = html.slice(html.indexOf('data-paf="trust-summary"'));
    const cell = line.slice(0, line.indexOf('</div>'));
    expect((cell.match(/width:13px;height:4px/g) ?? []).length).toBe(3);
    expect(cell).toContain('gap:3px');
    expect(cell).toContain('data-paf="evidence-word"');
    expect(cell).toContain('data-paf="trust-counts"');
    expect(cell).toMatch(/RETRIEVED REPORTS/);
  });

  it('C2-28 — the word and the filled-segment count always change together', () => {
    const html = render(fixture());
    const line = html.slice(html.indexOf('data-paf="trust-summary"'));
    const cell = line.slice(0, line.indexOf('</div>'));
    const filled = (cell.match(/bg-\[#6ee7b7\]/g) ?? []).length;
    const word = /MODERATE|STRONG|LIMITED|INSUFFICIENT|UNRATED/.exec(cell)?.[0];
    /* the fixture is MODERATE: 2 filled segments AND the word, from one source */
    expect({ filled, word }).toEqual({ filled: 2, word: 'MODERATE' });
  });

  it('C2-29 — no bordered container anywhere in the line', () => {
    expect(TRUST).not.toMatch(/\bborder\b|border-\[/);
    const html = render(fixture());
    const line = html.slice(html.indexOf('data-paf="trust-summary"'));
    expect(line.slice(0, line.indexOf('</div>'))).not.toMatch(/\bborder/);
  });

  it('C2-30 — no percentage, no numeric score, no badge or shield iconography', () => {
    expect(TRUST).not.toMatch(/%|toFixed|Math\.round|<svg|shield|badge/i);
    const html = render(fixture());
    const line = html.slice(html.indexOf('data-paf="trust-summary"'));
    const cell = line.slice(0, line.indexOf('</div>'));
    expect(cell).not.toMatch(/%/);
    expect(cell).not.toMatch(/<svg/);
    /* the only digits in the line are the retrieval counts themselves */
    expect(cell).not.toMatch(/\b\d+\s*\/\s*\d+\b/);
  });

  it('UNRATED is not dressed as a strength — it takes the UNKNOWN grammar', () => {
    expect(TRUST).toMatch(/rated \? '#6ee7b7' : '#d9a441'/);
  });
});

/* ── 3 — CLARIFICATION_REQUIRED ────────────────────────────────────── */
describe('3 — a question that was never searched for is not reported as a search', () => {
  it('the resolver reads G’s code, and reads it BEFORE dataMode', () => {
    const e = resolveFrameEvidence(clarification('COMPARISON_MEMBERS_UNDETERMINED'), true);
    expect(e.state).toBe('clarification-required');
    expect(e.clarificationReason).toBe('COMPARISON_MEMBERS_UNDETERMINED');
    expect(e.evidenceSurvives).toBe(false);
    /* the same context WITHOUT the code is still the accepted no-evidence state */
    const plain = fixture({ analysisNull: true }) as AnalysisApiResponse;
    const noCode = {
      ...plain,
      articles: [],
      retrievalContext: {
        ...plain.retrievalContext,
        dataMode: 'unavailable',
        fallbackReason: 'no-live-results',
      },
    } as unknown as AnalysisApiResponse;
    expect(resolveFrameEvidence(noCode, true).state).toBe('no-evidence');
  });

  it('an unknown or absent reason code is a clarification with no invented specifics', () => {
    expect(resolveFrameEvidence(clarification(), true).clarificationReason).toBeNull();
    expect(resolveFrameEvidence(clarification('SOMETHING_NEW'), true).clarificationReason).toBeNull();
    expect(resolveFrameEvidence(clarification('SOMETHING_NEW'), true).state).toBe(
      'clarification-required',
    );
  });

  const recovery = (reason: string | null, language: 'en' | 'pl' = 'en'): string =>
    renderToStaticMarkup(
      createElement(ZeroReportRecovery as never, {
        response: clarification(reason ?? undefined),
        state: 'clarification-required',
        clarificationReason: reason,
        language,
        onRetry: () => undefined,
        onEdit: () => undefined,
      } as never),
    );

  it('it says nothing was SEARCHED for — never that nothing was FOUND', () => {
    const t = getDictionary('en').analysisFrame;
    const html = recovery('COMPARISON_MEMBERS_UNDETERMINED');
    expect(html).toContain(t.stateClarificationRequired);
    expect(html).toContain(t.stateClarificationRequiredBody);
    /* the generic sentence this state exists to replace is absent */
    expect(html).not.toContain(t.stateNoEvidenceBody);
    expect(html).not.toContain(t.stateProviderUnavailableBody);
  });

  it('the REASON is G’s code rendered, and absent when the code is', () => {
    const t = getDictionary('en').analysisFrame;
    expect(recovery('COMPARISON_MEMBERS_UNDETERMINED')).toContain(t.clarificationComparisonMembers);
    expect(recovery('TOO_MANY_ENTITIES')).toContain(t.clarificationTooManyEntities);
    expect(recovery(null)).not.toContain('data-paf="clarification-reason"');
  });

  it('a clarification QUESTION is asked, and it is specific where the code is', () => {
    const t = getDictionary('en').analysisFrame;
    expect(recovery('COMPARISON_MEMBERS_UNDETERMINED')).toContain(
      t.clarificationAskComparisonMembers,
    );
    expect(recovery('TOO_MANY_ENTITIES')).toContain(t.clarificationAskTooManyEntities);
    expect(recovery(null)).toContain(t.clarificationAskGeneral);
    expect(recovery(null)).toContain('data-paf="clarification-question"');
  });

  it('the original question survives verbatim, and Edit is preserved', () => {
    const html = recovery('TOO_MANY_ENTITIES');
    expect(html).toContain('data-paf="analysis-question-text"');
    expect(html).toContain(clarification().query);
    expect(html).toContain('data-paf="zero-report-edit"');
  });

  it('RETRY IS NOT PROMOTED AS THE REMEDY: Edit is first and carries the emphasis', () => {
    const html = recovery('TOO_MANY_ENTITIES');
    const edit = html.indexOf('data-paf="zero-report-edit"');
    const retry = html.indexOf('data-paf="zero-report-retry"');
    expect(edit).toBeLessThan(retry);
    /* the tinted treatment is on Edit, and Retry is the plain outline */
    const editTag = html.slice(edit, html.indexOf('>', edit));
    const retryTag = html.slice(retry, html.indexOf('>', retry));
    expect(editTag).toContain('bg-[rgba(103,232,249,.08)]');
    expect(retryTag).not.toContain('bg-[rgba(103,232,249,.08)]');
    /* and it says plainly why retrying is not the answer */
    expect(html).toContain(getDictionary('en').analysisFrame.clarificationRetryNote);
  });

  it('every OTHER state keeps the accepted Retry-first order and emphasis', () => {
    const html = renderToStaticMarkup(
      createElement(ZeroReportRecovery as never, {
        response: clarification(),
        state: 'no-evidence',
        language: 'en',
        onRetry: () => undefined,
        onEdit: () => undefined,
      } as never),
    );
    expect(html.indexOf('data-paf="zero-report-retry"')).toBeLessThan(
      html.indexOf('data-paf="zero-report-edit"'),
    );
    expect(html).not.toContain('data-paf="clarification-question"');
    expect(html).not.toContain('data-paf="clarification-retry-note"');
  });

  it('both languages carry the whole clarification vocabulary, and differ', () => {
    const en = getDictionary('en').analysisFrame;
    const pl = getDictionary('pl').analysisFrame;
    for (const key of [
      'stateClarificationRequired',
      'stateClarificationRequiredBody',
      'clarificationComparisonMembers',
      'clarificationTooManyEntities',
      'clarificationAskComparisonMembers',
      'clarificationAskTooManyEntities',
      'clarificationAskGeneral',
      'clarificationRetryNote',
    ] as const) {
      expect(pl[key].length).toBeGreaterThan(0);
      expect(pl[key]).not.toBe(en[key]);
    }
    expect(recovery('TOO_MANY_ENTITIES', 'pl')).toContain(pl.clarificationTooManyEntities);
  });

  it('nothing is asked of the shared contract: the codes are read defensively', () => {
    const state = codeOnly(src('analysisFrameState.ts'));
    expect(state).toMatch(/retrievalOutcome\?: string/);
    expect(state).toMatch(/ctx\.retrievalOutcome !== 'CLARIFICATION_REQUIRED'/);
    /* no import of a shared type that does not exist yet */
    expect(state).not.toMatch(/RetrievalOutcome.*from '@globalnews-ai\/shared'/);
  });

  it('the clarification branch is read BEFORE the dataMode branch, in source', () => {
    const state = codeOnly(src('analysisFrameState.ts'));
    expect(state.indexOf('readClarification(response)')).toBeLessThan(
      state.indexOf("retrievalContext.dataMode === 'unavailable'"),
    );
  });

  /*
    CLOSED. The conflict recorded here — the accepted recovery surface against a
    newer SearchPageClient that predated it — is resolved: the resolver branch is
    wired into the CURRENT client additively, and this assertion passes as an
    ordinary lock again. The newer behaviours it had to protect (storyContext
    stability, stale-response race protection, language-switch context, PWA
    localization) are all still green.
  */
  it('the recovery surface is reached by the accepted resolver, unchanged', () => {
    const page = codeOnly(readFileSync(join(__dirname, '..', 'search', 'SearchPageClient.tsx'), 'utf8'));
    expect(page).toMatch(/const evidence = resolveFrameEvidence\(response, hasQuery\);/);
    expect(page).toMatch(/if \(!evidence\.evidenceSurvives\)/);
    expect(page).toMatch(/clarificationReason=\{evidence\.clarificationReason\}/);
    expect(RECOVERY).toMatch(/state === 'clarification-required'/);
  });
});
