import type { NewsArticle } from '@globalnews-ai/shared';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  articleHost,
  normalizeArticleUrl,
  normalizeHeadline,
  TRACKING_QUERY_PARAMETERS,
} from '@globalnews-ai/shared';
import { areLikelyDuplicateArticles } from '../country/deduplicate-articles.util';
import {
  collapseDuplicateStories,
  isSameStoryByCorroboratedHeadline,
  resolveStrongIdentity,
} from './article-identity.util';

/**
 * R4 — the homepage semantic duplicate correction.
 *
 * These tests are written to fail in BOTH directions. Half of them prove a
 * duplicate is collapsed; the other half prove that records which merely
 * resemble one another are NOT, because a deduplicator that is only tested
 * on the merging half is a deduplicator nobody can safely tighten later.
 *
 * The fixture headline is the story the CTO observed duplicated on the
 * homepage rail.
 */
const OBSERVED_HEADLINE = 'Solvit et Titus marks 60 years of Ultraman with limited-edition watches';

function article(overrides: Partial<NewsArticle> & Pick<NewsArticle, 'id'>): NewsArticle {
  return {
    title: OBSERVED_HEADLINE,
    summary: 'Summary',
    url: `https://watchesnews.example/${overrides.id}`,
    imageUrl: 'https://cdn.watchesnews.example/ultraman-60.jpg',
    sourceId: 'watchesnews',
    sourceName: 'Watches News',
    category: 'business',
    sourcesCount: 1,
    publishedAt: '2026-08-25T09:00:00.000Z',
    // R4 GDELT — this fixture models a GNEWS article, and GNewsProvider now
    // stamps every record it emits with a proven publisher basis. Rung 3
    // refuses to compare timestamps whose bases differ or are unproven, so
    // a fixture without this field would be testing the guard rather than
    // the window. The assertions are unchanged; only the fixture caught up
    // with what the provider actually produces.
    publishedAtBasis: 'publisher' as const,
    ...overrides,
  };
}

describe('normalizeArticleUrl — removes only what cannot change which article is addressed', () => {
  it('removes a fragment', () => {
    expect(normalizeArticleUrl('https://a.example/story#section-2')).toBe(
      'https://a.example/story',
    );
  });

  it('lowercases the host but never the path', () => {
    expect(normalizeArticleUrl('https://A.EXAMPLE/Story/Ultraman')).toBe(
      'https://a.example/Story/Ultraman',
    );
  });

  it('removes a default port and keeps a non-default one', () => {
    expect(normalizeArticleUrl('https://a.example:443/story')).toBe('https://a.example/story');
    expect(normalizeArticleUrl('http://a.example:80/story')).toBe('http://a.example/story');
    expect(normalizeArticleUrl('https://a.example:8443/story')).toBe(
      'https://a.example:8443/story',
    );
  });

  it('removes one trailing slash, including the root form', () => {
    expect(normalizeArticleUrl('https://a.example/story/')).toBe('https://a.example/story');
    // Both spellings of a bare origin address one resource, so they fold
    // to one identity rather than being kept apart by a rendering detail.
    expect(normalizeArticleUrl('https://a.example/')).toBe('https://a.example');
    expect(normalizeArticleUrl('https://a.example')).toBe('https://a.example');
  });

  it('leaves a slash that is not the final character alone', () => {
    expect(normalizeArticleUrl('https://a.example/section/?page=2')).toBe(
      'https://a.example/section/?page=2',
    );
  });

  it('removes every declared tracking parameter', () => {
    TRACKING_QUERY_PARAMETERS.forEach((name) => {
      expect({
        name,
        normalized: normalizeArticleUrl(`https://a.example/story?${name}=whatever`),
      }).toEqual({ name, normalized: 'https://a.example/story' });
    });
  });

  /**
   * THE FAILURE DIRECTION THAT MATTERS. A parameter this list does not
   * know about might select a different article, so it is kept.
   */
  it('preserves an unknown parameter, and one that changes identity', () => {
    expect(normalizeArticleUrl('https://a.example/story?page=2')).toBe(
      'https://a.example/story?page=2',
    );
    expect(normalizeArticleUrl('https://a.example/story?id=88&utm_source=x')).toBe(
      'https://a.example/story?id=88',
    );
    // utm_page is NOT on the list: a prefix rule would have eaten it.
    expect(normalizeArticleUrl('https://a.example/story?utm_page=3')).toContain('utm_page=3');
  });

  /**
   * THE FIVE CONTENT-SELECTOR PARAMETERS — the correction an independent
   * audit required, as five explicit negative controls.
   *
   * `ref`, `source`, `src`, `sh` and `partner` were on the first draft's
   * tracking list. They are ordinary English words in no reserved
   * namespace, and a CMS is free to use any of them as an edition,
   * section, feed or variant selector. With them on the list, two
   * DIFFERENT articles at one scheme+host+path collapsed to one and the
   * second was dropped silently — reproduced by the audit against the
   * shipped normalizer, not hypothesised.
   *
   * EACH CONTROL USES DIFFERENT HEADLINES ON PURPOSE. That takes rung 3
   * out of the picture entirely, so the only thing that can keep the pair
   * apart is the URL rung — which is exactly the rung under test, and the
   * rung that in production decides every live article's identity because
   * GNews issues no providerRecordId.
   */
  const CONTENT_SELECTORS = ['ref', 'source', 'src', 'sh', 'partner'] as const;

  it.each(CONTENT_SELECTORS)('?%s=A and ?%s=B remain DIFFERENT urls', (name) => {
    expect(normalizeArticleUrl(`https://a.example/story?${name}=A`)).not.toBe(
      normalizeArticleUrl(`https://a.example/story?${name}=B`),
    );
    // And the value survives verbatim rather than being quietly dropped.
    expect(normalizeArticleUrl(`https://a.example/story?${name}=A`)).toContain(`${name}=A`);
  });

  it.each(CONTENT_SELECTORS)('none of the five is on the tracking list any more (%s)', (name) => {
    expect(TRACKING_QUERY_PARAMETERS).not.toContain(name);
  });

  it('`referrer` is kept on the list — it names the HTTP concept, not a document', () => {
    expect(TRACKING_QUERY_PARAMETERS).toContain('referrer');
    expect(normalizeArticleUrl('https://a.example/story?referrer=twitter')).toBe(
      'https://a.example/story',
    );
  });

  /**
   * The end-to-end shape of the loss the audit reproduced: two genuinely
   * different articles, one path, differing only in a content selector.
   */
  it.each(CONTENT_SELECTORS)(
    'two different articles differing only in ?%s= are BOTH kept',
    (name) => {
      const first = article({
        id: 'sel-1',
        title: 'Wire feed A: quarterly figures published',
        url: `https://a.example/story?${name}=A`,
        imageUrl: 'https://cdn.a.example/one.jpg',
      });
      const second = article({
        id: 'sel-2',
        title: 'Wire feed B: a completely different report',
        url: `https://a.example/story?${name}=B`,
        imageUrl: 'https://cdn.a.example/two.jpg',
      });

      expect(collapseDuplicateStories([first, second]).map((a) => a.id)).toEqual([
        'sel-1',
        'sel-2',
      ]);
    },
  );

  /**
   * THE OTHER HALF OF THE CORRECTION. Removing the five must not weaken
   * the categories that are genuinely inert, so each is re-proven by
   * category rather than left to the blanket loop above.
   */
  it('the utm namespace still normalizes away — the category that closes the observed defect', () => {
    [
      'utm_source',
      'utm_medium',
      'utm_campaign',
      'utm_term',
      'utm_content',
      'utm_id',
      'utm_name',
      'utm_reader',
      'utm_brand',
      'utm_social',
      'utm_social_type',
    ].forEach((name) => {
      expect({ name, out: normalizeArticleUrl(`https://a.example/story?${name}=x`) }).toEqual({
        name,
        out: 'https://a.example/story',
      });
    });
  });

  it('ad-click identifiers still normalize away — minted by the ad platform, never by the publisher', () => {
    ['gclid', 'dclid', 'gbraid', 'wbraid', 'fbclid', 'msclkid', 'twclid', 'igshid'].forEach(
      (name) => {
        expect({ name, out: normalizeArticleUrl(`https://a.example/story?${name}=x`) }).toEqual({
          name,
          out: 'https://a.example/story',
        });
      },
    );
  });

  it('email-campaign and platform-internal identifiers still normalize away', () => {
    ['mc_cid', 'mc_eid', '__twitter_impression'].forEach((name) => {
      expect({ name, out: normalizeArticleUrl(`https://a.example/story?${name}=x`) }).toEqual({
        name,
        out: 'https://a.example/story',
      });
    });
  });

  /**
   * `CMP` IS NO LONGER IN THIS LIST — see the block below. `cmpid` stays,
   * and carries the same publisher convention unambiguously.
   */
  it('accepted publisher house-analytics parameters still normalize away', () => {
    ['cmpid', 'ito', 'at_medium', 'at_campaign', 'ncid', 'smid', 'referrer'].forEach((name) => {
      expect({ name, out: normalizeArticleUrl(`https://a.example/story?${name}=x`) }).toEqual({
        name,
        out: 'https://a.example/story',
      });
    });
  });

  /**
   * ── `CMP` / `cmp`, THE SIXTH REMOVED NAME ─────────────────────────────
   *
   * `CMP` was on the list as the Guardian/Telegraph campaign convention,
   * spelled upper case because that is how those publishers emit it. But
   * `TRACKING_PARAMETER_SET` lowercases every entry and the lookup
   * lowercases the incoming name, so ONE entry spelled `CMP` stripped
   * `?cmp=`, `?Cmp=` and `?CMP=` alike — and `cmp` reads most naturally as
   * "compare", which a CMS is free to use as a comparison or variant
   * selector.
   *
   * It therefore failed the standard recorded in `storyIdentity.ts` on its
   * own third limb: a documented house convention, yes, but ALSO an
   * ordinary word. Unlike the five above, no loss was reproduced in the
   * wild — this one is removed on the rule alone, because Alpha closure
   * asks the list to contain only what is proven inert.
   *
   * THE CASE VARIANTS ARE ASSERTED SEPARATELY AND DELIBERATELY. The defect
   * was case-insensitivity, so a control that only exercised `CMP` would
   * pass against a list that still carried `cmp`, and vice versa.
   */
  const CMP_SPELLINGS = ['cmp', 'Cmp', 'CMP'] as const;

  it('neither `CMP` nor `cmp` is on the tracking list any more', () => {
    CMP_SPELLINGS.forEach((spelling) => {
      expect(
        TRACKING_QUERY_PARAMETERS.some((name) => name.toLowerCase() === spelling.toLowerCase()),
      ).toBe(false);
    });
  });

  it.each(CMP_SPELLINGS)('?%s=A and ?%s=B remain DIFFERENT urls', (spelling) => {
    expect(normalizeArticleUrl(`https://a.example/story?${spelling}=A`)).not.toBe(
      normalizeArticleUrl(`https://a.example/story?${spelling}=B`),
    );
    // And the value survives verbatim rather than being quietly dropped.
    expect(normalizeArticleUrl(`https://a.example/story?${spelling}=A`)).toContain(`${spelling}=A`);
  });

  it.each(CMP_SPELLINGS)(
    'two different articles differing only in ?%s= are BOTH kept',
    (spelling) => {
      const first = article({
        id: 'cmp-1',
        title: 'Comparison A: the first model reviewed',
        url: `https://a.example/story?${spelling}=A`,
        imageUrl: 'https://cdn.a.example/one.jpg',
      });
      const second = article({
        id: 'cmp-2',
        title: 'Comparison B: an entirely different model reviewed',
        url: `https://a.example/story?${spelling}=B`,
        imageUrl: 'https://cdn.a.example/two.jpg',
      });

      expect(collapseDuplicateStories([first, second]).map((a) => a.id)).toEqual([
        'cmp-1',
        'cmp-2',
      ]);
    },
  );

  /**
   * `cmpid` IS NOT COLLATERAL DAMAGE. Removing `CMP` must not remove the
   * publisher convention it shared, and `cmpid` is no prefix of `cmp` in
   * the direction that matters — the lookup is exact-name, not prefix.
   */
  it('`cmpid` still normalizes away in every case spelling', () => {
    ['cmpid', 'CMPID', 'CmpId'].forEach((spelling) => {
      expect({
        spelling,
        out: normalizeArticleUrl(`https://a.example/story?${spelling}=x`),
      }).toEqual({ spelling, out: 'https://a.example/story' });
    });
  });

  it('the observed Ultraman pair is still collapsed by the utm category alone', () => {
    expect(
      normalizeArticleUrl(
        'https://watchesnews.example/solvit-et-titus-ultraman-60?utm_source=gnews&utm_medium=rss',
      ),
    ).toBe(normalizeArticleUrl('https://watchesnews.example/solvit-et-titus-ultraman-60'));
  });

  it('preserves the original order of surviving parameters', () => {
    expect(normalizeArticleUrl('https://a.example/s?b=2&a=1')).toBe('https://a.example/s?b=2&a=1');
  });

  it('fails closed on an unparseable url — trimmed, never rewritten', () => {
    expect(normalizeArticleUrl('  not a url  ')).toBe('not a url');
    expect(normalizeArticleUrl('')).toBe('');
  });

  it('two genuinely different articles never normalize together', () => {
    expect(normalizeArticleUrl('https://a.example/story-one')).not.toBe(
      normalizeArticleUrl('https://a.example/story-two'),
    );
  });
});

describe('normalizeHeadline — a spelling normalizer, not a similarity measure', () => {
  it('folds case, typography and whitespace', () => {
    expect(normalizeHeadline('  Solvit  et   Titus’ “60 Years” — Ultraman…  ')).toBe(
      'solvit et titus\' "60 years" - ultraman...',
    );
  });

  it('leaves two headlines that differ by one word different', () => {
    expect(normalizeHeadline('Talks resume in Geneva')).not.toBe(
      normalizeHeadline('Talks collapse in Geneva'),
    );
  });
});

describe('articleHost', () => {
  it('returns the lowercased host, and empty for an unparseable url', () => {
    expect(articleHost('https://WWW.A.example/story')).toBe('www.a.example');
    expect(articleHost('nonsense')).toBe('');
  });
});

describe('resolveStrongIdentity — the ladder, strongest rung first', () => {
  it('prefers provider-native identity when the provider issues one', () => {
    const identity = resolveStrongIdentity(
      article({ id: 'gnews-1', providerId: 'gnews', providerRecordId: 'REC-99' }),
    );
    expect(identity).toBe('provider:gnews:REC-99');
  });

  it('falls back to normalized url when there is no provider record id', () => {
    expect(resolveStrongIdentity(article({ id: 'gnews-1', url: 'https://A.example/s/' }))).toBe(
      'url:https://a.example/s',
    );
  });

  it('returns null when the article offers neither', () => {
    expect(resolveStrongIdentity(article({ id: 'gnews-1', url: '' }))).toBeNull();
  });
});

describe('isSameStoryByCorroboratedHeadline — rung 3, exercised directly', () => {
  it('requires an exact headline, corroboration and the bounded window together', () => {
    const base = article({ id: '1' });

    // All three present.
    expect(
      isSameStoryByCorroboratedHeadline(
        base,
        article({ id: '2', url: 'https://watchesnews.example/other' }),
      ),
    ).toBe(true);

    // Headline differs by one word.
    expect(
      isSameStoryByCorroboratedHeadline(
        base,
        article({ id: '2', title: `${OBSERVED_HEADLINE} recalled` }),
      ),
    ).toBe(false);

    // No corroboration: different host, different image.
    expect(
      isSameStoryByCorroboratedHeadline(
        base,
        article({
          id: '2',
          url: 'https://elsewhere.example/x',
          imageUrl: 'https://cdn.elsewhere.example/x.jpg',
        }),
      ),
    ).toBe(false);

    // Outside the window.
    expect(
      isSameStoryByCorroboratedHeadline(
        base,
        article({ id: '2', publishedAt: '2026-08-26T09:00:00.000Z' }),
      ),
    ).toBe(false);
  });

  it('refuses an empty headline rather than matching every other empty one', () => {
    expect(
      isSameStoryByCorroboratedHeadline(
        article({ id: '1', title: '' }),
        article({ id: '2', title: '' }),
      ),
    ).toBe(false);
  });

  it('a daily column reusing one headline is NOT collapsed', () => {
    const today = article({
      id: '1',
      title: 'Morning Briefing',
      publishedAt: '2026-08-25T06:00:00.000Z',
    });
    const tomorrow = article({
      id: '2',
      title: 'Morning Briefing',
      url: 'https://watchesnews.example/briefing-2',
      publishedAt: '2026-08-26T06:00:00.000Z',
    });

    expect(isSameStoryByCorroboratedHeadline(today, tomorrow)).toBe(false);
    expect(collapseDuplicateStories([today, tomorrow])).toHaveLength(2);
  });
});

describe('MANDATORY 1 — the exact same article id is emitted once', () => {
  it('collapses a repeated id', () => {
    const once = article({ id: 'gnews-111' });
    const twice = article({ id: 'gnews-111' });

    expect(collapseDuplicateStories([once, twice]).map((a) => a.id)).toEqual(['gnews-111']);
  });
});

describe('MANDATORY 2 — different ids, same canonical url, emitted once', () => {
  it('collapses two ids that address one url', () => {
    const first = article({ id: 'gnews-111', url: 'https://watchesnews.example/ultraman-60' });
    const second = article({ id: 'gnews-222', url: 'https://watchesnews.example/ultraman-60' });

    const collapsed = collapseDuplicateStories([first, second]);

    expect(collapsed).toHaveLength(1);
    expect(collapsed[0].id).toBe('gnews-111');
  });
});

describe('MANDATORY 3 — tracking-parameter variants are emitted once', () => {
  it('collapses utm, fbclid and gclid variants of one address', () => {
    const plain = article({ id: 'gnews-1', url: 'https://watchesnews.example/ultraman-60' });
    const utm = article({
      id: 'gnews-2',
      url: 'https://watchesnews.example/ultraman-60?utm_source=newsletter&utm_medium=email',
    });
    const social = article({
      id: 'gnews-3',
      url: 'https://watchesnews.example/ultraman-60?fbclid=abc123',
    });
    const ads = article({
      id: 'gnews-4',
      url: 'https://watchesnews.example/ultraman-60?gclid=xyz789',
    });

    const collapsed = collapseDuplicateStories([plain, utm, social, ads]);

    expect(collapsed.map((a) => a.id)).toEqual(['gnews-1']);
  });
});

describe('MANDATORY 4 — fragment and trailing-slash variants are emitted once', () => {
  it('collapses fragment, trailing slash and host case together', () => {
    const canonical = article({ id: 'gnews-1', url: 'https://watchesnews.example/ultraman-60' });
    const fragment = article({
      id: 'gnews-2',
      url: 'https://watchesnews.example/ultraman-60#gallery',
    });
    const slash = article({ id: 'gnews-3', url: 'https://watchesnews.example/ultraman-60/' });
    const hostCase = article({ id: 'gnews-4', url: 'https://WatchesNews.example/ultraman-60' });

    expect(collapseDuplicateStories([canonical, fragment, slash, hostCase])).toHaveLength(1);
  });
});

describe('MANDATORY 5 — a provider alias does not preserve a duplicate copy', () => {
  /**
   * The same record offered under two provider aliases, i.e. two
   * `providerId` values with two namespaced ids, addressing one url.
   * Provider-native identity does not match, so the url rung must decide.
   */
  it('collapses one url carried under two provider aliases', () => {
    const alias = article({
      id: 'gnews-1',
      providerId: 'gnews',
      url: 'https://watchesnews.example/ultraman-60',
    });
    const otherAlias = article({
      id: 'gnews-syndicated-1',
      providerId: 'gnews-alias',
      url: 'https://watchesnews.example/ultraman-60?utm_campaign=alias',
    });

    const collapsed = collapseDuplicateStories([alias, otherAlias]);

    expect(collapsed).toHaveLength(1);
    // Provenance of the RETAINED record is untouched.
    expect(collapsed[0].providerId).toBe('gnews');
    expect(collapsed[0].sourceName).toBe('Watches News');
  });
});

describe('MANDATORY 6 — exact headline/source/time identity, when url identity is unavailable', () => {
  it('collapses one story published at two addresses on the same host', () => {
    const first = article({ id: 'gnews-1', url: 'https://watchesnews.example/ultraman-60' });
    const second = article({
      id: 'gnews-2',
      url: 'https://watchesnews.example/2026/08/ultraman-anniversary',
      publishedAt: '2026-08-25T10:30:00.000Z',
    });

    const collapsed = collapseDuplicateStories([first, second]);

    expect(collapsed.map((a) => a.id)).toEqual(['gnews-1']);
  });

  it('collapses on a shared image when the hosts differ', () => {
    const first = article({ id: 'gnews-1', url: 'https://watchesnews.example/ultraman-60' });
    const syndicated = article({
      id: 'gnews-2',
      url: 'https://mirror.example/ultraman-60',
      sourceId: 'mirror',
      sourceName: 'Mirror',
    });

    expect(collapseDuplicateStories([first, syndicated])).toHaveLength(1);
  });

  /** Headline alone is never enough — that is what "corroborated" means. */
  it('keeps an identical headline from an unrelated outlet with a different image', () => {
    const first = article({ id: 'gnews-1' });
    const unrelated = article({
      id: 'gnews-2',
      url: 'https://other.example/ultraman',
      imageUrl: 'https://cdn.other.example/completely-different.jpg',
      sourceId: 'other',
      sourceName: 'Other',
    });

    expect(collapseDuplicateStories([first, unrelated])).toHaveLength(2);
  });

  it('keeps a recurring headline republished outside the bounded window', () => {
    const thisYear = article({ id: 'gnews-1', publishedAt: '2026-08-25T09:00:00.000Z' });
    const nextYear = article({
      id: 'gnews-2',
      url: 'https://watchesnews.example/ultraman-61',
      publishedAt: '2027-08-25T09:00:00.000Z',
    });

    expect(collapseDuplicateStories([thisYear, nextYear])).toHaveLength(2);
  });

  it('keeps both when a timestamp cannot be parsed — fails closed', () => {
    const good = article({ id: 'gnews-1' });
    const broken = article({
      id: 'gnews-2',
      url: 'https://watchesnews.example/ultraman-60-b',
      publishedAt: 'not-a-date',
    });

    expect(collapseDuplicateStories([good, broken])).toHaveLength(2);
  });
});

describe('MANDATORY 7 — similar headlines describing different updates both survive', () => {
  /**
   * THE TEST THAT PROTECTS READERS FROM THIS CORRECTION. Both headlines
   * score 0.8 against the repository's existing token-overlap function,
   * comfortably over its 0.72 threshold — so a naive widening of that
   * threshold's reach WOULD have merged two opposite outcomes into one.
   * The assertion on `areLikelyDuplicateArticles` is deliberate: it pins
   * the hazard, so if that utility is ever retuned this test explains why
   * this file did not reuse it.
   */
  it('keeps "talks resume" and "talks collapse" as two records', () => {
    const resume = article({
      id: 'gnews-1',
      title: 'Ukraine peace talks resume in Geneva',
      url: 'https://watchesnews.example/talks-resume',
    });
    const collapse = article({
      id: 'gnews-2',
      title: 'Ukraine peace talks collapse in Geneva',
      url: 'https://watchesnews.example/talks-collapse',
      publishedAt: '2026-08-25T11:00:00.000Z',
    });

    expect(areLikelyDuplicateArticles(resume, collapse)).toBe(true);
    expect(collapseDuplicateStories([resume, collapse]).map((a) => a.id)).toEqual([
      'gnews-1',
      'gnews-2',
    ]);
  });

  it('keeps a running story and its numbered update', () => {
    const first = article({
      id: 'gnews-1',
      title: 'Wildfire reaches the valley floor',
      url: 'https://watchesnews.example/fire-1',
    });
    const update = article({
      id: 'gnews-2',
      title: 'Wildfire reaches the valley floor: evacuation ordered',
      url: 'https://watchesnews.example/fire-2',
      publishedAt: '2026-08-25T12:00:00.000Z',
    });

    expect(collapseDuplicateStories([first, update])).toHaveLength(2);
  });
});

describe('MANDATORY 8 — one event from genuinely different perspectives is not collapsed', () => {
  it('keeps two outlets reporting the same event in their own words', () => {
    const businessAngle = article({
      id: 'gnews-1',
      title: 'Solvit et Titus posts record quarter on Ultraman collaboration',
      url: 'https://watchesnews.example/results',
      imageUrl: 'https://cdn.watchesnews.example/results.jpg',
    });
    const cultureAngle = article({
      id: 'gnews-2',
      title: 'Why Ultraman still sells watches sixty years on',
      url: 'https://culture.example/ultraman-sixty',
      imageUrl: 'https://cdn.culture.example/ultraman.jpg',
      sourceId: 'culture',
      sourceName: 'Culture Desk',
    });

    expect(collapseDuplicateStories([businessAngle, cultureAngle])).toHaveLength(2);
  });
});

describe('MANDATORY 9 — feed ordering remains deterministic', () => {
  it('preserves the caller order and keeps the first occurrence', () => {
    const input = [
      article({ id: 'a', url: 'https://watchesnews.example/a', title: 'Alpha' }),
      article({ id: 'b', url: 'https://watchesnews.example/b', title: 'Bravo' }),
      article({ id: 'a-dup', url: 'https://watchesnews.example/a?utm_source=x', title: 'Alpha' }),
      article({ id: 'c', url: 'https://watchesnews.example/c', title: 'Charlie' }),
    ];

    expect(collapseDuplicateStories(input).map((a) => a.id)).toEqual(['a', 'b', 'c']);
  });

  it('is stable across repeated runs of the same input', () => {
    const input = [
      article({ id: 'a', url: 'https://watchesnews.example/a', title: 'Alpha' }),
      article({ id: 'a2', url: 'https://watchesnews.example/a#x', title: 'Alpha' }),
      article({ id: 'b', url: 'https://watchesnews.example/b', title: 'Bravo' }),
    ];

    const runs = [0, 1, 2, 3, 4].map(() => collapseDuplicateStories(input).map((a) => a.id));
    runs.forEach((run) => expect(run).toEqual(runs[0]));
  });

  it('returns the input untouched when there is nothing that could collapse', () => {
    const single = [article({ id: 'only' })];
    expect(collapseDuplicateStories(single)).toBe(single);
    expect(collapseDuplicateStories([])).toEqual([]);
  });
});

describe('MANDATORY 10 — provenance stays attached to the retained record', () => {
  it('never mutates an article and never merges fields between them', () => {
    const kept = article({
      id: 'gnews-1',
      url: 'https://watchesnews.example/ultraman-60',
      sourceId: 'watchesnews',
      sourceName: 'Watches News',
      providerId: 'gnews',
      firstSeenAt: '2026-08-25T09:05:00.000Z',
    });
    const dropped = article({
      id: 'gnews-2',
      url: 'https://watchesnews.example/ultraman-60?utm_source=x',
      sourceId: 'somewhere-else',
      sourceName: 'Somewhere Else',
      providerId: 'other-provider',
      firstSeenAt: '2026-08-25T23:59:00.000Z',
    });

    const snapshot = JSON.stringify([kept, dropped]);
    const collapsed = collapseDuplicateStories([kept, dropped]);

    expect(collapsed).toHaveLength(1);
    expect(collapsed[0]).toBe(kept);
    expect(collapsed[0].sourceName).toBe('Watches News');
    expect(collapsed[0].providerId).toBe('gnews');
    expect(collapsed[0].firstSeenAt).toBe('2026-08-25T09:05:00.000Z');
    // Neither input object was touched.
    expect(JSON.stringify([kept, dropped])).toBe(snapshot);
  });
});

describe('MANDATORY 12 — the observed Ultraman duplicate is represented once', () => {
  /**
   * The shape the rail actually rendered: the SAME headline and the SAME
   * image on two adjacent cards, arriving as two ids because
   * GNewsProvider hashes the raw url.
   */
  it('collapses the observed pair', () => {
    const cardOne = article({
      id: 'gnews-1837462',
      url: 'https://watchesnews.example/solvit-et-titus-ultraman-60',
      providerId: 'gnews',
    });
    const cardTwo = article({
      id: 'gnews-905513',
      url: 'https://watchesnews.example/solvit-et-titus-ultraman-60?utm_source=gnews&utm_medium=rss',
      providerId: 'gnews',
      publishedAt: '2026-08-25T09:12:00.000Z',
    });

    const collapsed = collapseDuplicateStories([cardOne, cardTwo]);

    expect(collapsed).toHaveLength(1);
    expect(collapsed[0].title).toBe(OBSERVED_HEADLINE);
    expect(collapsed[0].id).toBe('gnews-1837462');
  });
});

describe('MUTATION GUARD — deleting a deduplication condition must fail a test', () => {
  /**
   * A source-level guard in this repository's established style. Each
   * condition below is load-bearing: remove it and one of the assertions
   * above stops holding. Naming them here means a future edit that
   * "simplifies" the ladder has to delete this list too, which is a
   * deliberate, reviewable act rather than a quiet one.
   */
  const util = readFileSync(join(__dirname, 'article-identity.util.ts'), 'utf8');
  const shared = readFileSync(
    join(__dirname, '..', '..', '..', '..', '..', 'shared', 'src', 'storyIdentity.ts'),
    'utf8',
  );

  it.each([
    ['provider-native rung', 'provider:${providerId}:${providerRecordId}'],
    ['normalized-url rung', 'url:${normalizeArticleUrl(url)}'],
    ['strong-identity short circuit', 'seenStrongIdentities.has(identity)'],
    ['corroborated-headline rung', 'isSameStoryByCorroboratedHeadline(existing, article)'],
    ['exact-headline requirement', 'firstHeadline !== normalizeHeadline(second.title'],
    ['corroboration requirement', 'if (!sameHost && !sameImage)'],
    ['bounded publication window', 'STORY_IDENTITY_MAX_PUBLICATION_GAP_MS'],
    ['unparseable-date fail-closed', 'Number.isNaN(firstAt) || Number.isNaN(secondAt)'],
  ])('the %s condition is present', (_label, condition) => {
    expect(util).toContain(condition);
  });

  it.each([
    ['fragment removal', "parsed.hash = ''"],
    ['host lowercasing', 'parsed.hostname.toLowerCase()'],
    ['tracking-parameter removal', 'TRACKING_PARAMETER_SET.has(name.toLowerCase())'],
    ['trailing-slash normalization', "normalized.endsWith('/')"],
  ])('the %s step is present in the shared normalizer', (_label, condition) => {
    expect(shared).toContain(condition);
  });

  /**
   * The behavioural half of the mutation guard: each of these inputs is
   * collapsed by EXACTLY ONE rung, so if that rung is deleted the
   * assertion fails rather than being masked by another.
   */
  it('each rung is individually load-bearing', () => {
    // provider rung only: different urls, different headlines.
    const p1 = article({
      id: 'x1',
      providerId: 'gnews',
      providerRecordId: 'R1',
      url: 'https://a.example/one',
      title: 'Alpha',
    });
    const p2 = article({
      id: 'x2',
      providerId: 'gnews',
      providerRecordId: 'R1',
      url: 'https://b.example/two',
      title: 'Bravo',
    });
    expect(collapseDuplicateStories([p1, p2])).toHaveLength(1);

    // url rung only: no provider record id, different headlines.
    const u1 = article({ id: 'y1', url: 'https://a.example/one', title: 'Alpha' });
    const u2 = article({ id: 'y2', url: 'https://a.example/one?utm_source=x', title: 'Bravo' });
    expect(collapseDuplicateStories([u1, u2])).toHaveLength(1);

    // headline rung only: different urls, no provider record id.
    const h1 = article({ id: 'z1', url: 'https://a.example/one', title: 'Gamma' });
    const h2 = article({ id: 'z2', url: 'https://a.example/two', title: 'Gamma' });
    expect(collapseDuplicateStories([h1, h2])).toHaveLength(1);
  });
});
