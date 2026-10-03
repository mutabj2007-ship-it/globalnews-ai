import type { ReactNode } from 'react';
import { ThemeScope } from '@/components/platform/ThemeControl';
import type { ThemePreference } from '@/lib/theme/theme';

/**
 * TRUST & CONVERSATIONAL EXPERIENCE R1 — the theme scope for the scrolling Standalone surfaces
 * (Recent, Saved, Settings, Help). Unlike AskThemedPage it is NOT the fixed viewport-high Ask
 * column: these pages scroll, so the scope is a full-height block that paints the surface colour
 * (dark = the body's accepted void, light = the --gt page token). The AskNavShell inside it reads
 * the scope's preference from context and offers the same Light / Dark / System / Scheduled switch.
 */
export function AskThemedSurface({
  theme,
  children,
}: {
  readonly theme: ThemePreference;
  readonly children: ReactNode;
}): JSX.Element {
  return (
    <ThemeScope
      initial={theme}
      data-ask-standalone=""
      data-ask-surface=""
      className="min-h-screen"
      style={{ background: 'var(--ask-surface-bg, #080b12)' }}
    >
      {children}
    </ThemeScope>
  );
}
