import { computeArticleRef } from '../identity/article-ref.util';
import { GEO_IDENTITY_QUARANTINE } from './geo-identity-quarantine.list';

export { GEO_IDENTITY_QUARANTINE, type GeoQuarantineEntry } from './geo-identity-quarantine.list';

/**
 * MASTER CTO P0 #85 — THE ONE LOCATION-HOLD PREDICATE, reused at every boundary (persistence reads
 * and writes, NewsService country resolution, the country feed, story search and story identity,
 * Ask story context, legacy /analysis/news story country, the Analysis evidence point, coverage,
 * and the display reopen of a stored answer).
 *
 * A held record never supplies a country, is never re-geolocated from its text, never enters an
 * answer as evidence and never counts toward coverage. Withholding is recorded as a held count,
 * never as "no reporting exists", and no reader text names a place for it. Nothing stored is
 * rewritten or deleted; no environment switch can loosen it. The list: geo-identity-quarantine.list.ts.
 */
const HELD_IDS: ReadonlySet<string> = new Set(GEO_IDENTITY_QUARANTINE.map((entry) => entry.articleId));
const HELD_REFS: ReadonlySet<string> = new Set(GEO_IDENTITY_QUARANTINE.map((entry) => entry.articleRef));

export interface GeoQuarantineIdentity {
  readonly id?: string | null;
  readonly url?: string | null;
}

/** True when the record is a held identity: by persisted id, or by the articleRef of its URL. */
export function isGeoQuarantined(record: GeoQuarantineIdentity): boolean {
  const id = (record.id ?? '').trim();
  if (id !== '' && HELD_IDS.has(id)) return true;
  const url = (record.url ?? '').trim();
  if (url === '') return false;
  try {
    return HELD_REFS.has(computeArticleRef(url));
  } catch {
    return false;
  }
}

/** True when an articleRef (64 hex) names a held identity. */
export function isGeoQuarantinedRef(articleRef: string | null | undefined): boolean {
  return typeof articleRef === 'string' && HELD_REFS.has(articleRef.trim().toLowerCase());
}

/** Splits records into the ones that may be used and the held ones (order preserved). */
export function partitionGeoQuarantined<T extends GeoQuarantineIdentity>(
  records: readonly T[],
): { readonly kept: T[]; readonly held: T[] } {
  const kept: T[] = [];
  const held: T[] = [];
  for (const record of records) (isGeoQuarantined(record) ? held : kept).push(record);
  return { kept, held };
}

/**
 * A held record keeps everything except its geography: no stored country or country name is passed
 * on and a derived precision reads 'unknown' (never 'country'); the caller must not re-derive one
 * from its text. Non-held records are returned unchanged (the same object).
 */
export function withoutHeldGeography<
  T extends GeoQuarantineIdentity & { countryCode?: string; countryName?: string; geographicPrecision?: string },
>(record: T): T {
  if (!isGeoQuarantined(record)) return record;
  const { countryCode: _code, countryName: _name, ...rest } = record;
  return (record.geographicPrecision === undefined ? rest : { ...rest, geographicPrecision: 'unknown' }) as T;
}
