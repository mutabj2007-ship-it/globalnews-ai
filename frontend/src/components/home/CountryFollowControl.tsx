import type { LanguageCode } from '@globalnews-ai/shared';
import { getDictionary } from '@/lib/i18n/dictionaries';

/**
 * R4 — THE FOLLOW TOGGLE. ONE REAL BUTTON, AND NOTHING BEHIND HOVER.
 *
 * ── WHY A BUTTON AND NOT A ROW AFFORDANCE ─────────────────────────────────
 *
 * The lesson Step 5A established and R2 re-measured: the homepage focus chain
 * is driven by `onMouseEnter`/`onFocus`, and NEITHER FIRES ON A TOUCH TAP. Any
 * control that only appears on hover is invisible to every phone. So this is a
 * real `<button type="button">`, activated by click, at least 44px tall, with
 * `aria-pressed` carrying the state and a visible `focus-visible` treatment.
 * There is no `onMouseEnter` anywhere in this file.
 *
 * ── THE DESTRUCTIVE WORD IS REVEALED BY FOCUS, NOT BY HOVER ───────────────
 *
 * A followed row reads "Following". The word "Unfollow" is appended only once
 * the control itself has keyboard focus, through `group-focus-visible`, so an
 * accidental thumb never lands on a label that reads as a delete. The
 * ACCESSIBLE NAME does not play that game: `aria-label` always states the
 * action the press will perform, so a screen-reader user is never told
 * "Following" when the button unfollows.
 *
 * ── A CONTROL THAT CANNOT WORK IS NOT RENDERED ────────────────────────────
 *
 * This component is only mounted when pressing it can actually do something —
 * the caller withholds it for an anonymous visitor and for an unfollowed
 * country once the account is at its ceiling. A disabled button invites a
 * click, absorbs a tap target and explains nothing; the explanation belongs
 * once, in the Watch module, where there is room to give it.
 *
 * ── PENDING AND FAILURE ARE STATES OF THIS ROW, NOT OF THE PAGE ───────────
 *
 * Both are addressed by country code, so a slow follow on one row can never
 * blank another. A failure says the row did not change — it never optimistically
 * shows the opposite state, because the only thing worse than a follow that
 * did not save is a follow that appears to have saved.
 */
interface CountryFollowControlProps {
  /** ISO-3, the alphabet the follow API speaks. */
  countryCode: string;
  /** The already-localized country name, for the accessible name. */
  countryLabel: string;
  isFollowed: boolean;
  isPending: boolean;
  hasFailed: boolean;
  onFollow: (countryCode: string) => void;
  onUnfollow: (countryCode: string) => void;
  language: LanguageCode;
}

const CONTROL =
  'group inline-flex min-h-[44px] shrink-0 items-center gap-[6px] rounded-gn-pill border px-[10px] font-gn-mono text-gn-hud-toggle uppercase outline-none transition-colors focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-gn-focus';

export function CountryFollowControl({
  countryCode,
  countryLabel,
  isFollowed,
  isPending,
  hasFailed,
  onFollow,
  onUnfollow,
  language,
}: CountryFollowControlProps): JSX.Element {
  const t = getDictionary(language).today;

  const actionLabel = isFollowed
    ? `${t.watchUnfollowAria} ${countryLabel}`
    : `${t.watchFollowAria} ${countryLabel}`;

  return (
    <span className="flex shrink-0 flex-col items-end">
      <button
        type="button"
        aria-pressed={isFollowed}
        aria-label={actionLabel}
        onClick={() => (isFollowed ? onUnfollow(countryCode) : onFollow(countryCode))}
        className={`${CONTROL} ${
          isFollowed
            ? 'border-gn-line-pill text-gn-ink-watch hover:border-gn-line-pill-hover hover:bg-gn-pill-hover'
            : 'border-gn-line-inert text-gn-ink-toggle hover:border-gn-line-pill hover:text-gn-ink-hover'
        }`}
      >
        {isPending ? (
          <span>{t.watchPending}</span>
        ) : (
          <>
            <span>{isFollowed ? t.watchFollowing : t.watchFollow}</span>
            {isFollowed && (
              /*
                Revealed by FOCUS, never by hover: a hover-only reveal is a
                control that does not exist on a touch device.
              */
              <span className="hidden group-focus-visible:inline">{t.watchUnfollow}</span>
            )}
          </>
        )}
      </button>
      {hasFailed && (
        <span className="mt-[2px] font-gn-mono text-gn-hud-micro uppercase text-gn-hud-faint">
          {t.watchFailed}
        </span>
      )}
    </span>
  );
}
