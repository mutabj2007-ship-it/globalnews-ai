import type { Prisma } from '../../../generated/prisma/client';

/**
 * MASTER CTO R4 · P0 #86 — PUBLISHER RIGHTS HOLD, BY CANONICAL URL HOST.
 *
 * E1-REUTERS-PER-USE-MATRIX-R2 (2026-10-12): no rights basis is recorded for Reuters or for the
 * aggregator that delivers it. Two uses are CLEAR_FOR_EXACT_USE (B-1 / B-6: the bare URL and the
 * publisher's name as a link-out); headline display (B-2 / B-7), AI input (B-3), reuse on any
 * surface (B-8) and images (B-9) are HOLD; syndicated variants (B-4) and lost-providerId use (B-10)
 * are UNRESOLVED. Storage of the rows already held is RESTRICTED (B-5: retain as-is, no new
 * admission, no back-fill). The CTO paused NEW Reuters-host admission and use (R4 §2).
 *
 * WHAT A HOLD MATCHES — THE ARTICLE'S OWN URL HOST, NOTHING ELSE.
 *   - Parsed with the WHATWG URL parser (the parser browsers use), http/https only.
 *   - Host lowercased, trailing dot(s) removed; matches the held host exactly or as a subdomain
 *     (`www.reuters.com`, `jp.reuters.com`). Never a lookalike: `reuters.com.example`,
 *     `notreuters.com`, `reuters.co`, a userinfo trick (`https://reuters.com@other.example/`), or
 *     `reuters.com` appearing in a path or query.
 *   - Never the publisher NAME or the sourceId: a display name is not a rights identity, and a
 *     syndicating publisher carrying Reuters copy (MarketScreener, Straits Times, …) is a SEPARATE
 *     licence chain E1 left UNRESOLVED per publisher (B-4) — it is not matched here.
 *   - Redirects are never followed: a redirector URL on another host is not matched.
 *
 * Code-only and identity-keyed: no environment variable or configuration can loosen it. Lifting a
 * hold is a reviewed code change against an E1 written per-use clearance.
 */
export interface PublisherRightsHold {
  readonly host: string;
  readonly reason: 'PUBLISHER_RIGHTS_HOLD';
  readonly ruling: '#86';
  readonly authority: 'E1-REUTERS-PER-USE-MATRIX-R2';
}

export const PUBLISHER_RIGHTS_HOLDS: readonly PublisherRightsHold[] = Object.freeze([
  Object.freeze({
    host: 'reuters.com',
    reason: 'PUBLISHER_RIGHTS_HOLD',
    ruling: '#86',
    authority: 'E1-REUTERS-PER-USE-MATRIX-R2',
  } as const),
]);

/** The URL's canonical host (lowercase, no trailing dot), or undefined when it is not an http(s) URL. */
export function canonicalUrlHostOf(url: string | null | undefined): string | undefined {
  if (typeof url !== 'string') return undefined;
  const trimmed = url.trim();
  if (trimmed === '') return undefined;
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return undefined;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return undefined;
  const host = parsed.hostname.toLowerCase().replace(/\.+$/, '');
  return host === '' ? undefined : host;
}

/** The held publisher host this URL belongs to, or undefined. */
export function heldPublisherHostOf(url: string | null | undefined): string | undefined {
  const host = canonicalUrlHostOf(url);
  if (host === undefined) return undefined;
  for (const hold of PUBLISHER_RIGHTS_HOLDS) {
    if (host === hold.host || host.endsWith(`.${hold.host}`)) return hold.host;
  }
  return undefined;
}

export function isPublisherRightsHeld(item: { readonly url?: string | null } | null | undefined): boolean {
  return heldPublisherHostOf(item?.url) !== undefined;
}

/** Splits items into usable ones and held ones (order preserved). */
export function partitionPublisherRightsHeld<T extends { readonly url?: string | null }>(
  items: readonly T[],
): { readonly kept: T[]; readonly held: T[] } {
  const kept: T[] = [];
  const held: T[] = [];
  for (const item of items) (isPublisherRightsHeld(item) ? held : kept).push(item);
  return { kept, held };
}

export function withoutPublisherRightsHeld<T extends { readonly url?: string | null }>(items: readonly T[]): T[] {
  return partitionPublisherRightsHeld(items).kept;
}

/**
 * The query-side half for stored reads that cap their result (`take`): rows whose stored URL begins
 * with a held host's common exact origins are excluded IN the query, so the cap is not spent on rows
 * that would be withheld. It is deliberately NOT the authority — the exact predicate above still
 * runs on every returned row (a held subdomain or unusual spelling is caught there).
 */
export function publisherRightsHoldWhere(): Prisma.ArticleWhereInput {
  const prefixes = PUBLISHER_RIGHTS_HOLDS.flatMap((hold) =>
    ['https://', 'http://'].flatMap((scheme) => [`${scheme}${hold.host}/`, `${scheme}www.${hold.host}/`]),
  );
  return { NOT: { OR: prefixes.map((prefix) => ({ url: { startsWith: prefix, mode: 'insensitive' as const } })) } };
}
