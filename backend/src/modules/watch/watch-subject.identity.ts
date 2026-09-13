import { createHash } from 'node:crypto';
import {
  WATCH_SUBJECT_TYPES_BY_SURFACE,
  normalizeQuery,
  type WatchSubject,
  type WatchSubjectType,
  type WatchSurface,
} from '@globalnews-ai/shared';

/**
 * WATCH SUBJECT IDENTITY — CONTENT-ADDRESSED, OWNERLESS, DETERMINISTIC.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THE ID IS DERIVED AND NOT ISSUED
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * The obvious design is an auto-increment row id. It cannot be used here, and
 * not merely because there is no table yet: an ISSUED id makes two callers
 * watching the SAME THING hold two different identities, so the system cannot
 * tell that one retrieval would serve both. Content-addressing makes sameness a
 * property of the subject rather than of who asked first.
 *
 * It also means the id a client holds today still joins to the row that stores
 * it later. Nothing a caller holds is invalidated when persistence arrives.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHAT IS DELIBERATELY NOT IN THE HASH
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * No user, no session, no tenant, no plan. A subject is WHAT is watched; WHO
 * watches it is ownership, and ownership is a separate lane. Mixing an owner
 * into this hash would make the same subject un-shareable between surfaces and
 * would quietly embed an auth model in a file that must not contain one.
 *
 * No timestamp either. An id that changes with the clock is not an identity.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE R2 CORRECTION, AND WHY IT HAD TO HAPPEN NOW
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * The first version modelled a subject as GEOGRAPHY | QUERY | GEOGRAPHY_QUERY,
 * which was map-biased: an ACTOR and an INDICATOR both collapsed into "query",
 * so the one product-wide watchboard had nothing to group or filter by.
 *
 * Fixing it changes the id prefix, so every previously derived id shifts. That
 * is acceptable exactly once, and this is the moment: NOTHING IS PERSISTED. No
 * row, no cursor and no watchboard entry exists to migrate. The same correction
 * after the persistence lane lands would be a data migration instead of a type
 * change.
 */

/** The root of the geographic ladder. Not a gazetteer record — the whole world. */
export const WATCH_WORLD_GEOGRAPHY_ID = 'world:earth';

export interface WatchSubjectInput {
  readonly surface: WatchSurface;
  readonly subjectType: WatchSubjectType;
  /** A `geographyId` from the geo ladder, or the world root. */
  readonly geographyId?: string;
  /** Raw user text. Normalized here, so a caller never has to pre-clean it. */
  readonly query?: string;
  /** What a surface displays. Derived from the parts when absent. */
  readonly label?: string;
}

export type WatchSubjectRefusal = 'TYPE_NOT_VALID_FOR_SURFACE' | 'SUBJECT_HAS_NO_CONTENT';

export interface WatchSubjectResult {
  readonly subject: WatchSubject | null;
  readonly reason?: WatchSubjectRefusal;
  readonly detail?: string;
}

/**
 * A short, stable digest. Twelve hex characters is 48 bits — ample for a space
 * of watch subjects, and short enough to read in a log line.
 *
 * THE SEPARATOR IS NOT COSMETIC. Hashing the two fields concatenated would make
 * ('country:RWA', 'x') and ('country:RW', 'Ax') collide into one id. The unit
 * separator (U+001F) cannot occur in a geographyId or in a normalized query, so
 * the encoding is unambiguous.
 */
const FIELD_SEPARATOR = '\u001f';

function digest(parts: readonly string[]): string {
  return createHash('sha256').update(parts.join(FIELD_SEPARATOR)).digest('hex').slice(0, 12);
}

/**
 * Build a subject, or refuse.
 *
 * TWO REFUSALS, BOTH DELIBERATE. R2 §17 tabulates which subject types belong to
 * which surface, so an INSTRUMENT on the MAP surface is not a subject with an
 * odd type — it is a caller error, and minting an id for it would put a
 * meaningless row on the one shared watchboard. And a subject with neither a
 * geography nor a descriptor identifies nothing: hashing two empty strings
 * would give every such call the same id.
 */
export function deriveWatchSubject(input: WatchSubjectInput): WatchSubjectResult {
  const allowed = WATCH_SUBJECT_TYPES_BY_SURFACE[input.surface];

  if (!allowed || !allowed.includes(input.subjectType)) {
    return {
      subject: null,
      reason: 'TYPE_NOT_VALID_FOR_SURFACE',
      detail: `Part IV v1.2 R2 section 17 does not list ${input.subjectType} under the ${input.surface} surface. Valid types: ${(allowed ?? []).join(', ')}.`,
    };
  }

  const geographyId = input.geographyId?.trim() || undefined;

  /*
   * THE SAME NORMALIZER THE RETRIEVAL PATH USES, not a second one.
   *
   * If Watch normalized queries its own way, "flooding in  Rwanda" could
   * produce one subject id and a different retrieval key, so a watch would
   * silently monitor something other than what it searched. One normalizer, one
   * meaning. Case folding is applied on top because "Flooding" and "flooding"
   * are the same subject and differ only in how they were typed.
   */
  const normalized = input.query?.trim()
    ? normalizeQuery(input.query).normalizedQuery.toLowerCase()
    : undefined;
  const normalizedQuery = normalized && normalized.length > 0 ? normalized : undefined;

  if (!geographyId && !normalizedQuery) {
    return {
      subject: null,
      reason: 'SUBJECT_HAS_NO_CONTENT',
      detail:
        'A subject needs a geography, a descriptor, or both. With neither there is nothing to monitor and nothing to address.',
    };
  }

  /*
   * SURFACE AND TYPE ARE BOTH INSIDE THE HASH, not only in the prefix. The same
   * words watched as an ACTOR and as a SITUATION are two different assignments
   * and must not share an id; if only the prefix carried them, a consumer that
   * indexed on the digest alone would silently merge the two.
   */
  const subjectId = [
    'watch',
    input.surface.toLowerCase(),
    input.subjectType.toLowerCase().replace(/_/g, '-'),
    digest([input.surface, input.subjectType, geographyId ?? '', normalizedQuery ?? '']),
  ].join(':');

  return {
    subject: {
      subjectId,
      surface: input.surface,
      subjectType: input.subjectType,
      geographyId,
      normalizedQuery,
      label:
        input.label?.trim() ||
        [geographyId, normalizedQuery].filter(Boolean).join(' · ') ||
        input.subjectType,
    },
  };
}

/**
 * Two subjects are the same subject when their ids match, and nothing else is
 * compared — because nothing else is identity. Labels differ between surfaces
 * and must never make two watches of one thing look like two things.
 */
export function isSameWatchSubject(a: WatchSubject, b: WatchSubject): boolean {
  return a.subjectId === b.subjectId;
}
