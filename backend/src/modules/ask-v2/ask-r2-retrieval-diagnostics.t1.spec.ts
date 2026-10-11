import { retrievalDiagnosticsFor } from './ask-r2-execution.adapter';
import {
  attachRetrievalDiagnostics,
  buildRetrievalDiagnostics,
} from '../news/retrieval-trace/retrieval-diagnostics';
import { RetrievalTraceCollector } from '../news/retrieval-trace/retrieval-trace';
import type { AnalysisApiResponse } from '@globalnews-ai/shared';

/* RETRIEVAL R1 · T1 — the envelope the Ask payload persists (pure; no service, no DB). */

type RouteArg = Parameters<typeof retrievalDiagnosticsFor>[1];
const route = (terminalState: string, countries: string[]): RouteArg =>
  ({
    plan: { terminalState },
    envelope: {
      geography: { candidates: countries.map((value) => ({ value, source: 'QUESTION' })) },
    },
  }) as unknown as RouteArg;

const emptyStages = {
  windowExcludedOutsideWindow: null,
  anchorGate: null,
  rightsAiInputExcluded: null,
  rightsAiInputReasons: null,
  rightsAiInputPendingReview: null,
  finalEvidence: 0,
};

describe('T1 · Ask payload envelope', () => {
  it('a route that never retrieved (background) is PROVIDER_NOT_ASKED, plus the RWA coverage hold', () => {
    const d = retrievalDiagnosticsFor(null, route('REFERENCE_BACKGROUND_ONLY', ['RWA']));
    const causes = d?.causes.map((c) => `${c.cause}:${c.detail}`) ?? [];
    expect(causes[0]).toBe('PROVIDER_NOT_ASKED:route:REFERENCE_BACKGROUND_ONLY');
    expect(causes).toEqual(expect.arrayContaining(['NOT_IN_ENABLED_COVERAGE:RWA']));
    expect(causes.some((c) => c.startsWith('NOT_RIGHTS_CLEARED:RWA:'))).toBe(true);
    expect(d?.coverage).toMatchObject({ countryIso3: 'RWA', enabledLocalSources: 0 });
  });

  it('carries the analysis envelope and adds COD coverage for a single-country question', () => {
    const analysis = attachRetrievalDiagnostics(
      { articles: [] } as unknown as AnalysisApiResponse,
      buildRetrievalDiagnostics(new RetrievalTraceCollector().seal(), emptyStages),
    );
    const d = retrievalDiagnosticsFor(analysis, route('EXECUTABLE', ['COD']));
    expect(d?.coverage?.countryIso3).toBe('COD');
    expect(d?.causes.map((c) => c.cause)).toContain('NOT_IN_ENABLED_COVERAGE');
  });

  it('a multi-country question carries no single-country coverage claim', () => {
    const d = retrievalDiagnosticsFor(null, route('EXECUTABLE', ['RWA', 'TZA']));
    expect(d?.coverage).toBeNull();
    expect(d?.causes.map((c) => c.cause)).not.toContain('NOT_IN_ENABLED_COVERAGE');
  });

  it('an analysis without a trace says so rather than inventing one', () => {
    const d = retrievalDiagnosticsFor(
      { articles: [] } as unknown as AnalysisApiResponse,
      route('EXECUTABLE', []),
    );
    expect(d?.causes).toEqual([
      { cause: 'PROVIDER_NOT_ASKED', detail: 'route:ANALYSIS_WITHOUT_TRACE' },
    ]);
  });

  it('stays inside the persisted size bound', () => {
    const collector = new RetrievalTraceCollector();
    for (let i = 0; i < 60; i += 1) {
      const attempt = collector.beginAttempt({
        searchOrdinal: null,
        providerId: `p${i}`,
        capability: 'search',
        tier: 'PRIMARY',
        initiatedAt: '2026-10-11T00:00:00.000Z',
        requestedLang: null,
        sentLang: null,
      });
      if (attempt) attempt.outcome = 'TIMEOUT';
    }
    const analysis = attachRetrievalDiagnostics(
      { articles: [] } as unknown as AnalysisApiResponse,
      buildRetrievalDiagnostics(collector.seal(), emptyStages),
    );
    const d = retrievalDiagnosticsFor(analysis, route('EXECUTABLE', []));
    expect(JSON.stringify(d).length).toBeLessThanOrEqual(16_000);
    expect((d?.attempts.length ?? 0) + (d?.attemptsTruncated ?? 0)).toBe(60);
  });
});
