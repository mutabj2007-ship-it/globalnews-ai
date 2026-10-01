import type { SourceRole } from '@globalnews-ai/shared';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * ASK MULTI-SOURCE DISCOVERY R2B — GOVERNED SOCIAL ACCOUNT IDENTITY
 * ════════════════════════════════════════════════════════════════════════════
 *
 * A social account is classified ONLY from governed identity, never from what it says about
 * itself in a bio or a display name:
 *
 *   this registry (curated, reviewed)          OFFICIAL_SOCIAL / SOCIAL_REPORT, with the
 *                                              organisation family it belongs to (so an
 *                                              organisation's site and its X account are ONE
 *                                              family for independence);
 *   platform-verified organisation identity    government / organisation verification as the
 *     (X verified_type government/business)    PLATFORM states it → OFFICIAL_SOCIAL, its family
 *                                              the account itself;
 *   an original post by any other account      WITNESS_SOCIAL — a witness claim, never verified;
 *   a repost / quote / unknown origin          DISCOVERY_LEAD — it may lead retrieval to a
 *                                              source; it is never evidence on its own.
 *
 * DELIBERATELY EMPTY. No account is admitted without review; entries are added by the product
 * owner with provenance, exactly like the publisher feed registry. An empty registry is the
 * safe state: every account then falls to the platform-identity rule or below.
 */
export interface GovernedSocialAccount {
  readonly platform: 'x' | 'youtube';
  /** X user id / YouTube channel id — never a mutable handle alone. */
  readonly accountId: string;
  readonly handle: string;
  readonly role: Extract<SourceRole, 'OFFICIAL_SOCIAL' | 'SOCIAL_REPORT'>;
  /** The organisation family (its canonical web host, e.g. "flydubai.com"). */
  readonly family: string;
  readonly provenanceNote: string;
  readonly verifiedAt: string;
}

export const GOVERNED_SOCIAL_ACCOUNTS: readonly GovernedSocialAccount[] = [];

export interface SocialIdentityInput {
  readonly platform: 'x' | 'youtube';
  readonly accountId: string;
  /** X: verified_type as returned by the API ('government' | 'business' | 'blue' | 'none'). */
  readonly platformVerification: string | null;
  /** True when this item reposts / quotes someone else's content. */
  readonly isRepost: boolean;
}

export function classifySocialAccount(
  input: SocialIdentityInput,
  registry: readonly GovernedSocialAccount[] = GOVERNED_SOCIAL_ACCOUNTS,
): { role: SourceRole; family: string | null } {
  const governed = registry.find(
    (entry) => entry.platform === input.platform && entry.accountId === input.accountId,
  );
  if (governed !== undefined) return { role: governed.role, family: governed.family };
  if (input.isRepost) return { role: 'DISCOVERY_LEAD', family: null };
  if (
    input.platform === 'x' &&
    (input.platformVerification === 'government' || input.platformVerification === 'business')
  ) {
    return { role: 'OFFICIAL_SOCIAL', family: null };
  }
  return { role: 'WITNESS_SOCIAL', family: null };
}
