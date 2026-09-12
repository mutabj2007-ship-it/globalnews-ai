'use client';

import {
  Search,
  Globe2,
  MapPinned,
  ScanSearch,
  LineChart,
  ShieldAlert,
  TrendingUp,
  History,
  Radar,
  ArrowUpRight,
} from 'lucide-react';
import type { LanguageCode } from '@globalnews-ai/shared';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { isModuleNavigable, type IntelligenceModuleConfig } from '@/lib/intelligenceModules';
import { MODULE_ACCENT_CLASSES } from '@/components/home/moduleAccentClasses';
import { HUD_CARD_CLIP } from '@/components/home/hudPanelGeometry';

const ICONS = {
  Search,
  Globe2,
  MapPinned,
  ScanSearch,
  LineChart,
  ShieldAlert,
  TrendingUp,
  History,
  Radar,
};

interface IntelligenceModuleCardProps {
  module: IntelligenceModuleConfig;
  language?: LanguageCode;
  /** CTO Frontend Visual Revision (continuation) — the desktop command-deck band uses tall, portrait-oriented panels; the mobile 2-column grid keeps the original compact aspect. Same component, one layout variant. */
  tall?: boolean;
  /** CTO connector-hover authorization — optional, defaults to no-op so IntelligenceModulesMobile (which has no connector to link) is completely unaffected. Fired on both mouse hover AND keyboard focus, never hover-only. */
  onHoverChange?: (moduleId: string | null) => void;
  /** True when this card is the one currently hovered/focused (driven by the parent's local state) — boosts border/glow slightly beyond the normal active-state styling. */
  isEmphasized?: boolean;
}

/**
 * Master Frontend Recomposition, Checkpoint 1 (composition updated
 * during the CTO Frontend Visual Revision) — ONE card component,
 * shared verbatim by both IntelligenceModulesDesktop (now a
 * horizontal command-deck band, per the explicit pivot away from the
 * earlier radial hub layout) and IntelligenceModulesMobile
 * (2-column grid). Rendering identically from the same
 * INTELLIGENCE_MODULES config in both layouts is the whole point of
 * Section 47's "good justified abstraction" — this is
 * that abstraction.
 *
 * Uses isModuleNavigable() as the SOLE gate for whether the card is a
 * real link: a preview/comingSoon module renders as a plain, inert
 * `<div>` with a visible state badge — never a clickable element that
 * goes nowhere, and never disguised as more available than it is.
 */
export function IntelligenceModuleCard({
  module,
  language = 'en',
  tall = false,
  onHoverChange,
  isEmphasized = false,
}: IntelligenceModuleCardProps): JSX.Element {
  const t = getDictionary(language).intelligenceModules;
  const moduleText = t.modules[module.dictionaryKey as keyof typeof t.modules];
  const accent = MODULE_ACCENT_CLASSES[module.accent];
  const Icon = ICONS[module.icon];
  const navigable = isModuleNavigable(module);

  const stateLabel =
    module.state === 'active'
      ? t.stateLabels.active
      : module.state === 'preview'
        ? t.stateLabels.preview
        : t.stateLabels.comingSoon;

  const content = (
    <div
      onMouseEnter={() => onHoverChange?.(module.id)}
      onMouseLeave={() => onHoverChange?.(null)}
      onFocus={() => onHoverChange?.(module.id)}
      onBlur={() => onHoverChange?.(null)}
      className={`relative flex h-full flex-col gap-2 overflow-hidden border bg-void/60 p-4 backdrop-blur-sm transition-all duration-200 ${HUD_CARD_CLIP} ${
        tall ? 'min-h-[190px]' : ''
      } ${isEmphasized ? 'shadow-lg' : ''} ${
        module.state === 'active'
          ? `${accent.border} hover:-translate-y-0.5 hover:shadow-lg ${accent.glow} focus-visible:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/50 motion-reduce:transition-none motion-reduce:hover:translate-y-0`
          : module.state === 'preview'
            ? `${accent.border} opacity-90`
            : 'border-border-strong/70 opacity-85'
      }`}
    >
      {/* Top energy rail — the ONLY large-area color cue; card body itself stays dark translucent navy/black. Active gets full accent intensity, preview a dimmer version, comingSoon a plain neutral line — establishing the CTO's explicit "moderate glow / visibly quieter / darkest" hierarchy. */}
      <span
        aria-hidden="true"
        className={`absolute inset-x-0 top-0 h-0.5 ${
          module.state === 'active' ? accent.dot : module.state === 'preview' ? `${accent.dot} opacity-50` : 'bg-border-strong/50'
        }`}
      />
      {/* Small HUD ticks at the top corners — tiny technical detail, active modules only. */}
      {module.state === 'active' && (
        <>
          <span aria-hidden="true" className={`absolute left-0 top-0.5 h-2 w-px ${accent.dot}`} />
          <span aria-hidden="true" className={`absolute right-0 top-0.5 h-2 w-px ${accent.dot}`} />
        </>
      )}

      <div className="relative flex items-center justify-between gap-2">
        <span
          aria-hidden="true"
          className={`flex h-8 w-8 items-center justify-center rounded-lg border ${
            module.state === 'active' ? accent.border : 'border-border-strong'
          } bg-void ${module.state === 'active' ? accent.text : 'text-ink-tertiary'}`}
        >
          <Icon size={18} strokeWidth={1.75} />
        </span>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide ${
            module.state === 'active' ? `${accent.border} ${accent.text}` : 'border-border-strong text-ink-tertiary'
          }`}
        >
          <span
            aria-hidden="true"
            className={`h-1.5 w-1.5 rounded-full ${module.state === 'active' ? accent.dot : 'bg-ink-tertiary'}`}
          />
          {stateLabel}
        </span>
      </div>

      <div className="relative">
        <h3 className="text-sm font-semibold text-ink-primary">{moduleText.title}</h3>
        <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-ink-tertiary">{moduleText.description}</p>
      </div>

      {navigable && (
        <span className={`relative mt-auto flex items-center gap-1 border-t border-border/50 pt-2.5 text-xs font-medium ${accent.text}`}>
          {t.openAction}
          <ArrowUpRight size={13} strokeWidth={2.25} aria-hidden="true" />
        </span>
      )}
    </div>
  );

  if (navigable && module.destination) {
    return (
      <a href={module.destination} className="block h-full" aria-label={`${moduleText.title}: ${moduleText.description}`}>
        {content}
      </a>
    );
  }

  return <div aria-label={`${moduleText.title}: ${moduleText.description}, ${stateLabel}`}>{content}</div>;
}
