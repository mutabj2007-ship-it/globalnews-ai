'use client';

import {
  ParticipantEntityCard,
  type ParticipantEntityLabels,
} from '@/components/specialist/ParticipantEntityCard';
import {
  ObservedIndicatorStrip,
  type IndicatorStripLabels,
} from '@/components/specialist/ObservedIndicatorStrip';
import {
  CompetingReadingsBlock,
  type CompetingReadingsLabels,
} from '@/components/specialist/CompetingReadingsBlock';
import type { ParticipantEntity } from '@/lib/specialist/participantEntity';
import type { IndicatorStrip } from '@/lib/specialist/indicatorStrip';
import type { CompetingReadingsBlock as ReadingsBlock } from '@/lib/specialist/competingReadings';
import {
  conflictWatchScopeAvailability,
  type WatchScopeVerdict,
} from '@/lib/map/conflict/conflictCapability';
import { SEVERITY_TREATMENT, type ConflictSeverity } from '@/lib/map/conflict/conflictDomain';
import type { RegionSelection } from '@/lib/map/region/regionSelection';

/**
 * THE CONFLICT ASSESSMENT RAIL — Part V §07.2 and §15's matrix.
 *
 * "The rail SWAPPED, not extended." Selection replaces the attention queue with
 * this card and leaves a 34px return header. Actors, incidents, timeline,
 * sources and the indicator list are each one interaction away and none of them
 * occupies the frame — the space rule working: functional depth grows,
 * permanent occupancy does not.
 *
 * ── THIS COMPONENT OWNS ALMOST NOTHING ────────────────────────────────────
 *
 * Participants render through the SHARED entity card. Indicators render through
 * the SHARED strip. Competing readings render through the SHARED block. What is
 * Conflict's here is the ORDER of the sections, the words, and which shared
 * component each section reaches for — the domain layer, exactly as §14 scoped
 * it. Delete this file and the shared components lose a consumer, not a home.
 *
 * ── FOUR MEANINGS, FOUR CHANNELS, ONE CARD ────────────────────────────────
 *
 * §07.2: CRITICAL is a red badge; SIGNIFICANT CHANGE is an amber chip and ring;
 * interpreted geography is a dashed halo and a banner sentence; moderate
 * confidence is a word. Nothing borrows another channel, and the frame carries
 * exactly one red element.
 *
 * ── AND NO PRIMARY ACTION UNTIL THE ASSESSMENT HAS BEEN READ ──────────────
 *
 * §07.2 is explicit: the Watch CTA is WITHHELD until the understood condition
 * is met (Part IV §03·R1), and "NO SAND CONTROL IS OFFERED EITHER: DEEP
 * ANALYSIS APPEARS ONLY AFTER THE USER HAS READ THE ASSESSMENT". Both are the
 * caller's to supply; this card renders neither on its own initiative.
 */

export interface ConflictRailLabels {
  readonly situationLabel: string;
  readonly assessmentHeading: string;
  readonly confidence: string;
  readonly geography: string;
  readonly participantsHeading: string;
  readonly consequenceHeading: string;
  readonly evidenceHeading: string;
  readonly severities: Readonly<Record<ConflictSeverity, string>>;
  readonly watchScopeHeading: string;
  readonly watchScopeHold: Readonly<Record<WatchScopeVerdict['reason'], string>>;
  readonly noService: string;
  readonly entity: ParticipantEntityLabels;
  readonly indicators: IndicatorStripLabels;
  readonly readings: CompetingReadingsLabels;
  readonly roleLabels: Readonly<Record<string, string>>;
}

export interface ConflictAssessmentRailProps {
  readonly subjectLabel: string;
  readonly severity: ConflictSeverity | null;
  readonly changeStateLabel: string | null;
  readonly assessment: string | null;
  readonly confidenceLabel: string | null;
  readonly geographyLabel: string | null;
  readonly participants: readonly ParticipantEntity[];
  readonly indicators: IndicatorStrip | null;
  readonly readings: ReadingsBlock | null;
  readonly evidenceLine: string | null;
  readonly evidenceDetails?: React.ReactNode;
  /** RSC-1 selection, when the subject is a region. Drives the watch-scope gate. */
  readonly region: RegionSelection | null;
  readonly nowMs: number;
  readonly labels: ConflictRailLabels;
  readonly onOpenIndicators?: () => void;
  readonly onOpenProvenance?: (entityId: string) => void;
  readonly onCompareSources?: () => void;
  readonly compareLabel?: string;
}

export function ConflictAssessmentRail({
  subjectLabel,
  severity,
  changeStateLabel,
  assessment,
  confidenceLabel,
  geographyLabel,
  participants,
  indicators,
  readings,
  evidenceLine,
  evidenceDetails,
  region,
  nowMs,
  labels,
  onOpenIndicators,
  onOpenProvenance,
  onCompareSources,
  compareLabel,
}: ConflictAssessmentRailProps): JSX.Element {
  /*
    THE WATCH SCOPE GATE. C12 carries no `watchScopeable` predicate — that is
    2F — so this renders the reason rather than a control. "Do not infer
    support" is the CTO's instruction, and an enabled-looking scope chip is
    exactly the inference it forbids.
  */
  const scopeVerdict = conflictWatchScopeAvailability('SITUATION', region);

  return (
    <div data-gn="conflict-rail" data-gn-severity={severity ?? undefined} className="text-sp-ink">
      <header className="border-b border-sp-line px-[14px] py-[12px]">
        <p className="font-gn-mono text-[9.5px] uppercase tracking-[0.18em] text-sp-ink-3">
          {labels.situationLabel}
        </p>
        <h2 data-gn="conflict-subject" className="mt-[3px] text-[17px] font-semibold leading-tight">
          {subjectLabel}
        </h2>
        <p className="mt-[6px] flex items-center gap-[8px]">
          {/* SEVERITY: typographic below CRITICAL, the one red at CRITICAL. */}
          {severity !== null && (
            <span
              data-gn="conflict-severity"
              data-gn-severity-rung={severity}
              className={`font-gn-mono text-[9px] uppercase tracking-[0.14em] ${SEVERITY_TREATMENT[severity]}`}
            >
              {labels.severities[severity]}
            </span>
          )}
          {/* CHANGE: the inherited amber chip. A different channel entirely. */}
          {changeStateLabel !== null && (
            <span
              data-gn="conflict-change"
              className="rounded-[2px] border border-sp-amber/40 bg-sp-amber/[0.14] px-[6px] py-[2px] font-gn-mono text-[9px] uppercase tracking-[0.12em] text-sp-amber"
            >
              {changeStateLabel}
            </span>
          )}
        </p>
      </header>

      {assessment !== null ? (
        <section
          data-gn="conflict-assessment"
          className="border-b border-sp-line px-[14px] py-[12px]"
        >
          <h3 className="mb-[6px] font-gn-mono text-[9.5px] uppercase tracking-[0.18em] text-sp-ink-3">
            {labels.assessmentHeading}
          </h3>
          <p className="text-[12.5px] leading-[1.55] text-sp-ink">{assessment}</p>
          <p className="mt-[6px] flex flex-wrap gap-x-[12px] font-gn-mono text-[8.5px] uppercase tracking-[0.12em] text-sp-ink-3">
            {/* CONFIDENCE IS A WORD — §04's third channel. */}
            {confidenceLabel !== null && (
              <span data-gn="conflict-confidence">
                {labels.confidence} {confidenceLabel}
              </span>
            )}
            {/* PROVENANCE IS GEOMETRY STROKE; this states it in words as well. */}
            {geographyLabel !== null && (
              <span data-gn="conflict-geography">
                {labels.geography} {geographyLabel}
              </span>
            )}
          </p>
        </section>
      ) : (
        /*
          NO ASSESSMENT SERVICE, STATED AS SUCH. Part V's own §17.1 note applies:
          an empty section "reads as an interface fault, not as honesty", so the
          absence is written in words.
        */
        <section
          data-gn="conflict-no-service"
          className="border-b border-sp-line px-[14px] py-[12px]"
        >
          <p className="text-[12px] leading-[1.5] text-sp-ink-2">{labels.noService}</p>
        </section>
      )}

      {/* OBSERVED INDICATORS — the shared strip, seven cells, zero AI. */}
      {indicators !== null && (
        <section className="border-b border-sp-line px-[14px] py-[12px]">
          <ObservedIndicatorStrip
            strip={indicators}
            labels={labels.indicators}
            nowMs={nowMs}
            onShowAll={onOpenIndicators}
          />
        </section>
      )}

      {evidenceLine !== null && (
        <section
          data-gn="conflict-evidence"
          className="border-b border-sp-line px-[14px] py-[12px]"
        >
          <h3 className="mb-[4px] font-gn-mono text-[9.5px] uppercase tracking-[0.18em] text-sp-ink-3">
            {labels.evidenceHeading}
          </h3>
          <p className="font-gn-mono text-[9px] uppercase tracking-[0.12em] text-sp-ink-2">
            {evidenceLine}
          </p>
          {evidenceDetails}
        </section>
      )}

      {/* PARTICIPANTS — the shared entity card, configured with conflict roles. */}
      {participants.length > 0 && (
        <section
          data-gn="conflict-participants"
          className="border-b border-sp-line px-[14px] py-[12px]"
        >
          <h3 className="mb-[4px] font-gn-mono text-[9.5px] uppercase tracking-[0.18em] text-sp-ink-3">
            {labels.participantsHeading} · {participants.length}
          </h3>
          {participants.map((entity) => (
            <ParticipantEntityCard
              key={entity.entityId}
              entity={entity}
              roleLabel={labels.roleLabels[entity.roleType] ?? entity.roleType}
              labels={labels.entity}
              /* Provenance in one tap — §15. The rail supplies the opener; the
                 card renders it only when there IS provenance to reach. */
              onOpenProvenance={
                onOpenProvenance ? () => onOpenProvenance(entity.entityId) : undefined
              }
            />
          ))}
        </section>
      )}

      {/* COMPETING READINGS — the shared block. §24's humanitarian rule. */}
      {readings !== null && (
        <section
          data-gn="conflict-consequence"
          className="border-b border-sp-line px-[14px] py-[12px]"
        >
          <h3 className="mb-[6px] font-gn-mono text-[9.5px] uppercase tracking-[0.18em] text-sp-ink-3">
            {labels.consequenceHeading}
          </h3>
          <CompetingReadingsBlock
            block={readings}
            labels={labels.readings}
            onCompareSources={onCompareSources}
            compareLabel={compareLabel}
          />
        </section>
      )}

      {/*
        WATCH SCOPE — a STATEMENT, not a control.

        The scope vocabulary is real and configured; the predicate that would
        say whether a given scope can be watched is 2F and is not in C12. So the
        surface names the exact reason instead of offering a chip that cannot
        work, and there is no enabled path here for a reader to press.
      */}
      <section
        data-gn="conflict-watch-scope"
        data-gn-scope-availability={scopeVerdict.availability}
        className="px-[14px] py-[12px]"
      >
        <h3 className="mb-[4px] font-gn-mono text-[9.5px] uppercase tracking-[0.18em] text-sp-ink-3">
          {labels.watchScopeHeading}
        </h3>
        <p
          data-gn="conflict-watch-scope-reason"
          className="text-[11px] leading-[1.5] text-sp-ink-2"
        >
          {labels.watchScopeHold[scopeVerdict.reason]}
        </p>
      </section>
    </div>
  );
}
