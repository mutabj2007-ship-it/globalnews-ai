import { PrismaService } from '../../database/prisma.service';
import type { SituationIdentity, SituationObservation } from './situation.contract';
import {
  SITUATION_IDENTITY_PORT,
  SituationIdentityPortNotWiredError,
  UNWIRED_SITUATION_IDENTITY_PORT,
  type AttachmentDecision,
  type SituationAnchor,
  type SituationIdentityPort,
} from './situation-identity.port';
import { recommendationFrom, resolveShadowOnly } from './situation-attachment';
import { SituationRepository } from './situation.repository';
import { SituationShadowRepository } from './situation-shadow.repository';
import { SituationService } from './situation.service';

/**
 * S1-R2 — SHADOW MODE.
 *
 * The CTO's ruling and G's recommendation are the same sentence: tier-2
 * attachment is not validated for production and must remain shadow-only.
 * These tests are what stops that from being a comment somebody deletes.
 *
 * The sharpest assertion in this file is the one where the policy says ATTACH
 * with a high score and the store STILL writes no situation. That is the whole
 * of shadow mode, in one test.
 */

interface Recorder {
  calls: Array<{ model: string; op: string; args: unknown }>;
  shadow: Array<Record<string, unknown>>;
  situations: Array<Record<string, unknown>>;
}

function buildClient(recorder: Recorder, bucket: Array<Record<string, unknown>> = []): PrismaService {
  let n = 1;
  recorder.situations.push(...bucket);
  const touch = (model: string, op: string, args: unknown): void => {
    recorder.calls.push({ model, op, args });
  };
  const delegates = {
    situation: {
      findUnique: (a: unknown) => {
        touch('situation', 'findUnique', a);
        return Promise.resolve(null);
      },
      findMany: (a: { where: { partitionKey: string; keyVersion: string } }) => {
        touch('situation', 'findMany', a);
        return Promise.resolve(
          recorder.situations.filter(
            (r) => r.partitionKey === a.where.partitionKey && r.keyVersion === a.where.keyVersion,
          ),
        );
      },
      create: (a: { data: Record<string, unknown> }) => {
        touch('situation', 'create', a);
        const row = { ...a.data, id: `sit-${n++}` };
        recorder.situations.push(row);
        return Promise.resolve(row);
      },
      update: (a: unknown) => {
        touch('situation', 'update', a);
        return Promise.resolve({});
      },
    },
    situationSnapshot: {
      findFirst: (a: unknown) => {
        touch('situationSnapshot', 'findFirst', a);
        return Promise.resolve(null);
      },
      create: (a: { data: Record<string, unknown> }) => {
        touch('situationSnapshot', 'create', a);
        return Promise.resolve({ ...a.data, id: `snap-${n++}` });
      },
    },
    situationCluster: {
      create: (a: { data: Record<string, unknown> }) => {
        touch('situationCluster', 'create', a);
        return Promise.resolve({ ...a.data, id: `clu-${n++}` });
      },
    },
    situationClusterMember: {
      createMany: (a: { data: unknown[] }) => {
        touch('situationClusterMember', 'createMany', a);
        return Promise.resolve({ count: a.data.length });
      },
    },
    situationShadowDecision: {
      create: (a: { data: Record<string, unknown> }) => {
        touch('situationShadowDecision', 'create', a);
        if (a.data.shadowOnly !== true) {
          return Promise.reject(new Error('check constraint: shadowOnly = true'));
        }
        const row = { ...a.data, id: `sd-${n++}` };
        recorder.shadow.push(row);
        return Promise.resolve(row);
      },
    },
  };
  return {
    ...delegates,
    $transaction: <T,>(fn: (tx: unknown) => Promise<T>): Promise<T> => {
      touch('$transaction', 'begin', undefined);
      return fn(delegates);
    },
  } as unknown as PrismaService;
}

const OBS: SituationObservation = {
  url: 'https://obs.test/1',
  title: 'Ceasefire agreed after border fighting',
  summary: 'Armies agreed a ceasefire.',
  observedAt: new Date('2026-08-31T09:00:00.000Z'),
  countryCode: 'RW',
};

const T = new Date('2026-08-31T10:00:00.000Z');

/** A stand-in for G's port. NOT a proposal for G's derivation. */
const portWith = (decision: Partial<AttachmentDecision>): SituationIdentityPort => ({
  keyVersion: 'v1',
  policyId: 'SITUATION_CONTINUITY_CANDIDATE',
  policyThreshold: 0.35,
  derivePartitionKey: () => 'sit:v1:RWA',
  decideAttachment: (): AttachmentDecision => ({
    attached: false,
    bestScore: null,
    reason: 'no anchors',
    features: {},
    anchorArticleUrl: null,
    shadowOnly: true,
    ...decision,
  }),
});

const buildService = (
  recorder: Recorder,
  port: SituationIdentityPort,
  bucket: Array<Record<string, unknown>> = [],
): SituationService => {
  const client = buildClient(recorder, bucket);
  return new SituationService(
    new SituationRepository(client),
    new SituationShadowRepository(client),
    port,
  );
};

const emptyRecorder = (): Recorder => ({ calls: [], shadow: [], situations: [] });

const OBSERVE = {
  observation: OBS,
  analysedAt: T,
  dimensions: { severity: 'HIGH' },
  clusters: [{ clusterKey: 'c1', publisherCount: 1, articleUrls: ['https://a.test/1'] }],
  analysisRunId: 'run-abc',
};

describe('S1-R2 shadow mode — a recommendation to ATTACH is still not acted on', () => {
  it('the policy says ATTACH with a strong score, and NO situation is written', async () => {
    const recorder = emptyRecorder();
    const service = buildService(
      recorder,
      portWith({
        attached: true,
        bestScore: 0.9,
        reason: 'min-overlap 0.9',
        features: { overlap: 0.9 },
        anchorArticleUrl: 'https://anchor.test/1',
        shadowOnly: true,
      }),
      [
        {
          id: 'sit-existing',
          partitionKey: 'sit:v1:RWA',
          keyVersion: 'v1',
          discriminator: 'd-existing',
          seedArticleUrl: 'https://anchor.test/1',
          seedObservedAt: new Date('2026-08-29T09:00:00.000Z'),
        },
      ],
    );

    const result = await service.observeCompletedAnalysis(OBSERVE);

    expect(result.persisted).toBe(false);
    expect(result.reason).toBe('TIER2_SHADOW_ONLY');
    expect(result.append).toBeNull();
    // Not one write to the store it is shadowing.
    expect(recorder.calls.filter((c) => c.model === 'situationSnapshot')).toEqual([]);
    expect(recorder.calls.filter((c) => c.op === 'create' && c.model === 'situation')).toEqual([]);
  });

  it('but the decision IS recorded, with its policy and the threshold it was judged against', async () => {
    const recorder = emptyRecorder();
    const service = buildService(
      recorder,
      portWith({
        attached: true,
        bestScore: 0.4118,
        reason: 'min-overlap over headline tokens, no time gate',
        features: { overlap: 0.4118, sharedTokens: 7, gapHours: 48 },
        anchorArticleUrl: 'https://anchor.test/1',
        shadowOnly: true,
      }),
      [
        {
          id: 'sit-existing',
          partitionKey: 'sit:v1:RWA',
          keyVersion: 'v1',
          discriminator: 'd-existing',
          seedArticleUrl: 'https://anchor.test/1',
          seedObservedAt: new Date('2026-08-29T09:00:00.000Z'),
        },
      ],
    );

    await service.observeCompletedAnalysis(OBSERVE);

    expect(recorder.shadow).toHaveLength(1);
    const row = recorder.shadow[0];
    expect(row.recommendation).toBe('ATTACH_RECOMMENDED');
    expect(row.score).toBe(0.4118);
    expect(row.policyId).toBe('SITUATION_CONTINUITY_CANDIDATE');
    // WITHOUT THE THRESHOLD THE ROW IS UNINTERPRETABLE once the policy moves —
    // and moving it is the entire point of gathering this corpus.
    expect(row.policyThreshold).toBe(0.35);
    expect(row.shadowOnly).toBe(true);
    expect(row.candidateSituationId).toBe('sit-existing');
    expect(row.candidateDiscriminator).toBe('d-existing');
    expect(row.observationUrl).toBe('https://obs.test/1');
    expect(row.features).toEqual({ overlap: 0.4118, sharedTokens: 7, gapHours: 48 });
  });

  it('an EMPTY BUCKET is recorded as NO_CANDIDATE with a NULL score, never as 0', async () => {
    // A distribution that recorded 0 for "nothing to compare against" would
    // pile up at the bottom and drag any threshold chosen from it.
    const recorder = emptyRecorder();
    const service = buildService(recorder, portWith({}));

    const result = await service.observeCompletedAnalysis(OBSERVE);

    expect(result.anchorCount).toBe(0);
    expect(recorder.shadow[0].recommendation).toBe('NO_CANDIDATE');
    expect(recorder.shadow[0].score).toBeNull();
    expect(recorder.shadow[0].candidateSituationId).toBeNull();
  });

  it('a refusal to attach within a non-empty bucket is OPEN_NEW_RECOMMENDED', async () => {
    const recorder = emptyRecorder();
    const service = buildService(
      recorder,
      portWith({ attached: false, bestScore: 0.2, reason: 'below threshold' }),
      [
        {
          id: 'sit-x',
          partitionKey: 'sit:v1:RWA',
          keyVersion: 'v1',
          discriminator: 'd-x',
          seedArticleUrl: 'https://anchor.test/9',
          seedObservedAt: new Date('2026-08-29T09:00:00.000Z'),
        },
      ],
    );

    await service.observeCompletedAnalysis(OBSERVE);
    expect(recorder.shadow[0].recommendation).toBe('OPEN_NEW_RECOMMENDED');
    expect(recorder.shadow[0].score).toBe(0.2);
  });

  it('shadowOnly is a literal true, and a false value is refused by the store', async () => {
    const recorder = emptyRecorder();
    const client = buildClient(recorder);
    // There is no argument through which a caller could ask for false, so the
    // only way to test the guard is to go around the repository.
    const raw = client as unknown as {
      situationShadowDecision: { create: (a: unknown) => Promise<unknown> };
    };
    await expect(
      raw.situationShadowDecision.create({ data: { shadowOnly: false } }),
    ).rejects.toThrow('shadowOnly = true');
  });

  it('the shadow write touches ONLY the shadow table', async () => {
    const recorder = emptyRecorder();
    await buildService(recorder, portWith({})).observeCompletedAnalysis(OBSERVE);

    const written = recorder.calls
      .filter((c) => c.op === 'create' || c.op === 'createMany')
      .map((c) => c.model);
    expect(written).toEqual(['situationShadowDecision']);
  });
});

describe('S1-R2 — the identity port is not wired, and nothing pretends otherwise', () => {
  it('the unwired default throws rather than deriving a partition key', () => {
    expect(() =>
      UNWIRED_SITUATION_IDENTITY_PORT.derivePartitionKey(OBS),
    ).toThrow(SituationIdentityPortNotWiredError);
    expect(() => UNWIRED_SITUATION_IDENTITY_PORT.decideAttachment(OBS, [])).toThrow(
      SituationIdentityPortNotWiredError,
    );
  });

  it('does not fall back to the country code, the URL, or anything else derivable', () => {
    let outcome = 'NOT CALLED';
    try {
      UNWIRED_SITUATION_IDENTITY_PORT.derivePartitionKey(OBS);
    } catch {
      outcome = 'THREW';
    }
    expect(outcome).toBe('THREW');
  });

  it('the refusal names the reason: G\'s package is accepted but not converged', () => {
    let message = '';
    try {
      UNWIRED_SITUATION_IDENTITY_PORT.derivePartitionKey(OBS);
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toContain('NOT present in this worktree');
    expect(message).toContain('nothing is written');
  });

  it('an observation through the unwired port writes nothing at all — not even a shadow row', async () => {
    const recorder = emptyRecorder();
    const service = buildService(recorder, UNWIRED_SITUATION_IDENTITY_PORT);

    await expect(service.observeCompletedAnalysis(OBSERVE)).rejects.toThrow(
      SituationIdentityPortNotWiredError,
    );
    expect(recorder.calls).toEqual([]);
    expect(recorder.shadow).toEqual([]);
  });

  it('writePathStatus reports the phase from what is actually bound', () => {
    expect(buildService(emptyRecorder(), UNWIRED_SITUATION_IDENTITY_PORT).writePathStatus()).toEqual(
      {
        identityPortWired: false,
        keyVersion: 'UNWIRED',
        policyId: 'UNWIRED',
        tier2: 'SHADOW_ONLY',
      },
    );
    expect(buildService(emptyRecorder(), portWith({})).writePathStatus()).toEqual({
      identityPortWired: true,
      keyVersion: 'v1',
      policyId: 'SITUATION_CONTINUITY_CANDIDATE',
      // WIRING G'S PACKAGE DOES NOT PROMOTE TIER 2. Tier 1 becomes live; tier 2
      // stays shadow because `shadowOnly` comes from G's own decision.
      tier2: 'SHADOW_ONLY',
    });
  });

  it('the module token exists and the unwired default is the one it names', () => {
    expect(typeof SITUATION_IDENTITY_PORT).toBe('symbol');
    expect(UNWIRED_SITUATION_IDENTITY_PORT.keyVersion).toBe('UNWIRED');
  });
});

describe('S1-R2 — the phase gate itself', () => {
  it('resolveShadowOnly NEVER returns an identity, even when the policy attached', () => {
    const decision: AttachmentDecision = {
      attached: true,
      bestScore: 0.99,
      reason: 'all but identical',
      features: { overlap: 0.99 },
      anchorArticleUrl: 'https://anchor.test/1',
      shadowOnly: true,
    };
    const anchor: SituationAnchor = {
      situationId: 'sit-1',
      discriminator: 'd-1',
      anchorArticleUrl: 'https://anchor.test/1',
      anchorTitle: '',
      anchorObservedAt: new Date('2026-08-29T09:00:00.000Z'),
    };

    const resolution = resolveShadowOnly(OBS, decision, anchor);

    expect(resolution.outcome).toBe('SHADOW_ONLY');
    expect(resolution.identity).toBeNull();
    // The decision survives intact for the record; only its authority is gone.
    expect(resolution.decision.attached).toBe(true);
    expect(resolution.candidate).toBe(anchor);
  });

  it('the recommendation vocabulary distinguishes "nothing to compare" from "compared and refused"', () => {
    const base: AttachmentDecision = {
      attached: false,
      bestScore: null,
      reason: '',
      features: {},
      anchorArticleUrl: null,
      shadowOnly: true,
    };
    expect(recommendationFrom(base, 0)).toBe('NO_CANDIDATE');
    expect(recommendationFrom(base, 3)).toBe('OPEN_NEW_RECOMMENDED');
    expect(recommendationFrom({ ...base, attached: true }, 3)).toBe('ATTACH_RECOMMENDED');
    // Zero anchors wins over `attached`, because with nothing in the bucket
    // there was nothing an attachment could have been to.
    expect(recommendationFrom({ ...base, attached: true }, 0)).toBe('NO_CANDIDATE');
  });
});

describe('S1-R2 — an identity supplied by a caller is still fully validated', () => {
  it('a resolved append writes normally once an identity exists', async () => {
    const recorder = emptyRecorder();
    const client = buildClient(recorder);
    const identity: SituationIdentity = {
      partitionKey: 'sit:v1:RWA',
      keyVersion: 'v1',
      discriminator: 'd-1',
      discriminatorBasis: 'SEED_OBSERVATION_V1',
    };

    const result = await new SituationRepository(client).appendCompletedAnalysis({
      identity,
      observation: OBS,
      analysedAt: T,
      dimensions: { severity: 'HIGH' },
      clusters: [{ clusterKey: 'c1', publisherCount: 1, articleUrls: ['https://a.test/1'] }],
    });

    expect(result.state).toBe('FIRST_OBSERVATION');
    expect(result.identity).toEqual(identity);
  });
});
