/**
 * F1.a — the deployment kill switch, as a pure function so its
 * fail-closed behaviour is testable without a NestJS container.
 *
 * ADMIN_PLATFORM_ENABLED is ADDITIONAL deployment protection, never a
 * replacement for authentication or authorization. When it is on,
 * RequireAuthGuard, AdminGuard and capability enforcement all still
 * run, unchanged and mandatory.
 *
 * Parsing is deliberately strict: ONLY the exact string "true"
 * (case-insensitive, surrounding whitespace trimmed) enables the
 * platform. "1", "yes", "on", "TRUE " with a trailing newline from a
 * sloppy .env, an empty value, or an unset variable all resolve to
 * DISABLED. A permissive parser here would be a way to turn the admin
 * surface on by accident, which is the one failure mode this switch
 * exists to prevent.
 */
export const ADMIN_PLATFORM_ENABLED_ENV = 'ADMIN_PLATFORM_ENABLED';

export function isAdminPlatformEnabled(rawValue: string | undefined | null): boolean {
  if (typeof rawValue !== 'string') return false;
  return rawValue.trim().toLowerCase() === 'true';
}
