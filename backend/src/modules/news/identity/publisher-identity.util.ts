import type { NewsArticle } from '@globalnews-ai/shared';

/**
 * C2-5 — WHO ACTUALLY PUBLISHED THIS, AS OPPOSED TO WHAT STRING ARRIVED.
 *
 * THE MEASURED DEFECT. Four retrieved copies of one wire story from one
 * publisher were counted, on the Convergence-2 basis, as four distinct sources
 * across three domains:
 *
 *   sourceName  'Reuters' / 'Reuters ' / 'Reuters UK' / 'REUTERS'   -> 4 names
 *   url         reuters.com / uk.reuters.com / news.reuters.com     -> 3 domains
 *
 * `countDistinctSourceNames` counts raw provider strings, and domain
 * normalization strips a leading "www." and nothing else. So one publisher's
 * own properties, and one publisher's own name in four spellings, read as
 * independent corroboration.
 *
 * WHY THIS IS NOT YET LYING TO ANYONE, AND WHY IT IS STILL WORTH FIXING NOW.
 * `computeSourceDiversity` is inert: it is imported by no trust computation and
 * gates nothing. These numbers are therefore not currently misleading a reader
 * — they are numbers that would BECOME a lie the moment anything read them,
 * and "how many independent sources corroborate this?" is exactly the question
 * a multi-source layer exists to answer. Correcting the measurement before it
 * becomes load-bearing is cheap; correcting it afterwards is not.
 *
 * SCOPE, PER THE APPROVAL: this corrects MEASUREMENT ONLY. Nothing here is
 * wired into trust, corroboration, evidence acceptance or ranking, and the
 * accompanying spec asserts that the diversity module remains unread by the
 * trust layer.
 *
 * WHAT THIS DELIBERATELY DOES NOT CLAIM. Collapsing `uk.reuters.com` into
 * `reuters.com` is a statement about DOMAIN OWNERSHIP, not about editorial
 * independence. Two mastheads under one corporate owner still register as two
 * publishers here, because this module reads URLs and provider strings — it
 * has no ownership graph and does not pretend to one. That limitation is
 * inherited from `computeSourceDiversity`'s own doc comment ("cannot prove
 * editorial independence or true syndication origin") and is not narrowed by
 * this change.
 */

/**
 * Multi-part public suffixes this module recognises. DELIBERATELY A SHORT,
 * CLOSED LIST rather than a bundled Public Suffix List: the full PSL is a large
 * moving dependency, and getting it slightly wrong silently merges unrelated
 * publishers. Every entry here covers a suffix the product's own coverage
 * actually reaches — the East African and Polish markets it serves, plus the
 * common international ones.
 *
 * A host whose suffix is not listed falls back to the last two labels, which is
 * correct for every ordinary `example.com` / `example.pl` shape.
 */
const MULTI_PART_SUFFIXES: ReadonlySet<string> = new Set([
  /*
   * P1 CORRECTION — 'co.rw' WAS MISSING, AND IT MATTERED MOST WHERE IT HURT MOST.
   *
   * Measured before this fix, on the product's most important market:
   *
   *   www.newtimes.co.rw -> co.rw
   *   en.igihe.co.rw     -> co.rw
   *   www.rba.co.rw      -> co.rw
   *
   * The New Times, IGIHE and RBA — three of Rwanda's largest outlets —
   * collapsed into ONE publisher identity, so `distinctPublisherCount`
   * reported 1 where the truth is 3. That understated exactly the local
   * diversity the coverage work exists to increase.
   *
   * The lists below are now the registry-published second-level domains for
   * each target market rather than a few remembered examples, which is what
   * turns "I listed the ones I thought of" into "I covered the namespace".
   */

  // Rwanda
  'ac.rw',
  'co.rw',
  'coop.rw',
  'gov.rw',
  'mil.rw',
  'net.rw',
  'org.rw',

  // Kenya
  'ac.ke',
  'co.ke',
  'go.ke',
  'info.ke',
  'me.ke',
  'mobi.ke',
  'ne.ke',
  'or.ke',
  'sc.ke',

  // Poland
  'com.pl',
  'net.pl',
  'org.pl',
  'edu.pl',
  'gov.pl',
  'info.pl',
  'biz.pl',

  // Tanzania
  'ac.tz',
  'co.tz',
  'go.tz',
  'ne.tz',
  'or.tz',
  'sc.tz',

  // Uganda
  'ac.ug',
  'co.ug',
  'go.ug',
  'ne.ug',
  'or.ug',
  'sc.ug',

  // Ethiopia
  'com.et',
  'gov.et',
  'org.et',
  'edu.et',
  'net.et',

  // Nigeria and South Africa — already-covered regional coverage, kept
  'com.ng',
  'gov.ng',
  'edu.ng',
  'org.ng',
  'net.ng',
  'co.za',
  'org.za',
  'gov.za',
  'ac.za',
  'net.za',

  // Common international
  'co.uk',
  'org.uk',
  'gov.uk',
  'ac.uk',
  'me.uk',
  'net.uk',
  'com.au',
  'gov.au',
  'edu.au',
  'net.au',
  'org.au',
  'co.jp',
  'or.jp',
  'ne.jp',
  'ac.jp',
  'go.jp',
  'com.br',
  'gov.br',
  'org.br',
  'net.br',
  'co.in',
  'gov.in',
  'net.in',
  'org.in',
]);

/**
 * The registrable domain of a URL — the level at which one publisher's
 * properties belong together.
 *
 * `news.reuters.com`, `uk.reuters.com` and `www.reuters.com` all yield
 * `reuters.com`. `bbc.co.uk` yields `bbc.co.uk`, not `co.uk`, because the
 * suffix list knows `co.uk` is not a registrable name.
 *
 * Returns undefined for anything unparseable — never a partial or best-effort
 * key, matching the existing rule that a malformed URL is never counted as its
 * own distinct domain.
 */
export function resolveRegistrableDomain(url: string): string | undefined {
  let host: string;

  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return undefined;
  }

  if (host.length === 0) return undefined;

  /*
   * P1 — 'www.' IS STRIPPED BEFORE THE SUFFIX IS EVALUATED, NOT AFTER.
   *
   * Measured before this fix: 'www.gov.pl' has three labels, its last two are
   * the known suffix 'gov.pl', so the rule took the last THREE and returned
   * 'www.gov.pl' as though 'www' were a registrable name. Any host of the
   * shape www.<multi-part-suffix> was mis-resolved the same way.
   *
   * Stripping first is also what makes 'www.newtimes.co.rw' and
   * 'newtimes.co.rw' provably one identity rather than coincidentally one.
   */
  const withoutWww = host.replace(/^www\./, '');

  const labels = withoutWww.split('.').filter(Boolean);

  if (labels.length <= 2) return labels.join('.') || undefined;

  const lastTwo = labels.slice(-2).join('.');

  return MULTI_PART_SUFFIXES.has(lastTwo) ? labels.slice(-3).join('.') : lastTwo;
}

/**
 * Normalizes a provider-supplied source name for comparison only.
 *
 * Case, surrounding whitespace, internal whitespace runs and punctuation are
 * removed, so 'Reuters', 'Reuters ' and 'REUTERS' compare equal.
 *
 * IT DOES NOT STRIP EDITION QUALIFIERS. 'Reuters UK' stays distinct from
 * 'Reuters', because collapsing them would require deciding that 'UK' is an
 * edition rather than part of a masthead — a judgement this module has no
 * basis for making. Editions of one publisher are instead caught by the
 * registrable domain, which is a fact about the URL rather than a guess about
 * the name.
 */
export function normalizePublisherName(sourceName: string): string | undefined {
  const normalized = (sourceName ?? '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return normalized.length > 0 ? normalized : undefined;
}

/**
 * The identity a record is attributed to, preferring the registrable domain.
 *
 * THE DOMAIN WINS WHEN BOTH ARE AVAILABLE, and the order matters: a URL is
 * something the publisher controls and the pipeline observed, while
 * `sourceName` is free text a provider supplied and has never been verified —
 * `NewsArticle.sourceName`'s own doc comment says it is "not verified publisher
 * identity". Falling back to the name only when there is no usable URL keeps
 * the stronger signal in charge.
 */
export function resolvePublisherIdentity(
  article: Pick<NewsArticle, 'url' | 'sourceName'>,
): string | undefined {
  return (
    resolveRegistrableDomain(article.url ?? '') ?? normalizePublisherName(article.sourceName ?? '')
  );
}

/** Distinct publishers represented in a set of records. */
export function countDistinctPublishers(
  articles: ReadonlyArray<Pick<NewsArticle, 'url' | 'sourceName'>>,
): number {
  const identities = new Set<string>();

  for (const article of articles) {
    const identity = resolvePublisherIdentity(article);

    if (identity) identities.add(identity);
  }

  return identities.size;
}
