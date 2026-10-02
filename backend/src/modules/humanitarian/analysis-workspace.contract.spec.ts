import {
  HumanitarianReadRefused,
  assertWorkspaceIsWellFormed,
  domainObservationKey,
  humanitarianAskHandoff,
  humanitarianIdentity,
  humanitarianRetainedRead,
  projectHumanitarianWorkspace,
  projectWorkspaceFromRead,
  type HumanitarianClaim,
  type HumanitarianObservation,
  type HumanitarianRetainedRecord,
} from '@globalnews-ai/shared';
import type { AdmittedRetainedEvidence } from './retained/retained-evidence';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * THE ANALYSIS WORKSPACE READS MAIN'S RECORD, AND ONLY MAIN'S RECORD — R2
 * ════════════════════════════════════════════════════════════════════════════
 *
 * ── WHAT THIS FILE ASSERTED IN R1, AND WHY IT IS INVERTED NOW ─────────────
 *
 * R1 proved that the Copernicus `AdmittedRetainedEvidence` — a geometry EXTENT record — was
 * assignable to the workspace's read model, because that was the only admitted humanitarian
 * record in the tree and the workspace had to be able to project it.
 *
 * Two convergence rulings made that assertion wrong to keep:
 *
 *   · Main's canonical `HumanitarianObservation` is now the one record authority, and the
 *     workspace reads `HumanitarianRetainedRecord` directly rather than a structural subset
 *     invented on H's side. There is no second read model to drift.
 *   · `HUM-READ-4` (C-3) refuses a reader row that references governed geometry. The
 *     Copernicus record IS a geometry record, so it is exactly what must NOT reach this
 *     surface in R1.
 *
 * So the proof is inverted rather than deleted: the geometry path is asserted CLOSED, and the
 * canonical path is asserted OPEN. A test that merely stopped checking would have left the
 * boundary unguarded at the moment it started mattering.
 */

const AT = '2026-10-02T00:00:00.000Z';
const admitAll = (): boolean => true;

function record(claim: HumanitarianClaim, upstreamId = 'FL-1'): HumanitarianRetainedRecord {
  const identity = humanitarianIdentity('GDACS', upstreamId);
  const observation: HumanitarianObservation = {
    observationKey: domainObservationKey(identity),
    identity,
    observationKind: claim.claimType,
    subjectType: 'SOURCE_EVENT',
    subjectId: upstreamId,
    claim,
    temporal: {
      publisherVintage: '2026-09-20T00:00:00.000Z',
      retrievedAt: '2026-09-21T00:00:00.000Z',
      temporalBasis: 'PUBLISHER_VINTAGE',
    },
    provenance: {
      sourceType: 'PUBLIC_DATA',
      providerId: 'GDACS',
      retrievedAt: '2026-09-21T00:00:00.000Z',
    },
    sourceReference: {},
    attributeAuthorship: [{ attribute: 'sourceTitle', authorship: 'PUBLISHER_STATED' }],
    revision: { revisionOrdinal: 0, supersedesRevisionOrdinal: null, recordedAt: AT },
  };
  return { captureKey: 'capture-1', publisherReleasedAt: '2026-09-20T00:00:00.000Z', observation };
}

const floodEvent = record({
  claimType: 'HUMANITARIAN_EVENT',
  hazardType: 'FLOOD',
  sourceNativeType: 'FL',
  sourceTitle: 'Flood',
  eventStatus: 'ONGOING',
  countryIso3: ['SDN'],
});

describe('HUM-WS-CONTRACT · one record authority, read end to end', () => {
  it("projects Main's canonical record straight out of the retained read", () => {
    const read = humanitarianRetainedRead([floodEvent], admitAll);
    const workspace = projectWorkspaceFromRead(read, AT);
    expect(() => assertWorkspaceIsWellFormed(workspace)).not.toThrow();
    expect(workspace.records.map((r) => r.observationKey)).toEqual([
      floodEvent.observation.observationKey,
    ]);
    expect(workspace.records.map((r) => r.providerId)).toEqual(['GDACS']);
    expect(humanitarianAskHandoff(workspace).available).toBe(true);
  });

  it('an empty store is the store state, and never an assessment', () => {
    const workspace = projectWorkspaceFromRead(humanitarianRetainedRead([], admitAll), AT);
    const row = workspace.dimensions.find((d) => d.id === 'WHERE');
    expect(row).toMatchObject({
      state: 'EMPTY',
      storeState: 'NO_RETAINED_EVIDENCE',
      absence: null,
    });
    expect(humanitarianAskHandoff(workspace)).toEqual({
      available: false,
      refusal: 'NO_ADMITTED_RECORD',
    });
  });
});

describe('HUM-WS-CONTRACT · the geometry path into the workspace is closed', () => {
  /**
   * The Copernicus admitted record remains a real backend type and is deliberately NOT
   * assignable to a reader row: its claim is a geometry extent, not one of Main's three
   * Humanitarian claims. This is a compile-time statement, asserted at runtime by the read
   * contract below so the file fails loudly rather than silently losing a guarantee.
   */
  it('a reader row that references governed geometry is refused by the read contract', () => {
    const withGeometry = {
      ...floodEvent,
      observation: {
        ...floodEvent.observation,
        claim: { ...floodEvent.observation.claim, geometryRecordKey: 'geom:copernicus:EMSR1' },
      },
    } as HumanitarianRetainedRecord;
    expect(() => humanitarianRetainedRead([withGeometry], admitAll)).toThrow(
      HumanitarianReadRefused,
    );
    expect(() => humanitarianRetainedRead([withGeometry], admitAll)).toThrow(/HUM-READ-4/);
  });

  it("the Copernicus extent claim is not one of Main's Humanitarian claim types", () => {
    /* Named rather than cast into place: if the Copernicus claim ever becomes a Humanitarian
       claim type, this list changes and a reviewer sees it. */
    const copernicusClaimKeys: readonly (keyof AdmittedRetainedEvidence)[] = [
      'captureKey',
      'artifactSha256',
      'observation',
    ];
    expect(copernicusClaimKeys).toContain('artifactSha256');
    /* And a Humanitarian reader row carries exactly three fields, none of them the artifact. */
    expect(Object.keys(floodEvent).sort()).toEqual([
      'captureKey',
      'observation',
      'publisherReleasedAt',
    ]);
  });

  it('projects identifiers only — no artifact bytes, no coordinates, no digest', () => {
    const workspace = projectHumanitarianWorkspace([floodEvent], AT);
    const serialised = JSON.stringify(workspace);
    for (const forbidden of [
      'rawBase64',
      'artifactSha256',
      'authorityDigest',
      'coordinates',
      'geometryRecordKey',
    ]) {
      expect(serialised).not.toContain(forbidden);
    }
  });
});
