import { MAX_FOLLOWED_COUNTRIES } from '@globalnews-ai/shared';

/**
 * R1/T3 — the follow ceiling, re-exported from the shared contract so the
 * backend and any future surface cannot disagree about the number.
 *
 * THIS IS A RESOURCE SAFETY CEILING AND NOTHING ELSE (CTO decision).
 *
 * It exists so one account cannot grow an unbounded account-owned table.
 * It is NOT a Free/Pro/Premium entitlement, there is no tier lookup
 * anywhere in this module, and no code path consults a subscription,
 * a plan, or an upgrade state. If a capacity tier is ever introduced it
 * must be a separate, explicitly authorized decision — this constant must
 * not be quietly repurposed into one, because a limit that started life
 * as a safety bound and became a paywall would be a product change
 * disguised as a refactor.
 */
export const MAX_COUNTRY_FOLLOWS = MAX_FOLLOWED_COUNTRIES;

/** How many follows a single GET returns. Equal to the ceiling, so the
 * list is never a hidden truncation of what the cap already permits. */
export const FOLLOW_LIST_LIMIT = MAX_COUNTRY_FOLLOWS;
