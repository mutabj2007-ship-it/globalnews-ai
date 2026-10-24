import {
  classifyResolvedSet,
  SAFE_FETCH_DENIED_HOST_SUFFIXES,
} from '../../../official-data/official-artifact-safe-fetch';
import type { ResourceAdmitter, ResourceAdmission } from './gdelt-lead.types';

/*
  CTO R165 §GDELT 2 — a lead URL is UNTRUSTED INPUT from a third party, and it stays untrusted even
  behind a source allowlist: an allowlisted host can still be named with userinfo, a literal IP, a
  non-default port or a redirect into the private network. Every refusal here is pure (no I/O); the
  resolved-address check takes the resolver's answer as data, so DNS rebinding is refused by
  re-classifying EVERY address at each hop, never by trusting an earlier answer.

  The address classifier is the one the official-data safe fetch already uses (private, loopback,
  link-local incl. 169.254.169.254 metadata, CGNAT, IPv4-mapped IPv6, ULA, multicast …).
*/

export type LeadUrlVerdict =
  | { readonly admitted: true; readonly url: string; readonly host: string; readonly path: string }
  | { readonly admitted: false; readonly reason: string };

const refuse = (reason: string): LeadUrlVerdict =>
  Object.freeze({ admitted: false as const, reason });

/** https only, no userinfo, no IP-literal host, port 443 only, no denied internal suffix. */
export function checkLeadUrl(rawUrl: string): LeadUrlVerdict {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return refuse('URL_UNPARSEABLE');
  }
  if (url.protocol !== 'https:') return refuse(`SCHEME_NOT_ADMITTED:${url.protocol}`);
  if (url.username !== '' || url.password !== '') return refuse('USERINFO_PRESENT');
  const host = url.hostname.toLowerCase().replace(/\.$/, '');
  if (host === '') return refuse('HOST_EMPTY');
  if (host.startsWith('[') || host.includes(':')) return refuse('LITERAL_IPV6_HOST');
  /* WHATWG URL already normalises 0x7f.1, 2130706433 and 127.1 to dotted quads, so one test covers them */
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return refuse('LITERAL_IPV4_HOST');
  for (const suffix of SAFE_FETCH_DENIED_HOST_SUFFIXES) {
    if (host === suffix || host.endsWith(suffix)) return refuse(`HOST_DENIED_BY_NAME:${suffix}`);
  }
  if (!host.includes('.')) return refuse('HOST_NOT_QUALIFIED');
  if (url.port !== '' && url.port !== '443') return refuse(`PORT_NOT_ADMITTED:${url.port}`);
  url.hash = '';
  url.hostname = host;
  return Object.freeze({ admitted: true as const, url: url.toString(), host, path: url.pathname });
}

/** The canonical form a lead is stored with, or null when the URL is refused. */
export function canonicalLeadUrl(rawUrl: string | null): string | null {
  if (rawUrl === null) return null;
  const verdict = checkLeadUrl(rawUrl);
  return verdict.admitted ? verdict.url : null;
}

/*
  CTO R165 §GDELT 1 — no generic host-as-licence. The admitter's positive answer must name THIS host
  exactly and a path prefix that covers THIS path on a segment boundary ("/world" covers "/world/x",
  not "/worldwide"), with robots ALLOWED and a GET method. A positive answer that does not cover the
  request is treated as a refusal, so an admitter that answers host-wide cannot widen anything.
*/
export function admitResource(
  admit: ResourceAdmitter,
  host: string,
  path: string,
): ResourceAdmission {
  const answer = admit({ host, path, method: 'GET' });
  if (!answer.admitted) return answer;
  const covered =
    answer.host === host &&
    answer.method === 'GET' &&
    answer.robots === 'ALLOWED' &&
    answer.e1PerUseRef.trim() !== '' &&
    answer.pathPrefix.startsWith('/') &&
    (path === answer.pathPrefix ||
      path.startsWith(
        answer.pathPrefix.endsWith('/') ? answer.pathPrefix : `${answer.pathPrefix}/`,
      ));
  return covered
    ? answer
    : Object.freeze({ admitted: false as const, reason: 'RESOURCE_NOT_COVERED' as const });
}

export interface RedirectHop {
  /** the URL this hop requested */
  readonly url: string;
  /** every address the resolver returned for this hop's host */
  readonly resolvedAddresses: readonly string[];
}

export type ChainVerdict =
  | { readonly admitted: true; readonly finalUrl: string; readonly e1PerUseRef: string }
  | { readonly admitted: false; readonly hop: number; readonly reason: string };

export const MAX_LEAD_REDIRECT_HOPS = 3;

/*
  CTO R165 §GDELT 1+2 — every hop of a redirect chain is a NEW request: the URL gate, the resolved
  address set and the per-resource admission are all re-run. A redirect to a private address, to an
  uncleared host, or to an uncovered path on a cleared host refuses the whole chain. Used by a future
  cleared reader; nothing here performs a request.
*/
export function evaluateRedirectChain(
  hops: readonly RedirectHop[],
  admit: ResourceAdmitter,
): ChainVerdict {
  if (hops.length === 0)
    return Object.freeze({ admitted: false as const, hop: 0, reason: 'EMPTY_CHAIN' });
  if (hops.length > MAX_LEAD_REDIRECT_HOPS + 1) {
    return Object.freeze({
      admitted: false as const,
      hop: hops.length - 1,
      reason: 'HOP_LIMIT_EXCEEDED',
    });
  }
  let finalUrl = '';
  let ref = '';
  for (const [index, hop] of hops.entries()) {
    const fail = (reason: string): ChainVerdict =>
      Object.freeze({ admitted: false as const, hop: index, reason });
    const gate = checkLeadUrl(hop.url);
    if (!gate.admitted) return fail(gate.reason);
    const addresses = classifyResolvedSet(hop.resolvedAddresses);
    if (!addresses.admitted) return fail(`ADDRESS_REFUSED:${addresses.reason}`);
    const admission = admitResource(admit, gate.host, gate.path);
    if (!admission.admitted) return fail(admission.reason);
    finalUrl = gate.url;
    ref = admission.e1PerUseRef;
  }
  return Object.freeze({ admitted: true as const, finalUrl, e1PerUseRef: ref });
}
