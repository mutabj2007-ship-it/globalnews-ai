import { definePathFamilies, type PathFamily } from '../official-data/official-path-allowlist';

/**
 * SEJM-PATH-1 / SEJM-CRED-1 — PER-PROVIDER PATH POLICIES, DECLARED BESIDE THE REGISTRY.
 *
 * A provider listed here is PATH-GATED: the safe fetch admits a URL for it only when the path
 * matches one of its families exactly (`official-path-allowlist.ts`), on the first request and on
 * every redirect hop. A provider NOT listed here keeps the pre-existing host-only behaviour; this
 * table only ever narrows.
 *
 * `credential: 'NONE'` makes "no credential travels" an asserted property: the safe fetch refuses
 * at construction to bind any credential to that host.
 *
 * ── pl-sejm ships with ZERO families (CTO Politics ruling 13) ─────────────────────────────────
 * Rights are BLOCKED (E1 §A1, BLOCKED_RIGHTS / RIGHTS_CONFIRMATION_REQUIRED) and no endpoint is
 * yet both documented/verified AND inside approved Politics R1 scope. `/processes` is not on the
 * publisher's documentation page (E1 C-1), so it is NOT assumed. `/prints` is documented but is not
 * admitted until the rights ruling and scope approval exist. An empty list refuses every path. Adding
 * a family is an authorised, reviewed change (E1), never a fetch-time decision.
 */
export interface ProviderPathPolicy {
  readonly providerId: string;
  /** Exact host; must equal the registry entry's baseUrl hostname (asserted in the spec). */
  readonly host: string;
  readonly credential: 'NONE';
  readonly families: readonly PathFamily[];
}

export const OFFICIAL_SOURCE_PATH_POLICIES: readonly ProviderPathPolicy[] = Object.freeze([
  Object.freeze({
    providerId: 'pl-sejm',
    host: 'api.sejm.gov.pl',
    credential: 'NONE' as const,
    families: definePathFamilies([]),
  }),
]);

/** undefined = provider is not path-gated (legacy host-only behaviour). */
export function officialSourcePathFamilyResolver(
  policies: readonly ProviderPathPolicy[] = OFFICIAL_SOURCE_PATH_POLICIES,
): (providerId: string) => readonly PathFamily[] | undefined {
  return (providerId: string) => policies.find(p => p.providerId === providerId)?.families;
}

/** Hosts that must never receive a credential (SEJM-CRED-1). */
export function credentialFreeHosts(policies: readonly ProviderPathPolicy[] = OFFICIAL_SOURCE_PATH_POLICIES): readonly string[] {
  return policies.filter(p => p.credential === 'NONE').map(p => p.host.toLowerCase());
}
