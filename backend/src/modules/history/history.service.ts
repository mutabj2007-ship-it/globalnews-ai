import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

export interface HistoryEntrySummary {
  id: string;
  query: string;
  countryCode: string | null;
  createdAt: Date;
}

/**
 * Milestone #57 — deliberately the entire persistence surface for
 * history: create/list/clear, nothing else. No update method exists —
 * a history entry is immutable once created (matching "revisit/re-run
 * a previous question," not "edit a previous question"). Never reads
 * or writes anything beyond query/countryCode/createdAt — no AI
 * response, prompt content, evidence snapshot, or article data is
 * ever passed through this service.
 */
@Injectable()
export class HistoryService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, query: string, countryCode: string | undefined): Promise<HistoryEntrySummary> {
    return this.prisma.searchHistoryEntry.create({
      data: { userId, query, countryCode },
      select: { id: true, query: true, countryCode: true, createdAt: true },
    });
  }

  /**
   * Ordered most-recent-first. Scoped strictly to the requesting
   * user's own userId — this is the sole safeguard preventing one
   * user from ever reading another user's history; there is no
   * separate authorization check beyond this WHERE clause, so it must
   * never be omitted or widened.
   */
  async listForUser(userId: string): Promise<HistoryEntrySummary[]> {
    return this.prisma.searchHistoryEntry.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: { id: true, query: true, countryCode: true, createdAt: true },
    });
  }

  async clearForUser(userId: string): Promise<void> {
    await this.prisma.searchHistoryEntry.deleteMany({ where: { userId } });
  }
}
