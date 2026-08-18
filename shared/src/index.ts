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
export * from './officialSources';
export * from './signals';
