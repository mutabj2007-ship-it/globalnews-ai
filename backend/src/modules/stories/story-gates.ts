import { NotFoundException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';

/**
 * HOME, DISCUSSIONS, ALERTS & PAID R1 · STAGE B — the release gates for the capabilities that
 * now exist. Server-only deployment literals ('true' exactly — the switches' KS-6 rule), default
 * OFF, one authority per capability. They are NOT Ask spend switches: nothing here spends.
 *
 *   DISCUSSION_READ_ENABLED    discussion.read   — public thread + counts
 *   DISCUSSION_WRITE_ENABLED   discussion.write  — post / reply / edit / delete / report;
 *                                                  requires discussion.read
 *   ALERTS_IN_APP_ENABLED      alerts.inApp      — create / manage / inbox
 *
 * Declared OFF and unimplemented, so the absence stays visible: alerts.delivery (no delivery
 * capability exists), billing.checkout (not authorised). The dormant Watch is untouched.
 * A gate OFF answers 404 and hides; it never deletes a row (rollback keeps reader content).
 */
export const STAGE_B_DECLARED_OFF = { alertsDelivery: false, billingCheckout: false } as const;

type Getter = Pick<ConfigService, 'get'>;
const on = (config: Getter, name: string): boolean => config.get<string>(name) === 'true';

export function discussionReadEnabled(config: Getter): boolean {
  return on(config, 'DISCUSSION_READ_ENABLED');
}
export function discussionWriteEnabled(config: Getter): boolean {
  return discussionReadEnabled(config) && on(config, 'DISCUSSION_WRITE_ENABLED');
}
export function alertsInAppEnabled(config: Getter): boolean {
  return on(config, 'ALERTS_IN_APP_ENABLED');
}

/** A disabled capability does not exist: 404, never a hint. */
export function requireGate(enabled: boolean): void {
  if (!enabled) throw new NotFoundException();
}
