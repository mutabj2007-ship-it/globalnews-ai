import type { AgentRequest, AgentReply, SupportConversationAdapter } from './adapter';
import type { AgentTurn, OperatorTurn } from './types';

/**
 * THE LIVE ADAPTER WHILE THERE IS NO TRANSPORT — ALPHA-VISUAL-SUPPORT-FIXTURE-ISOLATION-R2.
 *
 * WHAT THIS REPLACES, AND WHY IT HAD TO.
 *
 * `SupportConversation` used to default to `createMockConversationAdapter()`
 * when no adapter was passed, and `SupportScreen` passed none. A live reader on
 * /support therefore received CHECKED-IN FIXTURES as if they were answers.
 * "Jak działa GlobalNews AI?" and "How does GlobalNews AI work?" both contain
 * the substring `news`, so both matched the mock's ANALYSIS route and came back
 * as a fabricated news-event finding citing two publishers that do not exist —
 * a product question answered with an invented story. The default was the
 * defect: nothing had to go wrong for it to happen, and nothing announced it.
 *
 * WHAT THIS IS. The honest stand-in for the transport that has not been built.
 * It reaches nothing, decides nothing and knows nothing, and that is the entire
 * specification. It has no routing table, no keyword list, no fixture bodies
 * and no locale-specific behaviour — there is nothing here for a question to
 * match, which is why no question can be answered wrongly.
 *
 * WHY WITHHELD AND NOT UNAVAILABLE. F `04` draws the line between the two: the
 * agent has no answer it can stand behind (WITHHELD) versus the agent was
 * prevented from trying on this turn (UNAVAILABLE). UNAVAILABLE's text says
 * "That is a limit on my side ... I do not know whether asking again later will
 * help", which implies a transport that is momentarily down and might come
 * back. There is no transport. WITHHELD is the true one, it is F's ONE approved
 * fallback for the whole kind (C-4), and it already ends with the two facts F
 * `04` F-5 requires: the conversation stays open, and a person can take it.
 *
 * VERIFIED KNOWLEDGE STAYS BEHIND THIS LINE. The product corpus is not consulted
 * here and must not be until a real grounded transport is wired; OWNER-GATED
 * behaves as missing because everything behaves as missing. This file adds no
 * shared enum, no Prisma value and no route.
 *
 * THE MOCK STILL EXISTS AND IS STILL USEFUL — to tests, stories and the
 * evidence harness, which import `createMockConversationAdapter` BY NAME. What
 * it no longer has is a way of arriving somewhere by default.
 */

/** Named so it is legible in evidence and can never be confused with the mock. */
export const NO_TRANSPORT_ADAPTER_ID = 'no-transport-withheld-v1';

export interface NoTransportAdapterOptions {
  /**
   * `04` — the uniform non-answer latency floor. Every outcome waits the same
   * time, so a reader cannot read the reason off a stopwatch. Zero in tests.
   */
  readonly thinkMs?: number;
  /** Injected so evidence frames are reproducible. */
  readonly now?: () => string;
}

let sequence = 0;

export function createNoTransportAdapter(
  options: NoTransportAdapterOptions = {},
): SupportConversationAdapter {
  const thinkMs = options.thinkMs ?? 450;
  const now = options.now ?? (() => new Date().toISOString());

  return {
    id: NO_TRANSPORT_ADAPTER_ID,

    /*
      `07` / `05` C-5 — the analysis source is a capability of the environment,
      and this environment does not have it. False here is what stops the
      surface rendering the analysis preamble, the sources block and the
      analysis limits footer: there is no reporting behind this answer, so the
      UI must not dress it as though there were.
    */
    analysisAvailable: false,

    /*
      R2-1 — THE BLOCKING DEFECT, AND ITS CORRECTION.

      `requestHandoff` used to resolve here. That was a no-op wearing the shape
      of a success: the surface took the resolved promise as delivery, appended
      the QUEUED turn and moved to HANDOFF_PENDING, so the reader was told in
      C-10's words that the conversation was "now with the human Support team".
      No row was written. No queue received anything. Nobody was notified.

      There is no handoff transport to report, so this reports none. The
      surface reads this field and does not offer the action at all — it routes
      the reader to the Support request surface on the same page, which is the
      one path that does reach a person.
    */
    handoffAvailable: false,

    async respond(_request: AgentRequest): Promise<AgentReply> {
      await new Promise((resolve) => setTimeout(resolve, thinkMs));

      /*
        THE REQUEST IS NOT READ. Not the locale, not the bodies, not the turn
        count. A branch on any of them would be the first line of a second
        routing table, and the mock is the demonstration of where that ends.
        `_request` is accepted only because the interface hands it over.

        `copyKey: 'WITHHELD'` is the whole answer: the surface renders
        `conversation.withheld.body` from the Support dictionary, which is
        already localised, already L-approved and already the single text F C-4
        fixes for this kind. No sentence is composed here, so there is no
        seventh fallback message to review.
      */
      sequence += 1;
      const turn: AgentTurn = {
        kind: 'AGENT',
        id: `no-transport-${sequence}`,
        at: now(),
        outcome: 'WITHHELD',
        source: null,
        body: '',
        copyKey: 'WITHHELD',
        /*
          Operator-facing only, never rendered (`04` F-1). `no-evidence` is the
          accurate key: nothing was retrieved because nothing can be.
        */
        skipReason: 'no-evidence',
      };

      /*
        No `escalate`. An automatic trigger would move every conversation to
        HANDOFF_PENDING on its first turn and announce, in C-10's words, that
        the conversation is now with the human Support team — which no code
        here would have made true. The route to a person stays where it is
        honest: the escalation offer F-5 appends to this turn, the "Ask for a
        person" control, and the request surface on the same page, which is the
        one path that reaches a real backend.
      */
      return { turn };
    },

    /*
      IT THROWS. This is deliberate and is the whole correction.

      `02` H-1 makes a request for a person absolute, so the one thing this
      method may not do is FAIL QUIETLY. Resolving would mean reporting success
      for something that did not happen, and the surface has no way to tell the
      two apart — `Promise<void>` carries no outcome. Throwing makes the
      impossible case impossible to mistake for the possible one.

      Nothing calls this. `handoffAvailable: false` is what the surface reads,
      and it neither renders the action nor calls this method. The throw exists
      for the case where someone wires it up anyway: a loud failure on the turn
      it happens, rather than a reader told that somebody has been told.
    */
    async requestHandoff(): Promise<never> {
      throw new Error(
        'noTransportAdapter: there is no Support handoff transport. ' +
          'Check adapter.handoffAvailable before offering or performing a handoff; ' +
          'the reader must be routed to the Support request surface instead.',
      );
    },

    /*
      NOBODY ARRIVES. The mock fabricated an operator on a timer so a reviewer
      could reach the HUMAN state; doing that on the live surface would put
      words in a colleague's mouth and tell a reader a person had read their
      message. The listener is registered and never called.
    */
    onOperatorTurn(_listener: (turn: OperatorTurn) => void): () => void {
      return () => undefined;
    },
  };
}
