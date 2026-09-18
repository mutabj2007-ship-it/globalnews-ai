'use client';

import { useEffect, useRef, useState } from 'react';
import type { SupportDictionary } from '@/lib/i18n/dictionaries/supportEn';
import type { SupportConversationAdapter } from '@/lib/support/conversation/adapter';
import { project } from '@/lib/support/conversation/projection';
import { advance, userMayWrite } from '@/lib/support/conversation/stateMachine';
import {
  type ConversationState,
  type SystemTurn,
  type Turn,
  userTurn,
} from '@/lib/support/conversation/types';

/**
 * THE CONVERSATIONAL SUPPORT SURFACE — V1 UI.
 *
 * This is the product the Product Owner asked for: a reader opens Support and
 * a CONVERSATION opens. It is not a ticket form with a chat skin. The ticket
 * infrastructure still exists and is untouched, demoted to what `01` says it
 * is — what a conversation BECOMES when it escalates.
 *
 * NOTHING HERE TALKS TO A BACKEND. Every behaviour below runs against
 * `SupportConversationAdapter`. There is no fetch, no provider, no
 * `SUPPORT_AI_ENABLED`, and no invented route. When Main defines the real
 * contract, a second implementation of that interface replaces the one the
 * page passes in and this file does not change — the whole reason the seam
 * exists.
 *
 * `adapter` IS REQUIRED, AND THAT IS THE SAFETY PROPERTY
 * (ALPHA-VISUAL-SUPPORT-FIXTURE-ISOLATION-R2). It used to be optional and to
 * fall back to `createMockConversationAdapter()`. A caller that forgot to pass
 * one therefore did not fail — it silently served checked-in fixtures, which is
 * exactly what the live `SupportScreen` did, and a live reader asking how the
 * product works was answered with an invented news story citing publishers that
 * do not exist. An omission must not be able to select an implementation.
 *
 * Every caller now names the adapter it wants, in code, and the compiler is
 * what checks it. This file no longer imports the mock at all, so the fixture
 * set is not reachable from here however the props are filled in. NODE_ENV is
 * deliberately NOT the boundary: an environment flag is a runtime value a build
 * can get wrong, and it leaves the fixtures in the production bundle either
 * way. A required prop is a compile error and an absent import.
 *
 * THE STATE MACHINE IS NOT IN THIS FILE. `stateMachine.ts` owns the seven
 * states and refuses the three prohibited transitions; this component asks it
 * and renders the answer. A component that decided its own transitions would
 * be a component in which `HUMAN -> OPEN_AI` is one careless line away.
 *
 * WHAT THE READER MUST BE ABLE TO TELL AT EVERY MOMENT (`03`): who said the
 * last thing. Every turn carries its own authorship label; see
 * `TranscriptTurn.tsx`, which owns that rule.
 */
import { TranscriptTurn } from './TranscriptTurn';

let localSequence = 0;
function localId(prefix: string): string {
  localSequence += 1;
  return `${prefix}-local-${localSequence}`;
}

function systemTurn(notice: SystemTurn['notice']): SystemTurn {
  return { kind: 'SYSTEM', id: localId('system'), at: new Date().toISOString(), notice };
}

export interface SupportConversationProps {
  t: SupportDictionary;
  locale: 'en' | 'pl';
  /**
   * REQUIRED. The live page passes `createNoTransportAdapter()`; tests, stories
   * and the evidence harness pass `createMockConversationAdapter()` by writing
   * its name. There is no default, so there is no implementation that can
   * arrive by accident.
   */
  adapter: SupportConversationAdapter;
}

export function SupportConversation({ t, locale, adapter }: SupportConversationProps): JSX.Element {
  const c = t.conversation;
  // No resolution step, and no `??`. The adapter is the one that was passed.
  const resolvedAdapter = adapter;

  const [state, setState] = useState<ConversationState>('OPEN_AI');
  const [turns, setTurns] = useState<readonly Turn[]>([]);
  const [draft, setDraft] = useState('');
  const [touched, setTouched] = useState(false);
  /*
    E1 C-8, as two BOOLEANS and never a number. C-28 and F's Q-5 forbid
    disclosing the limiter's shape, so the surface can know that a bound was
    reached and can never know — or say — by how much.
  */
  const [contextTruncated, setContextTruncated] = useState(false);
  const [conversationTooLong, setConversationTooLong] = useState(false);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);

  const hasSent = turns.some((turn) => turn.kind === 'USER');
  const trimmed = draft.trim();
  const tooShort = trimmed.length < 2;
  const canWrite = userMayWrite(state);

  /*
    A person joining is a PUSH. The mock fires it on a timer; a backend
    implementation wires a socket to the same callback. Either way the arrival
    is announced as a visible turn first (`03` I-4) and only then does the
    state become HUMAN — which is terminal for the agent (`01`).
  */
  useEffect(() => {
    return resolvedAdapter.onOperatorTurn((operatorTurn) => {
      setTurns((current) => [...current, systemTurn('HUMAN_ARRIVED'), operatorTurn]);
      setState((current) => advance(current, { type: 'OPERATOR_JOINED' }).state);
    });
  }, [resolvedAdapter]);

  async function handleSend(): Promise<void> {
    setTouched(true);
    if (tooShort || !canWrite) return;

    const sent = userTurn({ id: localId('user'), body: trimmed, at: new Date().toISOString() });

    /*
      `07` Q-4 — the reader's message is stored FIRST and unconditionally. It
      survives a limiter, a provider failure and a handoff; nothing below can
      discard it.
    */
    const withUserTurn: readonly Turn[] = [...turns, sent];
    setTurns(withUserTurn);
    setDraft('');
    setTouched(false);

    const afterUser = advance(state, { type: 'USER_TURN' });
    setState(afterUser.state);

    // HUMAN and CLOSED are terminal for the agent. The turn is delivered to
    // the people who own the conversation, and nothing automatic answers it.
    if (afterUser.state !== 'AI_WORKING') return;

    /*
      THE PROJECTION IS THE ONLY THING THAT LEAVES. Not `withUserTurn` — the
      transcript — but its user-authored projection, bounded oldest-first.
      F `01`, F `06` §2, E1 C-2/C-5/C-8.
    */
    const projection = project(withUserTurn);

    /*
      F `02` H-8 — THE TURN CEILING. At the ceiling the conversation goes to a
      person rather than being answered by an agent that can no longer see most
      of it. The reader's turn is already stored; nothing is discarded.
    */
    if (projection.atConversationCeiling) {
      setConversationTooLong(true);
      await resolvedAdapter.requestHandoff('H-8');
      setTurns((current) => [...current, systemTurn('QUEUED')]);
      setState(advance('AI_WORKING', { type: 'HANDOFF' }).state);
      return;
    }

    const reply = await resolvedAdapter.respond({
      locale,
      userTurns: projection.userTurns,
    });

    setContextTruncated(projection.truncated || reply.contextTruncated === true);

    // `04` F-4 — the agent turn is appended whatever the outcome. Failure is
    // never silence.
    setTurns((current) => [...current, reply.turn]);

    const resolution =
      reply.turn.outcome === 'UNAVAILABLE'
        ? ({ type: 'AGENT_UNAVAILABLE' } as const)
        : reply.turn.outcome === 'WITHHELD'
          ? ({ type: 'AGENT_WITHHELD' } as const)
          : ({ type: 'AGENT_ANSWERED' } as const);
    const resolved = advance('AI_WORKING', resolution);
    setState(resolved.state);

    if (reply.escalate) {
      await resolvedAdapter.requestHandoff(reply.escalate);
      setTurns((current) => [...current, systemTurn('QUEUED')]);
      setState(advance(resolved.state, { type: 'HANDOFF' }).state);
    }
  }

  /*
    `02` H-1 — ABSOLUTE. A request for a person is honoured on the turn it is
    made: no qualifying question, no "let me try once more", no suggestion that
    the agent could do it faster. This control is therefore a single action
    with no confirmation step.
  */
  async function handleAskForPerson(): Promise<void> {
    await resolvedAdapter.requestHandoff('H-1');
    setTurns((current) => [...current, systemTurn('QUEUED')]);
    setState((current) => advance(current, { type: 'HANDOFF' }).state);
  }

  function handleClose(): void {
    setTurns((current) => [...current, systemTurn('CLOSED')]);
    setState((current) => advance(current, { type: 'CLOSED' }).state);
  }

  /*
    `06` P-3 / C-13 — the ONLY user-side control over how much is exported.
    Continuing a conversation extends the export; starting a new one does not.
  */
  function handleNewConversation(): void {
    setTurns([]);
    setState('OPEN_AI');
    setDraft('');
    setTouched(false);
    setContextTruncated(false);
    setConversationTooLong(false);
    composerRef.current?.focus();
  }

  const showEscalationAction =
    state === 'OPEN_AI' || state === 'AI_WITHHELD' || state === 'AI_UNAVAILABLE';

  return (
    <section className="flex w-full max-w-full flex-col gap-5">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-ink-primary">{c.heading}</h1>
        <p className="text-ink-secondary">{c.intro}</p>
      </header>

      {/*
        `06` D-1/D-2/D-3 — BEFORE SUBMISSION, ON THE SURFACE, AND PERSISTENT.
        The full sentence is rendered before the first send, because a
        disclosure a reader meets after their words have left is not a
        disclosure. After the first turn it becomes the compact form and STAYS:
        the export grows with the thread, so the statement may shrink but may
        not disappear. D-6 — it informs; it is not a consent gate, so there is
        no checkbox implying a choice the product cannot honour.
      */}
      {!hasSent ? (
        <aside
          aria-label={c.disclosure.heading}
          className="rounded-lg border border-cyan-500/25 bg-cyan-500/[0.03] p-4"
        >
          <p className="text-xs uppercase tracking-wide text-ink-secondary">
            {c.disclosure.heading}
          </p>
          <p className="mt-2 text-sm text-ink-secondary">{c.disclosure.beforeFirstSend}</p>
        </aside>
      ) : (
        <aside aria-label={c.disclosure.heading} className="text-xs text-ink-secondary">
          {c.disclosure.compact}
        </aside>
      )}

      <ol aria-label={c.transcript.label} className="flex list-none flex-col gap-3 p-0">
        {turns.map((turn) => (
          <li key={turn.id}>
            <TranscriptTurn turn={turn} t={c} authors={t.authors} />
          </li>
        ))}
      </ol>

      {/*
        `05` C-16 — bounded to THIS TURN only, announced to assistive
        technology, and carrying no time estimate. The live region is present
        at all times so its contents are announced when they change rather than
        the region itself appearing, which some screen readers miss.
      */}
      <div aria-live="polite" aria-label={c.transcript.liveRegionLabel} className="min-h-[1.25rem]">
        {state === 'AI_WORKING' && (
          <p className="text-sm text-ink-secondary" aria-label={c.working.ariaLabel}>
            {c.working.label}
          </p>
        )}
      </div>

      {state === 'CLOSED' && <p className="text-sm text-ink-secondary">{c.closed.reopen}</p>}

      {/*
        E1 C-8 — the two context states, stated without a single number. The
        reader is told THAT the conversation outgrew what can be sent, and the
        control F's P-3 gives them (start a new one) sits immediately below.
      */}
      {conversationTooLong ? (
        <p role="status" className="text-sm text-ink-secondary">
          {c.context.tooLong}
        </p>
      ) : (
        contextTruncated && (
          <p role="status" className="text-sm text-ink-secondary">
            {c.context.limitReached}
          </p>
        )
      )}

      <form
        onSubmit={(event) => {
          event.preventDefault();
          void handleSend();
        }}
        className="flex w-full max-w-full flex-col gap-3"
      >
        <label htmlFor="support-conversation-composer" className="text-sm text-ink-secondary">
          {c.composer.label}
        </label>
        <textarea
          id="support-conversation-composer"
          ref={composerRef}
          value={draft}
          rows={3}
          placeholder={c.composer.placeholder}
          disabled={!canWrite}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            /*
              PHONE-FIRST, AND FEWER CLICKS. Enter sends; Shift+Enter and the
              soft-keyboard newline still compose a paragraph. A support
              conversation where every turn costs a deliberate tap on a small
              target is a form wearing a chat's clothes.
            */
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              void handleSend();
            }
          }}
          className="w-full max-w-full rounded-lg border border-cyan-500/25 bg-transparent px-3 py-2 text-ink-primary disabled:opacity-50"
        />
        {touched && tooShort && <span className="text-sm text-red-400">{c.composer.tooShort}</span>}

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="submit"
            disabled={!canWrite}
            className="min-h-[44px] rounded-full border border-cyan-500/40 px-5 text-sm text-ink-primary hover:border-cyan-400/70 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {c.composer.send}
          </button>

          {showEscalationAction && (
            <button
              type="button"
              onClick={() => void handleAskForPerson()}
              className="min-h-[44px] rounded-full border border-cyan-500/25 px-5 text-sm text-ink-secondary hover:border-cyan-400/60"
            >
              {c.escalation.action}
            </button>
          )}

          {state === 'HUMAN' && (
            <button
              type="button"
              onClick={handleClose}
              className="min-h-[44px] rounded-full border border-cyan-500/25 px-5 text-sm text-ink-secondary hover:border-cyan-400/60"
            >
              {c.close.action}
            </button>
          )}

          {hasSent && (
            <button
              type="button"
              onClick={handleNewConversation}
              className="min-h-[44px] rounded-full border border-cyan-500/25 px-5 text-sm text-ink-secondary hover:border-cyan-400/60"
            >
              {c.newConversation.action}
            </button>
          )}
        </div>

        {hasSent && <p className="text-xs text-ink-secondary">{c.newConversation.hint}</p>}
      </form>
    </section>
  );
}
