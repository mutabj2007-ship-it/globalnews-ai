'use client';

import type { LanguageCode } from '@globalnews-ai/shared';
import type { EvidenceMeterState } from '../search/analysisDimensions';
import { getDictionary } from '@/lib/i18n/dictionaries';
import type { BriefTelemetry } from './briefModel';

/* ==================================================================== *
 * DESIGN-C2 LOCK 6 — THE TRUST SUMMARY.
 *
 * WHAT IT IS: the compact statement of evidence strength — the meter, its
 * word, the retrieval counts. It is ORIENTATION, not the answer, and Lock 6
 * spends its first paragraph saying so.
 *
 * RANK, WHICH IS THE DEFECT THIS FILE EXISTS TO CORRECT.
 *   phone    BELOW the answer's first paragraph. Never above it. The band
 *            put it above, so the first thing a phone reader met about the
 *            answer was a rating of it. That is R1 section 4's hierarchy
 *            defect and Lock 6 locks the correction.
 *   desktop  permitted in the summary band beside the question, because
 *            there is room and it does not displace the answer.
 *
 * GEOMETRY, LOCKED
 *   form          ONE compact line. Not a panel, not a card.
 *   meter         3 segments, 13x4px, 3px gap
 *   word          LIMITED / MODERATE / STRONG, 12px mono, green family
 *   counts        13px mono, muted, on the SAME line
 *   total height  <=24px phone, <=22px desktop  — capped structurally below,
 *                 so a future copy change cannot quietly break it. The two values are
        WRITTEN OUT rather than interpolated from the constants above,
        because Tailwind's JIT scans source text and would emit no rule for
        an interpolated class name — a cap that generates no CSS is not a cap
 *   border        NONE. A bordered box turns orientation into a claim.
 *
 * NON-COLOUR REDUNDANCY, LOCKED. Strength is carried by the WORD as well as
 * the filled-segment count, and the two always change together because both
 * come from the same `resolveEvidenceMeter` result. Colour is therefore free
 * to be CONSTANT across the three strength words — which is the strongest
 * reading of the rule, not a weaker one: nothing at all is left resting on
 * hue.
 *
 * FIVE LABELS, NOT THREE — REPORTED. Lock 6 names LIMITED / MODERATE /
 * STRONG. The accepted meter also has INSUFFICIENT (a RATED result: the
 * evidence was assessed and found insufficient) and UNRATED (no assessment
 * happened). Non-negotiable 4 makes Insufficient Evidence a first-class
 * result and `rated` exists precisely so the two can never be confused, so
 * neither is collapsed into LIMITED here. UNRATED is not a strength at all
 * and takes Lock 12's UNKNOWN grammar — amber-muted — rather than the green
 * family, because calling "we did not assess this" a shade of strength is
 * the overstatement both locks exist to prevent.
 *
 * PROHIBITED, AND ABSENT: a trust badge, a percentage, a score out of ten, a
 * shield, tick or seal, and any numeric confidence the backend does not
 * supply. `EvidenceMeterState` carries no number to render even if this file
 * wanted one.
 * ==================================================================== */

/** Lock 6 — the locked ceilings, as data so a test can state them. */
export const TRUST_LINE_MAX_PHONE = 24;
export const TRUST_LINE_MAX_DESKTOP = 22;
/** Lock 6 — segment geometry. */
export const TRUST_SEGMENT_W = 13;
export const TRUST_SEGMENT_H = 4;
export const TRUST_SEGMENT_GAP = 3;

/** Green family for every RATED result; Lock 12's UNKNOWN amber for UNRATED. */
const WORD_COLOUR = (rated: boolean): string => (rated ? '#6ee7b7' : '#d9a441');

export interface TrustSummaryLineProps {
  meter: EvidenceMeterState;
  telemetry: BriefTelemetry;
  language?: LanguageCode;
  /**
   * Where this instance sits. 'band' is the desktop summary band Lock 6
   * permits; 'reading' is the phone position below the answer's first
   * paragraph. It changes nothing but the marker a probe reads — the
   * treatment is identical, because Lock 6 locks one treatment.
   */
  placement: 'band' | 'reading';
  className?: string;
}

export function TrustSummaryLine({
  meter,
  telemetry,
  language = 'en',
  placement,
  className = '',
}: TrustSummaryLineProps): JSX.Element {
  const t = getDictionary(language).analysisFrame;

  const counts: string[] = [];
  if (telemetry.retrievedArticleCount !== null) {
    counts.push(`${telemetry.retrievedArticleCount} ${t.retrievedReports}`);
  }
  if (telemetry.reportingClusterCount !== null) {
    counts.push(`${telemetry.reportingClusterCount} ${t.reportingClusters}`);
  }

  return (
    <div
      data-paf="trust-summary"
      data-placement={placement}
      data-rated={meter.rated ? 'true' : 'false'}
      /*
        `max-h` is the lock made structural rather than promised. The
        intrinsic height is ~18px, so the cap is never reached in practice —
        it is there so a later copy or type change cannot quietly exceed it.
        No padding and no border: a bordered box turns orientation into a
        claim, and Lock 6 says so in those words.
      */
      className={`flex max-h-[24px] min-w-0 items-center gap-[8px] overflow-hidden md:max-h-[22px] ${className}`}
    >
      <span
        data-paf="evidence-meter"
        aria-hidden="true"
        className="inline-flex shrink-0 items-center"
        style={{ gap: `${TRUST_SEGMENT_GAP}px` }}
      >
        {Array.from({ length: meter.totalSegments }, (_, i) => (
          <span
            key={i}
            className={`inline-block rounded-[1px] ${
              i < meter.filledSegments ? 'bg-[#6ee7b7]' : 'bg-[#22303f]'
            }`}
            style={{ width: `${TRUST_SEGMENT_W}px`, height: `${TRUST_SEGMENT_H}px` }}
          />
        ))}
      </span>

      <span
        data-paf="evidence-word"
        className="shrink-0 font-gn-mono text-[12px] uppercase leading-[1.4] tracking-[0.14em] md:text-[11px]"
        style={{ color: WORD_COLOUR(meter.rated) }}
      >
        {meter.label}
      </span>

      {counts.length > 0 ? (
        <span
          data-paf="trust-counts"
          className="min-w-0 truncate font-gn-mono text-[13px] uppercase leading-[1.4] tracking-[0.1em] text-[#54687f]"
        >
          {counts.join(' · ')}
        </span>
      ) : null}
    </div>
  );
}
