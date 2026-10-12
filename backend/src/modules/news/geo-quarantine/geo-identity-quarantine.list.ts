/**
 * MASTER CTO P0 #85 — THE HOLD LIST: five retained reports whose stored country is unsupported.
 *
 * Five copies of one wire report chain (2026-10-09/10) about an ambush in eastern DR Congo were
 * persisted with countryCode CG (Republic of the Congo) by the pre-D-07 resolver, which read a bare
 * "Congo" as CG. Measured by a READ-ONLY inspection of Alpha (2026-10-12;
 * Claude_Output/RETRIEVAL-R1/P0-85-REUTERS-QUARANTINE/evidence/identities-readonly-alpha.json): the
 * ids below, their articleRefs (sha256 of the shared normalized URL, recomputed and matched
 * locally), no ArticleCountry rows, no story links. EA: CG unsupported for all five.
 *
 * Identity only: never a rule over CG/CD values, never keyed on the current countryCode. No URL is
 * written here. Lifting a hold is a reviewed code change (CTO + EA + E1), never configuration, and
 * never automatic when a re-fetch changes the stored value.
 */
export interface GeoQuarantineEntry {
  readonly articleId: string;
  readonly articleRef: string;
  readonly reason: 'GEO_IDENTITY_UNDER_REVIEW';
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
    Object.freeze({ articleId, articleRef, reason: 'GEO_IDENTITY_UNDER_REVIEW', storedCountry: 'CG', ruling: '#85' } as const),
  ),
);
