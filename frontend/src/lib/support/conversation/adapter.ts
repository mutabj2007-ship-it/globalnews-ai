import type { AgentTurn, HandoffTrigger, OperatorTurn, UserTurn } from './types';

/**
 * THE ADAPTER SEAM — the one place Main's eventual backend contract plugs in.
 *
 * The Product Owner's execution constraint: the conversational API does not
 * exist, so this UI is built against a typed interface with deterministic
 * fixtures behind it, and NO backend route is invented here and treated as
 * final authority. When Main defines the real contract, a second
 * implementation of this interface is written and the surface above it does
 * not change. That is the whole purpose of the shape below, and it is why the
 * interface speaks in TURNS rather than in HTTP.
 *
 * THE LOOP GUARD LIVES IN THE SIGNATURE, NOT IN A COMMENT.
 * `AgentRequest.userTurns` is `readonly UserTurn[]`. An implementation cannot
 * be handed an `AgentTurn` or an `OperatorTurn` without a conversion that does
 * not exist and would have to be written by name (`01`, `08` V-1). A backend
 * implementation inherits the guarantee by inheriting the signature.
 */
export interface AgentRequest {
  readonly locale: 'en' | 'pl';
  /**
   * The projection, and nothing else. NOT the transcript. See
   * `projection.ts` — this is what is exported (F `06` §2, E1 C-5/C-6).
   */
  readonly userTurns: readonly UserTurn[];
}

/**
 * THE WIRE CONTRACT THIS UI DECLARES FOR MAIN — E1 C-3.
 *
 * `AgentRequest` above is an IN-PROCESS shape: the mock needs bodies because
 * there is no server to read them from. It is NOT a proposed HTTP body, and
 * this file does not invent a route.
 *
 * What it does declare is the boundary rule E1 makes binding, so that whoever
 * writes the real transport inherits it rather than rediscovering it:
 *
 *   THE BROWSER IS NEVER AUTHORITY FOR AUTHORSHIP. `authorType` / `kind` is
 *   assigned by the SERVER from the authenticated actor and the code path that
 *   writes the row. It is never read from a request body, never defaulted, and
 *   never accepted from a client field; a request that supplies it is
 *   REJECTED, not ignored.
 *
 * Why the frontend cares about a server-side rule: without it the loop guard is
 * bypassable without writing a single line of TypeScript. If anything can
 * persist a row with `kind: 'USER'` whose content the agent produced, the
 * projection includes it CORRECTLY and the type system is satisfied. The type
 * argument protects the CODE path; only server-derived authorship protects the
 * DATA path. This UI therefore sends turn IDENTITY, never turn AUTHORSHIP —
 * the shape below carries no `authorType`, no `kind`, and no role of any sort.
 *
 * The frontend's own `kind` discriminants are a RENDERING and PROJECTION
 * concern only. They are re-derived from server-classified rows at the
 * boundary (`parseTranscript`), and are never round-tripped as a claim.
 */
export interface AgentWireRequest {
  readonly conversationId: string;
  /**
   * The reader's own stored turns, by id. The server re-reads the bodies it
   * already holds and re-derives authorship; nothing about who wrote what
   * travels from the browser.
   */
  readonly userTurnIds: readonly string[];
  readonly locale: 'en' | 'pl';
}

export interface AgentReply {
  /**
   * `04` F-4 — FAILURE IS NEVER SILENCE. A turn is always returned, even for a
   * non-answer, so the transcript never misrepresents what happened and the
   * reader can always tell "finished" from "still thinking".
   */
  readonly turn: AgentTurn;
  /**
   * `02` — set when a trigger fired on this turn. Operator-facing; the surface
   * uses it only to move state, never to render a trigger name.
   */
  readonly escalate?: HandoffTrigger;
  /**
   * E1 C-8 — the context bound dropped at least one of the reader's earlier
   * turns from what was sent. A BOOLEAN, deliberately: C-28 and F's Q-5 forbid
   * disclosing the limiter's shape, so the UI can say that a conversation has
   * grown too long to keep sending in full and can never say by how much.
   */
  readonly contextTruncated?: boolean;
  /**
   * E1 C-8 / F H-8 — the conversation ceiling. Also a boolean, same reason.
   */
  readonly conversationTooLong?: boolean;
}

/**
 * What the surface may ask of the world. Deliberately four methods: anything
 * larger would start encoding a transport.
 */
export interface SupportConversationAdapter {
  /** Names the implementation in evidence and in the mocked-behaviour list. */
  readonly id: string;

  /**
   * `05` C-5 / `07` — whether the analysis source can be attempted at all.
   * False is the PROVIDER-DISABLED state, and it is a capability of the
   * environment, not a property of any one turn. Authored answers continue
   * regardless (`07` Q-6) — the two sources fail independently.
   */
  readonly analysisAvailable: boolean;

  /**
   * ONE ATTEMPT. No retry, no second call (`04` F-3). An implementation that
   * retries internally violates the contract even though the signature allows
   * it; `08` V-2 is the assertion that catches it.
   */
  respond(request: AgentRequest): Promise<AgentReply>;

  /**
   * R2-1 — WHETHER A REQUEST FOR A PERSON CAN ACTUALLY BE DELIVERED.
   *
   * A capability of the environment, exactly like `analysisAvailable` above,
   * and for the same reason: it is a property of what exists, not of any one
   * turn. It is declared here rather than inferred by the surface because the
   * surface cannot know — `requestHandoff` returns `Promise<void>`, and a
   * promise that resolves is indistinguishable from a promise that DID
   * something. That ambiguity is what shipped: the no-transport adapter
   * resolved, the surface believed it, and the reader was told the
   * conversation was now with the human Support team when no row had been
   * written and nobody had been notified.
   *
   * THE RULE THIS FIELD CARRIES:
   *
   *   false  the surface must NOT offer a handoff action, must NOT call
   *          `requestHandoff`, and must never enter HANDOFF_PENDING. It routes
   *          the reader to the real Support request surface instead, and says
   *          so in words that promise no delivery.
   *   true   `requestHandoff` corresponds to a real state change, and the
   *          escalation copy that promises to pass the conversation on is
   *          true.
   *
   * An implementation that returns true without a backing transition is
   * lying in one place instead of three, which is the point: there is now
   * exactly one field to check against reality.
   */
  readonly handoffAvailable: boolean;

  /**
   * `02` H-1 — absolute, honoured on the turn it is made, never argued with.
   * Returns nothing because the handoff produces a SYSTEM turn the surface
   * composes from the dictionary: a free-text escalation message from the
   * transport would be an invented operational fact (`04` F-6).
   *
   * MAY ONLY BE CALLED WHEN `handoffAvailable` IS TRUE. An implementation that
   * cannot deliver must THROW here rather than resolve, so that a miswiring
   * fails loudly on the turn it happens instead of silently promising the
   * reader that somebody has been told.
   */
  requestHandoff(trigger: HandoffTrigger): Promise<void>;

  /**
   * A person joining is a push, not a poll the UI owns. The mock fires it on a
   * timer; a backend implementation would wire a socket or an SSE stream to
   * the same callback and nothing above this line changes.
   */
  onOperatorTurn(listener: (turn: OperatorTurn) => void): () => void;
}
