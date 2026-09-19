'use client';

import type { LanguageCode, NewsCategory } from '@globalnews-ai/shared';
import { type DisplayPrecision, isFinerThan, markerStyleFor } from '@/lib/map/spatial/precisionModel';
import { legendToken } from '@/lib/map/spatial/colourGrammar';
import type { GeographyTotal } from '@/lib/map/evidence/evidenceModel';
import type { MapPeriod } from '@/lib/map/state/mapState';
import { rememberMapStateForSignIn } from '@/lib/map/state/signInReturnState';
import type {
  CategoryCount,
  CoverageState,
  ProviderStatus,
  RetainedItem,
} from '@/lib/map/selection/selectionIntelligence';
import { applyCardFilters } from '@/lib/map/selection/selectionIntelligence';
import { FollowControl, type FollowControlLabels } from '@/components/map/shell/FollowControl';
import { SourceCard } from '@/components/map/shell/SourceCard';
import { accountSignInUrl } from '@/lib/api/accountBase';
import { WatchCta, type WatchCtaLabels } from './monetization/WatchCta';
import { AssessmentTimelineStrip, type TimelineLabels } from './monetization/AssessmentTimeline';
import { watchCtaIsSolePrimary, type WatchCtaStage } from '@/lib/map/monetization/watchCtaLadder';
import { MachineReadable } from '@/lib/typography/runBoundary';
import { continentDisplayName } from '@/lib/map/geography/displayName';
import type { LocationProvenance } from '@/lib/spatial/spatialPrecision';

/**
 * SPATIAL M2 — THE INTELLIGENCE CARD, FROM DESIGN PART I §E AND PART II §2.
 *
 * "A GATEWAY, NOT A DASHBOARD: counts, ceiling, confidence, situations,
 * retained reporting, topics, four actions."
 *
 * ── THE FOUR THINGS THIS CARD IS FORBIDDEN TO IMPLY ───────────────────────
 *
 * Part I §G names them, and each has a specific defence here:
 *
 *   "that an event happened somewhere because the map can draw that place"
 *     -> a selected place with no records renders the NO-EVIDENCE state with
 *        the period stated. It is not an empty card; it is a sentence.
 *
 *   "that absence of evidence is absence of the event"
 *     -> the no-evidence copy says nothing was RETAINED IN THIS PERIOD, and
 *        the period is named in the same breath. `period` is a required prop
 *        for that reason — the statement is untrue without it.
 *
 *   "that a filled country means national coverage"
 *     -> the precision row states the level the evidence actually asserts, and
 *        says so separately from the count.
 *
 *   "that an AI-inferred location is a verified one"
 *     -> INTERPRETED and CONTESTED records are excluded from the verified
 *        total, which is shown as its own number beside the raw one rather
 *        than replacing it.
 *
 * ── THE TWO AXES ARE NEVER COLLAPSED ──────────────────────────────────────
 *
 * Part I §G: precision and provenance "must never be collapsed into a single
 * confidence score in the interface — a STATED country record and an
 * INTERPRETED city record are differently useful, NOT RANKABLE ON ONE AXIS."
 *
 * So the card renders two separate rows with two separate labels, and computes
 * no score from them. There is no line in this component that multiplies,
 * averages or orders the two.
 */

export interface EvidenceSelectionCardLabels {
  readonly reports: string;
  readonly sources: string;
  readonly newSince: string;
  readonly precisionLabel: string;
  readonly provenanceLabel: string;
  readonly provenanceValues: Readonly<Record<LocationProvenance, string>>;
  readonly levels: Readonly<Record<DisplayPrecision, string>>;
  /**
   * THE FIVE REGISTRY GROUPINGS, LOCALISED — MAP-DISPLAY-NAME-CENTRALISATION.
   *
   * `identity.region` is the country registry's own English grouping, and the
   * identity line rendered it raw: a Polish reader met `KEN · AFRICA`. It
   * arrives here as DATA and is localised at the edge that shows it, which is
   * why this record lives in the labels rather than the value being translated
   * upstream in `MapPageClient`.
   *
   * Shared with `SelectionCallout`, which is handed this same label block, so
   * the two surfaces cannot disagree about what continent a country is in.
   */
  readonly continents: Readonly<Record<string, string>>;
  readonly verifiedReports: string;
  readonly unverifiedQualifier: string;
  readonly noEvidenceTitle: string;
  /** Must name the period. See the note above. */
  readonly noEvidenceBody: string;
  readonly widenPeriod: string;
  readonly periods: Readonly<Record<MapPeriod, string>>;
  readonly drawnCoarser: string;
  readonly heading: string;
  readonly scope: string;
  readonly watching: string;
  readonly stateHeading: string;
  readonly ceilingNote: string;
  readonly actions: {
    readonly focus: string;
    readonly follow: string;
    readonly unfollow: string;
    readonly openAnalysis: string;
    readonly openSources: string;
  };
  /* ── DESIGN REVISION 1.2 · THE FIVE RESTORED BLOCKS ──────────────────── */
  /** 01 identity — the line under the name: ISO and geographic region. */
  readonly identityHeading: string;
  /** 02 provider status. */
  readonly provider: {
    readonly live: string;
    readonly delayed: string;
    readonly none: string;
    readonly stored: string;
  };
  /** 05 coverage state. */
  readonly coverage: {
    readonly heading: string;
    readonly bands: Readonly<Record<'STRONG' | 'MODERATE' | 'THIN' | 'NONE', string>>;
    readonly flags: Readonly<Record<'AGING' | 'STALE', string>>;
    readonly publishers: string;
    readonly newest: string;
    readonly seenPrefix: string;
    readonly publishedPrefix: string;
  };
  /** 06 category distribution, as selection-scoped filters. */
  readonly categoriesHeading: string;
  readonly allCategories: string;
  readonly categories: Readonly<Record<string, string>>;
  /** 08 situations. */
  readonly situationsHeading: string;
  readonly situationsUnavailable: string;
  /** 09 retained reporting. */
  readonly retainedHeading: string;
  readonly retainedFilteredEmpty: string;
  readonly openSource: string;
  readonly askAbout: string;
  /** CHECKPOINT D — the VISIBLE name of the AI action; askAbout stays the accessible one. */
  readonly askAiShort: string;
  /** 11 topics. */
  readonly topicsHeading: string;
  /** 07a follow control. */
  readonly follow: FollowControlLabels;
  /**
   * 12 selection tail. r1.4: "Clear selection — the only control that
   * legitimately sits at the bottom, because it is an exit rather than a task."
   */
  readonly clearSelection: string;
}

/**
 * The follow relationship for the selected country, lifted from the route's
 * single `useCountryFollows()` instance.
 *
 * PENDING AND FAILED ARE ADDRESSED BY COUNTRY CODE, exactly as the accepted
 * control expects, so a slow mutation on one geography can never blank another
 * — and a failure states that the row did not change rather than optimistically
 * showing the opposite state.
 */
export interface FollowRelationship {
  readonly countryIso3: string;
  readonly isFollowed: boolean;
  readonly isPending: boolean;
  readonly hasFailed: boolean;
  readonly onFollow: (countryCode: string) => void;
  readonly onUnfollow: (countryCode: string) => void;
}

export interface EvidenceSelectionCardProps {
  readonly displayName: string;
  /** Absent means: this place IS selected and has NO retained evidence. */
  readonly total?: GeographyTotal;
  /** Required — the no-evidence statement is untrue without a period. */
  readonly period: MapPeriod;
  /** The finest level this surface can actually draw. */
  readonly availableGeometry?: DisplayPrecision;
  readonly provenance?: LocationProvenance;
  /**
   * ── THE FOLLOW/WATCH RELATIONSHIP, AS THE ACCEPTED CONTRACT DEFINES IT ───
   *
   * Three distinct capabilities the design keeps apart, and this card is only
   * one of them:
   *
   *   EVIDENCE GEOGRAPHY   where the platform has reporting. Not a follow list.
   *   WATCHED OVERLAY      the layer toggle. A filter over what is drawn.
   *   FOLLOW / UNFOLLOW    the user's RELATIONSHIP with a geography. This.
   *
   * `follow` is `null` for a visitor the follows contract cannot speak for.
   * That is the accepted signed-out contract, not an inference: the hook
   * distinguishes `follows === null` (anonymous, 401 or a failed read) from
   * `[]` (signed in, following nothing). The control is then WITHHELD rather
   * than disabled — a control that cannot work invites a click, absorbs a tap
   * target and explains nothing, and a fake success is worse than an absence.
   */
  readonly follow?: FollowRelationship | null;
  /**
   * PART IV — THE WATCH BLOCK.
   *
   * Optional so the accepted card renders EXACTLY as it does today when the
   * monetization layer is not supplied: every surface below is behind this
   * value, and a card without it is byte-for-byte the C8 card.
   */
  readonly watch?: {
    readonly stage: WatchCtaStage;
    readonly labels: WatchCtaLabels;
    readonly timelineLabels: TimelineLabels;
    readonly onOpenComposer: () => void;
    readonly onOpenTimeline: () => void;
    readonly timelineCount: number;
  } | null;
  readonly language?: LanguageCode;
  /* ── DESIGN REVISION 1.2 · Part II §2 `In: record, providerStatus,
     coverage, categories, items`. Every one OPTIONAL, because Design's rule is
     that a block with no data is omitted — and `undefined` is how a caller
     that has no such data says so, rather than passing an empty shape the card
     would then have to render as a heading over nothing. ─────────────────── */
  /** 01 identity — ISO code and geographic region. */
  readonly identity?: { readonly iso3: string; readonly region?: string };
  /** 02 provider status. */
  readonly providerStatus?: ProviderStatus;
  /** 05 coverage state. */
  readonly coverage?: CoverageState;
  /** 06 ranked categories over the retained set. */
  readonly categories?: readonly CategoryCount[];
  /**
   * 06 the ACTIVE filter set. Part II §3: selection-scoped, cleared when the
   * selection changes, never URL-serialised, and it "never alters the evidence
   * set the surface was given" — so it arrives as a value the OWNER holds, and
   * this card neither stores it nor writes it anywhere.
   */
  readonly cardFilters?: ReadonlySet<NewsCategory>;
  readonly onToggleCategory?: (category: NewsCategory) => void;
  readonly onClearCategories?: () => void;
  /** 09 retained reporting. */
  readonly items?: readonly RetainedItem[];
  readonly selectedItemId?: string | null;
  readonly onSelectItem?: (id: string) => void;
  readonly onOpenSource?: (id: string) => void;
  readonly onAskAbout?: (id: string) => void;
  /**
   * 08 situations. Absent means the situation model has none for this
   * geography; `situationsAvailable: false` means the CAPABILITY is not built,
   * which is a different sentence and gets a different one.
   */
  readonly situations?: readonly { readonly id: string; readonly name: string; readonly state: string }[];
  readonly situationsAvailable?: boolean;
  /** 10 topics. */
  readonly topics?: readonly string[];
  readonly onFocus?: () => void;
  readonly onOpenAnalysis?: () => void;
  readonly onOpenSources?: () => void;
  /**
   * r1.4 block 12. Optional, like every other action on this card: a host that
   * has no way to clear a selection simply does not render the tail, rather
   * than showing an exit that goes nowhere.
   */
  readonly onClearSelection?: () => void;
  readonly onWidenPeriod?: () => void;
  readonly labels: EvidenceSelectionCardLabels;
  readonly className?: string;
}

const Section = ({
  title,
  aside,
  children,
  gn,
}: {
  title?: string;
  aside?: string;
  children: React.ReactNode;
  gn: string;
}): JSX.Element => (
  <section data-gn={gn} className="border-b border-sp-line px-[14px] py-[12px]">
    {title && (
      <h3 className="mb-[8px] flex items-center justify-between font-gn-mono text-[9.5px] font-medium uppercase tracking-[0.18em] text-sp-ink-3">
        {title}
        {aside && <span>{aside}</span>}
      </h3>
    )}
    {children}
  </section>
);

const Stat = ({
  value,
  label,
  tone,
  gn,
}: {
  /*
    CHECKPOINT H — `null` IS A STATE, NOT A MISSING NUMBER.

    A count nobody supplied renders as an em dash. It must never fall back to
    0 or to 1: "we were not told how many outlets" and "one outlet" are
    different facts, and printing the second is a claim the data does not make.
  */
  value: number | null;
  label: string;
  tone: 'cy' | 'ink' | 'am' | 'mu';
  gn: string;
}): JSX.Element => (
  <div className="bg-sp-panel-2 px-[10px] py-[9px]">
    <b
      data-gn={gn}
      className={`block font-gn-mono text-[19px] font-medium ${
        tone === 'cy' ? 'text-sp-cyan' : tone === 'am' ? 'text-sp-amber' : tone === 'mu' ? 'text-sp-muted' : 'text-sp-ink'
      }`}
    >
      {value ?? '—'}
    </b>
    <span className="font-gn-mono text-[8px] uppercase tracking-[0.12em] text-sp-ink-3">{label}</span>
  </div>
);

/**
 * Where the released sign-in path returns an anonymous visitor.
 *
 * The MAP, not the homepage — the accepted `WatchModule` sends readers back to
 * `/`, which is right for a homepage module and wrong here: a reader who
 * pressed follow on a selected country and came back to the homepage would have
 * lost the country, the camera and the reason they signed in.
 */
const FOLLOW_RETURN_DESTINATION = '/map';

/** Shared empty set, so an absent filter prop allocates nothing per render. */
const EMPTY_FILTERS: ReadonlySet<NewsCategory> = new Set<NewsCategory>();

/**
 * An age in hours, as the HUD's monospace metadata writes it.
 *
 * DELIBERATELY NOT `formatRelativeTime`: that helper localises a full phrase
 * ("3 hours ago"), and this line already carries its own prefix word — "newest
 * published" or "newest seen" — from the dictionary. Concatenating the two
 * would produce "newest published 3 hours ago 3 hours ago" in one language and
 * something ungrammatical in the other.
 */
const formatAgeHours = (hours: number): string =>
  hours < 1 ? '<1H' : hours < 48 ? `${Math.round(hours)}H` : `${Math.round(hours / 24)}D`;

export function EvidenceSelectionCard({
  displayName,
  total,
  period,
  availableGeometry = 'COUNTRY',
  provenance,
  follow = null,
  watch = null,
  language = 'en',
  identity,
  providerStatus,
  coverage,
  categories,
  cardFilters,
  onToggleCategory,
  onClearCategories,
  items,
  selectedItemId = null,
  onSelectItem,
  onOpenSource,
  onAskAbout,
  situations,
  situationsAvailable = false,
  topics,
  onFocus,
  onOpenAnalysis,
  onOpenSources,
  onClearSelection,
  onWidenPeriod,
  labels,
  className = '',
}: EvidenceSelectionCardProps): JSX.Element {
  const periodWord = labels.periods[period];
  const watching = follow?.isFollowed === true;
  const activeFilters = cardFilters ?? EMPTY_FILTERS;

  /* ══ 01 · IDENTITY ══════════════════════════════════════════════════════
     Part I §E: "Country name, ISO code and region — Rwanda · RWA · Eastern
     Africa. REGION HERE IS THE GEOGRAPHIC GROUPING OF THE COUNTRY, NOT A
     REGION-PRECISION RECORD." The two are one word apart and mean opposite
     things on a precision ladder, so the identity line is rendered from
     `identity.region` — the country's continent grouping — and never from
     anything the precision model produced. */
  const header = (
    <Section gn="card-header" title={labels.heading} aside={periodWord}>
      <h2 data-gn="card-title" className="text-[20px] font-semibold leading-tight tracking-[0.01em] text-sp-ink">
        {displayName}
      </h2>
      <p
        data-gn="card-identity"
        className="mt-[4px] font-gn-mono text-[9.5px] uppercase tracking-[0.14em] text-sp-ink-3"
      >
        {identity ? (
          <>
            <MachineReadable>
              <span data-gn="card-iso">{identity.iso3}</span>
            </MachineReadable>
            {identity.region && (
              <>
                {' · '}
                <span data-gn="card-region">
                  {continentDisplayName(identity.region, labels.continents)}
                </span>
              </>
            )}
          </>
        ) : (
          <span data-gn="card-scope">{labels.scope}</span>
        )}
      </p>
    </Section>
  );

  /* ══ 02 · PROVIDER STATUS ═══════════════════════════════════════════════
     "Amber when delayed or degraded, muted when absent. ABSENCE OF A PROVIDER
     IS A DIFFERENT FACT FROM ABSENCE OF EVIDENCE and must read differently."
     So this block renders in BOTH the populated and the no-evidence card, and
     its NONE state is the sentence a reader gets instead of a zero. */
  const providerBlock = providerStatus === undefined ? null : (
    <Section gn="card-provider-status">
      <div
        data-gn="provider-status"
        data-gn-condition={providerStatus.condition}
        className="flex items-center gap-[7px] border border-sp-line bg-sp-field px-[9px] py-[6px]"
      >
        <span
          aria-hidden="true"
          className={`block h-[6px] w-[6px] shrink-0 rounded-full ${
            providerStatus.condition === 'LIVE'
              ? 'bg-sp-cyan shadow-[0_0_7px_#3ad6e6]'
              : providerStatus.condition === 'DELAYED'
                ? 'bg-sp-amber shadow-[0_0_7px_#f2a93c]'
                : 'border border-dashed border-sp-muted'
          }`}
        />
        <span
          className={`font-gn-mono text-[8.5px] uppercase tracking-[0.12em] ${
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
          {providerStatus.providerName !== null && providerStatus.condition !== 'NONE' && (
            <> {'·'} {providerStatus.providerName}</>
          )}
          {/* STORED IS ITS OWN WORD. Folding it into DELAYED would lose the
              fact that the reader is looking at retained reporting rather than
              a slow live feed. */}
          {providerStatus.isStored && (
            <span data-gn="provider-stored"> {'·'} {labels.provider.stored}</span>
          )}
        </span>
      </div>
    </Section>
  );

  /* ══ 07a · FOLLOW CONTROL — r1.4 block 07, first line ══════════════════
     Part I §E: "A full-width, ALWAYS-VISIBLE action on the selected geography —
     never inside a layer overlay. ... Sits above the secondary actions because
     it is the one action that changes what the product does when the user is
     not looking."

     THREE STATES, AND THE THIRD IS THE HONEST ONE.

     `follow === null` is the accepted signed-out contract — anonymous, 401, or
     a failed read, which `useCountryFollows` keeps distinct from `[]`. Design
     requires the control to be VISIBLE on every selected country; the accepted
     contract requires it never to fake a success it cannot deliver. Both are
     satisfied by rendering the block with the SAME released sign-in path the
     accepted `WatchModule` anonymous state already uses — a real navigation to
     the backend's entry point, because consent happens off this origin. No
     local identifier is minted as a stand-in, and no button is offered that
     would appear to save and could not. */
  const followBlock = (
    <Section gn="card-follow-block">
      {follow === null ? (
        <div data-gn="card-follow" data-gn-state="anonymous">
          {/*
            CHECKPOINT I — the map state is remembered HERE, in the browser,
            because it may not travel in `returnTo`: the backend rejects a query
            string outright, and that gate is what keeps this application from
            becoming an open-redirect primitive at the one moment a reader is
            primed to trust whatever follows a real Google sign-in.
          */}
          <a
            data-gn="follow-signin"
            href={accountSignInUrl(FOLLOW_RETURN_DESTINATION)}
            onClick={() => rememberMapStateForSignIn(window.location.search)}
            className="flex min-h-[44px] w-full items-center justify-center gap-[8px] rounded-[2px] border border-sp-line-2 px-[10px] py-[11px] font-gn-mono text-[10px] uppercase tracking-[0.14em] text-sp-ink-2 outline-none transition-colors hover:border-sp-amber/50 hover:bg-sp-amber/[0.14] hover:text-sp-amber focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-gn-focus"
          >
            {labels.follow.signIn}
          </a>
        </div>
      ) : (
        <FollowControl
          geographyId={follow.countryIso3}
          geographyLabel={displayName}
          isWatched={follow.isFollowed}
          isPending={follow.isPending}
          hasFailed={follow.hasFailed}
          labels={labels.follow}
          onToggle={(geographyId, next) =>
            next ? follow.onFollow(geographyId) : follow.onUnfollow(geographyId)
          }
        />
      )}
    </Section>
  );

  /* ══ 07a-W · PART IV · THE WATCH BLOCK AND THE ASSESSMENT TIMELINE ═════

     WHERE IT SITS, AND WHY THE RAIL DID NOT GET LONGER.

     §2.2's calm-map constraint caps permanent rail content at one viewport, so
     Part IV adds exactly TWO permanent lines here — the Watch control, which
     replaces nothing because at stages 1 and 2 it is not rendered at all, and a
     single-line timeline STRIP whose content opens in a drawer over the rail.
     The composer, the activation panel, the watchboard and the timeline body
     are all drawers. Nothing was appended below the story list.

     WHY WATCH IS ABOVE FOLLOW. §6.1 separates them on four axes — verb, hue,
     fill and the presence of a run record — and they must never read as two
     variants of one control. Ordering them with Watch first and Follow beneath
     makes the ladder legible: the standing assignment, then the feed filter.
  */
  const watchBlock =
    watch === null ? null : (
      <Section gn="card-watch-block">
        <div className="flex flex-col gap-[7px]">
          <WatchCta
            stage={watch.stage}
            labels={watch.labels}
            onOpenComposer={watch.onOpenComposer}
          />
          {/*
            THE TIMELINE STRIP — one line, and never an expansion. §2.2: "The
            timeline is a drawer over the rail, NEVER AN EXPANSION BELOW IT."
          */}
          <AssessmentTimelineStrip
            count={watch.timelineCount}
            labels={watch.timelineLabels}
            onOpen={watch.onOpenTimeline}
          />
        </div>
      </Section>
    );

  /* ══ 07b · SECONDARY ACTIONS — r1.4 block 07, two-column grid ══════════
     "Open analysis (primary), Focus evidence, Sources." Below the follow
     control, per block 11's own note about why it sits above them. */
  const secondaryActions = (
    <Section gn="card-actions">
      <div className="grid grid-cols-2 gap-[6px]">
        {onOpenAnalysis && (
          <button
            type="button"
            data-gn="card-action"
            data-gn-action="open-analysis"
            onClick={onOpenAnalysis}
            className="cursor-pointer rounded-[2px] border border-sp-cyan bg-sp-cyan px-[8px] py-[9px] font-gn-mono text-[9.5px] font-semibold uppercase tracking-[0.12em] text-sp-cyan-on transition-colors hover:bg-sp-cyan-hover"
          >
            {labels.actions.openAnalysis}
          </button>
        )}
        {onFocus && (
          <button
            type="button"
            data-gn="card-action"
            data-gn-action="focus"
            onClick={onFocus}
            className="cursor-pointer rounded-[2px] border border-sp-line-2 px-[8px] py-[9px] font-gn-mono text-[9.5px] uppercase tracking-[0.12em] text-sp-ink-2 transition-colors hover:border-sp-cyan/45 hover:bg-sp-cyan/[0.16] hover:text-sp-cyan"
          >
            {labels.actions.focus}
          </button>
        )}
        {onOpenSources && (
          <button
            type="button"
            data-gn="card-action"
            data-gn-action="open-sources"
            onClick={onOpenSources}
            className="cursor-pointer rounded-[2px] border border-sp-line-2 px-[8px] py-[9px] font-gn-mono text-[9.5px] uppercase tracking-[0.12em] text-sp-ink-2 transition-colors hover:border-sp-cyan/45 hover:bg-sp-cyan/[0.16] hover:text-sp-cyan"
          >
            {labels.actions.openSources}
          </button>
        )}
        {onWidenPeriod && (
          <button
            type="button"
            data-gn="card-action"
            data-gn-action="widen-period"
            onClick={onWidenPeriod}
            className="cursor-pointer rounded-[2px] border border-sp-line-2 px-[8px] py-[9px] font-gn-mono text-[9.5px] uppercase tracking-[0.12em] text-sp-ink-2 transition-colors hover:border-sp-cyan/45 hover:bg-sp-cyan/[0.16] hover:text-sp-cyan"
          >
            {labels.widenPeriod}
          </button>
        )}
      </div>
    </Section>
  );

  /*
    ── NO RETAINED EVIDENCE — A STATEMENT, NOT AN EMPTY CARD ────────────────

    Part II §6: "a country with no retained evidence SAYS SO EXPLICITLY rather
    than rendering as empty", and revision 1.2 adds "a country with no
    configured provider says that rather than reporting zero evidence" — which
    is why block 02 renders here too, ABOVE the no-evidence statement. A reader
    looking at a country nobody retrieved is told that, not told the world was
    quiet.

    Design revision 1.2 also states it explicitly: "Zero-evidence records route
    to the honest no-evidence card AND STILL EXPOSE THE FOLLOW CONTROL."
  */
  if (total === undefined || total.recordCount === 0) {
    return (
      <div data-gn="evidence-selection-card" data-gn-state="no-evidence" className={className}>
        {header}
        {providerBlock}
        <Section gn="card-no-evidence">
          <div className="border border-sp-muted/40 bg-sp-muted/[0.08] px-[10px] py-[8px]">
            <p className="font-gn-mono text-[9px] uppercase tracking-[0.14em] text-sp-muted">
              {labels.noEvidenceTitle}
            </p>
            <p className="mt-[4px] text-[11px] leading-[1.45] text-sp-ink-2">
              {labels.noEvidenceBody} <span data-gn="no-evidence-period">{periodWord}</span>
            </p>
          </div>
        </Section>
        {watchBlock}
        {followBlock}
        {secondaryActions}
      </div>
    );
  }

  const drawnCoarser = isFinerThan(total.finestPrecision, availableGeometry);
  const style = markerStyleFor(total.finestPrecision, provenance);
  const unverified = total.reportCount - total.verifiedReportCount;
  const shownItems = applyCardFilters(items ?? [], activeFilters);

  return (
    <div
      data-gn="evidence-selection-card"
      data-gn-state="populated"
      data-gn-legend={style.legendKey}
      className={className}
    >
      {/* 01 */}
      {header}
      {/* 02 */}
      {providerBlock}

      {/* ══ 03 · PRECISION & PROVENANCE PILLS ════════════════════════════
          "Ceiling, provenance where not STATED, confidence, new-since-last-
          visit, watching state."

          WATCHING APPEARS HERE AS METADATA, and the ACTION is block 11. The
          ruling that separated the three capabilities — evidence geography,
          watched-place overlay, follow action — is what this split enforces:
          a pill that states a relationship cannot be mistaken for the control
          that changes it, because it is not a control. */}
      <Section gn="card-pills">
        <div data-gn="card-pill-row" className="flex flex-wrap gap-[5px]">
          <span
            data-gn="pill-ceiling"
            className="border border-sp-cyan/45 bg-sp-cyan/[0.12] px-[7px] py-[3px] font-gn-mono text-[9px] uppercase tracking-[0.14em] text-sp-cyan"
          >
            {labels.levels[total.finestPrecision]}
          </span>
          {/* PROVENANCE ONLY WHERE IT IS NOT STATED — Design's own condition.
              A STATED pill on every card would make the word meaningless. */}
          {provenance !== undefined && provenance !== 'STATED' && (
            <span
              data-gn="pill-provenance"
              className="border border-sp-muted/40 px-[7px] py-[3px] font-gn-mono text-[9px] uppercase tracking-[0.14em] text-sp-muted"
            >
              {labels.provenanceValues[provenance]}
            </span>
          )}
          {total.newSinceLastVisit > 0 && (
            <span
              data-gn="pill-new-since"
              className="border border-sp-amber/40 bg-sp-amber/[0.12] px-[7px] py-[3px] font-gn-mono text-[9px] uppercase tracking-[0.14em] text-sp-amber"
            >
              +{total.newSinceLastVisit} {labels.newSince}
            </span>
          )}
          {watching && (
            <span
              data-gn="card-watching"
              className="border border-sp-amber/40 bg-sp-amber/[0.12] px-[7px] py-[3px] font-gn-mono text-[9px] uppercase tracking-[0.14em] text-sp-amber"
            >
              &#9678; {labels.watching}
            </span>
          )}
        </div>
      </Section>

      {/* ══ 04 · COUNTS ═══════════════════════════════════════════════════
          "Three equal cells, monospace numerals." */}
      <div data-gn="card-stats" className="grid grid-cols-3 gap-px border-y border-sp-line bg-sp-line">
        <Stat gn="card-reports" value={total.reportCount} label={labels.reports} tone="cy" />
        {/*
          CHECKPOINT H — DISTINCT PUBLISHERS, OR NOTHING.

          This read `sourceCount`, which is the provider's own number folded with
          `Math.max` — and all three providers hard-code it to 1. So a geography
          reported on by several visibly different outlets displayed
          "1 SOURCE". `publisherCount` counts real outlet identities and is null
          when none were supplied, which renders as an em dash.
        */}
        <Stat gn="card-sources" value={total.publisherCount} label={labels.sources} tone="ink" />
        <Stat
          gn="card-new-since"
          value={total.newSinceLastVisit}
          label={labels.newSince}
          tone={total.newSinceLastVisit > 0 ? 'am' : 'mu'}
        />
      </div>

      {/* ══ 05 · COVERAGE STATE ═══════════════════════════════════════════
          "A named strength band ... with freshness age and a staleness flag.
          Cyan for strong and moderate, amber for aging or stale, muted for
          none. THIS IS A STATEMENT ABOUT COVERAGE, NEVER ABOUT THE TRUTH OF
          WHAT IS COVERED." Hence a band and an age, and no score: a numeral
          out of 100 invites the country-versus-country comparison a coverage
          band exists to refuse. */}
      {coverage && (
        <Section gn="card-coverage" title={labels.coverage.heading}>
          <div className="border border-sp-line bg-sp-panel-2 px-[10px] py-[9px]">
            <div className="flex flex-wrap items-center gap-[8px]">
              <span
                data-gn="coverage-band"
                data-gn-band={coverage.band}
                className={`rounded-[2px] px-[7px] py-[3px] font-gn-mono text-[9px] uppercase tracking-[0.14em] ${
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
              <span
                data-gn="coverage-meta"
                className="font-gn-mono text-[8.5px] uppercase tracking-[0.1em] text-sp-ink-3"
              >
                {coverage.publisherCount} {labels.coverage.publishers}
                {coverage.ageHours !== null && (
                  <>
                    {' · '}
                    {labels.coverage.newest}{' '}
                    {/* THE BASIS TRAVELS WITH THE NUMBER. An observed
                        timestamp is an upper bound on publication and its
                        contract forbids rendering it as a publication time. */}
                    <span data-gn="coverage-basis">
                      {coverage.ageIsObservedOnly
                        ? labels.coverage.seenPrefix
                        : labels.coverage.publishedPrefix}
                    </span>{' '}
                    {formatAgeHours(coverage.ageHours)}
                  </>
                )}
              </span>
              {coverage.flag && (
                <span
                  data-gn="coverage-flag"
                  data-gn-flag={coverage.flag}
                  className="border border-sp-amber/40 px-[5px] py-[2px] font-gn-mono text-[8px] uppercase tracking-[0.12em] text-sp-amber"
                >
                  {labels.coverage.flags[coverage.flag]}
                </span>
              )}
            </div>

          </div>
        </Section>
      )}

      {/* ══ 06 · EVIDENCE CEILING STATEMENT ═══════════════════════════════
          "The precision rules of §G in words, unchanged." Unchanged is meant
          literally — this block is exactly what M2 shipped, moved to its
          numbered position. */}
      <Section gn="card-precision" title={labels.stateHeading}>
        <div
          className={`border px-[10px] py-[8px] ${
            drawnCoarser || total.finestPrecision === 'UNKNOWN'
              ? 'border-sp-muted/40 bg-sp-muted/[0.08]'
              : 'border-sp-cyan/[0.28] bg-sp-cyan/[0.06]'
          }`}
        >
          <p
            className={`font-gn-mono text-[9px] uppercase tracking-[0.14em] ${
              drawnCoarser || total.finestPrecision === 'UNKNOWN' ? 'text-sp-muted' : 'text-sp-cyan'
            }`}
          >
            {labels.levels[total.finestPrecision]}
          </p>
          <p className="mt-[4px] text-[11px] leading-[1.45] text-sp-ink-2">
            {drawnCoarser ? labels.drawnCoarser : labels.ceilingNote}
          </p>
        </div>

        {/*
          TWO ROWS, TWO AXES, NEVER ONE SCORE. Part I §G: "a STATED country
          record and an INTERPRETED city record are differently useful, NOT
          RANKABLE ON ONE AXIS." Nothing here combines them.
        */}
        <div className="mt-[9px] flex flex-col">
          <div
            data-gn="card-precision-row"
            className="flex justify-between gap-[10px] border-b border-sp-line-3 py-[5px] text-[11.5px] text-sp-ink-2"
          >
            <span>{labels.precisionLabel}</span>
            <b className="font-gn-mono text-[10.5px] font-medium tracking-[0.06em] text-sp-ink">
              {labels.levels[total.finestPrecision]}
            </b>
          </div>
          <div
            data-gn="card-provenance"
            className="flex justify-between gap-[10px] border-b border-sp-line-3 py-[5px] text-[11.5px] text-sp-ink-2"
          >
            <span>{labels.provenanceLabel}</span>
            <b
              className={`font-gn-mono text-[10.5px] font-medium tracking-[0.06em] ${
                provenance === undefined || provenance === 'STATED' ? 'text-sp-ink' : 'text-sp-muted'
              }`}
            >
              {labels.provenanceValues[provenance ?? 'STATED']}
            </b>
          </div>
          {unverified > 0 && (
            <div
              data-gn="card-verified"
              className="flex justify-between gap-[10px] py-[5px] text-[11.5px] text-sp-ink-2"
            >
              <span>{labels.verifiedReports}</span>
              <b className="font-gn-mono text-[10.5px] font-medium tracking-[0.06em] text-sp-muted">
                {total.verifiedReportCount} &middot; {labels.unverifiedQualifier}
              </b>
            </div>
          )}
        </div>
      </Section>

      {/* ══ 07 · ACTION CLUSTER ══════════════════════════════════════════
          DESIGN REVISION 1.4, Part I §E block 07:

            "The follow control full-width on its own line ... then Open
             analysis (primary), Focus evidence, Sources and Widen period in a
             two-column grid. POSITIONED ABOVE THE REPORTING LIST, NOT BELOW
             IT: that list is unbounded, so any action after it is discoverable
             only by scrolling. Blocks 01-07 are sized so the cluster lands
             within the first viewport of a 900 px-tall desktop rail.
             DELIBERATELY NOT STICKY."

          These are the SAME two blocks revision 1.2 placed at 11-12, moved as
          whole expressions: `followBlock` and `secondaryActions` are each built
          once, above, and referenced once, here. Nothing is copied, so there is
          no second Follow control and no second action row, and every handler,
          disabled reason and aria-pressed state travels with them.

          NOT STICKY, and nothing here makes it so — no `sticky`, no `fixed`, no
          z-index of its own. The spec's point is that correct ordering makes
          stickiness unnecessary, and a floating bar over a dense rail costs
          more than it returns.

          Measured on Kenya at 1440x900 after the r1.4 reorder: the cluster
          occupies 692-861 px against a 900 px viewport, inside the first
          screen, with the category bars and the story list directly beneath. */}
      {watchBlock}
      {followBlock}
      {secondaryActions}

            {/* ══ 08 · CATEGORY DISTRIBUTION, AS FILTERS ═══════════════════
                "Each bar is a filter: activating one narrows blocks 07–09 AND
                THE MAP'S EVIDENCE MARKERS FOR THIS SELECTION ONLY. Multi-
                select; All clears. Filters are scoped to the selection and are
                discarded when it changes — THEY ARE NOT A GLOBAL MODE."

                The bars are real buttons with `aria-pressed`, so the multi-
                select state is available to a screen reader rather than being
                carried only by a colour. */}
            {categories && categories.length > 0 && (
              <div data-gn="card-categories" className="mt-[9px] flex flex-col gap-[4px]">
                {categories.map((entry) => {
                  const on = activeFilters.has(entry.category);

                  return (
                    <button
                      key={entry.category}
                      type="button"
                      data-gn="category-bar"
                      data-gn-category={entry.category}
                      data-gn-on={on ? 'true' : 'false'}
                      aria-pressed={on}
                      onClick={() => onToggleCategory?.(entry.category)}
                      className="group grid cursor-pointer grid-cols-[78px_1fr_20px] items-center gap-[8px] border-none bg-transparent py-[2px] text-left outline-none focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-gn-focus"
                    >
                      <span
                        className={`font-gn-mono text-[8.5px] uppercase tracking-[0.12em] ${
                          on ? 'text-sp-cyan' : 'text-sp-ink-3 group-hover:text-sp-ink-2'
                        }`}
                      >
                        {labels.categories[entry.category] ?? entry.category}
                      </span>
                      <span className="relative block h-[5px] bg-sp-track-bg">
                        <span
                          aria-hidden="true"
                          className={`absolute inset-y-0 left-0 block ${on ? 'bg-sp-cyan' : 'bg-sp-track group-hover:bg-sp-track-hover'}`}
                          style={{ width: `${Math.round(entry.share * 100)}%` }}
                        />
                      </span>
                      <span
                        className={`text-right font-gn-mono text-[9px] ${on ? 'text-sp-cyan' : 'text-sp-ink-3'}`}
                      >
                        {entry.count}
                      </span>
                    </button>
                  );
                })}

                {activeFilters.size > 0 && (
                  <button
                    type="button"
                    data-gn="category-clear"
                    onClick={() => onClearCategories?.()}
                    className="mt-[7px] cursor-pointer border-none bg-transparent p-0 text-left font-gn-mono text-[8.5px] uppercase tracking-[0.12em] text-sp-cyan outline-none focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-gn-focus"
                  >
                    &larr; {labels.allCategories}
                  </button>
                )}
              </div>
            )}
      {/* ══ 09 · RETAINED REPORTING ═══════════════════════════════════════
          Source cards. The heading states SHOWN of TOTAL, so an active filter
          never looks like a shrunken feed. */}
      {items && items.length > 0 && (
        <Section
          gn="card-retained"
          title={labels.retainedHeading}
          aside={`${shownItems.length} / ${items.length}`}
        >
          {shownItems.length === 0 ? (
            <p data-gn="retained-filtered-empty" className="text-[11px] leading-[1.45] text-sp-ink-3">
              {labels.retainedFilteredEmpty}
            </p>
          ) : (
            shownItems.map((item) => (
              <SourceCard
                key={item.id}
                item={item}
                selected={item.id === selectedItemId}
                language={language}
                labels={{
                  categories: labels.categories,
                  levels: labels.levels,
                  openSource: labels.openSource,
                  askAbout: labels.askAbout,
                  askAiShort: labels.askAiShort,
                  seenPrefix: labels.coverage.seenPrefix,
                  publishedPrefix: labels.coverage.publishedPrefix,
                }}
                onSelect={onSelectItem}
                onOpenSource={onOpenSource}
                onAskAbout={onAskAbout}
              />
            ))
          )}
        </Section>
      )}

      {/* ══ 10 · SITUATIONS ══════════════════════════════════════════════
          "Named situations and their state, WHEN THE SITUATION MODEL HAS ANY."

          Three states, and the third is why this block is not simply omitted:

            situations present    render them.
            model available, none omit — Design's rule for an empty block.
            MODEL NOT BUILT       SAY SO. `situationsAvailable === false` is a
                                  missing CAPABILITY, not missing data, and
                                  hiding it would answer "no situations here"
                                  to a reader who was never told the question
                                  cannot yet be asked. Part II lists the
                                  situation model as in development. */}
      {situations && situations.length > 0 ? (
        <Section gn="card-situations" title={labels.situationsHeading}>
          {situations.map((situation) => (
            <div
              key={situation.id}
              data-gn="situation-row"
              className="flex justify-between gap-[10px] border-b border-sp-line-3 py-[5px] text-[11.5px] text-sp-ink-2"
            >
              <span>{situation.name}</span>
              <b className="font-gn-mono text-[10.5px] tracking-[0.06em] text-sp-amber">
                {situation.state}
              </b>
            </div>
          ))}
        </Section>
      ) : situationsAvailable ? null : (
        <Section gn="card-situations" title={labels.situationsHeading}>
          <p
            data-gn="situations-unavailable"
            className="border border-sp-muted/40 bg-sp-muted/[0.08] px-[10px] py-[8px] text-[11px] leading-[1.45] text-sp-muted"
          >
            {labels.situationsUnavailable}
          </p>
        </Section>
      )}

      {/* ══ 11 · TOPICS ═══════════════════════════════════════════════════ */}
      {topics && topics.length > 0 && (
        <Section gn="card-topics" title={labels.topicsHeading}>
          <div className="flex flex-wrap gap-[5px]">
            {topics.map((topic) => (
              <span
                key={topic}
                data-gn="topic-pill"
                className="border border-sp-line-2 px-[7px] py-[3px] font-gn-mono text-[9px] uppercase tracking-[0.14em] text-sp-ink-2"
              >
                {topic}
              </span>
            ))}
          </div>
        </Section>
      )}

      {/* ══ 12 · SELECTION TAIL ══════════════════════════════════════════
          r1.4: "Clear selection — THE ONLY CONTROL THAT LEGITIMATELY SITS AT
          THE BOTTOM, because it is an exit rather than a task."

          It is deliberately quieter than block 07: leaving a selection is not
          something the rail should invite, only something it must not hide.
          Omitted entirely when the host supplies no handler, per the card's
          own rule that a block with nothing behind it is not rendered. */}
      {onClearSelection && (
        <Section gn="card-selection-tail">
          <button
            type="button"
            data-gn="card-clear-selection"
            onClick={onClearSelection}
            className="w-full border border-sp-line px-[10px] py-[7px] font-gn-mono text-[9.5px] uppercase tracking-[0.12em] text-sp-ink-3 outline-none transition-colors hover:border-sp-line-2 hover:text-sp-ink-2 focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-sp-cyan"
          >
            {labels.clearSelection}
          </button>
        </Section>
      )}
    </div>
  );
}
