import { assertSecurityStoredBinding, assertSecurityDraft } from './security-observation.integrity';
import { Injectable } from '@nestjs/common';
import {
  assertSecurityObservationIsWellFormed,
  type SecurityObservation,
} from '@globalnews-ai/shared';
import { PrismaService } from '../../../database/prisma.service';
import type { Prisma } from '../../../generated/prisma/client';
function canonical(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object')
    return (
      '{' +
      Object.entries(value)
        .filter(([, v]) => v !== undefined)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => JSON.stringify(k) + ':' + canonical(v))
        .join(',') +
      '}'
    );
  return JSON.stringify(value);
}
export interface SecurityRun {
  id: number;
  geographyId: string;
  maxAgeMinutes: number;
}
export type SecurityObservationReadResult =
  | { succeeded: true; observations: readonly SecurityObservation[]; status: 'OK' | 'NO_RESULTS' }
  | { succeeded: false; detail: string };
@Injectable()
export class SecurityObservationRepository {
  constructor(private readonly prisma: PrismaService) {}
  async startRun(geographyId: string, maxAgeMinutes: number): Promise<SecurityRun | null> {
    try {
      return await this.prisma.securityProjectionRun.create({
        data: { geographyId, maxAgeMinutes },
      });
    } catch {
      return null;
    }
  }
  async completeRun(
    run: SecurityRun,
    observations: readonly SecurityObservation[],
    status: 'OK' | 'NO_RESULTS' | 'SOURCE_UNAVAILABLE',
  ): Promise<boolean> {
    try {
      if ((status === 'OK') !== observations.length > 0)
        throw new Error('Outcome and projection disagree');
      await this.prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'security-r2:' + run.geographyId}))`;
        const persistedRun = await tx.securityProjectionRun.findUnique({ where: { id: run.id } });
        if (
          !persistedRun ||
          persistedRun.id !== run.id ||
          persistedRun.geographyId !== run.geographyId ||
          persistedRun.maxAgeMinutes !== run.maxAgeMinutes
        )
          throw new Error('Run disagreement');
        const seen = new Set<string>();
        for (const observation of observations) {
          assertSecurityDraft(observation, run.geographyId);
          if (observation.subjectId !== run.geographyId || seen.has(observation.observationKey))
            throw new Error('Invalid projection scope');
          seen.add(observation.observationKey);
          const previous = await tx.securityObservation.findFirst({
            where: { observationKey: observation.observationKey },
            orderBy: { revisionOrdinal: 'desc' },
          });
          if (previous) {
            const creationRun = await tx.securityProjectionRun.findUnique({
              where: { id: previous.runId },
            });
            assertSecurityStoredBinding(previous, creationRun, run.geographyId);
          }
          const withoutRevision = (value: unknown) => {
            const evidence = Object.fromEntries(
              Object.entries(value as SecurityObservation).filter(([key]) => key !== 'revision'),
            );
            return canonical(evidence);
          };
          if (previous && withoutRevision(previous.payload) === withoutRevision(observation)) {
            await tx.securityProjectionMember.create({
              data: {
                runId: run.id,
                observationId: previous.id,
                observationKey: observation.observationKey,
              },
            });
            continue;
          }
          const ordinal = previous ? previous.revisionOrdinal + 1 : 0;
          const revised = {
            ...observation,
            revision: {
              revisionOrdinal: ordinal,
              supersedesRevisionOrdinal: ordinal ? ordinal - 1 : null,
              revisionKind: ordinal
                ? (previous!.payload as unknown as SecurityObservation).claim.headline ===
                    observation.claim.headline &&
                  (previous!.payload as unknown as SecurityObservation).claim.summary ===
                    observation.claim.summary
                  ? 'CLASSIFICATION_CHANGE'
                  : 'SOURCE_REVISION'
                : undefined,
              recordedAt: new Date().toISOString(),
            },
          };
          const data = {
            runId: run.id,
            observationKey: observation.observationKey,
            geographyId: run.geographyId,
            revisionOrdinal: ordinal,
            supersedesRevisionOrdinal: ordinal ? ordinal - 1 : null,
            ownershipT1: true,
            ownershipT2: false,
            resolvedOwner: 'SECURITY',
            payload: JSON.parse(JSON.stringify(revised)) as Prisma.InputJsonValue,
          };
          assertSecurityStoredBinding(data, persistedRun, run.geographyId);
          const created = await tx.securityObservation.create({ data });
          assertSecurityStoredBinding(created, persistedRun, run.geographyId);
          await tx.securityProjectionMember.create({
            data: {
              runId: run.id,
              observationId: created.id,
              observationKey: observation.observationKey,
            },
          });
        }
        await tx.securityProjectionCompletion.create({
          data: { runId: run.id, status, observationCount: observations.length },
        });
      });
      return true;
    } catch {
      return false;
    }
  }
  /** Internal retained read. It cannot write, refresh, call a provider or fall back to an older run. */
  async findByGeography(options: {
    geographyId: string;
    limit?: number;
    maxAgeMinutes?: number;
  }): Promise<SecurityObservationReadResult> {
    try {
      const run = await this.prisma.securityProjectionRun.findFirst({
        where: { geographyId: options.geographyId.trim().toUpperCase() },
        orderBy: { id: 'desc' },
        include: {
          completion: true,
          members: {
            include: { observation: { include: { run: true } } },
            orderBy: { observationId: 'asc' },
            take: Math.max(1, Math.min(options.limit ?? 20, 100)),
          },
        },
      });
      if (
        !run ||
        !run.completion ||
        run.completion.status === 'SOURCE_UNAVAILABLE' ||
        Date.now() - run.startedAt.getTime() > 300000 ||
        run.maxAgeMinutes !== (options.maxAgeMinutes ?? 1440) ||
        run.geographyId !== options.geographyId.trim().toUpperCase() ||
        run.startedAt.getTime() > Date.now()
      )
        return { succeeded: false, detail: 'SOURCE_UNAVAILABLE' };
      const observations = run.members.map((member) => {
        if (
          member.runId !== run.id ||
          member.observationId !== member.observation.id ||
          member.observationKey !== member.observation.observationKey
        )
          throw new Error('Membership disagreement');
        assertSecurityStoredBinding(member.observation, member.observation.run, run.geographyId);
        const payload = member.observation.payload as unknown as SecurityObservation & {
          corpusPublishedAt: string;
        };
        const published = Date.parse(payload.corpusPublishedAt);
        const now = Date.now();
        if (
          !Number.isFinite(published) ||
          published < now - run.maxAgeMinutes * 60000 ||
          published > now
        )
          throw new Error('Evidence outside requested window');
        return payload;
      });
      observations.forEach(assertSecurityObservationIsWellFormed);
      return {
        succeeded: true,
        observations,
        status: run.completion.status as 'OK' | 'NO_RESULTS',
      };
    } catch {
      return { succeeded: false, detail: 'SOURCE_UNAVAILABLE' };
    }
  }
}
