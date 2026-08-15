import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

export interface UserSummary {
  id: string;
  email: string;
  displayName: string | null;
  createdAt: Date;
}

/**
 * Milestone #57 — deleteAccount relies entirely on Prisma's
 * onDelete: Cascade declared on UserIdentity/Session/SearchHistoryEntry's
 * own userId foreign keys (see schema.prisma) — a single delete of the
 * User row removes every account-owned row across all three related
 * tables in one operation. No manual multi-table delete sequence is
 * written here, since that would risk drifting out of sync with the
 * schema's own cascade declarations over time.
 */
@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async getById(userId: string): Promise<UserSummary | null> {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, displayName: true, createdAt: true },
    });
  }

  async deleteAccount(userId: string): Promise<void> {
    await this.prisma.user.delete({ where: { id: userId } });
  }
}
