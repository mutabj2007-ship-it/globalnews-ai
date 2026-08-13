'use client';

import { useState } from 'react';
import type { LanguageCode } from '@globalnews-ai/shared';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { INTELLIGENCE_MODULES } from '@/lib/intelligenceModules';
import { IntelligenceModuleCard } from '@/components/home/IntelligenceModuleCard';
import { MODULE_ACCENT_HEX } from '@/components/home/moduleAccentClasses';

interface IntelligenceEngineInteractiveProps {
  language?: LanguageCode;
}

/**
 * CTO explicit authorization — a narrowly-scoped client component
 * owning ONLY the connector hover/focus interaction, per the exact
 * suggested architecture:
 *
 *   IntelligenceModulesDesktop (server shell: section chrome, heading)
 *     -> IntelligenceEngineInteractive ('use client', local state only)
 *          -> hub, connector SVG, module cards
 *
 * `hoveredModuleId` is the ONLY state here — no global state, no new
 * dependency, no animation library, no frame loop. Fires on
 * mouseenter/mouseleave AND focus/blur (never hover-only, per the
 * explicit keyboard-accessibility requirement) via
 * IntelligenceModuleCard's own onHoverChange prop. When a card is
 * hovered/focused: its connector path brightens (opacity/stroke-width
 * via a plain CSS class swap), its terminus node brightens, and the
 * card itself gets a slightly stronger shadow (via
 * IntelligenceModuleCard's `isEmphasized` prop) — all CSS
 * transitions, zero requestAnimationFrame, zero scroll listeners.
 *
 * This file does NOT client-render the homepage — page.tsx, the
 * section shell, and every other homepage section remain untouched
 * Server Components. Only this specific hub+connector+cards surface
 * needed interactivity, so only this surface became a client
 * boundary.
 */
export function IntelligenceEngineInteractive({ language = 'en' }: IntelligenceEngineInteractiveProps): JSX.Element {
  const t = getDictionary(language).intelligenceModules;
  const [hoveredModuleId, setHoveredModuleId] = useState<string | null>(null);

  return (
    <>
      {/* Central engine hub + colored connectors down to the band. */}
      <div className="relative mx-auto mb-1 flex flex-col items-center">
        <style>
          {`
            @keyframes gna-hub-ring { 0%, 100% { opacity: 0.55; } 50% { opacity: 0.15; } }
            @keyframes gna-hub-core-pulse { 0%, 100% { box-shadow: 0 0 30px -4px rgba(34,211,238,0.5); } 50% { box-shadow: 0 0 45px -4px rgba(34,211,238,0.8); } }
            .gna-hub-ring-a { animation: gna-hub-ring 4.5s ease-in-out infinite; }
            .gna-hub-ring-b { animation: gna-hub-ring 4.5s ease-in-out infinite 1.2s; }
            .gna-hub-core { animation: gna-hub-core-pulse 3.6s ease-in-out infinite; }
            @media (prefers-reduced-motion: reduce) {
              .gna-hub-ring-a, .gna-hub-ring-b, .gna-hub-core { animation: none !important; opacity: 0.4 !important; box-shadow: 0 0 30px -4px rgba(34,211,238,0.5) !important; }
            }
          `}
        </style>

        <div className="relative flex h-44 w-44 items-center justify-center rounded-full">
          <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full" aria-hidden="true">
            <circle cx="50" cy="50" r="49" fill="none" stroke="#22d3ee" strokeWidth="0.5" strokeDasharray="4 3" opacity="0.35" />
          </svg>
          <div className="gna-hub-ring-a absolute inset-2 rounded-full border border-cyan-400/40" />
          <div className="gna-hub-ring-b absolute inset-4 rounded-full border border-cyan-400/25" />
          <div className="absolute inset-7 rounded-full bg-cyan-500/10 blur-lg" />
          {[0, 90, 180, 270].map((angle) => (
            <span
              key={angle}
              aria-hidden="true"
              className="absolute h-1.5 w-1.5 rounded-full bg-cyan-400"
              style={{
                top: `${50 - 49 * Math.cos((angle * Math.PI) / 180)}%`,
                left: `${50 + 49 * Math.sin((angle * Math.PI) / 180)}%`,
                transform: 'translate(-50%, -50%)',
              }}
            />
          ))}
          <div className="gna-hub-core relative flex h-20 w-20 flex-col items-center justify-center rounded-full border border-cyan-400/70 bg-surface text-center">
            <span className="px-2 font-display text-[9px] font-semibold uppercase leading-tight tracking-wide text-cyan-300">
              {t.hubLabel}
            </span>
          </div>
        </div>

        {/* Connector traces — brighten on hover/focus of the corresponding module card, driven by hoveredModuleId. */}
        <svg aria-hidden="true" viewBox="0 0 100 24" preserveAspectRatio="none" className="h-4 w-full max-w-3xl">
          {INTELLIGENCE_MODULES.map((module, index) => {
            const x = (100 / (INTELLIGENCE_MODULES.length + 1)) * (index + 1);
            const color = MODULE_ACCENT_HEX[module.accent];
            const active = hoveredModuleId === module.id;
            return (
              <g key={module.id} className="transition-opacity duration-200">
                <path
                  d={`M 50 0 L 50 10 L ${x} 10 L ${x} 24`}
                  fill="none"
                  stroke={color}
                  strokeWidth={active ? '0.9' : '0.4'}
                  opacity={active ? '1' : '0.5'}
                  vectorEffect="non-scaling-stroke"
                  className="transition-all duration-200"
                />
                <circle cx={x} cy="24" r={active ? '1.5' : '0.9'} fill={color} opacity={active ? '1' : '0.85'} className="transition-all duration-200" />
              </g>
            );
          })}
        </svg>
      </div>

      {/* Command-deck band: a wide row of tall HUD capability panels. */}
      <div className="grid grid-cols-3 gap-3 md:grid-cols-5 2xl:grid-cols-9">
        {INTELLIGENCE_MODULES.map((module) => (
          <IntelligenceModuleCard
            key={module.id}
            module={module}
            language={language}
            tall
            onHoverChange={setHoveredModuleId}
            isEmphasized={hoveredModuleId === module.id}
          />
        ))}
      </div>
    </>
  );
}
