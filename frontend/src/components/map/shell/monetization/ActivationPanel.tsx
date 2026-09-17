'use client';

import { assignmentSubjectList, type WatchCapability, type WatchChain, type WatchSensitivity } from '@/lib/map/monetization/watchModel';

/**
 * PART IV §12.4 — THE ACTIVATION PANEL. THE SENTENCE IS THE SPECIFICATION.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE SENTENCE, AND WHY IT MAY NOT BE PARAPHRASED
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   "GlobalNewsAI will assess Mombasa, Kenya fuel infrastructure and Rwanda
 *    supply implications every 15 minutes, and tell you when the assessment
 *    materially changes."
 *
 * §12.4: "The sentence IS the specification. Implementation must not paraphrase
 * it into feature language." It describes LABOUR — assess, tell you — and
 * contains no reference to articles, reading, access or limits. Feature language
 * would turn a description of work into a description of a product, which is the
 * newspaper-paywall framing this whole architecture exists to avoid.
 *
 * The frame is carried per language in the dictionaries so translation keeps the
 * shape; this component only fills in the subjects and the cadence.
 *
 * ── ONE TRANSLATION CONSTRAINT, HANDLED RATHER THAN HIDDEN ────────────────
 *
 * Polish inflects: "będzie oceniać RWANDĘ", not "Rwanda". A template cannot
 * decline a proper noun it receives as a string, and shipping the nominative
 * reads as broken Polish to a Polish reader — measured on the built page.
 *
 * The options were a declension table (inventing grammar for every place name
 * in the gazetteer, and getting it wrong somewhere) or a frame that does not
 * require the accusative. The Polish frame therefore joins with a COLON —
 * "będzie oceniać: Rwanda — co 15 minut — i poinformuje Cię…" — which is
 * ordinary Polish, needs no inflection, and keeps every word §12.4 specifies:
 * it still assesses, still tells you, still says materially changes, and still
 * names no article, reading, access or limit.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * IT IS A PANEL IN PLACE, AND NEVER A MODAL
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * §12.3: "Each opens a right-rail panel IN PLACE — never a modal." §12.2 lists
 * "modal on selection or navigation" among the never-permitted treatments. So
 * this renders inside the rail drawer, the map stays live beside it, and
 * dismissing returns to the situation FULLY READABLE — the reader loses nothing
 * by declining.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHAT THIS BUILD HONESTLY CANNOT DO
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * There is no watch service, no entitlement service and no payment path.
 * `capability.canActivate` is typed as the literal `false`, so a branch that
 * activated a Watch could not be written here even by mistake.
 *
 * The panel therefore states the assignment truthfully — it is a real
 * assignment, built by the user — and then says plainly that monitoring cannot
 * begin yet. It shows no price, because no price has been set; it offers no
 * BEGIN MONITORING button, because pressing it could not begin anything.
 *
 * WHAT IT DOES OFFER IS REAL. §12.4's secondary, "FOLLOW INSTEAD — FREE", works
 * today: Follow is shipped, free, and genuinely keeps the subject in the
 * reader's feed. Offering the honest half rather than nothing is the difference
 * between a preview and a dead end.
 */

export interface ActivationPanelLabels {
  readonly title: string;
  /** The §12.4 frame. `{subjects}` and `{cadence}` are the only holes. */
  readonly assignmentSentence: string;
  readonly and: string;
  readonly cadenceValue: string;
  readonly sensitivityLine: string;
  /** The honest state, in place of a price and a primary button. */
  readonly unavailableTitle: string;
  readonly unavailableBody: string;
  readonly signedOutTitle: string;
  readonly signedOutBody: string;
  readonly signIn: string;
  readonly followInstead: string;
  readonly dismiss: string;
  readonly capabilityNote: string;
}

export interface ActivationPanelProps {
  readonly chain: WatchChain;
  readonly sensitivity: WatchSensitivity;
  /*
    THE SENSITIVITY'S NAME, RESOLVED BY THE CALLER. The composer already owns
    this vocabulary; a second copy here is two places for it to drift, and the
    panel only ever renders one of the four.
  */
  readonly sensitivityLabel: string;
  readonly capability: WatchCapability;
  readonly labels: ActivationPanelLabels;
  readonly signInHref: string;
  /**
   * CHECKPOINT I — fired immediately before the sign-in navigation.
   *
   * Optional and inert by default, so a panel rendered without it behaves
   * exactly as the accepted one does. It exists because the map needs to
   * remember where the reader was, and that state may not travel in
   * `returnTo` — see `signInReturnState.ts`.
   */
  readonly onSignIn?: (() => void) | undefined;
  readonly onFollowInstead: (() => void) | undefined;
  readonly onDismiss: () => void;
}

export function ActivationPanel({
  chain,
  sensitivityLabel,
  capability,
  labels,
  signInHref,
  onSignIn,
  onFollowInstead,
  onDismiss,
}: ActivationPanelProps): JSX.Element {
  const subjects = assignmentSubjectList(
    chain.map((link) => link.label),
    labels.and,
  );

  const sentence = labels.assignmentSentence
    .replace('{subjects}', subjects)
    .replace('{cadence}', labels.cadenceValue);

  const signedOut = capability.blockedBy === 'SIGNED_OUT';

  return (
    <div data-gn="activation-panel" className="flex flex-col gap-[16px]">
      {/*
        THE SENTENCE, SET LARGE AND FIRST.

        It is the whole argument for the transaction, so it is the first thing
        read and the only thing at this size. Everything below it is detail.
      */}
      <p
        data-gn="activation-sentence"
        className="text-[15px] leading-[1.55] text-sp-ink"
      >
        {sentence}
      </p>

      <p
        data-gn="activation-sensitivity"
        className="font-gn-mono text-[9.5px] uppercase leading-[1.6] tracking-[0.1em] text-sp-ink-3"
      >
        {labels.sensitivityLine} <span className="text-sp-ink-2">{sensitivityLabel}</span>
      </p>

      {/*
        ── THE HONEST STATE, WHERE A PRICE AND A PRIMARY WOULD GO ───────────

        A violet left edge marks this as a capability boundary — that is what
        violet is for, and it is 1px, with no fill. There is no price, because
        none is set. There is no BEGIN MONITORING, because nothing would begin.
      */}
      <div
        data-gn="activation-unavailable"
        data-gn-blocked-by={capability.blockedBy}
        className="border-s-2 border-sp-capability-line bg-sp-panel-2 py-[10px] ps-[11px] pe-[10px]"
      >
        <h3 className="font-gn-mono text-[9.5px] uppercase tracking-[0.12em] text-sp-capability">
          {signedOut ? labels.signedOutTitle : labels.unavailableTitle}
        </h3>
        <p className="mt-[5px] text-[11.5px] leading-[1.55] text-sp-ink-2">
          {signedOut ? labels.signedOutBody : labels.unavailableBody}
        </p>
      </div>

      <div className="flex flex-col gap-[7px]">
        {/*
          SIGNED OUT GETS THE REAL SIGN-IN PATH — the same released route the
          accepted anonymous Follow state already uses. No local identifier is
          minted as a stand-in.
        */}
        {signedOut && (
          <a
            data-gn="activation-signin"
            href={signInHref}
            onClick={onSignIn}
            className="flex min-h-[44px] w-full items-center justify-center rounded-[2px] border border-sp-line-2 px-[10px] py-[11px] font-gn-mono text-[10px] uppercase tracking-[0.14em] text-sp-ui-idle outline-none transition-[color,background-color,border-color] duration-[140ms] hover:border-sp-cyan/45 hover:bg-sp-cyan/[0.16] hover:text-sp-cyan focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-sp-cyan"
          >
            {labels.signIn}
          </a>
        )}

        {/*
          §12.4's secondary, and the one thing on this panel that WORKS. Follow
          is shipped and free; offering it is not a consolation prize, it is the
          honest half of the same intent.
        */}
        {onFollowInstead && (
          <button
            type="button"
            data-gn="activation-follow-instead"
            onClick={onFollowInstead}
            className="flex min-h-[44px] w-full items-center justify-center rounded-[2px] border border-sp-line-2 px-[10px] py-[11px] font-gn-mono text-[10px] uppercase tracking-[0.14em] text-sp-ui-idle outline-none transition-[color,background-color,border-color] duration-[140ms] hover:border-sp-cyan/45 hover:bg-sp-cyan/[0.16] hover:text-sp-cyan focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-sp-cyan"
          >
            {labels.followInstead}
          </button>
        )}

        {/* Dismiss returns to the situation, fully readable. §12.4. */}
        <button
          type="button"
          data-gn="activation-dismiss"
          onClick={onDismiss}
          className="min-h-[36px] font-gn-mono text-[9.5px] uppercase tracking-[0.12em] text-sp-ink-3 outline-none transition-colors hover:text-sp-ink-2 focus-visible:outline focus-visible:outline-1 focus-visible:outline-sp-cyan"
        >
          {labels.dismiss}
        </button>
      </div>

      <p
        data-gn="activation-capability-note"
        className="font-gn-mono text-[9px] uppercase leading-[1.6] tracking-[0.1em] text-sp-ink-3"
      >
        {labels.capabilityNote}
      </p>
    </div>
  );
}
