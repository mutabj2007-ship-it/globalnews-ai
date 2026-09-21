import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import type {
  AskContext,
  AskThread,
  AskThreadWithTurns,
  AskTurn,
  AskTurnRole,
  AskTurnStatus,
  ComputeClass,
  LanguageCode,
} from '@globalnews-ai/shared';
import { PrismaService } from '../../../database/prisma.service';
import { BetaFeatureFlagsService } from '../../compute/flags/beta-feature-flags.service';
import type { OperationOwner } from '../../compute/operation/compute-operation.service';

/**
 * BETA-SIMPLE-ASK-SAND-1 §3 — Ask thread and turn persistence.
 *
 * §10 ASK_PERSISTENCE gates every write here. With the flag off, this
 * service returns in-memory-shaped objects that are never stored, so
 * a conversation still works within one page session but nothing is
 * written to the database. That is what makes the flag genuinely
 * useful rather than decorative: turning it off does not disable Ask,
 * it disables durability.
 *
 * OWNERSHIP IS THE ONLY ACCESS CONTROL, and it is enforced by a WHERE
 * clause on ownerKey in every read. This mirrors HistoryService's own
 * documented discipline ("the sole safeguard preventing one user from
 * ever reading another user's history … must never be omitted or
 * widened"). There is no separate authorization layer to fall back on
 * if one of these clauses is dropped.
 */

/** A conversation title is derived from the first question; keep it short. */
const MAX_TITLE_LENGTH = 80;

function deriveTitle(question: string): string {
  const collapsed = question.trim().replace(/\s+/g, ' ');
  if (collapsed.length <= MAX_TITLE_LENGTH) return collapsed;
  // Cut on a word boundary where one is reasonably close, so a title
  // does not end mid-word.
  const cut = collapsed.slice(0, MAX_TITLE_LENGTH);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > MAX_TITLE_LENGTH * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

@Injectable()
export class AskThreadService {
  private readonly logger = new Logger(AskThreadService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly flags: BetaFeatureFlagsService,
  ) {}

  private get persistenceEnabled(): boolean {
    return this.flags.get().askPersistence;
  }

  /**
   * Creates a thread, or returns the caller's existing one.
   *
   * With persistence off this returns a synthetic, unsaved thread so
   * the rest of the flow is identical either way — callers never
   * branch on the flag.
   */
  async createThread(input: {
    owner: OperationOwner;
    firstQuestion: string;
    language: LanguageCode;
    context?: AskContext;
  }): Promise<AskThread> {
    const title = deriveTitle(input.firstQuestion);

    if (!this.persistenceEnabled) {
      const now = new Date().toISOString();
      return {
        id: `ephemeral-${now}-${Math.random().toString(36).slice(2, 10)}`,
        ownerKind: input.owner.kind,
        userId: input.owner.userId,
        title,
        language: input.language,
        context: input.context ?? {},
        createdAt: now,
        updatedAt: now,
      };
    }

    const row = await this.prisma.askThread.create({
      data: {
        ownerKind: input.owner.kind,
        ownerKey: input.owner.key,
        userId: input.owner.userId ?? null,
        sessionKey: input.owner.sessionKey ?? null,
        title,
        language: input.language,
        context: (input.context ?? {}) as never,
      },
    });

    return this.toThread(row);
  }

  /**
   * Loads a thread the caller owns, with its turns in order.
   *
   * Throws NotFoundException — not ForbiddenException — when the
   * thread exists but belongs to someone else. Distinguishing the two
   * would confirm to an attacker that a given thread id is real,
   * which is an unnecessary disclosure for a resource whose ids are
   * otherwise unguessable.
   */
  async getThread(threadId: string, owner: OperationOwner): Promise<AskThreadWithTurns> {
    if (!this.persistenceEnabled) {
      throw new NotFoundException('Ask thread persistence is disabled');
    }

    const row = await this.prisma.askThread.findUnique({ where: { id: threadId } });

    if (!row || row.ownerKey !== owner.key) {
      throw new NotFoundException(`Unknown Ask thread ${threadId}`);
    }

    const turns = await this.prisma.askTurn.findMany({
      where: { threadId },
      orderBy: { sequence: 'asc' },
    });

    return {
      thread: this.toThread(row),
      turns: turns.map((turn) => this.toTurn(turn)),
    };
  }

  /** The caller's threads, most recently updated first. */
  async listThreads(owner: OperationOwner, limit = 20): Promise<AskThread[]> {
    if (!this.persistenceEnabled) return [];

    const rows = await this.prisma.askThread.findMany({
      where: { ownerKey: owner.key },
      orderBy: { updatedAt: 'desc' },
      take: limit,
    });

    return rows.map((row) => this.toThread(row));
  }

  /**
   * Appends a turn.
   *
   * SEQUENCE ALLOCATION AND ITS RACE. The next sequence number is
   * read, then written. Two concurrent turns on one thread can
   * therefore both read the same number — and when they do, the
   * database's @@unique([threadId, sequence]) rejects the second
   * INSERT rather than silently producing two turns claiming the same
   * position in the conversation. That rejection is retried once with
   * a freshly-read sequence.
   *
   * A single retry rather than a loop is deliberate: a human cannot
   * produce a third genuinely-concurrent turn on one thread, and an
   * unbounded retry loop against a persistent failure is worse than
   * an error. The real defence against duplicate submissions is §12's
   * idempotency key, which stops the duplicate long before it reaches
   * this method.
   */
  async appendTurn(input: {
    threadId: string;
    role: AskTurnRole;
    status: AskTurnStatus;
    question?: string;
    answer?: unknown;
    computeClass?: ComputeClass;
    storedResultReused?: boolean;
    operationId?: string;
  }): Promise<AskTurn> {
    if (!this.persistenceEnabled) {
      return {
        id: `ephemeral-turn-${Math.random().toString(36).slice(2, 10)}`,
        threadId: input.threadId,
        sequence: 0,
        role: input.role,
        question: input.question,
        answer: (input.answer as AskTurn['answer']) ?? null,
        status: input.status,
        computeClass: input.computeClass,
        storedResultReused: input.storedResultReused ?? false,
        operationId: input.operationId,
        createdAt: new Date().toISOString(),
      };
    }

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const sequence = await this.nextSequence(input.threadId);

      try {
        const row = await this.prisma.askTurn.create({
          data: {
            threadId: input.threadId,
            sequence,
            role: input.role,
            status: input.status,
            question: input.question ?? null,
            answer: (input.answer ?? null) as never,
            computeClass: input.computeClass ?? null,
            storedResultReused: input.storedResultReused ?? false,
            operationId: input.operationId ?? null,
          },
        });

        await this.touchThread(input.threadId);
        return this.toTurn(row);
      } catch (error) {
        const isSequenceClash =
          typeof error === 'object' &&
          error !== null &&
          (error as { code?: unknown }).code === 'P2002';

        if (!isSequenceClash || attempt === 1) throw error;

        this.logger.debug(
          `Sequence ${sequence} was taken on thread ${input.threadId}; retrying once.`,
        );
      }
    }

    // Unreachable: the loop either returns or throws.
    throw new Error(`Failed to append turn to thread ${input.threadId}`);
  }

  /**
   * §12 — the turns a previous submission of this operation produced.
   *
   * When a duplicate submission arrives (browser retry, HTTP retry,
   * Railway retry), the operation row is reused — but the CALLER
   * still needs an answer, and it must be the SAME answer, not a
   * second execution and not an error. This finds the exchange that
   * operation already produced so it can be returned verbatim.
   *
   * Returns the assistant turn and, when present, the user turn that
   * immediately preceded it in the same thread.
   */
  async findExchangeByOperationId(
    operationId: string,
  ): Promise<{ userTurn: AskTurn | null; assistantTurn: AskTurn } | null> {
    if (!this.persistenceEnabled) return null;

    const rows = await this.prisma.askTurn.findMany({
      where: { operationId },
      orderBy: { sequence: 'asc' },
    });

    const assistantRow = rows.find((row) => row.role === 'assistant');
    if (!assistantRow) return null;

    const assistantTurn = this.toTurn(assistantRow);

    // The user turn is not tagged with the operationId (the question
    // precedes the operation's outcome), so it is located by position:
    // the turn immediately before the assistant turn in the same
    // thread.
    const siblings = await this.prisma.askTurn.findMany({
      where: { threadId: assistantTurn.threadId },
      orderBy: { sequence: 'asc' },
    });

    const preceding = siblings
      .filter((row) => row.role === 'user' && row.sequence < assistantTurn.sequence)
      .pop();

    return {
      userTurn: preceding ? this.toTurn(preceding) : null,
      assistantTurn,
    };
  }

  private async nextSequence(threadId: string): Promise<number> {
    const turns = await this.prisma.askTurn.findMany({
      where: { threadId },
      orderBy: { sequence: 'desc' },
      take: 1,
      select: { sequence: true },
    });

    return (turns[0]?.sequence ?? 0) + 1;
  }

  /**
   * Bumps updatedAt so thread listing orders by real activity.
   * Never allowed to fail the turn it accompanies — an out-of-order
   * list is cosmetic, a lost answer is not.
   */
  private async touchThread(threadId: string): Promise<void> {
    try {
      await this.prisma.askThread.update({
        where: { id: threadId },
        data: { updatedAt: new Date() },
      });
    } catch (error) {
      this.logger.warn(
        `Failed to touch thread ${threadId}. ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
    }
  }

  private toThread(row: {
    id: string;
    ownerKind: string;
    userId: string | null;
    title: string;
    language: string;
    context: unknown;
    createdAt: Date;
    updatedAt: Date;
  }): AskThread {
    return {
      id: row.id,
      ownerKind: row.ownerKind as AskThread['ownerKind'],
      userId: row.userId ?? undefined,
      title: row.title,
      language: row.language as LanguageCode,
      context: (row.context as AskContext) ?? {},
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private toTurn(row: {
    id: string;
    threadId: string;
    sequence: number;
    role: string;
    question: string | null;
    answer: unknown;
    status: string;
    computeClass: string | null;
    storedResultReused: boolean;
    operationId: string | null;
    createdAt: Date;
  }): AskTurn {
    return {
      id: row.id,
      threadId: row.threadId,
      sequence: row.sequence,
      role: row.role as AskTurnRole,
      question: row.question ?? undefined,
      answer: (row.answer as AskTurn['answer']) ?? null,
      status: row.status as AskTurnStatus,
      computeClass: (row.computeClass as ComputeClass) ?? undefined,
      storedResultReused: row.storedResultReused,
      operationId: row.operationId ?? undefined,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
