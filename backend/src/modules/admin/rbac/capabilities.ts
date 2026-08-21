/**
 * F1.a — the administrative capability model.
 *
 * Deliberately PURE: no NestJS, no Prisma, no I/O. The role matrix can
 * therefore be executed in a test rather than pattern-matched, the same
 * way E1 isolated selectActiveNewsProviders() from the DI container.
 *
 * This file is the ONE definition of who may do what. AdminGuard
 * enforces it and GET /admin/me hands the derived list to the
 * frontend; nothing is ever re-derived client-side.
 *
 * The matrix reproduces the approved Claude Design Admin Platform role
 * matrix exactly, row for row — including the cell that looks like a
 * mistake and is not: EvidenceExport is granted to ANALYST but denied
 * to SUPPORT. That asymmetry is deliberate and CTO-confirmed (an
 * analyst's job is reporting; a support operator handling individual
 * user data must not be able to bulk-export it). Do not "tidy" it —
 * capabilities.spec.ts fails if you do.
 */

/**
 * The four administrative roles. ANALYST is the enum name for the
 * design's READ-ONLY role — the design's own actor-type vocabulary
 * already uses ANALYST, so this matches the contract rather than
 * inventing a fifth name.
 *
 * A user with NO role is not represented here at all: absence is
 * modelled as `null`, never as a fifth "NONE" member, so there is no
 * value in this union that could ever be mistaken for a permission.
 */
export const ADMIN_ROLES = ['SUPER_ADMIN', 'ADMIN', 'SUPPORT', 'ANALYST'] as const;

export type AdminRoleName = (typeof ADMIN_ROLES)[number];

/**
 * Nine capabilities — one per row of the approved role matrix. No
 * more, no fewer. F1.a exposes no route that consumes any of them
 * except through the AdminOnly() baseline; they exist now so that the
 * enforcement mechanism is complete and proven before any screen or
 * endpoint depends on it.
 */
export const CAPABILITIES = {
  AnalyticsView: 'analytics.view',
  NewsManage: 'news.manage',
  ProviderConfigure: 'provider.configure',
  PaymentAction: 'payment.action',
  KsefSubmit: 'ksef.submit',
  TaxSettings: 'tax.settings',
  AccessManage: 'access.manage',
  SupportHandle: 'support.handle',
  EvidenceExport: 'evidence.export',
} as const;

export type Capability = (typeof CAPABILITIES)[keyof typeof CAPABILITIES];

export const ALL_CAPABILITIES: readonly Capability[] = Object.freeze(
  Object.values(CAPABILITIES) as Capability[],
);

/**
 * The approved matrix, transcribed.
 *
 *  Operation                        SUPER_ADMIN  ADMIN  SUPPORT  ANALYST
 *  View analytics & reports              *         *       *        *
 *  Manage news & sources                 *         *       -        -
 *  Provider configuration                *         -       -        -
 *  Refund / payment action               *         *       -        -
 *  KSeF submit / retry                   *         *       -        -
 *  Tax settings                          *         -       -        -
 *  Change roles / disable account        *         -       -        -
 *  Support tickets & notes               *         *       *        -
 *  Export evidence set                   *         *       -        *
 */
export const ROLE_CAPABILITIES: Readonly<Record<AdminRoleName, readonly Capability[]>> =
  Object.freeze({
    SUPER_ADMIN: Object.freeze([
      CAPABILITIES.AnalyticsView,
      CAPABILITIES.NewsManage,
      CAPABILITIES.ProviderConfigure,
      CAPABILITIES.PaymentAction,
      CAPABILITIES.KsefSubmit,
      CAPABILITIES.TaxSettings,
      CAPABILITIES.AccessManage,
      CAPABILITIES.SupportHandle,
      CAPABILITIES.EvidenceExport,
    ]),
    ADMIN: Object.freeze([
      CAPABILITIES.AnalyticsView,
      CAPABILITIES.NewsManage,
      CAPABILITIES.PaymentAction,
      CAPABILITIES.KsefSubmit,
      CAPABILITIES.SupportHandle,
      CAPABILITIES.EvidenceExport,
    ]),
    SUPPORT: Object.freeze([CAPABILITIES.AnalyticsView, CAPABILITIES.SupportHandle]),
    ANALYST: Object.freeze([CAPABILITIES.AnalyticsView, CAPABILITIES.EvidenceExport]),
  });

/**
 * Fail-closed by construction: `null` (not an administrator) and any
 * value outside ADMIN_ROLES both yield the EMPTY capability set. No
 * branch anywhere treats an unknown role as permissive.
 */
export function capabilitiesFor(role: AdminRoleName | null): readonly Capability[] {
  if (role === null) return [];
  return ROLE_CAPABILITIES[role] ?? [];
}

export function hasCapability(role: AdminRoleName | null, capability: Capability): boolean {
  return capabilitiesFor(role).includes(capability);
}

/**
 * The single trust boundary between a raw database value and the role
 * model. A column value that is not exactly one of ADMIN_ROLES — a
 * future enum member this build does not know about, a manual UPDATE
 * typo, a corrupted row — resolves to `null`, i.e. NOT an
 * administrator. Drift can only ever remove privilege, never grant it.
 */
export function parseAdminRole(value: string | null | undefined): AdminRoleName | null {
  if (typeof value !== 'string') return null;
  return (ADMIN_ROLES as readonly string[]).includes(value) ? (value as AdminRoleName) : null;
}
