/**
 * SUPPORT AI CONVERSATION V1 — THE TYPED TRANSCRIPT MODEL.
 *
 * Authority: F-SUPPORT-AI-CONVERSATION-V1-CONTRACT-1 (sha256
 * acd6e395…0d5eb1), files 01 (states, the typed projection), 03 (identity)
 * and 04 (the two kinds of non-answer).
 *
 * WHY FOUR TURN TYPES AND NOT ONE MESSAGE TYPE WITH A ROLE FIELD.
 *
 * `01` makes the loop guard a TYPE argument rather than a reachability
 * argument, and a role field would destroy exactly that: with one type, an
 * agent message becomes agent input by assigning a string, which is an
 * oversight rather than a reviewable act. Four disjoint types mean the only
 * way to feed agent output back into agent input is to write a named,
 * visible `AgentTurn -> UserTurn` conversion.
 *
 * The brand below closes the last hole. Disjoint `kind` literals already stop
 * direct assignment, but an object literal carrying `kind: 'USER'` and an
 * agent's body would still typecheck. `__userAuthored` is unique to UserTurn
 * and can only be produced by `userTurn()` in this file, so a transcript entry
 * that reaches the projection is one a person actually wrote.
 */

/** The seven states of `01`. No eighth, and no composite. */
export type ConversationState =
  | 'OPEN_AI'
  | 'AI_WORKING'
  | 'AI_WITHHELD'
  | 'AI_UNAVAILABLE'
  | 'HANDOFF_PENDING'
  | 'HUMAN'
  | 'CLOSED';

/** `02` H-1…H-9. Operator-facing only — never rendered to the reader (`04` F-1). */
export type HandoffTrigger = 'H-1' | 'H-2' | 'H-3' | 'H-4' | 'H-5' | 'H-6' | 'H-7' | 'H-8' | 'H-9';

/**
 * `04` — the machine key. Recorded for operators, NEVER rendered, never
 * encoded in a code, never implied by a difference in wording or timing.
 */
export type AgentSkipReason =
  | 'disabled'
  | 'not-eligible'
  | 'per-user-allowance'
  | 'concurrency'
  | 'timeout'
  | 'provider-failed'
  | 'no-evidence'
  | 'no-authored-match'
  | 'out-of-scope';

/**
 * Which dictionary string an agent turn renders when it carries no answer body.
 *
 * EVERY user-visible non-answer sentence lives in the Support dictionary and is
 * selected by one of these keys — never composed by the transport. That is what
 * makes the copy guards in `conversationCopy.spec.ts` guard the text a reader
 * actually sees, rather than a string that happens to sit beside it.
 *
 * WITHHELD and UNAVAILABLE are the two kinds of `04` and have ONE text each.
 * ACCOUNT_CANNOT_SEE and LOCALE_OUT_OF_SCOPE are not failures at all: they are
 * scope ANSWERS about what the agent can do (`02` H-2, `05` C-14), which is why
 * they may have their own words without violating F-1.
 */
export type AgentCopyKey = 'WITHHELD' | 'UNAVAILABLE' | 'ACCOUNT_CANNOT_SEE' | 'LOCALE_OUT_OF_SCOPE';

/** `01` — two answer sources, kept apart. One source per turn, never a blend. */
export type AnswerSource = 'AUTHORED' | 'ANALYSIS';

/**
 * `04` — what an agent turn actually is. WITHHELD and UNAVAILABLE are
 * different facts about the world and the reader is entitled to both.
 */
export type AgentOutcome = 'ANSWER' | 'PARTIAL' | 'WITHHELD' | 'UNAVAILABLE';

/**
 * A REAL runtime symbol, not a `declare const` phantom.
 *
 * E1 C-4 prohibits `as UserTurn` anywhere on the projection path, and a
 * type-only brand forces exactly that cast at the constructor. A real symbol
 * lets `userTurn()` build a branded object honestly, with no assertion
 * anywhere in this module.
 */
export const USER_AUTHORED: unique symbol = Symbol('GlobalNewsAI.UserTurn.userAuthored');

export interface UserTurn {
  readonly kind: 'USER';
  /** Brand — only `userTurn()` can produce it. See the docblock above. */
  readonly [USER_AUTHORED]: true;
  readonly id: string;
  readonly body: string;
  readonly at: string;
}

export interface AgentTurn {
  readonly kind: 'AGENT';
  readonly id: string;
  readonly at: string;
  readonly outcome: AgentOutcome;
  /** Absent on a non-answer: nothing was produced from either source. */
  readonly source: AnswerSource | null;
  readonly body: string;
  /** Set when `body` is empty: the dictionary string this turn renders. */
  readonly copyKey?: AgentCopyKey;
  /** ANALYSIS answers only. Never populated from the transcript (`01`, ASK RULE A). */
  readonly sources?: readonly { readonly id: string; readonly outlet: string }[];
  /** Operator-facing. Rendering this is a contract violation (`04` F-1, V-7). */
  readonly skipReason?: AgentSkipReason;
}

/**
 * E1 names this turn type `HumanTurn`; F's contract names it `OperatorTurn`.
 * They are the same thing. The F name is the declaration because the F
 * contract is the input authority for the model, and the E1 name is exported
 * as an alias below so a reader of either document finds the type they expect.
 */
export interface OperatorTurn {
  readonly kind: 'OPERATOR';
  readonly id: string;
  readonly at: string;
  readonly body: string;
  /**
   * `03` I-1/I-2 — a real operator identifier exists on a person's turn and is
   * `null` on the agent's. The UI never renders it; it exists so the two can
   * never be confused at the type level.
   */
  readonly operatorId: string;
}

/**
 * `03` I-4 — the transition is a VISIBLE TURN, not a silent state change. A
 * system turn carries a notice key, never free text, so it can never become a
 * channel for an invented operational fact (`04` F-6).
 */
export type SystemNotice = 'QUEUED' | 'HUMAN_ARRIVED' | 'CLOSED' | 'SENSITIVE_VOLUNTEERED';

export interface SystemTurn {
  readonly kind: 'SYSTEM';
  readonly id: string;
  readonly at: string;
  readonly notice: SystemNotice;
}

export type Turn = UserTurn | AgentTurn | OperatorTurn | SystemTurn;

/** E1's name for `OperatorTurn`. One type, two authorities, no second shape. */
export type HumanTurn = OperatorTurn;

export interface Conversation {
  readonly id: string;
  readonly locale: 'en' | 'pl';
  readonly state: ConversationState;
  readonly turns: readonly Turn[];
  /**
   * `02` — which trigger fired, operator-facing. Held so an escalation record
   * exists; never rendered.
   */
  readonly trigger: HandoffTrigger | null;
}

/** The ONLY constructor of a `UserTurn`. No cast — see the symbol note above. */
export function userTurn(input: { id: string; body: string; at: string }): UserTurn {
  return {
    kind: 'USER',
    [USER_AUTHORED]: true,
    id: input.id,
    body: input.body,
    at: input.at,
  };
}

/**
 * E1 C-2 — AN ALLOWLIST, NEVER A DENYLIST.
 *
 *     REQUIRED   turns.filter((t): t is UserTurn => t.kind === 'USER')
 *     REFUSED    turns.filter((t) => t.kind !== 'AGENT')
 *
 * Under the allowlist a turn kind added next year is silently EXCLUDED, which
 * is survivable. Under the denylist it is silently INCLUDED, and nothing makes
 * anyone notice. The same oversight, opposite consequences.
 */
export function isUserTurn(turn: Turn): turn is UserTurn {
  return turn.kind === 'USER';
}

/**
 * E1 C-4 — PARSE AT THE BOUNDARY; NEVER CAST.
 *
 * Types are erased at runtime, and the transcript the projection runs over
 * will one day be loaded from a database rather than built in this process.
 * This is where a stored row becomes a `Turn`: every discriminant is checked,
 * every required field is checked, and anything unrecognised is DROPPED rather
 * than coerced.
 *
 * There is no `as Turn`, no `as unknown as`, and no non-null assertion on this
 * path — each kind is CONSTRUCTED from validated fields, which is why a row
 * with the right `kind` and the wrong shape cannot slip through wearing a
 * type it does not have.
 *
 * A stored row cannot carry a symbol through JSON, so a row the SERVER
 * classified as a user turn is re-branded here and nowhere else. That is also
 * the frontend half of C-3: this code trusts the server's classification of a
 * row and never a `kind` the browser put in a request.
 */
/**
 * Reads one property as `unknown`. `Reflect.get` is used rather than an index
 * signature so that not even a widening `as Record<string, unknown>` appears
 * on this path — E1 C-4 is a rule about the whole path, and a guard that
 * permits "harmless" casts is a guard that has to judge which ones are
 * harmless.
 */
function field(row: object, key: string): unknown {
  return Object.prototype.hasOwnProperty.call(row, key) ? Reflect.get(row, key) : undefined;
}

export function parseTranscript(rows: readonly unknown[]): readonly Turn[] {
  const parsed: Turn[] = [];

  for (const row of rows) {
    if (typeof row !== 'object' || row === null) continue;
    const r = {
      kind: field(row, 'kind'),
      id: field(row, 'id'),
      at: field(row, 'at'),
      body: field(row, 'body'),
      outcome: field(row, 'outcome'),
      source: field(row, 'source'),
      operatorId: field(row, 'operatorId'),
      notice: field(row, 'notice'),
    };

    const kind = r.kind;
    const id = r.id;
    const at = r.at;
    if (typeof kind !== 'string' || typeof id !== 'string' || typeof at !== 'string') continue;

    if (kind === 'USER') {
      if (typeof r.body !== 'string') continue;
      parsed.push(userTurn({ id, body: r.body, at }));
      continue;
    }

    if (kind === 'AGENT') {
      if (typeof r.body !== 'string') continue;
      const outcome = r.outcome;
      if (outcome !== 'ANSWER' && outcome !== 'PARTIAL' && outcome !== 'WITHHELD' && outcome !== 'UNAVAILABLE') {
        continue;
      }
      const source = r.source === 'AUTHORED' || r.source === 'ANALYSIS' ? r.source : null;
      parsed.push({ kind: 'AGENT', id, at, outcome, source, body: r.body });
      continue;
    }

    if (kind === 'OPERATOR') {
      if (typeof r.body !== 'string' || typeof r.operatorId !== 'string') continue;
      parsed.push({ kind: 'OPERATOR', id, at, body: r.body, operatorId: r.operatorId });
      continue;
    }

    if (kind === 'SYSTEM') {
      const notice = r.notice;
      if (
        notice !== 'QUEUED' &&
        notice !== 'HUMAN_ARRIVED' &&
        notice !== 'CLOSED' &&
        notice !== 'SENSITIVE_VOLUNTEERED'
      ) {
        continue;
      }
      parsed.push({ kind: 'SYSTEM', id, at, notice });
      continue;
    }

    // An unrecognised kind is dropped. Under C-2's allowlist that is the safe
    // direction: a turn type added next year is silently excluded from the
    // projection rather than silently included in it.
  }

  return parsed;
}
