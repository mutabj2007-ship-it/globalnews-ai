import type { NewsArticle } from '@globalnews-ai/shared';

import { deriveGeographicPrecision, withDerivedEvidenceFields } from './geographic-precision.util';

/*
 * THE RESTORED M1.0A PRODUCER, PINNED.
 *
 * The field it writes was unwritten in the C907 line, which made
 * `evidenceDisplayCeiling` a constant and the Alpha evidence rail
 * self-contradictory. These cases exist so that regression cannot recur
 * silently, and so the one rule that matters — article evidence may set
 * precision, query association may never — is enforced by test and not by
 * comment.
 */

const article = (over: Partial<NewsArticle> = {}): NewsArticle =>
  ({
    id: 'a1',
    title: 't',
    summary: 's',
    url: 'https://example.invalid/a1',
    sourceId: 'src',
    sourceName: 'Src',
    category: 'world',
    sourcesCount: 1,
    publishedAt: '2026-09-01T00:00:00.000Z',
    ...over,
  }) as NewsArticle;

describe("the article's own countryCode → COUNTRY", () => {
  it('derives country when a country was resolved from the article', () => {
    expect(deriveGeographicPrecision({ countryCode: 'IR' })).toBe('country');
  });

  it('writes it onto the article', () => {
    expect(withDerivedEvidenceFields(article({ countryCode: 'IR' })).geographicPrecision).toBe(
      'country',
    );
  });
});

describe('an unresolved article → UNKNOWN', () => {
  it('derives unknown when no country was resolved', () => {
    expect(deriveGeographicPrecision({})).toBe('unknown');
    expect(deriveGeographicPrecision({ countryCode: undefined })).toBe('unknown');
  });

  it('treats an empty string as no country, never as a resolution', () => {
    expect(deriveGeographicPrecision({ countryCode: '' })).toBe('unknown');
  });

  it('still writes the field, so "assessed" and "absent" are distinguishable', () => {
    /* The field being PRESENT is what the consumer needs: it means the product
       looked. An absent field is what made the ceiling a silent constant. */
    expect(withDerivedEvidenceFields(article()).geographicPrecision).toBe('unknown');
  });
});

describe('retrievalContext country can never raise article precision', () => {
  /*
    ENFORCED BY CONSTRUCTION, AND ASSERTED ANYWAY. The producer takes only
    `countryCode`, has no parameter for a retrieval context, and its module
    imports nothing that carries one. These cases pin the consequence: two
    articles that differ only in retrieval association are indistinguishable to
    it, because retrieval association never reaches it.
  */
  it('an article with no country of its own stays unknown whatever retrieval aimed at', () => {
    /* A retrieval that targeted Iran cannot make this article Iranian. */
    expect(withDerivedEvidenceFields(article()).geographicPrecision).toBe('unknown');
  });

  it('the producer accepts nothing but a country code', () => {
    const asRecord = deriveGeographicPrecision as unknown as (input: unknown) => string;
    /* A retrieval-shaped object contributes nothing: no countryCode, so unknown. */
    expect(asRecord({ retrievalContext: { countryCode: 'IR' }, city: 'Tehran' })).toBe('unknown');
  });
});

describe('provider-supplied precision is preserved and never overwritten', () => {
  it('a finer provider precision survives derivation', () => {
    const supplied = article({ countryCode: 'IR', geographicPrecision: 'city' });
    expect(withDerivedEvidenceFields(supplied).geographicPrecision).toBe('city');
  });

  it('a provider unknown is not "corrected" upward by a resolved country', () => {
    /* The provider knew more than countryCode does. Deriving over it would be
       manufacturing precision from an association. */
    const supplied = article({ countryCode: 'IR', geographicPrecision: 'unknown' });
    expect(withDerivedEvidenceFields(supplied).geographicPrecision).toBe('unknown');
  });

  it('the article object is returned untouched when precision already exists', () => {
    const supplied = article({ geographicPrecision: 'coordinate' });
    expect(withDerivedEvidenceFields(supplied)).toBe(supplied);
  });
});
