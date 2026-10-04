/**
 * SEJM-PATH-1 — THE PATH-FAMILY GATE (E1 SEJM-RIGHTS-AND-HOST-ADMISSION-R1 §B3–§B5, CTO ruling 13).
 *
 * The safe-fetch URL gate is HOST-shaped: it checks scheme, userinfo, host, IP literals, denied
 * suffixes, own origins and port, and never the path. For a publisher whose host serves mostly
 * person-level material (the Sejm API: MPs with photos, interpellations, written questions,
 * statements, individual MP votes), admitting the host would admit all of that in one move.
 * This module is the PATH half, and it is an ALLOWLIST, never a denylist: an incomplete
 * denylist fails open, an allowlist fails closed.
 *
 * Shape of a family: an EXACT segment pattern. Every segment is a literal or a typed
 * placeholder, and the request path must have EXACTLY as many segments. There is no prefix
 * match, so admitting `/sejm/{term}/prints` can never admit `/sejm/{term}/prints/123/MP`, and
 * no family can be written that admits "everything under /sejm/term10/".
 *
 * Person surfaces are refused STRUCTURALLY at configuration time: a family naming one of them
 * as a literal segment throws before any fetch exists (`PathFamilyConfigurationRefused`).
 *
 * This module fetches nothing and decides nothing about rights. It authorizes no acquisition.
 */

import { assertRequestCarriesNoCredential } from '@globalnews-ai/shared';

export type PathSegmentPattern =
  | { readonly literal: string }
  /** `term<N>`: a Sejm term, e.g. `term10`. */
  | { readonly placeholder: 'TERM' }
  /** A bare decimal identifier, 1–9 digits. */
  | { readonly placeholder: 'NUMERIC_ID' };

export interface PathFamily {
  /** Stable name, cited in refusals and in the review record. */
  readonly id: string;
  readonly segments: readonly PathSegmentPattern[];
  /** Closed list of query keys this family may carry. Empty = no query string at all. */
  readonly admittedQueryKeys: readonly string[];
}

/** The refusal reason prefix: distinct from every host refusal (`HOST_NOT_THE_GOVERNED_HOST:…`). */
export const PATH_FAMILY_NOT_ADMITTED = 'PATH_FAMILY_NOT_ADMITTED' as const;
/** SEJM-CRED-1: a credential-shaped query key is refused whatever the family says. */
export const CREDENTIAL_IN_QUERY = 'CREDENTIAL_IN_QUERY' as const;

/**
 * Person-oriented surfaces of the Sejm API (E1 C-2). Matched case-insensitively against every
 * LITERAL segment of every configured family; a family naming any of them is refused at
 * construction. Placeholders cannot smuggle them because placeholders are typed, never free text.
 */
export const PERSON_SURFACE_SEGMENTS: readonly string[] = Object.freeze([
  'mp',
  'mps',
  'photo',
  'photos',
  'votings',
  'votes',
  'interpellations',
  'writtenquestions',
  'questions',
  'statements',
  'transcripts',
  'videos',
]);

/**
 * Credential-shaped query keys. ONE list, owned by the shared snapshot contract
 * (`assertRequestCarriesNoCredential`); never re-declared here, so the gate and the evidence
 * store cannot drift apart. Never admitted, even if a family lists them.
 */
function isCredentialKey(key: string): boolean {
  try {
    assertRequestCarriesNoCredential({ providerId: 'path-gate', endpointId: 'path-gate', requestPath: 'p', parameters: [{ key, value: '' }], requestedAt: '1970-01-01T00:00:00Z' });
    return false;
  } catch {
    return true;
  }
}

export class PathFamilyConfigurationRefused extends Error {
  constructor(readonly reason: string) {
    super(`PATH_FAMILY_CONFIGURATION_REFUSED:${reason}`);
    this.name = 'PathFamilyConfigurationRefused';
  }
}

/** Validate families once, at configuration. Returns a frozen copy, or throws. */
export function definePathFamilies(families: readonly PathFamily[]): readonly PathFamily[] {
  const ids = new Set<string>();
  for (const f of families) {
    if (!/^[A-Za-z0-9_.-]{1,64}$/.test(f.id)) throw new PathFamilyConfigurationRefused(`FAMILY_ID_INVALID:${f.id}`);
    if (ids.has(f.id)) throw new PathFamilyConfigurationRefused(`FAMILY_ID_DUPLICATED:${f.id}`);
    ids.add(f.id);
    if (f.segments.length === 0) throw new PathFamilyConfigurationRefused(`FAMILY_EMPTY:${f.id}`);
    for (const s of f.segments) {
      if ('literal' in s) {
        if (!/^[A-Za-z0-9_-]{1,64}$/.test(s.literal)) {
          throw new PathFamilyConfigurationRefused(`LITERAL_SEGMENT_INVALID:${f.id}:${s.literal}`);
        }
        if (PERSON_SURFACE_SEGMENTS.includes(s.literal.toLowerCase())) {
          throw new PathFamilyConfigurationRefused(`PERSON_SURFACE_NOT_ADMISSIBLE:${f.id}:${s.literal}`);
        }
      } else if (s.placeholder !== 'TERM' && s.placeholder !== 'NUMERIC_ID') {
        throw new PathFamilyConfigurationRefused(`PLACEHOLDER_UNKNOWN:${f.id}`);
      }
    }
    for (const k of f.admittedQueryKeys) {
      if (isCredentialKey(k)) throw new PathFamilyConfigurationRefused(`CREDENTIAL_QUERY_KEY:${f.id}:${k}`);
    }
  }
  return Object.freeze(families.map(f => Object.freeze({ ...f, segments: Object.freeze([...f.segments]), admittedQueryKeys: Object.freeze([...f.admittedQueryKeys]) })));
}

export type PathVerdict =
  | { readonly admitted: true; readonly familyId: string }
  | { readonly admitted: false; readonly kind: 'ADDRESS_REFUSED'; readonly reason: string };

const refuse = (detail: string): PathVerdict =>
  Object.freeze({ admitted: false as const, kind: 'ADDRESS_REFUSED' as const, reason: `${PATH_FAMILY_NOT_ADMITTED}:${detail}` });

function segmentMatches(pattern: PathSegmentPattern, segment: string): boolean {
  if ('literal' in pattern) return segment === pattern.literal;
  if (pattern.placeholder === 'TERM') return /^term[1-9][0-9]?$/.test(segment);
  return /^[0-9]{1,9}$/.test(segment);
}

/**
 * Default deny. Admitted only when the normalised path matches exactly one family's exact
 * segment pattern AND every query key is admitted by that family AND no key is credential-shaped.
 */
export function assertPathIsAdmitted(rawUrl: string, families: readonly PathFamily[]): PathVerdict {
  // Dot segments are judged on the RAW path: the URL parser silently resolves `.`/`..` (and
  // `%2e`), so after parsing they are gone. A path that only becomes admissible after
  // normalisation is not a path the caller asked for, and it is refused (E1 §B4.2).
  const rawPath = rawUrl.replace(/^[a-z][a-z0-9+.-]*:\/\/[^/?#]*/i, '').split(/[?#]/)[0] ?? '';
  if (rawPath.split('/').some(s => /^(\.|%2e){1,2}$/i.test(s))) return refuse('DOT_SEGMENT');

  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return refuse('URL_UNPARSEABLE');
  }

  for (const key of url.searchParams.keys()) {
    if (isCredentialKey(key)) {
      return Object.freeze({ admitted: false as const, kind: 'ADDRESS_REFUSED' as const, reason: `${CREDENTIAL_IN_QUERY}:${key}` });
    }
  }

  const raw = url.pathname;
  // Encoded separators and backslashes are refused outright: a path that can be re-split after
  // decoding is not the path that was checked.
  if (/%2f|%5c|\\/i.test(raw)) return refuse('ENCODED_OR_BACKSLASH_SEPARATOR');
  const parts = raw.split('/');
  if (parts[0] !== '') return refuse('NOT_ABSOLUTE');
  const rawSegments = parts.slice(1);
  if (rawSegments.length === 0 || rawSegments.some(s => s === '')) return refuse('EMPTY_SEGMENT');
  const segments: string[] = [];
  for (const s of rawSegments) {
    let decoded: string;
    try {
      decoded = decodeURIComponent(s);
    } catch {
      return refuse('UNDECODABLE_SEGMENT');
    }
    if (decoded === '.' || decoded === '..' || /[/\\]/.test(decoded)) return refuse('DOT_SEGMENT');
    segments.push(decoded);
  }

  if (families.length === 0) return refuse('NO_FAMILY_ADMITTED');

  for (const f of families) {
    if (f.segments.length !== segments.length) continue;
    if (!f.segments.every((p, i) => segmentMatches(p, segments[i]!))) continue;
    for (const key of url.searchParams.keys()) {
      if (!f.admittedQueryKeys.includes(key)) return refuse(`QUERY_KEY_NOT_ADMITTED:${f.id}:${key}`);
    }
    return Object.freeze({ admitted: true as const, familyId: f.id });
  }
  return refuse('NO_MATCHING_FAMILY');
}
