'use client';

import { useMemo, useState } from 'react';
import { ENERGY_INK, ENERGY_LINE, ENERGY_SEMANTIC, ENERGY_TYPE } from '@/lib/energy/energyTokens';
import { AbsenceBlock, ENERGY_TONE_HEX, Meta, SectionLabel, StateChip, mono } from '@/components/energy/EnergyParts';
import { MachineReadable } from '@/lib/typography/runBoundary';
import type { EnergyStrings } from '@/lib/energy/energyStrings';
import { readerAvailability } from '@/lib/energy/energyDisclosure';
import type { EnergyFrameData } from '@/lib/energy/energyModel';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * H03 — SVG SANKEY, WITH EXPLICIT SHARE-OF-ASSESSED-SUPPLY SEMANTICS
 * ════════════════════════════════════════════════════════════════════════════
 *
 * ── WHAT A RIBBON'S WIDTH MEANS, AND THE MISREADING IT MUST PREVENT ──────
 *
 * A Sankey ordinarily encodes a FLOW RATE, and a reader arrives expecting that.
 * Here it does not. UNITS-AUTHORITY is explicit:
 *
 *   "% (storage level, SHARE OF SUPPLY) -> `ene:PCT` -> RATIO — the Sankey's
 *    share-of-assessed-supply is A RATIO, NEVER A FLOW."
 *
 * and the word *assessed* is doing as much work as the word *share*: the
 * denominator is what we have assessed, not what physically moves. A ribbon is
 * therefore a statement about our coverage, not about a pipeline's throughput.
 * The substrate says so in its header, on its own axis, and in every hover
 * readout — three places, because one caption is easy to miss and this is the
 * misreading that would matter most.
 *
 * ── WHY A LICENSED LINK HAS NO WIDTH AT ALL ──────────────────────────────
 *
 * Commercial flow and cargo series are RIGHTS BLOCKED and off in Beta. A link
 * that exists as a capability but not as a value renders as a violet
 * UNAVAILABLE ribbon at a fixed hairline width. It is deliberately NOT drawn at
 * some small share — a placeholder width would be a fabricated substitute, and
 * "no real-time feed is simulated" applies to the shape of a thing as much as
 * to its number.
 *
 * ── HOVER ISOLATION ──────────────────────────────────────────────────────
 *
 * Required by H03 and implemented as opacity plus a readout rather than as
 * hiding: an isolated view still shows the rest of the system, because a reader
 * comparing one dependency against the others needs both at once. Hover is an
 * enhancement — every link is also in the dependence table below, which is
 * reachable by keyboard, so nothing here is hover-only.
 */

const NODE_WIDTH = 13;
const CHART_PADDING = { top: 26, right: 150, bottom: 26, left: 150 };

interface EnergyFlowSankeyProps {
  readonly data: EnergyFrameData;
  readonly strings: EnergyStrings;
  readonly height: number;
  readonly width: number;
}

export function EnergyFlowSankey({ data, strings, height, width }: EnergyFlowSankeyProps): JSX.Element {
  const [isolated, setIsolated] = useState<string | null>(null);
  const zone = data.zones['flows.sankey'];

  const layout = useMemo(() => {
    const columns = new Map<number, string[]>();
    data.flowNodes.forEach((node) => {
      const list = columns.get(node.column) ?? [];
      list.push(node.id);
      columns.set(node.column, list);
    });

    const columnCount = Math.max(1, columns.size);
    const innerWidth = Math.max(width - CHART_PADDING.left - CHART_PADDING.right, 120);
    const innerHeight = Math.max(height - CHART_PADDING.top - CHART_PADDING.bottom, 120);

    const positions = new Map<string, { x: number; y: number; h: number; column: number }>();

    columns.forEach((ids, column) => {
      /*
        A node's height is the larger of its inbound and outbound share, so a
        node never appears to emit more than it receives. Where a share is
        absent the node contributes a MINIMUM height rather than zero — it
        exists, and a zero-height node would read as "not present".
      */
      const totals = ids.map((id) => {
        const out = data.flowLinks.filter((l) => l.from === id).reduce((sum, l) => sum + (l.sharePct ?? 0), 0);
        const incoming = data.flowLinks.filter((l) => l.to === id).reduce((sum, l) => sum + (l.sharePct ?? 0), 0);
        return Math.max(out, incoming, 6);
      });
      const sum = totals.reduce((a, b) => a + b, 0);
      const gap = 16;
      const usable = innerHeight - gap * Math.max(0, ids.length - 1);
      let cursor = CHART_PADDING.top;
      ids.forEach((id, index) => {
        const h = Math.max(10, (totals[index] / sum) * usable);
        positions.set(id, {
          x: CHART_PADDING.left + (innerWidth / Math.max(1, columnCount - 1)) * column - (column === columnCount - 1 ? NODE_WIDTH : 0),
          y: cursor,
          h,
          column,
        });
        cursor += h + gap;
      });
    });

    /* Ribbons leave and arrive stacked, in declaration order, so they never cross needlessly. */
    const outCursor = new Map<string, number>();
    const inCursor = new Map<string, number>();

    const ribbons = data.flowLinks.map((link) => {
      const from = positions.get(link.from);
      const to = positions.get(link.to);
      if (from === undefined || to === undefined) return null;

      /* Two axes. A refused series is achromatic, not violet — D-2. */
      const availability = link.disclosure === null ? 'AVAILABLE' : readerAvailability(link.disclosure);
      const unavailable = availability !== 'AVAILABLE';
      const entitlement = availability === 'UNAVAILABLE_LICENSED';
      const share = link.sharePct ?? 0;
      const fromTotal = data.flowLinks.filter((l) => l.from === link.from).reduce((s, l) => s + (l.sharePct ?? 0), 0);
      const toTotal = data.flowLinks.filter((l) => l.to === link.to).reduce((s, l) => s + (l.sharePct ?? 0), 0);

      const thickness = unavailable ? 2 : Math.max(2, (share / Math.max(fromTotal, 1)) * from.h);
      const arriveThickness = unavailable ? 2 : Math.max(2, (share / Math.max(toTotal, 1)) * to.h);

      const y0 = from.y + (outCursor.get(link.from) ?? 0) + thickness / 2;
      const y1 = to.y + (inCursor.get(link.to) ?? 0) + arriveThickness / 2;
      outCursor.set(link.from, (outCursor.get(link.from) ?? 0) + thickness);
      inCursor.set(link.to, (inCursor.get(link.to) ?? 0) + arriveThickness);

      const x0 = from.x + NODE_WIDTH;
      const x1 = to.x;
      const mid = (x0 + x1) / 2;

      return {
        key: `${link.from}->${link.to}`,
        d: `M ${x0} ${y0} C ${mid} ${y0}, ${mid} ${y1}, ${x1} ${y1}`,
        thickness: Math.max(thickness, arriveThickness),
        tone: ENERGY_TONE_HEX[link.tone],
        unavailable,
        entitlement,
        sharePct: link.sharePct,
        from: link.from,
        to: link.to,
      };
    });

    return { positions, ribbons: ribbons.filter((r): r is NonNullable<typeof r> => r !== null) };
  }, [data, width, height]);

  if (data.flowLinks.length === 0) {
    return (
      <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {zone === undefined ? null : <AbsenceBlock zone={zone} strings={strings} label={strings.substrateHeadline.flows} />}
      </div>
    );
  }

  const nodeById = new Map(data.flowNodes.map((node) => [node.id, node]));

  return (
    <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
      <svg
        width={width}
        height={height}
        role="img"
        aria-label={`${strings.substrateHeadline.flows}. ${strings.flowsShareSemantics}`}
        style={{ display: 'block' }}
      >
        <g>
          {layout.ribbons.map((ribbon) => {
            const dimmed = isolated !== null && isolated !== ribbon.from && isolated !== ribbon.to;
            return (
              <path
                key={ribbon.key}
                d={ribbon.d}
                fill="none"
                stroke={ribbon.entitlement ? ENERGY_SEMANTIC.violet : ribbon.unavailable ? ENERGY_SEMANTIC.achromatic : ribbon.tone}
                strokeWidth={ribbon.thickness}
                strokeOpacity={dimmed ? 0.12 : ribbon.unavailable ? 0.85 : 0.42}
                strokeDasharray={ribbon.unavailable ? '3 4' : undefined}
                data-energy-link={ribbon.key}
                data-energy-unit={ribbon.unavailable ? undefined : 'ene:PCT'}
                data-energy-semantics="share-of-assessed-supply"
                onMouseEnter={() => setIsolated(ribbon.from)}
                onMouseLeave={() => setIsolated(null)}
              />
            );
          })}
        </g>
        <g>
          {data.flowNodes.map((node) => {
            const position = layout.positions.get(node.id);
            if (position === undefined) return null;
            const dimmed = isolated !== null && isolated !== node.id;
            const anchorRight = position.column === 0;
            return (
              <g key={node.id} opacity={dimmed ? 0.35 : 1}>
                <rect
                  x={position.x}
                  y={position.y}
                  width={NODE_WIDTH}
                  height={position.h}
                  fill={ENERGY_TONE_HEX[node.tone]}
                  opacity={0.9}
                  rx={1}
                />
                <text
                  x={anchorRight ? position.x - 10 : position.x + NODE_WIDTH + 10}
                  y={position.y + position.h / 2}
                  textAnchor={anchorRight ? 'end' : 'start'}
                  dominantBaseline="middle"
                  fill={ENERGY_INK.body}
                  fontFamily={ENERGY_TYPE.sans}
                  fontSize={12}
                >
                  {node.label}
                </text>
              </g>
            );
          })}
        </g>
      </svg>

      {/* The readout. Three statements of the semantics; this is the third. */}
      <div style={{ position: 'absolute', left: '16px', bottom: '10px', display: 'flex', gap: '14px', alignItems: 'center' }}>
        <Meta tone={ENERGY_SEMANTIC.achromatic}>{strings.flowsShareSemantics}</Meta>
        {isolated === null ? null : (
          <Meta tone={ENERGY_SEMANTIC.cyan}>
            {nodeById.get(isolated)?.label ?? isolated} ·{' '}
            {layout.ribbons
              .filter((r) => r.from === isolated || r.to === isolated)
              .map((r) =>
                r.sharePct === null
                  ? r.entitlement
                    ? strings.state.UNAVAILABLE_LICENSED
                    : strings.state.COVERAGE_GAP
                  : `${r.sharePct}% ene:PCT`,
              )
              .join(' · ')}
          </Meta>
        )}
      </div>
    </div>
  );
}

/**
 * The dependence table and the storage column, which carry the same data the
 * ribbons do WITHOUT HOVER — so nothing on this substrate is hover-only — plus
 * the locator.
 *
 * THE LOCATOR IS ORIENTATION ONLY. GEOGRAPHY-SYSTEM-SCOPE says so explicitly:
 * "substrate B's locator map is orientation only and carries NO ASSET
 * PRECISION." It is the same MapLibre substrate at a regional frame, and it
 * states that limit beneath itself rather than relying on its size to imply it.
 */
export function EnergyFlowDetail({
  data,
  strings,
  locator,
}: {
  data: EnergyFrameData;
  strings: EnergyStrings;
  locator?: React.ReactNode;
}): JSX.Element {
  const dependenceZone = data.zones['flows.dependence'];
  const storageZone = data.zones['flows.storage'];

  return (
    <div style={{ flex: 'none', height: '300px', borderTop: `1px solid ${ENERGY_LINE.hairlineSoft}`, display: 'flex' }}>
      <div
        style={{
          flex: 1,
          minWidth: 0,
          padding: '14px 22px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          borderRight: `1px solid ${ENERGY_LINE.hairlineSoft}`,
          overflow: 'auto',
        }}
      >
        <SectionLabel>{strings.dependenceTitle}</SectionLabel>
        {data.dependence.length === 0 ? (
          dependenceZone === undefined ? null : (
            <AbsenceBlock zone={dependenceZone} strings={strings} label={strings.dependenceTitle} />
          )
        ) : (
          data.dependence.map((row) => (
            <div
              key={row.scopeLabel}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '8px 0',
                borderBottom: `1px solid ${ENERGY_LINE.hairlineFaint}`,
              }}
            >
              <span style={{ width: '4px', height: '22px', background: ENERGY_TONE_HEX[row.tone], borderRadius: '1px', flex: 'none' }} />
              <span style={{ width: '76px', flex: 'none', fontSize: '13px', fontWeight: 500, color: ENERGY_INK.primary }}>
                {row.scopeLabel}
              </span>
              <span
                style={{
                  flex: 1,
                  minWidth: 0,
                  fontSize: '12px',
                  color: ENERGY_INK.quiet,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {row.source}
              </span>
              {row.sharePct === null ? (
                row.readerState === null ? null : <StateChip state={row.readerState} strings={strings} />
              ) : (
                /* A unit string is a Latin machine-readable run — §E. */
                <MachineReadable>
                  <span style={{ ...mono(11, ENERGY_INK.body) }} data-energy-unit="ene:PCT">
                    {row.sharePct}%
                  </span>
                </MachineReadable>
              )}
              {/*
                THE NOTE YIELDS BEFORE THE FIGURE DOES. With the locator mounted
                the dependence column is narrower than the frozen desktop board
                assumed, and a fixed-width note clipped mid-word. The share and
                the absence chip keep their space; the note ellipsizes, which is
                the same yielding rule the substrate title already follows.
              */}
              <span
                style={{
                  flex: '0 1 196px',
                  minWidth: 0,
                  textAlign: 'right',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  ...mono(undefined, ENERGY_INK.meta),
                }}
                title={row.note}
              >
                {row.note}
              </span>
            </div>
          ))
        )}
      </div>

      <div
        style={{
          width: '290px',
          flex: 'none',
          borderRight: `1px solid ${ENERGY_LINE.hairlineSoft}`,
          padding: '14px 18px',
          display: 'flex',
          flexDirection: 'column',
          gap: '9px',
          overflow: 'auto',
        }}
      >
        <SectionLabel>{strings.storageTitle}</SectionLabel>
        {data.storage.length === 0 ? (
          storageZone === undefined ? null : <AbsenceBlock zone={storageZone} strings={strings} label={strings.storageTitle} />
        ) : (
          data.storage.map((row) => (
            <div key={row.scopeLabel} style={{ display: 'flex', flexDirection: 'column', gap: '4px', paddingBottom: '5px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: ENERGY_INK.body }}>
                <span>{row.scopeLabel}</span>
                {row.levelPct === null ? (
                  row.readerState === null ? null : <StateChip state={row.readerState} strings={strings} />
                ) : (
                  <MachineReadable>
                    <span style={mono(11, ENERGY_INK.body)} data-energy-unit="ene:PCT">
                      {row.levelPct}%
                    </span>
                  </MachineReadable>
                )}
              </div>
              <div style={{ height: '5px', background: 'rgba(141,162,184,.14)', borderRadius: '1px', overflow: 'hidden' }}>
                <div
                  style={{
                    height: '5px',
                    width: row.levelPct === null ? '0%' : `${row.levelPct}%`,
                    background: ENERGY_TONE_HEX[row.tone],
                  }}
                />
              </div>
              <Meta>{row.meta}</Meta>
            </div>
          ))
        )}
      </div>

      {locator === undefined ? null : (
        <div style={{ width: '320px', flex: 'none', position: 'relative', borderLeft: `1px solid ${ENERGY_LINE.hairlineSoft}` }}>
          {locator}
          <span style={{ position: 'absolute', top: '10px', left: '12px', ...mono(undefined, ENERGY_INK.quiet), letterSpacing: '.16em', textShadow: '0 1px 6px #000' }}>
            {strings.locatorTitle}
          </span>
          <span style={{ position: 'absolute', bottom: '10px', left: '12px', right: '12px', ...mono(undefined, ENERGY_INK.meta), textShadow: '0 1px 6px #000' }}>
            {strings.locatorOrientationOnly}
          </span>
        </div>
      )}
    </div>
  );
}
