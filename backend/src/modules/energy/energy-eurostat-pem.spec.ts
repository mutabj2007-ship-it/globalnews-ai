import { createHash } from 'node:crypto';
import {
  EUROSTAT_ENERGY_ALPHA_R1_ENDPOINT_ID,
  EUROSTAT_ENERGY_ALPHA_R1_PARAMETERS,
  EUROSTAT_ENERGY_ALPHA_R1_PARSER_ID,
  EUROSTAT_ENERGY_ALPHA_R1_PARSER_VERSION,
  EUROSTAT_ENERGY_ALPHA_R1_REQUEST_PATH,
  InvalidEurostatEnergyCapture,
  normalizeEurostatEnergyCapture,
} from './energy-eurostat-pem';

function source(over: Record<string, unknown> = {}): Buffer {
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
    ...over,
  }));
}

function capture(over: Record<string, unknown> = {}) {
  const bytes = (over.bytes as Buffer | undefined) ?? source();
  const contentAddress = createHash('sha256').update(bytes).digest('hex');
  return {
    retrievalId: 'eurostat-energy-test',
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
    ...over,
  };
}

describe('Eurostat Energy retained parser', () => {
  it('maps the exact provisional Spain generation cell without conversion', () => {
    expect(normalizeEurostatEnergyCapture(capture())).toEqual({
      observationKey: 'energy:1:EUROSTAT:nrg_cb_pem:ES:TOTAL:GWH:2026-07',
      subjectId: 'energy:supply:ES:net-electricity-generation',
      subjectName: 'Spain · Total · Net electricity generation',
      subjectType: 'SUPPLY_SITUATION',
      geographyId: 'ES',
      spatialPrecision: 'COUNTRY',
      metric: 'GENERATION',
      period: '2026-07',
      value: 27662.582,
      unit: 'GWH',
      releaseStatus: 'PRELIMINARY',
      publisherChangedAt: '2026-09-23T23:00:00+0200',
      provenance: {
        sourceType: 'OFFICIAL_SOURCE',
        providerId: 'EUROSTAT',
        institution: 'Eurostat',
        evidenceRole: 'PRIMARY_RECORD',
        retrievedAt: '2026-09-24T20:00:01.000Z',
      },
      retrievalId: 'eurostat-energy-test',
      freshnessBasis: 'RETAINED_ONLY',
    });
  });

  it('maps only an explicit revised flag to REVISED', () => {
    const bytes = source({ status: { 0: 'r' } });
    expect(normalizeEurostatEnergyCapture(capture({ bytes })).releaseStatus).toBe('REVISED');
  });

  it.each([
    { bytes: source({ status: {} }) },
    { bytes: source({ status: { 0: 'e' } }) },
    { bytes: source({ value: { 0: 1 }, dimension: {
      freq: { category: { index: { M: 0 }, label: { M: 'Monthly' } } },
      siec: { category: { index: { TOTAL: 0 }, label: { TOTAL: 'Total' } } },
      unit: { category: { index: { MWH: 0 }, label: { MWH: 'Megawatt-hour' } } },
      geo: { category: { index: { ES: 0 }, label: { ES: 'Spain' } } },
      time: { category: { index: { '2026-07': 0 }, label: { '2026-07': '2026-07' } } },
    } }) },
    { rightsGrade: 'E-4' },
    { admissibility: 'REFUSED' },
    { providerId: 'OTHER' },
  ])('refuses unsupported evidence state %j', (over) => {
    expect(() => normalizeEurostatEnergyCapture(capture(over))).toThrow(
      InvalidEurostatEnergyCapture,
    );
  });

  it('refuses request-scope drift and digest mismatch', () => {
    expect(() =>
      normalizeEurostatEnergyCapture(capture({
        parameters: EUROSTAT_ENERGY_ALPHA_R1_PARAMETERS.map((x) =>
          x.key === 'geo' ? { key: 'geo', value: 'PL' } : x,
        ),
      })),
    ).toThrow('REQUEST_PARAMETERS_DRIFT:geo');

    expect(() =>
      normalizeEurostatEnergyCapture(capture({ contentAddress: '0'.repeat(64) })),
    ).toThrow('CAPTURE_DIGEST_OR_LENGTH');
  });
});
