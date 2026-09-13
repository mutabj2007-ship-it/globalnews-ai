/**
 * M64.2 — injection tokens and config helpers for signal providers,
 * mirroring news/providers/provider.tokens.ts and
 * analysis/providers/provider.tokens.ts exactly.
 *
 * No module wiring exists yet (SIGNAL_PROVIDERS/ALL_SIGNAL_PROVIDERS
 * are not registered in any NestJS module in M64.2) — per explicit
 * scope, this milestone prepares the seam without connecting it to a
 * live module.
 */
export const SIGNAL_PROVIDERS = Symbol('SIGNAL_PROVIDERS');
export const ALL_SIGNAL_PROVIDERS = Symbol('ALL_SIGNAL_PROVIDERS');

/**
 * M64.2 — GDELT GEO 2.0 requires no API key (confirmed during the
 * M64.2 audit), so activation is a plain enabled/disabled toggle
 * rather than a key-usability check like isUsableGNewsApiKey/
 * isUsableOpenAiApiKey. ConfigService.get() returns whatever the
 * environment provided as a string (env vars are always strings) —
 * this never assumes a real boolean arrives, and never treats a
 * merely-truthy-looking string other than exactly "true"
 * (case-insensitive, trimmed) as enabled. Undefined, empty,
 * whitespace-only, or any other value is treated as disabled —
 * fails closed, matching this codebase's existing provider-activation
 * philosophy.
 */
export function isGdeltEnabled(value: string | undefined): boolean {
  if (typeof value !== 'string') return false;
  return value.trim().toLowerCase() === 'true';
}
