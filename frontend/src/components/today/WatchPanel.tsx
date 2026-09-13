'use client';

import type { LanguageCode } from '@globalnews-ai/shared';
import { CountryFollowControl } from '@/components/home/CountryFollowControl';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { usePathname } from 'next/navigation';
import { accountSignInUrl } from '@/lib/api/accountBase';
import { WATCH_CHROME } from '@/components/today/todayWorkspaceGeometry';

/**
 * R7 `03` + R4 CORRECTION — WATCH, NOW THE LEFT COLUMN, AND COMPACT.
 *
 * ── WHAT "COMPACT" MEANS HERE, CONCRETELY ────────────────────────────────
 *
 * A 240px track with one line per subject. Every row carries at most three
 * things — the subject, what changed for it, and today's count — and the panel
 * carries at most one line of basis above them. Nothing in it wraps to a
 * paragraph, including the signed-out state, which used to be three lines of
 * prose and is now one line plus a control.
 *
 * ── "WHAT YOU MISSED WHILE AWAY", FROM THE AUTHENTICATED CONTRACT ────────
 *
 * The boundary is `previousSeenAt` from `POST /users/me/seen` — the server's
 * own `User.lastSeenAt`, read before it is written. It is compared against each
 * record's `firstSeenAt`, when THIS SYSTEM first wrote the article down, so
 * both halves of the comparison are platform clocks and every number is a real
 * count of real records.
 *
 * THERE IS NO DEVICE-LOCAL BOUNDARY ANYWHERE IN THIS FILE. The previous
 * `localStorage` mechanism is deleted; a visitor-side clock gave two people
 * sharing a browser one answer and the same person on a second device another.
 *
 * WHEN THERE IS NO BOUNDARY, THE CLAIM STOPS. A first-ever visit, a refused
 * request, or a signed-out reader all produce no interval — and rather than
 * showing a zero, which would assert that nothing arrived, the panel names what
 * it IS showing: today's intelligence from the countries you follow.
 *
 * ── THE PULSE IS RATIONED, DELIBERATELY (`03 §3`) ────────────────────────
 *
 * On the DOT only, three iterations, at most three rows at once, and removed
 * entirely under `prefers-reduced-motion`. Nothing is lost when it does not
 * run: the state is carried by the border, the tint, the NEW tag and the count.
 * A permanently blinking list is an attention tax the reader cannot pay down,
 * and it teaches them to ignore the one row that matters.
 */
const PULSE_CSS = `
@keyframes gn-today-watch-pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: .3; transform: scale(1.8); }
}
.gn-today-pulse-3 { animation: gn-today-watch-pulse 1.15s ease-in-out 3; }
@media (prefers-reduced-motion: reduce) {
  .gn-today-pulse-3 { animation: none !important; }
}
`;

export interface WatchSubject {
  /** ISO-3, the alphabet the follow API speaks. */
  code: string;
  label: string;
  /** Records for this subject in THIS retrieval. Zero is real and is drawn. */
  count: number;
  /**
   * Records for this subject first observed AFTER the authenticated boundary.
   * Always 0 when no boundary exists — and the panel then draws nothing for it,
   * because 0-with-no-boundary is not a finding.
   */
  missed: number;
}

interface WatchPanelProps {
  subjects: WatchSubject[];
  /*
    UNFOLLOW — the other half of the re-wiring described in
    `TodayGeographyPanel`. The roster is where a reader sees what they follow,
    so it is where stopping belongs; the country list is where starting
    belongs. That split is the retired design's own, restated rather than
    redesigned. Optional so every existing caller compiles unchanged.
  */
  onUnfollow?: (iso3: string) => void;
  pendingIso3?: string | null;
  failedIso3?: string | null;
  /** Present only when the account genuinely has a follow list. */
  isAnonymous: boolean;
  /** The follow list is READ on mount; that interval is its own state. */
  isLoading: boolean;
  /**
   * `previousSeenAt` from the authenticated return-state contract, or null when
   * there is no interval to report. Null is not zero.
   */
  previousSeenAt: string | null;
  /** Records first observed since the boundary, across the whole retrieval. */
  missedTotal: number;
  /** At most three, capped by the caller (`03 §3`). */
  pulsingSubjects: ReadonlySet<string>;
  height: number;
  selectedCountry: string | null;
  onSelectSubject: (code: string) => void;
  language: LanguageCode;
}

export function WatchPanel({
  subjects,
  onUnfollow,
  pendingIso3 = null,
  failedIso3 = null,
  isAnonymous,
  isLoading,
  previousSeenAt,
  missedTotal,
  pulsingSubjects,
  height,
  selectedCountry,
  onSelectSubject,
  language,
}: WatchPanelProps): JSX.Element {
  /*
    M-ALPHA-AUTH — the Today Watch entry point returns the user to the page this
    panel is mounted on. CTO requirement 9: the follow itself is NOT replayed
    after the OAuth round trip; the user presses Follow again, now signed in.
  */
  const pathname = usePathname();

  const t = getDictionary(language).todayWorkspace.watch;
  /*
    A BOUNDARY IS A SIGNED-IN FACT. `RequireAuthGuard` puts the endpoint out of
    an anonymous caller's reach, so a signed-out reader can never have one — and
    this conjunction is what guarantees the signed-out panel makes no
    missed-since claim and shows no missed count, whatever else changes.
  */
  const hasBoundary = !isAnonymous && previousSeenAt !== null;

  return (
    <section
      aria-label={t.regionLabel}
      className="flex flex-col overflow-hidden border-r border-[#16202e] bg-[#070c12]"
      style={{ height: `${height}px` }}
    >
      <style dangerouslySetInnerHTML={{ __html: PULSE_CSS }} />
      <header
        className="flex shrink-0 items-center justify-between gap-[8px] px-[13px]"
        style={{ height: `${WATCH_CHROME}px` }}
      >
        <span className="flex items-baseline gap-[8px]">
          <span className="font-gn-mono text-[9px] font-bold uppercase tracking-[.16em] text-[#67e8f9]">
            {t.regionLabel}
          </span>
          {!isAnonymous && !isLoading && (
            <span className="font-gn-mono text-[8px] uppercase tracking-[.12em] text-[#4a5c73]">
              {subjects.length}
            </span>
          )}
        </span>
        {/*
          MARK ALL AS SEEN IS DELIBERATELY GONE, AND ITS ABSENCE IS THE HONEST
          OUTCOME. The boundary is now the server's `User.lastSeenAt`, advanced
          by the visit itself and throttled to once per 30 minutes. A button
          could not move it inside that window, and moving it outside the window
          would need a second endpoint this assignment forbids. A control that
          silently fails to do what it says is worse than no control: the
          boundary advances on the next visit, which is what the contract
          promises and what the panel now reflects.
        */}
      </header>

      {/*
        THE BASIS LINE — WITH A BOUNDARY IT REPORTS THE INTERVAL; WITHOUT ONE IT
        NAMES WHAT IS ON SHOW INSTEAD.

        The fallback is not a softened version of the same claim: it makes no
        claim about an interval at all. That is the difference between "nothing
        arrived while you were away", which needs a boundary, and "today's
        intelligence from the countries you follow", which needs none.

        Gated on being signed in, so the signed-out column has nothing above it.
      */}
      {!isAnonymous && !isLoading && (
        <p
          className={`shrink-0 border-y border-[#101923] px-[13px] py-[5px] font-gn-mono text-[7.5px] uppercase leading-[1.5] tracking-[.06em] ${
            hasBoundary ? 'bg-[rgba(34,211,238,.04)] text-[#67e8f9]' : 'text-[#7d92aa]'
          }`}
          aria-live="polite"
        >
          {hasBoundary
            ? missedTotal > 0
              ? `${missedTotal} ${t.missedSince}`
              : t.nothingSince
            : t.followedHeading}
        </p>
      )}

      {/* B6 — the 120px floor is declared on the element that SCROLLS; a floor
          on a clipping parent does not satisfy it. WATCH_FLOOR is this 120 plus
          WATCH_CHROME. */}
      <div
        style={{ minHeight: '120px' }}
        className="flex-1 overflow-y-auto overflow-x-hidden overscroll-contain [scrollbar-gutter:stable]"
      >
        {isLoading ? (
          <p className="px-[13px] py-[9px] font-gn-display text-[11px] leading-[1.45] text-[#7d92aa]">
            {t.loading}
          </p>
        ) : isAnonymous ? (
          /*
            THE SIGNED-OUT STATE: COMPACT EXPLANATION, SIGN-IN ACTION, NOTHING
            ELSE.

            No missed count, no interval claim, no local boundary — and nothing
            above it either, because the basis line is gated on being signed in.
            Return state is a signed-in benefit by the endpoint's own stated
            product boundary, so this column says what an account gives and
            offers the released path to one.
          */
          <div className="px-[13px] py-[9px]">
            <p className="font-gn-display text-[11px] leading-[1.45] text-[#8ba3bd]">
              {t.anonymousCompact}
            </p>
            <a
              href={accountSignInUrl(pathname ?? undefined)}
              className="mt-[7px] inline-flex min-h-[44px] items-center rounded-[7px] border border-[#2a3a4d] px-[10px] font-gn-mono text-[8px] font-bold uppercase tracking-[.10em] text-[#a9bccf] outline-none transition-colors hover:border-[#3c526a] hover:text-[#dbe6f2] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7dc0ff]"
            >
              {t.signIn}
            </a>
          </div>
        ) : subjects.length === 0 ? (
          <p className="px-[13px] py-[9px] font-gn-display text-[11px] leading-[1.45] text-[#8ba3bd]">
            {t.empty}
          </p>
        ) : (
          <ul>
            {subjects.map((subject) => {
              /* NEW is a claim about a boundary, so it needs one. */
              const isNew = hasBoundary && subject.missed > 0;
              const pulses = pulsingSubjects.has(subject.code);
              return (
                <li key={subject.code} className="flex items-center gap-[6px] pr-[10px]">
                  <button
                    type="button"
                    aria-pressed={selectedCountry !== null && selectedCountry === subject.code}
                    onClick={() => onSelectSubject(subject.code)}
                    className={`flex min-h-[44px] w-full items-start gap-[7px] px-[13px] py-[7px] text-left outline-none transition-colors hover:bg-[#0a1119] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#7dc0ff] ${
                      isNew ? 'border-l-2 border-[#22d3ee] bg-[rgba(34,211,238,.05)]' : ''
                    }`}
                  >
                    {/*
                      The pulse lives on the DOT and nowhere else, runs exactly
                      three iterations and then stops. See PULSE_CSS above.
                    */}
                    <span
                      aria-hidden="true"
                      className={`mt-[4px] h-[6px] w-[6px] shrink-0 rounded-full ${
                        pulses ? 'gn-today-pulse-3' : ''
                      }`}
                      style={{ backgroundColor: isNew ? '#22d3ee' : '#4a5c73' }}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-gn-display text-[11.5px] text-[#dbe6f2]">
                        {subject.label}
                      </span>
                      {/* What changed for THIS subject while they were away —
                          a real count, in words, never a bare tint. */}
                      {isNew && (
                        <span className="mt-[1px] block font-gn-mono text-[7.5px] uppercase tracking-[.08em] text-[#67e8f9]">
                          {subject.missed} {t.newTag}
                        </span>
                      )}
                      {/* Zero is DRAWN, and it says what WE did. */}
                      {subject.count === 0 && (
                        <span className="mt-[1px] block font-gn-display text-[9.5px] leading-[1.4] text-[#7d92aa]">
                          {t.zeroRetrieved}
                        </span>
                      )}
                    </span>
                    <span className="shrink-0 font-gn-mono text-[10px] text-[#a9bccf]">
                      {subject.count}
                    </span>
                  </button>
                  {/* A sibling, never nested: selecting a subject to filter by
                      and stopping following it are different acts. */}
                  {onUnfollow && (
                    <CountryFollowControl
                      countryCode={subject.code}
                      countryLabel={subject.label}
                      isFollowed
                      isPending={pendingIso3 === subject.code}
                      hasFailed={failedIso3 === subject.code}
                      onFollow={onUnfollow}
                      onUnfollow={onUnfollow}
                      language={language}
                    />
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
