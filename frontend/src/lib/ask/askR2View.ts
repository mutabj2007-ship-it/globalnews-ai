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

export type AskR2Badge = 'ref' | 'ver' | 'cur' | 'clar' | 'part' | 'insuf' | 'unavail' | 'rec';

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
export function withoutTerms(question: string, terms: readonly string[]): string | null {
  if (terms.length === 0) return null;
  let out = question;
  for (const term of terms) {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(String.raw`(^|[^\p{L}\p{N}])${escaped}(?=$|[^\p{L}\p{N}])`, 'iu');
    if (!re.test(out)) return null;
    out = out.replace(re, '$1');
  }
  out = out
    .replace(/\s+([?.!,;:])/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim();
  return out.length > 0 && out !== question.trim() ? out : null;
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

export function askR2View(
  payload: AskR2Payload,
  s: AskR2Strings,
  locale: AskR2Locale,
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
  else if (badge === 'rec') freshness = s.freshness.retainedRecord;
  else if (badge === 'part' && payload.verification?.asOf != null)
    /* CURRENT STATUS CORROBORATION R1 — as of the freshest corroborating report, never the
       model's generation time. */
    freshness = s.freshness
      .corroboratedAsOf(payload.verification.reports)
      .replace('{when}', formatUtc(payload.verification.asOf, locale) ?? '—');
  else if (badge === 'cur') freshness = fill(s.freshness.retainedTo, retainedTo);
  else freshness = fill(s.freshness.checked, checkedAt);

  const c = payload.chips;
  const items =
    c.kind === 'SCOPED'
      ? dedupeChips(
          c.chips.map((chip) => ({
            kind: chip.kind,
            label: chipLabel(chip, placeName),
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
  const note =
    c.kind === 'NONE' && place === null
      ? s.noScope
      : c.kind === 'NONE'
        ? null
        : c.kind === 'PENDING'
          ? s.scopePending
          : items.some((i) => i.kept)
            ? s.keptAsAsked
            : null;

  /* ALPHA VISUAL ACCEPTANCE REPAIR R1 (F) — every clarification asks something. */
  const candidates =
    basis === 'NO_PRIOR_SUBJECT'
      ? []
      : (payload.answer.candidates ?? []).map((iso3) => placeName(iso3));
  let lead: string | null = null;
  let suggestion: string | null = null;
  if (basis === 'NO_PRIOR_SUBJECT') lead = s.noPriorSubject;
  else if (badge === 'clar' && candidates.length === 0) {
    if (basis === 'PLAN_BROADENING_OFFERED') {
      /* The reader's own words the plan could not apply, once each. */
      const notApplied: string[] = [];
      for (const chip of c.kind === 'SCOPED' ? c.chips : []) {
        if (chip.applied || chip.kind === 'GEOGRAPHY' || chip.kind === 'SELECTION') continue;
        if (!notApplied.some((v) => v.toLocaleLowerCase() === chip.value.toLocaleLowerCase())) {
          notApplied.push(chip.value);
        }
      }
      suggestion = withoutTerms(question, notApplied);
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
      : candidates.map((label) => ({ label, question: `${trimmed} (${label})?` }));

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
      candidates,
      /* MC-070: the place is kept as the plan's GEOGRAPHY chip, not inflected into the sentence. */
      lead,
      suggestion,
      choices,
    },
  };
}
