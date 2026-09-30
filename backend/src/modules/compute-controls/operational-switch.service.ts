import { BadRequestException, Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { PrismaClient } from '../../generated/prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { ComputeMeterService } from './compute-meter.service';
import { pendingProductOwnerKnobs } from './compute-controls.config';
import { withDeadline } from './compute-scopes';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * ASK R2 CONSOLIDATED INTEGRATION R1 · GATE B — FAIL-CLOSED KILL SWITCHES (F 03)
 * ════════════════════════════════════════════════════════════════════════════
 *
 *   K-1 ASK_PUBLIC_COMPUTE_ENABLED  stops ALL model spend on the public Ask path (reader: D2)
 *   K-2 ASK_R2_ENABLED              stops the Ask R2 surface (reader: D6)
 *   K-3 a ceiling lowered in configuration (compute-controls.config.ts)
 *
 * ON requires BOTH keys:
 *   1. the deployment variable is EXACTLY the string 'true' (KS-6: 'TRUE', '1', 'yes', ' true'
 *      are OFF), and
 *   2. the audited `OperationalSwitch` row for that name says enabled (a named person turned it
 *      on — KS-9). An incident turns it OFF through the same row, WITHOUT a deploy or restart
 *      (KS-4), within ASK_FLAG_CACHE_MS; nothing turns it back on by itself.
 * Unset / empty / malformed / unreadable ⇒ OFF (KS-5). Server-side only (KS-3).
 *
 * `ASK_V2_ENABLED` is preserved exactly as landed (KS-10/11): it is read by AskV2EnabledGuard,
 * and flipping it enables nothing while ASK_EXECUTION_PORT is unbound.
 */

/*
  ASK GUEST TRIAL R3 — K-4 ASK_GUEST_TRIAL_ENABLED: the first-visit guest path only. Same two
  keys, same default (OFF), same audit. It is SUBORDINATE, never a substitute: a guest request
  still needs ASK_V2_ENABLED, ASK_R2_ENABLED and ASK_PUBLIC_COMPUTE_ENABLED. Turning it OFF
  stops new guest work and leaves the signed-in path untouched; turning public compute OFF
  stops guests and accounts alike.
*/
export const OPERATIONAL_SWITCHES = [
  'ASK_PUBLIC_COMPUTE_ENABLED',
  'ASK_R2_ENABLED',
  'ASK_GUEST_TRIAL_ENABLED',
] as const;
export type OperationalSwitchName = (typeof OPERATIONAL_SWITCHES)[number];

export interface SwitchState {
  readonly name: OperationalSwitchName;
  readonly deploymentValueIsLiteralTrue: boolean;
  readonly row: {
    readonly enabled: boolean;
    readonly setBy: string;
    readonly setAt: Date;
    readonly reason: string | null;
  } | null;
  readonly effective: boolean;
  readonly readable: boolean;
}

type SwitchDb = Pick<PrismaClient, 'operationalSwitch' | 'operationalSwitchAudit' | '$transaction'>;

@Injectable()
export class OperationalSwitchService implements OnApplicationBootstrap {
  private readonly logger = new Logger(OperationalSwitchService.name);
  private readonly cache = new Map<OperationalSwitchName, { at: number; state: SwitchState }>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly meter: ComputeMeterService,
  ) {}

  private deploymentLiteralTrue(name: OperationalSwitchName): boolean {
    /* KS-6: the landed comparison, verbatim in shape — no trim, no case-fold, no coercion. */
    return this.config.get<string>(name) === 'true';
  }

  async state(
    name: OperationalSwitchName,
    now: number = Date.now(),
    db: SwitchDb = this.prisma,
  ): Promise<SwitchState> {
    const hit = this.cache.get(name);
    if (hit) {
      /*
        M-A — A NEGATIVE AGE IS NOT A SMALL AGE.

        This was `now - hit.at < flagCacheMs`, which treats every negative
        difference as fresh. `hit.at` is whatever `now` the caller that populated
        the entry passed, and `now` can legitimately be earlier than it: a caller
        passing a forward-shifted clock poisons the entry for everyone after it,
        and `Date.now()` itself steps backwards on an NTP correction or a
        suspended container. When that happens the old predicate stops consulting
        the store AT ALL — so an operator switching this kill switch off is never
        seen, which presents as an incident that will not stop.

        Requiring the age to be a real elapsed duration makes the entry stale
        instead, the store is read, and the entry is re-stamped at the current
        `now`, so a poisoned entry costs one extra read rather than freezing
        forever. `NaN >= 0` is false, so a nonsense clock also falls through to
        the store rather than pinning the cache.
      */
      const age = now - hit.at;
      if (age >= 0 && age < this.meter.config.flagCacheMs) return hit.state;
    }
    const literal = this.deploymentLiteralTrue(name);
    let state: SwitchState;
    try {
      const row = await withDeadline(
        db.operationalSwitch.findUnique({ where: { name } }),
        this.meter.config.storeDeadlineMs,
        'switch',
      );
      state = {
        name,
        deploymentValueIsLiteralTrue: literal,
        row: row
          ? { enabled: row.enabled, setBy: row.setBy, setAt: row.setAt, reason: row.reason }
          : null,
        effective: literal && row?.enabled === true,
        readable: true,
      };
    } catch {
      state = {
        name,
        deploymentValueIsLiteralTrue: literal,
        row: null,
        effective: false,
        readable: false,
      };
    }
    this.cache.set(name, { at: now, state });
    return state;
  }

  async isEnabled(name: OperationalSwitchName, now?: number, db?: SwitchDb): Promise<boolean> {
    return (await this.state(name, now, db)).effective;
  }

  /** A named person changes a switch; recorded with the actor (KS-9). */
  async set(
    name: OperationalSwitchName,
    enabled: boolean,
    actor: string,
    reason: string | null,
    db: SwitchDb = this.prisma,
  ): Promise<void> {
    if (!(OPERATIONAL_SWITCHES as readonly string[]).includes(name))
      throw new BadRequestException('Unknown switch');
    if (typeof actor !== 'string' || actor.trim().length === 0)
      throw new BadRequestException('A named actor is required');
    await db.$transaction(async (tx) => {
      await tx.operationalSwitch.upsert({
        where: { name },
        create: { name, enabled, setBy: actor, reason },
        update: { enabled, setBy: actor, reason, setAt: new Date() },
      });
      await tx.operationalSwitchAudit.create({ data: { name, enabled, setBy: actor, reason } });
    });
    this.cache.delete(name);
    this.logger.warn(
      `switch ${name} set ${enabled ? 'ON' : 'OFF'} by ${actor}${reason ? ` — ${reason}` : ''}`,
    );
  }

  /** KS-8 — resolved state announced at boot, like the landed startup validators. */
  async onApplicationBootstrap(): Promise<void> {
    for (const name of OPERATIONAL_SWITCHES) {
      const s = await this.state(name, Date.now());
      this.logger.log(
        `${name}: effective=${s.effective ? 'ON' : 'OFF'} deployment=${s.deploymentValueIsLiteralTrue ? "'true'" : 'not-true'} ` +
          `row=${s.row ? (s.row.enabled ? 'enabled' : 'disabled') : 'absent'}${s.readable ? '' : ' (store unreadable)'}`,
      );
    }
    const pending = pendingProductOwnerKnobs((n) => this.config.get<string>(n));
    if (pending.length > 0)
      this.logger.warn(
        `Ask compute knobs on conservative PO-pending defaults: ${pending.join(', ')}`,
      );
  }

  forget(): void {
    this.cache.clear();
  }
}
