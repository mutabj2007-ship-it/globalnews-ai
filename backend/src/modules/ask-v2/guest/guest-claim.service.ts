import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { Prisma } from '../../../generated/prisma/client';
import { ComputeMeterService } from '../../compute-controls/compute-meter.service';
import { guestRefusal } from './ask-principal';
import { GuestSessionService } from './guest-session.service';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * ASK GUEST TRIAL R3 — ONE CONVERSATION, MOVED TO ONE ACCOUNT, EXACTLY ONCE
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 1. CLAIM (guest, CSRF + Origin): the guest names its OWN thread; a PENDING claim is written
 *    server-side. Nothing identifying is returned or placed in any URL.
 * 2. OAUTH START: the claim's id goes into the HMAC-signed, one-time OAuth flow cookie — only
 *    if the SAME browser still presents that guest's cookie and the claim is still PENDING.
 * 3. OAUTH CALLBACK (Google proved the account): `transfer` runs ONE serializable transaction
 *    that requires control of BOTH identities — the claim in the signed flow state AND the
 *    guest cookie presented on this very callback — then moves the guest's threads, operations
 *    and stored results to the account, marks the claim CONSUMED and the guest session
 *    CLAIMED. The old guest credential can read nothing afterwards: its rows no longer carry
 *    its session id, and the session is no longer ACTIVE.
 *
 * Replay-safe: the flow cookie is cleared before anything else, a CONSUMED claim never moves
 * anything again, and a second account can never consume it. It never keys on an IP address.
 * It refuses while an answer is still in progress, so no in-flight settlement can race it.
 */

export interface TransferOutcome {
  readonly transferred: boolean;
  readonly threadId: string | null;
  readonly reason?: 'CLAIM_NOT_PENDING' | 'GUEST_NOT_PRESENTED' | 'ANSWER_IN_PROGRESS' | 'EXPIRED';
}

@Injectable()
export class GuestClaimService {
  private readonly logger = new Logger(GuestClaimService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly sessions: GuestSessionService,
    private readonly meter: ComputeMeterService,
  ) {}

  private claimTtlMs(): number {
    return this.sessions.trialConfig().lifetimes.claimTtlS * 1000;
  }

  /** Step 1 — the guest binds its own thread to its next sign-in. */
  async createClaim(
    guestSessionId: string,
    threadId: string,
    now: Date = new Date(),
  ): Promise<void> {
    await this.prisma.$transaction(
      async (tx) => {
        const thread = await tx.askThread.findFirst({
          where: { id: threadId, guestSessionId },
          select: { id: true },
        });
        if (thread === null) throw new NotFoundException();
        const inFlight = await tx.guestSlot.count({ where: { guestSessionId, state: 'RESERVED' } });
        if (inFlight > 0) throw guestRefusal('GUEST_ANSWER_IN_PROGRESS');
        /* Only the newest claim is ever honoured: older pending ones expire now. */
        await tx.guestClaim.updateMany({
          where: { guestSessionId, status: 'PENDING' },
          data: { status: 'EXPIRED' },
        });
        await tx.guestClaim.create({
          data: {
            guestSessionId,
            threadId,
            expiresAt: new Date(now.getTime() + this.claimTtlMs()),
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  /** Step 2 — the claim an OAuth start may carry, for the guest presenting this cookie. */
  async pendingClaimFor(guestSessionId: string, now: Date = new Date()): Promise<string | null> {
    const claim = await this.prisma.guestClaim.findFirst({
      where: { guestSessionId, status: 'PENDING', expiresAt: { gt: now } },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });
    return claim?.id ?? null;
  }

  /** Step 3 — the atomic, idempotent move. `presentedGuestTokenHash` comes from the callback cookie. */
  async transfer(
    claimId: string,
    presentedGuestTokenHash: string | null,
    userId: string,
    now: Date = new Date(),
  ): Promise<TransferOutcome> {
    let movedFrom: string | null = null;
    const outcome = await this.prisma.$transaction(
      async (tx): Promise<TransferOutcome> => {
        const claim = await tx.guestClaim.findUnique({ where: { id: claimId } });
        if (claim === null || claim.status !== 'PENDING') {
          return { transferred: false, threadId: null, reason: 'CLAIM_NOT_PENDING' };
        }
        if (claim.expiresAt.getTime() <= now.getTime()) {
          await tx.guestClaim.update({ where: { id: claimId }, data: { status: 'EXPIRED' } });
          return { transferred: false, threadId: null, reason: 'EXPIRED' };
        }
        const session = await tx.guestSession.findUnique({ where: { id: claim.guestSessionId } });
        if (
          session === null ||
          presentedGuestTokenHash === null ||
          session.tokenHash !== presentedGuestTokenHash
        ) {
          return { transferred: false, threadId: null, reason: 'GUEST_NOT_PRESENTED' };
        }
        if (session.status !== 'ACTIVE' || session.expiresAt.getTime() <= now.getTime()) {
          return { transferred: false, threadId: null, reason: 'EXPIRED' };
        }
        const inFlight = await tx.guestSlot.count({
          where: { guestSessionId: session.id, state: 'RESERVED' },
        });
        if (inFlight > 0)
          return { transferred: false, threadId: null, reason: 'ANSWER_IN_PROGRESS' };

        const owner = { guestSessionId: session.id };
        const to = { userId, guestSessionId: null };
        await tx.storedResult.updateMany({ where: owner, data: to });
        await tx.computeOperation.updateMany({ where: owner, data: to });
        await tx.askThread.updateMany({ where: owner, data: to });
        await tx.guestClaim.update({
          where: { id: claimId },
          data: { status: 'CONSUMED', consumedAt: now, consumedByUserId: userId },
        });
        await tx.guestClaim.updateMany({
          where: { guestSessionId: session.id, status: 'PENDING' },
          data: { status: 'EXPIRED' },
        });
        await tx.guestSession.update({
          where: { id: session.id },
          data: { status: 'CLAIMED', claimedByUserId: userId, claimedAt: now },
        });
        movedFrom = session.id;
        return { transferred: true, threadId: claim.threadId };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    if (outcome.transferred && movedFrom !== null) {
      /* Usage survives the identity change: the guest's spent units now also weigh on the account. */
      const units = await this.meter.guestSessionUnits(movedFrom);
      await this.meter.carryUnitsToAccount(userId, units, now);
    } else if (!outcome.transferred) {
      this.logger.log(`guest claim not transferred (${outcome.reason ?? 'unknown'})`);
    }
    return outcome;
  }

  /** After the callback: which conversation this account just continued, for a short window. */
  async continuationFor(userId: string, now: Date = new Date()): Promise<string | null> {
    const claim = await this.prisma.guestClaim.findFirst({
      where: {
        consumedByUserId: userId,
        status: 'CONSUMED',
        consumedAt: { gt: new Date(now.getTime() - 2 * this.claimTtlMs()) },
      },
      orderBy: { consumedAt: 'desc' },
      select: { threadId: true },
    });
    if (claim === null) return null;
    const thread = await this.prisma.askThread.findFirst({
      where: { id: claim.threadId, userId },
      select: { id: true },
    });
    return thread?.id ?? null;
  }
}
