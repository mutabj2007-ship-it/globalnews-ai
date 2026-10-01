import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
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
  AskExecutionRefused,
  AskPlan,
  type AskPlanWithContext,
  AskRequest,
  classifyCompute,
  ExecutionResult,
  fingerprint,
  hashIdentity,
  returnLabel,
  requiresExplicitAcceptance,
  safeReturnPath,
  SAND_CHARGING_ENABLED,
  SAND_QUOTES,
  validatePlan,
} from './ask-compute.contract';
import { CreateThreadDto, QuoteTurnDto } from './ask-v2.dto';
import { type AskPrincipal, guestRefusal, ownerOf } from './guest/ask-principal';
import {
  assertMayStart,
  countsAsGuestAnswer,
  readAllowance,
  releaseReasonOf,
  reserveSlot,
  settleSlot,
} from './guest/guest-allowance';
import { GuestSessionService } from './guest/guest-session.service';
import { askRequestContext } from './ask-request-context';
import {
  AskContextResolver,
  contextIdentity,
  readPlanContext,
  type AskContextExecutionInputs,
  type ResolvedAskContext,
} from './ask-context';
import { isReusableStoredPayload } from './stored-result-reuse';
import { isSubjectFollowUp } from '../analysis/anchor/conversation-subject.util';
import { isAnaphoricFollowUp } from '../analysis/anchor/event-anchor.util';
import { ComputeMeterService } from '../compute-controls/compute-meter.service';
import { OperationalSwitchService } from '../compute-controls/operational-switch.service';
import {
  dayBucket,
  GUEST_EXECUTIONS_ALL_SCOPE,
  guestExecutionScope,
} from '../compute-controls/compute-scopes';

type Tx = Prisma.TransactionClient;
const TERMINAL = ['COMPLETED', 'RELEASED', 'REFUNDED'];

/* PUBLIC BETA ASK CONTINUITY R1 — Recent/Saved bounds and the preview clamp. */
const RECENT_THREAD_LIMIT = 50;
const SAVED_BOOKMARK_LIMIT = 100;
/* ASK GUEST TRIAL R3 — a guest's own threads (resume after reload / cancelled sign-in). */
const GUEST_THREAD_LIMIT = 10;
/*
  ASK R3 CONTINUITY — the question a follow-up continues. Turns newest first; the nearest one
  that is NOT itself a follow-up (by the landed path's own detectors) is the subject-bearing
  anchor, so "How does this affect X?" after "Why did that happen?" still continues the
  subject both refer to. Bounded; with no subject-bearing turn in reach, the most recent
  question is passed and the landed path decides as before.
  Only a question that IS a follow-up (the same detectors) receives a prior: a self-contained
  question, an ellipsis or a reference to the answer's content is planned, fingerprinted and
  answered exactly as before, so asking the same question again still reuses its stored result.
*/
const ANCHOR_LOOKBACK = 10;
function anchorQuestionOf(question: string, newestFirst: readonly string[]): string | null {
  if (!isSubjectFollowUp(question) && !isAnaphoricFollowUp(question)) return null;
  if (newestFirst.length === 0) return null;
  const anchor = newestFirst.find((q) => !isSubjectFollowUp(q) && !isAnaphoricFollowUp(q));
  return anchor ?? newestFirst[0];
}

/** `nextSequence` starts at 1, so the first turn is this sequence exactly. */
const FIRST_TURN_SEQUENCE = 1;
/** One fixed clamp for every caller, so no surface has to choose where to cut. */
const PREVIEW_MAX = 160;

function clampPreview(question: string): string {
  return question.length > PREVIEW_MAX ? question.slice(0, PREVIEW_MAX) : question;
}

/**
 * ASK GUEST TRIAL R3 — every method takes a SERVER-resolved principal: an account (session
 * cookie) or a guest session (guest cookie). `ownerOf(principal)` is the one ownership
 * predicate, so every existing account path keeps exactly its old `where: { userId }` and a
 * guest can only ever reach rows whose guestSessionId is its own. Recent, Saved and bookmarks
 * stay account-only and still take a bare userId.
 */
@Injectable()
export class AskV2Service {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    @Inject(ASK_EXECUTION_PORT) private readonly execution: AskExecutionPort,
    /* ASK GUEST TRIAL R3 — optional: without them the service behaves exactly as before for
       accounts, and every guest path fails closed (GUEST_TRIAL_NOT_CONFIGURED). */
    @Optional() private readonly guests?: GuestSessionService,
    @Optional() private readonly switches?: OperationalSwitchService,
    @Optional() private readonly meter?: ComputeMeterService,
    /* HOME R1 STAGE A — optional: without it a supplied context bag resolves as excluded. */
    @Optional() private readonly contexts?: AskContextResolver,
  ) {}

  private contextResolver(): AskContextResolver {
    return this.contexts ?? new AskContextResolver();
  }

  private guestDeps(): {
    guests: GuestSessionService;
    switches: OperationalSwitchService;
    meter: ComputeMeterService;
  } {
    if (!this.guests || !this.switches || !this.meter)
      throw guestRefusal('GUEST_TRIAL_NOT_CONFIGURED');
    return { guests: this.guests, switches: this.switches, meter: this.meter };
  }

  private user(userId: string): void {
    if (!userId) throw new UnauthorizedException();
  }

  private principal(p: AskPrincipal): void {
    if (p.kind === 'account' ? !p.userId : !p.guestSessionId) throw new UnauthorizedException();
  }

  /**
   * ASK R3 CONTINUITY — run `work` with the reader's own previous question in this thread in the
   * request context. Only when a server-held context exists (the controller's interceptor set
   * it); nothing is manufactured here, so a caller without one fails exactly as before.
   */
  private withPrior<T>(
    priorQuestion: string | null,
    work: () => Promise<T>,
    /* HOME R1 STAGE A — the server-resolved context of THIS operation, when it has one. */
    askContext?: AskContextExecutionInputs,
  ): Promise<T> {
    const store = askRequestContext.getStore();
    if (store === undefined || (priorQuestion === null && askContext === undefined)) return work();
    return askRequestContext.run(
      {
        ...store,
        ...(priorQuestion === null ? {} : { priorQuestion }),
        ...(askContext === undefined ? {} : { askContext }),
      },
      work,
    );
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
  private async thread(tx: Tx, p: AskPrincipal, id: string) {
    this.principal(p);
    const row = await tx.askThread.findFirst({ where: { id, ...ownerOf(p) } });
    if (!row) throw new NotFoundException();
    return row;
  }
  private async owned(tx: Tx, p: AskPrincipal, id: string) {
    this.principal(p);
    const row = await tx.computeOperation.findFirst({ where: { id, ...ownerOf(p) } });
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

  async createThread(p: AskPrincipal, input: CreateThreadDto) {
    this.principal(p);
    const returnPath = safeReturnPath(input.returnPath);
    const requestHash = hashIdentity([input.language, returnPath]);
    return this.atomic(async (tx) => {
      const existing = await tx.askThread.findFirst({
        where: { ...ownerOf(p), clientKey: input.idempotencyKey },
      });
      if (existing) {
        this.assertSame(existing.requestHash, requestHash);
        return existing;
      }
      return tx.askThread.create({
        data: {
          ...ownerOf(p),
          clientKey: input.idempotencyKey,
          requestHash,
          language: input.language,
          returnPath,
        },
      });
    });
  }
  /**
   * ════════════════════════════════════════════════════════════════════════
   * PUBLIC BETA ASK CONTINUITY R1 — RECENT
   * ════════════════════════════════════════════════════════════════════════
   *
   * Three reads, no writes, no provider, no model. `Recent` is a projection of
   * rows this lane already owns; it is NOT a second conversation-history system
   * and it is not `SearchHistoryEntry`, which records searches rather than Ask
   * threads.
   *
   * THE PREVIEW IS THE READER'S OWN FIRST QUESTION, and it is deterministic
   * because `sequence` is: `nextSequence` starts at 1 and `@@unique([threadId,
   * sequence])` makes "the first turn" a single row rather than an ordering
   * accident. NO TITLE IS GENERATED. A generated title would be a model call on
   * a surface whose whole contract is that opening it spends nothing, and it
   * would put words the reader never wrote next to words they did.
   *
   * The clamp is server-side and fixed so every caller sees the same preview and
   * the surface never has to guess where to cut; `firstQuestionTruncated` says
   * whether anything was removed, so the reader is never told a shortened
   * question is the whole one.
   *
   * `latestState` is the newest turn's operation status, reported ONLY as the
   * lifecycle fact the operation row already carries. It is never derived from
   * the payload and never implies the artifact is still readable — `storedResult`
   * expiry is resolved on reopen, by `getOperation`, which is the one place that
   * can tell the truth about it.
   */
  async listThreads(userId: string) {
    this.user(userId);

    return this.atomic(async (tx) => {
      const threads = await tx.askThread.findMany({
        where: { userId },
        orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
        take: RECENT_THREAD_LIMIT,
        select: {
          id: true,
          language: true,
          returnPath: true,
          createdAt: true,
          updatedAt: true,
          _count: { select: { turns: true } },
        },
      });

      if (threads.length === 0) return [];
      const ids = threads.map((thread) => thread.id);

      /* The first turn of each thread. `sequence: 1` is exact, not "the oldest we found". */
      const firstTurns = await tx.askTurn.findMany({
        where: { threadId: { in: ids }, sequence: FIRST_TURN_SEQUENCE },
        select: { threadId: true, question: true },
      });
      const firstByThread = new Map(firstTurns.map((turn) => [turn.threadId, turn.question]));

      /* The newest turn of each thread, with the lifecycle fact of its operation. */
      const latestTurns = await tx.askTurn.findMany({
        where: { threadId: { in: ids } },
        orderBy: [{ threadId: 'asc' }, { sequence: 'desc' }],
        distinct: ['threadId'],
        select: {
          threadId: true,
          id: true,
          sequence: true,
          question: true,
          operation: { select: { id: true, status: true, computeClass: true } },
        },
      });
      const latestByThread = new Map(latestTurns.map((turn) => [turn.threadId, turn]));

      return threads.map((thread) => {
        const question = firstByThread.get(thread.id);
        const latest = latestByThread.get(thread.id);

        return {
          id: thread.id,
          language: thread.language,
          returnPath: thread.returnPath,
          createdAt: thread.createdAt,
          /* "Last active" is the thread's own updatedAt — a stored fact, not a guess. */
          lastActiveAt: thread.updatedAt,
          turnCount: thread._count.turns,
          firstQuestion: question === undefined ? null : clampPreview(question),
          firstQuestionTruncated: question === undefined ? false : question.length > PREVIEW_MAX,
          latestTurnId: latest?.id ?? null,
          /*
            ALPHA VISUAL ACCEPTANCE REPAIR R1 — Open displays the LATEST turn's result, so the
            row must be able to say which question that is. The reader's own words, clamped the
            same way as the first question; never generated.
          */
          latestQuestion: latest === undefined ? null : clampPreview(latest.question),
          latestQuestionTruncated:
            latest === undefined ? false : latest.question.length > PREVIEW_MAX,
          latestOperationId: latest?.operation?.id ?? null,
          latestState: latest?.operation?.status ?? null,
          latestComputeClass: latest?.operation?.computeClass ?? null,
        };
      });
    });
  }

  /**
   * ASK GUEST TRIAL R3 — the guest's OWN threads only, for resuming after a reload or a
   * cancelled sign-in. Never an account list and never public: scoped by the server-resolved
   * guest session. The reader's own first question is the preview; nothing is generated.
   */
  async listGuestThreads(guestSessionId: string) {
    if (!guestSessionId) throw new UnauthorizedException();
    return this.atomic(async (tx) => {
      const threads = await tx.askThread.findMany({
        where: { guestSessionId },
        orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
        take: GUEST_THREAD_LIMIT,
        select: { id: true, language: true, createdAt: true, updatedAt: true },
      });
      if (threads.length === 0) return [];
      const firstTurns = await tx.askTurn.findMany({
        where: { threadId: { in: threads.map((t) => t.id) }, sequence: FIRST_TURN_SEQUENCE },
        select: { threadId: true, question: true },
      });
      const firstByThread = new Map(firstTurns.map((turn) => [turn.threadId, turn.question]));
      return threads.map((thread) => {
        const question = firstByThread.get(thread.id);
        return {
          id: thread.id,
          language: thread.language,
          createdAt: thread.createdAt,
          lastActiveAt: thread.updatedAt,
          firstQuestion: question === undefined ? null : clampPreview(question),
        };
      });
    });
  }

  /**
   * ════════════════════════════════════════════════════════════════════════
   * PUBLIC BETA ASK CONTINUITY R1 — SAVED (QUESTIONS)
   * ════════════════════════════════════════════════════════════════════════
   *
   * A bookmark is a RELATIONSHIP to canonical Ask content, so this read joins to
   * the turn rather than storing anything of its own beyond the link. Nothing is
   * copied at write time, which is why a bookmarked answer can never drift from
   * the answer, and why a bookmark cannot keep an expired artifact readable.
   *
   * Ownership is the bookmark row's own `userId`, so the listing needs no thread
   * resolution and cannot return another reader's row.
   */
  async listBookmarks(userId: string) {
    this.user(userId);

    const rows = await this.prisma.askBookmark.findMany({
      where: { userId },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      take: SAVED_BOOKMARK_LIMIT,
      select: {
        id: true,
        turnId: true,
        createdAt: true,
        turn: {
          select: {
            question: true,
            language: true,
            sequence: true,
            threadId: true,
            operation: { select: { id: true, status: true, computeClass: true } },
          },
        },
      },
    });

    return rows.map((row) => ({
      id: row.id,
      turnId: row.turnId,
      savedAt: row.createdAt,
      threadId: row.turn.threadId,
      sequence: row.turn.sequence,
      language: row.turn.language,
      question: clampPreview(row.turn.question),
      questionTruncated: row.turn.question.length > PREVIEW_MAX,
      operationId: row.turn.operation?.id ?? null,
      state: row.turn.operation?.status ?? null,
      computeClass: row.turn.operation?.computeClass ?? null,
    }));
  }

  /**
   * Bookmark one of the reader's OWN turns.
   *
   * The turn is resolved through its thread's owner (`thread: { userId }`), so a
   * turn belonging to someone else and a turn that does not exist take the SAME
   * bare `NotFoundException` — one reader cannot learn that another's turn
   * exists by trying to bookmark it.
   *
   * The write is an upsert on `(userId, turnId)`, so bookmarking twice is the
   * same as bookmarking once. A bookmark is a state, not a counter.
   */
  async addBookmark(userId: string, turnId: string) {
    this.user(userId);

    return this.atomic(async (tx) => {
      const turn = await tx.askTurn.findFirst({
        where: { id: turnId, thread: { userId } },
        select: { id: true },
      });
      if (!turn) throw new NotFoundException();

      const row = await tx.askBookmark.upsert({
        where: { userId_turnId: { userId, turnId } },
        create: { userId, turnId },
        update: {},
        select: { id: true, turnId: true, createdAt: true },
      });

      return { id: row.id, turnId: row.turnId, savedAt: row.createdAt, bookmarked: true };
    });
  }

  /**
   * Remove a bookmark, scoped to the caller.
   *
   * `deleteMany` with `userId` in the predicate means another reader's row is
   * simply not matched, so the answer carries no information about it. Removing
   * a bookmark that is not there is not an error — unbookmark is idempotent for
   * the same reason bookmark is.
   */
  async removeBookmark(userId: string, turnId: string) {
    this.user(userId);

    const outcome = await this.prisma.askBookmark.deleteMany({ where: { userId, turnId } });

    return { turnId, bookmarked: false, removed: outcome.count > 0 };
  }
  async getThread(p: AskPrincipal, id: string, after = 0) {
    return this.atomic(async (tx) => {
      const thread = await this.thread(tx, p, id);
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
  async getOperation(p: AskPrincipal, id: string) {
    return this.atomic(async (tx) => {
      const operation = await this.owned(tx, p, id);
      const owner = ownerOf(p);
      const result = operation.storedResultId
        ? await tx.storedResult.findFirst({ where: { id: operation.storedResultId, ...owner } })
        : null;
      const ledger = await tx.sandLedgerEntry.findMany({
        where: { operationId: id },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      });
      /*
        STANDALONE PUBLIC BETA CONVERGENCE R1 — the reader's Save control needs the turn this
        operation answered (AskTurn.operationId is unique) and whether THIS reader has saved it.
        Owner-scoped twice: the operation is already the caller's (`owned`), and the turn is
        read through its thread's owner. Two reads, no write, no compute.

        ALPHA VISUAL ACCEPTANCE REPAIR R1 — the same owner-scoped turn read also returns the
        canonical facts a reopened result needs: the question it answered (YOU ASKED), and the
        thread + sequence an explicit follow-up continues. Read from AskTurn, never copied
        into StoredResult; an operation that is not the caller's never reaches this line.

        ASK GUEST TRIAL R3 — a guest cannot save (bookmarks are account-only), so `bookmarked`
        is simply false for a guest; nothing is read for it.
      */
      const turn = await tx.askTurn.findFirst({
        where: { operationId: id, thread: owner },
        select: { id: true, question: true, threadId: true, sequence: true, language: true },
      });
      const bookmarked =
        turn === null || p.kind !== 'account'
          ? false
          : (await tx.askBookmark.count({ where: { userId: p.userId, turnId: turn.id } })) > 0;
      /* HOME R1 STAGE A — what the server made of the context references (Inspect). Present
         only for an operation that was sent some, so every other response is unchanged. */
      const planContext = readPlanContext(operation.plan);
      return {
        ...(planContext === null
          ? {}
          : {
              context: {
                entry: planContext.entry,
                scope: planContext.scope,
                refs: planContext.refs,
              },
            }),
        operationId: id,
        turnId: turn?.id ?? null,
        bookmarked,
        question: turn?.question ?? null,
        threadId: turn?.threadId ?? null,
        sequence: turn?.sequence ?? null,
        language: turn?.language ?? null,
        computeClass: operation.computeClass,
        status: operation.status,
        quotedSand: operation.quotedSand,
        chargingEnabled: SAND_CHARGING_ENABLED,
        requiresAcceptance: requiresExplicitAcceptance(operation.computeClass),
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

  /**
   * ASK GUEST TRIAL R3 — the checks a NEW guest execution passes BEFORE the planner runs.
   * Switch and configuration first (fail closed), then the visible allowance, then the
   * cookie-independent execution bound for this trusted IP scope. Returns the compensation to
   * run if the operation is not created after all.
   */
  private async guestPreflight(guestSessionId: string): Promise<{ undo: () => Promise<void> }> {
    const { guests, switches, meter } = this.guestDeps();
    const config = guests.trialConfig();
    if (!config.valid) throw guestRefusal('GUEST_TRIAL_NOT_CONFIGURED');
    if (!(await switches.isEnabled('ASK_GUEST_TRIAL_ENABLED'))) {
      throw guestRefusal('GUEST_TRIAL_UNAVAILABLE');
    }
    assertMayStart(await readAllowance(this.prisma, guestSessionId, config.limits));
    const ipScope = askRequestContext.getStore()?.ipScope;
    if (ipScope === undefined) throw guestRefusal('GUEST_TEMPORARILY_LIMITED');
    const bucket = dayBucket(new Date());
    const scope = guestExecutionScope(ipScope);
    if (!(await meter.admitCount(scope, bucket, config.limits.executionsPerIpScopePerDay))) {
      throw guestRefusal('GUEST_TEMPORARILY_LIMITED');
    }
    /* All guests together: bounds news-provider calls the model-unit pool cannot see. */
    if (
      !(await meter.admitCount(GUEST_EXECUTIONS_ALL_SCOPE, bucket, config.limits.executionsPerDay))
    ) {
      await meter.adjustCount(scope, bucket, -1);
      throw guestRefusal('GUEST_TEMPORARILY_LIMITED');
    }
    return {
      undo: async () => {
        await meter.adjustCount(scope, bucket, -1);
        await meter.adjustCount(GUEST_EXECUTIONS_ALL_SCOPE, bucket, -1);
      },
    };
  }

  async quote(p: AskPrincipal, threadId: string, input: QuoteTurnDto) {
    this.principal(p);
    const request: AskRequest = {
      question: input.question.trim(),
      language: input.language,
      intent: input.intent,
    };
    if (request.question.length < 2) throw new BadRequestException('Question is too short');
    const owner = ownerOf(p);
    /* HOME R1 STAGE A — a context bag is part of the request's identity; absent ⇒ unchanged. */
    const suppliedContext = contextIdentity(input.context ?? null);
    const requestHash = hashIdentity([
      threadId,
      request.question,
      request.language,
      request.intent,
      ...(suppliedContext === null ? [] : [suppliedContext]),
    ]);
    const existing = await this.atomic(async (tx) => {
      await this.thread(tx, p, threadId);
      return tx.computeOperation.findFirst({
        where: { ...owner, clientKey: input.idempotencyKey },
      });
    });
    if (existing) {
      /* A retry of the same submission is the SAME operation: no new slot, no new work. */
      this.assertSame(existing.requestHash, requestHash);
      return this.getOperation(p, existing.id);
    }

    const guest = p.kind === 'guest' ? await this.guestPreflight(p.guestSessionId) : null;
    try {
      /* ASK R3 CONTINUITY — the anchor question of THIS owner-verified thread, if any. */
      const priorQuestion = await this.atomic(async (tx) => {
        await this.thread(tx, p, threadId);
        const earlier = await tx.askTurn.findMany({
          where: { threadId },
          orderBy: { sequence: 'desc' },
          take: ANCHOR_LOOKBACK,
          select: { question: true },
        });
        return anchorQuestionOf(
          request.question,
          earlier.map((t) => t.question),
        );
      });
      /* HOME R1 STAGE A — verify the governed references (retained reads only, no compute). */
      const resolvedContext: ResolvedAskContext | null =
        input.context === undefined ? null : await this.contextResolver().resolve(input.context);
      const contextInputs =
        resolvedContext === null
          ? undefined
          : await this.contextResolver().executionInputs(resolvedContext);
      // A local/read-only CTO planner supplies identity and capabilities, never the client.
      const prepared = await this.withPrior(
        priorQuestion,
        () => this.execution.prepare(Object.freeze(request)),
        contextInputs,
      );
      validatePlan(prepared, request);
      const plan: AskPlanWithContext = {
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
        ...(resolvedContext === null ? {} : { context: resolvedContext }),
      };
      const key = fingerprint(request, plan);
      const id = await this.atomic(async (tx) => {
        await this.thread(tx, p, threadId);
        const concurrent = await tx.computeOperation.findFirst({
          where: { ...owner, clientKey: input.idempotencyKey },
        });
        if (concurrent) {
          this.assertSame(concurrent.requestHash, requestHash);
          return concurrent.id;
        }
        validatePlan(plan, request);
        const newest = await tx.storedResult.findFirst({
          where: { ...owner, fingerprint: key, expiresAt: { gt: new Date() } },
          orderBy: { createdAt: 'desc' },
        });
        /* CURRENT REPORTING STORED-RESULT REUSE R1 — a new Send replays only a time-independent
           answer; current reporting (and any degraded "try again" answer) is observed afresh. */
        const stored = newest && isReusableStoredPayload(newest.payload) ? newest : null;
        const computeClass = classifyCompute(request, plan, !!stored);
        /* Deeper, quoted work is never a guest answer: the reader is asked to sign in. */
        if (p.kind === 'guest' && requiresExplicitAcceptance(computeClass)) {
          throw guestRefusal('GUEST_SIGN_IN_REQUIRED');
        }
        const operation = await tx.computeOperation.create({
          data: {
            ...owner,
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
        /* ASK GUEST TRIAL R3 — the visible slot, reserved in THIS transaction (all-or-nothing). */
        if (p.kind === 'guest') {
          const config = this.guestDeps().guests.trialConfig();
          if (!config.valid) throw guestRefusal('GUEST_TRIAL_NOT_CONFIGURED');
          await reserveSlot(
            tx,
            p.guestSessionId,
            operation.id,
            config.limits,
            config.limits.concurrentPerSession,
          );
        }
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
      return this.getOperation(p, id);
    } catch (error) {
      if (guest !== null) await guest.undo();
      throw error;
    }
  }

  /** One conversational submission. Only deep/report work stops at a quote. */
  async submit(p: AskPrincipal, threadId: string, input: QuoteTurnDto) {
    const operation = await this.quote(p, threadId, input);
    return operation.requiresAcceptance ? operation : this.execute(p, operation.operationId);
  }

  async accept(p: AskPrincipal, id: string) {
    await this.atomic(async (tx) => {
      const operation = await this.owned(tx, p, id);
      if (!requiresExplicitAcceptance(operation.computeClass) || operation.acceptedAt) return;
      if (operation.status !== 'QUOTED') throw new ConflictException('Operation is not quoted');
      this.assertFreshQuote(operation);
      await tx.computeOperation.update({
        where: { id },
        data: { status: 'ACCEPTED', acceptedAt: new Date() },
      });
    });
    return this.getOperation(p, id);
  }
  private async reserveIn(tx: Tx, operation: ComputeOperation): Promise<ComputeOperation> {
    if (['RESERVED', 'RUNNING', 'COMPLETED'].includes(operation.status)) return operation;
    const requiresAcceptance = requiresExplicitAcceptance(operation.computeClass);
    if (
      requiresAcceptance
        ? operation.status !== 'ACCEPTED' || !operation.acceptedAt
        : !['QUOTED', 'ACCEPTED'].includes(operation.status)
    ) {
      throw new ConflictException('Accept the quote first');
    }
    this.assertFreshQuote(operation);
    const reserved = await tx.computeOperation.update({
      where: { id: operation.id },
      data: { status: 'RESERVED' },
    });
    await this.ledger(tx, operation, 'RESERVE');
    return reserved;
  }
  async reserve(p: AskPrincipal, id: string) {
    await this.atomic(async (tx) => this.reserveIn(tx, await this.owned(tx, p, id)));
    return this.getOperation(p, id);
  }

  /** Durable claim commits BEFORE the external call. Retries never dispatch it twice.
   * An expired RUNNING claim is released, never re-run: provider outcome is unknown.
   */
  async execute(p: AskPrincipal, id: string) {
    const claim = await this.atomic(async (tx) => {
      let operation = await this.owned(tx, p, id);
      if (TERMINAL.includes(operation.status)) return null;
      if (operation.status === 'RUNNING') {
        if (operation.leaseExpiresAt && operation.leaseExpiresAt.getTime() <= Date.now()) {
          await this.releaseIn(tx, operation, 'EXECUTION_OUTCOME_UNKNOWN');
        }
        return null;
      }
      if (
        !requiresExplicitAcceptance(operation.computeClass) &&
        ['QUOTED', 'ACCEPTED'].includes(operation.status)
      ) {
        if (operation.quoteExpiresAt.getTime() <= Date.now()) {
          await this.releaseIn(tx, operation, 'QUOTE_EXPIRED');
          return null;
        }
        operation = await this.reserveIn(tx, operation);
      }
      if (
        operation.status !== 'RESERVED' ||
        (requiresExplicitAcceptance(operation.computeClass) && !operation.acceptedAt)
      )
        throw new ConflictException('Reserve an accepted quote first');
      if (operation.quoteExpiresAt.getTime() <= Date.now()) {
        await this.releaseIn(tx, operation, 'QUOTE_EXPIRED');
        return null;
      }
      const candidate = await tx.storedResult.findFirst({
        where: {
          ...ownerOf(p),
          ...(operation.storedResultId
            ? { id: operation.storedResultId }
            : { fingerprint: operation.fingerprint }),
          expiresAt: { gt: new Date() },
        },
        orderBy: { createdAt: 'desc' },
      });
      /* CURRENT REPORTING STORED-RESULT REUSE R1 — the same rule as the quote: a result settled
         meanwhile under this fingerprint is replayed only if it is time-independent. */
      const stored = candidate && isReusableStoredPayload(candidate.payload) ? candidate : null;
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
        /* ASK GUEST TRIAL R3 — a new explicit turn answered from this guest's OWN stored result
           is still an answer-producing turn: it counts exactly like the original would. */
        await settleSlot(
          tx,
          id,
          countsAsGuestAnswer(stored.payload)
            ? { commit: true }
            : { commit: false, reason: 'NO_ANSWER' },
        );
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
      /* ASK R3 CONTINUITY — the same anchor rule over the turns before this one. */
      const earlierTurns = await tx.askTurn.findMany({
        where: { threadId: turn.threadId, sequence: { lt: turn.sequence } },
        orderBy: { sequence: 'desc' },
        take: ANCHOR_LOOKBACK,
        select: { question: true },
      });
      // Revalidate pending R1 operations too. Stored reuse above never calls the adapter.
      try {
        validatePlan(
          operation.plan as unknown as AskPlan,
          {
            question: turn.question,
            language: turn.language,
            intent: operation.kind,
          } as AskRequest,
        );
      } catch {
        await this.releaseIn(tx, operation, 'ASK_PLAN_INVALID');
        return null;
      }
      const runToken = randomUUID();
      await tx.computeOperation.update({
        where: { id },
        data: { status: 'RUNNING', runToken, leaseExpiresAt: new Date(Date.now() + 300000) },
      });
      return {
        runToken,
        priorQuestion: anchorQuestionOf(
          turn.question,
          earlierTurns.map((t) => t.question),
        ),
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
        /* HOME R1 STAGE A — the operation's OWN persisted context, re-read from retained records. */
        const planContext = readPlanContext(claim.plan);
        const contextInputs =
          planContext === null ? undefined : await this.contextResolver().executionInputs(planContext);
        result = await this.withPrior(
          claim.priorQuestion,
          () => this.execution.execute(Object.freeze(claim.request), Object.freeze(claim.plan), id),
          contextInputs,
        );
      } catch (error) {
        /* ASK R2 INTEGRATION R1 · Gate E — a control's refusal is named, not generic. */
        const code =
          error instanceof AskExecutionRefused && /^[A-Z0-9_:.-]{1,120}$/i.test(error.code)
            ? error.code
            : 'EXECUTION_FAILED';
        await this.releaseRun(id, claim.runToken, code);
        return this.getOperation(p, id);
      }
      // A DB settlement failure leaves RUNNING. Retrying execute must not call the provider again.
      await this.settle(id, claim.runToken, result);
    }
    return this.getOperation(p, id);
  }

  /**
   * Settle the ONE run this token claimed. Keyed by (operation, runToken) — the durable claim
   * that authorized the external call — so the settlement writes to whoever owns the operation
   * NOW, and the guest slot moves in the SAME transaction as the stored result.
   */
  async settle(id: string, runToken: string, result: ExecutionResult) {
    await this.atomic(async (tx) => {
      const operation = await tx.computeOperation.findUnique({ where: { id } });
      if (!operation) throw new NotFoundException();
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
          ...(operation.guestSessionId !== null
            ? { guestSessionId: operation.guestSessionId }
            : { userId: operation.userId as string }),
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
      /* ASK GUEST TRIAL R3 — commit exactly once WITH the durable result, or release (D3). */
      await settleSlot(
        tx,
        id,
        countsAsGuestAnswer(payload) ? { commit: true } : { commit: false, reason: 'NO_ANSWER' },
      );
      await this.ledger(tx, operation, 'SETTLE');
    });
  }
  private async releaseIn(tx: Tx, operation: ComputeOperation, failureCode: string) {
    await tx.computeOperation.update({
      where: { id: operation.id },
      data: { status: 'RELEASED', failureCode, completedAt: new Date(), runToken: null },
    });
    /* ASK GUEST TRIAL R3 — every release path releases the visible slot (no-op for accounts). */
    await settleSlot(tx, operation.id, { commit: false, reason: releaseReasonOf(failureCode) });
    await this.ledger(tx, operation, 'RELEASE');
  }
  /** Release the run this token claimed (the execute failure path), whoever owns it now. */
  private async releaseRun(id: string, runToken: string, failureCode: string) {
    await this.atomic(async (tx) => {
      const operation = await tx.computeOperation.findUnique({ where: { id } });
      if (!operation || TERMINAL.includes(operation.status)) return;
      if (operation.runToken !== runToken) return;
      await this.releaseIn(tx, operation, failureCode);
    });
  }
  async release(p: AskPrincipal, id: string, failureCode = 'USER_RELEASED') {
    await this.atomic(async (tx) => {
      const operation = await this.owned(tx, p, id);
      if (TERMINAL.includes(operation.status)) return;
      await this.releaseIn(tx, operation, failureCode);
    });
    return this.getOperation(p, id);
  }
  async refund(p: AskPrincipal, id: string) {
    await this.atomic(async (tx) => {
      const operation = await this.owned(tx, p, id);
      if (operation.status === 'REFUNDED') return;
      if (operation.status !== 'COMPLETED')
        throw new ConflictException('Only completed operations can be refunded');
      await tx.computeOperation.update({ where: { id }, data: { status: 'REFUNDED' } });
      await this.ledger(tx, operation, 'REFUND');
    });
    return this.getOperation(p, id);
  }

  /** ASK GUEST TRIAL R3 — whether NEW guest work may start at all (switch AND valid settings). */
  async guestTrialAvailable(): Promise<boolean> {
    if (!this.guests || !this.switches) return false;
    return this.guests.trialConfig().valid && this.switches.isEnabled('ASK_GUEST_TRIAL_ENABLED');
  }

  /** ASK GUEST TRIAL R3 — the server-authoritative allowance for one guest session. */
  async guestAllowance(guestSessionId: string) {
    const { guests, switches } = this.guestDeps();
    const config = guests.trialConfig();
    const enabled = config.valid && (await switches.isEnabled('ASK_GUEST_TRIAL_ENABLED'));
    const limits = config.valid
      ? config.limits
      : {
          attemptsPerSession: Number.MAX_SAFE_INTEGER,
          cooldownAfterNoAnswer: 2,
          cooldownSeconds: 0,
        };
    const a = await readAllowance(this.prisma, guestSessionId, limits);
    return { ...a, available: enabled };
  }
}
