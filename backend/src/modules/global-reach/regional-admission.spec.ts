import { ConfigService } from '@nestjs/config';
import { accountSourceCoverage } from '@globalnews-ai/shared';
import { GLOBAL_REACH_REGIONS, GLOBAL_REACH_SOURCE_PACKS } from './source-pack.registry';
import { GlobalReachService } from './global-reach.service';
import { GlobalReachAcquisitionService } from './global-reach-acquisition.service';

describe('CTO dormant regional admission', () => {
  it('derives coverage for 54 exact members without promoting research labels', () => {
    const service = new GlobalReachService({
      regions: GLOBAL_REACH_REGIONS,
      packs: GLOBAL_REACH_SOURCE_PACKS,
    });
    expect(service.coverage()).toEqual(
      accountSourceCoverage(GLOBAL_REACH_REGIONS, GLOBAL_REACH_SOURCE_PACKS),
    );
    expect(service.summary()).toMatchObject({
      governedCountryCount: 54,
      governedMembershipCount: 54,
      states: { UNVERIFIED: 54, VALIDATED_LOCAL_BASELINE: 0, PARTIAL: 0, COVERAGE_GAP: 0 },
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
        ).toMatchObject({ origin: 'GAP', reason: 'SOURCE_NOT_READY' });
      }
      expect(port.acquireAndRetain).not.toHaveBeenCalled();
      expect(port.resolveRights).not.toHaveBeenCalled();
      expect(transport).not.toHaveBeenCalled();
    } finally {
      transport.mockRestore();
    }
  });
});
