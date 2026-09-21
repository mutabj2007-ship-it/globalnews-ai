/**
 * BETA-SIMPLE-ASK-SAND-1 §3 — Ask AI Conversational V2 contracts.
 *
 * Upgrades Ask from the disposable single-question interaction that
 * exists today (one stateless `POST /analysis/news`, no thread, no
 * turns, no history — see the §1 inspection report) into a persistent
 * conversational surface.
 *
 * WHAT THIS DOES NOT DO: it does not replace AnalysisApiResponse. An
 * Ask turn CARRIES an AnalysisApiResponse as its answer payload, so
 * every existing consumer of that contract — AnalysisResultView,
 * TrustBadge, SourceArticleCard, the Sources Dock, the Complete
 * Analysis Record — keeps working against the exact type it already
 * knows, unchanged. §26's regression protection depends on that, and
 * §3's "do not replace the accepted Ask visual system unnecessarily"
 * asks for it directly.
 */

import type { AnalysisApiResponse, LanguageCode } from './analysis';
import type { ComputeClass, ComputeCostTelemetry, EntitlementState } from './compute';

/**
 * §4 — the shared navigation context that travels with a conversation.
 *
 * The product problem §4 describes is that a user goes
 * Map → Situation → Ask → Analysis → Full Analysis and cannot get
 * back. The cause is that each of those surfaces knows only its own
 * route. This object is the missing piece: the thing that remembers
 * where the user came from and what they were looking at.
 *
 * It is deliberately a small, serializable value object, not a router.
 * §4: "do not create a new global router architecture unless the
 * existing framework genuinely requires it" — Next.js App Router does
 * not require it. Browser Back keeps working because nothing here
 * intercepts navigation; this only adds the contextual
 * "← Rwanda" / "← Energy" affordances alongside it.
 */
export interface AskContext {
  /** The route the user entered this chain from, e.g. '/map' or '/energy'. */
  originRoute?: string;
  /** Human label for the origin, for a "← World Map" control. */
  originLabel?: string;
  /** ISO alpha-2, uppercase. The geography in play. */
  countryCode?: string;
  /** Display name for countryCode, resolved at capture time. */
  countryName?: string;
  /** The selected subject/situation (e.g. a story or situation id). */
  subjectId?: string;
  /** Human label for subjectId. */
  subjectLabel?: string;
  /** The Beta category/module in play (§15/§17). */
  module?: BetaCategory;
  /** Time window in play, e.g. '24h' | '7d' | '30d'. */
  timeWindow?: string;
}

/**
 * §15/§21 — the public Beta category surfaces.
 *
 * `world` is included because §21 lists `/world` as a real route
 * alongside the four topic routes; it is the "current developments"
 * surface, not a fifth topic.
 */
export type BetaCategory = 'world' | 'economy' | 'energy' | 'security' | 'humanitarian';

export const BETA_CATEGORIES: readonly BetaCategory[] = [
  'world',
  'economy',
  'energy',
  'security',
  'humanitarian',
] as const;

export function isBetaCategory(value: string): value is BetaCategory {
  return (BETA_CATEGORIES as readonly string[]).includes(value);
}

/** Who a turn came from. */
export type AskTurnRole = 'user' | 'assistant';

/**
 * §3 — the outcome of one assistant turn.
 *
 * This is a superset of what AnalysisProvenance.status already
 * expresses, because §3 requires the UI to distinguish states that
 * provenance does not model: a turn can fail before any analysis is
 * attempted (the request was refused as not-entitled, or the caller
 * declined a Deep Analysis quote), and those are not
 * "provider failures".
 */
export type AskTurnStatus =
  /** A validated answer was produced (freshly or by stored-result reuse). */
  | 'answered'
  /** §3 "no-report state" — retrieval found nothing to answer from. */
  | 'no-evidence'
  /** §3 "provider failure state". */
  | 'provider-failed'
  /** §3 "analysis failure state" — the provider answered but analysis could not be completed. */
  | 'analysis-failed'
  /** §3 "structurally invalid response state" — the provider's output failed validation. */
  | 'invalid-response'
  /** §9 — classified above the confirmation threshold; awaiting explicit user confirmation. */
  | 'awaiting-confirmation'
  /** The caller is not entitled, or their fair-use quota is exhausted. */
  | 'blocked';

/**
 * One turn in a conversation.
 *
 * A user turn carries `question` and no `answer`. An assistant turn
 * carries `answer` (possibly null, when `status` is a failure state)
 * and no `question`. They are modelled as one type rather than two so
 * a thread is a single ordered list — the thing a scrollable
 * conversation view actually needs.
 */
export interface AskTurn {
  id: string;
  threadId: string;
  /** 1-based position within the thread. Stable, never renumbered. */
  sequence: number;
  role: AskTurnRole;
  /** Present on user turns: the verbatim question, never rewritten. */
  question?: string;
  /** Present on assistant turns that produced an answer. */
  answer?: AnalysisApiResponse | null;
  status: AskTurnStatus;
  /** §5 — the server-decided class for the work this turn required. */
  computeClass?: ComputeClass;
  /** §6 — true when this turn was satisfied by replaying a stored result. */
  storedResultReused?: boolean;
  /** The metered operation backing this turn, when one exists. */
  operationId?: string;
  createdAt: string;
}

/**
 * A persistent Ask conversation.
 *
 * §3 requires "stable Ask thread/session identity" and "persisted
 * thread state where account/session architecture permits". The
 * qualifier matters and is honored by `ownerKind`: this product treats
 * guests as first-class (every AI capability today is
 * unauthenticated — see §1 inspection), so a thread must be usable by
 * an anonymous visitor. An anonymous thread is owned by an opaque
 * session key; a signed-in thread is owned by a userId and survives
 * across devices.
 */
export type AskThreadOwnerKind = 'user' | 'anonymous';

export interface AskThread {
  id: string;
  ownerKind: AskThreadOwnerKind;
  /** Present only when ownerKind is 'user'. */
  userId?: string;
  /** Short display title, derived from the first question. */
  title: string;
  language: LanguageCode;
  /** §4 — the navigation context this conversation was started from. */
  context: AskContext;
  createdAt: string;
  updatedAt: string;
}

/** A thread plus its turns, in sequence order. What the conversation view renders. */
export interface AskThreadWithTurns {
  thread: AskThread;
  turns: readonly AskTurn[];
}

/**
 * Request body for adding a turn to a thread.
 *
 * `idempotencyKey` is required, not optional. §12 calls idempotency a
 * release requirement and lists double click, browser retry, refresh,
 * frontend reconnect, HTTP retry, Railway retry and worker retry as
 * the cases that must never double-charge. An optional key would be
 * omitted by exactly the naive caller those cases describe, so the
 * contract makes it mandatory and the DTO validates it.
 */
export interface AskTurnRequest {
  question: string;
  language?: LanguageCode;
  /** §4 — context carried into Ask from the originating surface. */
  context?: AskContext;
  idempotencyKey: string;
  /**
   * §9 — set true only after the user has explicitly confirmed a quote.
   * A request without it that classifies at or above the confirmation
   * threshold comes back as 'awaiting-confirmation' with a quote
   * attached, and runs nothing.
   *
   * §20: this never lets a caller BUY a cheaper classification. It only
   * says "I have seen the quote you gave me". The class is recomputed
   * server-side regardless of what the client sends.
   */
  confirmedOperationId?: string;
}

/**
 * Response envelope for one Ask turn.
 *
 * Carries BOTH turns produced by the exchange (the user's and the
 * assistant's) so the client can append them without guessing
 * sequence numbers or re-fetching the thread.
 */
export interface AskTurnResponse {
  threadId: string;
  userTurn: AskTurn;
  assistantTurn: AskTurn;
  /**
   * §9 — present when assistantTurn.status is 'awaiting-confirmation'.
   * The UI renders this as the quote panel; nothing has executed.
   */
  quote?: import('./compute').SandQuote;
  /** §14 — Admin-side only. Never rendered on a public surface. */
  telemetry?: ComputeCostTelemetry;
  /** §8 — what this caller's entitlement allowed for this turn. */
  entitlementState: EntitlementState;
  /** §12 — true when this response replays an earlier identical submission. */
  reused: boolean;
}

/**
 * §17 — the reusable simple category view contract.
 *
 * §17 explicitly asks for ONE reusable template rather than five
 * unrelated category frontends, so this is one shape all five
 * categories render from. §16 requires that producing it never
 * triggers new synthesis: every field here is satisfiable from stored
 * structured intelligence, which is why there is no free-text AI prose
 * field on it. The narrative assessment is a short stored string, not
 * a generated one.
 */
export interface BetaCategoryView {
  category: BetaCategory;
  /** Localized display title. */
  title: string;
  /** §17 "current assessment" — stored, not generated at request time. */
  assessment?: string;
  /** §17 "current important developments". */
  developments: readonly BetaDevelopment[];
  /** §17 "selected geography", when the view is geography-scoped. */
  countryCode?: string;
  countryName?: string;
  /** §17 "update/freshness" — ISO timestamp of the newest evidence in this view. */
  lastUpdatedAt?: string;
  /** §17 "evidence/source counts". */
  evidenceCount: number;
  distinctSourceCount: number;
  /** §17 — country codes with material activity, for the simple map/context. */
  mapCountryCodes: readonly string[];
  /** §5 — always STORED or CONTEXTUAL. §16 forbids anything more expensive here. */
  computeClass: ComputeClass;
  /** §17 — which follow-on entries this view offers. */
  entries: BetaCategoryEntries;
}

export interface BetaDevelopment {
  id: string;
  title: string;
  summary: string;
  sourceName: string;
  url: string;
  publishedAt: string;
  countryCode?: string;
  countryName?: string;
}

/**
 * §17 — which follow-on actions the category view offers.
 *
 * `watch` is gated because §19 places Watch behind Professional, while
 * deliberately keeping reading of stored public intelligence generous.
 * Ask and Analysis are always offered; whether an individual Ask turn
 * then costs anything is decided later, server-side, per §5.
 */
export interface BetaCategoryEntries {
  ask: boolean;
  analysis: boolean;
  watch: boolean;
}
