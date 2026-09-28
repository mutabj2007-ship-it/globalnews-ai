import type { AnalysisRetrievalContext } from '@globalnews-ai/shared';
import { resolveAskedNotSearched } from './EventAnchorNotice';

/**
 * ASK R2 ALPHA ENABLEMENT R1 — the one wording for questions the backend ASKED about instead
 * of searching (MC-055, MC-070), shared by the Ask dock, /ask and the /search frame.
 */
const ctx = (over: Partial<AnalysisRetrievalContext>): AnalysisRetrievalContext =>
  ({
    dataMode: 'unavailable',
    providers: [],
    articlesRetrieved: 0,
    retrievalOutcome: 'CLARIFICATION_REQUIRED',
    ...over,
  }) as AnalysisRetrievalContext;

describe('MC-070 — a first-turn continuation names no earlier subject and keeps the place', () => {
  it('EN', () => {
    const r = resolveAskedNotSearched(
      ctx({ clarificationReason: 'NO_PRIOR_SUBJECT', clarificationCandidates: ['KEN'] }),
      'en',
    );
    expect(r?.code).toBe('NO_PRIOR_SUBJECT');
    expect(r?.sentence).toBe(
      "There's no earlier question to continue. What would you like to know about this place?",
    );
    expect(r?.places).toEqual(['Kenya']);
  });

  it('PL', () => {
    const r = resolveAskedNotSearched(
      ctx({ clarificationReason: 'NO_PRIOR_SUBJECT', clarificationCandidates: ['KEN'] }),
      'pl',
    );
    expect(r?.sentence).toBe(
      'Nie ma wcześniejszego pytania do kontynuowania. Co chcesz wiedzieć o tym miejscu?',
    );
    expect(r?.places).toEqual(['Kenia']);
  });
});

describe('MC-055 — the reader’s own saved stories', () => {
  it('signed out: sign in (EN / PL, Product ruling)', () => {
    const en = resolveAskedNotSearched(ctx({ clarificationReason: 'IDENTITY_REQUIRED' }), 'en');
    const pl = resolveAskedNotSearched(ctx({ clarificationReason: 'IDENTITY_REQUIRED' }), 'pl');
    expect(en?.sentence).toBe('Sign in to compare your saved stories.');
    expect(pl?.sentence).toBe('Zaloguj się, aby porównać zapisane artykuły.');
    expect(en?.places).toEqual([]);
  });

  it('signed in: not available yet (EN / PL, Product ruling)', () => {
    const en = resolveAskedNotSearched(
      ctx({ clarificationReason: 'PERSONAL_LIBRARY_UNAVAILABLE' }),
      'en',
    );
    const pl = resolveAskedNotSearched(
      ctx({ clarificationReason: 'PERSONAL_LIBRARY_UNAVAILABLE' }),
      'pl',
    );
    expect(en?.sentence).toBe("Comparing your saved stories isn't available yet.");
    expect(pl?.sentence).toBe('Porównywanie zapisanych artykułów nie jest jeszcze dostępne.');
  });
});

describe('every other state is untouched', () => {
  it.each([
    ctx({ clarificationReason: 'AMBIGUOUS_COUNTRY', clarificationCandidates: ['COD', 'COG'] }),
    ctx({ clarificationReason: 'COMPARISON_MEMBERS_UNDETERMINED' }),
    ctx({ retrievalOutcome: undefined }),
  ])('%#', (c) => {
    expect(resolveAskedNotSearched(c, 'en')).toBeUndefined();
  });
});
