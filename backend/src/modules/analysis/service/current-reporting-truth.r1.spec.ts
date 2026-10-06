import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  resolveEvidenceState,
  resolveReportingFreshness,
  type AnalysisRetrievalContext,
} from '@globalnews-ai/shared';
import { deriveAnswerState } from '../../ask-router/answer-state';
import { routeAskR2 } from '../../ask-router/ask-r2-route';
import { specialistRegistryFixture } from '../../ask-router/frozen-c/fixtures/specialist-registry.fixture';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * CURRENT-REPORTING TRUTH R1 — East Africa finding B1 (CTO rulings 2026-10-06)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * B1  Freshness and provider health are independent. CURRENT_REPORTING needs at least one
 *     current item; retained-only reporting is RETAINED_REPORTING; a partially degraded live
 *     search stays CURRENT_REPORTING. Decided from the canonical evidence state, never from
 *     an article count.
 * B2  Usable evidence + a provider failure + no stronger fallbackReason → 'provider-error',
 *     one rule after branch selection; the country path exposes its provider failures.
 */

const ctx = (over: Partial<AnalysisRetrievalContext>): AnalysisRetrievalContext =>
  ({ dataMode: 'live', providers: ['gnews'], articlesRetrieved: 1, ...over }) as AnalysisRetrievalContext;

describe('B1 · resolveReportingFreshness — freshness is not provider health', () => {
  it.each([
    ['healthy live search', ctx({}), 3, 'current'],
    ['live search that lost a lane (partial degradation)', ctx({ fallbackReason: 'provider-error' }), 3, 'current'],
    ['retained after provider failure', ctx({ dataMode: 'cached', fallbackReason: 'provider-error', outcome: 'RETAINED_ONLY' }), 2, 'retained'],
    ['served from the store', ctx({ dataMode: 'cached' }), 2, 'retained'],
    ['RETAINED_ONLY even if labelled live', ctx({ outcome: 'RETAINED_ONLY' }), 2, 'retained'],
    ['nothing usable', ctx({}), 0, 'none'],
    ['provider down, nothing retained', ctx({ dataMode: 'unavailable', fallbackReason: 'provider-error' }), 0, 'none'],
    ['the disclosed demo mode, as before', ctx({ dataMode: 'mock' }), 2, 'current'],
    ['an unknown context never invents "retained"', {} as AnalysisRetrievalContext, 2, 'current'],
  ] as const)('%s → %s', (_label, context, count, expected) => {
    expect(resolveReportingFreshness(context, count)).toBe(expected);
  });

  it('an absent context reads as before (current) and empty evidence is none', () => {
    expect(resolveReportingFreshness(undefined, 2)).toBe('current');
    expect(resolveReportingFreshness(undefined, 0)).toBe('none');
  });

  it('reads the SAME canonical evidence state (partial degradation is still degraded there)', () => {
    const partial = ctx({ fallbackReason: 'provider-error' });
    expect(resolveEvidenceState(partial, 3)).toBe('degraded-fallback');
    expect(resolveReportingFreshness(partial, 3)).toBe('current');
  });
});

describe('B1 · deriveAnswerState — retained-only reporting is never CURRENT_REPORTING', () => {
  const news = routeAskR2(
    {
      originalQuestion: 'What is happening in Kenya?',
      sourceLanguage: 'en',
      normalizationLanguage: 'en',
      displayLanguage: 'en',
      origin: 'ASK',
    },
    {},
    { specialistRegistry: specialistRegistryFixture },
  ).plan;

  it('current reporting → CURRENT_REPORTING (healthy or partially degraded alike)', () => {
    expect(deriveAnswerState(news, { items: { REPORTING: 3 }, reportingFreshness: 'current' }).state).toBe(
      'CURRENT_REPORTING',
    );
  });

  it('retained-only reporting → RETAINED_REPORTING', () => {
    expect(deriveAnswerState(news, { items: { REPORTING: 3 }, reportingFreshness: 'retained' })).toEqual({
      state: 'RETAINED_REPORTING',
      basis: 'RETAINED_REPORTING_ONLY',
      missingRoles: [],
    });
  });

  it('no reporting is unchanged (INSUFFICIENT), and an unstated freshness reads as before', () => {
    expect(deriveAnswerState(news, { items: {}, reportingFreshness: 'none' }).state).toBe('INSUFFICIENT');
    expect(deriveAnswerState(news, { items: { REPORTING: 2 } }).state).toBe('CURRENT_REPORTING');
  });
});

describe('B1 · the adapter passes the canonical state; no unconditional CURRENT_REPORTING', () => {
  const adapter = readFileSync(join(__dirname, '..', '..', 'ask-v2', 'ask-r2-execution.adapter.ts'), 'utf8');

  it('the reporting path hands deriveAnswerState the canonical freshness', () => {
    expect(adapter).toMatch(
      /reportingFreshness: resolveReportingFreshness\(\s*response\.retrievalContext,\s*response\.articles\.length,\s*\)/,
    );
  });

  it('the selection path decides CURRENT vs RETAINED from the same resolver', () => {
    expect(adapter).toMatch(
      /const freshness = resolveReportingFreshness\(response\.retrievalContext, response\.articles\.length\);[\s\S]{0,200}freshness === 'retained'[\s\S]{0,120}'RETAINED_REPORTING'/,
    );
    /* no remaining literal that makes a produced answer current regardless of evidence */
    expect(adapter).not.toMatch(/produced\s*\?\s*\{\s*state: 'CURRENT_REPORTING'/);
  });
});

