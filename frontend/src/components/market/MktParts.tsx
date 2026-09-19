'use client';

/**
 * PART VII · MARKET — THE SHARED PRIMITIVES.
 *
 * These were defined inside `MarketScreen.tsx` when that file was the only composition.
 * A second, genuinely different composition now exists for the phone, and two copies of a
 * machine-readable-value wrapper is exactly how one of them quietly stops isolating bidi
 * or stops defeating a text transform. One definition, two compositions.
 */
import type { JSX, ReactNode } from 'react';
import { MKT_HEADING, MKT_INK, MKT_LICENSED, MKT_LINE, MKT_SURFACE, MKT_TYPE, mktTracking } from '@/lib/market/mktTokens';
import { MachineReadable } from '@/lib/typography/runBoundary';

export const micro = {
  fontFamily: "var(--ar-family, 'IBM Plex Mono', monospace)",
  fontSize: MKT_TYPE.monoMeta, letterSpacing: mktTracking(0.09),
  textTransform: 'uppercase' as const, color: MKT_INK.label,
};

export const edge = `1px solid ${MKT_LINE.structure}`;

/**
 * A CONTRACT IDENTIFIER, RENDERED AS ITSELF.
 *
 * TWO THINGS GO WRONG WITHOUT THIS, AND ONE OF THEM SHIPPED. The `micro` ramp carries
 * `text-transform: uppercase`, which is right for a display label and WRONG for a value a
 * reader is meant to copy: it rendered `CHANGE_STATES_NOT_DERIVABLE.length` as `….LENGTH`
 * and `= false` as `= FALSE`. Neither symbol exists. The rule is "machine-readable value",
 * not "uppercase" — and the design draws display labels in uppercase too, so the two are
 * told apart by reading the contract, never by type case.
 *
 * The second is bidi: under Arabic an unisolated Latin identifier reorders its own
 * punctuation and digits. `MachineReadable` is the shared boundary for that and is used
 * rather than re-implemented; this wrapper only stops the cosmetic transform reaching it.
 */
export function Identifier({ children }: { children: ReactNode }): JSX.Element {
  return (
    <span style={{ textTransform: 'none', letterSpacing: mktTracking(0.02) }}>
      <MachineReadable>{children}</MachineReadable>
    </span>
  );
}

/**
 * A section heading. The marker is the product's own treatment — a small cyan dot beside
 * a cyan mono label — not bold white text. Bold white was the Humanitarian finding, and
 * the same correction applies here: a heading earns presence from a restrained accent and
 * a weight step, not from being the brightest thing on the page.
 *
 * TWO LEVELS, AND ONLY TWO. A third weight/colour/tracking combination appeared on one
 * section — 'Change-state ceiling' at w500 between the two rungs — which reads as a third
 * kind of thing rather than as either. `level` is the whole vocabulary.
 */
export function Heading({ children, note, level = 'primary' }: {
  children: ReactNode; note?: string; level?: 'primary' | 'secondary';
}): JSX.Element {
  const p = level === 'primary';
  const ink = p ? MKT_HEADING.primaryInk : MKT_HEADING.secondaryInk;
  return (
    <div data-mkt="section-title" data-mkt-level={level}
      style={{ display: 'flex', gap: '9px', alignItems: 'baseline', flexWrap: 'wrap', paddingBlockEnd: '2px' }}>
      <span aria-hidden="true" style={{
        width: `${MKT_HEADING.markerPx}px`, height: `${MKT_HEADING.markerPx}px`, borderRadius: '50%',
        background: ink, flex: '0 0 auto', alignSelf: 'center', opacity: p ? 1 : 0.55,
        boxShadow: p ? `0 0 8px ${ink}66` : 'none',
      }} />
      <span style={{ ...micro, color: ink, fontWeight: p ? 600 : 500,
        letterSpacing: mktTracking(p ? 0.12 : 0.09) }}>{children}</span>
      {note !== undefined && (
        <span style={{ ...micro, color: MKT_HEADING.noteInk, letterSpacing: mktTracking(0.06) }}>{note}</span>
      )}
    </div>
  );
}

/** The verdict pill. Mint only when something is genuinely ready; nothing is, today. */
export function Verdict({ ready, children }: { ready: boolean; children: ReactNode }): JSX.Element {
  return (
    <span data-mkt="verdict" data-mkt-ready={String(ready)} style={{
      ...micro, whiteSpace: 'nowrap', padding: '3px 8px',
      border: `1px solid ${ready ? MKT_LICENSED.mint : MKT_LINE.border}`,
      color: ready ? MKT_LICENSED.mint : MKT_INK.tertiary,
      background: ready ? 'transparent' : MKT_SURFACE.chip,
    }}>{children}</span>
  );
}
