import type { AskR2Route } from '../ask-router/ask-r2-route';
import type { AskContributionSet } from './ask-specialist-read.coordinator';
import type {
  AskContribution,
  AskContributionObservation,
  AskContributorSelection,
} from './ask-contribution.contract';
import { namesScope } from './contributor-selection';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * ASK INTELLIGENCE BINDING — LIVE ACCEPTANCE REPAIR R1: THE GOVERNED ANSWER BRIDGE
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Three pure decisions, no I/O, no model:
 *
 *  1. DETERMINISTIC RETAINED ANSWER. When every contributor the question selected (context
 *     aside) is one whose governed record IS the answer — a named district's Imihigo result,
 *     Rwanda's headline CPI, or the procurement snapshot for a question the plan would only
 *     answer from model background — Ask answers from that record alone: zero model calls,
 *     zero provider calls, nothing to meter. The record is repeated, never paraphrased, and a
 *     missing record is stated as missing (Gasabo), never filled in.
 *
 *  2. EXPLICIT OFFICIAL REQUEST. A reader who asks for the OFFICIAL figure of a current status
 *     the router already marks OFFICIAL_VERIFICATION_UNAVAILABLE gets that truth — official
 *     source unavailable — with zero AI, instead of reporting that could be read as official.
 *
 *  3. GOVERNED PROMPT SECTION. For every other executing answer, the contributions' status,
 *     scope, time basis and disclosures are handed to the ONE model call as binding rules, so
 *     the prose itself obeys them (a snapshot is not a trend; retained is not current;
 *     NOT_ASSESSED is not evidence).
 */

/** Contributors whose governed record can be the whole answer, and when. */
function deterministicEligible(route: AskR2Route, s: AskContributorSelection): boolean {
  switch (s.contributorId) {
    case 'IMIHIGO':
      return s.scope.district !== null;
    case 'ECONOMY_CPI':
      return s.scope.countryIso3 === 'RWA';
    case 'MARKET_PROCUREMENT':
      /* Only where the plan would otherwise answer from ungrounded model background. */
      return route.plan.terminalState === 'REFERENCE_BACKGROUND_ONLY';
    default:
      return false;
  }
}

/**
 * The selection a deterministic retained answer is built from, or null when the question needs
 * the ordinary path (a situation, humanitarian or mixed question). GEOGRAPHY is context and
 * rides along; any other non-eligible contributor sends the question down the ordinary path.
 */
export function deterministicGovernedSelection(
  route: AskR2Route,
  selections: readonly AskContributorSelection[],
): AskContributorSelection[] | null {
  const substantive = selections.filter((s) => s.contributorId !== 'GEOGRAPHY');
  if (substantive.length === 0) return null;
  if (!substantive.every((s) => deterministicEligible(route, s))) return null;
  /* A plan that cannot execute at all (clarification, identity…) keeps its own terminal. */
  if (
    route.plan.terminalState !== 'EXECUTABLE' &&
    route.plan.terminalState !== 'REFERENCE_BACKGROUND_ONLY'
  ) {
    return null;
  }
  return [...selections];
}

export type GovernedRecordBasis =
  /** At least one substantive contributor returned its governed record. */
  | 'GOVERNED_RECORD'
  /** Consulted; no governed record exists for the scope (stated as such, never filled). */
  | 'GOVERNED_NO_RECORD'
  /** The read itself failed/timed out: nothing is claimed either way. */
  | 'GOVERNED_READ_DEGRADED';

export function governedRecordBasis(set: AskContributionSet): GovernedRecordBasis {
  const substantive = set.contributions.filter((c) => c.contributorId !== 'GEOGRAPHY');
  if (substantive.some((c) => c.status === 'USED' && c.observations.length > 0)) {
    return 'GOVERNED_RECORD';
  }
  if (substantive.length > 0 && substantive.every((c) => c.status === 'DEGRADED')) {
    return 'GOVERNED_READ_DEGRADED';
  }
  return 'GOVERNED_NO_RECORD';
}

/** Closed EN + PL terms by which a reader asks for the OFFICIAL figure itself. */
export const OFFICIAL_REQUEST_TERMS: readonly string[] = [
  'official',
  'officially',
  'oficjalny',
  'oficjalna',
  'oficjalne',
  'oficjalnie',
  'oficjalnej',
  'oficjalnego',
  'oficjalną',
];

/** An explicit request for official evidence that the plan says cannot be verified officially. */
export function explicitOfficialUnavailable(route: AskR2Route): boolean {
  return (
    route.plan.refusals.includes('OFFICIAL_VERIFICATION_UNAVAILABLE') &&
    namesScope(route.envelope.rawQuestion, OFFICIAL_REQUEST_TERMS)
  );
}

/* ── 3 · the governed prompt section ─────────────────────────────────────── */

const MAX_PROMPT_RECORDS = 8;
const clip = (text: string, max: number): string =>
  text.length <= max ? text : `${text.slice(0, max - 1)}…`;
const clean = (text: string | null | undefined): string =>
  clip((text ?? '').replace(/\s+/g, ' ').trim(), 160);

const CONTRIBUTOR_NAME: Readonly<Record<AskContribution['contributorId'], string>> = {
  CONFLICT: 'Conflict Intelligence — retained UCDP event records',
  MARKET_PROCUREMENT: 'Retained EU procurement notices (TED)',
  ECONOMY_CPI: 'Retained NISR headline CPI',
  IMIHIGO: 'Retained NISR Imihigo evaluation',
  GEOGRAPHY: 'Reference geography',
  HUMANITARIAN: 'Humanitarian Intelligence',
};

function recordLine(o: AskContributionObservation): string {
  const parts = [
    o.period,
    o.kind,
    o.detail?.place ? `place: ${clean(o.detail.place)}` : '',
    o.detail && o.detail.parties.length > 0
      ? `parties: ${clean(o.detail.parties.join(' vs '))}`
      : '',
    o.label ? clean(o.label) : '',
    o.value !== null ? `value: ${clean(o.value)}${o.unit ? ` ${clean(o.unit)}` : ''}` : '',
  ].filter((p) => p !== '');
  return `  • ${parts.join(' · ')}`;
}

/**
 * The governed records and their binding rules for the ONE model call, or '' when nothing
 * was considered (so every other prompt stays byte-identical). English, like every system
 * rule; the answer language is governed by the existing response-language instruction.
 */
export function governedPromptSection(set: AskContributionSet): string {
  if (set.considered.length === 0) return '';
  const lines: string[] = [
    'GOVERNED RETAINED RECORDS FOR THIS QUESTION (GlobalNewsAI governed stores — NOT news reporting, NOT current). The reader sees these records separately, with their sources.',
  ];
  const rules = new Set<string>([
    "Never present a retained record as today's situation or as current reporting; when you use one, say it is a retained record and give its date or period.",
    'Never attach a news evidence id to a retained record, and never cite a retained record as a news source.',
    'Answer only from reporting that is relevant to the question; do not summarise unrelated reporting (for example sport, entertainment or unrelated accidents) merely because it mentions the place.',
  ]);
  for (const c of set.contributions) {
    const name = CONTRIBUTOR_NAME[c.contributorId];
    if (c.contributorId === 'GEOGRAPHY') {
      const place = c.observations[0]?.label;
      if (place) lines.push(`- Place context (not evidence of any event): ${clean(place)}.`);
      continue;
    }
    if (c.status === 'USED' && c.observations.length > 0) {
      const shown = c.observations.slice(0, MAX_PROMPT_RECORDS);
      lines.push(
        `- ${name}: ${c.observations.length} record(s), scope ${c.geographyBasis ?? 'unscoped'}, time basis ${c.temporalBasis}.`,
        ...shown.map(recordLine),
      );
    } else if (c.status === 'NOT_ASSESSED') {
      lines.push(`- ${name}: NOT ASSESSED — no governed observation exists for it.`);
      rules.add(
        `${name} was not assessed: never state or imply that ${name} supports, confirms or assessed anything in this answer.`,
      );
    } else if (c.status === 'NO_MATCH' || c.status === 'NO_DATA') {
      lines.push(`- ${name}: no governed record matched this question's scope.`);
      rules.add(
        `${name} found no governed record for this scope: that is not evidence that nothing happened — do not say so.`,
      );
    } else {
      lines.push(`- ${name}: unavailable for this answer (${c.status}).`);
    }
    for (const code of c.disclosures) {
      if (code === 'SEVERITY_NOT_ASSESSED') {
        rules.add(
          'No severity has been assessed for the retained conflict records: do not rank, grade or characterise severity or trend from them beyond what reporting states.',
        );
      }
      if (code === 'NO_RECENT_RETAINED_RECORD') {
        rules.add(
          'The newest retained conflict record is more than a week old: say so if you use the records.',
        );
      }
      if (code === 'SUBNATIONAL_SCOPE_NOT_APPLIED') {
        rules.add(
          'The reader named a sub-national area, but the retained records were read at country level: rely only on records whose stated place lies in the area the reader named, and state that the retained scope is country-level.',
        );
      }
      if (code === 'SNAPSHOT_NOT_CHANGE_SERIES') {
        rules.add(
          'The procurement records are ONE retained publication-day snapshot: never describe procurement changes, trends, reforms or developments from them; if the question asks about changes, say that the governed evidence cannot show change.',
        );
      }
      if (code === 'AGGREGATE_NOT_ASSIGNED_TO_DISTRICT') {
        rules.add(
          'No individual district record exists here; a city or province aggregate must never be attributed to the district.',
        );
      }
    }
  }
  return [...lines, 'RULES FOR THESE RECORDS:', ...[...rules].map((r) => `- ${r}`)].join('\n');
}
