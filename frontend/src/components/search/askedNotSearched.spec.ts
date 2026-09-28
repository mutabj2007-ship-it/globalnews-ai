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
  type Scope = 'SAVED_STORIES' | 'INTERESTS' | undefined;
  const sentence = (
    reason: 'IDENTITY_REQUIRED' | 'PERSONAL_LIBRARY_UNAVAILABLE',
    scope: Scope,
    lang: 'en' | 'pl',
  ) =>
    resolveAskedNotSearched(
      ctx({ clarificationReason: reason, clarificationPersonalScope: scope }),
      lang,
    )?.sentence;

  it.each([
    ['SAVED_STORIES', 'en', 'Sign in to compare your saved stories.'],
    ['SAVED_STORIES', 'pl', 'Zaloguj się, aby porównać zapisane artykuły.'],
    ['INTERESTS', 'en', 'Sign in to use your interests.'],
    ['INTERESTS', 'pl', 'Zaloguj się, aby korzystać ze swoich zainteresowań.'],
    [undefined, 'en', 'Sign in to use your saved information.'],
    [undefined, 'pl', 'Zaloguj się, aby korzystać z zapisanych informacji.'],
  ] as const)('signed out · %s %s', (scope, lang, text) => {
    expect(sentence('IDENTITY_REQUIRED', scope, lang)).toBe(text);
  });

  it.each([
    ['SAVED_STORIES', 'en', "Comparing your saved stories isn't available yet."],
    ['SAVED_STORIES', 'pl', 'Porównywanie zapisanych artykułów nie jest jeszcze dostępne.'],
    ['INTERESTS', 'en', "Using your interests isn't available yet."],
    ['INTERESTS', 'pl', 'Korzystanie z zainteresowań nie jest jeszcze dostępne.'],
    [undefined, 'en', "Your saved information isn't available here yet."],
    [undefined, 'pl', 'Twoje zapisane informacje nie są jeszcze tutaj dostępne.'],
  ] as const)('signed in, unavailable · %s %s', (scope, lang, text) => {
    expect(sentence('PERSONAL_LIBRARY_UNAVAILABLE', scope, lang)).toBe(text);
  });

  it('an interests question never receives the saved-stories words; no place chip', () => {
    for (const lang of ['en', 'pl'] as const)
      for (const reason of ['IDENTITY_REQUIRED', 'PERSONAL_LIBRARY_UNAVAILABLE'] as const)
        expect(sentence(reason, 'INTERESTS', lang)).not.toMatch(
          /saved stories|zapisan\p{L}* artykuł/u,
        );
    expect(
      resolveAskedNotSearched(ctx({ clarificationReason: 'IDENTITY_REQUIRED' }), 'en')?.places,
    ).toEqual([]);
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
