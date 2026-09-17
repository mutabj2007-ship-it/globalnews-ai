'use client';

import { useEffect } from 'react';
import type { LanguageCode } from '@globalnews-ai/shared';
import type { GeographyTotal } from '@/lib/map/evidence/evidenceModel';
import type { DisplayPrecision } from '@/lib/map/spatial/precisionModel';
import type { CoverageState, ProviderStatus } from '@/lib/map/selection/selectionIntelligence';
import type { CalloutPlacement } from '@/lib/map/selection/calloutPlacement';
import { FollowControl } from '@/components/map/shell/FollowControl';
import { accountSignInUrl } from '@/lib/api/accountBase';
import type { EvidenceSelectionCardLabels, FollowRelationship } from './EvidenceSelectionCard';
import { MachineReadable } from '@/lib/typography/runBoundary';
import type { LocationProvenance } from '@/lib/spatial/spatialPrecision';

/**
 * SPATIAL M2 · DESIGN SELECTION-CALLOUT AMENDMENT.
 *
 * "It solves the selected-country visibility problem without overloading the
 * right intelligence rail."
 *
 * ── THE CONTENT LIST IS CLOSED, AND THAT IS THE COMPONENT'S WHOLE SHAPE ───
 *
 * The amendment gives eleven items and then a second list of six things not to
 * add — situations, the reporting list, topics, imagery, a sparkline, and
 * scrollable content — closing with the acceptance test that makes the rule
 * checkable: "IF THE CALLOUT NEEDS A SCROLLBAR, THE IMPLEMENTATION IS WRONG."
 *
 * So this component takes no `items`, no `topics` and no `situations` prop.
 * Not "takes them and ignores them" — has nowhere to put them. A card that
 * cannot receive a list cannot grow one later by accident, and the fixed
 * height below is the second guard rather than the only one.
 *
 * ── IT OWNS ONE PIECE OF STATE, AND IT IS NOT THE SELECTION ───────────────
 *
 * "SelectionCallout must render from the existing `state.selected`. It must not
 * create another selection record or independent business state. The only local
 * state it may own is whether the callout is dismissed."
 *
 * `dismissed` is therefore held by the SHELL, beside the selection it is keyed
 * to, and arrives here as a prop with a callback — so this file holds no state
 * at all and the "one piece" cannot become two. `follow` is the same
 * relationship object the right rail is given, from the route's single
 * `useCountryFollows()` instance, which is what makes "a Follow action from the
 * callout must update the right rail in the same frame, and vice versa" true by
 * construction rather than by synchronisation.
 *
 * ── AND DISMISSAL IS NOT DESELECTION ──────────────────────────────────────
 *
 * "Dismissing the callout must NOT clear the selection" and "must NOT close the
 * intelligence rail". `onDismiss` sets one boolean. It is not wired to the
 * selection handler anywhere, and the rail is a grid column that this component
 * cannot reach.
 */

export interface SelectionCalloutLabels {
  readonly close: string;
  /** Shown on an action whose handler this surface was not given. */
  readonly actionUnavailable: string;
  readonly focus: string;
  readonly analysis: string;
  readonly sources: string;
}

export interface SelectionCalloutProps {
  /** From `state.selected`. The callout creates no selection of its own. */
  readonly geographyId: string;
  readonly displayName: string;
  readonly identity?: { readonly iso3: string; readonly region?: string };
  readonly total?: GeographyTotal;
  readonly provenance?: LocationProvenance;
  readonly availableGeometry?: DisplayPrecision;
  readonly providerStatus?: ProviderStatus;
  readonly coverage?: CoverageState;
  /** The SAME relationship object the right rail receives. Never a copy. */
  readonly follow?: FollowRelationship | null;
  readonly placement: CalloutPlacement;
  /**
   * The shell measures the rendered box so the placement maths uses the card's
   * REAL height rather than its ceiling. Not state the callout owns — a
   * measurement of the DOM, like the projected anchor.
   */
  readonly measureRef?: (node: HTMLElement | null) => void;
  readonly language?: LanguageCode;
  readonly labels: EvidenceSelectionCardLabels;
  readonly calloutLabels: SelectionCalloutLabels;
  readonly onDismiss: () => void;
  readonly onFocus?: () => void;
  readonly onOpenAnalysis?: () => void;
  readonly onOpenSources?: () => void;
}

/**
 * FIXED, NOT MAXIMUM.
 *
 * The width the placement maths is given and the width the element renders are
 * the same number, so the flip decision cannot be made against a size the
 * browser then disagrees with.
 */
/** Where the released sign-in path returns an anonymous visitor. */
const CALLOUT_RETURN_DESTINATION = '/map';

export const CALLOUT_WIDTH = 268;

/**
 * A HEIGHT CEILING THAT IS NEVER REACHED BY THE CLOSED CONTENT LIST.
 *
 * `overflow-hidden` rather than `overflow-auto`, deliberately: if some future
 * edit does overflow this box, the content is CLIPPED and the defect is visible
 * in a screenshot. `auto` would have hidden the same mistake behind a scrollbar
 * — the exact thing the amendment names as proof the implementation is wrong.
 */
export const CALLOUT_MAX_HEIGHT = 320;

const formatAge = (hours: number): string =>
  hours < 1 ? '<1H' : hours < 48 ? `${Math.round(hours)}H` : `${Math.round(hours / 24)}D`;

export function SelectionCallout({
  geographyId,
  displayName,
  identity,
  total,
  provenance,
  providerStatus,
  coverage,
  follow = null,
  placement,
  measureRef,
  language = 'en',
  labels,
  calloutLabels,
  onDismiss,
  onFocus,
  onOpenAnalysis,
  onOpenSources,
}: SelectionCalloutProps): JSX.Element {
  /*
    ESCAPE DISMISSES IT.

    Bound on the document rather than on the element, because the reader's focus
    is almost never inside the callout when they want it gone — they have just
    clicked a country. `keydown` and not `keyup` so it matches every other
    Escape in the product.
  */
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onDismiss();
    };

    document.addEventListener('keydown', onKeyDown);

    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onDismiss]);

  return (
    <aside
      ref={measureRef}
      data-gn="selection-callout"
      data-gn-geography={geographyId}
      data-gn-side={placement.side}
      data-gn-parked={placement.parked ? 'true' : 'false'}
      /*
        NOT `data-gn-hud-reserve`. The label placer avoids the HUD islands
        because they are permanent furniture; the callout is transient and
        follows the camera, and reserving space for it would make country labels
        jump around the map as the reader panned.
      */
      aria-label={displayName}
      style={{
        left: `${placement.x}px`,
        top: `${placement.y}px`,
        width: `${CALLOUT_WIDTH}px`,
        maxHeight: `${CALLOUT_MAX_HEIGHT}px`,
      }}
      /*
        `overflow-hidden` — see CALLOUT_MAX_HEIGHT. And `pointer-events-auto`
        because the canvas region's overlay layer is inert to the pointer;
        without it the buttons below would not be clickable.
      */
      className="pointer-events-auto absolute z-20 overflow-hidden border border-sp-line-2 bg-sp-panel/95 shadow-[0_10px_30px_rgba(0,0,0,.55)] backdrop-blur-[2px]"
    >
      {/* IDENTITY + CLOSE */}
      <div className="flex items-start justify-between gap-[8px] border-b border-sp-line px-[11px] py-[9px]">
        <div className="min-w-0">
          <h2
            data-gn="callout-title"
            className="truncate text-[14px] font-semibold leading-tight text-sp-ink"
          >
            {displayName}
          </h2>
          {identity && (
            <p
              data-gn="callout-identity"
              className="mt-[2px] font-gn-mono text-[8.5px] uppercase tracking-[0.14em] text-sp-ink-3"
            >
              <MachineReadable>{identity.iso3}</MachineReadable>
              {identity.region && <> {'·'} {identity.region}</>}
            </p>
          )}
        </div>
        {/*
          THE CLOSE CONTROL. A named button, not a bare glyph — the same rule
          Design applies to the source card's open affordance, for the same
          reason: an icon with no accessible name is a control only some readers
          have.
        */}
        <button
          type="button"
          data-gn="callout-close"
          onClick={onDismiss}
          aria-label={calloutLabels.close}
          className="-mr-[3px] -mt-[2px] flex h-[22px] w-[22px] shrink-0 items-center justify-center border border-sp-line text-[11px] text-sp-ink-3 outline-none transition-colors hover:border-sp-line-2 hover:text-sp-ink-2 focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-gn-focus"
        >
          <span aria-hidden="true">&times;</span>
        </button>
      </div>

      {/* PROVIDER STATE */}
      {providerStatus && (
        <div
          data-gn="callout-provider"
          data-gn-condition={providerStatus.condition}
          className="flex items-center gap-[6px] border-b border-sp-line px-[11px] py-[6px]"
        >
          <span
            aria-hidden="true"
            className={`block h-[5px] w-[5px] shrink-0 rounded-full ${
              providerStatus.condition === 'LIVE'
                ? 'bg-sp-cyan'
                : providerStatus.condition === 'DELAYED'
                  ? 'bg-sp-amber'
                  : 'border border-dashed border-sp-muted'
            }`}
          />
          <span
            className={`truncate font-gn-mono text-[8px] uppercase tracking-[0.12em] ${
              providerStatus.condition === 'LIVE'
                ? 'text-sp-ink-2'
                : providerStatus.condition === 'DELAYED'
                  ? 'text-sp-amber'
                  : 'text-sp-muted'
            }`}
          >
            {providerStatus.condition === 'LIVE'
              ? labels.provider.live
              : providerStatus.condition === 'DELAYED'
                ? labels.provider.delayed
                : labels.provider.none}
          </span>
        </div>
      )}

      {/* CEILING + PROVENANCE */}
      {total && (
        <div data-gn="callout-precision" className="flex flex-wrap gap-[4px] px-[11px] py-[8px]">
          <span className="border border-sp-cyan/45 bg-sp-cyan/[0.12] px-[6px] py-[2px] font-gn-mono text-[8.5px] uppercase tracking-[0.13em] text-sp-cyan">
            {labels.levels[total.finestPrecision]}
          </span>
          {provenance !== undefined && provenance !== 'STATED' && (
            <span className="border border-sp-muted/40 px-[6px] py-[2px] font-gn-mono text-[8.5px] uppercase tracking-[0.13em] text-sp-muted">
              {labels.provenanceValues[provenance]}
            </span>
          )}
          {/*
            NO WATCHING PILL HERE, DELIBERATELY.

            The right rail's block 03 carries watching as METADATA beside the
            other pills, because that card also carries a separate follow
            action further down and the two are far apart. The callout's content
            list is closed and much shorter: name, ISO, region, ceiling and
            provenance, counts, coverage, provider, the follow control, and
            three actions. The follow control is eight lines below this pill row
            and already reads "Watching <country>", so a pill saying the same
            word twice in one 268 px card is noise, not information.
          */}
        </div>
      )}

      {/* REPORTS / SOURCES / NEW */}
      {total && (
        <div
          data-gn="callout-stats"
          className="grid grid-cols-3 gap-px border-y border-sp-line bg-sp-line"
        >
          {(
            [
              [total.reportCount, labels.reports, 'text-sp-cyan'],
              /*
                CHECKPOINT H — distinct publishers, or an em dash. Never the
                provider's hard-coded 1 under the word SOURCES.
              */
              [total.publisherCount, labels.sources, 'text-sp-ink'],
              [
                total.newSinceLastVisit,
                labels.newSince,
                total.newSinceLastVisit > 0 ? 'text-sp-amber' : 'text-sp-muted',
              ],
            ] as const
          ).map(([value, label, tone]) => (
            <div key={label} className="bg-sp-panel-2 px-[8px] py-[6px]">
              <b className={`block font-gn-mono text-[15px] font-medium ${tone}`}>
                {value ?? '—'}
              </b>
              <span className="block truncate font-gn-mono text-[7.5px] uppercase tracking-[0.1em] text-sp-ink-3">
                {label}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* COVERAGE BAND + FRESHNESS */}
      {coverage && (
        <div
          data-gn="callout-coverage"
          className="flex flex-wrap items-center gap-[6px] border-b border-sp-line px-[11px] py-[7px]"
        >
          <span
            data-gn-band={coverage.band}
            className={`px-[6px] py-[2px] font-gn-mono text-[8.5px] uppercase tracking-[0.13em] ${
              coverage.band === 'STRONG'
                ? 'border border-sp-cyan/45 bg-sp-cyan/[0.12] text-sp-cyan'
                : coverage.band === 'MODERATE'
                  ? 'border border-sp-cyan/[0.28] text-sp-cyan'
                  : coverage.band === 'THIN'
                    ? 'border border-sp-amber/40 bg-sp-amber/[0.12] text-sp-amber'
                    : 'border border-sp-muted/40 text-sp-muted'
            }`}
          >
            {labels.coverage.bands[coverage.band]}
          </span>
          {coverage.ageHours !== null && (
            <span className="font-gn-mono text-[8px] uppercase tracking-[0.1em] text-sp-ink-3">
              {coverage.ageIsObservedOnly
                ? labels.coverage.seenPrefix
                : labels.coverage.publishedPrefix}{' '}
              {formatAge(coverage.ageHours)}
            </span>
          )}
          {coverage.flag && (
            <span
              data-gn-flag={coverage.flag}
              className="border border-sp-amber/40 px-[4px] py-[1px] font-gn-mono text-[7.5px] uppercase tracking-[0.12em] text-sp-amber"
            >
              {labels.coverage.flags[coverage.flag]}
            </span>
          )}
        </div>
      )}

      {/* FOLLOW — THE SAME COMPONENT AND THE SAME HANDLERS AS THE RAIL */}
      <div className="px-[11px] py-[8px]">
        {/*
          THE FOLLOW CONTROL IS FIRST, AND IT IS ALWAYS PRESENT.

          `follow === null` is the accepted signed-out contract — anonymous, a
          401, or a failed read. The control is not omitted for it; the released
          sign-in path takes its place, exactly as the rail's block 11 does, so
          the cluster is complete for every visitor and no visitor is offered a
          button that would appear to save and could not.
        */}
        {follow === null ? (
          <a
            data-gn="callout-follow-signin"
            href={accountSignInUrl(CALLOUT_RETURN_DESTINATION)}
            className="flex min-h-[44px] w-full items-center justify-center gap-[8px] rounded-[2px] border border-sp-line-2 px-[10px] py-[11px] font-gn-mono text-[10px] uppercase tracking-[0.14em] text-sp-ink-2 outline-none transition-colors hover:border-sp-amber/50 hover:bg-sp-amber/[0.14] hover:text-sp-amber focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-gn-focus"
          >
            {labels.follow.signIn}
          </a>
        ) : (
          <FollowControl
            geographyId={follow.countryIso3}
            geographyLabel={displayName}
            isWatched={follow.isFollowed}
            isPending={follow.isPending}
            hasFailed={follow.hasFailed}
            labels={labels.follow}
            onToggle={(id, next) => (next ? follow.onFollow(id) : follow.onUnfollow(id))}
          />
        )}

        {/*
          ══ FOCUS · ANALYSIS · SOURCES — ALWAYS ALL THREE ═══════════════════

          CTO correction, 2026-09-01: "the popup must expose the full
          selected-geography action cluster, not a reduced subset ... These must
          not disappear simply because the rail also contains related actions."

          THE THREE ARE RENDERED UNCONDITIONALLY. They were previously each
          gated on their handler being defined, which is how a screenshot came
          to show FOCUS alone — the route supplied no Analysis or Sources
          handler, so two of the four vanished with no trace that anything was
          missing. A missing wire now shows up as a DISABLED button carrying its
          own name, which is a defect anyone can see, rather than as an absence
          nobody can.

          Order is fixed and matches Design's action model: the follow control
          above is the primary selection action, then Focus, Analysis, Sources.
        */}
        <div data-gn="callout-actions" className="mt-[7px] grid grid-cols-3 gap-[4px]">
          {(
            [
              ['focus', calloutLabels.focus, onFocus],
              ['open-analysis', calloutLabels.analysis, onOpenAnalysis],
              ['open-sources', calloutLabels.sources, onOpenSources],
            ] as const
          ).map(([action, label, handler]) => (
            <button
              key={action}
              type="button"
              data-gn="callout-action"
              data-gn-action={action}
              onClick={handler}
              disabled={handler === undefined}
              /*
                AN HONEST REASON, NOT A SILENT DISABLE. CTO, 2026-09-01: "If a
                required handler is unavailable during development, render the
                action DISABLED WITH AN HONEST REASON rather than removing it."
                So an unwired action still carries its own name, is visibly
                unavailable, and says why when asked — to the pointer and to a
                screen reader alike.
              */
              {...(handler === undefined
                ? {
                    title: calloutLabels.actionUnavailable,
                    'aria-describedby': undefined,
                    'aria-label': `${label} — ${calloutLabels.actionUnavailable}`,
                  }
                : {})}
              className="cursor-pointer truncate rounded-[2px] border border-sp-line-2 px-[5px] py-[7px] font-gn-mono text-[8.5px] uppercase tracking-[0.1em] text-sp-ink-2 outline-none transition-colors hover:border-sp-cyan/45 hover:bg-sp-cyan/[0.16] hover:text-sp-cyan focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-gn-focus disabled:cursor-not-allowed disabled:border-sp-line disabled:text-sp-muted disabled:hover:bg-transparent disabled:hover:text-sp-muted"
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </aside>
  );
}
