import type { JSX } from 'react';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * CLAUDE DESIGN R3 §10 — THE ANSWER ACTION GLYPHS, AS SUPPLIED
 * ════════════════════════════════════════════════════════════════════════════
 *
 * CTO DESIGN R3 COMPLETION CONTRACT, 9 Oct 2026 §1: "Use the original glyphs already supplied in
 * `AskPrototype.dc.html`. Icons retain the approved 20×20 viewBox, 1.6 stroke width and round
 * joins. You must not independently choose new colors, icons, styling, dimensions or visual
 * treatments."
 *
 * Every path below is COPIED VERBATIM from the approved package's prototype. Nothing here was
 * drawn, simplified, re-pathed or re-proportioned by this lane. The attribute set is the
 * package's own: `fill="none"` (Save excepted, see below), `stroke="currentColor"`,
 * `stroke-width="1.6"`, round join and cap, `aria-hidden`, `focusable="false"`.
 *
 * `currentColor` is the whole colour contract here: the BUTTON owns the colour token, the glyph
 * inherits it, so Design's rest/hover/selected colours are expressed once in the stylesheet and
 * never duplicated in markup.
 *
 * SAVE is the one glyph whose `fill` carries state, exactly as the package does it
 * (`saveFill: s.saved.ans && s.signed ? 'currentColor' : 'none'`): the bookmark is outlined when
 * the answer is not saved and solid when it is. That is the approved selected/unselected
 * appearance; it is not a second treatment invented here.
 *
 * MORE is a filled glyph in the package (`fill="currentColor"`, no stroke) — three dots — so it
 * does not take the stroke attributes the other three share.
 *
 * Sources is deliberately NOT here: §10 keeps it a text control with its count chip.
 */
export type AskActionGlyphName = 'copy' | 'share' | 'save' | 'more';

const STROKE = {
  width: 20,
  height: 20,
  viewBox: '0 0 20 20',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinejoin: 'round',
  strokeLinecap: 'round',
  'aria-hidden': true,
  focusable: 'false',
} as const;

export function AskActionGlyph({
  name,
  selected = false,
}: {
  readonly name: AskActionGlyphName;
  /** Save only: the approved solid/outlined bookmark. Ignored by the other glyphs. */
  readonly selected?: boolean;
}): JSX.Element {
  if (name === 'copy') {
    return (
      <svg {...STROKE}>
        <rect x="7" y="7" width="10" height="10" rx="2" />
        <path d="M13 7V5.5A2.5 2.5 0 0 0 10.5 3h-5A2.5 2.5 0 0 0 3 5.5v5A2.5 2.5 0 0 0 5.5 13H7" />
      </svg>
    );
  }
  if (name === 'share') {
    return (
      <svg {...STROKE}>
        <path d="M10 12.5V3" />
        <path d="M6.5 6.5 10 3l3.5 3.5" />
        <path d="M4 11v3.5A2.5 2.5 0 0 0 6.5 17h7a2.5 2.5 0 0 0 2.5-2.5V11" />
      </svg>
    );
  }
  if (name === 'save') {
    /* The package omits stroke-linecap on this one and toggles `fill`. Both kept as supplied. */
    return (
      <svg
        width={20}
        height={20}
        viewBox="0 0 20 20"
        fill={selected ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinejoin="round"
        aria-hidden="true"
        focusable="false"
      >
        <path d="M5.5 3h9a.5.5 0 0 1 .5.5V17l-5-3.4L5 17V3.5a.5.5 0 0 1 .5-.5Z" />
      </svg>
    );
  }
  return (
    <svg width={20} height={20} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" focusable="false">
      <circle cx="4.5" cy="10" r="1.5" />
      <circle cx="10" cy="10" r="1.5" />
      <circle cx="15.5" cy="10" r="1.5" />
    </svg>
  );
}
