/**
 * @globalnews-ai/shared
 *
 * This package is the single source of truth for types, interfaces,
 * enums, and constants shared between the `frontend` and `backend`
 * workspaces. It contains NO business logic in Sprint 1 — it exists
 * purely as project-foundation scaffolding.
 *
 * Example of future usage (Sprint 2+):
 *   export interface Article { id: string; title: string; ... }
 *   export enum UserRole { ADMIN, EDITOR, VIEWER }
 */

export const SHARED_PACKAGE_NAME = '@globalnews-ai/shared';

export * from './news';
export * from './analysis';
export * from './analysis-budget';
export * from './countries';
export * from './query-normalization';
export * from './geo-fuzzy-resolver';
export * from './countryDisplayName';
export * from './officialSources';
/*
  PUBLISHER FEEDS RECOVERY R1 — the recovered C55 `SourceType`, plus the one
  corroboration rule the ruling requires. Placed beside './officialSources'
  because the two describe the same axis: who is speaking, and whether they can
  confirm each other.
*/
export * from './source-type';

/*
  B3.1 — the provenance structures the Economy read model needs. Recovered from
  canonical C55 WITHOUT its `SourceType` declaration, which './source-type'
  above already owns; the two unions were measured equivalent first. Placed
  after it so the dependency direction is visible in the barrel itself.
*/
export * from './source-provenance';

/*
  B5-A — OAUTH V1 frozen state set: cancelled | failed.

  Declared in shared because the BACKEND writes the auth_error parameter and the
  FRONTEND reads it; a second copy of the admissible set would be a second
  answer to one question. isAuthErrorCode is the only admission test on either
  side, which is what makes repeated/array/object query shapes inert without a
  special case for each.
*/
export * from './auth-error';

/*
  B3.1 — LANG-UI-7 display-locale TYPES only. Recovering them activates no
  language: the SELECTABLE registry is a separate, frontend-owned deployment
  fact (lib/i18n/languages.ts), and it remains ['en','pl'].
*/
export * from './language';

/*
  B4-A — the governed Economy read model. C55 promoted it into shared/src to
  settle the C36 Gate 4 conflict (Option 1), adopting the backend value-semantics
  vocabulary with a TOTAL, transitional ECONOMY_LEGACY_UI_* map for the old
  frontend names. Both lanes bind here; neither declares its own axes.
*/
export * from './economy';
export * from './signals';
export * from './support';
export * from './follows';
export * from './storyIdentity';

/*
  WATCH TYPES ONLY -- MAIN-FINAL-CORRECTED-ALPHA-CONVERGENCE-1, PO ruling 5.

  Exported so the accepted geography-ladder contract spec can be restored:
  `administrative-ladder.contract.spec.ts` depends on `deriveScopeChain`, which
  depends on these types. THIS EXPORTS TYPES AND CONSTANTS, NOTHING ELSE --
  there is no WatchModule, no controller, no scheduler and no route in this
  candidate, and Watch remains Stage 0. Restoring an executable geography
  contract is not activating Watch, and `WATCH_RUNTIME_ACTIVE` in the frontend
  is still `false`.
*/
export * from './watch';

/*
  CONFLICT + SPECIALIST CLAIM BOUNDARY -- forward-ported from canonical under
  PO ruling 3. These are the shared vocabulary the specialist claim registry and
  ConflictClaimModule are typed against; both files are byte-identical to the
  accepted authority and neither imports anything.
*/
export * from './specialist-claim';
export * from './conflict';
export * from './market';
export * from './official-data/snapshot';
export * from './official-data/snapshot-admission';
export * from './official-data/json-strict';
export * from './official-data/transport';
export * from './official-data/parser-registry';
export * from './official-data/admission-evaluator';
