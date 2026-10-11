import type { JSX } from 'react';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * ASK R3 SETTINGS-NAV ENGINEERING — THE SETTINGS / SEARCH GLYPHS, AS SUPPLIED
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Claude Design `GLOBALNEWSAI-R3-SETTINGS-NAV-ENGINEERING.zip` (SHA-256 57f5102e…7e5da5e22d),
 * `assets/*.svg`. Path data is Feather Icons (MIT, `assets/LICENSE-ICONS.txt`), except the
 * sun/moon, which Design drew. Every path below is COPIED VERBATIM from those files; the sizes
 * and stroke widths are the files' own (spec §1, §3). Same pattern as AskActionGlyph:
 * `currentColor`, so the control that holds a glyph owns its colour and states.
 *
 * - gear: 22 px, stroke 1.6 — the drawer's Settings control. Never used for Appearance.
 * - appearance: 18 px, stroke 1.8 — ONLY on the Appearance row inside Settings.
 * - search: 18 px, stroke 1.8 — mirrored in RTL by its container.
 * - clear: 16 px, stroke 2 — the search field's Clear.
 * - close: the same × path at 20 px, stroke 1.8 — the drawer and Settings Close (spec §1, §2).
 */
export type AskSettingsGlyphName = 'gear' | 'appearance' | 'search' | 'clear' | 'close';

const COMMON = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeLinecap: 'round',
  'aria-hidden': true,
  focusable: 'false',
} as const;

export function AskSettingsGlyph({
  name,
  className,
}: {
  readonly name: AskSettingsGlyphName;
  readonly className?: string;
}): JSX.Element {
  if (name === 'gear') {
    return (
      <svg {...COMMON} width={22} height={22} strokeWidth={1.6} strokeLinejoin="round" className={className} data-ask-glyph="gear">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    );
  }
  if (name === 'appearance') {
    return (
      <svg {...COMMON} width={18} height={18} strokeWidth={1.8} strokeLinejoin="round" className={className} data-ask-glyph="appearance">
        <path d="M12 3a9 9 0 1 0 0 18z" fill="currentColor" stroke="none" />
        <circle cx="12" cy="12" r="9" />
      </svg>
    );
  }
  if (name === 'search') {
    return (
      <svg {...COMMON} width={18} height={18} strokeWidth={1.8} className={className} data-ask-glyph="search">
        <circle cx="11" cy="11" r="6.5" />
        <path d="M16 16l4 4" />
      </svg>
    );
  }
  if (name === 'close') {
    return (
      <svg {...COMMON} width={20} height={20} strokeWidth={1.8} className={className} data-ask-glyph="close">
        <path d="M6 6l12 12M18 6L6 18" />
      </svg>
    );
  }
  return (
    <svg {...COMMON} width={16} height={16} strokeWidth={2} className={className} data-ask-glyph="clear">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}
