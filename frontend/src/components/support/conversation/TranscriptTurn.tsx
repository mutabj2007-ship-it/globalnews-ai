'use client';

import type { SupportDictionary } from '@/lib/i18n/dictionaries/supportEn';
import type { AgentTurn, OperatorTurn, SystemTurn, Turn, UserTurn } from '@/lib/support/conversation/types';

type Conversation = SupportDictionary['conversation'];
type Authors = SupportDictionary['authors'];

/**
 * ONE TURN, RENDERED ACCORDING TO ITS TYPE.
 *
 * `03` — IDENTITY IS A PROPERTY OF THE TURN, NEVER OF THE CONVERSATION. The
 * label is rendered WITH the turn and is part of the turn's accessible name,
 * so it cannot be lost to colour, layout, truncation or a screen reader (I-3).
 * There is no avatar, no alignment convention and no colour that carries
 * authorship on its own, because each of those is a way for the label to
 * become decoration.
 *
 * `03` I-1/I-2 — the agent is never ADMIN and a person is never the agent.
 * That is enforced upstream by the type of the turn; this component simply has
 * no branch in which one could render as the other.
 *
 * The switch is exhaustive over the four turn types. Adding a fifth is a
 * compile error here, which is the point: a new transcript entry type cannot
 * be introduced without deciding, visibly, how its authorship is shown.
 */

function authoredBody(turn: AgentTurn, t: Conversation): string {
  if (turn.body.trim().length > 0) return turn.body;
  switch (turn.copyKey ?? (turn.outcome === 'UNAVAILABLE' ? 'UNAVAILABLE' : 'WITHHELD')) {
    case 'UNAVAILABLE':
      return t.unavailable.body;
    case 'ACCOUNT_CANNOT_SEE':
      return t.account.cannotSee;
    case 'LOCALE_OUT_OF_SCOPE':
      return t.locale.outOfScope;
    case 'WITHHELD':
    default:
      return t.withheld.body;
  }
}

function systemBody(turn: SystemTurn, t: Conversation): string {
  switch (turn.notice) {
    case 'QUEUED':
      return t.transition.queued;
    case 'HUMAN_ARRIVED':
      return t.transition.humanArrived;
    case 'CLOSED':
      return t.closed.reopen;
    case 'SENSITIVE_VOLUNTEERED':
    default:
      return t.sensitive.volunteered;
  }
}

const CARD = 'rounded-lg border p-4';

function UserTurnView({ turn, authors }: { turn: UserTurn; authors: Authors }): JSX.Element {
  return (
    <article aria-label={authors.USER} className={`${CARD} border-cyan-500/25 bg-cyan-500/[0.04]`}>
      <p className="text-xs uppercase tracking-wide text-ink-secondary">{authors.USER}</p>
      <p className="mt-2 whitespace-pre-wrap break-words text-ink-primary">{turn.body}</p>
    </article>
  );
}

function AgentTurnView({
  turn,
  t,
  authors,
}: {
  turn: AgentTurn;
  t: Conversation;
  authors: Authors;
}): JSX.Element {
  const body = authoredBody(turn, t);
  const isAnalysisAnswer = turn.outcome === 'ANSWER' && turn.source === 'ANALYSIS';
  const isAuthoredAnswer =
    (turn.outcome === 'ANSWER' || turn.outcome === 'PARTIAL') && turn.source === 'AUTHORED';

  return (
    /*
      `03` I-3 — the automated label is in the ACCESSIBLE NAME of the region,
      not only in the visible line above the text, and it is never truncated.
      `whitespace-normal` on the visible label is deliberate: the separator and
      the trailing word are load-bearing, and "· automated" is exactly what a
      narrow screen would otherwise clip away.
    */
    <article aria-label={authors.SYSTEM_AI} className={`${CARD} border-slate-500/30`}>
      <p className="whitespace-normal text-xs uppercase tracking-wide text-ink-secondary">
        {authors.SYSTEM_AI}
      </p>

      {isAnalysisAnswer && <p className="mt-2 text-sm text-ink-secondary">{t.analysis.preamble}</p>}

      <p className="mt-2 whitespace-pre-wrap break-words text-ink-primary">{body}</p>

      {isAnalysisAnswer && turn.sources && turn.sources.length > 0 && (
        <div className="mt-3">
          <p className="text-xs uppercase tracking-wide text-ink-secondary">
            {t.analysis.sourcesLabel}
          </p>
          <ul className="mt-1 flex flex-col gap-1">
            {turn.sources.map((source) => (
              <li key={source.id} className="text-sm text-ink-secondary">
                {source.outlet}
              </li>
            ))}
          </ul>
        </div>
      )}

      {turn.outcome === 'PARTIAL' && (
        <p className="mt-3 text-sm text-ink-secondary">{t.partial.notice}</p>
      )}

      {isAnalysisAnswer && <p className="mt-3 text-xs text-ink-secondary">{t.analysis.limits}</p>}
      {isAuthoredAnswer && <p className="mt-3 text-xs text-ink-secondary">{t.authored.limits}</p>}

      {/*
        `04` F-5 — EVERY non-answer ends with the same two facts: the
        conversation stays open, and a person can take it. The route is always
        STATED; whether it is automatically TAKEN is the triggers' business.
      */}
      {(turn.outcome === 'WITHHELD' || turn.outcome === 'UNAVAILABLE') && (
        <p className="mt-3 text-sm text-ink-secondary">{t.escalation.offer}</p>
      )}
    </article>
  );
}

function OperatorTurnView({
  turn,
  authors,
}: {
  turn: OperatorTurn;
  authors: Authors;
}): JSX.Element {
  return (
    <article aria-label={authors.ADMIN} className={`${CARD} border-emerald-500/35 bg-emerald-500/[0.04]`}>
      <p className="text-xs uppercase tracking-wide text-emerald-300">{authors.ADMIN}</p>
      <p className="mt-2 whitespace-pre-wrap break-words text-ink-primary">{turn.body}</p>
    </article>
  );
}

function SystemTurnView({ turn, t }: { turn: SystemTurn; t: Conversation }): JSX.Element {
  return (
    /*
      `03` I-4 — the transition is a VISIBLE TURN. A reader should never have to
      work out that the voice changed by noticing it sounds different. It
      carries no author label because nobody said it: it is a statement about
      the conversation, which is why its accessible name says so.
    */
    <article
      aria-label={t.transcript.systemTurnLabel}
      className="rounded-lg border border-dashed border-cyan-500/30 px-4 py-3"
    >
      <p className="text-sm text-ink-secondary">{systemBody(turn, t)}</p>
    </article>
  );
}

export function TranscriptTurn({
  turn,
  t,
  authors,
}: {
  turn: Turn;
  t: Conversation;
  authors: Authors;
}): JSX.Element {
  switch (turn.kind) {
    case 'USER':
      return <UserTurnView turn={turn} authors={authors} />;
    case 'AGENT':
      return <AgentTurnView turn={turn} t={t} authors={authors} />;
    case 'OPERATOR':
      return <OperatorTurnView turn={turn} authors={authors} />;
    case 'SYSTEM':
      return <SystemTurnView turn={turn} t={t} />;
  }
}
