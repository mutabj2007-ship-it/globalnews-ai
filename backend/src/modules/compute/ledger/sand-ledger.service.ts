import { Injectable, Logger } from '@nestjs/common';
import type { ComputeOperationStatus, SandLedgerEntryType } from '@globalnews-ai/shared';
import { PrismaService } from '../../../database/prisma.service';
import { BetaFeatureFlagsService } from '../flags/beta-feature-flags.service';

/**
 * BETA-SIMPLE-ASK-SAND-1 §11/§13 — the minimal Sand ledger.
 *
 * §11: "Build the technical ledger seam required for future metering…
 * Do not build a full financial wallet system… This is compute
 * accounting, not yet commercial payment processing."
 *
 * Accordingly this service can do exactly four things — record a
 * quote, record a reservation, settle it, release it — and there is
 * deliberately NO method here for crediting an account, purchasing
 * Sand, adjusting a balance, or reading a balance. Those belong to
 * commercial work §34 explicitly defers.
 *
 * APPEND-ONLY. Every method INSERTs; none UPDATEs. A reservation and
 * its release are two rows, not one row mutated twice. That is what
 * makes §13's guarantee auditable: you can prove a failed operation
 * released its reservation by finding the RELEASE row, rather than
 * having to trust that some mutable flag was flipped correctly.
 *
 * §10 SAND_CHARGING: the whole ledger is written regardless of the
 * charging flag, because §10's entire point is that we can test
 * "classification; quotes; ledger; telemetry… without charging
 * anyone". What the flag gates is the one thing that would actually
 * take Sand from someone — see settle() below.
 */

export interface LedgerWriteInput {
  operationId: string;
  userId?: string;
  sessionKey?: string;
  quotedSand: number;
  status: ComputeOperationStatus;
  resultId?: string;
}

@Injectable()
export class SandLedgerService {
  private readonly logger = new Logger(SandLedgerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly flags: BetaFeatureFlagsService,
  ) {}

  /**
   * §11 — a quote was issued. Moves nothing.
   *
   * Recorded even though it moves no Sand, because §9 makes quoting a
   * user-visible commitment: "server returns quote → UI shows → user
   * confirms". A quote that was shown and declined is a real event
   * worth auditing, and it is also the §31 signal for how often users
   * refuse a price.
   */
  async recordQuote(input: LedgerWriteInput): Promise<void> {
    await this.write('QUOTE', { ...input, reservedSand: 0, finalSand: 0 });
  }

  /**
   * §13 QUOTED → RESERVED. Sets Sand aside before execution begins.
   *
   * Reserving BEFORE running, rather than charging after, is what
   * makes §13's failure path honest: if we charged on completion, a
   * crash mid-execution would leave no record at all and the cost
   * would be invisible. Reserving first means every started operation
   * is accounted for, and the release is an explicit, visible act.
   */
  async recordReservation(input: LedgerWriteInput): Promise<void> {
    await this.write('RESERVE', {
      ...input,
      reservedSand: input.quotedSand,
      finalSand: 0,
    });
  }

  /**
   * §13 RUNNING → COMPLETED. Converts a reservation into a final charge.
   *
   * **THE CHARGING GATE.** This is the single place in the entire
   * codebase where Sand would actually be consumed, and it is the
   * single place SAND_CHARGING is enforced.
   *
   * With charging OFF (the required §10 default, and the only state
   * this tranche ships), a SETTLE row is still written for audit and
   * telemetry, but `finalSand` is forced to 0 — nothing is consumed.
   * The row's own `finalSand: 0` is the proof, visible in the ledger,
   * that this completed operation cost the user nothing. It is not a
   * silent skip.
   *
   * §9: "Commercial charging remains OFF."
   */
  async recordSettlement(input: LedgerWriteInput): Promise<void> {
    const chargingEnabled = this.flags.get().sandCharging;

    if (!chargingEnabled && input.quotedSand > 0) {
      this.logger.debug(
        `SAND_CHARGING is off: settling operation ${input.operationId} at 0 instead of ${input.quotedSand}.`,
      );
    }

    await this.write('SETTLE', {
      ...input,
      reservedSand: 0,
      finalSand: chargingEnabled ? input.quotedSand : 0,
    });
  }

  /**
   * §13 FAILED → RESERVATION_RELEASED.
   *
   * "A failed computation must never silently consume the eventual
   * user's Sand." The release is written with finalSand: 0 and the
   * full reserved amount echoed back in `reservedSand`, so summing
   * RESERVE minus RELEASE for an operation nets to zero — the
   * arithmetic itself demonstrates nothing was consumed.
   */
  async recordRelease(input: LedgerWriteInput): Promise<void> {
    await this.write('RELEASE', {
      ...input,
      reservedSand: input.quotedSand,
      finalSand: 0,
    });
  }

  /**
   * Every ledger row for one operation, oldest first. The audit view,
   * and what §30's "failed operation releases reservation" test reads.
   */
  async entriesForOperation(operationId: string): Promise<
    Array<{
      entryType: string;
      quotedSand: number;
      reservedSand: number;
      finalSand: number;
      status: string;
      createdAt: Date;
    }>
  > {
    return this.prisma.sandLedgerEntry.findMany({
      where: { operationId },
      orderBy: { createdAt: 'asc' },
      select: {
        entryType: true,
        quotedSand: true,
        reservedSand: true,
        finalSand: true,
        status: true,
        createdAt: true,
      },
    });
  }

  /**
   * §13 — the net Sand actually consumed by one operation.
   *
   * Computed from the rows rather than stored, so it cannot drift from
   * the ledger it is supposed to summarize. With charging off this is
   * always 0, and a test asserting that is asserting against the real
   * arithmetic rather than against a mocked flag.
   */
  async netConsumedForOperation(operationId: string): Promise<number> {
    const entries = await this.entriesForOperation(operationId);
    return entries.reduce((total, entry) => total + entry.finalSand, 0);
  }

  /**
   * §13 — the Sand currently held in reservation for one operation.
   * A completed or released operation must net to zero here.
   */
  async outstandingReservationForOperation(operationId: string): Promise<number> {
    const entries = await this.entriesForOperation(operationId);
    return entries.reduce((total, entry) => {
      if (entry.entryType === 'RESERVE') return total + entry.reservedSand;
      if (entry.entryType === 'RELEASE') return total - entry.reservedSand;
      if (entry.entryType === 'SETTLE') return total - entry.quotedSand;
      return total;
    }, 0);
  }

  private async write(
    entryType: SandLedgerEntryType,
    input: LedgerWriteInput & { reservedSand: number; finalSand: number },
  ): Promise<void> {
    // §10 — with SAND_LEDGER off, nothing is written at all. The
    // product still classifies and quotes; it simply keeps no ledger.
    if (!this.flags.get().sandLedger) return;

    try {
      await this.prisma.sandLedgerEntry.create({
        data: {
          operationId: input.operationId,
          entryType,
          userId: input.userId ?? null,
          sessionKey: input.sessionKey ?? null,
          quotedSand: input.quotedSand,
          reservedSand: input.reservedSand,
          finalSand: input.finalSand,
          status: input.status,
          resultId: input.resultId ?? null,
        },
      });
    } catch (error) {
      /**
       * A ledger write failure must not fail the user's request — but
       * unlike the stored-result cache, it MUST be loud. A missing
       * audit row is a correctness problem for §11's "auditable"
       * requirement, not a missed optimization, so this logs at error
       * level rather than warn.
       *
       * It does not throw because, with charging off, a lost audit row
       * cannot cost anyone anything, and failing a user's answer to
       * protect a fixture-value ledger would be the wrong trade. When
       * charging is eventually turned on, this decision must be
       * revisited — see the §33 handover notes.
       */
      this.logger.error(
        `Failed to write ${entryType} ledger entry for operation ${input.operationId}. ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
    }
  }
}
