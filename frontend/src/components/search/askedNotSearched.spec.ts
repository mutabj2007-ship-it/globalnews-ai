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
      'There’s no earlier question to continue. What would you like to know about Kenya?',
    );
  });

  it('PL', () => {
    const r = resolveAskedNotSearched(
      ctx({ clarificationReason: 'NO_PRIOR_SUBJECT', clarificationCandidates: ['KEN'] }),
      'pl',
    );
    expect(r?.sentence).toBe(
      'Nie ma wcześniejszego pytania do kontynuowania. Co chcesz wiedzieć o: Kenia?',
    );
  });
});

describe('MC-055 — the reader’s own saved stories', () => {
  it('signed out: sign in, nothing searched (EN / PL)', () => {
    expect(
      resolveAskedNotSearched(ctx({ clarificationReason: 'IDENTITY_REQUIRED' }), 'en')?.body,
    ).toMatch(/needs you to be signed in.*nothing was searched/);
    expect(
      resolveAskedNotSearched(ctx({ clarificationReason: 'IDENTITY_REQUIRED' }), 'pl')?.body,
    ).toMatch(/wymaga zalogowania.*niczego nie wyszukano/);
  });

  it('signed in: the library is not reachable here, nothing searched in its place', () => {
    const r = resolveAskedNotSearched(
      ctx({ clarificationReason: 'PERSONAL_LIBRARY_UNAVAILABLE' }),
      'en',
    );
    expect(r?.heading).toBe('YOUR SAVED STORIES AREN’T AVAILABLE HERE');
    expect(r?.body).toMatch(/nothing was searched in their place/);
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
