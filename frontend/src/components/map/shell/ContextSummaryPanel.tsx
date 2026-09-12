'use client';

import type { DisplayPrecision } from '@/lib/map/spatial/precisionModel';
import type { EvidenceGeography, EvidenceTotals, GeographyTotal } from '@/lib/map/evidence/evidenceModel';
import type { JumpTarget } from '@/lib/map/navigation/breadcrumbs';
import type { MapMode, MapPeriod } from '@/lib/map/state/mapState';
import type { AttentionQueue } from '@/lib/specialist/attentionQueue';
import { queueWasOrderedUpstream } from '@/lib/specialist/attentionQueue';

/**
 * SPATIAL M2 — THE INTELLIGENCE RAIL'S NO-SELECTION STATE.
 *
 * Part II §2: "totals for the mode and period, ranked evidence geography,
 * EXPLICIT NO-EVIDENCE ENTRIES, jump targets."
 *
 * ── THE TREATMENT IS THE DESIGN REFERENCE'S, NOT A GENERIC CARD LIST ──────
 *
 * Section headers in 9.5px mono at 0.18em; a 20px title; a pill row; a 3-up
 * stats grid with coloured numerals; and evidence-geography rows carrying a
 * DENSE metadata line — `31 REPORTS 12 SRC COUNTRY +8 NEW ◎ WATCHING` — with a
 * 2px left border that colour-codes the row's state. That density is the
 * point: the rail exists to communicate intelligence state at a glance, and a
 * stack of roomy cards with one number each communicates less in more space.
 *
 * ── "EXPLICIT NO-EVIDENCE ENTRIES" IS STILL THE HALF THAT MATTERS ─────────
 *
 * A ranked list of places with evidence misleads on its own — a reader scanning
 * eight rows concludes those are the eight places where something is happening.
 * The reference shows the other half in the same list, in the muted treatment:
 * *Tanzania — no retained evidence / NONE REFERENCE GEOGRAPHY ONLY*. Supplied
 * by the caller from geography it actually queried, never inferred from an
 * absent row.
 *
 * ── AND IT CARRIES NO CONTROLS ────────────────────────────────────────────
 *
 * ── C·2 — THE SPECIALIST ATTENTION QUEUE IS A CONFIGURATION OF THIS PANEL ──
 *
 * Part V C·2 ruled that Conflict's attention queue is NOT a new panel: "Shared
 * component, domain-aware ordering. The panel's layout, interaction model and
 * shell remain FROZEN; Conflict supplies a domain-specific ranking input and the
 * panel consumes an upstream ordered result. No Conflict ranking engine inside
 * the UI component, and no separate Conflict panel."
 *
 * So the queue arrives as ONE OPTIONAL PROP. With `queue` absent this component
 * renders exactly what it rendered at C12, to the byte — the evidence-geography
 * behaviour below is untouched and is the World/Country domain's own
 * configuration. With `queue` present, the specialist rows render in the SAME
 * `Section` shell, the same dense metadata line and the same 2px state border.
 *
 * NOTHING HERE SORTS. `items` is consumed in the order it arrives, and
 * `queueWasOrderedUpstream` exists so the panel can prove it: a queue whose
 * items carry no upstream rank renders the unavailable state rather than a
 * locally ordered list that would look identical and be a second ranking
 * authority in the product.
 *
 * Watching is shown as STATUS on a row. The Follow/Unfollow ACTION lives on the
 * selection card, and the watched OVERLAY is the left rail's toggle. Three
 * capabilities, kept apart; putting the action on a summary row would collapse
 * two of them.
 */

export interface ContextSummaryLabels {
  readonly heading: string;
  readonly worldView: string;
  readonly inMode: string;
  readonly totalsReports: string;
  readonly totalsSources: string;
  readonly totalsGeographies: string;
  readonly totalsSituations: string;
  /** Shown under a total the producer did not supply. Never "0". */
  readonly totalsUnsupplied: string;
  readonly totalsVerified: string;
  readonly unverifiedQualifier: string;
  readonly pillGeographies: string;
  readonly pillNewSince: string;
  readonly pillUnresolved: string;
  readonly rankedHeading: string;
  readonly noEvidenceHeading: string;
  readonly watching: string;
  readonly noEvidenceNote: string;
  readonly noEvidenceRow: string;
  readonly noEvidenceRowMeta: string;
  readonly emptyHeading: string;
  readonly emptyBody: string;
  readonly reports: string;
  readonly sources: string;
  readonly newCount: string;
  readonly jumpHeading: string;
  readonly jumpTargets: Readonly<Record<string, string>>;
  readonly modes: Readonly<Record<MapMode, string>>;
  readonly periods: Readonly<Record<MapPeriod, string>>;
  readonly levels: Readonly<Record<DisplayPrecision, string>>;
  /** C·2 specialist queue copy. Absent for the World/Country configuration. */
  readonly queueUnavailable?: string;
  readonly queueUnordered?: string;
}

export interface ContextSummaryPanelProps {
  readonly mode: MapMode;
  readonly period: MapPeriod;
  readonly totals: EvidenceTotals;
  readonly ranked: readonly GeographyTotal[];
  readonly noEvidence: readonly EvidenceGeography[];
  /** READ ONLY, and strictly as metadata. See the note above. */
  readonly watch?: ReadonlySet<string>;
  readonly onSelectGeography?: (geographyId: string) => void;
  readonly jumpTargets?: readonly JumpTarget[];
  readonly onJump?: (target: JumpTarget) => void;
  readonly rankedLimit?: number;
  readonly labels: ContextSummaryLabels;
  /**
   * C·2. When supplied, the rail's no-selection state is this domain's queue.
   * When absent, the panel is byte-identical to its C12 behaviour.
   */
  readonly queue?: AttentionQueue | null;
  readonly onSelectQueueItem?: (id: string) => void;
  readonly className?: string;
}

const Section = ({
  title,
  aside,
  children,
  gn,
}: {
  title: string;
  aside?: string;
  children: React.ReactNode;
  gn: string;
}): JSX.Element => (
  <section data-gn={gn} className="border-b border-sp-line px-[14px] py-[12px]">
    <h3 className="mb-[8px] flex items-center justify-between font-gn-mono text-[9.5px] font-medium uppercase tracking-[0.18em] text-sp-ink-3">
      {title}
      {aside && <span>{aside}</span>}
    </h3>
    {children}
  </section>
);

export function ContextSummaryPanel({
  mode,
  period,
  totals,
  ranked,
  noEvidence,
  watch,
  onSelectGeography,
  jumpTargets = [],
  onJump,
  rankedLimit = 10,
  labels,
  queue = null,
  onSelectQueueItem,
  className = '',
}: ContextSummaryPanelProps): JSX.Element {
  const nothingAtAll = totals.recordCount === 0 && noEvidence.length === 0;
  const unverified = totals.reportCount - totals.verifiedReportCount;

  /*
    ── C·2 · THE SPECIALIST QUEUE BRANCH ────────────────────────────────────

    Returns EARLY and completely. The two states are alternatives, not layers:
    a rail showing a conflict attention queue above an evidence-geography
    ranking would be answering "what needs me" and "where is the evidence" in
    one column, which is the third-column instinct arriving as a stack.

    The shell is the panel's own — same `Section`, same header grammar, same
    row treatment — so the frozen layout is reused rather than re-spelled.
  */
  if (queue !== null) {
    const ordered = queueWasOrderedUpstream(queue);

    return (
      <div
        data-gn="map-context-summary"
        data-gn-mode={mode}
        data-gn-period={period}
        data-gn-queue-domain={queue.domain}
        data-gn-queue-ordered={ordered ? 'true' : 'false'}
        className={className}
      >
        <Section gn="queue-header" title={queue.headerLabel} aside={String(queue.headerCount)}>
          {!ordered ? (
            /*
              NO UPSTREAM ORDER, NO QUEUE. The shared assessment service supplies
              `attentionRank`; without it there is no ordered result to consume,
              and sorting locally would install the ranking engine C·2 forbids.
              Stating that is the honest render — a list in arrival order would
              look like a ranking and be a coincidence.
            */
            <p data-gn="queue-unordered" className="text-[11px] leading-[1.5] text-sp-ink-2">
              {labels.queueUnordered ?? ''}
            </p>
          ) : queue.items.length === 0 ? (
            <p data-gn="queue-none" className="text-[11px] leading-[1.5] text-sp-ink-3">
              {labels.queueUnavailable ?? ''}
            </p>
          ) : (
            <ul className="flex flex-col">
              {queue.items.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    data-gn="queue-item"
                    data-gn-item={item.id}
                    data-gn-state={item.stateToken}
                    data-gn-rank={item.attentionRank}
                    data-gn-amber-inherited={item.amberInherited ? 'true' : 'false'}
                    onClick={() => onSelectQueueItem?.(item.id)}
                    /*
                      C·4 STATE INHERITANCE. When the same amber state is already
                      at full strength on the selected object, the queued row
                      renders at reduced weight rather than generating a second
                      competing amber block. The 2px state border is the panel's
                      existing grammar, not a new one.
                    */
                    className={`mb-[6px] w-full cursor-pointer border border-sp-line bg-sp-panel-2 px-[10px] py-[9px] text-left transition-colors hover:bg-sp-item-hover ${
                      item.amberInherited ? 'border-l-2 border-l-[rgba(242,169,60,.35)]' : 'border-l-2 border-l-sp-amber'
                    }`}
                  >
                    <span className="flex items-baseline justify-between gap-[8px]">
                      <b className="truncate text-[12.5px] font-medium text-sp-ink">{item.label}</b>
                      {/*
                        SEVERITY IS TYPOGRAPHIC — C·1. No hue below CRITICAL, and
                        the emphasis word is supplied by the domain rather than
                        mapped to a colour here.
                      */}
                      {item.emphasis && (
                        <span
                          data-gn="queue-emphasis"
                          className="shrink-0 font-gn-mono text-[8.5px] uppercase tracking-[0.14em] text-sp-ink-2"
                        >
                          {item.emphasis}
                        </span>
                      )}
                    </span>
                    {/* WORD PLUS MARK. Never colour alone (§21). */}
                    {item.stateLabel && (
                      <span
                        data-gn="queue-state"
                        className={`mt-[3px] block font-gn-mono text-[8.5px] uppercase tracking-[0.12em] ${
                          item.amberInherited ? 'text-[rgba(242,169,60,.62)]' : 'text-sp-amber'
                        }`}
                      >
                        {item.stateLabel}
                      </span>
                    )}
                    {item.summary && (
                      <span className="mt-[4px] block text-[11px] leading-[1.45] text-sp-ink-2">{item.summary}</span>
                    )}
                    {item.meta && (
                      <span className="mt-[4px] block font-gn-mono text-[8.5px] uppercase tracking-[0.12em] text-sp-ink-3">
                        {item.meta}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Section>

        {/*
          ── THE HOLDING LINE IS A RESULT, NEVER AN EMPTY STATE ──────────────

          §15 and Part IV both insist: NO MATERIAL CHANGE and STABLE appear with
          their durations because that line is what the reader is paying for.
          It renders whenever the domain reports holding subjects, and it is not
          suppressed when the attention list above it is empty — an empty
          attention list plus a populated holding list is the good outcome.
        */}
        {queue.holdingItems.length > 0 && (
          <Section gn="queue-holding" title={queue.holdingLabel} aside={String(queue.holdingCount)}>
            <ul className="flex flex-col gap-[6px]">
              {queue.holdingItems.map((item) => (
                <li
                  key={item.id}
                  data-gn="queue-holding-item"
                  data-gn-item={item.id}
                  className="flex items-baseline justify-between gap-[8px] opacity-70"
                >
                  <span className="truncate text-[12px] text-sp-ink-2">{item.label}</span>
                  <span className="shrink-0 font-gn-mono text-[8.5px] uppercase tracking-[0.12em] text-sp-ink-3">
                    {item.meta ?? item.stateLabel ?? ''}
                  </span>
                </li>
              ))}
            </ul>
          </Section>
        )}
      </div>
    );
  }

  return (
    <div data-gn="map-context-summary" data-gn-mode={mode} data-gn-period={period} className={className}>
      <Section gn="context-header" title={labels.heading} aside={labels.periods[period]}>
        <h2 data-gn="context-title" className="text-[20px] font-semibold leading-tight tracking-[0.01em] text-sp-ink">
          {labels.worldView}
        </h2>
        {/*
          EVERY NUMBER BELOW IS QUALIFIED BY THIS LINE. Mode and period are not
          decoration — they are what makes the totals true.
        */}
        <p
          data-gn="context-scope"
          className="mt-[4px] font-gn-mono text-[9.5px] uppercase tracking-[0.14em] text-sp-ink-3"
        >
          {labels.inMode} {labels.modes[mode]} &middot; {labels.periods[period]}
        </p>

        {!nothingAtAll && (
          <div data-gn="context-pills" className="mt-[9px] flex flex-wrap gap-[5px]">
            <span className="whitespace-nowrap rounded-[2px] border border-sp-cyan/40 bg-sp-cyan/[0.16] px-[7px] py-[3px] font-gn-mono text-[8.5px] uppercase tracking-[0.12em] text-sp-cyan">
              {totals.geographyCount} {labels.pillGeographies}
            </span>
            {totals.newSinceLastVisit > 0 && (
              <span className="whitespace-nowrap rounded-[2px] border border-sp-amber/40 bg-sp-amber/[0.14] px-[7px] py-[3px] font-gn-mono text-[8.5px] uppercase tracking-[0.12em] text-sp-amber">
                {totals.newSinceLastVisit} {labels.pillNewSince}
              </span>
            )}
            {/*
              UNVERIFIED IS ITS OWN PILL, in the muted register. Part II §8 q9
              forbids counting an interpreted record in a verified total without
              the qualifier; the way to keep a qualifier attached to a number is
              to give it a number of its own.
            */}
            {unverified > 0 && (
              <span
                data-gn="pill-unverified"
                className="whitespace-nowrap rounded-[2px] border border-sp-muted/40 px-[7px] py-[3px] font-gn-mono text-[8.5px] uppercase tracking-[0.12em] text-sp-muted"
              >
                {unverified} {labels.pillUnresolved}
              </span>
            )}
          </div>
        )}
      </Section>

      {nothingAtAll ? (
        <Section gn="context-empty" title={labels.emptyHeading}>
          <p className="text-[11px] leading-[1.5] text-sp-ink-3">{labels.emptyBody}</p>
        </Section>
      ) : (
        <>
          <div
            data-gn="context-totals"
            className="grid grid-cols-3 gap-px border-y border-sp-line bg-sp-line"
          >
            <div className="bg-sp-panel-2 px-[10px] py-[9px]">
              <b data-gn="total-reports" className="block font-gn-mono text-[19px] font-medium text-sp-cyan">
                {totals.reportCount}
              </b>
              <span className="font-gn-mono text-[8px] uppercase tracking-[0.12em] text-sp-ink-3">
                {labels.totalsReports}
              </span>
            </div>
            {/*
              PO GOLDEN-FRAME CORRECTION — the triplet is REPORTS · SOURCES ·
              SITUATIONS.

              SOURCES is DISTINCT PUBLISHERS, not the old `recordCount`. Simply
              relabelling that number would have matched the golden and lied:
              one outlet can produce many records, so "46 SOURCES" would have
              been a true count under a false name. `evidenceTotals` counts
              `publisherId` instead, and returns null when no record carries
              one.

              A null total renders as an em dash, never as 0. The ruling is
              explicit — "render the truthful state, never a synthetic
              non-zero situation count" — and 0 is not the neutral choice it
              looks like: it asserts that the producer ran and found nothing,
              when in fact it never ran at all.
            */}
            <div className="bg-sp-panel-2 px-[10px] py-[9px]">
              <b
                data-gn="total-sources"
                data-gn-supplied={totals.sourceCount !== null}
                className="block font-gn-mono text-[19px] font-medium text-sp-ink"
              >
                {totals.sourceCount ?? '—'}
              </b>
              <span className="font-gn-mono text-[8px] uppercase tracking-[0.12em] text-sp-ink-3">
                {totals.sourceCount === null ? labels.totalsUnsupplied : labels.totalsSources}
              </span>
            </div>
            <div className="bg-sp-panel-2 px-[10px] py-[9px]">
              <b
                data-gn="total-situations"
                data-gn-supplied={totals.situationCount !== null}
                className="block font-gn-mono text-[19px] font-medium text-sp-amber"
              >
                {totals.situationCount ?? '—'}
              </b>
              <span className="font-gn-mono text-[8px] uppercase tracking-[0.12em] text-sp-ink-3">
                {totals.situationCount === null ? labels.totalsUnsupplied : labels.totalsSituations}
              </span>
            </div>
          </div>

          <Section gn="context-ranked" title={labels.rankedHeading}>
            <ul className="flex flex-col">
              {ranked.slice(0, rankedLimit).map((total) => {
                /*
                  WATCHING BELONGS TO THE COUNTRY THAT WAS FOLLOWED, NOT TO
                  EVERYTHING INSIDE IT.

                  The browser run caught this: `watch.has(countryIso3)` marked
                  Nairobi, Mombasa, Kisumu and every other Kenyan city as
                  WATCHING because Kenya is followed. Nobody followed Nairobi.
                  The reference shows the status on Kenya's own row and not on
                  Goma's, and the follow contract is a set of COUNTRIES — so the
                  row must BE the followed country, not merely sit inside it.
                */
                const watching =
                  total.geographyId === total.countryIso3 && watch?.has(total.countryIso3) === true;

                return (
                  <li key={total.geographyId}>
                    <button
                      type="button"
                      data-gn="ranked-geography"
                      data-gn-geography={total.geographyId}
                      data-gn-precision={total.finestPrecision}
                      data-gn-watching={watching}
                      onClick={() => onSelectGeography?.(total.geographyId)}
                      /*
                        The left border colour-codes the row's STATE, as the
                        reference does: amber for monitored geography, cyan for
                        one carrying an unresolved provenance, hairline
                        otherwise. Part I §E's grammar, applied to a list.
                      */
                      className={`mb-[6px] w-full cursor-pointer border border-sp-line bg-sp-panel-2 px-[10px] py-[9px] text-left transition-colors hover:bg-sp-item-hover ${
                        watching
                          ? 'border-l-2 border-l-sp-amber'
                          : total.hasUnverified
                            ? 'border-l-2 border-l-sp-cyan'
                            : 'border-l-2 border-l-sp-line-2'
                      }`}
                    >
                      <span className="mb-[5px] block text-[12px] leading-[1.35] text-sp-ink">
                        {total.displayName}
                      </span>
                      {/*
                        THE DENSE METADATA LINE. Counts, then the precision the
                        evidence actually asserts, then change, then the
                        watching status. One row, one glance.
                      */}
                      <span className="flex flex-wrap gap-[8px] font-gn-mono text-[8.5px] uppercase tracking-[0.1em] text-sp-ink-3">
                        <span>
                          {total.reportCount} {labels.reports}
                        </span>
                        <span>
                          {total.sourceCount} {labels.sources}
                        </span>
                        <span
                          data-gn="ranked-precision"
                          className={
                            total.finestPrecision === 'UNKNOWN' || total.finestPrecision === 'NONE'
                              ? 'text-sp-muted'
                              : 'text-sp-cyan'
                          }
                        >
                          {labels.levels[total.finestPrecision]}
                        </span>
                        {total.hasUnverified && (
                          <span data-gn="ranked-unverified" className="text-sp-muted">
                            {labels.unverifiedQualifier}
                          </span>
                        )}
                        {total.newSinceLastVisit > 0 && (
                          <span className="text-sp-amber">
                            +{total.newSinceLastVisit} {labels.newCount}
                          </span>
                        )}
                        {watching && (
                          <span data-gn="ranked-watching" className="text-sp-amber">
                            &#9678; {labels.watching}
                          </span>
                        )}
                      </span>
                    </button>
                  </li>
                );
              })}

              {/*
                THE HALF THAT KEEPS THE RANKED LIST HONEST — in the same list,
                in the muted register, exactly as the reference shows it. No
                left accent, because there is no state to encode: this is a
                place that was looked at and had nothing.
              */}
              {noEvidence.map((geography) => (
                <li key={geography.id}>
                  <button
                    type="button"
                    data-gn="no-evidence-geography"
                    data-gn-geography={geography.id}
                    onClick={() => onSelectGeography?.(geography.id)}
                    className="mb-[6px] w-full cursor-pointer border border-sp-line bg-sp-panel-2/50 px-[10px] py-[9px] text-left transition-colors hover:bg-sp-item-hover"
                  >
                    <span className="mb-[5px] block text-[12px] leading-[1.35] text-sp-ink-3">
                      {geography.displayName} &mdash; {labels.noEvidenceRow}
                    </span>
                    <span className="font-gn-mono text-[8.5px] uppercase tracking-[0.1em] text-sp-muted">
                      {labels.noEvidenceRowMeta}
                    </span>
                  </button>
                </li>
              ))}
            </ul>

            {noEvidence.length > 0 && (
              <p
                data-gn="no-evidence-note"
                className="mt-[2px] text-[11px] leading-[1.5] text-sp-ink-3"
              >
                {labels.noEvidenceNote}
              </p>
            )}
          </Section>
        </>
      )}

      {jumpTargets.length > 0 && onJump && (
        <Section gn="context-jumps" title={labels.jumpHeading}>
          <div className="grid grid-cols-2 gap-[6px]">
            {jumpTargets.map((target) => (
              <button
                key={target.id}
                type="button"
                data-gn="rail-jump"
                data-gn-target={target.id}
                onClick={() => onJump(target)}
                className="cursor-pointer rounded-[2px] border border-sp-line-2 px-[8px] py-[9px] font-gn-mono text-[9.5px] uppercase tracking-[0.12em] text-sp-ink-2 transition-colors hover:border-sp-cyan/45 hover:bg-sp-cyan/[0.16] hover:text-sp-cyan"
              >
                {labels.jumpTargets[target.id] ?? target.id}
              </button>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}
