import { ConfigService } from '@nestjs/config';
import { accountSourceCoverage } from '@globalnews-ai/shared';
import { GLOBAL_REACH_REGIONS, GLOBAL_REACH_SOURCE_PACKS } from './source-pack.registry';
import { GlobalReachService } from './global-reach.service';
import { GlobalReachAcquisitionService } from './global-reach-acquisition.service';
import {
  NO_ACTIVATION,
  internationalSourceStates,
  registryLocalCandidates,
} from './source-coverage.authority';

describe('CTO dormant regional admission', () => {
  it('derives coverage for 54 exact members without promoting research labels', () => {
    const service = new GlobalReachService({
      regions: GLOBAL_REACH_REGIONS,
      packs: GLOBAL_REACH_SOURCE_PACKS,
    });
    /* T1 — UPDATED DELIBERATELY: the service now folds the feed and official-source
       registries into the SAME shared accounting (no second system), so it equals the
       shared function called with those registry candidates. */
    expect(service.coverage()).toEqual(
      accountSourceCoverage(GLOBAL_REACH_REGIONS, GLOBAL_REACH_SOURCE_PACKS, {
        extraLocalSources: registryLocalCandidates(NO_ACTIVATION),
        internationalSources: internationalSourceStates(NO_ACTIVATION),
      }),
    );
    expect(service.summary()).toMatchObject({
      governedCountryCount: 54,
      governedMembershipCount: 54,
      states: { UNVERIFIED: 54, VALIDATED_LOCAL_BASELINE: 0, PARTIAL: 0, COVERAGE_GAP: 0 },
      /* T1 — the canonical reader state: nothing local is active and rights-cleared. */
      coverageStates: { COVERED_LOCAL: 0, UNVERIFIED: 0, COVERAGE_GAP: 54 },
    });
    expect(
      service.coverage().every((r) => r.gapReason && r.validatedLocalPublisherCount === 0),
    ).toBe(true);
  });
  it('cannot acquire research records even with an explicit allowlist and enabled flag', async () => {
    const entries = GLOBAL_REACH_SOURCE_PACKS.flatMap((p) => p.entries);
    const config = {
      get: (key: string) =>
        key === 'GLOBAL_REACH_ACQUISITION_ACTIVE'
          ? 'true'
          : entries.map((e) => e.sourceId).join(','),
    };
    const reach = new GlobalReachService({
      regions: GLOBAL_REACH_REGIONS,
      packs: GLOBAL_REACH_SOURCE_PACKS,
    });
    const worker = new GlobalReachAcquisitionService(config as unknown as ConfigService, reach);
    const port = {
      readRetained: jest.fn().mockResolvedValue([]),
      resolveRights: jest.fn(),
      acquireAndRetain: jest.fn(),
    };
    const transport = jest
      .spyOn(globalThis, 'fetch')
      .mockRejectedValue(new Error('Network forbidden'));
    try {
      for (const entry of entries) {
        expect(entry.activationStatus).toBe('DISABLED');
        expect(
          await worker.acquireForWorker(entry.sourceId, 'EXPLICIT_OPERATOR', port),
        ).toMatchObject({
          origin: 'GAP',
          /* T1 — UPDATED DELIBERATELY: a RESTRICTED recorded rights state is now refused
             by name (RIGHTS_RESTRICTED) before readiness is even considered. */
          reason: entry.rights.standing === 'RESTRICTED' ? 'RIGHTS_RESTRICTED' : 'SOURCE_NOT_READY',
        });
      }
      expect(port.acquireAndRetain).not.toHaveBeenCalled();
      expect(port.resolveRights).not.toHaveBeenCalled();
      expect(transport).not.toHaveBeenCalled();
    } finally {
      transport.mockRestore();
    }
  });
});
