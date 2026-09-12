'use client';

/**
 * SPATIAL M2 · DESIGN REVISION 1.2 — `FollowControl`, Part II §2 (S · M2).
 *
 * "Full-width toggle on the selected geography. Unfollowed -> Follow this
 * country; followed -> filled amber Watching whose hover, focus and press label
 * read Stop watching. Optimistic update with rollback on server failure. In:
 * geographyId, isWatched. Out: onToggle. NEVER RENDERED INSIDE THE LAYER RAIL
 * OR A WATCHED-PLACES OVERLAY."
 *
 * ── WHY THIS IS A NEW COMPONENT AND NOT `CountryFollowControl` ────────────
 *
 * The BACKEND CONTRACT IS REUSED AND NOT REBUILT: this takes the same
 * `onFollow` / `onUnfollow` / pending / failed shape the route's single
 * `useCountryFollows()` instance already exposes, adds no route, no schema and
 * no second fetch path. What is new is the PRESENTATION, and Design specified
 * it precisely enough that the accepted pill could not express it — full width,
 * a filled amber followed state, and a label that changes on hover and focus.
 * `CountryFollowControl` is left exactly as accepted for the surfaces that use
 * it; this is the map's control.
 *
 * ── THE ONE PLACE DESIGN'S WORDING NEEDED A DECISION ──────────────────────
 *
 * "Reveals Stop watching on hover and focus" is a VISIBLE-LABEL rule. Taken as
 * the accessible name it would be unreachable: a touch user never hovers, and a
 * screen reader would announce "Watching Rwanda" for a control whose press
 * unfollows. So the two are separated —
 *
 *   VISIBLE LABEL   swaps to "Stop watching" on hover and on focus, exactly as
 *                   specified, and the CSS does it so it works before hydration.
 *   ACCESSIBLE NAME `aria-label` ALWAYS states what the press will do, in every
 *                   state, hovered or not. `aria-pressed` carries the state.
 *
 * A sighted mouse user gets Design's reveal; everyone else gets a control that
 * says what it does. Neither reading of the sentence is sacrificed.
 *
 * ── AND A FAILED WRITE SAYS SO ────────────────────────────────────────────
 *
 * "Optimistic update with rollback on server failure." The rollback belongs to
 * the hook, which owns the list; this renders the CONSEQUENCE — the control
 * returns to its true state and a failure line appears beneath it. A follow
 * that appears to have saved and did not is the one outcome worse than a
 * refusal.
 */

export interface FollowControlLabels {
  /** Unfollowed. Design's exact wording: "Follow this country". */
  readonly follow: string;
  /** Followed, resting. Completed with the geography's name. */
  readonly watching: string;
  /** Followed, hovered or focused, and the accessible name when followed. */
  readonly stopWatching: string;
  /** In flight. */
  readonly pending: string;
  /** The write did not land. */
  readonly failed: string;
  /**
   * ANONYMOUS. Design requires the control on every selected country; the
   * accepted signed-out contract requires it never to fake a save. This is the
   * copy on the released sign-in path that satisfies both.
   */
  readonly signIn: string;
}

export interface FollowControlProps {
  /** The selected geography. Design's `geographyId`; here always a country. */
  readonly geographyId: string;
  readonly geographyLabel: string;
  readonly isWatched: boolean;
  readonly isPending?: boolean;
  readonly hasFailed?: boolean;
  readonly labels: FollowControlLabels;
  readonly onToggle: (geographyId: string, next: boolean) => void;
}

export function FollowControl({
  geographyId,
  geographyLabel,
  isWatched,
  isPending = false,
  hasFailed = false,
  labels,
  onToggle,
}: FollowControlProps): JSX.Element {
  const restingLabel = isWatched ? `${labels.watching} ${geographyLabel}` : labels.follow;
  const actionName = isWatched
    ? `${labels.stopWatching} ${geographyLabel}`
    : `${labels.follow} — ${geographyLabel}`;

  return (
    <div data-gn="card-follow" data-gn-watched={isWatched ? 'true' : 'false'}>
      <button
        type="button"
        data-gn="follow-control"
        /* THE STATE, MACHINE-READABLE. Not inferred from the label text. */
        aria-pressed={isWatched}
        /* THE ACTION, ALWAYS. Never the resting label. See the note above. */
        aria-label={actionName}
        disabled={isPending}
        onClick={() => onToggle(geographyId, !isWatched)}
        className={`group flex min-h-[44px] w-full cursor-pointer items-center justify-center gap-[8px] rounded-[2px] border px-[10px] py-[11px] font-gn-mono text-[10px] uppercase tracking-[0.14em] outline-none transition-colors focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-gn-focus disabled:cursor-progress ${
          isWatched
            ? /*
                FILLED AMBER, and it reverts to an outlined amber on hover and
                focus so the destructive reading is visibly different from the
                resting state rather than only differently worded.
              */
              'border-sp-amber bg-sp-amber font-semibold text-sp-amber-on hover:border-sp-amber/60 hover:bg-sp-panel hover:text-sp-amber focus-visible:border-sp-amber/60 focus-visible:bg-sp-panel focus-visible:text-sp-amber'
            : 'border-sp-line-2 bg-transparent text-sp-ink-2 hover:border-sp-amber/50 hover:bg-sp-amber/[0.14] hover:text-sp-amber'
        }`}
      >
        {isPending ? (
          <span data-gn="follow-label">{labels.pending}</span>
        ) : isWatched ? (
          <>
            {/*
              TWO SPANS, SWAPPED BY CSS — so the reveal works with JavaScript
              still loading and needs no hover state in React. `group-hover` and
              `group-focus-visible` cover Design's "hover and focus" exactly.
            */}
            <span
              data-gn="follow-label"
              data-gn-label="resting"
              className="group-hover:hidden group-focus-visible:hidden"
            >
              &#9678; {restingLabel}
            </span>
            <span
              data-gn="follow-label-hover"
              data-gn-label="action"
              className="hidden group-hover:inline group-focus-visible:inline"
            >
              {labels.stopWatching}
            </span>
          </>
        ) : (
          <span data-gn="follow-label">{labels.follow}</span>
        )}
      </button>

      {hasFailed && (
        <p
          data-gn="follow-failed"
          role="status"
          className="mt-[5px] font-gn-mono text-[8.5px] uppercase tracking-[0.12em] text-sp-amber"
        >
          {labels.failed}
        </p>
      )}
    </div>
  );
}
