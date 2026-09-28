import type { AskAnswerState, AskPlanChip, AskR2Payload } from '@/lib/api/askV2Api';
import type { AskR2Locale, AskR2Strings } from './askR2Strings';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * ASK R2 CONSOLIDATED INTEGRATION R1 · GATE G — D25 ENGINE STATE, AS A PURE VIEW MODEL
 * ════════════════════════════════════════════════════════════════════════════
 *
 * `02_ENGINE_STATE_MATRIX` rendered from the server's answer state and nothing else. The
 * component draws what this returns; every rule the matrix states is decided here, so it
 * can be tested without a browser:
 *
 *   badge + surface tone      from `answer.state` (the §7 derivation, server-side)
 *   freshness line            Reference: "not checked"; Clarification: "nothing has run";
 *                             otherwise the checked / retained-to time + source count
 *   handoffs                  Open full · Run deeper only for states 2, 3, 5 (+7, 8 when
 *                             they exist); never for Reference, Clarification, Insufficient
 *   citations                 Reference background is never citable (model memory)
 *   chips                     from `payload.chips` only (D25 05) — never UI or Map state
 */

export type AskR2Badge = 'ref' | 'ver' | 'cur' | 'clar' | 'part' | 'insuf' | 'unavail';

export interface AskR2ChipView {
  readonly kind: AskPlanChip['kind'];
  readonly label: string;
  readonly kept: boolean;
}

export interface AskR2View {
  readonly badge: AskR2Badge;
  readonly badgeText: string;
  /** Surface: Reference is dashed slate and muted; the rest are solid. */
  readonly tone:
    | 'reference'
    | 'verified'
    | 'current'
    | 'clarification'
    | 'partial'
    | 'insufficient'
    | 'unavailable';
  readonly freshness: string;
  readonly citable: boolean;
  readonly sourceCount: number;
  readonly handoffs: { readonly openFull: boolean; readonly runDeeper: boolean };
  readonly chips: {
    readonly mode: 'SCOPED' | 'NONE' | 'PENDING';
    readonly items: readonly AskR2ChipView[];
    readonly note: string | null;
  };
  /**
   * GATE H — a typed refusal names WHAT is missing (by the server's basis); a clarification
   * the executor asked carries its choices, already localised. The plan-only clarification
   * keeps D25's "nothing has run" wording; an executor clarification says no AI was used.
   */
  readonly unavailableText: string;
  readonly clarification: {
    readonly byExecutor: boolean;
    readonly candidates: readonly string[];
    /** ALPHA ENABLEMENT R1 (MC-070) — a whole-sentence question that replaces the choice list. */
    readonly lead: string | null;
  };
}

const BADGE_OF: Readonly<Record<AskAnswerState, AskR2Badge>> = {
  REFERENCE_BACKGROUND: 'ref',
  CURRENTLY_VERIFIED: 'ver',
  CURRENT_REPORTING: 'cur',
  PARTIAL: 'part',
  INSUFFICIENT: 'insuf',
  CLARIFICATION_REQUIRED: 'clar',
  CAPABILITY_UNAVAILABLE: 'unavail',
};

const TONE_OF: Readonly<Record<AskR2Badge, AskR2View['tone']>> = {
  ref: 'reference',
  ver: 'verified',
  cur: 'current',
  clar: 'clarification',
  part: 'partial',
  insuf: 'insufficient',
  unavail: 'unavailable',
};

/** D25 02: handoffs exist for states 2, 3, 5 (and 7, 8 — not produced by this candidate). */
const HANDOFF_BADGES: ReadonlySet<AskR2Badge> = new Set(['ver', 'cur', 'part']);

/** "28 Sep 2026, 04:40 UTC" / "28 wrz 2026, 04:40 UTC" — UTC, as D25 writes it. */
export function formatUtc(iso: string | undefined, locale: AskR2Locale): string | null {
  if (iso === undefined) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  const d = new Date(t);
  const months =
    locale === 'pl'
      ? ['sty', 'lut', 'mar', 'kwi', 'maj', 'cze', 'lip', 'sie', 'wrz', 'paź', 'lis', 'gru']
      : ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  return `${d.getUTCDate()} ${months[d.getUTCMonth()]} ${d.getUTCFullYear()}, ${hh}:${mm} UTC`;
}

function chipLabel(chip: AskPlanChip, placeName: (iso3: string) => string): string {
  if (chip.kind === 'GEOGRAPHY') return placeName(chip.value);
  if (chip.kind === 'TOPIC' || chip.kind === 'TIME' || chip.kind === 'SOURCE') {
    /* The reader's own words, capitalised the way D25 shows them ("This week"). */
    return chip.value.charAt(0).toUpperCase() + chip.value.slice(1);
  }
  if (chip.kind === 'DOMAIN') return chip.value.charAt(0).toUpperCase() + chip.value.slice(1);
  return chip.value;
}

export function askR2View(
  payload: AskR2Payload,
  s: AskR2Strings,
  locale: AskR2Locale,
  placeName: (iso3: string) => string = (iso3) => iso3,
): AskR2View {
  const badge = BADGE_OF[payload.answer.state] ?? 'unavail';
  const analysis = payload.analysis;
  const sourceCount = analysis?.articles?.length ?? 0;
  const checkedAt = formatUtc(analysis?.analysis?.generatedAt ?? payload.checkedAt, locale);
  const retainedTo =
    formatUtc(analysis?.retrievalContext?.newestArticlePublishedAt, locale) ?? checkedAt;
  const fill = (template: string, when: string | null): string =>
    template.replace('{when}', when ?? '—').replace('{sources}', s.sourcesLabel(sourceCount));

  const basis = payload.answer.basis;
  /* MC-055: an executor that is not wired for the reader's own library is named as such;
     EXECUTOR_NOT_WIRED stays a diagnostic basis, never the reader's sentence for it. */
  const personalNotWired =
    basis === 'EXECUTOR_NOT_WIRED' && (payload.answer.missingRoles ?? []).includes('PERSONAL');
  const scope = payload.route?.personalScope;
  const personalCopy =
    scope === 'SAVED_STORIES' || scope === 'INTERESTS' ? s.personal[scope] : s.personal.NEUTRAL;
  const unavailableText = personalNotWired
    ? personalCopy.notAvailable
    : basis === 'PLAN_IDENTITY_REQUIRED'
      ? personalCopy.signIn
      : (s.unavailableBecause[basis] ?? s.unavailable);
  const byExecutor = basis.startsWith('LANDED_');

  let freshness: string;
  /* Model-only background says it was not checked; background drawn from real sources says when. */
  if (badge === 'ref')
    freshness =
      sourceCount > 0 ? fill(s.freshness.referenceWithSources, checkedAt) : s.freshness.reference;
  else if (badge === 'clar')
    freshness = byExecutor ? s.askedBeforeAnswering : s.freshness.nothingRan;
  else if (badge === 'unavail')
    freshness = basis in s.unavailableBecause ? s.noAnswer : s.unavailable;
  else if (badge === 'insuf') freshness = fill(s.freshness.zero, checkedAt);
  else if (badge === 'cur') freshness = fill(s.freshness.retainedTo, retainedTo);
  else freshness = fill(s.freshness.checked, checkedAt);

  const c = payload.chips;
  const items =
    c.kind === 'SCOPED'
      ? c.chips.map((chip) => ({
          kind: chip.kind,
          label: chipLabel(chip, placeName),
          kept: !chip.applied,
        }))
      : [];
  const note =
    c.kind === 'NONE'
      ? s.noScope
      : c.kind === 'PENDING'
        ? s.scopePending
        : items.some((i) => i.kept)
          ? s.keptAsAsked
          : null;

  return {
    badge,
    badgeText: s.badges[badge],
    tone: TONE_OF[badge],
    freshness,
    /* Model memory is never citable; retrieved sources always are, whatever the badge. */
    citable:
      badge !== 'clar' &&
      badge !== 'unavail' &&
      payload.modelPriorCitable === false &&
      sourceCount > 0,
    sourceCount,
    handoffs: { openFull: HANDOFF_BADGES.has(badge), runDeeper: HANDOFF_BADGES.has(badge) },
    chips: { mode: c.kind, items, note },
    unavailableText,
    clarification: {
      byExecutor,
      candidates:
        basis === 'NO_PRIOR_SUBJECT'
          ? []
          : (payload.answer.candidates ?? []).map((iso3) => placeName(iso3)),
      /* MC-070: the place is kept as the plan's GEOGRAPHY chip, not inflected into the sentence. */
      lead: basis === 'NO_PRIOR_SUBJECT' ? s.noPriorSubject : null,
    },
  };
}
