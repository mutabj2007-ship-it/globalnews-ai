import { computeArticleRef } from '../identity/article-ref.util';

/**
 * MASTER CTO P0 #85 — GEO-IDENTITY QUARANTINE: five retained reports whose stored country is wrong.
 *
 * Five syndicated copies of one Reuters report (2026-10-09/10) about an ambush in eastern DR Congo
 * were persisted with countryCode CG (Republic of the Congo). The event is in DR Congo. Measured by
 * a READ-ONLY inspection of Alpha (2026-10-12; Claude_Output/RETRIEVAL-R1/P0-85-REUTERS-QUARANTINE/
 * evidence/identities-readonly-alpha.json): the five ids below, their articleRefs (sha256 of the
 * shared normalized URL, recomputed and matched locally), no ArticleCountry rows, no story links.
 *
 * The CTO ruling is a TARGETED hold, not a rule: only these five identities, matched by persisted id
 * OR by articleRef (so a provider returning the same URL again, or a URL spelling that normalizes to
 * it, is held too). Nothing is rewritten or deleted; no environment switch can loosen it. A held
 * record never supplies a country, is never re-geolocated from its text, never enters an answer as
 * evidence and never counts toward coverage. Withholding is recorded as a held count, never as
 * "no reporting exists". Lifting the hold is a reviewed code change (EA + E1), not configuration.
 */
export interface GeoQuarantineEntry {
  readonly articleId: string;
  readonly articleRef: string;
  readonly reason: 'GEO_IDENTITY_DISPUTED';
  readonly storedCountry: 'CG';
  readonly ruling: '#85';
}

export const GEO_IDENTITY_QUARANTINE: readonly GeoQuarantineEntry[] = Object.freeze(
  (
    [
      ['gnews-914413795', '96bdb3466a6c214045fef7f675d4ba66463ff366de3261ecd3ade84299683330'],
      ['gnews-1235004559', 'cac9cf8f79c67ce7643ce0352e71fb0173bb1833c7bda3b367ed04fb5f61480e'],
      ['gnews-1879033220', '863c891c5287b5b69f6de6df9a796395240d35854e72c7f4dec8f6cf0efbfda0'],
      ['gnews-1458247823', '2c6649ec967587be5ce556fb96a13b4687b9a5e7d0ac5b86ef6495e440422d7a'],
      ['gnews-356962950', '307e9d6048c63daa8e77b811516c7b1ea6b0620251e7b758a911196b41647300'],
    ] as const
  ).map(([articleId, articleRef]) =>
    Object.freeze({ articleId, articleRef, reason: 'GEO_IDENTITY_DISPUTED', storedCountry: 'CG', ruling: '#85' } as const),
  ),
);

const HELD_IDS: ReadonlySet<string> = new Set(GEO_IDENTITY_QUARANTINE.map((entry) => entry.articleId));
const HELD_REFS: ReadonlySet<string> = new Set(GEO_IDENTITY_QUARANTINE.map((entry) => entry.articleRef));

export interface GeoQuarantineIdentity {
  readonly id?: string | null;
  readonly url?: string | null;
}

/** True when the record is one of the five held identities (by persisted id or by articleRef of its URL). */
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
 * A held record keeps everything except its geography: no stored country is passed on, and the
 * caller must not re-derive one from its text. Non-held records are returned unchanged (same object).
 */
export function withoutDisputedGeography<T extends GeoQuarantineIdentity & { countryCode?: string; countryName?: string }>(
  record: T,
): T {
  if (!isGeoQuarantined(record)) return record;
  const { countryCode: _code, countryName: _name, ...rest } = record;
  return rest as T;
}
