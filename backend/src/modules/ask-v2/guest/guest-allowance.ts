import type { Prisma } from '../../../generated/prisma/client';
import { GUEST_ANSWER_ALLOWANCE, type GuestTrialLimits } from './guest-trial.config';
import { guestRefusal } from './ask-principal';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * ASK GUEST TRIAL R3 — THE TRIAL ENTITLEMENT LEDGER (NOT THE RESOURCE LEDGER)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Two ledgers, never conflated (CTO §6):
 *   • ENTITLEMENT — GuestSlot rows: how many of the THREE visible answers are used.
 *   • RESOURCES   — ComputeMeter: every unit and every call actually spent, counted or not.
 *
 * A slot is RESERVED atomically, in the same serializable transaction that creates the
 * operation, BEFORE any planner, provider or model work — so a fourth eligible execution,
 * however many tabs race for it, is refused before anything runs. It is COMMITTED exactly
 * once, in the same transaction that durably stores a SUBSTANTIVE result, and RELEASED on
 * every other terminal outcome. Every transition is `RESERVED → x` guarded by
 * `where: { state: 'RESERVED' }`, so a replay, a late worker or the sweep can never move a
 * slot twice.
 *
 * THE COUNTING RULE (CTO D3) reads the server's own terminal answer — the answer state and
 * basis the adapter decided — never aiExecuted, HTTP status, source counts or displayed text,
 * and never an extra model judge. The exhaustive mapping is `countsAsGuestAnswer` below and is
 * tested state by state.
 */

type Tx = Prisma.TransactionClient;

/** Answer states that ARE a substantive answer. */
const SUBSTANTIVE_STATES: ReadonlySet<string> = new Set([
  'CURRENT_REPORTING',
  'CURRENTLY_VERIFIED',
  'PARTIAL',
  'REFERENCE_BACKGROUND',
  /* ASK TECHNICAL / SCIENTIFIC REASONING R1 — a deterministic computed answer IS an answer
     (same rule as a governed record: substantive, even with zero AI). CTO decision point. */
  'COMPUTED_RESULT',
]);

/**
 * Does this stored result count as one of the three guest answers?
 *
 *   CURRENT_REPORTING · CURRENTLY_VERIFIED · PARTIAL      yes — evidence-backed answer
 *   REFERENCE_BACKGROUND                                   yes — a real background answer
 *   RETAINED_RECORD, basis GOVERNED_RECORD                 yes — a real deterministic answer
 *                                                          (no model call is needed to count)
 *   RETAINED_RECORD, any other basis (GOVERNED_NO_RECORD)  no  — a bare "no record" (D3)
 *   INSUFFICIENT                                           no  — no substantive answer
 *   CLARIFICATION_REQUIRED (incl. broadening offered)      no  — asked before answering
 *   CAPABILITY_UNAVAILABLE                                 no  — unsupported / unavailable
 *   anything unknown, or no payload                        no  — never count what we cannot read
 *
 * A supported finding that "nothing changed" arrives as CURRENT_REPORTING with evidence, and
 * therefore counts: it is an answer, not an absence of one.
 */
export function countsAsGuestAnswer(payload: unknown): boolean {
  if (payload === null || typeof payload !== 'object') return false;
  const answer = (payload as { answer?: { state?: unknown; basis?: unknown } }).answer;
  if (answer === undefined || answer === null || typeof answer.state !== 'string') return false;
  if (SUBSTANTIVE_STATES.has(answer.state)) return true;
  if (answer.state === 'RETAINED_RECORD') return answer.basis === 'GOVERNED_RECORD';
  return false;
}

export type SlotReleaseReason = 'NO_ANSWER' | 'FAILED' | 'REFUSED';

/**
 * A released operation's failure code → why its slot was released. REFUSED means a control
 * stopped it before any spend; FAILED means work may have run. Unknown codes are FAILED — the
 * conservative direction for the attempt ceiling.
 */
export function releaseReasonOf(failureCode: string): SlotReleaseReason {
  if (
    /^(QUOTE_EXPIRED|ASK_PLAN_INVALID|STORED_RESULT_EXPIRED|USER_RELEASED|ASK_R2_DISABLED|ASK_PUBLIC_COMPUTE_DISABLED|ASK_REQUEST_CONTEXT_MISSING)$/.test(
      failureCode,
    ) ||
    /^(CIRCUIT_|BUDGET_|GUEST_)/.test(failureCode)
  ) {
    return 'REFUSED';
  }
  return 'FAILED';
}

export interface GuestAllowanceState {
  readonly allowance: number;
  readonly committed: number;
  readonly reserved: number;
  readonly remaining: number;
  /** Executions that may have spent work: committed + reserved + NO_ANSWER + FAILED. */
  readonly attempts: number;
  readonly cooldownUntil: Date | null;
  readonly state: 'OPEN' | 'EXHAUSTED' | 'COOLDOWN' | 'ATTEMPTS_EXHAUSTED';
}

export async function readAllowance(
  db: Pick<Tx, 'guestSlot'>,
  guestSessionId: string,
  limits: Pick<
    GuestTrialLimits,
    'attemptsPerSession' | 'cooldownAfterNoAnswer' | 'cooldownSeconds'
  >,
  now: Date = new Date(),
): Promise<GuestAllowanceState> {
  const slots = await db.guestSlot.findMany({
    where: { guestSessionId },
    select: { state: true, releaseReason: true, settledAt: true, createdAt: true },
    orderBy: [{ createdAt: 'desc' }],
  });
  const committed = slots.filter((s) => s.state === 'COMMITTED').length;
  const reserved = slots.filter((s) => s.state === 'RESERVED').length;
  const spentWork = slots.filter(
    (s) =>
      s.state === 'RELEASED' && (s.releaseReason === 'NO_ANSWER' || s.releaseReason === 'FAILED'),
  ).length;
  const attempts = committed + reserved + spentWork;

  /* Cooldown: the most recent N settled work-spending slots were ALL no-answer/failed. */
  const settledWork = slots
    .filter(
      (s) =>
        s.settledAt !== null &&
        (s.state === 'COMMITTED' ||
          (s.state === 'RELEASED' &&
            (s.releaseReason === 'NO_ANSWER' || s.releaseReason === 'FAILED'))),
    )
    .sort((a, b) => (b.settledAt as Date).getTime() - (a.settledAt as Date).getTime());
  const recent = settledWork.slice(0, limits.cooldownAfterNoAnswer);
  let cooldownUntil: Date | null = null;
  if (
    limits.cooldownSeconds > 0 &&
    recent.length === limits.cooldownAfterNoAnswer &&
    recent.every((s) => s.state === 'RELEASED')
  ) {
    const until = new Date((recent[0].settledAt as Date).getTime() + limits.cooldownSeconds * 1000);
    if (until.getTime() > now.getTime()) cooldownUntil = until;
  }

  const remaining = Math.max(0, GUEST_ANSWER_ALLOWANCE - committed - reserved);
  const state =
    committed >= GUEST_ANSWER_ALLOWANCE
      ? 'EXHAUSTED'
      : attempts >= limits.attemptsPerSession
        ? 'ATTEMPTS_EXHAUSTED'
        : cooldownUntil !== null
          ? 'COOLDOWN'
          : 'OPEN';
  return {
    allowance: GUEST_ANSWER_ALLOWANCE,
    committed,
    reserved,
    remaining,
    attempts,
    cooldownUntil,
    state,
  };
}

/** Throws the truthful refusal when a NEW eligible execution may not start. */
export function assertMayStart(a: GuestAllowanceState, now: Date = new Date()): void {
  if (a.committed >= GUEST_ANSWER_ALLOWANCE) throw guestRefusal('GUEST_TRIAL_EXHAUSTED');
  if (a.committed + a.reserved >= GUEST_ANSWER_ALLOWANCE) {
    throw guestRefusal('GUEST_ANSWER_IN_PROGRESS');
  }
  if (a.state === 'ATTEMPTS_EXHAUSTED') throw guestRefusal('GUEST_ATTEMPTS_EXHAUSTED');
  if (a.cooldownUntil !== null) {
    throw guestRefusal(
      'GUEST_COOLDOWN',
      Math.max(1, Math.ceil((a.cooldownUntil.getTime() - now.getTime()) / 1000)),
    );
  }
}

/** Inside the serializable transaction that creates the operation. */
export async function reserveSlot(
  tx: Tx,
  guestSessionId: string,
  operationId: string,
  limits: GuestTrialLimits,
  concurrentPerSession: number,
): Promise<void> {
  const a = await readAllowance(tx, guestSessionId, limits);
  assertMayStart(a);
  if (a.reserved >= concurrentPerSession) throw guestRefusal('GUEST_ANSWER_IN_PROGRESS');
  await tx.guestSlot.create({ data: { operationId, guestSessionId, state: 'RESERVED' } });
}

/** RESERVED → COMMITTED | RELEASED, exactly once. Returns whether THIS call moved the slot. */
export async function settleSlot(
  tx: Pick<Tx, 'guestSlot'>,
  operationId: string,
  outcome: { commit: true } | { commit: false; reason: SlotReleaseReason },
  now: Date = new Date(),
): Promise<boolean> {
  const moved = await tx.guestSlot.updateMany({
    where: { operationId, state: 'RESERVED' },
    data: outcome.commit
      ? { state: 'COMMITTED', settledAt: now }
      : { state: 'RELEASED', releaseReason: outcome.reason, settledAt: now },
  });
  return moved.count === 1;
}
