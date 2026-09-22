import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../database/prisma.service';
import { Prisma } from '../../generated/prisma/client';
import type { ComputeOperation } from '../../generated/prisma/client';
import {
  ASK_EXECUTION_PORT,
  AskExecutionPort,
  AskPlan,
  AskRequest,
  classifyCompute,
  ExecutionResult,
  fingerprint,
  hashIdentity,
  returnLabel,
  safeReturnPath,
  SAND_CHARGING_ENABLED,
  SAND_QUOTES,
  validatePlan,
} from './ask-compute.contract';
import { CreateThreadDto, QuoteTurnDto } from './ask-v2.dto';

type Tx = Prisma.TransactionClient;
const TERMINAL = ['COMPLETED', 'RELEASED', 'REFUNDED'];

@Injectable()
export class AskV2Service {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    @Inject(ASK_EXECUTION_PORT) private readonly execution: AskExecutionPort,
  ) {}

  private user(userId: string): void {
    if (!userId) throw new UnauthorizedException();
  }

  /** All database mutations retry serializable conflicts. Never run a provider in here. */
  private async atomic<T>(work: (tx: Tx) => Promise<T>): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      try {
        return await this.prisma.$transaction(work, {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        });
      } catch (error) {
        const code = (error as { code?: string })?.code;
        if (attempt >= 7 || !['P2034', 'P2002'].includes(code ?? '')) throw error;
      }
    }
  }
  private async thread(tx: Tx, userId: string, id: string) {
    this.user(userId);
    const row = await tx.askThread.findFirst({ where: { id, userId } });
    if (!row) throw new NotFoundException();
    return row;
  }
  private async owned(tx: Tx, userId: string, id: string) {
    this.user(userId);
    const row = await tx.computeOperation.findFirst({ where: { id, userId } });
    if (!row) throw new NotFoundException();
    return row;
  }
  private async ledger(tx: Tx, operation: ComputeOperation, entryType: string) {
    if (!operation.ledgerEnabled) return;
    await tx.sandLedgerEntry.create({
      data: {
        operationId: operation.id,
        entryType,
        quotedSand: operation.quotedSand,
        // Shadow lifecycle only. No balance, no monetary reservation, no debit.
        reservedSand: 0,
        finalSand: 0,
      },
    });
  }
  private assertSame(actual: string, expected: string): void {
    if (actual !== expected)
      throw new ConflictException('Idempotency key belongs to a different request');
  }
  private assertFreshQuote(operation: ComputeOperation): void {
    if (operation.quoteExpiresAt.getTime() <= Date.now())
      throw new ConflictException('Quote expired; submit a new key');
  }

  async createThread(userId: string, input: CreateThreadDto) {
    this.user(userId);
    const returnPath = safeReturnPath(input.returnPath);
    const requestHash = hashIdentity([input.language, returnPath]);
    return this.atomic(async (tx) => {
      const existing = await tx.askThread.findUnique({
        where: { userId_clientKey: { userId, clientKey: input.idempotencyKey } },
      });
      if (existing) {
        this.assertSame(existing.requestHash, requestHash);
        return existing;
      }
      return tx.askThread.create({
        data: {
          userId,
          clientKey: input.idempotencyKey,
          requestHash,
          language: input.language,
          returnPath,
        },
      });
    });
  }
  async listThreads(userId: string) {
    this.user(userId);
    return this.prisma.askThread.findMany({
      where: { userId },
      orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
      take: 50,
      select: { id: true, language: true, returnPath: true, createdAt: true, updatedAt: true },
    });
  }
  async getThread(userId: string, id: string, after = 0) {
    return this.atomic(async (tx) => {
      const thread = await this.thread(tx, userId, id);
      const turns = await tx.askTurn.findMany({
        where: { threadId: id, sequence: { gt: after } },
        orderBy: { sequence: 'asc' },
        take: 100,
      });
      return {
        id,
        language: thread.language,
        returnPath: thread.returnPath,
        returnLabel: returnLabel(thread.language as 'en' | 'pl'),
        turns,
        nextAfter: turns.length === 100 ? turns[turns.length - 1].sequence : null,
      };
    });
  }
  async getOperation(userId: string, id: string) {
    return this.atomic(async (tx) => {
      const operation = await this.owned(tx, userId, id);
      const result = operation.storedResultId
        ? await tx.storedResult.findFirst({ where: { id: operation.storedResultId, userId } })
        : null;
      const ledger = await tx.sandLedgerEntry.findMany({
        where: { operationId: id },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      });
      return {
        operationId: id,
        computeClass: operation.computeClass,
        status: operation.status,
        quotedSand: operation.quotedSand,
        chargingEnabled: SAND_CHARGING_ENABLED,
        requiresAcceptance: true,
        quoteExpiresAt: operation.quoteExpiresAt,
        acceptedAt: operation.acceptedAt,
        storedResultId: operation.storedResultId,
        storedResultReused: operation.storedResultReused,
        failureCode: operation.failureCode,
        // Historical replay can display an expired artifact, but must identify it as such.
        result:
          result && operation.status === 'COMPLETED'
            ? {
                id: result.id,
                payload: result.payload,
                evidenceRevision: result.evidenceRevision,
                expiresAt: result.expiresAt,
                expired: result.expiresAt.getTime() <= Date.now(),
                displayOnly: true,
              }
            : null,
        ledger,
      };
    });
  }

  async quote(userId: string, threadId: string, input: QuoteTurnDto) {
    this.user(userId);
    const request: AskRequest = {
      question: input.question.trim(),
      language: input.language,
      intent: input.intent,
    };
    if (request.question.length < 2) throw new BadRequestException('Question is too short');
    const requestHash = hashIdentity([
      threadId,
      request.question,
      request.language,
      request.intent,
    ]);
    const existing = await this.atomic(async (tx) => {
      await this.thread(tx, userId, threadId);
      return tx.computeOperation.findUnique({
        where: { userId_clientKey: { userId, clientKey: input.idempotencyKey } },
      });
    });
    if (existing) {
      this.assertSame(existing.requestHash, requestHash);
      return this.getOperation(userId, existing.id);
    }

    // A local/read-only CTO planner supplies identity and capabilities, never the client.
    const prepared = await this.execution.prepare(Object.freeze(request));
    validatePlan(prepared);
    const plan: AskPlan = {
      revision: prepared.revision,
      scope: prepared.scope,
      contract: prepared.contract,
      executionKey: prepared.executionKey,
      validUntil: prepared.validUntil,
      contextual: prepared.contextual,
      deepRequested: prepared.deepRequested,
      reportRequested: prepared.reportRequested,
      countryCount: prepared.countryCount,
      domainCount: prepared.domainCount,
      timeWindowDays: prepared.timeWindowDays,
    };
    const key = fingerprint(request, plan);
    const id = await this.atomic(async (tx) => {
      await this.thread(tx, userId, threadId);
      const concurrent = await tx.computeOperation.findUnique({
        where: { userId_clientKey: { userId, clientKey: input.idempotencyKey } },
      });
      if (concurrent) {
        this.assertSame(concurrent.requestHash, requestHash);
        return concurrent.id;
      }
      validatePlan(plan);
      const stored = await tx.storedResult.findFirst({
        where: { userId, fingerprint: key, expiresAt: { gt: new Date() } },
        orderBy: { createdAt: 'desc' },
      });
      const computeClass = classifyCompute(request, plan, !!stored);
      const operation = await tx.computeOperation.create({
        data: {
          userId,
          clientKey: input.idempotencyKey,
          requestHash,
          kind: request.intent,
          computeClass,
          fingerprint: key,
          plan: plan as unknown as Prisma.InputJsonObject,
          quotedSand: SAND_QUOTES[computeClass],
          ledgerEnabled: this.config.get<string>('SAND_LEDGER_ENABLED') === 'true',
          quoteExpiresAt: new Date(Math.min(Date.now() + 300000, Date.parse(plan.validUntil))),
          storedResultId: stored?.id,
          storedResultReused: !!stored,
        },
      });
      // Atomic counter allocation plus DB unique(threadId, sequence); no max+1 race.
      const thread = await tx.askThread.update({
        where: { id: threadId },
        data: { nextSequence: { increment: 1 } },
      });
      await tx.askTurn.create({
        data: {
          threadId,
          sequence: thread.nextSequence - 1,
          question: request.question,
          language: request.language,
          operationId: operation.id,
        },
      });
      await this.ledger(tx, operation, 'QUOTE');
      return operation.id;
    });
    return this.getOperation(userId, id);
  }

  async accept(userId: string, id: string) {
    await this.atomic(async (tx) => {
      const operation = await this.owned(tx, userId, id);
      if (operation.acceptedAt) return;
      if (operation.status !== 'QUOTED') throw new ConflictException('Operation is not quoted');
      this.assertFreshQuote(operation);
      await tx.computeOperation.update({
        where: { id },
        data: { status: 'ACCEPTED', acceptedAt: new Date() },
      });
    });
    return this.getOperation(userId, id);
  }
  async reserve(userId: string, id: string) {
    await this.atomic(async (tx) => {
      const operation = await this.owned(tx, userId, id);
      if (['RESERVED', 'RUNNING', 'COMPLETED'].includes(operation.status)) return;
      if (operation.status !== 'ACCEPTED' || !operation.acceptedAt)
        throw new ConflictException('Accept the quote first');
      this.assertFreshQuote(operation);
      await tx.computeOperation.update({ where: { id }, data: { status: 'RESERVED' } });
      await this.ledger(tx, operation, 'RESERVE');
    });
    return this.getOperation(userId, id);
  }

  /** Durable claim commits BEFORE the external call. Retries never dispatch it twice.
   * An expired RUNNING claim is released, never re-run: provider outcome is unknown.
   */
  async execute(userId: string, id: string) {
    const claim = await this.atomic(async (tx) => {
      const operation = await this.owned(tx, userId, id);
      if (TERMINAL.includes(operation.status)) return null;
      if (operation.status === 'RUNNING') {
        if (operation.leaseExpiresAt && operation.leaseExpiresAt.getTime() <= Date.now()) {
          await this.releaseIn(tx, operation, 'EXECUTION_OUTCOME_UNKNOWN');
        }
        return null;
      }
      if (operation.status !== 'RESERVED' || !operation.acceptedAt)
        throw new ConflictException('Reserve an accepted quote first');
      if (operation.quoteExpiresAt.getTime() <= Date.now()) {
        await this.releaseIn(tx, operation, 'QUOTE_EXPIRED');
        return null;
      }
      const stored = await tx.storedResult.findFirst({
        where: {
          userId,
          ...(operation.storedResultId
            ? { id: operation.storedResultId }
            : { fingerprint: operation.fingerprint }),
          expiresAt: { gt: new Date() },
        },
        orderBy: { createdAt: 'desc' },
      });
      if (stored) {
        await tx.computeOperation.update({
          where: { id },
          data: {
            status: 'COMPLETED',
            storedResultId: stored.id,
            storedResultReused: true,
            completedAt: new Date(),
          },
        });
        await this.ledger(tx, operation, 'SETTLE');
        return null;
      }
      // A STORED quote cannot silently turn into fresh, more expensive work.
      if (operation.computeClass === 'STORED' || operation.storedResultId) {
        await this.releaseIn(tx, operation, 'STORED_RESULT_EXPIRED');
        return null;
      }
      const turn = await tx.askTurn.findUnique({ where: { operationId: id } });
      if (!turn) throw new ConflictException('Operation turn missing');
      const runToken = randomUUID();
      await tx.computeOperation.update({
        where: { id },
        data: { status: 'RUNNING', runToken, leaseExpiresAt: new Date(Date.now() + 300000) },
      });
      return {
        runToken,
        plan: operation.plan as unknown as AskPlan,
        request: {
          question: turn.question,
          language: turn.language,
          intent: operation.kind,
        } as AskRequest,
      };
    });
    if (claim) {
      let result: ExecutionResult;
      try {
        result = await this.execution.execute(
          Object.freeze(claim.request),
          Object.freeze(claim.plan),
          id,
        );
      } catch {
        await this.release(userId, id, 'EXECUTION_FAILED');
        return this.getOperation(userId, id);
      }
      // A DB settlement failure leaves RUNNING. Retrying execute must not call the provider again.
      await this.settle(userId, id, claim.runToken, result);
    }
    return this.getOperation(userId, id);
  }
  async settle(userId: string, id: string, runToken: string, result: ExecutionResult) {
    await this.atomic(async (tx) => {
      const operation = await this.owned(tx, userId, id);
      if (TERMINAL.includes(operation.status)) return;
      if (operation.status !== 'RUNNING' || operation.runToken !== runToken)
        throw new ConflictException('Execution claim mismatch');
      const plan = operation.plan as unknown as AskPlan;
      let payload: Prisma.InputJsonValue | undefined;
      try {
        if (typeof result?.payloadJson === 'string' && result.payloadJson.length <= 1000000)
          payload = JSON.parse(result.payloadJson);
      } catch {
        /* invalid result releases below */
      }
      const expiresAt = Math.min(Date.parse(result?.validUntil), Date.parse(plan.validUntil));
      if (
        !result?.succeeded ||
        !payload ||
        typeof payload !== 'object' ||
        result.evidenceRevision !== plan.revision ||
        !(expiresAt > Date.now()) ||
        !operation.leaseExpiresAt ||
        operation.leaseExpiresAt.getTime() <= Date.now()
      ) {
        await this.releaseIn(tx, operation, 'INVALID_OR_EXPIRED_RESULT');
        return;
      }
      const stored = await tx.storedResult.create({
        data: {
          userId,
          fingerprint: operation.fingerprint,
          evidenceRevision: plan.revision,
          payload,
          expiresAt: new Date(expiresAt),
        },
      });
      await tx.computeOperation.update({
        where: { id },
        data: {
          status: 'COMPLETED',
          storedResultId: stored.id,
          completedAt: new Date(),
          runToken: null,
        },
      });
      await this.ledger(tx, operation, 'SETTLE');
    });
  }
  private async releaseIn(tx: Tx, operation: ComputeOperation, failureCode: string) {
    await tx.computeOperation.update({
      where: { id: operation.id },
      data: { status: 'RELEASED', failureCode, completedAt: new Date(), runToken: null },
    });
    await this.ledger(tx, operation, 'RELEASE');
  }
  async release(userId: string, id: string, failureCode = 'USER_RELEASED') {
    await this.atomic(async (tx) => {
      const operation = await this.owned(tx, userId, id);
      if (TERMINAL.includes(operation.status)) return;
      await this.releaseIn(tx, operation, failureCode);
    });
    return this.getOperation(userId, id);
  }
  async refund(userId: string, id: string) {
    await this.atomic(async (tx) => {
      const operation = await this.owned(tx, userId, id);
      if (operation.status === 'REFUNDED') return;
      if (operation.status !== 'COMPLETED')
        throw new ConflictException('Only completed operations can be refunded');
      await tx.computeOperation.update({ where: { id }, data: { status: 'REFUNDED' } });
      await this.ledger(tx, operation, 'REFUND');
    });
    return this.getOperation(userId, id);
  }
}
