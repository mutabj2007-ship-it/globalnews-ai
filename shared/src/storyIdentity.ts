/**
 * R4 — story identity primitives, shared by the backend news pipeline and
 * the frontend home-feed allocator.
 *
 * THEY LIVE HERE BECAUSE TWO WORKSPACES NEED THE SAME ANSWER. The backend
 * collapses duplicate records before they are served; the frontend
 * allocator refuses to place one story in two homepage positions. If each
 * carried its own copy of these rules they would drift, and the drift
 * would be invisible until a duplicate reached a reader again. `shared/`
 * already holds real logic of exactly this kind — see
 * `query-normalization.ts` and `geo-fuzzy-resolver.ts` — so this
 * introduces no new convention.
 *
 * DELIBERATELY PURE STRING FUNCTIONS. No article type, no NewsArticle
 * import, no I/O, no clock. The IDENTITY LADDER that decides whether two
 * ARTICLES are one story stays in the backend, where the record shape and
 * the provenance rules live; only the spelling rules are shared.
 *
 * NOTHING HERE IS A SIMILARITY MEASURE. Every function below either
 * removes a difference that provably cannot change WHICH article is
 * addressed, or folds a spelling. Two inputs that differ by one
 * meaningful character still differ on the way out.
 */

/**
 * Query parameters removed before two URLs are compared.
 *
 * EVERY ENTRY IS A CAMPAIGN, SESSION OR REFERRAL MARKER — a fact about
 * how a reader ARRIVED at an article, never about WHICH article it is.
 * Removing one cannot change what is addressed.
 *
 * The list is CLOSED and deliberately short. A prefix rule such as
 * "drop anything starting with utm_" would be shorter to write and worse
 * to own: it also drops a hypothetical `utm_page=2`, and a parameter that
 * selects a page selects a different article. A name that is not on this
 * list is PRESERVED — the failure direction is "kept a duplicate", never
 * "merged two different articles".
 *
 * ── FIVE NAMES WERE REMOVED FROM THIS LIST, AND WHY ─────────────────────
 *
 * `ref`, `source`, `src`, `sh` and `partner` were here in the first draft
 * and are gone. They are ordinary English words in NO RESERVED NAMESPACE,
 * and a content-management system is entirely free to use any of them as
 * an edition, section, feed or variant selector — `?source=` choosing a
 * wire feed and `?ref=` choosing a section are real CMS patterns, not
 * invented hazards. An independent audit compiled the shipped normalizer
 * and REPRODUCED the loss: two articles at one scheme+host+path with
 * DIFFERENT headlines, differing only in one of those five names,
 * collapsed to one. The second article was dropped silently.
 *
 * TWO THINGS MADE THAT SERIOUS RATHER THAN THEORETICAL. First, the URL
 * rung collapses with NO CORROBORATION AT ALL — unlike the headline rung,
 * which demands an exact headline AND a shared host or image AND a bounded
 * window. Second, the URL rung is the PRODUCTION rung: GNews issues no
 * providerRecordId, so rung 1 never fires and every live article's identity
 * is decided here. Nothing stands between this list and the feed.
 *
 * AND THEY BOUGHT NOTHING. The duplicate this correction exists to fix
 * differed by `utm_source` and `utm_medium` only; the utm namespace alone
 * closes it. Unbounded silent article loss on one side, zero benefit on
 * the other — that asymmetry is the whole argument.
 *
 * `referrer` STAYS. It names the HTTP concept, which is a fact about
 * arrival rather than about the document.
 *
 * THE STANDARD FOR ADDING A NAME HERE, learned from that mistake: a
 * reserved namespace (`utm_`, `at_`, `__`), or a value MINTED BY A THIRD
 * PARTY AT CLICK TIME that the publisher's server has never seen before,
 * or a documented house analytics convention that is not also an ordinary
 * word a CMS would reach for. "It looks like tracking" is not the
 * standard.
 *
 * ── AND A SIXTH NAME WAS REMOVED: `CMP` ────────────────────────────────
 *
 * `CMP` was the Guardian/Telegraph campaign convention, spelled here in
 * upper case because that is how those publishers emit it. But NAME
 * MATCHING IS CASE-INSENSITIVE — see `TRACKING_PARAMETER_SET` immediately
 * below, which lowercases every entry, and the lookup in
 * `normalizeArticleUrl`, which lowercases the incoming name. One entry
 * spelled `CMP` therefore strips `?cmp=`, `?Cmp=` and `?CMP=` alike.
 *
 * AND `cmp` IS AN ORDINARY ABBREVIATION. It reads most naturally as
 * "compare", and a CMS is free to use `?cmp=` as a comparison or variant
 * selector. So this entry failed the standard recorded just above on its
 * own third limb: a documented house convention, yes, but ALSO an
 * ordinary word a CMS would reach for. It is the one entry of the thirty
 * that could not be defended against the rule this file itself sets.
 *
 * HONEST ABOUT THE EVIDENCE, because the two removals are not equal.
 * The five names above were removed after an audit COMPILED the shipped
 * normalizer and REPRODUCED two different articles collapsing into one.
 * `CMP` is removed on the rule alone — no such loss was observed in the
 * wild. It goes because Alpha closure asks this list to contain only what
 * is PROVEN inert, and a three-letter ordinary abbreviation matched
 * case-insensitively is not that.
 *
 * `cmpid` STAYS. It is unambiguous, it is no English word, and it carries
 * the same publisher convention — so what this removal costs is narrow.
 */
export const TRACKING_QUERY_PARAMETERS: readonly string[] = Object.freeze([
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
  'gclid',
  'dclid',
  'gbraid',
  'wbraid',
  'fbclid',
  'msclkid',
  'twclid',
  'igshid',
  'mc_cid',
  'mc_eid',
  'referrer',
  'cmpid',
  'ito',
  'at_medium',
  'at_campaign',
  'ncid',
  'smid',
  '__twitter_impression',
]);

const TRACKING_PARAMETER_SET: ReadonlySet<string> = new Set(
  TRACKING_QUERY_PARAMETERS.map((name) => name.toLowerCase()),
);

/**
 * The maximum publication gap between two records that an exact shared
 * headline is allowed to collapse.
 *
 * SIX HOURS, AND THE NUMBER WAS TIGHTENED FROM TWENTY-FOUR BY A TEST.
 * The first draft used a day, on the reasoning that two fetches of one
 * syndicated story routinely disagree about its timestamp. An existing
 * fixture then collapsed two articles that shared a headline and sat
 * exactly 24 hours apart — and that is not a hypothetical shape. A daily
 * column, a "Morning Briefing", a market wrap: publications legitimately
 * reuse one headline every single day, from the same host, at very nearly
 * the same hour. A 24-hour window merges yesterday's into today's.
 *
 * Six hours is comfortably wider than the minutes-to-hours skew that
 * genuine duplicate records show, and comfortably narrower than the daily
 * cadence that produces a legitimate repeat. The correction it exists to
 * make — one article fetched twice, timestamps identical or minutes apart
 * — sits nowhere near either edge.
 *
 * IT IS A CEILING, NOT THE TEST. Rung 3 already requires an exact
 * normalized headline AND corroborating identity evidence; this only stops
 * those from reaching across an implausible span of time.
 */
export const STORY_IDENTITY_MAX_PUBLICATION_GAP_MS = 6 * 60 * 60 * 1000;

/**
 * Normalize a URL for identity comparison.
 *
 * WHAT IS REMOVED, and why each is provably safe:
 *   - the FRAGMENT. Never sent to the server; it addresses a position
 *     inside a document, not a document.
 *   - the HOST'S CASE. Hostnames are case-insensitive by definition
 *     (RFC 4343). The PATH's case is preserved — many publishers serve
 *     case-sensitive paths.
 *   - a DEFAULT PORT (:80 on http, :443 on https). The same origin.
 *   - a SINGLE TRAILING SLASH, when it is the final character. `/a/b`
 *     and `/a/b/` are served as one document by every mainstream CMS.
 *     THE ROOT FORM IS INCLUDED: `https://a.example/` normalizes to
 *     `https://a.example`, because both spellings address one resource
 *     and differ only in how `URL` chose to render them. A url that
 *     carries a query string is left alone — the slash is then not the
 *     final character, and removing one from inside the path would
 *     rewrite the path relative to its own query.
 *   - the KNOWN TRACKING PARAMETERS above, and nothing else.
 *   - a now-EMPTY query or the bare `?`.
 *
 * WHAT IS PRESERVED, deliberately: the scheme, every surviving query
 * parameter IN ITS ORIGINAL ORDER, and the path's case. Reordering the
 * query string would look tidier and would be wrong — a server is
 * entitled to treat `?a=1&b=2` and `?b=2&a=1` as different, and identity
 * must never rest on an assumption the remote end has not made.
 *
 * FAILS CLOSED. An input that is not a parseable absolute URL is returned
 * trimmed and otherwise untouched, so it can still match another copy of
 * itself exactly but can never be normalized INTO a collision with a
 * different article.
 */
export function normalizeArticleUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim();

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return trimmed;
  }

  parsed.hash = '';
  parsed.hostname = parsed.hostname.toLowerCase();

  if (
    (parsed.protocol === 'http:' && parsed.port === '80') ||
    (parsed.protocol === 'https:' && parsed.port === '443')
  ) {
    parsed.port = '';
  }

  for (const name of [...parsed.searchParams.keys()]) {
    if (TRACKING_PARAMETER_SET.has(name.toLowerCase())) {
      parsed.searchParams.delete(name);
    }
  }

  let normalized = parsed.toString();

  // URL.toString() leaves a bare '?' behind once the last parameter goes.
  if (normalized.endsWith('?')) {
    normalized = normalized.slice(0, -1);
  }

  // One trailing slash. Anything carrying a query string is left alone:
  // the slash is then not the last character, and removing one from inside
  // the path would rewrite the path relative to its own query.
  //
  // THE ROOT IS STRIPPED TOO, DELIBERATELY. `https://a.example` and
  // `https://a.example/` address the same resource and differ only in how
  // `URL` chose to render them, so folding them together is the correct
  // identity answer rather than an edge case to be guarded against.
  if (!normalized.includes('?') && normalized.endsWith('/')) {
    normalized = normalized.slice(0, -1);
  }

  return normalized;
}

/**
 * Normalize a headline for EXACT comparison.
 *
 * Case-folded, Unicode-normalized (NFKC, so a full-width or decomposed
 * character cannot masquerade as a different headline), typographic
 * punctuation folded to ASCII equivalents, and internal whitespace
 * collapsed. Nothing is stemmed, no word is dropped, and no token is
 * reordered — this is a spelling normalizer, NOT a similarity measure.
 * Two headlines that differ by one meaningful word remain different here,
 * which is the entire point.
 */
export function normalizeHeadline(title: string): string {
  return title
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[‘’‛′]/g, "'")
    .replace(/[“”‟″]/g, '"')
    .replace(/[‐-―−]/g, '-')
    .replace(/…/g, '...')
    .replace(/\s+/g, ' ')
    .trim();
}

/** The registrable host of a URL, lowercased. Empty when unparseable. */
export function articleHost(rawUrl: string): string {
  try {
    return new URL(rawUrl.trim()).hostname.toLowerCase();
  } catch {
    return '';
  }
}
