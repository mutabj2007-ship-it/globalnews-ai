'use client';

import { HUD_LINE_PX, renderableSlots, type HudLine } from '@/lib/specialist/hudGrammar';

/**
 * THE SPECIALIST HUD LINE — seven ordered slots, one 30px line. Addendum §02.
 *
 * The order is frozen product-wide so the eye learns POSITION rather than
 * label. This component maps over `HUD_SLOTS` and therefore cannot render an
 * eighth slot or a second line — both are on §21's do-not-build list, and both
 * are unrepresentable here rather than merely forbidden by a comment.
 *
 * ── IT COSTS NO CHROME ────────────────────────────────────────────────────
 *
 * §02: the line "IS DRAWN INSIDE THE MAP CANVAS ON DESKTOP AND INSIDE THE PEEK
 * DETENT ON COMPACT, SO IT ADDS NO CHROME HEIGHT ON EITHER." The compact budget
 * — 52px top bar + 30px change strip = 82px HARD MAX — is already fully spent,
 * so a line that added height would have to take it from the map. This one is
 * positioned by its host, absolutely over the canvas or inside the peek sheet.
 *
 * ── AND IT IS A READOUT ───────────────────────────────────────────────────
 *
 * `pointer-events-none`. It sits over the map on desktop, and a transparent
 * strip that swallowed a drag is the PO-3 defect returning by another route —
 * the same reason the change strip carries no pointer events.
 */

export interface SpecialistHudLineProps {
  readonly line: HudLine;
  readonly domain: string;
  readonly className?: string;
}

/* C·4's hierarchy, expressed once. PRIMARY is the only full-strength amber. */
const AMBER: Readonly<Record<'PRIMARY' | 'SECONDARY' | 'TERTIARY', string>> = {
  PRIMARY: 'text-[#F2A93C]',
  SECONDARY: 'text-[rgba(242,169,60,.62)]',
  TERTIARY: 'text-[rgba(242,169,60,.38)]',
};

export function SpecialistHudLine({ line, domain, className = '' }: SpecialistHudLineProps): JSX.Element | null {
  const slots = renderableSlots(line);

  /* A domain with nothing to say gets no line, not an empty bar. */
  if (slots.length === 0) return null;

  return (
    <div
      data-gn="specialist-hud"
      data-gn-domain={domain}
      data-gn-slots={slots.length}
      style={{ height: `${HUD_LINE_PX}px` }}
      className={
        'pointer-events-none flex items-center gap-[14px] overflow-hidden whitespace-nowrap px-[10px] ' +
        'font-gn-mono text-[9.5px] uppercase tracking-[0.14em] text-sp-ink-2 ' +
        className
      }
    >
      {slots.map(([slot, value]) => (
        <span key={slot} data-gn="hud-slot" data-gn-hud-slot={slot} className="flex items-baseline gap-[4px]">
          <span className={value.amber ? AMBER[value.amber] : 'text-sp-ink'}>{value.value}</span>
          {value.qualifier && <span className="text-sp-ink-3">{value.qualifier}</span>}
        </span>
      ))}
    </div>
  );
}
