import { EAST_AFRICA_MEMBERS, EU27_MEMBERS, MIDDLE_EAST_MEMBERS } from '@globalnews-ai/shared';
import type { ReviewedUcdpCandidateCsvCapture } from './ucdp-candidate-csv.normalizer';

/**
 * Product Owner-approved Alpha Design-Native Data Convergence R1:
 * one exact, public UCDP Candidate monthly artifact reviewed by digest.
 *
 * The publisher download center states that current datasets are free of charge
 * under CC BY 4.0. The retained bytes must match this SHA exactly; a later
 * monthly release or changed byte stream is a different review.
 */
export const UCDP_CANDIDATE_AUGUST_2026: ReviewedUcdpCandidateCsvCapture = Object.freeze({
  sha256: '2ad6e0b2bfdbaa31873716a3455096923a8539519d69d96aeeea2d0f44a34593',
  datasetVersion: '26.0.8',
  sourceUrl: 'https://ucdp.uu.se/downloads/candidateged/GEDEvent_v26_0_8.csv',
  schema: 'ucdp-candidate-csv-v1',
  countryAllowlistIso3: Object.freeze([
    ...EAST_AFRICA_MEMBERS,
    ...MIDDLE_EAST_MEMBERS,
    ...EU27_MEMBERS,
  ]),
});

export const UCDP_CANDIDATE_RIGHTS = Object.freeze({
  rightsGrade: 'E-5',
  rightsInstrumentRef: 'https://ucdp.uu.se/downloads/ — UCDP datasets licensed CC BY 4.0',
  payloadRetentionPermitted: true,
  attributionRequired: true,
});
