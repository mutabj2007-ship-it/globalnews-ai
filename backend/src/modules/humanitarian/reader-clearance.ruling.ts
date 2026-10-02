/**
 * ════════════════════════════════════════════════════════════════════════════
 * HUMANITARIAN READER-FACING CLEARANCE — E1 RULING R2
 * ════════════════════════════════════════════════════════════════════════════
 *
 * HUMANITARIAN-E1-READER-CLEARANCE-R2. Supersedes the reader-facing half of
 * HUMANITARIAN-E1-SOURCE-ACTIVATION-R1; R1's structures stay in force except
 * where a clause below says it is withdrawn, and each withdrawal says why.
 *
 * Like R1 this file imports NOTHING from this monorepo and nothing from
 * `node:*`. It cannot acquire, persist, render or reach a socket. Its only
 * behaviour is refusal, plus one predicate it SUPPLIES so that callers stop
 * inventing their own (§5).
 *
 * ── WHAT CHANGED, AND WHAT MEASURED IT ────────────────────────────────────
 *
 * R1 ruled GDACS from the publisher's documentation. The convergence lane then
 * took the one dev capture R1 authorised — 135,190 bytes, SHA-256
 * `f11d1a0e9ea5465b5c8e37089ce3f179d48201539b7f45284202c9a64261069f`, hash-gated
 * again by E1 before reading. Measuring the payload corrected four R1 clauses,
 * and three of the corrections make the ruling STRICTER, not looser:
 *
 *   `geometry`        R1 admitted it as EVENT_LOCATION. The payload declares
 *                     `Class = "Point_Centroid"` in 100/100 and
 *                     `polygonlabel = "Centroid"`. It is a centroid, which R1
 *                     itself refuses. WITHDRAWN -> WITHHELD from readers.
 *   `severitydata`    R1 refused it as an "impact estimate". It is the hazard
 *                     MAGNITUDE (M, ha, km/h) as the originating agency measured
 *                     it, and magnitude is occurrence-side. WITHDRAWN -> retained
 *                     INTERNAL_ONLY. Refusing the measurement while admitting the
 *                     modelled `alertlevel` had it backwards.
 *   `htmldescription` R1 refused it as an injection surface. Measured: zero HTML
 *                     tags and zero links in 100/100. That reason WITHDRAWN; it
 *                     stays INTERNAL_ONLY because it embeds GDACS's alert word.
 *   `source`          R1 refused it as undeclared. It names the agency that
 *                     actually measured the event (NEIC 32, GWIS 58, NOAA 5,
 *                     JTWC 2, GLOFAS 3). ADMITTED and reader-REQUIRED: without
 *                     it a reader is told a magnitude is GDACS's when it is NEIC's.
 */

/* ══════════════════════════════════════════════════════════════════════════
 * 1 · THE THREE READER CLASSES
 * ══════════════════════════════════════════════════════════════════════════ */

export const HUMANITARIAN_FIELD_CLASSES = [
  /** May reach a reader AND the model context, under the §4 disclosures. */
  'READER_ADMISSIBLE',
  /** May be retained and read by operators. Never a reader, never the model. */
  'INTERNAL_ONLY',
  /** Not retained in a reader-reachable record at all. */
  'WITHHELD',
] as const;
export type HumanitarianFieldClass = (typeof HUMANITARIAN_FIELD_CLASSES)[number];

export class HumanitarianFieldRefused extends Error {}

/* ══════════════════════════════════════════════════════════════════════════
 * 2 · GDACS — CLASSIFIED FROM THE MEASURED PAYLOAD
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Keyed by the publisher's own path. Anything absent from this table is
 * WITHHELD: an undeclared field is refused, never defaulted (R-B).
 */
export const GDACS_FIELD_CLASSES: Readonly<Record<string, HumanitarianFieldClass>> = Object.freeze({
  /* Identity and mapping — the spine. `eventtype:eventid` is distinct 100/100. */
  eventtype: 'READER_ADMISSIBLE',
  eventid: 'READER_ADMISSIBLE',
  /* Advances per update: revision chain, not identity. */
  episodeid: 'INTERNAL_ONLY',
  /* The publisher's plain title: "Earthquake in Solomon Islands". */
  name: 'READER_ADMISSIBLE',
  description: 'READER_ADMISSIBLE',
  /* Naive, zone-less in 100/100. Reader-visible only with that qualification. */
  fromdate: 'READER_ADMISSIBLE',
  todate: 'READER_ADMISSIBLE',
  datemodified: 'READER_ADMISSIBLE',
  /* Country scope AS THE SOURCE SCOPED IT. Empty in 11/100 -> [] , never derived. */
  iso3: 'READER_ADMISSIBLE',
  affectedcountries: 'READER_ADMISSIBLE',
  /* The agency that measured it. Reader-REQUIRED, see §3. */
  source: 'READER_ADMISSIBLE',
  /* Links back to the publisher instead of restating it. */
  'url.details': 'READER_ADMISSIBLE',
  'url.report': 'READER_ADMISSIBLE',

  /* GDACS's own judgement. Inseparable pair; never restated as ours. */
  alertlevel: 'INTERNAL_ONLY',
  episodealertlevel: 'INTERNAL_ONLY',
  /* Measured magnitude: M / ha / km/h. Occurrence-side, not impact. */
  'severitydata.severity': 'INTERNAL_ONLY',
  'severitydata.severityunit': 'INTERNAL_ONLY',
  /* "Green impact for forestfire in 5095 ha" — magnitude fused with the alert word. */
  'severitydata.severitytext': 'INTERNAL_ONLY',
  /* No markup after all, but it carries the alert word in prose. */
  htmldescription: 'INTERNAL_ONLY',
  /* Uniform in this capture (true / false, 100/100): not shown to discriminate (R-D). */
  iscurrent: 'INTERNAL_ONLY',
  istemporary: 'INTERNAL_ONLY',
  country: 'INTERNAL_ONLY',

  /* `Class = Point_Centroid` 100/100: a centroid, at 0-4 decimal places. */
  geometry: 'WITHHELD',
  /* Degenerate in 100/100 — the point repeated, not an extent. */
  bbox: 'WITHHELD',
  Class: 'WITHHELD',
  polygonlabel: 'WITHHELD',
  /* A second, unruled endpoint. Admitting the field invites the fetch. */
  'url.geometry': 'WITHHELD',
  /* Modelled composites. */
  alertscore: 'WITHHELD',
  episodealertscore: 'WITHHELD',
  /* Empty in 100/100, 98/100 and 93/100: vacuous (R-B). */
  sourceid: 'WITHHELD',
  glide: 'WITHHELD',
  eventname: 'WITHHELD',
  /* Styling binaries. */
  icon: 'WITHHELD',
  iconoverall: 'WITHHELD',
  /* Present in 7/100 and in none of the sampled records: semantics UNMEASURED. */
  countryonland: 'WITHHELD',
});

/**
 * ReliefWeb, from the publisher's documentation only — NO capture exists, because
 * the credential gate bites first. Classes here are provisional on that basis and
 * must be re-measured against the first reviewed capture (R-C).
 */
export const RELIEFWEB_FIELD_CLASSES: Readonly<Record<string, HumanitarianFieldClass>> =
  Object.freeze({
    id: 'READER_ADMISSIBLE',
    title: 'READER_ADMISSIBLE',
    url: 'READER_ADMISSIBLE',
    url_alias: 'READER_ADMISSIBLE',
    origin: 'READER_ADMISSIBLE',
    /* WHO WROTE IT. ReliefWeb relayed it; the partner wrote it. Reader-REQUIRED. */
    'source.name': 'READER_ADMISSIBLE',
    'source.shortname': 'READER_ADMISSIBLE',
    'source.homepage': 'READER_ADMISSIBLE',
    'date.created': 'READER_ADMISSIBLE',
    'date.changed': 'READER_ADMISSIBLE',
    'date.original': 'READER_ADMISSIBLE',
    /* The publisher's own language tag. Not a licence to translate. */
    language: 'READER_ADMISSIBLE',
    format: 'READER_ADMISSIBLE',
    theme: 'READER_ADMISSIBLE',
    disaster: 'READER_ADMISSIBLE',
    country: 'READER_ADMISSIBLE',
    primary_country: 'READER_ADMISSIBLE',
    /* The partner's whole work. A feed-level instrument does not convey it. */
    body: 'WITHHELD',
    'body-html': 'WITHHELD',
    file: 'WITHHELD',
    image: 'WITHHELD',
    /* ReliefWeb's editorial selection fused with a summary of the partner's text. */
    headline: 'WITHHELD',
  });

/** Copernicus: the producer's six fields, all internal while no authority exists. */
export const COPERNICUS_FIELD_CLASSES: Readonly<Record<string, HumanitarianFieldClass>> =
  Object.freeze({
    activationCode: 'INTERNAL_ONLY',
    productId: 'INTERNAL_ONLY',
    featureId: 'INTERNAL_ONLY',
    geometryType: 'INTERNAL_ONLY',
    crs: 'INTERNAL_ONLY',
    coordinates: 'WITHHELD',
  });

export const HUMANITARIAN_FIELD_CLASS_TABLES: Readonly<
  Record<string, Readonly<Record<string, HumanitarianFieldClass>>>
> = Object.freeze({
  GDACS: GDACS_FIELD_CLASSES,
  RELIEFWEB: RELIEFWEB_FIELD_CLASSES,
  COPERNICUS_EMS: COPERNICUS_FIELD_CLASSES,
});

/** The class of one field. An unruled source or field is WITHHELD, never defaulted open. */
export function readerFieldClass(sourceId: string, field: string): HumanitarianFieldClass {
  const table = HUMANITARIAN_FIELD_CLASS_TABLES[sourceId];
  if (table === undefined) return 'WITHHELD';
  return table[field] ?? 'WITHHELD';
}

export function assertReaderAdmissible(sourceId: string, field: string): void {
  const cls = readerFieldClass(sourceId, field);
  if (cls !== 'READER_ADMISSIBLE') {
    throw new HumanitarianFieldRefused(
      `HUMANITARIAN_FIELD_NOT_READER_ADMISSIBLE: '${sourceId}.${field}' is ${cls}. ` +
        'An undeclared field is WITHHELD rather than defaulted, because an incomplete table ' +
        'satisfies every "carries no internal field" assertion vacuously (E1 rule R-B).',
    );
  }
}

/* ══════════════════════════════════════════════════════════════════════════
 * 3 · ATTRIBUTION — TWO NAMES, BECAUSE GDACS RELAYS
 * ══════════════════════════════════════════════════════════════════════════ */

/** The publisher's own words, from where the publisher states them. */
export const GDACS_ATTRIBUTION_VERBATIM =
  'Global Disaster Alert and Coordination System, GDACS' as const;

/**
 * The sources D-3 binds: rows that RELAY another agency's record and so travel with two names
 * (this acknowledgement verbatim plus the originating agency). A source outside this list is
 * attributed by its own publisher name. Published to display hops (convergence).
 */
export const RELAY_ATTRIBUTED_SOURCE_IDS: readonly string[] = Object.freeze(['GDACS']);

/** The originating agencies measured in the capture. Not a closed world — a label set. */
export const GDACS_ORIGINATING_AGENCIES_SEEN: readonly string[] = Object.freeze([
  'GLOFAS',
  'GWIS',
  'JTWC',
  'NEIC',
  'NOAA',
]);

export class AttributionMissing extends Error {}

/**
 * A reader-facing or model-facing GDACS row carries BOTH names.
 *
 * GDACS's Terms of use grant no express act; the acknowledgement the API
 * documentation requests is the one rights condition GDACS actually states, so a
 * row that drops it fails the only test there is. And `source` names the agency
 * whose measurement it is: attributing NEIC's magnitude to GDACS is a provenance
 * error, not a formatting one.
 */
export function assertGdacsAttributionCarried(row: {
  readonly relayAttribution?: unknown;
  readonly originatingAgency?: unknown;
}): void {
  if (row.relayAttribution !== GDACS_ATTRIBUTION_VERBATIM) {
    throw new AttributionMissing(
      'GDACS_RELAY_ATTRIBUTION_MISSING: the row must carry the publisher’s verbatim ' +
        `acknowledgement '${GDACS_ATTRIBUTION_VERBATIM}'. Reworded attribution is not attribution.`,
    );
  }
  if (typeof row.originatingAgency !== 'string' || row.originatingAgency.trim().length === 0) {
    throw new AttributionMissing(
      'GDACS_ORIGINATING_AGENCY_MISSING: the payload names the agency that measured the event ' +
        'in `source`. GDACS relays it; dropping the agency attributes its measurement to GDACS.',
    );
  }
}

/* ══════════════════════════════════════════════════════════════════════════
 * 4 · THE DISCLOSURE CHAIN — AND THE GUARD THAT CATCHES A SILENT DROP
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Measured at the programme base: `AskContribution.disclosures` is
 * `readonly string[]` — an OPEN set — and `governedPrompt` turns a code into a
 * model rule through a closed if-chain of exactly FIVE codes:
 *
 *   AGGREGATE_NOT_ASSIGNED_TO_DISTRICT · NO_RECENT_RETAINED_RECORD
 *   SEVERITY_NOT_ASSESSED · SNAPSHOT_NOT_CHANGE_SERIES
 *   SUBNATIONAL_SCOPE_NOT_APPLIED
 *
 * An emitted code that is in neither set reaches no reader and no model and
 * raises nothing. That is how a disclosure goes missing without a failing test:
 * an open producer against a closed consumer, with no comparison between them.
 */

/** Codes a Humanitarian answer must carry. `IMPACT_NOT_ASSESSED` is new in R2. */
export const HUMANITARIAN_REQUIRED_DISCLOSURES: readonly string[] = Object.freeze([
  /**
   * MEASURED: 0 of 100 GDACS records mention any impact term. GDACS yields hazard
   * occurrence and NOTHING about people. Without this code an answer built on GDACS
   * is silent about impact, and silence reads as "no impact reported".
   */
  'IMPACT_NOT_ASSESSED',
  /** The rows are retained records, not a current provider observation. */
  'RETAINED_NOT_CURRENT',
  /** No severity of ours exists; GDACS's alert level is internal. */
  'SEVERITY_NOT_ASSESSED',
  /** 8 of 100 records carry no country scope from any field. */
  'COUNTRY_SCOPE_NOT_STATED_BY_SOURCE',
  /** Publisher dates carry no timezone in 100/100. */
  'PUBLISHER_TIME_ZONE_NOT_STATED',
  /** The centroid never leaves the internal record. */
  'GEOMETRY_WITHHELD_SOURCE_CENTROID',
]);

export class DisclosureNotRecognised extends Error {}

/**
 * Refuse a disclosure no consumer can act on.
 *
 * This is the whole anti-drop mechanism, and it is the same shape as the
 * Copernicus producer's `governedCode` lookup: borrow from the consumer's
 * vocabulary rather than emitting into the void. A code that no consumer
 * recognises is worse than no code, because the emitting lane's tests pass.
 */
export function assertDisclosuresRecognised(
  emitted: readonly string[],
  recognisedByConsumer: readonly string[],
): void {
  const unrecognised = emitted.filter((c) => recognisedByConsumer.indexOf(c) === -1);
  if (unrecognised.length > 0) {
    throw new DisclosureNotRecognised(
      `HUMANITARIAN_DISCLOSURE_NOT_RECOGNISED: [${unrecognised.join(', ')}] reach no consumer. ` +
        'An open producer against a closed consumer drops a disclosure silently, and the ' +
        'emitting lane’s tests still pass.',
    );
  }
}

/** Every hop the ruling binds. A hop that re-derives nothing is a hop that assumes. */
export const HUMANITARIAN_DISCLOSURE_HOPS = [
  'RETAINED_CORPUS',
  'MODEL_CONTEXT',
  'GENERATED_ANSWER',
  'STORED_RESULT',
  'SAVED_OR_RECENT',
] as const;
export type HumanitarianDisclosureHop = (typeof HUMANITARIAN_DISCLOSURE_HOPS)[number];

/* ══════════════════════════════════════════════════════════════════════════
 * 5 · THE READER-ADMISSION PREDICATE, SUPPLIED RATHER THAN DEMANDED
 * ══════════════════════════════════════════════════════════════════════════
 *
 * `HumanitarianReaderAdmission = (record) => boolean` is CALLER-SUPPLIED at two
 * call sites — the retained read's constructor and the Ask specialist adapter.
 * Both say the caller "binds E1's source rights". A caller that passes
 * `() => true` satisfies both, and neither contract can tell: this is E1-P-11
 * (`mayPresentDerived: isAnalyst`) and GX-17 (the caller-computed partition list)
 * in a third place.
 *
 * E1 does not own those files, so the repair is not made there. What is made
 * HERE is the predicate they should bind, derived from the rulings, so that no
 * caller has to invent one. It returns false for every source today.
 */

/** Which sources are cleared for READER-FACING use. Empty, and that is the ruling. */
export const READER_CLEARED_SOURCE_IDS: readonly string[] = Object.freeze([]);

export function sourceIsReaderCleared(sourceId: string): boolean {
  return READER_CLEARED_SOURCE_IDS.indexOf(sourceId) !== -1;
}

/**
 * The predicate a caller binds in place of writing its own.
 *
 * It reads the source id off the record and nothing else: no geometry, no claim,
 * no request. There is no parameter through which a caller could steer the
 * answer, which is the enforcement technique `recordIsProtected` already uses
 * against a payload-derived classification.
 */
export function readerAdmissionFromRuling(): (record: {
  readonly observation?: { readonly identity?: { readonly upstreamAuthority?: unknown } };
}) => boolean {
  return (record) => {
    const authority = record?.observation?.identity?.upstreamAuthority;
    return typeof authority === 'string' && sourceIsReaderCleared(authority);
  };
}

/* ══════════════════════════════════════════════════════════════════════════
 * 6 · THE ZERO THAT MEANS "NOT SUPPLIED"
 * ══════════════════════════════════════════════════════════════════════════ */

/**
 * MEASURED: 3 of 100 records (all floods) carry `severity: 0` with
 * `severityunit: ''` and `severitytext: 'Magnitude 0 '`. That is the publisher
 * saying NOT SUPPLIED. Admitting it as a number breaches "missing data is not
 * zero" at the boundary, where it is cheapest to catch and hardest to undo.
 */
export function gdacsSeverityNotSupplied(severity: unknown, severityUnit: unknown): boolean {
  return severity === 0 && severityUnit === '';
}
