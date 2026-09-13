import {
  extractRetainedQueryTerms,
  matchesRetainedQuery,
  retainedCandidateTerms,
} from './retained-query-match.util';

/**
 * G-GDELT-DOC-ALPHA-RELIABILITY-R1 — correction C.
 *
 * The defect these tests exist for: retained reporting required the WHOLE query
 * string as a contiguous substring, so a natural-language query could not match
 * anything at all. The first test is the live Alpha case.
 */

const article = (title: string, summary: string, category = 'world') =>
  ({ title, summary, category }) as Parameters<typeof matchesRetainedQuery>[0];

const DRC_QUERY = 'eastern Democratic Republic of Congo';

describe('extractRetainedQueryTerms', () => {
  it('keeps the country term as the DISTINCTIVE one — the inversion vs the anchor matcher', () => {
    const terms = extractRetainedQueryTerms(DRC_QUERY);
    expect(terms.distinctive).toContain('congo');
    expect(terms.supporting).toEqual(expect.arrayContaining(['eastern', 'democratic', 'republic']));
  });

  it('drops stopwords and tokens shorter than three characters', () => {
    const terms = extractRetainedQueryTerms(DRC_QUERY);
    const all = retainedCandidateTerms(terms);
    expect(all).not.toContain('of');
    expect(all).not.toContain('the');
  });

  it('is case-insensitive — the query may already be lower-cased by provider-safety', () => {
    expect(extractRetainedQueryTerms('eastern democratic republic of congo')).toEqual(
      extractRetainedQueryTerms(DRC_QUERY),
    );
  });

  it('de-duplicates repeated tokens', () => {
    const terms = extractRetainedQueryTerms('congo congo congo unrest');
    expect(terms.distinctive.filter((t) => t === 'congo')).toHaveLength(1);
  });
});

describe('matchesRetainedQuery — the case that was structurally impossible', () => {
  it('MATCHES a real article about eastern Congo without the contiguous query string', () => {
    const candidate = article(
      'Fighting intensifies in eastern Congo as M23 advances on Goma',
      'Clashes in the Democratic Republic of Congo displaced thousands across eastern Congo this week.',
    );

    // The precondition for the whole lane: the old predicate cannot match this.
    expect(`${candidate.title} ${candidate.summary}`.toLowerCase()).not.toContain(
      DRC_QUERY.toLowerCase(),
    );

    const result = matchesRetainedQuery(candidate, extractRetainedQueryTerms(DRC_QUERY));
    expect(result.isMatch).toBe(true);
    expect(result.matchedDistinctive).toContain('congo');
  });
});

describe('NEGATIVE CONTROLS — ordinary vocabulary must not admit anything', () => {
  const terms = extractRetainedQueryTerms(DRC_QUERY);

  it('rejects a story about the Democratic Party — "democratic" alone is not Congo', () => {
    const result = matchesRetainedQuery(
      article(
        'Democratic lawmakers press for a republic-wide vote',
        'The Democratic caucus said the republic must decide. Democratic leaders repeated the demand.',
      ),
      terms,
    );
    expect(result.isMatch).toBe(false);
    expect(result.matchedDistinctive).toHaveLength(0);
    expect(result.reason).toContain('no distinctive query term matched');
  });

  it('rejects an unrelated story that merely shares the word "eastern"', () => {
    const result = matchesRetainedQuery(
      article(
        'Eastern Europe braces for a cold winter',
        'Eastern European capitals are preparing. Eastern gas flows remain constrained.',
      ),
      terms,
    );
    expect(result.isMatch).toBe(false);
    expect(result.matchedDistinctive).toHaveLength(0);
  });

  it('rejects a Congo story that corroborates on NOTHING else — one term is not enough', () => {
    const result = matchesRetainedQuery(
      article('Congo confirms Congo squad for the tournament', 'Congo named its Congo squad today.'),
      terms,
    );
    expect(result.matchedDistinctive).toContain('congo');
    expect(result.isMatch).toBe(false);
    expect(result.reason).toContain('insufficient corroboration');
  });

  it('rejects a passing single mention — scoreGenericRelevance still needs two signals', () => {
    const result = matchesRetainedQuery(
      article('Regional summit opens', 'Delegates from Congo attended, alongside eastern partners.'),
      terms,
    );
    expect(result.isMatch).toBe(false);
  });

  it('rejects an empty article outright', () => {
    expect(matchesRetainedQuery(article('', ''), terms).isMatch).toBe(false);
  });
});

describe('the no-distinctive-term branch is stricter, exactly as the anchor rule is', () => {
  const terms = extractRetainedQueryTerms('semiconductor export controls');

  it('has no distinctive term when the query names no country', () => {
    expect(terms.distinctive).toHaveLength(0);
  });

  it('requires three supporting matches', () => {
    const two = matchesRetainedQuery(
      article(
        'Semiconductor rules tighten',
        'New semiconductor limits follow earlier export rules. Export volumes fell.',
      ),
      terms,
    );
    expect(two.isMatch).toBe(false);

    const three = matchesRetainedQuery(
      article(
        'Semiconductor export controls widened',
        'The semiconductor package extends export controls. Officials said controls now cover more export lines.',
      ),
      terms,
    );
    expect(three.matchedSupporting.length).toBeGreaterThanOrEqual(3);
    expect(three.isMatch).toBe(true);
  });
});

/*
 * REV A — THE PINNED "two Congos" LIMITATION IS REMOVED.
 *
 * R1 pinned, as a passing test, that a Republic of the Congo article satisfied
 * a Democratic Republic of Congo query. The CTO required that pin removed. It
 * is gone: admission is no longer decided by this file alone. The country
 * constraint now lives in `retained-country-gate.util.ts` and is asserted in
 * `retained-country-gate.util.spec.ts`, including the measured limit of what
 * the accepted geography authority can currently distinguish.
 */
