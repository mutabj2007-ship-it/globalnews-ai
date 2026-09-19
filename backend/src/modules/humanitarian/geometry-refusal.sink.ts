import { Logger } from '@nestjs/common';

import {
  refusalClassAlarms,
  type GeometryAuditDetailR1,
  type GeometryRefusalSink,
} from '@globalnews-ai/shared';

import { logWithRequestId } from '../../observability/log-with-request-id';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * GX-23 · THE AUDIT SIGNAL R3's `catch {}` DISCARDED
 * ════════════════════════════════════════════════════════════════════════════
 *
 * ALPHA-HUMANITARIAN-GX14-AUTHORITY-STORE-R1 · AS-8, AS-E1-8.
 *
 * ── THE COLLISION, AND WHY THE FIX GOES HERE AND NOT IN R3 ────────────────
 *
 * GA-8 required the protective-derivation refusal to be LOUD. GX-19 required a
 * per-record failure to be ISOLATED. R3 implemented GX-19 with an unconditional
 * `catch {` — the right mechanism — and swallowed GA-8 doing it.
 *
 * E1 ruled that GX-19 wins, and gave the reason: isolation is the SECURITY property,
 * loudness is an OPERABILITY property, and a reader-visible throw was itself the GX-18
 * channel. So the signal is restored on a channel the reader cannot observe, and
 * reader-facing behaviour does not change by one byte.
 *
 * ── WHICH CHANNEL, AND WHY NOT THE OTHER TWO ──────────────────────────────
 *
 * E1 re-derived the choice and confirmed it. Three candidates exist in this tree:
 *
 *   modules/telemetry/**        `@Controller('events') @Post()` — READER-FACING and
 *                               account-scoped. Emitting here would put the refusal on
 *                               a surface the reader can observe, which is the GX-18
 *                               channel reopened through the back door. WRONG.
 *   observability/**            `logWithRequestId`, request context, logging
 *                               interceptor. Server-side, no route. THIS ONE.
 *   news/telemetry/provider-execution.registry.ts
 *                               in-memory per-instance counter behind the existing
 *                               admin projection. The precedent for the SET counter.
 *
 * NO SECOND LOGGING SYSTEM IS INTRODUCED. This is one implementation of one interface
 * declared in `shared`, wired to the logger this backend already uses.
 */
export class ObservabilityGeometryRefusalSink implements GeometryRefusalSink {
  private readonly logger = new Logger('GeometryRefusal');

  /**
   * AS-E1-8 §3 · WHAT IS LOGGED IS THE CLOSED CODE AND NOTHING ELSE.
   *
   * No `sourceId`, no `sourceGeometryId`, no coordinates, no class id, no partition
   * key, no exception text. The `refusalCode` is a member of the contract's own closed
   * vocabulary — `refusalCodeOf` guarantees that, and anything unrecognised has already
   * become `GEOMETRY_UNCLASSIFIED_REFUSAL` before it reaches here.
   *
   * `reason` is narrowed to `'RECORD_REFUSED'` at the type level, so the pairing E1
   * named — `{ recordKey, reason: 'PROTECTED' }` — cannot be constructed, let alone
   * logged. That is the one pairing that must never reach a general application log,
   * because together those two fields ARE the protected fact.
   *
   * `recordKey` is included deliberately: it is the producer's own opaque key, it
   * appears in the reader response for every record including unprotected ones, and
   * without it an operator cannot act on the alarm at all. It carries no protection
   * status by itself — a refused record and a drawn record have the same kind of key.
   */
  record(detail: GeometryAuditDetailR1): void {
    const level = refusalClassAlarms(detail.refusalClass) ? 'error' : 'warn';

    logWithRequestId(
      this.logger,
      level,
      `GX23 refusal class=${detail.refusalClass} code=${detail.refusalCode} ` +
        `record=${detail.recordKey} epoch=${String(detail.authorityEpoch)}`,
    );
  }

  /**
   * AS-12 · an all-refusing set is reported as a refusal, never as a quiet zero.
   *
   * E1 measured the failure this prevents: "a systematic failure — every record
   * refusing — returns N outcomes all NOT_SHOWN, indistinguishable from an empty map to
   * a reader AND TO AN OPERATOR." The reader half is correct and stays. The operator
   * half is the defect, and this is where it closes.
   */
  recordSetOutcome(summary: {
    readonly total: number;
    readonly refused: number;
    readonly authorityEpoch: number;
  }): void {
    if (summary.refused === 0) return;

    // A set that refused EVERY member is the systematic-failure shape, and it is
    // escalated above a set that lost one record to a bad row.
    const total = summary.total;
    const level = total > 0 && summary.refused === total ? 'error' : 'warn';

    logWithRequestId(
      this.logger,
      level,
      `GX23 set refused=${String(summary.refused)}/${String(total)} ` +
        `epoch=${String(summary.authorityEpoch)}`,
    );
  }
}
