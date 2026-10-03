import type { OperationalSwitchName } from '../../compute-controls/operational-switch.service';
import type { DeploymentEnvironment, EnvironmentUnconfirmedReason } from './deployment-environment';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * ADMIN OPERATIONS R1 — THE OPERATOR CONTRACT
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Read-only fields describe what IS. The one write describes what an operator
 * ASKED FOR. The screen must be able to tell those apart even when they
 * disagree, so `effective` and `requested` are separate fields and neither is
 * derived from the other on the client.
 *
 * NOTHING HERE CARRIES A SECRET. A switch has a name, a boolean, an actor, a
 * time and a reason. No credential, no connection string, no token, and no
 * environment variable VALUE other than the validated environment label.
 */

export type AdminOperationsEnvironment =
  | { confirmed: true; environment: DeploymentEnvironment; nodeEnv: string | null }
  | {
      confirmed: false;
      environment: null;
      nodeEnv: string | null;
      reason: EnvironmentUnconfirmedReason;
    };

/**
 * Each landed switch has its OWN operator identity. TRUST R1 (CTO checkpoint 4 §7): the guest
 * switch had no key of its own and was rendered with the Ask R2 wording ("Stop Ask R2
 * execution") — a control that does something else must never borrow another's copy.
 */
export type AdminOperationsLabelKey = 'pauseNewAiAnswers' | 'stopAskR2Execution' | 'guestTrial';

/** Exhaustive: adding a switch without a label is a compile error, never a silent reuse. */
export const ADMIN_SWITCH_LABEL_KEYS: Readonly<
  Record<OperationalSwitchName, AdminOperationsLabelKey>
> = {
  ASK_PUBLIC_COMPUTE_ENABLED: 'pauseNewAiAnswers',
  ASK_R2_ENABLED: 'stopAskR2Execution',
  ASK_GUEST_TRIAL_ENABLED: 'guestTrial',
};

/** Why a control is not operable right now. `null` means it is operable. */
export type AdminOperationsBlockedReason =
  'ENVIRONMENT_UNCONFIRMED' | 'STORE_UNREADABLE' | 'DEPLOYMENT_VALUE_NOT_TRUE';

export interface AdminOperationsSwitch {
  name: OperationalSwitchName;
  /** Plain-language identity for the operator; the screen translates from this key. */
  labelKey: AdminOperationsLabelKey;
  /**
   * What the executor actually does right now. `effective = deployment literal
   * 'true' AND the stored row says enabled` — both keys, exactly as landed.
   */
  effective: boolean;
  /** The stored operator request. `null` when no row exists yet. */
  requested: boolean | null;
  /** The deployment half of the two-key switch. An operator cannot change this. */
  deploymentValueIsLiteralTrue: boolean;
  /** False when the switch store could not be read. `effective` is then false, fail-closed. */
  readable: boolean;
  /** When this reading was taken, server-side. Not when the page rendered. */
  checkedAt: string;
  lastChange: AdminOperationsChange | null;
  /** `null` when the control can be operated. */
  blockedReason: AdminOperationsBlockedReason | null;
}

export interface AdminOperationsChange {
  name: string;
  enabled: boolean;
  setBy: string;
  reason: string | null;
  setAt: string;
}

export interface AdminOperationsState {
  environment: AdminOperationsEnvironment;
  switches: AdminOperationsSwitch[];
  /** Read-only, newest first, from the append-only audit record. */
  history: AdminOperationsChange[];
  /** True when this reader may operate the controls, not merely see them. */
  mayOperate: boolean;
  checkedAt: string;
}

/** The one write. `reason` is required: an unexplained change is not acceptable here. */
export interface AdminOperationsSwitchRequest {
  enabled: boolean;
  reason: string;
}

/**
 * The write's answer. `applied` is the BACKEND's word for it, re-read after the
 * transaction — never the client's optimistic assumption that a 2xx meant the
 * value changed.
 */
export interface AdminOperationsSwitchResult {
  applied: boolean;
  switch: AdminOperationsSwitch;
}

export const ADMIN_OPERATIONS_REASON_MIN = 3;
export const ADMIN_OPERATIONS_REASON_MAX = 280;
export const ADMIN_OPERATIONS_HISTORY_LIMIT = 50;
