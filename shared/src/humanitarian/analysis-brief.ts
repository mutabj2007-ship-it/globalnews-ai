import {
  type AdmittedRecordPointer,
  type HumanitarianAnalysisWorkspace,
  type HumanitarianWorkspaceDimensionId,
  type WorkspaceStoreState,
  humanitarianAskHandoff,
} from './analysis-workspace';
import type { ObservationAbsenceState } from '../observation/absence';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * THE BOUNDED HUMANITARIAN BRIEF — WHAT HOME AND MY INTELLIGENCE MAY RENDER
 * ════════════════════════════════════════════════════════════════════════════
 *
 * WHY A SEPARATE PROJECTION AND NOT "THE WORKSPACE, SMALLER".
 *
 * Home and My Intelligence render on navigation. Anything they read must therefore cost
 * nothing: no model, no provider, no retrieval, no await. Handing them the whole workspace
 * would work and would be wrong — the first time someone needed a sentence for a card, the
 * nearest available thing would be a summary, and a summary is a model call. So the brief is
 * a CLOSED, BOUNDED, SENTENCE-FREE structure: there is no field on it that a sentence could
 * be put in, which is a stronger guarantee than a rule that one must not be.
 *
 * ── THE FOUR PROPERTIES THE SUITE PROVES ──────────────────────────────────
 *
 * 1. **Zero compute on render.** `projectHumanitarianBrief` is synchronous, pure, takes no
 *    client, returns no promise, and this module imports nothing that can fetch or call a
 *    model. A page may call it during render.
 * 2. **Bounded.** At most `BRIEF_MAX_FIGURES` figures and `BRIEF_MAX_RECORDS` pointers,
 *    chosen deterministically, so a card cannot grow with the corpus.
 * 3. **No prose.** Every field is an identifier, an enum member, a number, a unit, or a
 *    timestamp. The reader's words come from the locale catalogues, as they do everywhere
 *    else in this domain.
 * 4. **Absence survives the shrink.** A brief carries the store state or the absence, and the
 *    roster of unknown dimensions, because a summary that dropped the unknowns would be the
 *    most misleading object in the product: small, confident and incomplete.
 */

/** A card shows a few figures, not a corpus. Both bounds are deterministic, not a page size. */
export const BRIEF_MAX_FIGURES = 4;
export const BRIEF_MAX_RECORDS = 8;

export class HumanitarianBriefRefused extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'HumanitarianBriefRefused';
  }
}

/** One stated figure, exactly as a source asserted it. Never rounded, never re-expressed. */
export interface BriefFigure {
  readonly dimension: HumanitarianWorkspaceDimensionId;
  readonly measure: string;
  /** SOURCE_ASSERTION or ESTIMATE. A brief never carries a product-voice figure. */
  readonly claimClass: 'SOURCE_ASSERTION' | 'ESTIMATE';
  readonly value: number | string;
  readonly unit: string | null;
  readonly recordKey: string;
  readonly providerId: string;
}

export interface HumanitarianBrief {
  /** RETAINED when any dimension carries; otherwise the read's own statement. */
  readonly state: 'RETAINED' | 'EMPTY';
  /** Exactly one of these two is set when `state` is EMPTY, mirroring the workspace rule. */
  readonly absence: ObservationAbsenceState | null;
  readonly storeState: WorkspaceStoreState | null;
  readonly figures: readonly BriefFigure[];
  /** True when figures were dropped by the bound, so a surface can say "and more". */
  readonly figuresTruncated: boolean;
  readonly dimensionsCarried: readonly HumanitarianWorkspaceDimensionId[];
  readonly dimensionsUnknown: readonly HumanitarianWorkspaceDimensionId[];
  /** The most recent `retrievedAt` across the admitted records, or null. Never "now". */
  readonly newestRetainedAt: string | null;
  readonly records: readonly AdmittedRecordPointer[];
  /** Whether the one Ask engine has a subject here. A brief never computes one. */
  readonly askSubjectAvailable: boolean;
  readonly projectedAt: string;
}

const BRIEF_FIGURE_FIELDS = [
  'claimClass',
  'dimension',
  'measure',
  'providerId',
  'recordKey',
  'unit',
  'value',
] as const;

const BRIEF_FIELDS = [
  'absence',
  'askSubjectAvailable',
  'dimensionsCarried',
  'dimensionsUnknown',
  'figures',
  'figuresTruncated',
  'newestRetainedAt',
  'projectedAt',
  'records',
  'state',
  'storeState',
] as const;

/**
 * Which figures a card shows when there are more than it may show.
 *
 * ORDERED BY THE EVIDENCE, NOT BY SIZE. Sorting by value would make the biggest number the
 * headline, which is editorial judgement this projection has no authority to make — and would
 * quietly prefer a 50,000 estimate over a 300 stated count. The order is the workspace's own
 * dimension order, then the measure name, then the record key: fully determined by the
 * evidence set and stable across runs.
 */
function orderedFigures(workspace: HumanitarianAnalysisWorkspace): readonly BriefFigure[] {
  const out: BriefFigure[] = [];
  for (const dimension of workspace.dimensions) {
    if (dimension.id === 'SOURCE_DISAGREEMENT') continue; /* counted in its own dimension */
    const rows = dimension.claims
      .filter((c) => c.claimClass !== 'FACT')
      .slice()
      .sort((a, b) => {
        if (a.attribute !== b.attribute) return a.attribute < b.attribute ? -1 : 1;
        const ak = a.records[0]?.observationKey ?? '';
        const bk = b.records[0]?.observationKey ?? '';
        return ak < bk ? -1 : ak > bk ? 1 : 0;
      });
    for (const claim of rows) {
      const pointer = claim.records[0];
      if (pointer === undefined || claim.value === null) {
        throw new HumanitarianBriefRefused(
          `HUM_BRIEF_FIGURE_UNSOURCED: '${claim.attribute}' in '${dimension.id}'.`,
        );
      }
      if (claim.claimClass === 'FACT') continue;
      out.push({
        dimension: dimension.id,
        measure: claim.attribute,
        claimClass: claim.claimClass,
        value: claim.value,
        unit: claim.unit,
        recordKey: pointer.observationKey,
        providerId: pointer.providerId,
      });
    }
  }
  return out;
}

/**
 * THE PROJECTION. Synchronous, pure, allocation-only. Safe to call during a render.
 *
 * It takes the workspace rather than a read, because the workspace already resolved the three
 * read kinds — one resolution, one authority. A brief is never built from raw records.
 */
export function projectHumanitarianBrief(
  workspace: HumanitarianAnalysisWorkspace,
): HumanitarianBrief {
  const carried = workspace.dimensions.filter((d) => d.state === 'CARRIED').map((d) => d.id);
  const unknown = workspace.dimensions.filter((d) => d.state === 'EMPTY').map((d) => d.id);

  const all = orderedFigures(workspace);
  const figures = all.slice(0, BRIEF_MAX_FIGURES);

  /* The read's own statement, taken from the dimensions rather than re-decided. Every empty
     dimension of an all-empty workspace carries the same reason, so the first one is it. */
  const firstEmpty = workspace.dimensions.find((d) => d.state === 'EMPTY');
  const isEmpty = carried.length === 0;

  const newestRetainedAt = workspace.records.reduce<string | null>((newest, record) => {
    if (newest === null) return record.retrievedAt;
    return Date.parse(record.retrievedAt) > Date.parse(newest) ? record.retrievedAt : newest;
  }, null);

  return {
    state: isEmpty ? 'EMPTY' : 'RETAINED',
    absence: isEmpty ? (firstEmpty?.absence ?? null) : null,
    storeState: isEmpty ? (firstEmpty?.storeState ?? null) : null,
    figures,
    figuresTruncated: all.length > figures.length,
    dimensionsCarried: carried,
    dimensionsUnknown: unknown,
    newestRetainedAt,
    records: workspace.records.slice(0, BRIEF_MAX_RECORDS),
    askSubjectAvailable: humanitarianAskHandoff(workspace).available,
    projectedAt: workspace.projectedAt,
  };
}

/**
 * Closure plus the three invariants a small object is most likely to break: an empty brief
 * that names no reason, a figure with no record, and a brief that carries a sentence.
 */
export function assertBriefIsWellFormed(brief: HumanitarianBrief): void {
  const fields = Object.keys(brief).sort().join(',');
  if (fields !== BRIEF_FIELDS.join(',')) {
    throw new HumanitarianBriefRefused(
      `HUM_BRIEF_FIELD_SET_OPEN: got [${fields}], expected [${BRIEF_FIELDS.join(',')}].`,
    );
  }
  if (brief.state === 'EMPTY') {
    const hasAbsence = brief.absence !== null;
    const hasStore = brief.storeState !== null;
    if (hasAbsence === hasStore) {
      throw new HumanitarianBriefRefused(
        'HUM_BRIEF_EMPTY_REASON_AMBIGUOUS: an empty brief names exactly one of an absence or ' +
          'the store state. A card with no reason is the shape silence takes when it is read ' +
          'as calm.',
      );
    }
    if (brief.absence === 'ASSESSED_NOTHING_QUALIFIED') {
      throw new HumanitarianBriefRefused('HUM_BRIEF_ABSENCE_REASSURES.');
    }
    if (brief.figures.length > 0) {
      throw new HumanitarianBriefRefused('HUM_BRIEF_EMPTY_CARRIES_FIGURES.');
    }
  } else if (brief.absence !== null || brief.storeState !== null) {
    throw new HumanitarianBriefRefused('HUM_BRIEF_REASON_ON_RETAINED.');
  }

  if (brief.figures.length > BRIEF_MAX_FIGURES) {
    throw new HumanitarianBriefRefused(
      `HUM_BRIEF_UNBOUNDED: ${String(brief.figures.length)} figures exceeds ${String(BRIEF_MAX_FIGURES)}.`,
    );
  }
  if (brief.records.length > BRIEF_MAX_RECORDS) {
    throw new HumanitarianBriefRefused('HUM_BRIEF_UNBOUNDED: too many record pointers.');
  }

  for (const figure of brief.figures) {
    const figureFields = Object.keys(figure).sort().join(',');
    if (figureFields !== BRIEF_FIGURE_FIELDS.join(',')) {
      throw new HumanitarianBriefRefused(`HUM_BRIEF_FIGURE_FIELD_SET_OPEN: got [${figureFields}].`);
    }
    if (figure.recordKey.length === 0) {
      throw new HumanitarianBriefRefused(`HUM_BRIEF_FIGURE_UNSOURCED: '${figure.measure}'.`);
    }
    if (figure.claimClass !== 'SOURCE_ASSERTION' && figure.claimClass !== 'ESTIMATE') {
      throw new HumanitarianBriefRefused(
        `HUM_BRIEF_FIGURE_NOT_SOURCED_CLASS: '${figure.measure}' is '${figure.claimClass}'.`,
      );
    }
  }

  /* NO SENTENCES. A brief is identifiers and figures; a field that reads like a sentence is
     the first step toward generating one. The test is crude on purpose: a space-separated
     run of words with a terminal period is prose, and no legitimate field here is. */
  for (const [key, value] of Object.entries(brief)) {
    if (typeof value !== 'string') continue;
    if (/\s\S+\s\S+/.test(value) || value.endsWith('.')) {
      throw new HumanitarianBriefRefused(
        `HUM_BRIEF_CARRIES_PROSE: '${key}' looks like a sentence. Reader words come from the ` +
          'locale catalogue, never from this projection.',
      );
    }
  }
}
