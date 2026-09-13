/**
 * F1.b — the capability NAMES, mirrored for nav filtering. Nothing else.
 *
 * THE RULE THIS FILE EXISTS TO STATE: the role -> capability matrix
 * lives exclusively in the backend, at
 * `backend/src/modules/admin/rbac/capabilities.ts`. This file holds the
 * nine capability strings so the nav manifest can name one per item, and
 * the client only ever reads the `capabilities[]` array that
 * GET /admin/me returns. It never derives a capability from a role, and
 * there is no role -> capability mapping anywhere in `frontend/`.
 *
 * `adminCapabilityParity.spec.ts` reads the backend file directly and
 * fails if these two lists diverge, or if any frontend file grows a
 * role-keyed permission map.
 */
export const ADMIN_CAPABILITY_NAMES = [
  'analytics.view',
  'news.manage',
  'provider.configure',
  'payment.action',
  'ksef.submit',
  'tax.settings',
  'access.manage',
  'support.handle',
  'evidence.export',
] as const;

export type AdminCapability = (typeof ADMIN_CAPABILITY_NAMES)[number];

/** The four role names GET /admin/me can return. Names only — never a permission set. */
export const ADMIN_ROLE_NAMES = ['SUPER_ADMIN', 'ADMIN', 'SUPPORT', 'ANALYST'] as const;

export type AdminRoleName = (typeof ADMIN_ROLE_NAMES)[number];

/**
 * Fail-closed: an unknown capability string from the server is ignored
 * rather than trusted, and an empty list grants nothing.
 */
export function hasCapability(
  granted: readonly string[] | undefined,
  capability: AdminCapability,
): boolean {
  if (!granted) return false;
  return granted.includes(capability);
}
