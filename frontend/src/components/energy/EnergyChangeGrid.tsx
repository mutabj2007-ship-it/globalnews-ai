'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ENERGY_INK, ENERGY_LAYOUT, ENERGY_LINE, ENERGY_SEMANTIC, ENERGY_TYPE } from '@/lib/energy/energyTokens';
import { ENERGY_METADATA_CLAMP, metaAccessibleName, metadataSlotStyle } from '@/lib/energy/energyOverflow';
import { changeStateTokens } from '@/lib/observation/changeState';
import { AbsenceBlock, ChangeStateTokens, ENERGY_TONE_HEX, Meta, RowMeta, StateChip, mono } from '@/components/energy/EnergyParts';
import type { EnergyStrings } from '@/lib/energy/energyStrings';
import type { EnergyChangeRow, EnergyFrameData } from '@/lib/energy/energyModel';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * H04 — THE CHANGE GRID. GEOMETRY NOW; THE WORDS WAIT ON M01.
 * ════════════════════════════════════════════════════════════════════════════
 *
 * The contract is unusually precise here, so the numbers below are measurements
 * rather than choices: VIRTUALIZED ROWS, 28/14 COLUMN DENSITY, 60px ROWS,
 * ROVING TABINDEX. And the split that lets this ship today:
 *
 *   M01 blocks "the change grid's WORDS"; it does not block "its geometry,
 *   density, rows, a11y".
 *
 * So every change-state label that renders here carries
 * `data-energy-vocabulary="M01-PENDING"`, and the substrate states the seam in
 * its own footer. Nothing pretends the vocabulary is settled.
 *
 * ── WHAT THE BANDS MEAN, AND WHAT THEY MUST NOT BE READ AS ───────────────
 *
 *   "Bands mark ASSESSMENT EVENTS, not article counts."
 *
 * That distinction is the whole grid. A row with no bands is not a row with no
 * news; it is a row where our understanding did not move — and a QUIET ROW
 * STATES WHAT WAS REVIEWED, which is why `meta` is required on every row and
 * why an empty `bands` map is legible rather than blank.
 */

const WIDE_COLUMNS = ENERGY_LAYOUT.changeColumnsWide;
const NARROW_COLUMNS = ENERGY_LAYOUT.changeColumnsNarrow;
const ROW_HEIGHT = ENERGY_LAYOUT.changeRowHeight;
const BAND_HEIGHT = ENERGY_LAYOUT.changeBandHeight;
/** Rows rendered above and below the viewport, so scrolling never shows a hole. */
const OVERSCAN = 4;

interface EnergyChangeGridProps {
  readonly data: EnergyFrameData;
  readonly strings: EnergyStrings;
  readonly selectedId: string | null;
  readonly onSelect: (id: string | null) => void;
  readonly windowLabel: string;
  readonly columns: number;
}

export function EnergyChangeGrid({
  data,
  strings,
  selectedId,
  onSelect,
  windowLabel,
  columns,
}: EnergyChangeGridProps): JSX.Element {
  const rows = data.changeRows;
  const zone = data.zones['change.grid'];
  /* The whole reader-state vocabulary, so F-4's prefix check has something to compare against. */
  const stateVocabulary = Object.values(strings.state);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(560);

  /**
   * ROVING TABINDEX — ONE STOP FOR THE WHOLE LIST.
   *
   * The state board requires it: "Substrate markers and ribbon rows are
   * reachable as a SINGLE roving-tabindex list with arrow keys; Enter opens the
   * HUD or drawer; Escape closes the topmost transient surface only."
   *
   * One tab stop, not one per row, is what keeps a nine-row grid and a
   * nine-hundred-row grid equally passable by keyboard.
   */
  const [activeIndex, setActiveIndex] = useState(0);
  const rowRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const element = scrollRef.current;
    if (element === null) return undefined;
    const measure = (): void => setViewportHeight(element.clientHeight);
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  /* Virtualization: only the rows that can be seen are mounted. */
  const first = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
  const visibleCount = Math.ceil(viewportHeight / ROW_HEIGHT) + OVERSCAN * 2;
  const last = Math.min(rows.length, first + visibleCount);
  const windowed = useMemo(() => rows.slice(first, last), [rows, first, last]);

  const focusRow = useCallback(
    (index: number): void => {
      const clamped = Math.max(0, Math.min(rows.length - 1, index));
      setActiveIndex(clamped);
      /* Bring a virtualized row into view before focusing it, or focus is lost. */
      const element = scrollRef.current;
      if (element !== null) {
        const top = clamped * ROW_HEIGHT;
        if (top < element.scrollTop) element.scrollTop = top;
        else if (top + ROW_HEIGHT > element.scrollTop + element.clientHeight) {
          element.scrollTop = top + ROW_HEIGHT - element.clientHeight;
        }
      }
      window.requestAnimationFrame(() => rowRefs.current[clamped]?.focus());
    },
    [rows.length],
  );

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>, index: number, row: EnergyChangeRow): void {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      focusRow(index + 1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      focusRow(index - 1);
    } else if (event.key === 'Home') {
      event.preventDefault();
      focusRow(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      focusRow(rows.length - 1);
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onSelect(row.subjectId);
    }
  }

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      <div
        style={{
          padding: '16px 22px 12px',
          borderBottom: `1px solid ${ENERGY_LINE.hairlineSoft}`,
          display: 'flex',
          alignItems: 'flex-end',
          gap: '16px',
          flex: 'none',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <span style={{ ...mono(undefined, ENERGY_INK.meta), letterSpacing: '.2em' }}>
            {strings.substrateEyebrow.change}
          </span>
          <span style={{ fontSize: '20px', fontWeight: 600, letterSpacing: '-.01em', color: ENERGY_INK.primary }}>
            {strings.substrateHeadline.change} · {windowLabel}
          </span>
        </div>
        <div style={{ flex: 1 }} />
        <Meta>{strings.changeAxisTwoAxisNote}</Meta>
      </div>

      {/* The column ruler. It is absent when there are no assessments to place on it. */}
      {data.changeAxis.length > 0 ? (
        <div style={{ padding: '10px 22px 0', display: 'flex', alignItems: 'center', gap: '12px', flex: 'none' }}>
          <span style={{ width: '236px', flex: 'none' }} />
          <span style={{ width: '118px', flex: 'none' }} />
          <div style={{ flex: 1, display: 'flex', justifyContent: 'space-between' }}>
            {data.changeAxis.map((label) => (
              <Meta key={label}>{label}</Meta>
            ))}
          </div>
          <span style={{ width: '190px', flex: 'none' }} />
        </div>
      ) : null}

      <div
        ref={scrollRef}
        onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
        role="listbox"
        aria-label={strings.substrateHeadline.change}
        style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '4px 22px 0' }}
      >
        {rows.length === 0 && zone !== undefined ? (
          <AbsenceBlock zone={zone} strings={strings} label={strings.substrateHeadline.change} />
        ) : (
          <div style={{ height: `${rows.length * ROW_HEIGHT}px`, position: 'relative' }}>
            <div style={{ transform: `translateY(${first * ROW_HEIGHT}px)` }}>
              {windowed.map((row, offset) => {
                const index = first + offset;
                const selected = row.subjectId !== null && row.subjectId === selectedId;
                return (
                  <div
                    key={`${row.subject}-${index}`}
                    ref={(element) => {
                      rowRefs.current[index] = element;
                    }}
                    role="option"
                    aria-selected={selected}
                    /*
                      The accessible name carries name, scope, state and what was
                      reviewed — "Absence states are ANNOUNCED BY NAME … never as
                      empty regions."
                    */
                    aria-label={`${row.subject}, ${strings.scope[row.scope]}, ${
                      row.readerState === null
                        ? row.changeState === null
                          ? ''
                          : changeStateTokens(row.changeState, strings.changeState).join(' · ')
                        : strings.state[row.readerState]
                    }, ${metaAccessibleName(row.meta, strings)}`}
                    tabIndex={index === activeIndex ? 0 : -1}
                    onKeyDown={(event) => handleKeyDown(event, index, row)}
                    onFocus={() => setActiveIndex(index)}
                    onClick={() => onSelect(row.subjectId)}
                    data-energy-row={row.subjectId ?? 'unlinked'}
                    data-energy-canonical={row.canonicalAbsence ?? undefined}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      height: `${ROW_HEIGHT}px`,
                      borderBottom: `1px solid ${ENERGY_LINE.hairlineFaint}`,
                      cursor: row.subjectId === null ? 'default' : 'pointer',
                      background: selected ? 'rgba(63,208,232,.07)' : 'transparent',
                      outlineOffset: '-2px',
                    }}
                  >
                    <div style={{ width: '236px', flex: 'none', display: 'flex', alignItems: 'center', gap: '9px', minWidth: 0 }}>
                      <span
                        style={{
                          width: '4px',
                          height: '26px',
                          background: ENERGY_TONE_HEX[row.tone],
                          borderRadius: '1px',
                          flex: 'none',
                        }}
                      />
                      <span
                        style={{
                          fontSize: '13.5px',
                          color: ENERGY_INK.primary,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {row.subject}
                      </span>
                    </div>
                    {/*
                      F-1 · the three declarations `row.subject` already had.
                      F-2 · the complete value survives as the accessible name,
                            and the visible text is its prefix.
                      The column is now LOCALIZED — it rendered English in the
                      Polish grid in R1, on the one column L measured as having
                      zero headroom even in English.
                    */}
                    <span
                      title={strings.scope[row.scope]}
                      aria-label={strings.scope[row.scope]}
                      style={{ width: '118px', flex: 'none', ...mono(undefined, ENERGY_INK.meta), ...ENERGY_METADATA_CLAMP }}
                    >
                      {strings.scope[row.scope]}
                    </span>
                    <div style={{ flex: 1, display: 'flex', gap: '2px', alignItems: 'center', minWidth: 0 }}>
                      {Array.from({ length: columns }, (_, column) => {
                        /*
                          At 14 columns each cell spans two of the 28 positions,
                          so a narrow grid loses resolution rather than events —
                          an event in either half still paints its band.
                        */
                        const scale = WIDE_COLUMNS / columns;
                        const from = Math.round(column * scale);
                        const to = Math.round((column + 1) * scale);
                        let tone: string | null = null;
                        for (let position = from; position < to; position += 1) {
                          const band = row.bands[position];
                          if (band !== undefined) tone = ENERGY_TONE_HEX[band];
                        }
                        return (
                          <span
                            key={column}
                            style={{
                              flex: 1,
                              height: `${BAND_HEIGHT}px`,
                              background: tone ?? 'rgba(141,162,184,.11)',
                              borderRadius: '1px',
                            }}
                          />
                        );
                      })}
                    </div>
                    <div
                      style={{
                        width: '190px',
                        flex: 'none',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'flex-end',
                        gap: '3px',
                        minWidth: 0,
                      }}
                    >
                      {row.readerState === null ? (
                        row.changeState === null ? null : (
                          <ChangeStateTokens state={row.changeState} labels={strings.changeState} tone={row.tone} variant="bare" />
                        )
                      ) : (
                        /*
                          F-4 · a label whose truncated prefix is itself a member
                          of the same vocabulary may not be ellipsized. In Polish
                          `NIEDOSTĘPNE` is both UNAVAILABLE (entitlement) and NOT
                          AVAILABLE (the never-simulated tier), so a clipped
                          `NIEDOSTĘPNE · LICENCJA` would show A DIFFERENT VALID
                          STATE rather than a shortened one. Those labels overflow
                          visibly instead, and L shortens them or Design gives them
                          their own slot.
                        */
                        <span style={metadataSlotStyle(strings.state[row.readerState], stateVocabulary)}>
                          <StateChip state={row.readerState} strings={strings} canonical={row.canonicalAbsence} />
                        </span>
                      )}
                      <RowMeta meta={row.meta} strings={strings} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div
        style={{
          flex: 'none',
          height: '40px',
          borderTop: `1px solid ${ENERGY_LINE.hairlineSoft}`,
          display: 'flex',
          alignItems: 'center',
          padding: '0 22px',
          gap: '16px',
        }}
      >
        <span style={{ ...mono(undefined, ENERGY_SEMANTIC.achromatic), letterSpacing: '.14em' }}>
          {columns} COLUMNS · {ROW_HEIGHT}PX ROWS
        </span>
        <span style={{ fontSize: '11.5px', color: ENERGY_INK.meta }}>{strings.changeAxisNote}</span>
      </div>
    </div>
  );
}
