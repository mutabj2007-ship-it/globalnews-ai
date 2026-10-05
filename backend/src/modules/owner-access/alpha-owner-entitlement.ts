import { AsyncLocalStorage } from 'node:async_hooks';
import { Logger } from '@nestjs/common';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * PHONE-FIRST HOME CORRECTION R1 · §2 — THE ALPHA OWNER ENTITLEMENT
 * ════════════════════════════════════════════════════════════════════════════
 *
 * ONE central rule: the Product Owner can test every implemented Alpha capability without the
 * ordinary PRODUCT limits (Ask account/IP day budgets, discussion rate, follow and saved caps).
 *
 * The exemption holds only when ALL of these are true, each established server-side:
 *   1. DEPLOYMENT_ENVIRONMENT is exactly 'ALPHA' (the existing operator-set environment identity,
 *      admin/operations/deployment-environment.ts);
 *   2. RAILWAY_ENVIRONMENT_ID is exactly the Alpha environment id — a value the platform injects,
 *      so a Production deployment can never satisfy rule 1 by a mistaken variable alone;
 *   3. the request's account id — resolved from the session cookie by RequireAuthGuard, never from
 *      an email, header, query, client flag or IP — is exactly the owner's immutable User.id;
 *   4. the owner has not switched on "Preview ordinary user experience" (a cookie that can only
 *      REMOVE the exemption, so tampering with it can never grant anything).
 *
 * Not a role, not configuration that grants anything: no environment variable names the owner, and
 * administrator status stays data (User.adminRole). Signed out → no account id → no exemption.
 *
 * What is NOT exempted, deliberately: authentication and CSRF, global/provider spend ceilings
 * (DEGRADED), bounded concurrency, per-request size, route throttles, and every real source or
 * capability limitation. Usage is still METERED for the owner (the charges are applied with no
 * ceiling), so administrators keep cost visibility. Every use is logged (audit line below).
 */
export const ALPHA_RAILWAY_ENVIRONMENT_ID = '70105bf5-b195-41af-b237-8745c8e76506';
/** mutabj2007@gmail.com on Alpha — resolved 2026-10-05 from User ⋈ UserIdentity(google), read-only. */
export const ALPHA_OWNER_USER_ID = '910b27f3-9e14-487a-bc50-64f5967a4d2d';
export const OWNER_PREVIEW_COOKIE = 'gna_owner_preview';

export type OwnerExemptControl =
  | 'ask-account-day'
  | 'ask-ip-day'
  | 'discussion-rate'
  | 'follow-cap'
  | 'saved-cap';

export interface OwnerAccessEnv {
  readonly DEPLOYMENT_ENVIRONMENT?: string;
  readonly RAILWAY_ENVIRONMENT_ID?: string;
}

/** Rules 1 + 2: is this process the real Alpha deployment? Exact matches, no trimming. */
export function isAlphaDeployment(env: OwnerAccessEnv = process.env): boolean {
  return env.DEPLOYMENT_ENVIRONMENT === 'ALPHA' && env.RAILWAY_ENVIRONMENT_ID === ALPHA_RAILWAY_ENVIRONMENT_ID;
}

/** Rules 1–3: is this server-resolved account the verified Alpha owner? */
export function isAlphaOwnerAccount(accountId: string | null | undefined, env: OwnerAccessEnv = process.env): boolean {
  return typeof accountId === 'string' && accountId === ALPHA_OWNER_USER_ID && isAlphaDeployment(env);
}

export interface OwnerAccessState {
  /** Server-resolved account id of this request (RequireAuthGuard), or null. */
  readonly accountId: string | null;
  /** The owner chose "Preview ordinary user experience". */
  readonly previewOrdinary: boolean;
}

/** Per-request state, set by OwnerAccessInterceptor after guards resolved request.user. */
export const ownerAccessContext = new AsyncLocalStorage<OwnerAccessState>();

export type OwnerAccessMode = 'NOT_OWNER' | 'UNRESTRICTED' | 'ORDINARY_PREVIEW';

export function ownerAccessMode(
  accountId: string | null | undefined,
  previewOrdinary: boolean,
  env: OwnerAccessEnv = process.env,
): OwnerAccessMode {
  if (!isAlphaOwnerAccount(accountId, env)) return 'NOT_OWNER';
  return previewOrdinary ? 'ORDINARY_PREVIEW' : 'UNRESTRICTED';
}

const audit = new Logger('AlphaOwnerEntitlement');

/**
 * Rules 1–4 for `accountId` in the CURRENT request. The id the limit is about must equal the id the
 * request authenticated as — a service cannot exempt some other account by passing its id.
 */
export function ownerExemptionApplies(
  accountId: string | null | undefined,
  control: OwnerExemptControl,
  env: OwnerAccessEnv = process.env,
): boolean {
  const state = ownerAccessContext.getStore();
  if (state === undefined || state.accountId === null || state.accountId !== accountId) return false;
  if (ownerAccessMode(accountId, state.previewOrdinary, env) !== 'UNRESTRICTED') return false;
  audit.log(`alpha-owner exemption applied control=${control} account=${accountId}`);
  return true;
}
