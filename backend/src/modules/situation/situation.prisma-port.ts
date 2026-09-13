/**
 * SITUATION MEMORY — S1. THE NARROW DELEGATE SURFACE THIS NAMESPACE USES.
 *
 * WHY A HAND-DECLARED PORT RATHER THAN THE GENERATED TYPES.
 *
 * `backend/src/generated/prisma` is a BUILD ARTEFACT, not source: it is
 * listed in backend/.gitignore and is produced by `prisma generate` from
 * the schema. It therefore does not exist in a checkout until the build
 * has run, and the delegates for the four new models do not exist in ANY
 * checkout until `prisma generate` has run against the migrated schema.
 *
 * Declaring the surface this namespace actually uses does three things:
 *
 *   1. the repository's logic can be unit-tested against a fake without a
 *      database, which is what makes the transactional and append-only
 *      guarantees testable at all;
 *   2. the exact delegate calls this feature depends on are visible in one
 *      short file instead of spread through the repository;
 *   3. a client that does not carry the new delegates FAILS LOUDLY at
 *      construction, naming what is missing, rather than throwing
 *      "cannot read property 'upsert' of undefined" at the first write.
 *
 * The cost is that this file must be kept in step with the schema. That is
 * the trade the runtime check below is there to defend: if the shapes
 * diverge, the error names the model and the method.
 */

export interface SituationRow {
  id: string;
  partitionKey: string;
  keyVersion: string;
  discriminator: string;
  discriminatorBasis: string;
  seedArticleUrl: string;
  seedObservedAt: Date;
  countryCode: string | null;
  firstObservedAt: Date;
  lastRetrievedAt: Date | null;
  lastAnalysedAt: Date | null;
}

export interface SituationShadowDecisionRow {
  id: string;
  decidedAt: Date;
  partitionKey: string;
  keyVersion: string;
  observationUrl: string;
  candidateSituationId: string | null;
  candidateDiscriminator: string | null;
  anchorArticleUrl: string | null;
  score: number | null;
  recommendation: string;
  reason: string;
  features: unknown;
  policyId: string;
  policyThreshold: number;
  shadowOnly: boolean;
}

export interface SituationSnapshotRow {
  id: string;
  situationId: string;
  analysedAt: Date;
  state: string;
  dimensions: unknown;
  analysisRunId: string | null;
}

export interface SituationClusterRow {
  id: string;
  snapshotId: string;
  clusterKey: string;
  publisherCount: number;
  memberCount: number;
}

export interface SituationDelegate {
  /**
   * THE IDENTITY LOOKUP, AND IT IS THE TRIPLE. Looking a situation up by
   * partition key alone is meaningless under G's contract — several distinct
   * situations legitimately share one — so no such method exists here.
   */
  findUnique(args: {
    where: {
      partitionKey_keyVersion_discriminator: {
        partitionKey: string;
        keyVersion: string;
        discriminator: string;
      };
    };
  }): Promise<SituationRow | null>;

  /**
   * THE BUCKET LOOKUP. G's write path: load the situations sharing this
   * observation's partition at this key version, and compare against those and
   * nothing else. Bounded by construction.
   */
  findMany(args: {
    where: { partitionKey: string; keyVersion: string };
    orderBy?: Array<{ lastAnalysedAt?: 'desc' | 'asc'; firstObservedAt?: 'desc' | 'asc' }>;
    take?: number;
  }): Promise<SituationRow[]>;

  create(args: {
    data: {
      partitionKey: string;
      keyVersion: string;
      discriminator: string;
      discriminatorBasis: string;
      seedArticleUrl: string;
      seedObservedAt: Date;
      countryCode: string | null;
      firstObservedAt: Date;
      lastRetrievedAt: Date | null;
      lastAnalysedAt: Date | null;
    };
  }): Promise<SituationRow>;

  /**
   * THE MUTABLE SURFACE, AND IT IS DELIBERATELY NARROW. There is no way to
   * express an update to discriminator, partitionKey, keyVersion, seed* or
   * firstObservedAt through this type — the assign-once guarantee is enforced
   * by the shape of the argument, before the database trigger ever sees it.
   */
  update(args: {
    where: { id: string };
    data: {
      countryCode?: string | null;
      lastRetrievedAt?: Date | null;
      lastAnalysedAt?: Date | null;
    };
  }): Promise<SituationRow>;
}

export interface SituationShadowDecisionDelegate {
  create(args: {
    data: {
      decidedAt: Date;
      partitionKey: string;
      keyVersion: string;
      observationUrl: string;
      candidateSituationId: string | null;
      candidateDiscriminator: string | null;
      anchorArticleUrl: string | null;
      score: number | null;
      recommendation: string;
      reason: string;
      features: unknown;
      policyId: string;
      policyThreshold: number;
      shadowOnly: true;
    };
  }): Promise<SituationShadowDecisionRow>;
}

export interface SituationSnapshotDelegate {
  findFirst(args: {
    where: { situationId: string };
    orderBy: Array<{ analysedAt?: 'desc' | 'asc'; createdAt?: 'desc' | 'asc' }>;
  }): Promise<SituationSnapshotRow | null>;
  create(args: {
    data: {
      situationId: string;
      analysedAt: Date;
      state: string;
      dimensions: unknown;
      analysisRunId: string | null;
    };
  }): Promise<SituationSnapshotRow>;
}

export interface SituationClusterDelegate {
  create(args: {
    data: {
      snapshotId: string;
      clusterKey: string;
      publisherCount: number;
      memberCount: number;
    };
  }): Promise<SituationClusterRow>;
}

export interface SituationClusterMemberDelegate {
  createMany(args: {
    data: Array<{ clusterId: string; articleUrl: string }>;
  }): Promise<{ count: number }>;
}

/**
 * The transactional surface. Every write in an append goes through ONE of
 * these, handed to the callback by `$transaction`.
 */
export interface SituationTransactionClient {
  situation: SituationDelegate;
  situationSnapshot: SituationSnapshotDelegate;
  situationCluster: SituationClusterDelegate;
  situationClusterMember: SituationClusterMemberDelegate;
  situationShadowDecision: SituationShadowDecisionDelegate;
}

export interface SituationPrismaPort extends SituationTransactionClient {
  $transaction<T>(fn: (tx: SituationTransactionClient) => Promise<T>): Promise<T>;
}

export class SituationClientShapeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SituationClientShapeError';
  }
}

/**
 * The delegates and methods this namespace calls, as data, so the check
 * below and this file's documentation cannot drift apart.
 */
const REQUIRED_SURFACE: ReadonlyArray<readonly [string, readonly string[]]> = [
  ['situation', ['findUnique', 'findMany', 'create', 'update']],
  ['situationSnapshot', ['findFirst', 'create']],
  ['situationCluster', ['create']],
  ['situationClusterMember', ['createMany']],
  ['situationShadowDecision', ['create']],
] as const;

/**
 * THE ONE DOOR from an untyped client into this namespace.
 *
 * The check is a real one, not a cast dressed up as a check: it walks the
 * required surface and names the first thing missing. A client generated
 * before the Situation migration will fail here, at module construction,
 * with a message that says which model is absent and that
 * `prisma generate` needs to run — rather than at 3am inside a write.
 */
export function asSituationPrismaPort(client: unknown): SituationPrismaPort {
  if (client === null || typeof client !== 'object') {
    throw new SituationClientShapeError(
      'A Prisma client is required for the situation store; received ' +
        (client === null ? 'null' : typeof client) +
        '.',
    );
  }

  const candidate = client as Record<string, unknown>;

  if (typeof candidate.$transaction !== 'function') {
    throw new SituationClientShapeError(
      'The client has no $transaction. The situation append is all-or-nothing and ' +
        'cannot be performed without one.',
    );
  }

  for (const [model, methods] of REQUIRED_SURFACE) {
    const delegate = candidate[model] as Record<string, unknown> | undefined;

    if (delegate === undefined || delegate === null || typeof delegate !== 'object') {
      throw new SituationClientShapeError(
        `The Prisma client has no "${model}" delegate. Run \`prisma generate\` against a ` +
          'schema that includes the Situation memory models (migration ' +
          '20260901050000_add_situation_memory, R2 revision).',
      );
    }

    for (const method of methods) {
      if (typeof delegate[method] !== 'function') {
        throw new SituationClientShapeError(
          `The Prisma client's "${model}" delegate has no ${method}(). The generated client ` +
            'does not match the schema this code was written against.',
        );
      }
    }
  }

  return client as SituationPrismaPort;
}
