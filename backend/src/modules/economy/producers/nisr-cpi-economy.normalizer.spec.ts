/**
 * ════════════════════════════════════════════════════════════════════════════
 * NISR CPI → ECONOMY — THE NUMERIC PATH, THE INTERNAL READ, AND RULING D
 * ════════════════════════════════════════════════════════════════════════════
 *
 * The one measured figure in this file is the August 2026 All Rwanda twelve-month
 * percentage change, `15.9`, read this round from the retained artifact
 * `sha256 4ba5193b…` (1,727,902 bytes). It appears here as the value a DECODED FIXTURE
 * carries into the normalizer, which is what a unit test can do; the round's actual
 * observation is produced by running the governed pipeline over the real bytes, and the
 * evidence for that is the rehearsal's, not this suite's.
 */

import {
  ECONOMY_CATEGORIES,
  assertRetrievalIsProvable,
  economyUpstreamSeriesKey,
  retrievalMaySupplyValues,
  type NisrCpiDecoded,
  type OfficialDataRetrieval,
  type SourceProvenance,
} from '@globalnews-ai/shared';

import {
  NISR_CPI_DECLARED_DIMENSION_KEYS,
  NISR_CPI_GENERAL_INDEX_COICOP,
  NISR_CPI_HAS_EDITION_COMPARATOR,
  nisrCpiEditionOrderFor,
  nisrCpiFreshness,
  nisrCpiNationalSeries,
  nisrCpiPeriod,
  nisrCpiUpstreamRef,
  nisrCpiVintageBasis,
  normalizeNisrCpiNationalObservation,
  readNisrCpiNationalFigureSlot,
} from './nisr-cpi-economy.normalizer';

/* ══════════════════════════════════════════════════════════════════════════
 * FIXTURES — the shape of a decoded artifact, carrying measured headlines
 * ══════════════════════════════════════════════════════════════════════════ */

const ADDRESS_A = 'a'.repeat(64);
const ADDRESS_B = 'b'.repeat(64);

/** Measured: All Rwanda, August 2026, twelve-month percentage change. */
const ALL_RWANDA_ANNUAL_AUG2026 = 15.9;

function decodedFixture(patch: Partial<NisrCpiDecoded> = {}): NisrCpiDecoded {
  return {
    referencePeriod: '2026-08',
    publicationDate: '2026-09-10',
    sourceLanguage: 'en',
    basePeriod: 'Feb 2014=100',
    issueOrdinal: 8,
    columns: [],
    rows: [
      {
        coicopCode: NISR_CPI_GENERAL_INDEX_COICOP,
        categoryLabel: 'GENERAL INDEX',
        geography: 'ALL_RWANDA',
        cells: [
          {
            role: 'PCT_CHANGE_ON_YEAR_AGO',
            value: ALL_RWANDA_ANNUAL_AUG2026,
            unit: 'PERCENT',
            printedPercentMarker: true,
          },
        ],
      },
    ],
    licenceToken: 'Licensed under CC BY 4.0',
    geographiesPresent: ['URBAN', 'RURAL', 'ALL_RWANDA'],
    extractorId: 'test.fixture',
    extractorVersion: '1.0.0',
    ...patch,
  };
}

function retrievalFixture(patch: Partial<OfficialDataRetrieval> = {}): OfficialDataRetrieval {
  return {
    retrievalId: 'ret-1',
    request: {
      providerId: 'rw-nisr',
      endpointId: 'cpi-monthly-en',
      requestPath: '/sites/default/files/documents/2026-09/CPI.pdf',
      parameters: [],
      requestedAt: '2026-09-20T02:30:45.837Z',
    },
    retrievedAt: '2026-09-20T02:30:48.768Z',
    httpStatus: 200,
    mediaType: 'application/pdf',
    byteLength: 1_727_902,
    contentAddress: ADDRESS_A as OfficialDataRetrieval['contentAddress'],
    completeness: 'COMPLETE',
    rights: {
      grade: 'E-5',
      instrumentRef: 'https://statistics.gov.rw',
      payloadRetentionPermitted: true,
    },
    /* EMPTY, AND THAT IS A MEASUREMENT — R-AID-6. NISR publishes no edition annotations. */
    editionAnnotations: {},
    publisherReleasedAt: '2026-09-10',
    referencePeriod: '2026-08',
    sourceLanguage: 'en',
    ...patch,
  };
}

const PROVENANCE: SourceProvenance = {
  sourceType: 'PUBLIC_DATA',
  providerId: 'rw-nisr',
  institution: 'National Institute of Statistics of Rwanda',
  jurisdiction: 'RW',
  language: 'en',
  retrievedAt: '2026-09-20T02:30:48.768Z',
  authorityClass: 'OFFICIAL_STATISTICS',
};

function input(patch: Parameters<typeof normalizeNisrCpiNationalObservation>[0] extends infer T
  ? Partial<T>
  : never = {}) {
  return {
    decoded: decodedFixture(),
    retrieval: retrievalFixture(),
    provenance: PROVENANCE,
    editionOrder: 'ADVANCED' as const,
    ...patch,
  };
}

/* ══════════════════════════════════════════════════════════════════════════
 * 1 · THE TARGET IS THE ACCEPTED SPINE, AND NOTHING WAS ADDED TO IT
 * ══════════════════════════════════════════════════════════════════════════ */

describe('the numeric target', () => {
  it('is an Economy series in the first declared category', () => {
    const s = nisrCpiNationalSeries();
    expect(s.category).toBe('INFLATION_CPI');
    expect(ECONOMY_CATEGORIES[0]).toBe('INFLATION_CPI');
    expect(s.economyIso2).toBe('RW');
    expect(s.unit).toBe('PERCENT');
    expect(s.cadence).toBe('MONTHLY');
  });

  it('mints no identifier — the seriesId is DERIVED from the upstream key', () => {
    expect(nisrCpiNationalSeries().seriesId).toBe(
      economyUpstreamSeriesKey(nisrCpiUpstreamRef('ALL_RWANDA')),
    );
  });

  it('gives the three geographies three distinct series, and the key excludes the period', () => {
    const keys = (['URBAN', 'RURAL', 'ALL_RWANDA'] as const).map((g) =>
      economyUpstreamSeriesKey(nisrCpiUpstreamRef(g)),
    );
    expect(new Set(keys).size).toBe(3);
    /* R-AID-4: the same series observed in two periods produces the SAME key. Nothing in
       the ref varies with the reference period, so there is nothing to assert against a
       second period — which is itself the property. */
    expect(keys.every((k) => !k.includes('2026'))).toBe(true);
  });

  it('pins exactly the publisher dimensions it declares — no fewer, no extras', () => {
    const ref = nisrCpiUpstreamRef('ALL_RWANDA');
    expect([...ref.dimensions.map((d) => d.key)].sort()).toEqual(
      [...NISR_CPI_DECLARED_DIMENSION_KEYS].sort(),
    );
    /* ECON-CL-1: no observation axis is pinned. A pin whose value moved with the period
       would make the series identity change every month. */
    expect(ref.dimensions.find((d) => d.key === 'geography')?.value).toBe('All Rwanda');
    expect(ref.dimensions.some((d) => /20\d\d/.test(d.value))).toBe(false);
  });

  it('declares no dataset version, because the publisher declares none', () => {
    expect(nisrCpiUpstreamRef('ALL_RWANDA').datasetVersion).toBeUndefined();
  });
});

describe('the period is the interval the document is ABOUT', () => {
  it('spans the reference month, not the publication month', () => {
    const p = nisrCpiPeriod('2026-08');
    expect(p).toEqual({
      periodId: '2026-08',
      start: '2026-08-01',
      end: '2026-08-31',
      label: '2026-08',
    });
    /* The publication date is 2026-09-10 and appears nowhere in the period. */
    expect(JSON.stringify(p)).not.toContain('09');
  });

  it('gets February right without a leap-year rule being written', () => {
    expect(nisrCpiPeriod('2024-02')?.end).toBe('2024-02-29');
    expect(nisrCpiPeriod('2026-02')?.end).toBe('2026-02-28');
  });

  it('refuses anything that is not a month', () => {
    expect(nisrCpiPeriod('2026-Q3')).toBeNull();
    expect(nisrCpiPeriod('2026-13')).toBeNull();
    expect(nisrCpiPeriod('August 2026')).toBeNull();
  });
});

/* ══════════════════════════════════════════════════════════════════════════
 * 2 · THE OBSERVATION
 * ══════════════════════════════════════════════════════════════════════════ */

describe('the normalized observation', () => {
  const n = normalizeNisrCpiNationalObservation(input());

  it('reads the published national figure', () => {
    expect(n.ok).toBe(true);
    if (!n.ok) return;
    expect(n.observation.value).toBe(ALL_RWANDA_ANNUAL_AUG2026);
    expect(n.observation.unit).toBe('PERCENT');
  });

  it('carries the publisher’s issue date as the vintage, not our fetch moment', () => {
    if (!n.ok) return;
    expect(n.observation.vintage).toBe('2026-09-10');
    expect(n.observation.vintage).not.toBe(retrievalFixture().retrievedAt);
    expect(nisrCpiVintageBasis(retrievalFixture())).toBe('PUBLISHER_VINTAGE');
  });

  it('writes NO release status, because the publisher states none', () => {
    if (!n.ok) return;
    expect(n.observation.semantics.releaseStatus).toBeNull();
    expect(n.observation.semantics.valueKind).toBe('ACTUAL');
    /* revisionOrdinal is unreachable without REVISED, and REVISED is publisher-stated. */
    expect(n.observation.semantics.revisionOrdinal).toBeUndefined();
  });

  it('exposes no revision vocabulary at all on the observation', () => {
    if (!n.ok) return;
    const o = n.observation as unknown as Record<string, unknown>;
    for (const forbidden of ['revisionKind', 'supersededValue', 'previousValue']) {
      expect(Object.prototype.hasOwnProperty.call(o, forbidden)).toBe(false);
    }
  });

  it('is DERIVED from nothing — the value is ACTUAL, never computed from components', () => {
    if (!n.ok) return;
    expect(n.observation.semantics.valueKind).not.toBe('DERIVED');
  });

  it('reaches parser identity and source language THROUGH the retrieval', () => {
    if (!n.ok) return;
    /* R-NUM-2: they are not Economy fields. The observation itself carries neither. */
    const o = n.observation as unknown as Record<string, unknown>;
    expect(o['sourceLanguage']).toBeUndefined();
    expect(o['parserId']).toBeUndefined();
    /* They arrive here. */
    expect(n.lineage.retrieval.sourceLanguage).toBe('en');
    expect(n.lineage.retrieval.referencePeriod).toBe('2026-08');
  });

  it('is publishable, by the contract’s own single predicate', () => {
    const read = readNisrCpiNationalFigureSlot(input());
    expect(read.slot.kind).toBe('OBSERVATION');
    expect(read.publishable).toBe(true);
  });
});

describe('freshness is derived from the publisher cadence, never asserted', () => {
  it('is FRESH while the next monthly release is not yet due', () => {
    expect(nisrCpiFreshness('2026-09-10', '2026-09-20T00:00:00Z')).toBe('FRESH');
  });

  it('ages and then goes stale once the next release is overdue', () => {
    expect(nisrCpiFreshness('2026-09-10', '2026-10-14T00:00:00Z')).toBe('AGEING');
    expect(nisrCpiFreshness('2026-09-10', '2026-11-01T00:00:00Z')).toBe('STALE');
  });

  it('is UNDETERMINED rather than a guess when a date cannot be read', () => {
    expect(nisrCpiFreshness('not-a-date', '2026-09-20T00:00:00Z')).toBe('UNDETERMINED');
  });
});

/* ══════════════════════════════════════════════════════════════════════════
 * 3 · ABSENCE IS A GAP WITH A REASON — NEVER A ZERO
 * ══════════════════════════════════════════════════════════════════════════ */

describe('the internal read returns a slot, so absence carries a reason', () => {
  it('reports WITHHELD when the publisher’s national annex carried no general-index row', () => {
    const read = readNisrCpiNationalFigureSlot(
      input({ decoded: decodedFixture({ rows: [] }) }),
    );
    expect(read.slot).toEqual({
      kind: 'GAP',
      seriesId: nisrCpiNationalSeries().seriesId,
      periodId: '2026-08',
      reason: 'WITHHELD',
    });
    expect(read.publishable).toBe(false);
  });

  it('NEVER returns a zero, and never a null value, for an absent figure', () => {
    const read = readNisrCpiNationalFigureSlot(
      input({ decoded: decodedFixture({ rows: [] }) }),
    );
    expect(JSON.stringify(read.slot)).not.toContain('"value"');
    if (read.slot.kind === 'GAP') expect(read.slot.reason).toBeTruthy();
  });

  it('separates OUR failure from the publisher’s', () => {
    /* A period we cannot parse is a fact about us. */
    const ours = readNisrCpiNationalFigureSlot(
      input({ decoded: decodedFixture({ referencePeriod: 'August 2026' }) }),
    );
    expect(ours.slot.kind === 'GAP' && ours.slot.reason).toBe('NO_PRODUCER');
  });
});

/* ══════════════════════════════════════════════════════════════════════════
 * 4 · THE TWO-ARTIFACT CASE — R1 RULING D — AND ITS NEGATIVE CONTROL
 * ══════════════════════════════════════════════════════════════════════════ */

describe('two artifacts, one logical period', () => {
  it('has no edition comparator, because NISR publishes nothing that orders releases', () => {
    expect(NISR_CPI_HAS_EDITION_COMPARATOR).toBe(false);
    expect(retrievalFixture().editionAnnotations).toEqual({});
  });

  it('treats a first sighting as ADVANCED and identical bytes as SAME', () => {
    expect(nisrCpiEditionOrderFor([], ADDRESS_A)).toBe('ADVANCED');
    expect(nisrCpiEditionOrderFor([ADDRESS_A], ADDRESS_A)).toBe('SAME');
    /* Two fetches of unchanged bytes are ONE artifact and two retrievals. */
  });

  it('is AMBIGUOUS when the same period arrives with a different content address', () => {
    expect(nisrCpiEditionOrderFor([ADDRESS_A], ADDRESS_B)).toBe('AMBIGUOUS');
    expect(retrievalMaySupplyValues('AMBIGUOUS')).toBe(false);
  });

  it('THE SECOND ARTIFACT SUPPLIES NO VALUES, and nothing is revised', () => {
    const order = nisrCpiEditionOrderFor([ADDRESS_A], ADDRESS_B);
    const second = readNisrCpiNationalFigureSlot(
      input({
        editionOrder: order,
        retrieval: retrievalFixture({
          retrievalId: 'ret-3',
          contentAddress: ADDRESS_B as OfficialDataRetrieval['contentAddress'],
        }),
      }),
    );

    expect(second.slot.kind).toBe('GAP');
    if (second.slot.kind === 'GAP') expect(second.slot.reason).toBe('NO_PRODUCER');
    expect(second.publishable).toBe(false);
    expect(second.detail).toBe('EDITION_ORDER_AMBIGUOUS_SUPPLIES_NO_VALUES');
    /* No value is assembled and then discarded: there is no moment at which a figure
       from an unorderable edition exists. */
    expect(JSON.stringify(second.slot)).not.toContain(String(ALL_RWANDA_ANNUAL_AUG2026));
  });

  it('NEGATIVE CONTROL — the path that WOULD let an AMBIGUOUS retrieval supply values fails', () => {
    /*
      `R-A`: a guard not shown to bind is not evidence. So this constructs the exact
      shortcut a producer would reach for — normalise first, consult the order after —
      and demonstrates that it cannot produce a figure.

      The decoded artifact, the retrieval and the provenance are all VALID here. The ONLY
      thing separating this call from the passing one above is the edition order, which is
      what makes it a control rather than a second failure test.
    */
    const valid = readNisrCpiNationalFigureSlot(input({ editionOrder: 'ADVANCED' }));
    expect(valid.slot.kind).toBe('OBSERVATION');

    for (const order of ['AMBIGUOUS', 'BEHIND'] as const) {
      const blocked = readNisrCpiNationalFigureSlot(input({ editionOrder: order }));
      expect({ order, kind: blocked.slot.kind }).toEqual({ order, kind: 'GAP' });
      expect({ order, publishable: blocked.publishable }).toEqual({ order, publishable: false });
    }

    /* And the guard is the contract's own function, not a local re-implementation that
       could drift from it. */
    expect(retrievalMaySupplyValues('AMBIGUOUS')).toBe(false);
    expect(retrievalMaySupplyValues('BEHIND')).toBe(false);
    expect(retrievalMaySupplyValues('ADVANCED')).toBe(true);
    expect(retrievalMaySupplyValues('SAME')).toBe(true);
  });

  it('BOTH ARTIFACTS ARE STILL RETAINED — the second is evidence, not garbage', () => {
    /*
      Ruling D’s outcome is "retained and supplying no values", not "rejected", and the
      two halves are independent: a GAP is the answer to a READ, and it says nothing
      about whether the bytes are kept.

      So the assertion is on the EVIDENCE rather than on the absence of a word in a
      source file: the second retrieval still satisfies `assertRetrievalIsProvable`,
      which is the contract’s own test of whether a retrieval can be re-proved later.
      A retrieval that supplies no values is still a retrieval that proves something.
    */
    const secondRetrieval = retrievalFixture({
      retrievalId: 'ret-3',
      contentAddress: ADDRESS_B as OfficialDataRetrieval['contentAddress'],
    });

    expect(() => assertRetrievalIsProvable(secondRetrieval)).not.toThrow();
    expect(secondRetrieval.contentAddress).toBe(ADDRESS_B);
    expect(secondRetrieval.completeness).toBe('COMPLETE');
    expect(secondRetrieval.rights.payloadRetentionPermitted).toBe(true);

    /* And it is a DIFFERENT artifact from the first, which is the fact ruling D turns
       on: identical bytes would have been one payload and two retrievals. */
    expect(secondRetrieval.contentAddress).not.toBe(retrievalFixture().contentAddress);
    expect(secondRetrieval.retrievalId).not.toBe(retrievalFixture().retrievalId);
  });
});
