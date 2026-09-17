import {
  type EconomyClaimKind,
  type OfficialSourceClass,
  type SourceProvenance,
  economyEvidenceRoleFor,
} from '@globalnews-ai/shared';
import { getOfficialSourceById } from '../official-sources/official-source-registry';

/**
 * ECON-DATA-CONTRACT-ADAPT-1 - SOURCE CLASS, BOUND TO THE ACCEPTED SHARED
 * CONTRACT.
 *
 * `EconomyClaimKind` and the claim-kind to evidence-role mapping now come from
 * shared. What stays here is what Main ruled stays here, and the reason is the
 * same in each case: it depends on the REGISTRY, which is backend state.
 *
 *   `getOfficialSourceById`  - the registry lookup itself
 *   `sourceTypeFor`          - depends on whether the publisher is registered
 *   `SourceProvenance` assembly
 *
 * -- THE DISTINCTION THIS STILL PROTECTS -----------------------------------
 *
 * "The National Bank of Rwanda is a CENTRAL_BANK" is a fact about an
 * institution and is permanent. "This document is a primary record" is a fact
 * about a DOCUMENT and is not. The same central bank publishes its own rate
 * decision (a primary record of its own act), a commentary on another country's
 * inflation (reporting), and a statistical bulletin (reference data). Pinning
 * one class to the institution and reusing it for everything it ever says would
 * upgrade the commentary to the authority of the decision.
 *
 * `authorityClass` is therefore the institutional fact, attached only when the
 * institution is actually registered; `evidenceRole` is the per-record fact,
 * now derived by the shared `economyEvidenceRoleFor`.
 *
 * NO TRANSLATION HAPPENS HERE. `language` is the language the record was
 * PUBLISHED in and is passed through untouched. Economy adds no translation
 * layer, and the source-language / display-language boundary the platform
 * already maintains is the one that applies.
 */

/** Re-exported so backend consumers bind to ONE definition of the vocabulary. */
export type { EconomyClaimKind };

/**
 * Compose the platform's provenance for one Economy record.
 *
 * The evidence role comes from the shared contract; the registry lookup and the
 * source-type decision stay here, because both need the registry.
 */
export function economySourceProvenance(input: {
  claimKind: EconomyClaimKind;
  /** Registry id, when the publisher is a registered institution. */
  officialSourceId?: string;
  providerId?: string;
  /** Canonical URL of the record itself. */
  sourceUrl?: string;
  /** Language as published. Never normalized here. */
  language?: string;
  /** ISO-8601, when THIS retrieval obtained it. */
  retrievedAt?: string;
}): SourceProvenance {
  const entry = input.officialSourceId ? getOfficialSourceById(input.officialSourceId) : undefined;

  const authorityClass: OfficialSourceClass | undefined = entry?.authorityClass;

  return {
    sourceType: sourceTypeFor(input.claimKind, Boolean(entry)),
    ...(input.providerId === undefined ? {} : { providerId: input.providerId }),
    ...(entry === undefined ? {} : { institution: entry.name, jurisdiction: entry.countryCode }),
    ...(input.language === undefined ? {} : { language: input.language }),
    ...(input.sourceUrl === undefined ? {} : { sourceUrl: input.sourceUrl }),
    ...(input.retrievedAt === undefined ? {} : { retrievedAt: input.retrievedAt }),
    evidenceRole: economyEvidenceRoleFor(input.claimKind),
    ...(authorityClass === undefined ? {} : { authorityClass }),
  };
}

/**
 * A statistical release from a registered institution is PUBLIC_DATA; the same
 * claim kind from an unregistered publisher is not silently promoted to it.
 *
 * STAYS BACKEND-LOCAL because it reads registration state, which is a property
 * of this deployment's registry rather than of the claim.
 */
function sourceTypeFor(kind: EconomyClaimKind, registered: boolean): SourceProvenance['sourceType'] {
  if (kind === 'REPORTING_ON_ECONOMY') return 'NEWS_PROVIDER';
  if (kind === 'STATISTICAL_RELEASE') return registered ? 'PUBLIC_DATA' : 'NEWS_PROVIDER';
  if (kind === 'POLICY_DECISION_RECORD') return registered ? 'OFFICIAL_SOURCE' : 'NEWS_PROVIDER';

  return 'NEWS_PROVIDER';
}
