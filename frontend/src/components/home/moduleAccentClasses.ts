import type { IntelligenceModuleAccent } from '@/lib/intelligenceModules';

/**
 * Master Frontend Recomposition, Checkpoint 1 — a restrained accent
 * system, not a new design-token framework. Reuses plain Tailwind
 * palette classes (the same technique M50's CoverageMetrics.tsx
 * already established for status badges: `QUALITY_BADGE_STYLES`) for
 * the per-module accent only — the surrounding structure (background,
 * border, text) continues to use the core void/surface/ink/border
 * tokens everywhere else in the product. This keeps the accent
 * palette genuinely restrained (9 small, controlled entries) rather
 * than inventing a parallel color system.
 */
export interface AccentClasses {
  border: string;
  text: string;
  glow: string;
  dot: string;
}

export const MODULE_ACCENT_CLASSES: Record<IntelligenceModuleAccent, AccentClasses> = {
  amber: { border: 'border-amber-500/40', text: 'text-amber-300', glow: 'shadow-amber-500/10', dot: 'bg-amber-400' },
  emerald: { border: 'border-emerald-500/40', text: 'text-emerald-300', glow: 'shadow-emerald-500/10', dot: 'bg-emerald-400' },
  blue: { border: 'border-blue-500/40', text: 'text-blue-300', glow: 'shadow-blue-500/10', dot: 'bg-blue-400' },
  violet: { border: 'border-violet-500/40', text: 'text-violet-300', glow: 'shadow-violet-500/10', dot: 'bg-violet-400' },
  cyan: { border: 'border-cyan-500/40', text: 'text-cyan-300', glow: 'shadow-cyan-500/10', dot: 'bg-cyan-400' },
  red: { border: 'border-red-500/40', text: 'text-red-300', glow: 'shadow-red-500/10', dot: 'bg-red-400' },
  purple: { border: 'border-purple-500/40', text: 'text-purple-300', glow: 'shadow-purple-500/10', dot: 'bg-purple-400' },
  magenta: { border: 'border-fuchsia-500/40', text: 'text-fuchsia-300', glow: 'shadow-fuchsia-500/10', dot: 'bg-fuchsia-400' },
  orange: { border: 'border-orange-500/40', text: 'text-orange-300', glow: 'shadow-orange-500/10', dot: 'bg-orange-400' },
  lime: { border: 'border-lime-500/40', text: 'text-lime-300', glow: 'shadow-lime-500/10', dot: 'bg-lime-400' },
};

/** Real hex values for the same 10 accents — needed anywhere a Tailwind class string can't be used directly, such as an SVG `stroke`/`fill` attribute (e.g. the Intelligence Engine's colored connector lines). Kept in exact sync with MODULE_ACCENT_CLASSES above — same palette, different representation for a different rendering context, not a second color system. */
export const MODULE_ACCENT_HEX: Record<IntelligenceModuleAccent, string> = {
  amber: '#fbbf24',
  emerald: '#34d399',
  blue: '#60a5fa',
  violet: '#a78bfa',
  cyan: '#22d3ee',
  red: '#f87171',
  purple: '#c084fc',
  magenta: '#e879f9',
  orange: '#fb923c',
  lime: '#a3e635',
};
