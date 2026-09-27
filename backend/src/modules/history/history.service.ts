import { Injectable, Logger } from '@nestjs/common';
import {
  SEARCH_HISTORY_LIST_LIMIT,
  SEARCH_HISTORY_RETENTION_LIMIT,
} from '@globalnews-ai/shared';
import { PrismaService } from '../../database/prisma.service';

export interface HistoryEntrySummary {
  id: string;
  query: string;
  countryCode: string | null;
  createdAt: Date;
}

/**
 * MY INTELLIGENCE R1 — a repeat of the SAME question, from the same account,
 * inside this window is the same explicit action arriving twice (a React
 * retry, a double submit, an in-flight joiner) and is recorded once.
 */
export const HISTORY_DUPLICATE_WINDOW_MS = 30_000;

/**
 * Milestone #57 — deliberately the entire persistence surface for
 * history: create/list/clear, nothing else. No update method exists —
 * a history entry is immutable once created (matching "revisit/re-run
 * a previous question," not "edit a previous question"). Never reads
 * or writes anything beyond query/countryCode/createdAt — no AI
 * response, prompt content, evidence snapshot, or article data is
 * ever passed through this service.
 *
 * MY INTELLIGENCE R1 adds the missing WRITER (recordExplicitQuestion, called
 * from the one analysis entry point), a bounded list and bounded retention.
 */
@Injectable()
export class HistoryService {
  private readonly logger = new Logger(HistoryService.name);
  /** Same-process guard for two requests carrying the same question at once. */
  private readonly inFlight = new Set<string>();

  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, query: string, countryCode: string | undefined): Promise<HistoryEntrySummary> {
    return this.prisma.searchHistoryEntry.create({
      data: { userId, query, countryCode },
      select: { id: true, query: true, countryCode: true, createdAt: true },
    });
  }

  /**
   * MY INTELLIGENCE R1 — THE ONE HISTORY WRITER.
   *
   * Called for an explicit, authenticated compute action only (Send / Run /
   * Confirm reaching POST /analysis/news), from every surface alike. It stores
   * the reader's QUESTION and optional country context — never an answer,
   * source, citation, prompt or evidence. A failed or no-evidence analysis is
   * still recorded, because the reader genuinely asked; nothing is ever
   * written for staging, typing, opening Ask or reopening an old question.
   *
   * One explicit action → at most one entry: the same question inside
   * HISTORY_DUPLICATE_WINDOW_MS is recorded once. Retention is bounded: the
   * newest SEARCH_HISTORY_RETENTION_LIMIT entries are kept per account.
   *
   * NEVER THROWS. History is a record of the question, not a precondition of
   * answering it; a failure is logged and the analysis proceeds.
   */
  async recordExplicitQuestion(
    userId: string,
    rawQuery: string,
    rawCountryCode?: string,
    now: Date = new Date(),
  ): Promise<boolean> {
    const query = (rawQuery ?? '').trim();
    if (query.length === 0) return false;
    const countryCode = rawCountryCode?.trim() ? rawCountryCode.trim() : null;
    const key = `${userId}\u0000${query}\u0000${countryCode ?? ''}`;
    if (this.inFlight.has(key)) return false;
    this.inFlight.add(key);

    try {
      const latest = await this.prisma.searchHistoryEntry.findFirst({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        select: { query: true, countryCode: true, createdAt: true },
      });
      if (
        latest &&
        latest.query === query &&
        (latest.countryCode ?? null) === countryCode &&
        now.getTime() - latest.createdAt.getTime() < HISTORY_DUPLICATE_WINDOW_MS
      ) {
        return false;
      }

      await this.prisma.searchHistoryEntry.create({
        data: { userId, query, countryCode, createdAt: now },
      });
      await this.prune(userId);
      return true;
    } catch (error) {
      this.logger.warn(
        `Question history write failed; the analysis continues. ${(error as Error)?.message ?? 'unknown error'}`,
      );
      return false;
    } finally {
      this.inFlight.delete(key);
    }
  }

  /**
   * Ordered most-recent-first. Scoped strictly to the requesting
   * user's own userId — this is the sole safeguard preventing one
   * user from ever reading another user's history; there is no
   * separate authorization check beyond this WHERE clause, so it must
   * never be omitted or widened. MY INTELLIGENCE R1 — bounded.
   */
  async listForUser(userId: string): Promise<HistoryEntrySummary[]> {
    return this.prisma.searchHistoryEntry.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: SEARCH_HISTORY_LIST_LIMIT,
      select: { id: true, query: true, countryCode: true, createdAt: true },
    });
  }

  async clearForUser(userId: string): Promise<void> {
    await this.prisma.searchHistoryEntry.deleteMany({ where: { userId } });
  }

  /** Keeps the newest SEARCH_HISTORY_RETENTION_LIMIT entries for this account. */
  private async prune(userId: string): Promise<void> {
    const overflow = await this.prisma.searchHistoryEntry.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      skip: SEARCH_HISTORY_RETENTION_LIMIT,
      select: { id: true },
    });
    if (overflow.length === 0) return;
    await this.prisma.searchHistoryEntry.deleteMany({
      where: { userId, id: { in: overflow.map((entry: { id: string }) => entry.id) } },
    });
  }
}
