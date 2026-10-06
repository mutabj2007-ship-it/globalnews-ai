'use client';

import { useEffect, useRef, useState, type JSX, type ReactNode } from 'react';

/**
 * ASK READING EXPERIENCE R1 — one answer table, three representations of the SAME data
 * (H RESPONSIVE-FREEZE §5; the rules are the `gna-ask-table*` classes in globals.css).
 *
 * The cells arrive already rendered by the one answer renderer (`AskAnswerProse`), so emphasis
 * and the governed source links are drawn exactly once. The stacked form is the SAME table
 * restyled by a container query (each cell labelled from `data-label`), not a second copy — so
 * no link, number or field exists twice in the DOM, and none is dropped in the narrow form.
 *
 * The scroll hint is shown ONLY when the region really overflows (`scrollWidth > clientWidth`),
 * measured, never assumed; on the server and before measurement it is hidden.
 */
const NUMERIC_CELL = /^[\s(]*[-+−–]?[\d.,\s]+(?:%|pp|bp)?[)\s]*$/;

export function isNumericCell(text: string): boolean {
  return text.trim() !== '' && NUMERIC_CELL.test(text);
}

export function AskAnswerTable({
  label,
  header,
  headerText,
  rows,
  numeric,
  scrollHint,
}: {
  /** The header cells' text, joined — the region's accessible name. */
  readonly label: string;
  readonly header: readonly ReactNode[];
  /** Plain header text per column — the stacked form's field labels. */
  readonly headerText: readonly string[];
  readonly rows: readonly (readonly ReactNode[])[];
  /** Per body cell: right-align as a number (tabular figures). */
  readonly numeric: readonly (readonly boolean[])[];
  readonly scrollHint: string;
}): JSX.Element {
  const region = useRef<HTMLDivElement>(null);
  const [overflowing, setOverflowing] = useState(false);
  const wide = header.length > 3;

  useEffect(() => {
    const el = region.current;
    if (el === null || !wide) return;
    const measure = () => setOverflowing(el.scrollWidth > el.clientWidth + 1);
    measure();
    if (typeof ResizeObserver !== 'function') return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [wide]);

  const cellBorder = 'border-t border-[var(--ask-read-line-soft,var(--gt-line,#d6dde8))] px-2.5 py-2';
  return (
    <div
      className="gna-ask-table"
      data-ask-table-cols={header.length}
      data-ask-table-cols-wide={wide ? 'true' : 'false'}
    >
      {wide && (
        <p
          data-ask="table-scroll-hint"
          hidden={!overflowing}
          className="gna-ask-table-hint mb-1 text-[0.75rem] text-[var(--ask-read-ink3,#8299b4)]"
        >
          {scrollHint}
        </p>
      )}
      <div
        ref={region}
        role="region"
        aria-label={label}
        tabIndex={0}
        data-ask="answer-table"
        className="gna-ask-table-region max-w-full overflow-x-auto overscroll-x-contain rounded-[8px] border border-[var(--ask-read-line,var(--gt-line,#d6dde8))]"
      >
        <table
          className="gna-ask-table-grid w-full border-collapse text-start text-[0.875rem] leading-snug tabular-nums"
          /* ASK R2 — wide tables keep readable columns: the region scrolls, the columns do not
             collapse to a few characters. ≤3 columns need no minimum: they wrap in place. */
          style={wide ? { minWidth: `${Math.max(28, header.length * 8)}rem` } : undefined}
        >
          <thead>
            <tr>
              {header.map((cell, i) => (
                <th
                  key={`h${i}`}
                  scope="col"
                  className={`border-b border-[var(--ask-read-line-soft,var(--gt-line,#d6dde8))] bg-[var(--ask-read-sunk,var(--gt-sunk,#f1f4f8))] px-2.5 py-2 text-start font-semibold ${
                    wide && i === 0 ? 'gna-ask-table-sticky' : ''
                  }`}
                >
                  {cell}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, r) => (
              <tr key={`r${r}`} className="align-top">
                {row.map((cell, c) =>
                  c === 0 ? (
                    <th
                      key={`r${r}c${c}`}
                      scope="row"
                      data-label={headerText[c]}
                      className={`${cellBorder} text-start font-semibold ${wide ? 'gna-ask-table-sticky' : ''}`}
                    >
                      {cell}
                    </th>
                  ) : (
                    <td
                      key={`r${r}c${c}`}
                      data-label={headerText[c]}
                      className={`${cellBorder} ${numeric[r]?.[c] === true ? 'text-end' : ''}`}
                    >
                      {cell}
                    </td>
                  ),
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
