import {
  RETRIEVAL_DIAGNOSTICS_SCHEMA,
  RIGHTS_DECISION_POINTS,
  RELEVANCE_MODES,
  KNOWN_REASON_CODES,
} from './retrieval-trace';
import { E1_USES, type RetrievalDiagnostics } from './retrieval-diagnostics';
import type { RightsExclusionReason } from '../rights/source-use-policy';

/*
  RETRIEVAL R1 · T1.1 — THE WRITE-TIME ALLOWLIST FOR THE PERSISTED DIAGNOSTIC ENVELOPE.

  E1-08 §4.1 / CTO R2 Decision 2. What reaches StoredResult.payload is BUILT here, field by field,
  from one immutable schema: a field that is not in RETRIEVAL_DIAGNOSTICS_FIELDS cannot be written,
  whatever the in-memory object carries. Every leaf is validated against a closed vocabulary or a
  bounded shape; a value that fails is written as null (or folded into 'unrecognised' for a code
  map) and COUNTED — it fails closed and is never passed through.

  SIZE. The serialised envelope is at most 8 KiB of UTF-8. When it would be larger, detail is shed
  in fixed, recorded steps (persisted.overflowLevel): the per-attempt and per-search rows are cut
  first and their *Truncated counters raised by exactly what was cut. The operation-level totals,
  analysis-stage counts, causes and invariants are computed BEFORE any cut and are never reduced,
  so an overflow can never turn a count into a false zero.
*/

export const RETRIEVAL_DIAGNOSTICS_MAX_BYTES = 8192;

type Rule =
  | { readonly t: 'count'; readonly nullable?: boolean }
  | { readonly t: 'bool' }
  | { readonly t: 'enum'; readonly values: readonly string[]; readonly nullable?: boolean }
  | {
      readonly t: 'pattern';
      readonly re: RegExp;
      readonly nullable?: boolean;
      readonly optional?: boolean;
    }
  | { readonly t: 'null' }
  | {
      readonly t: 'object';
      readonly fields: Readonly<Record<string, Rule>>;
      readonly nullable?: boolean;
    }
  | { readonly t: 'list'; readonly of: Rule; readonly max: number }
  | {
      readonly t: 'countMap';
      readonly key: (key: string) => boolean;
      readonly maxKeys: number;
      readonly nullable?: boolean;
    }
  | { readonly t: 'useState' };

const UNRECOGNISED = 'unrecognised';

const RIGHTS_EXCLUSION_REASONS = [
  'RIGHTS_PROHIBITED',
  'RIGHTS_RESTRICTED',
  'RIGHTS_NOT_CLEARED_FOR_AI',
  'PROVIDER_RIGHTS_NOT_CLEARED',
  'SOCIAL_RIGHTS_NOT_REVIEWED',
  'UNKNOWN_PROVENANCE',
  /* MASTER CTO R4 · P0 #86 */
  'PUBLISHER_RIGHTS_HOLD',
] as const satisfies readonly RightsExclusionReason[];

const ATTEMPT_OUTCOMES = [
  'SUCCESS',
  'ZERO_RAW',
  'RATE_LIMIT',
  'TIMEOUT',
  'QUOTA',
  'AUTH',
  'NETWORK',
  'MALFORMED',
  'BAD_REQUEST',
  'UNAVAILABLE',
  'BUDGET_SKIPPED',
  'NOT_AWAITED',
  'UNKNOWN',
] as const;

const EMPTY_CAUSES = [
  'NOT_IN_ENABLED_COVERAGE',
  'NOT_RIGHTS_CLEARED',
  'PROVIDER_NOT_ASKED',
  'PROVIDER_EMPTY',
  'PROVIDER_FAILED_RATE_LIMIT',
  'PROVIDER_FAILED_TIMEOUT',
  'PROVIDER_FAILED_QUOTA',
  'PROVIDER_FAILED_AUTH',
  'PROVIDER_FAILED_NETWORK',
  'PROVIDER_FAILED_MALFORMED',
  'PROVIDER_FAILED_BAD_REQUEST',
  'PROVIDER_FAILED_UNAVAILABLE',
  'PROVIDER_FAILED_NOT_AWAITED',
  'PROVIDER_FAILED_UNKNOWN',
  'LANGUAGE_UNSUPPORTED_BY_PROVIDER',
  'OUTSIDE_WINDOW',
  'RELEVANCE_REJECTED',
  'GEO_CONTRADICTION',
  'RIGHTS_WITHHELD',
  'RETAINED_BUT_NOT_INDEXED',
  'INCOMPLETE_CHECK',
] as const;

const GEO_VERDICTS = [
  'ARTICLE_COUNTRY_UNKNOWN',
  'CONTRADICTS_QUERY_COUNTRY',
  'ALSO_ARTICLE_COUNTRY_UNKNOWN',
  'ALSO_CONTRADICTS_QUERY_COUNTRY',
] as const;

const RETAINED_READ_METHODS = [
  'findRetainedByQuery',
  'findRetainedHeadlines',
  'findRetainedByCountry',
] as const;

/** The only `unobserved` statements the builder makes (retrieval-diagnostics.ts). */
export const UNOBSERVED_STATEMENTS = Object.freeze([
  'displayed (client-side rendering)',
  'stored rows excluded by the rights WHERE clause (enforce-by-absence; never returned to the service)',
  'rights decisions made outside the analysis run (e.g. the recent-reporting METADATA listing)',
  'modelInput (no model call on this operation)',
  'cited (no validated answer on this operation)',
  'rows actually written by persistMany (DB upsert; only the request count is observed)',
  'entries beyond the trace caps (see *Truncated)',
  'entries beyond the persisted size bound',
]);

const ISO_TIME = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})?)?$/;
const LANG = /^[a-z]{2,3}(-[A-Za-z]{2,4})?$/;
const PROVIDER_ID = /^[a-z0-9][a-z0-9._-]{0,31}$/;
const FINGERPRINT = /^[0-9a-f]{16}$/;
const ISO3 = /^[A-Z]{3}$/;
/** Cause qualifiers are built in code from provider ids, language pairs, ISO3 codes and counts. */
const CAUSE_DETAIL = /^[A-Za-z0-9:_>.,\- ]{1,64}$/;
/** Invariant messages are built in code from ordinals, counts and fixed words. */
const VIOLATION = /^[A-Za-z0-9#:<>=!.,_ -]{1,120}$/;

const count = { t: 'count' } as const;
const countOrNull = { t: 'count', nullable: true } as const;
const langOrNull = { t: 'pattern', re: LANG, nullable: true } as const;
const inSet = (values: readonly string[]) => (key: string) => values.includes(key);

const RIGHTS_DECISION: Rule = {
  t: 'object',
  nullable: true,
  fields: {
    evaluated: count,
    allowedCleared: countOrNull,
    allowedPendingReview: countOrNull,
    excluded: count,
  },
};

/**
 * THE CLOSED FIELD LIST (E1-08 §4.1, condition 4). Frozen: a new field cannot enter the persisted
 * payload without changing this declaration (and its review).
 */
export const RETRIEVAL_DIAGNOSTICS_FIELDS: Readonly<Record<string, Rule>> = deepFreeze({
  schema: { t: 'enum', values: [RETRIEVAL_DIAGNOSTICS_SCHEMA] },
  reuse: { t: 'enum', values: ['NONE', 'ANALYSIS_CACHE', 'IN_FLIGHT_JOIN'] },
  attempts: {
    t: 'list',
    max: 40,
    of: {
      t: 'object',
      fields: {
        ordinal: count,
        searchOrdinal: countOrNull,
        providerId: { t: 'pattern', re: PROVIDER_ID },
        capability: { t: 'enum', values: ['search', 'top-headlines', 'category'] },
        tier: { t: 'enum', values: ['PRIMARY', 'FALLBACK', 'RESCUE'] },
        initiatedAt: { t: 'pattern', re: ISO_TIME, nullable: true },
        durationMs: countOrNull,
        outcome: { t: 'enum', values: ATTEMPT_OUTCOMES },
        rawFetchedCount: countOrNull,
        requestedLang: langOrNull,
        sentLang: langOrNull,
        lateOutcome: { t: 'enum', values: ATTEMPT_OUTCOMES, nullable: true },
        lateRawFetchedCount: countOrNull,
      },
    },
  },
  attemptsTruncated: count,
  searches: {
    t: 'list',
    max: 20,
    of: {
      t: 'object',
      fields: {
        ordinal: count,
        capability: { t: 'enum', values: ['search'] },
        queryFingerprint: { t: 'pattern', re: FINGERPRINT, optional: true },
        queryLength: count,
        requestedLang: langOrNull,
        sentLangGnews: langOrNull,
        window: {
          t: 'object',
          nullable: true,
          fields: { from: { t: 'pattern', re: ISO_TIME }, to: { t: 'pattern', re: ISO_TIME } },
        },
        limit: countOrNull,
        relevanceMode: { t: 'enum', values: RELEVANCE_MODES },
        requestedSource: { t: 'bool' },
        allowFallback: { t: 'bool' },
        postRelevanceRescue: { t: 'bool' },
        stages: {
          t: 'object',
          nullable: true,
          fields: {
            builds: count,
            rawFetched: count,
            requestedSourceExcluded: count,
            windowExcluded: count,
            perProviderDuplicatesCollapsed: count,
            crossProviderDuplicatesCollapsed: count,
            cappedOut: count,
            countryTags: { t: 'countMap', key: (key) => /^[A-Z]{2}$/.test(key), maxKeys: 9 },
            countryUnresolved: count,
            relevanceMode: { t: 'enum', values: RELEVANCE_MODES },
            relevanceRejected: count,
            relevanceReasons: {
              t: 'countMap',
              key: (key) => KNOWN_REASON_CODES.has(key),
              maxKeys: 13,
            },
            relevanceReasonsTruncated: count,
            requestedSourceConstraintExcluded: count,
            admittedLive: count,
            persistRequested: countOrNull,
            survivorsWithoutSuccessfulAttempt: count,
          },
        },
        retained: {
          t: 'object',
          nullable: true,
          fields: {
            mode: { t: 'enum', values: ['TERM_PARITY', 'SCORE', 'NONE'] },
            considered: count,
            windowExcluded: count,
            lexicalRejected: count,
            geoRejected: count,
            geoVerdicts: { t: 'countMap', key: inSet(GEO_VERDICTS), maxKeys: 5 },
            relevanceRejected: count,
            requestedSourceExcluded: count,
            admitted: count,
          },
        },
        returnedFrom: {
          t: 'enum',
          values: ['LIVE', 'RETAINED', 'EMPTY', 'NO_REAL_PROVIDER'],
          nullable: true,
        },
        returned: countOrNull,
      },
    },
  },
  searchesTruncated: count,
  retainedReads: {
    t: 'list',
    max: 20,
    of: {
      t: 'object',
      fields: { method: { t: 'enum', values: RETAINED_READ_METHODS }, returned: count },
    },
  },
  retainedReadsTruncated: count,
  storedRightsDrops: { t: 'countMap', key: inSet(RIGHTS_EXCLUSION_REASONS), maxKeys: 7 },
  rightsDecisions: {
    t: 'object',
    fields: Object.fromEntries(
      RIGHTS_DECISION_POINTS.map((point) => [point, { ...RIGHTS_DECISION, optional: true }]),
    ),
  },
  rightsUses: {
    t: 'object',
    fields: Object.fromEntries(E1_USES.map((use) => [use, { t: 'useState' }])),
  },
  analysisStages: {
    t: 'object',
    fields: {
      windowExcludedOutsideWindow: countOrNull,
      anchorGate: { t: 'object', nullable: true, fields: { candidates: count, admitted: count } },
      rightsAiInput: {
        t: 'object',
        fields: {
          excluded: countOrNull,
          reasons: {
            t: 'countMap',
            key: inSet(RIGHTS_EXCLUSION_REASONS),
            maxKeys: 7,
            nullable: true,
          },
          pendingReview: countOrNull,
        },
      },
      modelInput: countOrNull,
      cited: countOrNull,
      displayed: { t: 'null' },
    },
  },
  totals: {
    t: 'object',
    fields: {
      attempts: count,
      rawFetched: count,
      admittedLive: count,
      retainedAdmitted: count,
      retainedReadReturned: count,
      finalEvidence: count,
    },
  },
  coverage: {
    t: 'object',
    nullable: true,
    fields: {
      countryIso3: { t: 'pattern', re: ISO3 },
      enabledLocalSources: count,
      heldLocalCandidates: count,
    },
  },
  evidenceEmpty: { t: 'bool' },
  causes: {
    t: 'list',
    max: 24,
    of: {
      t: 'object',
      fields: {
        cause: { t: 'enum', values: EMPTY_CAUSES },
        detail: { t: 'pattern', re: CAUSE_DETAIL, nullable: true },
      },
    },
  },
  unobserved: { t: 'list', max: 12, of: { t: 'enum', values: UNOBSERVED_STATEMENTS } },
  invariants: {
    t: 'object',
    fields: {
      ok: { t: 'bool' },
      violations: { t: 'list', max: 16, of: { t: 'pattern', re: VIOLATION } },
    },
  },
} satisfies Record<string, Rule>);

/** Accounting written beside the fields above; every number here is about the envelope itself. */
export interface EnvelopeAccounting {
  maxBytes: number;
  bytes: number;
  /** 0 = complete; 1–3 = detail rows shed (see shed()); 4 = minimal envelope. */
  overflowLevel: 0 | 1 | 2 | 3 | 4;
  /** Values that failed their rule and were written as null / 'unrecognised'. */
  rejectedValues: number;
  /** List entries beyond a list's bound (causes, violations, unobserved) that were not written. */
  droppedListItems: number;
}

export type PersistedRetrievalDiagnostics = RetrievalDiagnostics & {
  persisted: EnvelopeAccounting;
};

interface Acc {
  rejected: number;
  dropped: number;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function apply(rule: Rule, value: unknown, acc: Acc): unknown {
  switch (rule.t) {
    case 'count': {
      if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) return value;
      if (!(rule.nullable === true && value === null)) acc.rejected += 1;
      return null;
    }
    case 'bool':
      if (typeof value === 'boolean') return value;
      acc.rejected += 1;
      return null;
    case 'enum':
      if (typeof value === 'string' && rule.values.includes(value)) return value;
      if (!(rule.nullable === true && value === null)) acc.rejected += 1;
      return null;
    case 'pattern':
      if (typeof value === 'string' && value.length <= 160 && rule.re.test(value)) return value;
      if (!(rule.nullable === true && value === null)) acc.rejected += 1;
      return null;
    case 'null':
      if (value !== null) acc.rejected += 1;
      return null;
    case 'useState': {
      if (value === 'NOT_ASSESSED') return value;
      const points =
        isPlainObject(value) && Array.isArray(value.decidedAt) ? value.decidedAt : null;
      const valid = (points ?? []).filter(
        (point): point is string =>
          typeof point === 'string' &&
          (RIGHTS_DECISION_POINTS as readonly string[]).includes(point),
      );
      if (points === null || valid.length === 0 || valid.length !== points.length)
        acc.rejected += 1;
      /* an unreadable state is never shown as decided */
      return valid.length === 0 ? 'NOT_ASSESSED' : { decidedAt: [...new Set(valid)] };
    }
    case 'object': {
      if (!isPlainObject(value)) {
        if (rule.nullable === true && value === null) return null;
        acc.rejected += 1;
        if (rule.nullable === true) return null;
      }
      const source = isPlainObject(value) ? value : {};
      const out: Record<string, unknown> = {};
      for (const [field, fieldRule] of Object.entries(rule.fields)) {
        const fieldValue = source[field];
        if ('optional' in fieldRule && fieldRule.optional === true && fieldValue === undefined)
          continue;
        out[field] = apply(fieldRule, fieldValue, acc);
      }
      return out;
    }
    case 'list': {
      if (!Array.isArray(value)) {
        acc.rejected += 1;
        return [];
      }
      if (value.length > rule.max) acc.dropped += value.length - rule.max;
      return value.slice(0, rule.max).map((item) => apply(rule.of, item, acc));
    }
    case 'countMap': {
      if (!isPlainObject(value)) {
        if (rule.nullable === true && value === null) return null;
        acc.rejected += 1;
        return rule.nullable === true ? null : {};
      }
      const out: Record<string, number> = {};
      for (const [key, n] of Object.entries(value)) {
        if (!(typeof n === 'number' && Number.isSafeInteger(n) && n >= 0)) {
          acc.rejected += 1;
          continue;
        }
        let target = key.length <= 64 && rule.key(key) ? key : UNRECOGNISED;
        if (target === UNRECOGNISED && key !== UNRECOGNISED) acc.rejected += 1;
        if (
          !(target in out) &&
          Object.keys(out).length >= rule.maxKeys - 1 &&
          target !== UNRECOGNISED
        )
          target = UNRECOGNISED;
        out[target] = (out[target] ?? 0) + n;
      }
      return out;
    }
  }
}

function deepFreeze<T>(value: T): T {
  if (
    value !== null &&
    typeof value === 'object' &&
    !(value instanceof RegExp) &&
    !Object.isFrozen(value)
  ) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  }
  return value;
}

const byteLength = (value: unknown): number => Buffer.byteLength(JSON.stringify(value), 'utf8');

/** Shed per-row detail, keeping the first `keep` rows and counting the rest as truncated. */
function shed(
  envelope: Record<string, unknown>,
  keep: { attempts: number; searches: number; reads: number },
): void {
  const cut = (list: string, counter: string, n: number) => {
    const rows = envelope[list] as unknown[];
    if (rows.length > n) {
      envelope[counter] = (envelope[counter] as number) + rows.length - n;
      envelope[list] = rows.slice(0, n);
    }
  };
  cut('attempts', 'attemptsTruncated', keep.attempts);
  cut('searches', 'searchesTruncated', keep.searches);
  cut('retainedReads', 'retainedReadsTruncated', keep.reads);
  const unobserved = envelope.unobserved as string[];
  const note = 'entries beyond the persisted size bound';
  if (!unobserved.includes(note)) envelope.unobserved = [...unobserved, note];
}

const SHED_STEPS = [
  { attempts: 12, searches: 6, reads: 8 },
  { attempts: 4, searches: 2, reads: 4 },
  { attempts: 0, searches: 0, reads: 0 },
] as const;

/**
 * Builds the persisted envelope from the allowlist and bounds it to 8 KiB of UTF-8. Never throws:
 * on any internal failure the caller receives null (no envelope), never an unchecked object.
 */
export function serializeRetrievalDiagnostics(
  diagnostics: unknown,
): PersistedRetrievalDiagnostics | null {
  try {
    const acc: Acc = { rejected: 0, dropped: 0 };
    const envelope = apply(
      { t: 'object', fields: RETRIEVAL_DIAGNOSTICS_FIELDS },
      diagnostics,
      acc,
    ) as Record<string, unknown>;
    /* the trace's own truncation counters must account for list bounds applied here */
    for (const [list, counter, max] of [
      ['attempts', 'attemptsTruncated', 40],
      ['searches', 'searchesTruncated', 20],
      ['retainedReads', 'retainedReadsTruncated', 20],
    ] as const) {
      const source = isPlainObject(diagnostics) ? diagnostics[list] : undefined;
      if (Array.isArray(source) && source.length > max) {
        envelope[counter] = ((envelope[counter] as number | null) ?? 0) + source.length - max;
        acc.dropped -= source.length - max; /* counted as truncation, not as a dropped list item */
      }
    }
    const accounting = (level: EnvelopeAccounting['overflowLevel']): EnvelopeAccounting => ({
      maxBytes: RETRIEVAL_DIAGNOSTICS_MAX_BYTES,
      /* a placeholder with the widest value, so the measured size bounds the final size */
      bytes: RETRIEVAL_DIAGNOSTICS_MAX_BYTES,
      overflowLevel: level,
      rejectedValues: acc.rejected,
      droppedListItems: acc.dropped,
    });
    let level: EnvelopeAccounting['overflowLevel'] = 0;
    let candidate: Record<string, unknown> = { ...envelope, persisted: accounting(level) };
    for (const step of SHED_STEPS) {
      if (byteLength(candidate) <= RETRIEVAL_DIAGNOSTICS_MAX_BYTES) break;
      shed(envelope, step);
      level = (level + 1) as EnvelopeAccounting['overflowLevel'];
      candidate = { ...envelope, persisted: accounting(level) };
    }
    if (byteLength(candidate) > RETRIEVAL_DIAGNOSTICS_MAX_BYTES) {
      /* level 4: the operation-level record only. Rows were already cut (and counted) by the
         last shed step; here only list text beyond 8 causes / 2 violations is dropped, and
         counted. Totals, stage counts, rights decisions and uses are kept as they are. */
      const causes = (envelope.causes as unknown[]).slice(0, 8);
      const allViolations = (envelope.invariants as { violations: unknown[] }).violations;
      const violations = allViolations.slice(0, 2);
      acc.dropped +=
        (envelope.causes as unknown[]).length -
        causes.length +
        allViolations.length -
        violations.length;
      candidate = {
        ...envelope,
        causes,
        invariants: { ...(envelope.invariants as object), violations },
        persisted: accounting(4),
      };
    }
    const bytes = byteLength(candidate);
    if (bytes > RETRIEVAL_DIAGNOSTICS_MAX_BYTES) return null;
    (candidate.persisted as EnvelopeAccounting).bytes = bytes;
    return candidate as unknown as PersistedRetrievalDiagnostics;
  } catch {
    return null;
  }
}
