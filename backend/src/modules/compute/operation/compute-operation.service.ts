import { ConflictException, Injectable, Logger } from '@nestjs/common';
import {
  canTransition,
  isTerminalOperationStatus,
  type ComputeClass,
  type ComputeCostTelemetry,
  type ComputeOperationKind,
  type ComputeOperationStatus,
  type EntitlementState,
} from '@globalnews-ai/shared';
import { PrismaService } from '../../../database/prisma.service';
import { SandLedgerService } from '../ledger/sand-ledger.service';
import { buildOperationIdempotencyIdentity } from '../identity/stored-result-fingerprint.util';

/**
 * BETA-SIMPLE-ASK-SAND-1 §8/§12/§13 — the metered-operation lifecycle.
 *
 * This service owns the one row per logical operation and the legal
 * moves between its states, and it is where §12's release requirement
 * actually lives.
 *
 * HOW IDEMPOTENCY IS ENFORCED — and why it is not an application-level
 * check.
 *
 * §12 lists the cases that must never double-charge: double click,
 * browser retry, refresh, frontend reconnect, HTTP retry, Railway
 * retry, worker retry. Several of those are genuinely CONCURRENT, and
 * several happen across DIFFERENT PROCESSES (Railway retry hits
 * whichever replica the load balancer picks). That rules out every
 * in-process mechanism:
 *
 *   - a Map of seen keys is per-replica, so two replicas both miss;
 *   - "SELECT then INSERT if absent" is a textbook race — both callers
 *     SELECT nothing, both INSERT, one wins and the other throws, and
 *     the user sees an error for an operation that actually succeeded;
 *   - an advisory lock adds a distributed-locking failure mode to
 *     solve a problem a UNIQUE index already solves.
 *
 * So the enforcement is the UNIQUE index on
 * ComputeOperation.idempotencyKey, and the pattern is INSERT-FIRST,
 * CATCH-CONFLICT: attempt the insert, and if the database rejects it
 * as a duplicate, fetch and return the existing row. Exactly one row
 * can ever exist for a key, whatever the application layer believes
 * and however many replicas are running.
 */

/** Prisma's unique-constraint violation. Matched by code, not by message text. */
const PRISMA_UNIQUE_VIOLATION = 'P2002';

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { code?: unknown }).code === PRISMA_UNIQUE_VIOLATION
  );
}

export interface OperationOwner {
  kind: 'user' | 'anonymous';
  /** userId when signed in, opaque session key when a guest. Always present. */
  key: string;
  userId?: string;
  sessionKey?: string;
}

export interface CreateOperationInput {
  owner: OperationOwner;
  kind: ComputeOperationKind;
  computeClass: ComputeClass;
  quotedSand: number;
  requiresConfirmation: boolean;
  entitlementState: EntitlementState;
  /** The client-supplied §12 key. */
  clientIdempotencyKey: string;
  quoteTtlSeconds: number;
  storedResultId?: string;
}

export interface OperationRecord {
  id: string;
  idempotencyKey: string;
  kind: string;
  computeClass: string;
  quotedSand: number;
  requiresConfirmation: boolean;
  entitlementState: string;
  executionStatus: ComputeOperationStatus;
  storedResultId: string | null;
  quoteExpiresAt: Date | null;
  createdAt: Date;
  completedAt: Date | null;
}

/** What createOrReuse returns — `reused` is the §12-visible fact. */
export interface CreateOperationResult {
  operation: OperationRecord;
  reused: boolean;
}

@Injectable()
export class ComputeOperationService {
  private readonly logger = new Logger(ComputeOperationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: SandLedgerService,
  ) {}

  /**
   * §12 — creates the operation, or returns the one that already
   * exists for this idempotency identity.
   *
   * The caller cannot tell from `operation` alone whether it created
   * anything, which is the point: it should behave identically either
   * way. `reused` exists so telemetry and tests can tell.
   */
  async createOrReuse(input: CreateOperationInput): Promise<CreateOperationResult> {
    const idempotencyKey = buildOperationIdempotencyIdentity({
      ownerKey: input.owner.key,
      clientKey: input.clientIdempotencyKey,
      kind: input.kind,
    });

    try {
      const created = await this.prisma.computeOperation.create({
        data: {
          idempotencyKey,
          kind: input.kind,
          computeClass: input.computeClass,
          ownerKey: input.owner.key,
          ownerKind: input.owner.kind,
          userId: input.owner.userId ?? null,
          sessionKey: input.owner.sessionKey ?? null,
          quotedSand: input.quotedSand,
          requiresConfirmation: input.requiresConfirmation,
          entitlementState: input.entitlementState,
          executionStatus: 'QUOTED',
          quoteExpiresAt: new Date(Date.now() + input.quoteTtlSeconds * 1000),
          storedResultId: input.storedResultId ?? null,
        },
      });

      const operation = this.toRecord(created);

      await this.ledger.recordQuote({
        operationId: operation.id,
        userId: input.owner.userId,
        sessionKey: input.owner.sessionKey,
        quotedSand: input.quotedSand,
        status: 'QUOTED',
        resultId: input.storedResultId,
      });

      return { operation, reused: false };
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;

      /**
       * We lost the race (or this is a plain retry). The winning row is
       * authoritative — including its quotedSand and computeClass. We
       * deliberately do NOT update it to match this request: §12's
       * guarantee is that the same logical operation is not charged or
       * reserved twice, and re-pricing an operation a user may already
       * have confirmed would break exactly that.
       */
      const existing = await this.prisma.computeOperation.findUnique({
        where: { idempotencyKey },
      });

      if (!existing) {
        // The unique violation was real but the row has since vanished
        // (an operator deletion, a cascade from account deletion). Not
        // recoverable here, and silently creating a second operation
        // would defeat the whole mechanism.
        throw new ConflictException('Operation could not be resolved after an idempotency conflict');
      }

      this.logger.debug(`Reusing existing operation ${existing.id} for a duplicate submission.`);
      return { operation: this.toRecord(existing), reused: true };
    }
  }

  /** Fetches an operation by its id. */
  async findById(id: string): Promise<OperationRecord | null> {
    const row = await this.prisma.computeOperation.findUnique({ where: { id } });
    return row ? this.toRecord(row) : null;
  }

  /**
   * §13 — moves an operation along its lifecycle.
   *
   * Refuses any transition ALLOWED_OPERATION_TRANSITIONS does not
   * permit, rather than writing it and hoping. A COMPLETED operation
   * that could be moved back to RUNNING would allow a second
   * settlement, i.e. a double charge by a different route than the one
   * §12 closes — so the state machine is enforced, not documented.
   *
   * The guard is expressed against the shared transition table so the
   * rule has one definition that the contract, the service and the
   * tests all read from.
   */
  async transition(
    operationId: string,
    to: ComputeOperationStatus,
    patch: Partial<{
      storedResultId: string | null;
      failureType: string | null;
      completedAt: Date | null;
    }> = {},
  ): Promise<OperationRecord> {
    return (await this.transitionWithChange(operationId, to, patch)).operation;
  }

  /**
   * The transition, plus whether it actually MOVED anything.
   *
   * `changed` exists because of a real double-accounting defect this
   * separation prevents. A retried worker calling reserve() twice hits
   * the `from === to` no-op below and gets a perfectly valid
   * OperationRecord back — but the caller, seeing a successful return,
   * would go on to write a SECOND ledger row. Two RESERVE rows for one
   * operation make outstandingReservationForOperation() report double
   * the Sand that was ever set aside, which is exactly the
   * "same logical operation reserved twice on a retry" failure §12
   * names.
   *
   * So the no-op has to be visible to the caller, not swallowed. Every
   * ledger-writing method below is gated on `changed`.
   */
  private async transitionWithChange(
    operationId: string,
    to: ComputeOperationStatus,
    patch: Partial<{
      storedResultId: string | null;
      failureType: string | null;
      completedAt: Date | null;
    }> = {},
  ): Promise<{ operation: OperationRecord; changed: boolean }> {
    const current = await this.prisma.computeOperation.findUnique({ where: { id: operationId } });
    if (!current) {
      throw new ConflictException(`Unknown operation ${operationId}`);
    }

    const from = current.executionStatus as ComputeOperationStatus;

    // Idempotent re-assertion of the state we are already in is a
    // no-op, not an error: a retried worker legitimately re-reports
    // the terminal state it already wrote.
    if (from === to) return { operation: this.toRecord(current), changed: false };

    if (!canTransition(from, to)) {
      throw new ConflictException(
        `Illegal compute operation transition ${from} -> ${to} for ${operationId}`,
      );
    }

    const updated = await this.prisma.computeOperation.update({
      where: { id: operationId },
      data: {
        executionStatus: to,
        ...(patch.storedResultId !== undefined ? { storedResultId: patch.storedResultId } : {}),
        ...(patch.failureType !== undefined ? { failureType: patch.failureType } : {}),
        ...(isTerminalOperationStatus(to)
          ? { completedAt: patch.completedAt ?? new Date() }
          : {}),
      },
    });

    return { operation: this.toRecord(updated), changed: true };
  }

  /**
   * §13 QUOTED → RESERVED, writing the matching ledger row.
   *
   * Reservation and ledger row are written together rather than
   * separately by the caller, so there is no code path that can
   * reserve without recording it.
   */
  async reserve(operationId: string, owner: OperationOwner): Promise<OperationRecord> {
    const { operation, changed } = await this.transitionWithChange(operationId, 'RESERVED');

    // A retried reserve() must not write a second RESERVE row — see
    // transitionWithChange.
    if (changed) {
      await this.ledger.recordReservation({
        operationId,
        userId: owner.userId,
        sessionKey: owner.sessionKey,
        quotedSand: operation.quotedSand,
        status: 'RESERVED',
      });
    }

    return operation;
  }

  /** §13 RESERVED → RUNNING. */
  async markRunning(operationId: string): Promise<OperationRecord> {
    return this.transition(operationId, 'RUNNING');
  }

  /**
   * §13 RUNNING → COMPLETED, settling the reservation.
   *
   * With SAND_CHARGING off the settlement writes finalSand: 0 — see
   * SandLedgerService.recordSettlement, which owns that gate.
   */
  async complete(
    operationId: string,
    owner: OperationOwner,
    storedResultId?: string,
  ): Promise<OperationRecord> {
    const { operation, changed } = await this.transitionWithChange(operationId, 'COMPLETED', {
      storedResultId: storedResultId ?? null,
    });

    // A retried complete() must not settle twice — that would be a
    // literal double charge once SAND_CHARGING is on.
    if (changed) {
      await this.ledger.recordSettlement({
        operationId,
        userId: owner.userId,
        sessionKey: owner.sessionKey,
        quotedSand: operation.quotedSand,
        status: 'COMPLETED',
        resultId: storedResultId,
      });
    }

    return operation;
  }

  /**
   * §13 — the failure path: → FAILED → RESERVATION_RELEASED.
   *
   * BOTH transitions happen here, in one call, and the release ledger
   * row is written. That is deliberate: if releasing were a separate
   * call the caller had to remember to make, then every unhandled
   * error path in the codebase becomes a potential silent consumption
   * of a user's Sand — precisely what §13 forbids. Making failure
   * atomic with release means a caller cannot forget.
   */
  async failAndRelease(
    operationId: string,
    owner: OperationOwner,
    failureType: string,
  ): Promise<OperationRecord> {
    /**
     * The failure path must itself be idempotent, not merely
     * non-double-charging.
     *
     * §12 lists worker retry and Railway retry among the cases this
     * system must survive, and the most likely thing a retried worker
     * does is re-report the FAILURE it already reported. If that threw
     * a 409, a benign retry would turn into a visible error — and,
     * worse, an error on the very path whose job is to clean up after
     * an error. An operation that has already reached its terminal
     * released state is simply returned as-is.
     */
    const existing = await this.findById(operationId);
    if (existing?.executionStatus === 'RESERVATION_RELEASED') {
      return existing;
    }

    const failed = await this.transition(operationId, 'FAILED', { failureType });
    const { operation: released, changed } = await this.transitionWithChange(
      operationId,
      'RESERVATION_RELEASED',
    );

    // A retried failure path must not write a second RELEASE row —
    // that would make outstandingReservationForOperation() go negative
    // and misreport the ledger as having returned more than it held.
    if (changed) {
      await this.ledger.recordRelease({
        operationId,
        userId: owner.userId,
        sessionKey: owner.sessionKey,
        quotedSand: failed.quotedSand,
        status: 'RESERVATION_RELEASED',
      });
    }

    return released;
  }

  /**
   * §14 — records cost telemetry onto the operation row.
   *
   * Never throws: telemetry is observability, and losing a metric must
   * not fail a user's answer or, worse, prevent the settlement that
   * follows it.
   */
  async recordTelemetry(
    operationId: string,
    telemetry: Omit<ComputeCostTelemetry, 'operationId' | 'kind' | 'computeClass'>,
  ): Promise<void> {
    try {
      await this.prisma.computeOperation.update({
        where: { id: operationId },
        data: {
          durationMs: telemetry.durationMs,
          storedResultReused: telemetry.storedResultReused,
          cacheHit: telemetry.cacheHit ?? null,
          provider: telemetry.provider ?? null,
          model: telemetry.model ?? null,
          inputTokens: telemetry.inputTokens ?? null,
          outputTokens: telemetry.outputTokens ?? null,
          retrievalCalls: telemetry.retrievalCalls ?? null,
          providerRequests: telemetry.providerRequests ?? null,
          evidenceCount: telemetry.evidenceCount ?? null,
          failureType: telemetry.failureType ?? null,
          estimatedCostMicroUsd: telemetry.estimatedCostMicroUsd ?? null,
        },
      });
    } catch (error) {
      this.logger.warn(
        `Failed to record cost telemetry for operation ${operationId}. ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
    }
  }

  /**
   * §9 — whether a quote is still confirmable.
   *
   * A quote pins a classification, and classification depends on
   * evidence revision, so an indefinitely-confirmable quote would let
   * a user execute a price that no longer reflects the work.
   */
  isQuoteExpired(operation: OperationRecord, now: Date = new Date()): boolean {
    return operation.quoteExpiresAt !== null && operation.quoteExpiresAt.getTime() <= now.getTime();
  }

  private toRecord(row: {
    id: string;
    idempotencyKey: string;
    kind: string;
    computeClass: string;
    quotedSand: number;
    requiresConfirmation: boolean;
    entitlementState: string;
    executionStatus: string;
    storedResultId: string | null;
    quoteExpiresAt: Date | null;
    createdAt: Date;
    completedAt: Date | null;
  }): OperationRecord {
    return {
      id: row.id,
      idempotencyKey: row.idempotencyKey,
      kind: row.kind,
      computeClass: row.computeClass,
      quotedSand: row.quotedSand,
      requiresConfirmation: row.requiresConfirmation,
      entitlementState: row.entitlementState,
      executionStatus: row.executionStatus as ComputeOperationStatus,
      storedResultId: row.storedResultId,
      quoteExpiresAt: row.quoteExpiresAt,
      createdAt: row.createdAt,
      completedAt: row.completedAt,
    };
  }
}
