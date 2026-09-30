import type { AskQuestionEnvelope, RoutingPlan } from './frozen-c/src/ports';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * ASK R2 CONSOLIDATED INTEGRATION R1 · GATE F — CONTEXT CHIPS FROM THE PLAN
 * ════════════════════════════════════════════════════════════════════════════
 *
 * D25 05 CONTEXT-CHIP RULES, and where each is held:
 *
 *   1  chips come from the EFFECTIVE SERVER PLAN only      built here, from the frozen
 *                                                          plan + envelope; never UI/Map
 *   2  a Map selection is a chip only when the plan        the Map candidate appears only
 *      scoped the answer by it                             when `scopedBy` is its rank
 *   3  order = order asked                                 sorted by where the reader's
 *                                                          words occur in the question
 *   4  read-only; changing scope is a new question         codes + reader spans only
 *   5  unsatisfiable scope stays, with the limitation      `applied: false` on a constraint
 *                                                          the plan could not carry
 *   6  no scope / clarification                            `kind: 'NONE'` / 'PENDING'
 *
 * Values are CODES or SPANS OF THE READER'S WORDS (ISO3, a domain code, the stated period
 * as typed, the category term as typed). The frontend owns every word it renders.
 */

export type PlanChipKind = 'GEOGRAPHY' | 'TOPIC' | 'DOMAIN' | 'TIME' | 'SELECTION' | 'SOURCE';

export interface PlanChip {
  readonly kind: PlanChipKind;
  readonly value: string;
  /** Where the scope came from (a frozen precedence rank / candidate source). */
  readonly source: string;
  /** False when the plan could not carry it: the chip stays, "Kept as asked". */
  readonly applied: boolean;
}

export type PlanChips =
  | { readonly kind: 'SCOPED'; readonly chips: readonly PlanChip[] }
  | { readonly kind: 'NONE' }
  | { readonly kind: 'PENDING' };

/** The candidate source a scope rank corresponds to. */
const RANK_TO_SOURCE: Readonly<Record<string, string>> = {
  DECLARED_REGION: 'DECLARED_REGION',
  TYPED_GEOGRAPHY: 'TYPED_GEOGRAPHY',
  ENTITY_GEOGRAPHY: 'ENTITY_GEOGRAPHY',
  ARTICLE_ANCHOR: 'STORY_ANCHOR',
  MAP_GEOGRAPHY_CONTEXT: 'MAP_GEOGRAPHY_CONTEXT',
};

/**
 * @param placeSpans ISO3 → the reader's own words for that place, from the qualified
 *   reading (`matchedText`), so a place chip sits where the reader asked it (rule 3).
 */
export function planChips(
  envelope: AskQuestionEnvelope,
  plan: RoutingPlan,
  placeSpans: Readonly<Record<string, string>> = {},
  /** BETA-ASK-005 — a bounded publication window the executor applies: an APPLIED time chip. */
  reportingWindow: { readonly statedPeriod: string } | null = null,
): PlanChips {
  if (plan.terminalState === 'CLARIFICATION_REQUIRED') return { kind: 'PENDING' };

  const chips: { chip: PlanChip; at: number }[] = [];
  const text = envelope.rawQuestion.toLowerCase();
  const positionOf = (span: string): number => {
    const i = text.indexOf(span.toLowerCase());
    return i < 0 ? Number.MAX_SAFE_INTEGER : i;
  };

  /* Geography: only the candidate that actually scoped the plan (rules 1–2). */
  const scopeSource = RANK_TO_SOURCE[plan.scopedBy];
  if (scopeSource !== undefined) {
    for (const c of envelope.geography.candidates) {
      if (c.source !== scopeSource) continue;
      const constraint = plan.constraints.find(
        (k) => k.axis === 'GEOGRAPHY' && k.value.startsWith(`${c.source}:${c.value}:`),
      );
      chips.push({
        chip: {
          kind: 'GEOGRAPHY',
          value: c.value,
          source: c.source,
          applied: constraint?.carried ?? true,
        },
        /* A Map-origin scope precedes everything (it was set before the question); a typed
           place sits where the reader wrote it; an unspanned place goes first. */
        at:
          c.source === 'MAP_GEOGRAPHY_CONTEXT'
            ? -1
            : placeSpans[c.value] === undefined
              ? 0
              : positionOf(placeSpans[c.value]!),
      });
    }
  }

  for (const k of plan.constraints) {
    if (k.axis === 'TOPIC') {
      chips.push({
        chip: { kind: 'TOPIC', value: k.value, source: 'READER_CATEGORY', applied: k.carried },
        at: positionOf(k.value),
      });
    } else if (k.axis === 'TIME') {
      chips.push({
        chip: { kind: 'TIME', value: k.value, source: 'STATED_PERIOD', applied: k.carried },
        at: positionOf(k.value),
      });
    } else if (k.axis === 'DOMAIN') {
      chips.push({
        chip: { kind: 'DOMAIN', value: k.value, source: 'ANALYTICAL_DOMAIN', applied: k.carried },
        at: Number.MAX_SAFE_INTEGER - 1,
      });
    } else if (k.axis === 'SELECTION') {
      chips.push({
        chip: {
          kind: 'SELECTION',
          value: String(envelope.selection.articleRefs.length),
          source: 'SELECTION',
          applied: k.carried,
        },
        at: -2,
      });
    } else if (k.axis === 'SOURCE_FRAME') {
      chips.push({
        chip: { kind: 'SOURCE', value: k.value, source: 'SOURCE_INTENT', applied: k.carried },
        at: positionOf(k.value),
      });
    }
  }

  if (reportingWindow !== null) {
    chips.push({
      chip: {
        kind: 'TIME',
        value: reportingWindow.statedPeriod,
        source: 'REPORTING_WINDOW',
        applied: true,
      },
      at: positionOf(reportingWindow.statedPeriod),
    });
  }

  if (chips.length === 0) return { kind: 'NONE' };
  return { kind: 'SCOPED', chips: chips.sort((a, b) => a.at - b.at).map((c) => c.chip) };
}
