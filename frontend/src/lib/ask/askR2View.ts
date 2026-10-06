import { askFormatUtcInstant } from './askDirection';
import type { AskAnswerState, AskPlanChip, AskR2Payload } from '@/lib/api/askV2Api';
import type { AskR2Locale, AskR2Strings } from './askR2Strings';
import {
  ASK_INPUT_MAX_CHARS,
  ASK_INPUT_TOO_LONG,
  resolveEvidenceState,
  type DisplayLocale,
} from '@globalnews-ai/shared';
import type { AnalysisRetrievalContext } from '@globalnews-ai/shared';

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

export type AskR2Badge =
  'ref' | 'ver' | 'cur' | 'clar' | 'part' | 'insuf' | 'unavail' | 'rec' | 'calc';

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
    | 'unavailable'
    | 'retained';
  readonly freshness: string;
  /**
   * ASK FIRST-ANSWER RETRIEVAL R3 — a news provider REFUSED this search (rate limit, outage).
   * From the typed retrieval outcome only; an answered-but-empty search is never "limited".
   */
  readonly searchLimited: boolean;
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
    /**
     * ALPHA ENABLEMENT R1 (MC-070) — a whole-sentence question that replaces the choice list.
     * ALPHA VISUAL ACCEPTANCE REPAIR R1 — for a clarification badge it is NEVER null when
     * there are no candidates: every clarification asks something the reader can act on.
     */
    readonly lead: string | null;
    /**
     * ALPHA VISUAL ACCEPTANCE REPAIR R1 — the reader's question with the parts Ask cannot
     * apply removed (BROADENING_OFFERED), offered as a draft; null when it cannot be derived
     * from the reader's own words.
     */
    readonly suggestion: string | null;
    /** Each candidate as a draft of the reader's question scoped to it. */
    readonly choices: readonly { readonly label: string; readonly question: string }[];
  };
  /**
   * ASK TRUTHFUL RETRIEVAL R2A — the server's verification facts: may this answer conclude
   * anything negative (never on absence alone), which source lanes were checked / unavailable,
   * and each claim's deterministic state. Null when the server sent none.
   */
  readonly verification: {
    readonly notice: string | null;
    readonly lanes: readonly {
      readonly label: string;
      readonly ok: boolean;
      readonly status: string;
    }[];
    readonly claims: readonly {
      readonly text: string;
      readonly state: string;
      readonly label: string;
    }[];
  } | null;
}

const BADGE_OF: Readonly<Record<AskAnswerState, AskR2Badge>> = {
  REFERENCE_BACKGROUND: 'ref',
  CURRENTLY_VERIFIED: 'ver',
  CURRENT_REPORTING: 'cur',
  PARTIAL: 'part',
  INSUFFICIENT: 'insuf',
  CLARIFICATION_REQUIRED: 'clar',
  CAPABILITY_UNAVAILABLE: 'unavail',
  /* LIVE ACCEPTANCE REPAIR R1 — a governed retained record, zero AI; no hand-offs. */
  RETAINED_RECORD: 'rec',
  /* R1 — a deterministic computation, zero AI; no hand-offs. */
  COMPUTED_RESULT: 'calc',
};

const TONE_OF: Readonly<Record<AskR2Badge, AskR2View['tone']>> = {
  ref: 'reference',
  ver: 'verified',
  cur: 'current',
  clar: 'clarification',
  part: 'partial',
  insuf: 'insufficient',
  unavail: 'unavailable',
  rec: 'retained',
  calc: 'reference',
};

/** D25 02: handoffs exist for states 2, 3, 5 (and 7, 8 — not produced by this candidate). */
const HANDOFF_BADGES: ReadonlySet<AskR2Badge> = new Set(['ver', 'cur', 'part']);

/** "28 Sep 2026, 04:40 UTC" / "28 wrz 2026, 04:40 UTC" — UTC, as D25 writes it. */
/**
 * R4 · SEVEN-LANGUAGE ASK FRONTEND — Intl, not two hand-written month tables.
 *
 * This function carried `['sty','lut',…]` and `['Jan','Feb',…]` plus `padStart` clock
 * arithmetic: correct for two locales, wrong for five, and structurally incapable of
 * Eastern-Arabic numerals. It now delegates to `askFormatUtcInstant`, which builds one
 * `Intl.DateTimeFormat` from the locale's own formatting profile — the profile the shared
 * contract already decided, including `ar-u-nu-arab-ca-gregory`.
 *
 * The SIGNATURE AND THE UTC SUFFIX ARE UNCHANGED, and the parameter is widened rather than
 * replaced, so every existing caller keeps compiling and Ask keeps stating its instants in
 * UTC rather than in the reader's zone.
 */
export function formatUtc(iso: string | undefined, locale: DisplayLocale): string | null {
  return askFormatUtcInstant(iso, locale);
}

function chipLabel(
  chip: AskPlanChip,
  placeName: (iso3: string) => string,
  s?: AskR2Strings,
): string {
  if (chip.kind === 'GEOGRAPHY') return placeName(chip.value);
  /* R3 L-4 — the relation of a relationship scope ("Border", "Trade"), localised */
  if (chip.kind === 'TOPIC' && chip.source === 'RELATIONSHIP' && s !== undefined) {
    const label = s.r3.relations[chip.value] ?? chip.value.toLowerCase();
    return label.charAt(0).toLocaleUpperCase() + label.slice(1);
  }
  if (chip.kind === 'TOPIC' || chip.kind === 'TIME' || chip.kind === 'SOURCE') {
    /* The reader's own words, capitalised the way D25 shows them ("This week"). */
    return chip.value.charAt(0).toUpperCase() + chip.value.slice(1);
  }
  if (chip.kind === 'DOMAIN') return chip.value.charAt(0).toUpperCase() + chip.value.slice(1);
  return chip.value;
}

/**
 * ALPHA VISUAL ACCEPTANCE REPAIR R1 (G) — one chip per displayed label. A reader word can be
 * read twice by the plan (e.g. "political" as a TOPIC term AND as an analytical DOMAIN), which
 * displayed "Political · Poland · Today · Political". Presentation only — the envelope is
 * untouched. The FIRST occurrence (the reader's own word, in reading order) is kept, and it is
 * shown as "kept as asked" if ANY reading of it was not applied: a limit is never claimed as
 * applied while part of it was not.
 */
export function dedupeChips(items: readonly AskR2ChipView[]): AskR2ChipView[] {
  const out: AskR2ChipView[] = [];
  for (const item of items) {
    const key = item.label.toLocaleLowerCase();
    const at = out.findIndex((kept) => kept.label.toLocaleLowerCase() === key);
    if (at === -1) out.push(item);
    else if (item.kept && !out[at]!.kept) out[at] = { ...out[at]!, kept: true };
  }
  return out;
}

/**
 * ALPHA VISUAL ACCEPTANCE REPAIR R1 (F) — the reader's question without the words Ask cannot
 * apply, or null. Only the reader's own words are removed, whole-word and case-insensitive;
 * if any of them is not literally in the question nothing is suggested (no guessed rewrite).
 */
export function withoutTerms(
  question: string,
  terms: readonly string[],
  timeTerms: readonly string[] = [],
): string | null {
  if (terms.length === 0) return null;
  const isTime = (term: string): boolean =>
    timeTerms.some((t) => t.toLocaleLowerCase() === term.toLocaleLowerCase());
  let out = question;
  let removedAtStart = false;
  for (const term of terms) {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    /* ASK PUBLIC BETA RETRIEVAL REPAIR R1 (BETA-ASK-001) — a stated period goes with the words
       that govern it ("over the last 7 days", "in the past 24 hours", "during this week"), so
       removing it can never leave "…Congo over the?". */
    const governor = isTime(term) ? TIME_GOVERNOR : '';
    const re = new RegExp(
      String.raw`(^|[^\p{L}\p{N}])${governor}${escaped}(?=$|[^\p{L}\p{N}])`,
      'iu',
    );
    const match = out.match(re);
    if (match === null) return null;
    if ((match.index ?? 0) === 0) removedAtStart = true;
    out = out.replace(re, '$1');
  }
  out = out
    .replace(/\s+([?.!,;:])/g, '$1')
    .replace(/[,;:]+(?=[?.!])/g, '')
    .replace(/([?.!,;:])\1+/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim();
  if (removedAtStart) {
    out = out.replace(/^[\s,;:]+/, '');
    out = out.charAt(0).toLocaleUpperCase() + out.slice(1);
  }
  /* A suggestion that reads broken is worse than none: no new dangling word may appear. */
  if (danglingCount(out) > danglingCount(question)) return null;
  return out.length > 0 && out !== question.trim() ? out : null;
}

/** The words that may govern a stated period, removed with it. */
const TIME_GOVERNOR = String.raw`(?:(?:over|in|during|within|for|across|throughout|from|since|of)\s+)?(?:the\s+)?`;

/** A function word left hanging before punctuation or the end, or an empty clause (", ,"). */
const DANGLING =
  /(?:\b(?:the|a|an|of|over|in|during|within|for|across|throughout|from|since|to|and|or|by|with|at|next|last|past|previous|coming|recent|entire|whole|all|every|this|that|these|those|its|their|my|our|your|his|her)\s*(?:[?.!,;:]|$))|(?:[,;:]\s*[,;:?.!])|(?:^[\s,;:?.!])/giu;

function danglingCount(text: string): number {
  return (text.trim().match(DANGLING) ?? []).length;
}

/** GOVERNED RETAINED GAP REPAIR R1 — the governed place a USED geography contribution resolved. */
function governedPlaceLabel(payload: AskR2Payload): string | null {
  const geo = payload.intelligence?.contributions.find(
    (c) => c.contributorId === 'GEOGRAPHY' && c.status === 'USED',
  );
  const first = geo?.observations[0];
  if (first?.label == null || first.label === '') return null;
  return first.kind === 'NISR_DISTRICT' ? `${first.label} (NISR)` : first.label;
}

/**
 * GOVERNED RETAINED GAP REPAIR R1 — the reader's sentence for a governed record that cannot be
 * shown, chosen by the contribution's disclosure (never by the internal reason code).
 */
function governedGapText(payload: AskR2Payload, s: AskR2Strings): string {
  const gaps = (payload.intelligence?.contributions ?? []).filter(
    (c) => c.contributorId !== 'GEOGRAPHY' && c.status !== 'USED' && c.status !== 'NO_MATCH',
  );
  for (const c of gaps) {
    if (c.disclosures.includes('RETAINED_ARTIFACT_NOT_DISPLAYABLE')) {
      return s.governedGap.notDisplayable[c.contributorId] ?? s.governedGap.notDisplayable.default;
    }
    if (c.disclosures.includes('NO_RETAINED_CAPTURE')) {
      return s.governedGap.noCapture[c.contributorId] ?? s.governedGap.noCapture.default;
    }
  }
  return s.governedGap.unreadable;
}

/**
 * CTO R3 LIVE DEFECT L-3 — what a turn with NO stored answer says. Each failure keeps its own truth:
 *   NETWORK   the request never reached Ask — a dropped connection establishes nothing about the
 *             service, so the service is never called unavailable (live Alpha 8f44abd, journey F);
 *   BUDGET_*  a spent daily budget is named as such (LIVE ACCEPTANCE REPAIR R1);
 *   anything else (a typed UNAVAILABLE, a server failure code) keeps the existing copy.
 */
export function failedTurnCopy(failure: string | undefined, s: AskR2Strings): string {
  if (failure === 'NETWORK') return s.r3.networkFailed;
  if (failure?.startsWith('BUDGET_')) return s.budgetRefused;
  /* ASK R2 — the documented length limit is named, never "unavailable". */
  if (failure === ASK_INPUT_TOO_LONG) return s.questionTooLong(ASK_INPUT_MAX_CHARS);
  return s.unavailable;
}

export function askR2View(
  payload: AskR2Payload,
  s: AskR2Strings,
  /* R4 · PHASE B — was AskR2Locale. Its only use is `formatUtc`, which already took the
     reader's own locale and formats through Intl, so narrowing here bought nothing and cost
     five languages their own month names and numerals. */
  locale: DisplayLocale,
  placeName: (iso3: string) => string = (iso3) => iso3,
  /** The question this turn answered — the source of a suggested draft. */
  question = '',
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
      : basis === 'GOVERNED_RECORD_UNAVAILABLE'
        ? governedGapText(payload, s)
        : (s.unavailableBecause[basis] ?? s.unavailable);
  const byExecutor = basis.startsWith('LANDED_');

  const retrieval = analysis?.retrievalContext;
  const searchLimited =
    retrieval != null && resolveEvidenceState(retrieval, sourceCount) === 'degraded-fallback';

  let freshness: string;
  /* Model-only background says it was not checked; background drawn from real sources says when. */
  if (badge === 'ref')
    freshness =
      sourceCount > 0 ? fill(s.freshness.referenceWithSources, checkedAt) : s.freshness.reference;
  else if (badge === 'clar')
    freshness = byExecutor ? s.askedBeforeAnswering : s.freshness.nothingRan;
  else if (badge === 'unavail')
    freshness = basis in s.unavailableBecause ? s.noAnswer : s.unavailable;
  else if (badge === 'insuf')
    freshness = fill(searchLimited ? s.freshness.limited : s.freshness.zero, checkedAt);
  else if (badge === 'rec') freshness = s.freshness.retainedRecord;
  else if (badge === 'calc') freshness = s.freshness.computed;
  else if (badge === 'part' && payload.verification?.asOf != null)
    /* CURRENT STATUS CORROBORATION R1 — as of the freshest corroborating report, never the
       model's generation time. */
    freshness = s.freshness
      .corroboratedAsOf(payload.verification.reports)
      .replace('{when}', formatUtc(payload.verification.asOf, locale) ?? '—');
  /* PUBLIC BETA HARDENING R1C — "Retained reporting" only when the answer actually rests on
     retained reporting (served from the store: dataMode 'cached' / outcome RETAINED_ONLY).
     A live answer — healthy or limited — says when it was checked; a limited one keeps its
     separate search-limited note. */
  else if (badge === 'cur')
    freshness =
      retrieval?.dataMode === 'cached' || retrieval?.outcome === 'RETAINED_ONLY'
        ? fill(s.freshness.retainedTo, retainedTo)
        : fill(s.freshness.checked, checkedAt);
  else freshness = fill(s.freshness.checked, checkedAt);
  /* BETA-ASK-005 — a bounded window is stated wherever retrieval ran under it. */
  const window = retrieval?.reportingWindow;
  if (window != null && badge !== 'clar' && badge !== 'unavail') {
    freshness = `${freshness} · ${s.freshness.publishedWindow
      .replace('{from}', formatUtc(window.from, locale) ?? '—')
      .replace('{to}', formatUtc(window.to, locale) ?? '—')}`;
  }

  const c = payload.chips;
  const items =
    c.kind === 'SCOPED'
      ? dedupeChips(
          c.chips.map((chip) => ({
            kind: chip.kind,
            label: chipLabel(chip, placeName, s),
            kept: !chip.applied,
          })),
        )
      : [];
  /* GOVERNED RETAINED GAP REPAIR R1 (G4) — when the router applied no geography but the
     governed geography contribution resolved a place (Gasabo), that place IS the visible scope.
     Display only: router semantics are unchanged. */
  const place = governedPlaceLabel(payload);
  if (place !== null && !items.some((i) => i.kind === 'GEOGRAPHY')) {
    items.push({ kind: 'GEOGRAPHY', label: place, kept: false });
  }
  /* ASK R3 RETRIEVAL POLICY CLOSEOUT R2 — a follow-up that continued the prior subject is not a
     "general question": the inherited subject IS its scope (display only; routing unchanged). */
  const inherited = analysis?.retrievalContext?.conversationSubject?.subject;
  const note =
    c.kind === 'NONE' && place === null
      ? inherited
        ? s.inheritedScope.replace('{subject}', inherited)
        : s.noScope
      : c.kind === 'NONE'
        ? null
        : c.kind === 'PENDING'
          ? s.scopePending
          : items.some((i) => i.kept)
            ? s.keptAsAsked
            : null;

  /* ALPHA VISUAL ACCEPTANCE REPAIR R1 (F) — every clarification asks something. */
  /* R3 §12 — "best for what?" offers objectives, never places; §23 a noted constraint offers none */
  const objectiveAsk = basis === 'DECISION_OBJECTIVE_MISSING';
  const candidates =
    basis === 'NO_PRIOR_SUBJECT' ||
    basis === 'CONSTRAINT_NOTED' ||
    basis === 'PRIOR_REFERENCE_UNRESOLVED'
      ? []
      : objectiveAsk
        ? (payload.answer.candidates ?? []).map((o) => s.r3.objectives[o] ?? o)
        : (payload.answer.candidates ?? []).map((iso3) => placeName(iso3));
  let lead: string | null = null;
  let suggestion: string | null = null;
  /* ASK RELIABILITY R1 (E) — "…about this place?" only when a PLACE is in play (candidates); a
     question that named no place gets the neutral "what should this cover" request instead. */
  if (basis === 'NO_PRIOR_SUBJECT') lead = (payload.answer.candidates ?? []).length > 0 ? s.noPriorSubject : s.clarify.fallback;
  /* R4 ALPHA R-4 — a reference to an earlier answer this conversation does not hold */
  else if (basis === 'PRIOR_REFERENCE_UNRESOLVED') lead = s.r4.priorReferenceUnresolved;
  else if (basis === 'CONSTRAINT_NOTED') lead = s.r3.constraintNoted;
  else if (objectiveAsk) lead = s.r3.decisionObjectiveMissing;
  else if (badge === 'clar' && candidates.length === 0) {
    if (basis === 'PLAN_BROADENING_OFFERED') {
      /* The reader's own words the plan could not apply, once each. */
      const notApplied: string[] = [];
      const timeTerms: string[] = [];
      for (const chip of c.kind === 'SCOPED' ? c.chips : []) {
        if (chip.applied || chip.kind === 'GEOGRAPHY' || chip.kind === 'SELECTION') continue;
        if (chip.kind === 'TIME') timeTerms.push(chip.value);
        if (!notApplied.some((v) => v.toLocaleLowerCase() === chip.value.toLocaleLowerCase())) {
          notApplied.push(chip.value);
        }
      }
      suggestion = withoutTerms(question, notApplied, timeTerms);
      lead = notApplied.length > 0 ? s.clarify.broadening(notApplied, suggestion !== null) : null;
    } else {
      const code = (payload.route?.clarification ?? []).find((c0) => c0 in s.clarify.codes);
      lead = code === undefined ? null : (s.clarify.codes[code] ?? null);
    }
    lead ??= s.clarify.fallback;
  }
  const trimmed = question.trim().replace(/[?.!]+$/, '');
  const choices =
    trimmed.length === 0
      ? []
      : candidates.map((label) => ({
          label,
          question: objectiveAsk ? s.r3.choiceFor(trimmed, label) : `${trimmed} (${label})?`,
        }));

  return {
    badge,
    badgeText: s.badges[badge],
    tone: TONE_OF[badge],
    freshness,
    searchLimited,
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
      candidates,
      /* MC-070: the place is kept as the plan's GEOGRAPHY chip, not inflected into the sentence. */
      lead,
      suggestion,
      choices,
    },
    verification: verificationOf(retrieval, s),
  };
}

/** ASK TRUTHFUL RETRIEVAL R2A — the reader's view of what was checked (server facts only). */
function verificationOf(
  retrieval: AnalysisRetrievalContext | null | undefined,
  s: AskR2Strings,
): AskR2View['verification'] {
  if (retrieval == null) return null;
  const trace = retrieval.retrievalTrace;
  const notice =
    retrieval.verificationNotice === undefined
      ? null
      : retrieval.verificationNotice === 'COVERAGE_INCOMPLETE'
        ? `${s.verification.notVerified} ${s.verification.coverageIncomplete}`
        : s.verification.notVerified;
  if (notice === null && trace === undefined && retrieval.claimAssessments === undefined)
    return null;
  const label = (lane: string) => s.verification.lanes[lane] ?? lane;
  const lanes =
    trace === undefined
      ? []
      : [
          ...trace.lanesSucceeded.map((lane) => ({
            label: label(lane),
            ok: true,
            status: s.verification.available,
          })),
          ...trace.lanesUnavailable.map((u) => ({
            label: label(u.lane),
            ok: false,
            status: `${s.verification.unavailable} (${s.verification.reasons[u.reason] ?? u.reason})`,
          })),
        ];
  const claims = (retrieval.claimAssessments ?? []).map((c) => ({
    text: c.text,
    state: c.state,
    label: s.verification.states[c.state] ?? c.state,
  }));
  return { notice, lanes, claims };
}
