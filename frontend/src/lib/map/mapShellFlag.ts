/**
 * SPATIAL M1a — THE SHELL FEATURE FLAG, AND THE ROLLBACK IT PROTECTS.
 *
 * The existing `WorldMap` stays in the tree, untouched and fully wired. This
 * flag chooses which of the two the World Map route mounts, so rolling back
 * the shell is a configuration change and not a revert.
 *
 * DEFAULT OFF. An unset, misspelled or unparseable value yields the EXISTING
 * map. A flag whose failure mode is "ship the new thing" is not a rollback
 * mechanism, and M1a is a foundation — it should have to be asked for.
 *
 * NEXT_PUBLIC_ because the decision is needed in the browser bundle. The value
 * is inlined at build time, which is why this reads `process.env.<LITERAL>`
 * rather than an indexed lookup: Next only substitutes the literal form.
 */

export type MapShellVariant = 'shell' | 'legacy';

export const MAP_SHELL_FLAG = 'NEXT_PUBLIC_MAP_SHELL' as const;

/** Accepted spellings for ON. Everything else — including 'yes' — is OFF. */
const TRUTHY = new Set(['1', 'true', 'on', 'enabled']);

export function resolveMapShellVariant(raw: string | undefined | null): MapShellVariant {
  return typeof raw === 'string' && TRUTHY.has(raw.trim().toLowerCase()) ? 'shell' : 'legacy';
}

/**
 * The variant for this build.
 *
 * Read through the literal so the bundler can inline it. Wrapped because a
 * component asking "which map?" should not also have to know how Next handles
 * environment variables.
 */
export function mapShellVariant(): MapShellVariant {
  return resolveMapShellVariant(process.env.NEXT_PUBLIC_MAP_SHELL);
}
