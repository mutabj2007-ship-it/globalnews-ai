import type { ReferenceProviderEntry } from '@globalnews-ai/shared';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * ASK R2 CONSOLIDATED INTEGRATION R1 · GATE D — REFERENCE_PROVIDERS
 * ════════════════════════════════════════════════════════════════════════════
 *
 * The dedicated reference seam (contract §6, Main R1.1 SQ-22). A SEPARATE array from
 * `OFFICIAL_SOURCES`, of a type that cannot enter it: Wikipedia is never an
 * OfficialSourceEntry, never a member of OFFICIAL_SOURCES, never an OfficialSourceClass,
 * and never a substitute for a required OFFICIAL leg.
 *
 * REGISTERED, NOT ACTIVATED. `activation.enabled` is the literal type `false`, so this
 * file cannot switch it on by editing a boolean; enabling it is a type change that must
 * be reviewed. Every gate that blocks activation is named in `blockedBy`:
 *
 *   QQ-9   EN/PL live technical qualification (A's six probes) — `tooling/reference-probes`
 *          runs the equivalents; the results are reported, not treated as activation
 *   PB-8   Product/Legal: attribution and licence; the two User-Agent placeholders
 *   PC-11  D-1 ASK-SCOPE-RULING (Main R1.1, verbatim in the input register): its effect
 *   PB-6   is a SMALLER capability registry. Until it is ruled this registry holds ONE
 *          entry and no executor — the narrower scope the register records.
 *
 * `limits` are the configured transport bounds; they are consumed by the Wikipedia
 * client and can be tightened without code changes elsewhere.
 */
export const WIKIPEDIA_REFERENCE_PROVIDER: ReferenceProviderEntry = Object.freeze({
  kind: 'REFERENCE_PROVIDER',
  role: 'REFERENCE',
  id: 'wikipedia',
  sourceKey: 'wikipedia',
  editions: Object.freeze([
    Object.freeze({ language: 'en', host: 'en.wikipedia.org' }),
    Object.freeze({ language: 'pl', host: 'pl.wikipedia.org' }),
  ]),
  activation: Object.freeze({
    enabled: false,
    blockedBy: Object.freeze(['QQ-9', 'PB-8', 'PC-11', 'PB-6']),
  }),
  readiness: 'NOT_QUALIFIED',
  attribution: Object.freeze({
    displayName: 'Wikipedia',
    licenseId: 'CC-BY-SA-4.0',
    licenseConfirmation: 'CONFIRM_AT_ACTIVATION',
    attributionRequired: true,
  }),
  volatility: Object.freeze({
    eligible: 'STABLE_BACKGROUND_ONLY',
    mayVerifyCurrentStatus: false,
    maySatisfyOfficial: false,
  }),
  identity: Object.freeze({
    canonicalPage: 'EDITION_AND_PAGE_ID',
    version: 'REVISION_ID',
    sourceTimestamp: 'PROVIDER_RESPONSE',
  }),
  limits: Object.freeze({
    maxRequestsPerSecond: 5,
    maxConcurrency: 2,
    backoffBaseMs: 500,
    backoffMaxMs: 8000,
    maxAttempts: 3,
    honourRetryAfter: true,
    cacheTtlSeconds: 86_400,
  }),
  userAgentTemplate: 'GlobalNewsAI-Reference/1.0 (+https://{PRODUCT_DOMAIN}; {OPERATIONS_CONTACT})',
}) as ReferenceProviderEntry;

export const REFERENCE_PROVIDERS: readonly ReferenceProviderEntry[] = Object.freeze([
  WIKIPEDIA_REFERENCE_PROVIDER,
]);

/** The governed transport id of one edition, e.g. `wikipedia-pl`. */
export function referenceTransportId(entry: ReferenceProviderEntry, language: string): string {
  return `${entry.id}-${language}`;
}

/**
 * Host resolver for the governed transport (`ProviderHostResolver`). Resolves ONLY the
 * editions registered above; any other id is undefined, and the safe fetch then refuses
 * before the network.
 */
export function referenceHostResolver(
  providers: readonly ReferenceProviderEntry[] = REFERENCE_PROVIDERS,
): (providerId: string) => string | undefined {
  return (providerId: string): string | undefined => {
    for (const p of providers) {
      for (const e of p.editions) {
        if (referenceTransportId(p, e.language) === providerId) return e.host;
      }
    }
    return undefined;
  };
}

/** Whether ANY reference provider is active. Always false in this candidate. */
export function anyReferenceProviderActive(
  providers: readonly ReferenceProviderEntry[] = REFERENCE_PROVIDERS,
): boolean {
  return providers.some((p) => p.activation.enabled);
}
