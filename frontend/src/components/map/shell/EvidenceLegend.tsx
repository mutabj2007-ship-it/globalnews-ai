'use client';

import { LEGEND_TOKENS } from '@/lib/map/spatial/colourGrammar';
import { LEGEND_KEYS, type LegendKey } from '@/lib/map/spatial/precisionModel';

/**
 * SPATIAL M2 — THE EVIDENCE LEGEND, FROM DESIGN PART I §E AND PART II §2.
 *
 * "Five entries only: verified, attention, interpreted, none, reference. IF A
 * COLOUR IS NOT IN THE LEGEND IT MAY NOT APPEAR ON THE MAP."
 *
 * Part II §2 states the mechanism this component must have: "driven by THE
 * SAME TOKEN MAP THE RENDERER USES so the two can never drift". So the swatch
 * colours below are not authored here — they are read from
 * `colourGrammar.ts`, which is the same module the canvas paints from. There
 * is no value in this file a designer could change to make the legend disagree
 * with the map, because there is no colour value in this file at all.
 *
 * The swatch reproduces the ACTUAL treatment, not a coloured square: dashed
 * borders are dashed and unfilled entries are unfilled. Part I §G requires
 * uncertainty to be "drawn, not just labelled" — a legend that flattens a
 * hollow dashed grey ring into a solid grey chip has quietly taught the reader
 * the opposite of the rule it exists to explain.
 */

export interface EvidenceLegendLabels {
  readonly heading: string;
  readonly entries: Readonly<Record<LegendKey, string>>;
  readonly collapse: string;
  readonly expand: string;
}

export interface EvidenceLegendProps {
  readonly labels: EvidenceLegendLabels;
  readonly open?: boolean;
  readonly onToggle?: (next: boolean) => void;
  readonly className?: string;
}

export function EvidenceLegend({
  labels,
  open = true,
  onToggle,
  className = '',
}: EvidenceLegendProps): JSX.Element {
  return (
    <div
      data-gn="map-evidence-legend"
      data-gn-open={open}
      className={`border border-sp-line bg-sp-panel/[0.86] px-[11px] py-[9px] backdrop-blur-[6px] ${className}`}
    >
      <button
        type="button"
        aria-expanded={open}
        onClick={() => onToggle?.(!open)}
        data-gn="legend-toggle"
        className="mb-[6px] flex w-full items-center justify-between gap-[14px] font-gn-mono text-[9.5px] uppercase tracking-[0.18em] text-sp-ink-3"
      >
        {labels.heading}
        <span aria-hidden="true">{open ? '−' : '+'}</span>
        <span className="sr-only">{open ? labels.collapse : labels.expand}</span>
      </button>

      {open && (
        <ul data-gn="legend-entries" className="flex flex-col">
          {LEGEND_KEYS.map((key) => {
            const token = LEGEND_TOKENS[key];

            return (
              <li
                key={key}
                data-gn="legend-entry"
                data-gn-legend={key}
                className="flex items-center gap-[7px] whitespace-nowrap py-[2px] text-[10.5px] text-sp-ink-2"
              >
                {/*
                  A 9px ROUND dot, matching the marker the renderer actually
                  draws. Dashed entries stay hollow and dashed — Part I §G
                  requires uncertainty to be drawn, and a legend that flattens a
                  hollow dashed ring into a solid chip teaches the opposite of
                  the rule it exists to explain.
                */}
                <i
                  aria-hidden="true"
                  data-gn="legend-swatch"
                  data-gn-dashed={token.dashed}
                  data-gn-filled={token.fillOpacity > 0}
                  className="block h-[9px] w-[9px] flex-none rounded-full"
                  style={{
                    backgroundColor: token.fillOpacity > 0 ? token.stroke : 'transparent',
                    border: token.fillOpacity > 0 ? 'none' : `1px dashed ${token.stroke}`,
                    boxShadow: token.fillOpacity > 0 ? `0 0 8px ${token.stroke}66` : 'none',
                  }}
                />
                <span>{labels.entries[key]}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
