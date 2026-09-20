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

  /*
    UCDP CANDIDATE GED · CAPTURED, REGISTERED, MANUAL-ONLY.

    CF-D4 is now closed by a real Alpha capture of Candidate GED 26.0.7. Registration
    supplies the governed host for safe-fetch and a reader-facing institution name.
    It does NOT activate recurring acquisition: enabled=false and ingestionMethod=manual.

    The UCDP download centre publishes current datasets under CC BY 4.0. The first Alpha
    retained capture is performed as a separately authorised one-shot; a scheduled
    producer remains off until its own activation/rights binding is promoted.
  */
  {
    id: 'ucdp-ged',
    name: 'Uppsala Conflict Data Program',
    languages: ['en'],
    authorityClass: 'RESEARCH',
    baseUrl: 'https://ucdp.uu.se',
    reliabilityNote:
      'UCDP Candidate GED 26.0.7 schema captured on Alpha on 2026-09-20 from the public ' +
      'download endpoint: text/csv, 1,357,690 bytes, 49 columns, sha256 ' +
      '9fc2c6dd85eee91845512e8ef1055281d9fd028fb98748a6f2a27c6e8aa8c562.',
    enabled: false,
    ingestionMethod: 'manual',
    provenanceNote:
      'Registered after CF-D4 real-byte capture. Public UCDP download centre states CC BY 4.0. ' +
      'Manual retained-data proof only; no scheduler and no recurring provider activation.',
    rights: null,
  },

  /*
    ════════════════════════════════════════════════════════════════════════════
    RW-NISR · NATIONAL INSTITUTE OF STATISTICS OF RWANDA — REGISTERED, NOT ACTIVATED.
    ════════════════════════════════════════════════════════════════════════════

    Registered under MAIN-EAST-AFRICA-SOURCE-RIGHTS-REGISTRY-CLOSEOUT-R1 ruling F, which
    derived exactly two rows at `R6_RIGHTS_PERMITTING` across eleven countries. This is
    one of them. Ruling F also names what registration does NOT settle, and every one of
    those gates is still open below.

    `enabled: false` AND `ingestionMethod: 'none'`, and the pair is deliberate. Ruling F's
    remaining gates are: registration (this entry) · a RESOLVING rights record · host
    identity under ruling I's evidence floor · transport · and PO AUTHORIZATION BY SOURCE
    ID. Only the first is done here. This is the first source in the programme to stand at
    a permitting grade, so it is also the first time `enabled: false` is load-bearing
    rather than incidental — see Main's own note that every prior round's safety rested
    partly on there being nothing to activate.

    ── THE HOST IS THE APEX, AND THE SCOPE OF THE GRANT IS WHY ───────────────

    `baseUrl` is the BARE APEX. NISR publishes the CC BY 4.0 grant at `statistics.gov.rw`,
    and G measured that the grant does NOT travel to its own subdomains:

      socioeconomic.statistics.gov.rw   "© 2025 NISR. All rights reserved."
      microdata.statistics.gov.rw       data requires registration
      the ArcGIS geospatial hub         16 datasets, not one stating CC BY 4.0

    A reservation on a subdomain of the granting host is the carve-out ruling F records as
    `F-RW-1`. So the registered host is the apex and NOTHING BELOW IT, and a resolver that
    treats this entry as authority over `*.statistics.gov.rw` would be extending a grant
    the publisher declined to extend.

    ── AND THE APEX IS ALSO THE ONLY ONE THAT SERVES TLS ─────────────────────

    Measured 2026-09-20, twice, from this runtime:

      https://statistics.gov.rw/        HTTP 200, ssl_verify_result=0, 197.243.19.196
      https://www.statistics.gov.rw/    TLS failure, curl 60 — certificate does not
                                        match the name

    The publisher links `www.`, `alpha.`, `beta.` and bare-apex variants interchangeably
    (G's item 9), so a producer that normalises toward `www.` fails closed on a
    certificate error at a host that is not the registered one anyway.

    THIS IS NOT A WORKAROUND, and the distinction matters because `R-EA-TR-7` forbids
    routing around a TLS failure. Nothing is routed around: the apex is the host the
    rights instrument names, it presents a VALID certificate that verifies normally, and
    TLS verification is not relaxed anywhere in this round. Main's ruling A makes the same
    observation from the other side — `rw-nisr` is its named example that TLS and identity
    are orthogonal axes, since a certificate proves control of a name and never who
    controls it.

    ── RIGHTS: A KEY THAT DOES NOT RESOLVE, ON PURPOSE ───────────────────────

    CC BY 4.0 is a named, versioned, public-URI licence whose grantee class is anyone, and
    the CPI artifact carries `License: CC BY 4.0` in its own imprint — so the rights
    position travels with the bytes rather than living only on a page that can change.
    That is the strongest instrument the programme has read.

    It still buys nothing here. `rights` carries a KEY, never a grade, and
    `EAST_AFRICA_ACQUISITION_RIGHTS` has no resolver, so `evaluateSourceRights` refuses
    with RIGHTS-RECORD-UNRESOLVED. The authority id names the EAST AFRICA lane rather than
    the economy lane because ruling B places records with the lane that READ the
    instrument, and G read this one. Writing a plausible record here to make the refusal
    go away is the move ruling F exists to prevent.
  */
  {
    id: 'rw-nisr',
    name: 'National Institute of Statistics of Rwanda',
    countryCode: 'RW',
    /* OBSERVED, not declared. G measured three language editions per release as separate
       files; ruling C makes observed the authority and the declared tag never trusted. */
    languages: ['en', 'fr', 'rw'],
    authorityClass: 'OFFICIAL_STATISTICS',
    baseUrl: 'https://statistics.gov.rw',
    reliabilityNote:
      'National statistical authority under Law N° 53 bis/2013 of 28/06/2013. Publishes CPI ' +
      'monthly on the 10th, in English, French and Kinyarwanda as separate files. Grant is CC BY ' +
      '4.0 at the apex host only; socioeconomic./microdata. subdomains and the ArcGIS hub reserve ' +
      'rights or require registration. No revision or finality markers are published on the CPI ' +
      'series — no provisional/revised/preliminary/final vocabulary appears in the artifacts, so ' +
      'this deployment records that metadata as ABSENT rather than inferring it. Verified against ' +
      'the retrieved artifact itself (sha256 4ba5193b…, 1,727,902 bytes): zero occurrences of ' +
      'provisional/revised/revision/preliminary/final, the imprint reads "Licensed under CC BY ' +
      '4.0", and the stated publication date 10 September 2026 agrees with the Last-Modified ' +
      'header the same response carried.',
    enabled: false,
    ingestionMethod: 'none',
    provenanceNote:
      'Registered under MAIN-EAST-AFRICA-SOURCE-RIGHTS-REGISTRY-CLOSEOUT-R1 ruling F (one of two ' +
      'rows derived from 42 at the permitting rung). Published licence terms read by G via the ' +
      'research path; host identity NOT established under ruling I tier A, and not claimed here. ' +
      'REGISTRATION ONLY — activation additionally requires a resolving rights record, a tier-A ' +
      'identity verification with a timestamp, and PO authorization by source id.',
    rights: { rightsAuthorityId: 'EAST_AFRICA_ACQUISITION_RIGHTS', rightsRecordKey: 'RW_NISR' },
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
