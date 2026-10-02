import {
  COPERNICUS_FIELD_CLASSES,
  GDACS_ATTRIBUTION_VERBATIM,
  GDACS_FIELD_CLASSES,
  GDACS_ORIGINATING_AGENCIES_SEEN,
  HUMANITARIAN_DISCLOSURE_HOPS,
  HUMANITARIAN_FIELD_CLASSES,
  HUMANITARIAN_FIELD_CLASS_TABLES,
  HUMANITARIAN_REQUIRED_DISCLOSURES,
  READER_CLEARED_SOURCE_IDS,
  RELIEFWEB_FIELD_CLASSES,
  assertDisclosuresRecognised,
  assertGdacsAttributionCarried,
  assertReaderAdmissible,
  gdacsSeverityNotSupplied,
  readerAdmissionFromRuling,
  readerFieldClass,
  sourceIsReaderCleared,
  type HumanitarianFieldClass,
} from './reader-clearance.ruling';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * THE R2 RULING, MEASURED
 * ════════════════════════════════════════════════════════════════════════════
 *
 * THE BITING MUTATIONS, NAMED so a reviewer runs them instead of trusting this:
 *
 *   N1  reclassify GDACS `geometry` to READER_ADMISSIBLE
 *         -> the centroid-withheld assertion FAILS.
 *   N2  make `readerFieldClass` default to 'READER_ADMISSIBLE' on a miss
 *         -> the undeclared-field assertions FAIL for all three sources.
 *   N3  add 'GDACS' to READER_CLEARED_SOURCE_IDS
 *         -> no-source-reader-cleared FAILS and the supplied predicate FAILS.
 *   N4  drop 'IMPACT_NOT_ASSESSED' from HUMANITARIAN_REQUIRED_DISCLOSURES
 *         -> the impact-disclosure assertion FAILS.
 *   N5  make `assertDisclosuresRecognised` a no-op
 *         -> the measured governed-prompt gap assertion FAILS.
 *   N6  accept a reworded GDACS acknowledgement
 *         -> the verbatim-attribution assertion FAILS.
 */

/** The five codes `governedPrompt` actually recognises, measured at the base. */
const GOVERNED_PROMPT_RECOGNISED = [
  'AGGREGATE_NOT_ASSIGNED_TO_DISTRICT',
  'NO_RECENT_RETAINED_RECORD',
  'SEVERITY_NOT_ASSESSED',
  'SNAPSHOT_NOT_CHANGE_SERIES',
  'SUBNATIONAL_SCOPE_NOT_APPLIED',
];

/** What the C-H3 adapter emits on its USED path, measured at convergence `56afaa6`. */
const ADAPTER_USED_DISCLOSURES = ['RETAINED_NOT_CURRENT', 'SEVERITY_NOT_ASSESSED'];

describe('HUMANITARIAN-E1-READER-CLEARANCE-R2', () => {
  /* ─── the class vocabulary and the closed tables ─────────────────────────── */

  it('declares exactly three field classes', () => {
    expect(HUMANITARIAN_FIELD_CLASSES).toEqual([
      'READER_ADMISSIBLE',
      'INTERNAL_ONLY',
      'WITHHELD',
    ]);
  });

  it('rules a non-empty table for each of the three sources (R-B)', () => {
    expect(Object.keys(HUMANITARIAN_FIELD_CLASS_TABLES).sort()).toEqual([
      'COPERNICUS_EMS',
      'GDACS',
      'RELIEFWEB',
    ]);
    for (const table of [GDACS_FIELD_CLASSES, RELIEFWEB_FIELD_CLASSES, COPERNICUS_FIELD_CLASSES]) {
      expect(Object.keys(table).length).toBeGreaterThan(5);
      for (const cls of Object.values(table)) {
        expect(HUMANITARIAN_FIELD_CLASSES).toContain(cls as HumanitarianFieldClass);
      }
    }
  });

  it('withholds an undeclared field and an unruled source, with no default (N2)', () => {
    expect(readerFieldClass('GDACS', 'exactSiteName')).toBe('WITHHELD');
    expect(readerFieldClass('WORLDPOP', 'anything')).toBe('WITHHELD');
    expect(readerFieldClass('', '')).toBe('WITHHELD');
    for (const id of ['GDACS', 'RELIEFWEB', 'COPERNICUS_EMS']) {
      expect(() => assertReaderAdmissible(id, 'exactSiteName')).toThrow(
        /HUMANITARIAN_FIELD_NOT_READER_ADMISSIBLE/,
      );
    }
  });

  /* ─── the measured GDACS corrections ────────────────────────────────────── */

  it('withholds the GDACS centroid and everything that reconstructs it (N1)', () => {
    for (const f of ['geometry', 'bbox', 'Class', 'polygonlabel', 'url.geometry']) {
      expect(readerFieldClass('GDACS', f)).toBe('WITHHELD');
      expect(() => assertReaderAdmissible('GDACS', f)).toThrow();
    }
  });

  it('keeps GDACS magnitude and alert level internal, and never reader-facing', () => {
    for (const f of [
      'severitydata.severity',
      'severitydata.severityunit',
      'severitydata.severitytext',
      'alertlevel',
      'episodealertlevel',
      'htmldescription',
    ]) {
      expect(readerFieldClass('GDACS', f)).toBe('INTERNAL_ONLY');
      expect(() => assertReaderAdmissible('GDACS', f)).toThrow();
    }
    /* The modelled composites are not even retained in a reader-reachable record. */
    expect(readerFieldClass('GDACS', 'alertscore')).toBe('WITHHELD');
    expect(readerFieldClass('GDACS', 'episodealertscore')).toBe('WITHHELD');
  });

  it('admits the GDACS identity, title, dates, source scope and originating agency', () => {
    for (const f of [
      'eventtype',
      'eventid',
      'name',
      'description',
      'fromdate',
      'todate',
      'datemodified',
      'iso3',
      'affectedcountries',
      'source',
      'url.details',
      'url.report',
    ]) {
      expect(readerFieldClass('GDACS', f)).toBe('READER_ADMISSIBLE');
      expect(() => assertReaderAdmissible('GDACS', f)).not.toThrow();
    }
    /* Vacuous in the capture: empty in 100/100, 98/100 and 93/100. */
    for (const f of ['sourceid', 'glide', 'eventname']) {
      expect(readerFieldClass('GDACS', f)).toBe('WITHHELD');
    }
  });

  it('withholds the ReliefWeb partner work and admits only metadata', () => {
    for (const f of ['body', 'body-html', 'file', 'image', 'headline']) {
      expect(readerFieldClass('RELIEFWEB', f)).toBe('WITHHELD');
    }
    for (const f of ['source.name', 'language', 'date.original', 'url']) {
      expect(readerFieldClass('RELIEFWEB', f)).toBe('READER_ADMISSIBLE');
    }
  });

  it('exposes no Copernicus field to a reader while no authority exists', () => {
    for (const [field, cls] of Object.entries(COPERNICUS_FIELD_CLASSES)) {
      expect(cls).not.toBe('READER_ADMISSIBLE');
      expect(() => assertReaderAdmissible('COPERNICUS_EMS', field)).toThrow();
    }
    expect(COPERNICUS_FIELD_CLASSES['coordinates']).toBe('WITHHELD');
  });

  /* ─── attribution ───────────────────────────────────────────────────────── */

  it('requires the verbatim relay acknowledgement and the originating agency (N6)', () => {
    expect(GDACS_ATTRIBUTION_VERBATIM).toBe('Global Disaster Alert and Coordination System, GDACS');
    expect(() =>
      assertGdacsAttributionCarried({
        relayAttribution: GDACS_ATTRIBUTION_VERBATIM,
        originatingAgency: 'NEIC',
      }),
    ).not.toThrow();
    /* Reworded attribution is not attribution. */
    expect(() =>
      assertGdacsAttributionCarried({ relayAttribution: 'GDACS', originatingAgency: 'NEIC' }),
    ).toThrow(/GDACS_RELAY_ATTRIBUTION_MISSING/);
    /* The relay named, the measuring agency dropped. */
    expect(() =>
      assertGdacsAttributionCarried({ relayAttribution: GDACS_ATTRIBUTION_VERBATIM }),
    ).toThrow(/GDACS_ORIGINATING_AGENCY_MISSING/);
    expect(() =>
      assertGdacsAttributionCarried({
        relayAttribution: GDACS_ATTRIBUTION_VERBATIM,
        originatingAgency: '   ',
      }),
    ).toThrow(/GDACS_ORIGINATING_AGENCY_MISSING/);
    expect(GDACS_ORIGINATING_AGENCIES_SEEN).toEqual(['GLOFAS', 'GWIS', 'JTWC', 'NEIC', 'NOAA']);
  });

  /* ─── the disclosure chain ──────────────────────────────────────────────── */

  it('requires an explicit impact disclosure, because GDACS supplies none (N4)', () => {
    expect(HUMANITARIAN_REQUIRED_DISCLOSURES).toContain('IMPACT_NOT_ASSESSED');
    expect(HUMANITARIAN_REQUIRED_DISCLOSURES).toContain('RETAINED_NOT_CURRENT');
    expect(HUMANITARIAN_REQUIRED_DISCLOSURES).toContain('GEOMETRY_WITHHELD_SOURCE_CENTROID');
    expect(new Set(HUMANITARIAN_REQUIRED_DISCLOSURES).size).toBe(
      HUMANITARIAN_REQUIRED_DISCLOSURES.length,
    );
  });

  it('binds all five hops of the chain', () => {
    expect(HUMANITARIAN_DISCLOSURE_HOPS).toEqual([
      'RETAINED_CORPUS',
      'MODEL_CONTEXT',
      'GENERATED_ANSWER',
      'STORED_RESULT',
      'SAVED_OR_RECENT',
    ]);
  });

  it('catches the measured governed-prompt gap it was written for (N5)', () => {
    /*
      The adapter's USED path emits RETAINED_NOT_CURRENT, which `governedPrompt`
      does not recognise. The guard names it rather than letting it vanish.
    */
    expect(() =>
      assertDisclosuresRecognised(ADAPTER_USED_DISCLOSURES, GOVERNED_PROMPT_RECOGNISED),
    ).toThrow(/RETAINED_NOT_CURRENT/);
    /* And every R2-required disclosure is unrecognised today — the whole point. */
    expect(() =>
      assertDisclosuresRecognised(HUMANITARIAN_REQUIRED_DISCLOSURES, GOVERNED_PROMPT_RECOGNISED),
    ).toThrow(/IMPACT_NOT_ASSESSED/);
    /* A recognised code passes, so the guard is not simply always throwing. */
    expect(() =>
      assertDisclosuresRecognised(['SEVERITY_NOT_ASSESSED'], GOVERNED_PROMPT_RECOGNISED),
    ).not.toThrow();
    expect(() => assertDisclosuresRecognised([], GOVERNED_PROMPT_RECOGNISED)).not.toThrow();
  });

  /* ─── reader admission, supplied not demanded ───────────────────────────── */

  it('clears no source for reader-facing use (N3)', () => {
    expect(READER_CLEARED_SOURCE_IDS).toEqual([]);
    for (const id of ['GDACS', 'RELIEFWEB', 'COPERNICUS_EMS']) {
      expect(sourceIsReaderCleared(id)).toBe(false);
    }
  });

  it('supplies a predicate that refuses every record, steered by nothing (N3)', () => {
    const admit = readerAdmissionFromRuling();
    for (const authority of ['GDACS', 'RELIEFWEB', 'COPERNICUS_EMS', 'ANYTHING']) {
      expect(admit({ observation: { identity: { upstreamAuthority: authority } } })).toBe(false);
    }
    /* Malformed or absent identity is refused, not defaulted. */
    expect(admit({})).toBe(false);
    expect(admit({ observation: { identity: {} } })).toBe(false);
    expect(admit({ observation: { identity: { upstreamAuthority: 123 } } })).toBe(false);
  });

  /* ─── the zero that means not supplied ──────────────────────────────────── */

  it('reads GDACS severity 0 with an empty unit as NOT SUPPLIED, never as zero', () => {
    expect(gdacsSeverityNotSupplied(0, '')).toBe(true);
    /* A real measured zero-unit magnitude is not the same shape. */
    expect(gdacsSeverityNotSupplied(0, 'M')).toBe(false);
    expect(gdacsSeverityNotSupplied(5.1, 'M')).toBe(false);
    expect(gdacsSeverityNotSupplied(5095, 'ha')).toBe(false);
    expect(gdacsSeverityNotSupplied(undefined, '')).toBe(false);
  });
});
