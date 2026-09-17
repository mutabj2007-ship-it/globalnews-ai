'use client';

import {
  blockIsValid,
  DISPUTED_HATCH_PX,
  readingsAreAccountable,
  type CompetingReadingsBlock as Block,
} from '@/lib/specialist/competingReadings';

/**
 * SHARED · DISAGREEMENT — two or more credible readings, held open.
 * Addendum §15 · Part V §7.3 and §24.
 *
 * ── THE HARDEST HONESTY CASE IN THE PRODUCT ───────────────────────────────
 *
 * Part V's measured example: 180,000 registered arrivals against a
 * 260,000–310,000 survey estimate including unregistered arrivals. The two
 * count different populations. Averaging them produces a number nobody
 * measured, wearing the authority of arithmetic — so this component renders
 * both, with their bases, their counting rules and their dates, and states in
 * words that GlobalNewsAI has not resolved it.
 *
 * There is no prop through which a preferred reading could be passed, and no
 * function in `competingReadings.ts` that takes two readings and returns a
 * number. The prohibition is structural, not editorial.
 *
 * ── HUELESS HATCH ─────────────────────────────────────────────────────────
 *
 * DISPUTED must not read as severity, as OFF TRACK, or as a contested source —
 * all of which may be present on the same object. The treatment is a hatch and
 * nothing else: no tint, no border colour, no chip hue.
 */

export interface CompetingReadingsLabels {
  readonly heading: string;
  readonly notResolved: string;
  readonly agreedHeading: string;
  readonly basis: string;
  readonly countingRule: string;
  readonly unresolvedNote: string;
  readonly sourceClasses: Readonly<Record<string, string>>;
  readonly sources: string;
  readonly incomplete: string;
}

export interface CompetingReadingsBlockProps {
  readonly block: Block;
  readonly labels: CompetingReadingsLabels;
  readonly compact?: boolean;
  readonly onCompareSources?: () => void;
  readonly compareLabel?: string;
}

const HATCH = (px: number): string =>
  `repeating-linear-gradient(45deg, rgba(126,166,186,.14) 0 ${px}px, transparent ${px}px ${px * 3}px)`;

export function CompetingReadingsBlock({
  block,
  labels,
  compact = false,
  onCompareSources,
  compareLabel,
}: CompetingReadingsBlockProps): JSX.Element | null {
  /* One reading is not a disagreement. Rendering it as one would manufacture
     a dispute out of a single source. */
  if (!blockIsValid(block)) return null;

  const accountable = readingsAreAccountable(block);
  const hatch = compact ? DISPUTED_HATCH_PX.compact : DISPUTED_HATCH_PX.desktop;

  return (
    <section
      data-gn="competing-readings"
      data-gn-subject={block.subjectRef}
      data-gn-resolution={block.resolutionStatus}
      data-gn-presentation="HUELESS_HATCH"
    >
      <header className="mb-[8px]">
        <h3 className="font-gn-mono text-[9.5px] font-medium uppercase tracking-[0.18em] text-sp-ink-3">
          {labels.heading}
        </h3>
        <p data-gn="disputed-field" className="mt-[2px] text-[12px] text-sp-ink-2">
          {block.disputedField}
          {block.unit ? ` · ${block.unit}` : ''}
        </p>
      </header>

      {/* STACKED, NEVER SIDE-BY-SIDE-AS-A-COMPARISON-WITH-A-WINNER. Each card
          carries the same weight; nothing marks a preferred reading. */}
      <ul className="flex flex-col gap-[8px]">
        {block.readings.map((reading) => (
          <li
            key={reading.readingId}
            data-gn="reading"
            data-gn-reading={reading.readingId}
            data-gn-source-class={reading.sourceClass}
            style={{ backgroundImage: HATCH(hatch) }}
            className="border border-gn-line-structural px-[10px] py-[8px]"
          >
            <p className="flex items-baseline justify-between gap-[8px] font-gn-mono text-[9px] uppercase tracking-[0.14em] text-sp-ink-3">
              <span>{labels.sourceClasses[reading.sourceClass] ?? reading.sourceClass}</span>
              <span>
                {reading.sourceCount} {labels.sources}
              </span>
            </p>
            <p data-gn="reading-value" className="mt-[3px] text-[15px] font-medium leading-tight text-sp-ink">
              {reading.valueRange ?? reading.value}
            </p>
            {/* BASIS AND COUNTING RULE, ON EVERY READING. §15 notes the counting
                rule is usually what actually differs. */}
            <p data-gn="reading-basis" className="mt-[4px] text-[11px] leading-[1.45] text-sp-ink-2">
              {reading.basis}
            </p>
            <p data-gn="reading-rule" className="mt-[2px] text-[11px] leading-[1.45] text-sp-ink-3">
              {labels.countingRule}: {reading.countingRule}
            </p>
            <p className="mt-[3px] font-gn-mono text-[8.5px] uppercase tracking-[0.12em] text-sp-ink-3">
              {reading.observedAt}
              {reading.precision ? ` · ${reading.precision}` : ''}
            </p>
          </li>
        ))}
      </ul>

      {/* IN WORDS, NOT ONLY IN LAYOUT. A reader who does not decode the hatch
          still learns that the product has not resolved this. */}
      <p data-gn="readings-unresolved" className="mt-[8px] text-[11px] leading-[1.5] text-sp-ink-2">
        {labels.unresolvedNote}
      </p>

      {!accountable && (
        <p data-gn="readings-incomplete" className="mt-[4px] text-[11px] leading-[1.5] text-sp-ink-3">
          {labels.incomplete}
        </p>
      )}

      {/*
        THE AGREED-FACTS LINE IS REQUIRED — §15. A dispute over one field must
        not discredit the whole object, and an empty list renders as nothing
        rather than as a heading over a void.
      */}
      {block.agreedFacts.length > 0 && (
        <div data-gn="agreed-facts" className="mt-[10px] border-t border-sp-line pt-[8px]">
          <h4 className="font-gn-mono text-[9px] uppercase tracking-[0.14em] text-sp-ink-3">
            {labels.agreedHeading}
          </h4>
          <ul className="mt-[4px] flex flex-col gap-[2px] text-[11px] leading-[1.5] text-sp-ink-2">
            {block.agreedFacts.map((fact) => (
              <li key={fact}>{fact}</li>
            ))}
          </ul>
        </div>
      )}

      {onCompareSources && compareLabel && (
        <button
          type="button"
          data-gn="readings-compare"
          /*
            B3.1 · SPECIALIST-SP-SURFACE-RAISED-TOKEN-1 — RESOLVED.

            `sp-surface-raised` was never in any accepted authority. C907 §1
            ruled it and two siblings STALE and repointed their consumers rather
            than minting a colour; `spatialChromeTokens.spec.ts` and
            `verify-spatial-tokens.mjs` both fail if the name returns.

            THIS IS THE HOVER ROLE, so it takes the mapping already accepted for
            it: `sp-item-hover` (#101a24), the prototype's own `.item:hover`
            and the only neutral raised hover surface in the authority. Cyan was
            disqualified because Part I §E forbids an intelligence hue on a
            control state; amber is a monitoring claim.
          */
          onClick={onCompareSources}
          className="mt-[10px] min-h-[44px] w-full border border-gn-line-structural text-[12px] text-sp-ink transition-colors hover:bg-sp-item-hover"
        >
          {compareLabel}
        </button>
      )}
    </section>
  );
}
