import type { NewsArticle } from '@globalnews-ai/shared';
import {
  extractAnchorTerms,
  buildAnchorRetrievalQuery,
  buildAnchorFallbackQuery,
  isMateriallyRelatedToAnchor,
  isCountryTerm,
} from './anchor-relevance.util';

/**
 * R4 ARTICLE-SPECIFIC EVIDENCE RELEVANCE — unit level.
 *
 * Every case below is bound to reporting the CTO actually observed in the
 * browser, not to invented copy. The Penang anchor and its seven unrelated
 * Australian companions are the exact Sources Dock that failed; the Airport
 * Chaplain / Tuvalu pair is the earlier control that proved the defect was
 * structural rather than one country's edge case.
 */

const PENANG_ANCHOR_TITLE =
  'Hotel worker charged with sexually assaulting Australian three-year-old in Penang';

function article(
  title: string,
  summary: string,
): Pick<NewsArticle, 'title' | 'summary' | 'category'> {
  return { title, summary, category: 'world' };
}

describe('isCountryTerm — a shared country is never evidence of a shared story', () => {
  it('rejects country names', () => {
    expect(isCountryTerm('Australia')).toBe(true);
    expect(isCountryTerm('Tuvalu')).toBe(true);
    expect(isCountryTerm('Rwanda')).toBe(true);
    expect(isCountryTerm('Poland')).toBe(true);
  });

  it('rejects the regular demonym forms', () => {
    expect(isCountryTerm('Australian')).toBe(true);
    expect(isCountryTerm('Tuvaluan')).toBe(true);
    expect(isCountryTerm('Rwandan')).toBe(true);
    expect(isCountryTerm('Malaysian')).toBe(true);
    expect(isCountryTerm('Indian')).toBe(true);
  });

  it('rejects the -land and irregular demonyms that the suffix rule alone would miss', () => {
    expect(isCountryTerm('Polish')).toBe(true);
    expect(isCountryTerm('Finnish')).toBe(true);
    expect(isCountryTerm('American')).toBe(true);
    expect(isCountryTerm('British')).toBe(true);
    expect(isCountryTerm('Dutch')).toBe(true);
  });

  it('does NOT mistake ordinary English words for ISO codes', () => {
    // 'AND' is Andorra's ISO3, 'ARM' Armenia's, 'ARE' the UAE's, 'CAN' Canada's,
    // 'NO' Norway's ISO2, 'IT' Italy's. Matching by code would delete real
    // headline vocabulary from the anchor's term set.
    for (const word of ['and', 'arm', 'are', 'can', 'no', 'it', 'is', 'at', 'in']) {
      expect(isCountryTerm(word)).toBe(false);
    }
  });

  it('keeps a city — a city is exactly the distinctive term this gate needs', () => {
    expect(isCountryTerm('Penang')).toBe(false);
  });

  it('DOCUMENTED LIMIT, pinned so it cannot be mistaken for a pass: an irregular demonym with no shared stem and no entry in the supplement is not recognised', () => {
    // 'Czech' shares no stem with 'Czechia' after suffix stripping and is not
    // in the irregular supplement. The consequence is bounded by design — see
    // isMateriallyRelatedToAnchor, where one uncaught term can never admit an
    // article on its own. This test exists so the limit stays visible rather
    // than being discovered later as a surprise.
    expect(isCountryTerm('Czech')).toBe(false);
  });
});

describe('extractAnchorTerms — the Penang anchor', () => {
  const terms = extractAnchorTerms(PENANG_ANCHOR_TITLE);

  it('treats Penang as the distinctive term', () => {
    expect(terms.distinctive).toContain('penang');
  });

  it('removes the country demonym entirely — it is neither distinctive nor supporting', () => {
    expect(terms.distinctive).not.toContain('australian');
    expect(terms.supporting).not.toContain('australian');
  });

  it('keeps the event vocabulary as supporting terms', () => {
    expect(terms.supporting).toEqual(expect.arrayContaining(['hotel', 'worker', 'charged']));
  });

  it('drops function words', () => {
    expect(terms.supporting).not.toContain('with');
    expect(terms.supporting).not.toContain('the');
  });
});

describe('buildAnchorRetrievalQuery — REGRESSION 1: the provider query is the story, not the country', () => {
  it('derives from the article and never becomes the bare country name', () => {
    const query = buildAnchorRetrievalQuery(extractAnchorTerms(PENANG_ANCHOR_TITLE));
    expect(query).toBeDefined();
    expect(query).not.toBe('Australia');
    expect((query as string).toLowerCase()).not.toContain('australia');
    expect(query).toContain('penang');
  });

  it('leads with the distinctive term and stays bounded — GNews ANDs its terms', () => {
    const query = buildAnchorRetrievalQuery(extractAnchorTerms(PENANG_ANCHOR_TITLE)) as string;
    expect(query.split(' ')[0]).toBe('penang');
    expect(query.split(' ').length).toBeLessThanOrEqual(4);
  });

  it('returns undefined rather than a guess when a headline has no usable term', () => {
    expect(buildAnchorRetrievalQuery(extractAnchorTerms('!!! ??? ...'))).toBeUndefined();
    expect(buildAnchorRetrievalQuery(extractAnchorTerms('In the of and'))).toBeUndefined();
  });

  it('the bounded narrower retry is the distinctive terms alone', () => {
    expect(buildAnchorFallbackQuery(extractAnchorTerms(PENANG_ANCHOR_TITLE))).toBe('penang');
    expect(buildAnchorFallbackQuery(extractAnchorTerms('Inflation rises again'))).toBeUndefined();
  });
});

describe('isMateriallyRelatedToAnchor — REGRESSION 3 and 4', () => {
  const terms = extractAnchorTerms(PENANG_ANCHOR_TITLE);

  /**
   * REGRESSION 3 — every one of these is a real story from the failing Sources
   * Dock. Each is genuinely about Australia. None is about this event.
   */
  const unrelatedAustralianReporting = [
    article(
      'Australian inflation climbs to a two-year high',
      'Inflation in Australia rose again last quarter, with the Australian Bureau of Statistics reporting broad price increases across housing and food.',
    ),
    article(
      'Puppet workshop brings a century-old craft back to life in Australia',
      'A puppet workshop in regional Australia is teaching the craft to a new generation of Australian makers.',
    ),
    article(
      'Man charged over the murder of an Irish mother in Australia',
      'A man has been charged with murder after an Irish mother was killed in Australia. Australian police said the man was arrested overnight.',
    ),
    article(
      'Japanese investment in Australian energy reaches a record',
      'Japanese investment in Australia hit a record this year, with Australian energy projects attracting the bulk of the new investment.',
    ),
    article(
      'Australia, Japan and the United States hold trilateral defence talks',
      'Defence ministers met for trilateral talks. Australia said the defence relationship remains central to Australian planning.',
    ),
  ];

  unrelatedAustralianReporting.forEach((candidate) => {
    it(`rejects "${candidate.title}"`, () => {
      expect(isMateriallyRelatedToAnchor(candidate, terms).isRelated).toBe(false);
    });
  });

  it('rejects the unrelated murder story even though it shares "charged" — one shared word is not a story', () => {
    const result = isMateriallyRelatedToAnchor(unrelatedAustralianReporting[2], terms);
    expect(result.isRelated).toBe(false);
    expect(result.matchedDistinctive).toHaveLength(0);
  });

  /** REGRESSION 4 — the same event, reported independently. */
  it('retains an independent report of the same Penang event', () => {
    const sameEvent = article(
      'Penang hotel employee charged over assault of Australian toddler',
      'A hotel worker in Penang has been charged after an Australian three-year-old was assaulted at the hotel. Police in Penang said the hotel worker appeared in court.',
    );
    const result = isMateriallyRelatedToAnchor(sameEvent, terms);
    expect(result.isRelated).toBe(true);
    expect(result.matchedDistinctive).toContain('penang');
  });

  it('rejects an unrelated story that merely names Penang once — geography alone is still not a relation', () => {
    const otherPenangStory = article(
      'Penang ferry terminal reopens after refurbishment',
      'The ferry terminal has reopened following a refurbishment programme.',
    );
    expect(isMateriallyRelatedToAnchor(otherPenangStory, terms).isRelated).toBe(false);
  });
});

describe('isMateriallyRelatedToAnchor — REGRESSION 5: the Tuvalu control', () => {
  const chaplainTerms = extractAnchorTerms(
    'The Airport Chaplain who has comforted travellers for thirty years',
  );

  const unrelatedTuvaluReporting = [
    article(
      'Tuvalu signs a new climate resilience agreement',
      'Tuvalu has signed an agreement on climate resilience. Tuvalu officials said the funding is critical.',
    ),
    article(
      'Fisheries revenue rises for Tuvalu',
      'Tuvalu reported higher fisheries revenue this year, with Tuvalu licensing more vessels.',
    ),
    article(
      'Tuvalu marks its national day',
      'Celebrations were held across Tuvalu. Tuvalu residents gathered for the national day.',
    ),
  ];

  unrelatedTuvaluReporting.forEach((candidate) => {
    it(`rejects "${candidate.title}" — sharing Tuvalu is not sharing a story`, () => {
      expect(isMateriallyRelatedToAnchor(candidate, chaplainTerms).isRelated).toBe(false);
    });
  });

  it('the country name cannot even be counted, in either direction', () => {
    const terms = extractAnchorTerms('Tuvalu chaplain honoured at Funafuti airport');
    expect(terms.distinctive).not.toContain('tuvalu');
    expect(terms.supporting).not.toContain('tuvalu');
  });
});

describe('isMateriallyRelatedToAnchor — the no-proper-noun headline is held to a stricter rule', () => {
  const terms = extractAnchorTerms('Inflation rises for a third consecutive month');

  it('contributes no distinctive terms', () => {
    expect(terms.distinctive).toHaveLength(0);
  });

  it('needs three independent supporting matches, not two', () => {
    const twoMatches = article(
      'Inflation rises again',
      'Inflation rose once more, and the rise in inflation surprised economists.',
    );
    expect(isMateriallyRelatedToAnchor(twoMatches, terms).isRelated).toBe(false);
  });
});

describe('Title Cased headlines carry no casing signal and must not become all-proper-noun', () => {
  it('falls through to the stricter supporting-only rule instead of calling every word a name', () => {
    const terms = extractAnchorTerms('Hotel Worker Charged Over Assault Of Toddler');
    expect(terms.distinctive).toHaveLength(0);
  });
});
