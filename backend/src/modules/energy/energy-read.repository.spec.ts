import { createHash } from 'node:crypto';
import {
  EUROSTAT_ENERGY_ALPHA_R1_ENDPOINT_ID,
  EUROSTAT_ENERGY_ALPHA_R1_PARAMETERS,
  EUROSTAT_ENERGY_ALPHA_R1_PARSER_ID,
  EUROSTAT_ENERGY_ALPHA_R1_PARSER_VERSION,
  EUROSTAT_ENERGY_ALPHA_R1_REQUEST_PATH,
  EUROSTAT_ENERGY_ROW_PARSER_VERSION,
  normalizeEurostatEnergyCapture,
} from './energy-eurostat-pem';
import { inspectEnergyRow } from './energy-read.repository';

function source(): Buffer {
  return Buffer.from(JSON.stringify({
    class: 'dataset',
    version: '2.0',
    label: 'Net electricity generation by type of fuel - monthly data',
    source: 'ESTAT',
    updated: '2026-09-23T23:00:00+0200',
    id: ['freq', 'siec', 'unit', 'geo', 'time'],
    size: [1, 1, 1, 1, 1],
    dimension: {
      freq: { category: { index: { M: 0 }, label: { M: 'Monthly' } } },
      siec: { category: { index: { TOTAL: 0 }, label: { TOTAL: 'Total' } } },
      unit: { category: { index: { GWH: 0 }, label: { GWH: 'Gigawatt-hour' } } },
      geo: { category: { index: { ES: 0 }, label: { ES: 'Spain' } } },
      time: { category: { index: { '2026-07': 0 }, label: { '2026-07': '2026-07' } } },
    },
    value: { 0: 27662.582 },
    status: { 0: 'p' },
  }));
}

function row(over: Record<string, unknown> = {}) {
  const bytes = source();
  const contentAddress = createHash('sha256').update(bytes).digest('hex');
  const capture = {
    retrievalId: 'energy-r1',
    providerId: 'EUROSTAT',
    endpointId: EUROSTAT_ENERGY_ALPHA_R1_ENDPOINT_ID,
    requestPath: EUROSTAT_ENERGY_ALPHA_R1_REQUEST_PATH,
    parameters: EUROSTAT_ENERGY_ALPHA_R1_PARAMETERS,
    requestedAt: new Date('2026-09-24T20:00:00Z'),
    retrievedAt: new Date('2026-09-24T20:00:01Z'),
    httpStatus: 200,
    mediaType: 'application/json',
    byteLength: bytes.length,
    contentAddress,
    completeness: 'COMPLETE',
    admissibility: 'ADMITTED',
    refusalKey: null,
    parserId: EUROSTAT_ENERGY_ALPHA_R1_PARSER_ID,
    parserVersion: EUROSTAT_ENERGY_ALPHA_R1_PARSER_VERSION,
    rightsGrade: 'E-5',
    rightsInstrumentRef: 'Eurostat reuse policy',
    payloadRetentionPermitted: true,
    payload: {
      bytes,
      storageState: 'RETAINED',
      byteLength: bytes.length,
      contentAddress,
    },
  };
  const normalized = normalizeEurostatEnergyCapture(capture);
  return {
    id: 'row-1',
    observationKey: normalized.observationKey,
    revision: 0,
    snapshotRetrievalId: capture.retrievalId,
    snapshotRetrieval: capture,
    payload: normalized,
    evidencePointer: '/value/0',
    parserVersion: EUROSTAT_ENERGY_ROW_PARSER_VERSION,
    admission: 'ADMITTED',
    publicDisclosureApproved: false,
    reviewedBy: 'PRODUCT_OWNER_ALPHA',
    reviewRef: 'ALPHA:DESIGN_NATIVE_DATA_CONVERGENCE_R1:ENERGY_EUROSTAT_R1',
    ...over,
  };
}

describe('Energy retained reader Alpha visibility gate', () => {
  it('keeps an Alpha-reviewed row hidden by default', () => {
    expect(inspectEnergyRow(row())).toBeNull();
  });

  it('exposes the admitted raw-Eurostat row only when explicit Alpha review visibility is enabled', () => {
    expect(inspectEnergyRow(row(), { alphaReviewVisible: true })).toMatchObject({
      subjectName: 'Spain · Total · Net electricity generation',
      metric: 'GENERATION',
      period: '2026-07',
      value: 27662.582,
      unit: 'GWH',
      releaseStatus: 'PRELIMINARY',
    });
  });

  it('does not let the Alpha switch bypass review provenance', () => {
    expect(
      inspectEnergyRow(
        row({ reviewRef: 'OTHER:REVIEW', publicDisclosureApproved: false }),
        { alphaReviewVisible: true },
      ),
    ).toBeNull();

    expect(
      inspectEnergyRow(
        row({ reviewedBy: null, publicDisclosureApproved: false }),
        { alphaReviewVisible: true },
      ),
    ).toBeNull();
  });

  it('still permits a separately public-approved row without the Alpha switch', () => {
    expect(
      inspectEnergyRow(row({ publicDisclosureApproved: true })),
    ).not.toBeNull();
  });

  it('fails closed if the normalized row payload or evidence pointer drifts', () => {
    const bad = row();
    expect(
      inspectEnergyRow(
        { ...bad, evidencePointer: '/value/1' },
        { alphaReviewVisible: true },
      ),
    ).toBeNull();

    expect(
      inspectEnergyRow(
        { ...bad, payload: { ...bad.payload, value: 1 } },
        { alphaReviewVisible: true },
      ),
    ).toBeNull();
  });
});
