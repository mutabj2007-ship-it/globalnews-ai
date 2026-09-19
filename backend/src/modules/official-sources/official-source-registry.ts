import type { OfficialSourceClass, OfficialSourceEntry } from '@globalnews-ai/shared';

/**
 * M64.1 — Official Source Registry: reusable contract + lookup
 * helpers, so authoritative institutional sources are never hardcoded
 * throughout unrelated service code (per the M64 audit's explicit
 * finding: do not hardcode IEBC, Rwanda institutions, Polish
 * institutions, etc. directly into service code).
 *
 * M64.1 SCOPE: no real institutional entries are seeded. OFFICIAL_SOURCES
 * starts empty and stays empty this milestone — adding real entries
 * (with their own provenance/reliability review) is explicitly a
 * later round's work, not something this milestone silently does.
 *
 * Filtering logic is factored into the exported `*From()` functions,
 * each taking the entry array as an explicit parameter, with the
 * zero-arg public functions below as thin wrappers over
 * OFFICIAL_SOURCES. This lets tests exercise the actual filtering
 * predicates against real fixture data, rather than only ever being
 * able to observe them return an empty array.
 */
export const OFFICIAL_SOURCES: OfficialSourceEntry[] = [
  /*
    ════════════════════════════════════════════════════════════════════════════
    E-4a · EUROSTAT — REGISTERED, AND DELIBERATELY NOT ACTIVATED.
    ════════════════════════════════════════════════════════════════════════════

    The first real entry. The milestone header above reserved seeding to "a later round,
    with its own provenance/reliability review"; this is that round, and the review is
    `MAIN-ECONOMY-CANONICAL-CLOSEOUT-R1` §2.2, which specifies this entry.

    REGISTRATION IS NOT ACTIVATION AND NOT RIGHTS APPROVAL — three separate facts:

      REGISTERED   this entry exists, so a figure attributed to Eurostat resolves to a
                   host and an authority class.              <- what this does
      ACTIVATED    `enabled: true` PLUS a resolved rights record whose grade permits it.
                   NOT DONE HERE.
      ADMITTED     bytes fetched, admitted, retained, published. Already true — and it
                   grants neither of the above.

    `enabled: false` IS THE POINT. Four Eurostat captures returned HTTP 200 and were
    admitted and retained; none of that is permission. Writing `true` here to make E-4b
    easier is precisely the move this round exists to close.

    `ingestionMethod: 'api'` is Main's specified value. It states HOW this source would be
    ingested, not that it is; with `enabled: false` the pair reads "an API source that is
    switched off", which is the true statement.

    `rights` carries a KEY, never a grade — nothing can acquire a rights class by being
    edited in this file. The record it points at is the economy lane's to write, and until
    it resolves `evaluateSourceRights` refuses with RIGHTS-RECORD-UNRESOLVED. That refusal
    is correct, not a gap to be filled with a plausible record.
  */
  {
    id: 'eurostat',
    name: 'Eurostat',
    /* No countryCode. Eurostat is an EU statistical authority, not a national one — the
       admitted series are Polish, but the SUBJECT of the data is not the AUTHORITY that
       published it. */
    languages: ['en'],
    authorityClass: 'OFFICIAL_STATISTICS',
    baseUrl: 'https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data',
    reliabilityNote:
      'EU statistical authority. Four Poland series retrieved, admitted by the canonical ' +
      'evaluator and retained in Snapshot R2 on 2026-09-19; three produce lineage-complete ' +
      'observations. The publisher marks provisional values with status "p" (observed on ' +
      'gov_10q_ggdebt) and declares no release cadence for these datasets.',
    enabled: false,
    ingestionMethod: 'api',
    provenanceNote:
      'Registered under MAIN-ECONOMY-CANONICAL-CLOSEOUT-R1 §2.2. Basis: retained content ' +
      'addresses cb685cf7…, e6da52b2…, c37c607c…, 7331ecba…. REGISTRATION ONLY — activation ' +
      'is E-4b and requires a resolved rights record, which the economy lane owns.',
    rights: { rightsAuthorityId: 'ECONOMY_ACQUISITION_RIGHTS', rightsRecordKey: 'EUROSTAT' },
  },
];

export function getOfficialSourceByIdFrom(
  entries: OfficialSourceEntry[],
  id: string,
): OfficialSourceEntry | undefined {
  return entries.find((entry) => entry.id === id);
}

export function getOfficialSourcesForCountryFrom(
  entries: OfficialSourceEntry[],
  countryCode: string,
): OfficialSourceEntry[] {
  return entries.filter((entry) => entry.countryCode === countryCode);
}

export function getOfficialSourcesByClassFrom(
  entries: OfficialSourceEntry[],
  authorityClass: OfficialSourceClass,
): OfficialSourceEntry[] {
  return entries.filter((entry) => entry.authorityClass === authorityClass);
}

export function getEnabledOfficialSourcesFrom(entries: OfficialSourceEntry[]): OfficialSourceEntry[] {
  return entries.filter((entry) => entry.enabled);
}

export function getOfficialSourceById(id: string): OfficialSourceEntry | undefined {
  return getOfficialSourceByIdFrom(OFFICIAL_SOURCES, id);
}

export function getOfficialSourcesForCountry(countryCode: string): OfficialSourceEntry[] {
  return getOfficialSourcesForCountryFrom(OFFICIAL_SOURCES, countryCode);
}

export function getOfficialSourcesByClass(authorityClass: OfficialSourceClass): OfficialSourceEntry[] {
  return getOfficialSourcesByClassFrom(OFFICIAL_SOURCES, authorityClass);
}

export function getEnabledOfficialSources(): OfficialSourceEntry[] {
  return getEnabledOfficialSourcesFrom(OFFICIAL_SOURCES);
}
