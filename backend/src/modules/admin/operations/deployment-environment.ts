import { ConfigService } from '@nestjs/config';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * ADMIN OPERATIONS R1 — VERIFIED ENVIRONMENT IDENTITY
 * ════════════════════════════════════════════════════════════════════════════
 *
 * An operator about to stop new AI answers for every reader must know which
 * deployment they are looking at. `NODE_ENV` cannot answer that: it reads
 * `production` in Alpha AND in Production, so a screen labelled from it would
 * call Alpha "Production" — the most dangerous mislabel this surface can make.
 *
 * So identity comes from its own deployment variable, and it is VALIDATED
 * rather than displayed. The comparison is exact, in the shape the landed
 * switch parser uses (KS-6): no trim, no case-fold, no coercion. 'alpha',
 * ' ALPHA', 'Alpha' and 'prod' are all UNCONFIRMED, because a value nobody
 * deliberately set should never resolve to a confident label.
 *
 * UNCONFIRMED IS NOT A DISPLAY STATE. It refuses writes (see the service). A
 * screen that cannot say where it is pointing must not be able to change
 * anything there.
 */

export const DEPLOYMENT_ENVIRONMENT_VAR = 'DEPLOYMENT_ENVIRONMENT';

/** The deployments this platform distinguishes. Extending it is a deliberate edit. */
export const DEPLOYMENT_ENVIRONMENTS = ['LOCAL', 'ALPHA', 'PRODUCTION'] as const;
export type DeploymentEnvironment = (typeof DEPLOYMENT_ENVIRONMENTS)[number];

export type EnvironmentIdentity =
  | {
      readonly confirmed: true;
      readonly environment: DeploymentEnvironment;
      readonly nodeEnv: string | null;
    }
  | {
      readonly confirmed: false;
      readonly environment: null;
      readonly nodeEnv: string | null;
      readonly reason: EnvironmentUnconfirmedReason;
    };

export type EnvironmentUnconfirmedReason = 'NOT_SET' | 'NOT_RECOGNISED';

export function isDeploymentEnvironment(value: unknown): value is DeploymentEnvironment {
  return (
    typeof value === 'string' && (DEPLOYMENT_ENVIRONMENTS as readonly string[]).includes(value)
  );
}

/**
 * `nodeEnv` is carried for context only. It is never the identity, and the
 * screen must not fall back to it: a caller that wants the label reads
 * `environment`, which is `null` unless the deployment said so explicitly.
 */
export function resolveEnvironmentIdentity(
  get: (name: string) => string | undefined,
): EnvironmentIdentity {
  const nodeEnv = get('NODE_ENV') ?? null;
  const raw = get(DEPLOYMENT_ENVIRONMENT_VAR);
  if (raw === undefined || raw === '') {
    return { confirmed: false, environment: null, nodeEnv, reason: 'NOT_SET' };
  }
  if (!isDeploymentEnvironment(raw)) {
    return { confirmed: false, environment: null, nodeEnv, reason: 'NOT_RECOGNISED' };
  }
  return { confirmed: true, environment: raw, nodeEnv };
}

export function environmentIdentityFrom(config: ConfigService): EnvironmentIdentity {
  return resolveEnvironmentIdentity((name) => config.get<string>(name));
}
