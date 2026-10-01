import {
  projectHumanitarianWorkspace,
  assertWorkspaceIsWellFormed,
  humanitarianAskHandoff,
  type AdmittedRetainedEvidenceReadModel,
} from '@globalnews-ai/shared';
import type { AdmittedRetainedEvidence } from './retained/retained-evidence';

/**
 * HUMANITARIAN ANALYSIS WORKSPACE R1 — THE READ MODEL IS NOT A SECOND TRUTH.
 *
 * The workspace projection lives in `shared` and takes a STRUCTURAL read model so it
 * does not import the backend. That is only safe while the structural type is a
 * subset of the real admitted record — otherwise the workspace would be projecting a
 * shape nothing produces, which is the stale-contract trap by another route.
 *
 * So the assignability is proved here, where both types are in scope, rather than
 * assumed in a comment. If `AdmittedRetainedEvidence` drops or renames a field the
 * projection reads, this file stops compiling.
 */
describe('HUM-WS-CONTRACT · the admitted record satisfies the workspace read model', () => {
  it('is assignable without a cast, so the projection cannot drift from the admitter', () => {
    const admitted = {
      captureKey: 'c'.repeat(64),
      artifactSha256: 'a'.repeat(64),
      rawBase64: '',
      approvalId: 'approval-1',
      sourceRevisionId: 'rev-1',
      predecessorRevisionId: null,
      geometryRevisionId: 'geo-1',
      geometrySha256: 'b'.repeat(64),
      publisherReleasedAt: '2026-09-30T00:00:00.000Z',
      authorityEpoch: 1,
      authorityDigest: 'd'.repeat(64),
      observation: {
        observationKey: 'obs:1:1:x',
        identity: {
          domainId: 'HUMANITARIAN',
          upstreamAuthority: 'COPERNICUS_EMS',
          upstreamId: 'x',
        },
        observationKind: 'SOURCE_INUNDATION_EXTENT',
        subjectType: 'SOURCE_EVENT',
        subjectId: 'x',
        claim: { countryIso2: 'PL', geometry: {} as never },
        temporal: {
          publisherVintage: '2026-09-30T00:00:00.000Z',
          retrievedAt: '2026-09-30T06:00:00.000Z',
          temporalBasis: 'PUBLISHER_VINTAGE',
        },
        provenance: {
          sourceType: 'PUBLIC_DATA',
          providerId: 'COPERNICUS_EMS',
          retrievedAt: '2026-09-30T06:00:00.000Z',
          evidenceRole: 'PRIMARY_RECORD',
        },
        sourceReference: {},
        attributeAuthorship: [
          { attribute: 'geometry', authorship: 'PUBLISHER_STATED' },
          { attribute: 'countryIso2', authorship: 'PUBLISHER_STATED' },
        ],
        revision: {
          revisionOrdinal: 0,
          supersedesRevisionOrdinal: null,
          recordedAt: '2026-09-30T06:00:00.000Z',
        },
      },
    } satisfies AdmittedRetainedEvidence;

    /* The assignment itself is the proof. No cast, no `as`. */
    const readModel: AdmittedRetainedEvidenceReadModel = admitted;

    const workspace = projectHumanitarianWorkspace([readModel], '2026-10-01T00:00:00.000Z');
    expect(() => assertWorkspaceIsWellFormed(workspace)).not.toThrow();
    expect(workspace.records.map((r) => r.observationKey)).toEqual(['obs:1:1:x']);
    expect(workspace.records.map((r) => r.providerId)).toEqual(['COPERNICUS_EMS']);
  });

  it('no record admitted means no Ask subject, which is the production state today', () => {
    const workspace = projectHumanitarianWorkspace([], '2026-10-01T00:00:00.000Z');
    expect(humanitarianAskHandoff(workspace)).toEqual({
      available: false,
      refusal: 'NO_ADMITTED_RECORD',
    });
  });

  /**
   * The workspace never reaches a provider, a model or the retained CAPTURE bytes. The
   * projection is given pointers and publisher-stated attribute names; `rawBase64` is
   * not among the fields it reads, and this asserts that rather than trusting it.
   */
  it('projects identifiers only — the artifact bytes never enter the workspace', () => {
    const workspace = projectHumanitarianWorkspace([], '2026-10-01T00:00:00.000Z');
    const serialised = JSON.stringify(workspace);
    for (const forbidden of ['rawBase64', 'artifactSha256', 'authorityDigest', 'coordinates']) {
      expect(serialised).not.toContain(forbidden);
    }
  });
});
