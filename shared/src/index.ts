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
export * from './countries';
export * from './query-normalization';
export * from './geo-fuzzy-resolver';
export * from './countryDisplayName';

// BETA-SIMPLE-ASK-SAND-1 — compute classification / Sand metering (§5,§8,§9,§11,§13,§14)
// and Ask Conversational V2 (§3) contracts. Appended, so a convergence
// merge with any other lane that also appends here is a trivial textual
// resolution rather than a conflict over reordered exports.
export * from './compute';
export * from './ask';
