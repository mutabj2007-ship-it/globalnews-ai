import {
  ARTIFACT_MAX_COMPONENTS,
  type ArtifactKind,
  type PriorArtifact,
} from './conversation-artifact';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * PRIOR-WORK REFERENCE RESOLUTION — AGAINST BOUNDED STATE, NOT AGAINST TEXT
 * ════════════════════════════════════════════════════════════════════════════
 *
 * CLAUDE F · R4_PARALLEL · prior-work reference repair. Base `782b175`.
 *
 * The family this closes: "why did you say X", "why did you recommend Y", "what did you mean when
 * you called it Z", "you said X earlier — why?". It scored 0/12 across the product languages.
 *
 * ── WHY THIS MODULE EXISTS RATHER THAN A WIDER REGEX ──────────────────────
 *
 * The question "which words did the reader use?" is the question that produced two regex banks
 * covering seven display languages, and five of those languages were being read with the English
 * bank's vocabulary. This module asks the other question instead:
 *
 *     does this conversation HOLD a model-created artifact, and does this turn point at it?
 *
 * The first half is a lookup in bounded state and is therefore language-independent by
 * construction. The second half is the only part that must read the turn, and it is supplied by the
 * caller — the EN/PL deterministic reference form where those readers legitimately apply, and the
 * ONE bounded interpreter verdict for `fr / de / es / pt / ar`, which is the standing ruling. This
 * module adds no language table of its own and never inspects grammar.
 *
 * ── THE RULE THAT SHAPES EVERY BRANCH BELOW (F-5) ─────────────────────────
 *
 * At the base this repairs, the false-reference control passed ONLY BECAUSE EVERYTHING FAILED.
 * Detection was broken, so nothing could be mis-resolved. Improve detection without making
 * resolution *checkable* and the system starts answering "I said X" about things it never said —
 * a worse defect than the one being fixed, and the one invariant this lane was given.
 *
 * So resolution FAILS CLOSED. There are four outcomes and three of them decline to assert
 * anything:
 *
 *   NO_REFERENCE          the turn does not point backwards. An ordinary turn; no clarification.
 *   RESOLVED              one prior artifact, identified, WITH the turn that produced it.
 *   NEEDS_INTERPRETATION  the turn points backwards and bounded state alone cannot say at what.
 *                         The caller escalates (`PRIOR_WORK_REFERENCE`); never a guess, and never
 *                         "the only artifact in state, so it must be that one".
 *   UNRESOLVABLE          it points backwards and cannot be grounded. The governed clarification.
 *
 * There is deliberately no branch that resolves a reference because exactly one artifact happens
 * to be in state. "Why did you say Finland should leave the euro?" asked of a conversation holding
 * a recommendation about a pilot has exactly one candidate, and the correct answer is still that
 * nothing of the sort was said.
 */

/* ══════════════════════════════════════════════════════════════════════════
 * 1 · WHAT A REFERENCE CAN POINT AT
 * ══════════════════════════════════════════════════════════════════════════ */

/**
 * `ARTIFACT_PROPOSITION` is the member the core vocabulary does not have, and its absence is why a
 * correct detection had nowhere to land. `ARTIFACT` is the work as a whole; `ARTIFACT_COMPONENT` is
 * one of the ≤ 8 names the artifact itself declared; an `ARTIFACT_PROPOSITION` is **a thing the
 * assistant asserted**, which need never have been one of those names.
 *
 * The three are kept apart because the executor must behave differently: `ARTIFACT` asks for work
 * to be operated on, while `ARTIFACT_PROPOSITION` asks for the REASONING BEHIND A CLAIM ALREADY
 * MADE — an explanation of own prior work, which must never become a request for current evidence.
 *
 * This list is this module's own. Adding the member to the core `IrReferenceTarget` union lives in
 * `semantic-turn-ir.ts`, which is not this lane's file: it is delivered as an exact proposed diff
 * (04-F-IMPLEMENTATION-REPORT.md · PROPOSED-1) rather than applied, so this module compiles and is
 * testable on `782b175` exactly as it stands.
 */
export const PRIOR_REFERENCE_TARGETS = [
  'ARTIFACT',
  'ARTIFACT_COMPONENT',
  'ARTIFACT_PROPOSITION',
  'CHOICE_SET',
  'PORTABLE_SUBJECT',
] as const;
export type PriorReferenceTarget = (typeof PRIOR_REFERENCE_TARGETS)[number];

/**
 * How the caller established that this turn points backwards.
 *
 * `SELF_ATTRIBUTION` and `DEMONSTRATIVE` are what the EN/PL deterministic reference forms can
 * establish. `INTERPRETER` is the one bounded verdict, and it is the only kind that can carry
 * `grounded` — see `grounded`'s own note, which is the load-bearing field in this file.
 */
export type PointsBack =
  | { readonly kind: 'NONE' }
  /** "why did you say / recommend / mean …" — the reader attributes a claim to the assistant */
  | { readonly kind: 'SELF_ATTRIBUTION' }
  /** "that idea", "which part", "the weakest assumption" — points at a structure, not a claim */
  | { readonly kind: 'DEMONSTRATIVE' }
  | {
      readonly kind: 'INTERPRETER';
      readonly target: PriorReferenceTarget | 'NONE';
      /**
       * THE INTERPRETER AFFIRMED THAT THE TURN REFERS TO SOMETHING PRESENT IN THE EARLIER WORK IT
       * WAS SHOWN.
       *
       * Not "the interpreter named a target" — a model asked to pick from a closed list will pick
       * from a closed list. This is the separate, explicit yes/no that distinguishes a PARAPHRASE
       * of something really said from a CLAIM NEVER MADE, and no amount of string matching can
       * stand in for it: "the smaller start was the safer bet" shares no token with
       * `["lower risk","faster feedback","reversible","smaller budget"]`, and
       * "Finland should leave the euro" shares none either.
       *
       * Absent or false → `UNRESOLVABLE`. The field is optional because the verdict shape that
       * carries it is a proposed change to the interpreter contract (PROPOSED-2), and an absent
       * affirmation must read as "not affirmed", never as "probably fine".
       */
      readonly grounded?: boolean;
    };

export const UNRESOLVABLE_REASONS = [
  /** the turn points backwards and the conversation holds no model work at all */
  'NO_PRIOR_WORK_IN_STATE',
  /** two or more artifacts are equally good candidates and nothing distinguishes them */
  'SEVERAL_CANDIDATES',
  /** a claim is attributed to the assistant that the held work does not carry */
  'PROPOSITION_NOT_IN_ARTIFACT',
  /** the one bounded call was required and produced nothing usable */
  'NO_VALID_INTERPRETATION',
] as const;
export type UnresolvableReason = (typeof UNRESOLVABLE_REASONS)[number];

export const RESOLUTION_BASES = [
  /** a component the artifact itself declared appears in the turn */
  'COMPONENT_IDENTITY',
  /** the artifact's own label appears in the turn */
  'LABEL_IDENTITY',
  /** the bounded interpreter verdict, affirmed as grounded in the work it was shown */
  'INTERPRETER_VERDICT',
] as const;
export type ResolutionBasis = (typeof RESOLUTION_BASES)[number];

export interface ResolvedPriorReference {
  readonly target: PriorReferenceTarget;
  /**
   * WHICH PRIOR TURN. Required, not optional: a resolution that cannot be traced to a turn is the
   * thing the invariant forbids, so it is made unrepresentable rather than validated later.
   */
  readonly sourceOperationId: string;
  readonly artifactKind: ArtifactKind;
  readonly artifactLabel: string;
  /** the declared component this reference landed on, or null for a whole-artifact reference */
  readonly component: string | null;
  /** a named mechanism, never a score — "0.82 confident" is not a reason an operator can check */
  readonly basis: ResolutionBasis;
}

export type PriorReferenceOutcome =
  | { readonly state: 'NO_REFERENCE' }
  | { readonly state: 'RESOLVED'; readonly resolved: ResolvedPriorReference }
  | { readonly state: 'NEEDS_INTERPRETATION'; readonly candidates: number }
  | { readonly state: 'UNRESOLVABLE'; readonly because: UnresolvableReason };

export interface PriorReferenceInput {
  /** the reader's turn, in their own language, never translated */
  readonly turn: string;
  /** every artifact THIS conversation holds, newest first. Another thread's artifacts never appear. */
  readonly artifacts: readonly PriorArtifact[];
  readonly pointsBack: PointsBack;
  readonly choiceSet?: readonly string[];
  readonly portableSubject?: string | null;
}

/* ══════════════════════════════════════════════════════════════════════════
 * 2 · IDENTITY — THE ONLY TEXT OPERATION IN THIS FILE
 * ══════════════════════════════════════════════════════════════════════════ */

/**
 * Case- and diacritic-folded containment of a surface the ARTIFACT supplied.
 *
 * This is not a language rule: the needle is a string the artifact itself declared, so the same
 * operation works in all seven display languages and in none of them differently. NFD + combining-
 * mark removal makes "piloté" match "pilote" and "ЛУЧШЕ" match "лучше"; Arabic and Latin both fold
 * by the same rule rather than by a per-script branch.
 *
 * Bounded at `ARTIFACT_MAX_COMPONENTS` needles per artifact by the artifact contract itself, so
 * this cannot become a scan over arbitrary text.
 */
export function fold(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ًͯ-ْ]/gu, '')
    .toLowerCase()
    .replace(/[‐-―]/gu, '-')
    .replace(/\s+/gu, ' ')
    .trim();
}

/** Does the turn contain this artifact-supplied surface? Empty and one-character needles never match. */
function mentions(turnFolded: string, surface: string): boolean {
  const needle = fold(surface);
  return needle.length >= 2 && turnFolded.includes(needle);
}

/**
 * A COMPONENT SURFACE THAT OCCURS ONLY INSIDE THE LABEL'S OCCURRENCE IS THE LABEL.
 *
 * Artifacts name themselves and their parts in the same words: a framework labelled "Moment clé"
 * with a component "moment", or "Kluczowy moment" with "moment". A reader quoting the label then
 * trips the component test too, and the reference is reported as being about one part of the work
 * when it was about the work. The reader was MORE general, not more specific, and the two readings
 * send an answer in different directions.
 *
 * So a component counts only where it appears somewhere the label does not already cover. Every
 * occurrence is checked, not the first: "the review in your 90-day review plan" names the component
 * outside the label as well as inside it, and that is a genuine component reference.
 */
function inside(turnFolded: string, label: string, component: string): boolean {
  const l = fold(label);
  const c = fold(component);
  if (l.length === 0 || c.length === 0 || !l.includes(c)) return false;
  for (let at = turnFolded.indexOf(c); at !== -1; at = turnFolded.indexOf(c, at + 1)) {
    const covered = turnFolded.lastIndexOf(l, at);
    if (!(covered !== -1 && covered + l.length >= at + c.length)) return false;
  }
  return true;
}

interface Candidate {
  readonly artifact: PriorArtifact;
  readonly component: string | null;
  readonly basis: 'COMPONENT_IDENTITY' | 'LABEL_IDENTITY';
}

/**
 * Artifacts the turn identifies by a surface they themselves declared.
 *
 * A component match outranks a label match for the same artifact: the reader who names a component
 * is being more specific than the reader who names the work, and resolving the specific reference
 * to the whole artifact loses exactly the distinction the question asked about.
 */
export function identifyCandidates(
  turn: string,
  artifacts: readonly PriorArtifact[],
): readonly Candidate[] {
  const t = fold(turn);
  const found: Candidate[] = [];
  for (const artifact of artifacts) {
    const labelled = mentions(t, artifact.label);
    const component =
      artifact.components
        .slice(0, ARTIFACT_MAX_COMPONENTS)
        .find((c) => mentions(t, c) && !(labelled && inside(t, artifact.label, c))) ?? null;
    if (component !== null) {
      found.push({ artifact, component, basis: 'COMPONENT_IDENTITY' });
      continue;
    }
    if (labelled) found.push({ artifact, component: null, basis: 'LABEL_IDENTITY' });
  }
  return Object.freeze(found);
}

/* ══════════════════════════════════════════════════════════════════════════
 * 3 · THE RESOLVER
 * ══════════════════════════════════════════════════════════════════════════ */

const resolvedFrom = (
  candidate: Candidate,
  target: PriorReferenceTarget,
  basis: ResolutionBasis,
): PriorReferenceOutcome => ({
  state: 'RESOLVED',
  resolved: Object.freeze({
    target,
    sourceOperationId: candidate.artifact.sourceOperationId,
    artifactKind: candidate.artifact.kind,
    artifactLabel: candidate.artifact.label,
    component: candidate.component,
    basis,
  }),
});

/**
 * Pure. No I/O, no clock, no model, no transcript — the whole input is bounded state plus this
 * turn's own text.
 */
export function resolvePriorReference(input: PriorReferenceInput): PriorReferenceOutcome {
  const { pointsBack } = input;

  /* ── 1 · nothing points backwards ──────────────────────────────────────────────────────── */
  if (pointsBack.kind === 'NONE') return { state: 'NO_REFERENCE' };
  if (pointsBack.kind === 'INTERPRETER' && pointsBack.target === 'NONE')
    return { state: 'NO_REFERENCE' };

  /* ── 2 · it points backwards; state must be able to support it ─────────────────────────── */
  /*
    Checked BEFORE the interpreter verdict is trusted, and before any text is examined. A verdict
    naming an artifact in a conversation that holds none is not a reference to resolve: it is a
    verdict about something that is not there, and the honest answer is a clarification. This is
    also the cross-thread isolation case — another conversation's artifact is simply not in
    `artifacts`, so the identical turn text resolves here and declines there.
  */
  if (input.artifacts.length === 0) {
    const elsewhere =
      pointsBack.kind === 'INTERPRETER' &&
      (pointsBack.target === 'CHOICE_SET' || pointsBack.target === 'PORTABLE_SUBJECT');
    if (!elsewhere) return { state: 'UNRESOLVABLE', because: 'NO_PRIOR_WORK_IN_STATE' };
  }

  /* ── 3 · a reference to the reader's OWN material, not to model work ───────────────────── */
  /*
    The R3 rule, untouched: the reader's options, objectives and subject come from the reader's own
    turns. These two targets are recorded and handed back without consulting an artifact, so a
    choice set can never be answered out of model work, and model work can never become the
    reader's objective.
  */
  if (pointsBack.kind === 'INTERPRETER' && pointsBack.target === 'CHOICE_SET')
    return (input.choiceSet?.length ?? 0) > 0
      ? { state: 'NEEDS_INTERPRETATION', candidates: input.choiceSet?.length ?? 0 }
      : { state: 'UNRESOLVABLE', because: 'NO_PRIOR_WORK_IN_STATE' };
  if (pointsBack.kind === 'INTERPRETER' && pointsBack.target === 'PORTABLE_SUBJECT')
    return input.portableSubject != null && input.portableSubject.length > 0
      ? { state: 'NEEDS_INTERPRETATION', candidates: 1 }
      : { state: 'UNRESOLVABLE', because: 'NO_PRIOR_WORK_IN_STATE' };

  /* ── 4 · identity: a surface the artifact itself declared ──────────────────────────────── */
  const candidates = identifyCandidates(input.turn, input.artifacts);
  const specific = candidates.filter((c) => c.basis === 'COMPONENT_IDENTITY');
  const pool = specific.length > 0 ? specific : candidates;

  if (pool.length > 1) {
    /*
      TWO ARTIFACTS, EQUALLY NAMED. The nearest one is not the right one — "go back to the framework
      you gave before the comparison" names the older artifact on purpose, and resolving to the
      newer is a wrong answer delivered confidently. Nothing in bounded state breaks this tie, so
      the interpreter is asked; if it has already spoken, the reader is.
    */
    return pointsBack.kind === 'INTERPRETER'
      ? { state: 'UNRESOLVABLE', because: 'SEVERAL_CANDIDATES' }
      : { state: 'NEEDS_INTERPRETATION', candidates: pool.length };
  }

  if (pool.length === 1) {
    const only = pool[0];
    const target: PriorReferenceTarget =
      pointsBack.kind === 'INTERPRETER' && pointsBack.target !== 'NONE'
        ? pointsBack.target
        : pointsBack.kind === 'SELF_ATTRIBUTION'
          ? /* a claim is being attributed to us: the component IS the proposition, when named */
            'ARTIFACT_PROPOSITION'
          : only.basis === 'COMPONENT_IDENTITY'
            ? 'ARTIFACT_COMPONENT'
            : 'ARTIFACT';
    return resolvedFrom(
      only,
      target,
      pointsBack.kind === 'INTERPRETER' && pointsBack.grounded === true
        ? 'INTERPRETER_VERDICT'
        : only.basis,
    );
  }

  /* ── 5 · it points backwards, state holds work, and identity found nothing ─────────────── */
  /*
    The paraphrase and the fabrication are INDISTINGUISHABLE HERE, and that is not a gap in this
    function — it is a fact about the inputs. "Earlier you argued the smaller start was the safer
    bet" and "why did you say Finland should leave the euro" both share no declared surface with
    the artifact; one is a faithful paraphrase and the other was never said. Only a reader of both
    the turn and the earlier work can tell them apart, which is what the one bounded interpreter
    call is for.

    So: not yet asked → ask (NEEDS_INTERPRETATION). Asked and it affirmed grounding → resolve
    against the single artifact it was shown. Asked and it did NOT affirm → decline.

    `grounded !== true` covers both a false affirmation and an ABSENT one, and absent is the state
    today, because the verdict field that carries it is a proposed change to the interpreter
    contract. Until that lands this branch declines, which is the direction a reference resolver
    must fail in.
  */
  if (pointsBack.kind !== 'INTERPRETER')
    return { state: 'NEEDS_INTERPRETATION', candidates: input.artifacts.length };
  if (pointsBack.grounded !== true)
    return { state: 'UNRESOLVABLE', because: 'PROPOSITION_NOT_IN_ARTIFACT' };
  if (input.artifacts.length > 1) return { state: 'UNRESOLVABLE', because: 'SEVERAL_CANDIDATES' };
  return resolvedFrom(
    { artifact: input.artifacts[0], component: null, basis: 'LABEL_IDENTITY' },
    pointsBack.target === 'NONE' ? 'ARTIFACT_PROPOSITION' : pointsBack.target,
    'INTERPRETER_VERDICT',
  );
}

/**
 * The one thing a caller must never do with an unresolved reference: treat it as a reason to go
 * looking for news.
 *
 * Measured at this base: the same turn with a present-tense marker became `CURRENT_REPORTING`. An
 * unfamiliar reference phrase is evidence that something was referred to, never evidence that the
 * world has changed, and a reader who asks why we said something is owed either the reasoning or a
 * question — not a news search.
 */
export function referenceMayRequestCurrentEvidence(outcome: PriorReferenceOutcome): boolean {
  return outcome.state === 'NO_REFERENCE';
}

/** Whether the caller must escalate to the one bounded interpretation for this turn. */
export function referenceNeedsInterpretation(outcome: PriorReferenceOutcome): boolean {
  return outcome.state === 'NEEDS_INTERPRETATION';
}

/** Whether the governed focused clarification is the correct outcome for this turn. */
export function referenceNeedsClarification(outcome: PriorReferenceOutcome): boolean {
  return outcome.state === 'UNRESOLVABLE';
}
