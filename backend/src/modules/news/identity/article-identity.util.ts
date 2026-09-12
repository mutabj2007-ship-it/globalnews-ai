import {
  articleHost,
  normalizeArticleUrl,
  normalizeHeadline,
  STORY_IDENTITY_MAX_PUBLICATION_GAP_MS,
  type NewsArticle,
} from '@globalnews-ai/shared';

/**
 * R4 — one underlying news story, recognised across the shapes a single
 * provider can hand the same article to us in.
 *
 * WHY THIS FILE EXISTS, AND WHY IT IS NOT cross-provider-dedup.util.ts.
 * That file solves the MULTI-PROVIDER seam and is reached only when more
 * than one provider contributed to a call:
 *
 *     const deduplicated =
 *       results.length > 1 ? collapseCrossProviderDuplicates(...) : merged;
 *
 * `news.module.ts` declares exactly ONE real news provider candidate, so
 * in the shipped configuration `results.length` is always 1 and that pass
 * never runs. Everything downstream — the homepage allocator, Global
 * Developments, Today, the analysis candidate pool — therefore received a
 * list that had been deduplicated on EXACT `id` and nothing else. Two
 * records of one story from the same provider survived intact, which is
 * the observed homepage duplicate.
 *
 * DELIBERATELY PURE: no NestJS, no Prisma, no clock, no I/O. The identity
 * rules can be executed in a test rather than pattern-matched, the same
 * way `capabilities.ts` isolates the role matrix and
 * `cors-startup-validator.ts` isolates its resolver.
 *
 * ── THE IDENTITY LADDER, STRONGEST RUNG FIRST ────────────────────────────
 *
 *   1. PROVIDER-NATIVE IDENTITY. `providerId` + `providerRecordId`, when
 *      the provider actually issues a stable record id of its own. This is
 *      the provider telling us "these are the same record"; nothing we
 *      derive can beat it.
 *   2. NORMALIZED URL IDENTITY. Exact equality after removing the
 *      differences that provably cannot change which article is being
 *      addressed. This is the rung that catches the real-world case:
 *      `GNewsProvider.buildStableId()` hashes the RAW url, so one article
 *      offered with a tracking parameter, a fragment, a trailing slash or
 *      a differently-cased host arrives as several different ids.
 *   3. CONSERVATIVE STORY IDENTITY. Only when the two rungs above cannot
 *      decide. See `isSameStoryByCorroboratedHeadline` for the reasoning
 *      and, more importantly, for what it deliberately refuses to merge.
 *
 * ── WHAT THIS FILE WILL NOT DO ───────────────────────────────────────────
 *
 * It does not use a fuzzy title threshold. The repository already has one
 * — `areLikelyDuplicateArticles`, token overlap >= 0.72 — and it is
 * correct for the job it was written for, comparing two PROVIDERS'
 * renderings of one wire story. It is not safe to point at one provider's
 * own feed, where consecutive updates of a developing story share almost
 * all their tokens. Worked example, scored against that very function:
 *
 *     "Ukraine peace talks resume in Geneva"
 *     "Ukraine peace talks collapse in Geneva"
 *        tokens {ukraine, peace, talk, resume, geneva}
 *             vs {ukraine, peace, talk, collapse, geneva}
 *        overlap = 4/5 = 0.8  >=  0.72   ->  MERGED
 *
 * Two opposite outcomes, one survivor. That is the failure mode this file
 * exists to avoid, so rung 3 requires an EXACT normalized headline and
 * refuses anything less.
 */

/**
 * The strongest identity key an article can offer on its own, or null
 * when it offers none.
 *
 * Rung 1 then rung 2. A `null` return is not a failure — it means this
 * article must be judged by rung 3, which needs a PAIR and so cannot be
 * expressed as a single key.
 */
export function resolveStrongIdentity(article: NewsArticle): string | null {
  const providerId = article.providerId?.trim();
  const providerRecordId = article.providerRecordId?.trim();

  if (providerId && providerRecordId) {
    return `provider:${providerId}:${providerRecordId}`;
  }

  const url = article.url?.trim();
  if (url) {
    return `url:${normalizeArticleUrl(url)}`;
  }

  return null;
}

/**
 * RUNG 3 — the conservative story identity, used only when neither
 * article offers a matching strong identity.
 *
 * THREE CONDITIONS, ALL REQUIRED:
 *
 *   1. AN EXACT NORMALIZED HEADLINE MATCH. Not a threshold, not a token
 *      overlap, not a prefix — the same headline, spelled the same way
 *      once case and typography are folded. A single different word and
 *      this returns false.
 *   2. CORROBORATION, from ONE of two independent directions:
 *        - the same source host, i.e. one outlet carrying one story under
 *          two addresses; or
 *        - the same image URL, which is what the observed homepage
 *          duplicate presented and is strong evidence of one asset.
 *      A headline alone is never enough. Two outlets can legitimately run
 *      a syndicated wire headline verbatim, and those are two genuine
 *      records with two genuine attributions.
 *   3. PUBLICATION WITHIN THE BOUNDED WINDOW above.
 *
 * WHAT THIS REFUSES TO MERGE, stated as plainly as what it merges:
 *   - two different updates of a developing story - different headlines;
 *   - the same event reported by two outlets in their own words -
 *     different headlines;
 *   - the same headline from two unrelated outlets with different images
 *     - no corroboration;
 *   - a recurring headline reused months later - outside the window.
 */
export function isSameStoryByCorroboratedHeadline(
  first: NewsArticle,
  second: NewsArticle,
): boolean {
  const firstHeadline = normalizeHeadline(first.title ?? '');
  if (firstHeadline.length === 0) {
    return false;
  }

  if (firstHeadline !== normalizeHeadline(second.title ?? '')) {
    return false;
  }

  const firstHost = articleHost(first.url ?? '');
  const sameHost = firstHost.length > 0 && firstHost === articleHost(second.url ?? '');

  const firstImage = first.imageUrl?.trim();
  const secondImage = second.imageUrl?.trim();
  const sameImage =
    firstImage !== undefined &&
    firstImage.length > 0 &&
    secondImage !== undefined &&
    normalizeArticleUrl(firstImage) === normalizeArticleUrl(secondImage);

  if (!sameHost && !sameImage) {
    return false;
  }

  /*
   * R4 GDELT — THE WINDOW MAY ONLY COMPARE LIKE WITH LIKE.
   *
   * This rung's whole justification is that two records published within
   * six hours of each other, under one exact headline, from one host, are
   * one story. That argument is about PUBLICATION times. It does not
   * survive a mixed comparison.
   *
   * GDELT DOC's timestamp is an OBSERVATION time, and the live capture
   * measured the gap: GDELT saw the Haberler article ~55 minutes after the
   * outlet published it. Comparing a publisher time against an observed
   * time therefore fails in BOTH directions:
   *
   *   - two records of one story merge or not depending on how long the
   *     aggregator took to notice it, not on when it was published;
   *   - two genuinely different articles whose observation times happen to
   *     cluster become eligible to merge on an exact-headline match.
   *
   * Neither failure is visible in the output. So the rule is: both records
   * must carry the SAME PROVEN basis, or the window is not consulted.
   *
   * ABSENT IS NOT 'publisher'. A record with no basis — every row reloaded
   * from the database, and every article produced before this field
   * existed — is UNPROVEN, and unproven cannot be shown to match anything.
   * Fail closed and keep both records.
   *
   * COST, STATED HONESTLY: this makes rung 3 unreachable for cached
   * articles, which previously could reach it. That is a deliberate
   * narrowing in the safe direction — the failure mode becomes "a
   * duplicate survived", never "two different articles merged". Rungs 1
   * and 2 (provider-native id, normalized URL) are unaffected and still
   * collapse the overwhelming majority of real duplicates, including every
   * cross-provider copy that shares a URL.
   */
  const firstBasis = first.publishedAtBasis;
  const secondBasis = second.publishedAtBasis;

  if (firstBasis === undefined || secondBasis === undefined || firstBasis !== secondBasis) {
    return false;
  }

  const firstAt = Date.parse(first.publishedAt ?? '');
  const secondAt = Date.parse(second.publishedAt ?? '');

  // An unparseable timestamp cannot be shown to be inside the window, so
  // it is not. Fail closed: keep both records.
  if (Number.isNaN(firstAt) || Number.isNaN(secondAt)) {
    return false;
  }

  return Math.abs(firstAt - secondAt) <= STORY_IDENTITY_MAX_PUBLICATION_GAP_MS;
}

/**
 * Collapse records of one story, preserving input order and keeping the
 * FIRST occurrence of each.
 *
 * ORDER IS THE CALLER'S EDITORIAL ORDER AND IS NOT REBUILT. The homepage
 * allocator, Global Developments and Today all treat array order as
 * meaningful, and this function must not become a hidden ranking. Keeping
 * the first occurrence is also what makes the result deterministic for a
 * deterministic input: no sort, no tie-break, no dependence on which
 * provider promise settled first.
 *
 * PROVENANCE SURVIVES ON THE RETAINED RECORD. Nothing here mutates an
 * article or copies fields between them, so the survivor keeps its own
 * `sourceId`, `sourceName`, `providerId`, `url` and `firstSeenAt`
 * untouched. A duplicate is dropped whole; it never overwrites part of
 * the record that is kept.
 *
 * COST. Rung 3 needs a pair, so the fallback comparison is quadratic in
 * the number of survivors. The strong-identity map absorbs the common
 * case first, and every caller here is bounded to a page of results
 * (the homepage requests twelve), so the pair loop runs over a handful of
 * records.
 */
export function collapseDuplicateStories(articles: NewsArticle[]): NewsArticle[] {
  if (articles.length < 2) {
    return articles;
  }

  const seenStrongIdentities = new Set<string>();
  const kept: NewsArticle[] = [];

  for (const article of articles) {
    const identity = resolveStrongIdentity(article);

    if (identity !== null) {
      if (seenStrongIdentities.has(identity)) {
        continue;
      }
    }

    if (kept.some((existing) => isSameStoryByCorroboratedHeadline(existing, article))) {
      continue;
    }

    if (identity !== null) {
      seenStrongIdentities.add(identity);
    }
    kept.push(article);
  }

  return kept;
}
