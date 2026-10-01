'use client';

import type { LanguageCode } from '@globalnews-ai/shared';
import { AskR2TurnView } from '@/components/ask-frame/AskR2TurnView';
import { AskContextInspect } from '@/components/ask/AskContextInspect';
import { LoadingStages } from '@/components/search/LoadingStages';
import type { AskR2Locale, AskR2Strings } from '@/lib/ask/askR2Strings';
import { openFullAnalysisHref, type useAskR2Conversation } from '@/lib/ask/useAskR2Conversation';

/**
 * HOME, DISCUSSIONS, ALERTS & PAID R1 · STAGE A — THE EMBEDDED ASK CONVERSATION.
 *
 * The dock's body under `ask.embedded`. Every answer is rendered by `AskR2TurnView` — the
 * Standalone /ask answer view, UNCHANGED — so provenance, the as-of basis, CURRENT vs
 * RETAINED reporting, coverage, partial / insufficient states, sources and the deeper-
 * analysis offer are the Standalone truth model by construction (Claude H §6: render the
 * Ask V2 layer and let the analysis layer supply provenance underneath; never flatten).
 *
 * Added beside it, never inside it:
 *   · Inspect — what the server made of the context references (AskContextInspect);
 *   · the pending line "Checking available reporting…" — NEUTRAL: at that moment the
 *     basis is genuinely unknown, so no evidence claim is made (FINAL spec §5);
 *   · the sign-in requirement (a 401 never falls back to another engine) and the guest
 *     notices, server-decided, with no allowance number of our own.
 * Nothing here sends anything except the reader's explicit actions passed in.
 */

type Conversation = ReturnType<typeof useAskR2Conversation>;

export function EmbeddedConversation({
  r2,
  locale,
  language,
  onRunDeeper,
  signInHref,
  onSignIn,
  readingLabel,
  signInTitle,
  signInBody,
  signInAction,
  guestStrings,
  continueDraft,
  stages,
}: {
  readonly r2: Conversation;
  readonly locale: AskR2Locale;
  readonly language: LanguageCode;
  readonly onRunDeeper: (question: string) => void;
  readonly signInHref: string;
  readonly onSignIn: () => void;
  readonly readingLabel: string;
  readonly signInTitle: string;
  readonly signInBody: string;
  readonly signInAction: string;
  readonly guestStrings: AskR2Strings['guest'];
  readonly continueDraft: string;
  readonly stages: string[];
}): JSX.Element {
  const g = guestStrings;
  const exhausted = r2.guestMode && (r2.guest?.state === 'EXHAUSTED' || r2.guestNotice === 'EXHAUSTED');
  const noticeText: Partial<Record<string, string>> = {
    IN_PROGRESS: g.inProgress,
    COOLDOWN: g.cooldown,
    LIMITED: g.limited,
    ATTEMPTS_EXHAUSTED: g.attemptsExhausted,
    UNAVAILABLE: g.unavailable,
    DEEPER: g.signInForDeeper,
    CANCELLED: g.cancelled,
    FAILED: g.failed,
    RESUMED: g.resumed,
  };
  const notice = r2.guestNotice !== null ? (noticeText[r2.guestNotice] ?? null) : null;
  return (
    <div data-ask="embedded-conversation" data-ask-guest={r2.guestMode ? 'true' : undefined}>
      {r2.turns.map((turn, index) => (
        <div key={`${index}-${turn.operation?.operationId ?? turn.question}`} data-ask="r2-turn">
          <AskR2TurnView
            turn={turn}
            locale={locale}
            context={undefined}
            onRunDeeper={r2.guestMode ? undefined : onRunDeeper}
            canSave={!r2.guestMode}
          />
          {turn.operation?.context !== undefined && (
            <AskContextInspect context={turn.operation.context} language={language} />
          )}
        </div>
      ))}

      {r2.pending !== null && (
        <section data-ask="pending" aria-live="polite" className="mb-5 flex flex-col gap-3">
          <div className="ms-auto max-w-[88%] rounded-2xl rounded-br-md border border-signal/25 bg-signal/15 px-4 py-3 text-sm leading-relaxed text-ink-primary">
            {r2.pending}
          </div>
          <p data-ask="reading" className="font-mono text-[12px] text-ink-secondary">
            {readingLabel}
          </p>
          <LoadingStages stages={stages} />
        </section>
      )}

      {r2.signInRequired !== null && (
        <section data-ask="sign-in-required" role="status" className="mb-5 rounded-2xl border border-border-strong bg-void p-4">
          <p className="text-sm font-semibold text-ink-primary">{signInTitle}</p>
          <p className="mt-1 text-sm text-ink-secondary">{signInBody}</p>
          <a
            href={signInHref}
            onClick={onSignIn}
            data-ask="sign-in"
            className="mt-3 inline-flex min-h-[44px] items-center rounded-xl bg-signal px-4 text-sm font-semibold text-white"
          >
            {signInAction}
          </a>
        </section>
      )}

      {notice !== null && (
        <p data-ask="guest-notice" role="status" className="mb-4 text-[13px] leading-[1.45] text-[#c9b27a]">
          {notice}
        </p>
      )}

      {exhausted && (
        /* Below the answers, never over them; sign-in continues THIS conversation. */
        <section data-ask="guest-continue" role="status" className="mb-5 rounded-2xl border border-border-strong bg-void p-4">
          <p className="text-sm font-semibold text-ink-primary">{g.exhaustedTitle}</p>
          <p className="mt-1 text-sm text-ink-secondary">{g.exhaustedBody}</p>
          <button
            type="button"
            data-ask="guest-sign-in"
            onClick={() => void r2.continueWithSignIn(continueDraft)}
            className="mt-3 inline-flex min-h-[44px] items-center rounded-xl bg-signal px-4 text-sm font-semibold text-white"
          >
            {g.continueAction}
          </button>
        </section>
      )}

      {r2.guestMode && r2.guest?.remaining !== undefined && (
        /* The server's own counter — never a number of ours. */
        <p data-ask="guest-counter" className="mb-2 text-[12px] text-ink-secondary">
          {g.remaining(r2.guest.remaining)}
        </p>
      )}
    </div>
  );
}

/**
 * HOME R1 · STAGE A — the embedded panel's title: "Open in Ask" is NAVIGATION to the same
 * stored result on /ask (a display-only read, 0 AI), or to /ask itself before any answer;
 * the badge says whose allowance a Send uses, as the server stated it.
 */
export function EmbeddedAskTitle({
  r2,
  title,
  openInAsk,
  guestLabel,
  accountLabel,
}: {
  readonly r2: Conversation;
  readonly title: string;
  readonly openInAsk: string;
  readonly guestLabel: string;
  readonly accountLabel: string;
}): JSX.Element {
  const latest = r2.turns[r2.turns.length - 1]?.operation?.operationId;
  const principal = r2.guest === null ? null : r2.guestMode ? 'guest' : r2.guest.signedIn ? 'account' : null;
  return (
    <>
      <a
        data-ask="open-in-ask"
        href={latest === undefined ? '/ask' : openFullAnalysisHref(latest)}
        className="inline-flex min-h-[44px] items-center gap-2"
      >
        <span>{title}</span>
        <span className="text-[13px] font-semibold text-signal">{openInAsk} ↗</span>
      </a>
      {principal !== null && (
        <span
          data-ask="principal-badge"
          data-ask-principal={principal}
          className="ms-2 rounded-full border border-border-strong px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide text-ink-secondary"
        >
          {principal === 'guest' ? guestLabel : accountLabel}
        </span>
      )}
    </>
  );
}
