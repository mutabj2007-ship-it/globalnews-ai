import { BadRequestException, ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../database/prisma.service';
import {
  OPERATIONAL_SWITCHES,
  OperationalSwitchService,
  type OperationalSwitchName,
} from '../../compute-controls/operational-switch.service';
import {
  ADMIN_OPERATIONS_HISTORY_LIMIT,
  ADMIN_SWITCH_LABEL_KEYS,
  ADMIN_OPERATIONS_REASON_MAX,
  ADMIN_OPERATIONS_REASON_MIN,
  type AdminOperationsChange,
  type AdminOperationsState,
  type AdminOperationsSwitch,
  type AdminOperationsSwitchResult,
} from './admin-operations.contract';
import { environmentIdentityFrom } from './deployment-environment';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * ADMIN OPERATIONS R1 — THE FIRST ADMIN WRITE, AND WHAT IT REFUSES
 * ════════════════════════════════════════════════════════════════════════════
 *
 * THIS SERVICE OWNS NO SWITCH LOGIC. It calls `OperationalSwitchService.set()`,
 * which already writes `OperationalSwitch` and `OperationalSwitchAudit` in ONE
 * transaction with the actor and reason. No SQL is written here, the
 * transaction is not re-implemented, and the audit row is not written twice.
 * Duplicating either would produce a second source of truth for what an
 * operator did, which is the one thing an audit trail cannot survive.
 *
 * THREE REFUSALS, ALL SERVER-SIDE:
 *
 *   1. capability — enforced by the guard chain on the controller.
 *   2. environment unconfirmed — a screen that cannot say which deployment it
 *      is pointing at must not change it. Refused here, not hidden in the UI,
 *      because a hidden button is not a control and a curl is not a browser.
 *   3. a missing or too-short reason — the audit row exists to answer "why",
 *      and a blank answer makes it decorative.
 *
 * WHAT IT DOES NOT DO: it never turns a switch ON by deployment. `effective`
 * needs the deployment variable to be the literal string 'true' as well, and
 * that half is not operable from Admin by design (KS-4). An operator can
 * always stop something; only a deploy can make it possible to start.
 */
@Injectable()
export class AdminOperationsService {
  private readonly logger = new Logger(AdminOperationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly switches: OperationalSwitchService,
    private readonly config: ConfigService,
  ) {}

  private labelKeyFor(name: OperationalSwitchName): AdminOperationsSwitch['labelKey'] {
    return ADMIN_SWITCH_LABEL_KEYS[name];
  }

  /** Why this control cannot be operated right now — `null` when it can. */
  private blockedReason(
    readable: boolean,
    deploymentValueIsLiteralTrue: boolean,
    environmentConfirmed: boolean,
  ): AdminOperationsSwitch['blockedReason'] {
    if (!environmentConfirmed) return 'ENVIRONMENT_UNCONFIRMED';
    if (!readable) return 'STORE_UNREADABLE';
    /*
      With the deployment half not 'true', `effective` is already false and no
      operator action can change that. Surfacing it as a distinct reason stops
      the screen implying a pause did nothing when the pause was never the
      thing holding it off.
    */
    if (!deploymentValueIsLiteralTrue) return 'DEPLOYMENT_VALUE_NOT_TRUE';
    return null;
  }

  private async switchView(
    name: OperationalSwitchName,
    environmentConfirmed: boolean,
  ): Promise<AdminOperationsSwitch> {
    /*
      READ THROUGH THE LANDED SERVICE, WITH ITS OWN CLOCK.

      An earlier revision of this method passed an inflated `now` to force a
      cache miss. That would have been a serious defect: `state()` stores that
      same `now` as the entry's timestamp, so every later read would compute a
      negative age, treat the entry as fresh forever, and serve the executor a
      frozen switch value — a pause that never takes effect. The cache is
      therefore left alone.

      Freshness is still right where it matters: `set()` deletes the cache
      entry, so the re-read after a write is always from the store. A plain
      GET may be up to ASK_FLAG_CACHE_MS old, which is why `checkedAt` is
      reported and the screen shows it rather than implying "now".
    */
    const state = await this.switches.state(name);
    const checkedAt = new Date().toISOString();
    return {
      name,
      labelKey: this.labelKeyFor(name),
      effective: state.effective,
      requested: state.row ? state.row.enabled : null,
      deploymentValueIsLiteralTrue: state.deploymentValueIsLiteralTrue,
      readable: state.readable,
      checkedAt,
      lastChange: state.row
        ? {
            name,
            enabled: state.row.enabled,
            setBy: state.row.setBy,
            reason: state.row.reason,
            setAt: state.row.setAt.toISOString(),
          }
        : null,
      blockedReason: this.blockedReason(
        state.readable,
        state.deploymentValueIsLiteralTrue,
        environmentConfirmed,
      ),
    };
  }

  /** Read-only history, newest first. An unreadable store yields [] and never a fabricated row. */
  private async history(): Promise<AdminOperationsChange[]> {
    try {
      const rows = await this.prisma.operationalSwitchAudit.findMany({
        orderBy: { setAt: 'desc' },
        take: ADMIN_OPERATIONS_HISTORY_LIMIT,
      });
      return rows.map((row) => ({
        name: row.name,
        enabled: row.enabled,
        setBy: row.setBy,
        reason: row.reason,
        setAt: row.setAt.toISOString(),
      }));
    } catch {
      return [];
    }
  }

  async state(mayOperate: boolean): Promise<AdminOperationsState> {
    const identity = environmentIdentityFrom(this.config);
    const switches = await Promise.all(
      OPERATIONAL_SWITCHES.map((name) => this.switchView(name, identity.confirmed)),
    );
    return {
      environment: identity,
      switches,
      history: await this.history(),
      mayOperate,
      checkedAt: new Date().toISOString(),
    };
  }

  /**
   * Change one switch. The actor is the SERVER-DERIVED admin id; no request
   * field supplies it, so a caller cannot write the audit trail in someone
   * else's name.
   */
  async setSwitch(
    name: OperationalSwitchName,
    enabled: boolean,
    actorAdminId: string,
    reason: string,
  ): Promise<AdminOperationsSwitchResult> {
    if (!(OPERATIONAL_SWITCHES as readonly string[]).includes(name))
      throw new BadRequestException('Unknown switch');

    const identity = environmentIdentityFrom(this.config);
    if (!identity.confirmed)
      throw new ForbiddenException('Deployment environment is not confirmed');

    const trimmed = typeof reason === 'string' ? reason.trim() : '';
    if (
      trimmed.length < ADMIN_OPERATIONS_REASON_MIN ||
      trimmed.length > ADMIN_OPERATIONS_REASON_MAX
    )
      throw new BadRequestException('A reason is required');

    await this.switches.set(name, enabled, actorAdminId, trimmed);

    /*
      RE-READ, AND REPORT WHAT THE SERVER NOW SEES. `applied` is derived from
      the stored row after the write, so the screen states a confirmed fact
      rather than assuming the 2xx meant the value took.
    */
    const view = await this.switchView(name, identity.confirmed);
    const applied = view.requested === enabled;
    if (!applied)
      this.logger.warn(`switch ${name} did not read back as ${enabled ? 'ON' : 'OFF'} after set`);
    return { applied, switch: view };
  }
}
