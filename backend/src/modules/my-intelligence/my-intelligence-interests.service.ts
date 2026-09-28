import { Injectable } from '@nestjs/common';
import {
  MY_INTELLIGENCE_INTERESTS,
  isMyIntelligenceInterest,
  type MyIntelligenceInterest,
  type MyIntelligenceInterestsResponse,
} from '@globalnews-ai/shared';
import { PrismaService } from '../../database/prisma.service';

/**
 * INTEREST + SELECTION HOOK R1 — EXPLICIT READER INTERESTS.
 *
 * Reads and replaces the reader's own interest set. Account-owned, governed
 * ids only, deleted with the account (FK cascade). Nothing here infers an
 * interest, reads question history, calls AI or calls a news provider: the
 * set is exactly what the reader chose.
 */
@Injectable()
export class MyIntelligenceInterestsService {
  constructor(private readonly prisma: PrismaService) {}

  async get(userId: string): Promise<MyIntelligenceInterestsResponse> {
    const rows = await this.prisma.userIntelligenceInterest.findMany({
      where: { userId },
      select: { interest: true },
    });
    return { interests: ordered(rows.map((row: { interest: string }) => row.interest)) };
  }

  /** One mutation: the stored set becomes exactly `requested` (deduplicated, governed only). */
  async replace(userId: string, requested: readonly string[]): Promise<MyIntelligenceInterestsResponse> {
    const next = ordered(requested);
    await this.prisma.$transaction([
      this.prisma.userIntelligenceInterest.deleteMany({
        where: { userId, interest: { notIn: [...next] } },
      }),
      this.prisma.userIntelligenceInterest.createMany({
        data: next.map((interest) => ({ userId, interest })),
        skipDuplicates: true,
      }),
    ]);
    return { interests: next };
  }
}

/** Governed ids only, each once, in the vocabulary's own order. */
export function ordered(values: readonly string[]): MyIntelligenceInterest[] {
  const wanted = new Set(values.filter(isMyIntelligenceInterest));
  return MY_INTELLIGENCE_INTERESTS.filter((interest) => wanted.has(interest));
}
