/**
 * ADMIN OPERATIONS R1 — the client mirror of
 * `backend/src/modules/admin/operations/admin-operations.contract.ts`.
 *
 * Mirrored rather than shared for the same reason the rest of this surface is:
 * this milestone is not authorized to change anything under `shared/**`.
 * `adminOperationsContract.spec.ts` reads the backend file and fails if the two
 * diverge, so the duplication cannot rot silently.
 *
 * `effective` and `requested` are separate fields on purpose and neither is
 * derived from the other here. A screen that computed one from the other would
 * be unable to show an operator that they disagree — which is exactly the state
 * an operator most needs to see.
 */

export const DEPLOYMENT_ENVIRONMENTS = ['LOCAL', 'ALPHA', 'PRODUCTION'] as const;
export type DeploymentEnvironment = (typeof DEPLOYMENT_ENVIRONMENTS)[number];

export type EnvironmentUnconfirmedReason = 'NOT_SET' | 'NOT_RECOGNISED';

export type AdminOperationsEnvironment =
  | { confirmed: true; environment: DeploymentEnvironment; nodeEnv: string | null }
  | {
      confirmed: false;
      environment: null;
      nodeEnv: string | null;
      reason: EnvironmentUnconfirmedReason;
    };

export type AdminOperationsBlockedReason =
  'ENVIRONMENT_UNCONFIRMED' | 'STORE_UNREADABLE' | 'DEPLOYMENT_VALUE_NOT_TRUE';

export type AdminOperationsSwitchName = 'ASK_PUBLIC_COMPUTE_ENABLED' | 'ASK_R2_ENABLED';
export type AdminOperationsLabelKey = 'pauseNewAiAnswers' | 'stopAskR2Execution';

export interface AdminOperationsChange {
  name: string;
  enabled: boolean;
  setBy: string;
  reason: string | null;
  setAt: string;
}

export interface AdminOperationsSwitch {
  name: AdminOperationsSwitchName;
  labelKey: AdminOperationsLabelKey;
  effective: boolean;
  requested: boolean | null;
  deploymentValueIsLiteralTrue: boolean;
  readable: boolean;
  checkedAt: string;
  lastChange: AdminOperationsChange | null;
  blockedReason: AdminOperationsBlockedReason | null;
}

export interface AdminOperationsState {
  environment: AdminOperationsEnvironment;
  switches: AdminOperationsSwitch[];
  history: AdminOperationsChange[];
  mayOperate: boolean;
  checkedAt: string;
}

export interface AdminOperationsSwitchResult {
  applied: boolean;
  switch: AdminOperationsSwitch;
}

export const ADMIN_OPERATIONS_REASON_MIN = 3;
export const ADMIN_OPERATIONS_REASON_MAX = 280;
