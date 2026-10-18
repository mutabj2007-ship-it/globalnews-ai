import { buildSafeFetchPolicy } from '../official-data/official-data.boot';
import type { SafeFetchPolicy } from '../official-data/official-artifact-safe-fetch';
import type { AddressBoundConnector, AddressResolver } from '../official-data/official-artifact-safe-fetch';
import { makeSafeWireFetch } from '../official-data/safe-wire-fetch.node';
import type { WireFetch } from '../official-data/official-data-transport.node';
import { RNP_HOST } from './rnp-listing.parser';
import { RNP_PROVIDER_ID } from './rnp-listing.reader';

/*
  E1 ADDENDUM-06 §1 — Ask's ONE network exception, as a POSITIVE ALLOWLIST enforced inside the network helper.

  C-1/C-2  The allowlist is this code constant (never an environment value): the only provider id is `rnp`, and its
           only host is police.gov.rw. Any other provider id has no governed host and is refused before the network.
  C-4      safe-wire-fetch re-runs the exact-host URL gate on EVERY hop, so a redirect off police.gov.rw is a refusal,
           never a follow.
  C-5      The same gate refuses userinfo in the authority, any scheme but https, and — because the host must equal
           police.gov.rw exactly — a raw IP literal.
  C-6      This file builds the helper; it is invoked only when the lane is enabled (the second, independent gate).

  The byte cap and deadlines are STRICTER than the official-data policy (E1 ADDENDUM-02 §3: ≤ 1 MB, ≤ 10 s).
*/
export const RNP_ALLOWED_HOSTS: readonly string[] = Object.freeze([RNP_HOST]);
export const RNP_WIRE_BYTE_CAP = 1024 * 1024;

export const rnpHostResolver = (providerId: string): string | undefined =>
  providerId === RNP_PROVIDER_ID ? RNP_HOST : undefined;

export function rnpSafeFetchPolicy(ownOrigins: readonly string[]): SafeFetchPolicy {
  return {
    ...buildSafeFetchPolicy(ownOrigins),
    wireByteCap: RNP_WIRE_BYTE_CAP,
    maxRedirectHops: 2,
    totalDeadlineMs: 10_000,
    perHopDeadlineMs: 10_000,
  };
}

export function makeRnpWireFetch(deps: {
  readonly resolver: AddressResolver;
  readonly connector: AddressBoundConnector;
  readonly ownOrigins: readonly string[];
  readonly userAgent: string;
}): WireFetch {
  return makeSafeWireFetch({
    resolver: deps.resolver,
    connector: deps.connector,
    policy: rnpSafeFetchPolicy(deps.ownOrigins),
    resolveHost: rnpHostResolver,
    userAgent: deps.userAgent,
  });
}
