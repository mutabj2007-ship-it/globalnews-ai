'use client';

import { useState } from 'react';
import type { LanguageCode } from '@globalnews-ai/shared';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { INTELLIGENCE_MODULES } from '@/lib/intelligenceModules';
import { IntelligenceModuleCard } from '@/components/home/IntelligenceModuleCard';
import { MODULE_ACCENT_HEX } from '@/components/home/moduleAccentClasses';

interface IntelligenceModulesMobileProps {
  language?: LanguageCode;
}

/**
 * M60 Phase 2 correction — same rejection as desktop: the prior
 * mobile version fanned orthogonal elbow connectors from the hub down
 * into a 2-column grid. Replaced with the SAME vector-based true-radial
 * approach as desktop (see IntelligenceEngineInteractive.tsx's own
 * doc comment for the full reasoning), compressed for a narrow
 * viewport: fewer, larger slot gaps, an asymmetric staggered topology
 * rather than the desktop's full two-sided spread, and a smaller but
 * still visually dominant hub. Central engine identity (rings, pulse,
 * glow, reduced-motion override) is reused verbatim from desktop's
 * own hub styling, scaled down.
 */

interface ModuleSlot {
  id: string;
  x: number;
  y: number;
}

// Compressed, asymmetric topology for a narrow viewport — staggered
// left/right pairs at three vertical tiers plus one bottom-center
// slot, rather than desktop's full 4-and-4 spread. Order matches
// INTELLIGENCE_MODULES: 0-1 top pair, 2-3 upper-mid pair, 4-5
// lower-mid pair, 6-7 bottom pair, 8 -> bottom-center.
const SLOT_OFFSETS: Array<Omit<ModuleSlot, 'id'>> = [
  { x: 22, y: 9 }, // module 0 — upper-left
  { x: 78, y: 14 }, // module 1 — upper-right (staggered, not mirrored exactly)
  { x: 18, y: 29 }, // module 2 — mid-left
  { x: 82, y: 34 }, // module 3 — mid-right (staggered)
  { x: 18, y: 49 }, // module 4 — lower-mid-left
  { x: 82, y: 53 }, // module 5 — lower-mid-right (staggered)
  { x: 22, y: 69 }, // module 6 — lower-left
  { x: 78, y: 72 }, // module 7 — lower-right (staggered)
];

const BOTTOM_SLOT: Omit<ModuleSlot, 'id'> = { x: 50, y: 91 };

const HUB_CENTER = { x: 50, y: 46 };
const HUB_EDGE_RADIUS = 17;

function buildSlots(): ModuleSlot[] {
  const main = INTELLIGENCE_MODULES.slice(0, 8).map((moduleItem, index) => ({ id: moduleItem.id, ...SLOT_OFFSETS[index] }));
  const bottom = INTELLIGENCE_MODULES[8] ? [{ id: INTELLIGENCE_MODULES[8].id, ...BOTTOM_SLOT }] : [];
  return [...main, ...bottom];
}

const MODULE_SLOTS = buildSlots();

/** Identical vector-arithmetic approach as desktop — pure math on fixed constants, no DOM measurement. */
function hubEdgePointToward(target: { x: number; y: number }): { x: number; y: number } {
  const dx = target.x - HUB_CENTER.x;
  const dy = target.y - HUB_CENTER.y;
  const length = Math.sqrt(dx * dx + dy * dy) || 1;
  return {
    x: HUB_CENTER.x + (dx / length) * HUB_EDGE_RADIUS,
    y: HUB_CENTER.y + (dy / length) * HUB_EDGE_RADIUS,
  };
}

export function IntelligenceModulesMobile({ language = 'en' }: IntelligenceModulesMobileProps): JSX.Element {
  const t = getDictionary(language).intelligenceModules;
  const [activeModuleId, setActiveModuleId] = useState<string | null>(null);

  return (
    <section
      id="intelligence-modules"
      className="border-b border-border bg-void lg:hidden"
      aria-labelledby="intelligence-modules-mobile-heading"
    >
      <div className="px-4 py-10 sm:px-6">
        <div className="mb-5">
          <span className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-cyan-400">
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
            {t.eyebrow}
          </span>
          <h2
            id="intelligence-modules-mobile-heading"
            className="mt-1 font-display text-xl font-medium text-ink-primary"
          >
            {t.heading}
          </h2>
        </div>

        <style>
          {`
            @keyframes gna-hub-ring-m { 0%, 100% { opacity: 0.55; } 50% { opacity: 0.15; } }
            @keyframes gna-hub-core-pulse-m { 0%, 100% { box-shadow: 0 0 26px -4px rgba(34,211,238,0.55); } 50% { box-shadow: 0 0 40px -4px rgba(34,211,238,0.85); } }
            .gna-hub-ring-m-a { animation: gna-hub-ring-m 4.5s ease-in-out infinite; }
            .gna-hub-ring-m-b { animation: gna-hub-ring-m 4.5s ease-in-out infinite 1.2s; }
            .gna-hub-core-m { animation: gna-hub-core-pulse-m 3.6s ease-in-out infinite; }
            @media (prefers-reduced-motion: reduce) {
              .gna-hub-ring-m-a, .gna-hub-ring-m-b, .gna-hub-core-m { animation: none !important; opacity: 0.4 !important; box-shadow: 0 0 26px -4px rgba(34,211,238,0.55) !important; }
            }
          `}
        </style>

        <div className="relative mx-auto aspect-[3/4] w-full max-w-sm">
          <svg
            aria-hidden="true"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            className="pointer-events-none absolute inset-0 h-full w-full"
          >
            {MODULE_SLOTS.map((slot) => {
              const moduleItem = INTELLIGENCE_MODULES.find((m) => m.id === slot.id);
              const color = MODULE_ACCENT_HEX[moduleItem?.accent ?? 'cyan'];
              const active = activeModuleId === slot.id;
              const edge = hubEdgePointToward(slot);
              return (
                <g key={slot.id} className="transition-opacity duration-200">
                  <line
                    x1={edge.x}
                    y1={edge.y}
                    x2={slot.x}
                    y2={slot.y}
                    stroke={color}
                    strokeWidth={active ? '0.8' : '0.4'}
                    opacity={active ? '1' : '0.5'}
                    vectorEffect="non-scaling-stroke"
                    className="transition-all duration-200"
                  />
                </g>
              );
            })}
          </svg>

          {/* Central engine hub — same visual identity as desktop, scaled for mobile. */}
          <div
            className="absolute flex items-center justify-center rounded-full"
            style={{ left: `${HUB_CENTER.x}%`, top: `${HUB_CENTER.y}%`, width: '34%', aspectRatio: '1', transform: 'translate(-50%, -50%)' }}
          >
            <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full" aria-hidden="true">
              <circle cx="50" cy="50" r="49" fill="none" stroke="#22d3ee" strokeWidth="0.6" strokeDasharray="4 3" opacity="0.35" />
            </svg>
            <div className="gna-hub-ring-m-a absolute inset-1.5 rounded-full border border-cyan-400/40" />
            <div className="gna-hub-ring-m-b absolute inset-3 rounded-full border border-cyan-400/25" />
            <div className="absolute inset-5 rounded-full bg-cyan-500/10 blur-lg" />
            <div className="gna-hub-core-m relative flex h-[64%] w-[64%] flex-col items-center justify-center rounded-full border border-cyan-400/70 bg-surface text-center">
              <span className="px-1.5 font-display text-[8px] font-semibold uppercase leading-tight tracking-wide text-cyan-300">
                {t.hubLabel}
              </span>
            </div>
          </div>

          {/* Module cards — absolutely positioned at their fixed slot. */}
          {MODULE_SLOTS.map((slot) => {
            const moduleItem = INTELLIGENCE_MODULES.find((m) => m.id === slot.id);
            if (!moduleItem) return null;
            return (
              <div
                key={slot.id}
                className="absolute w-28"
                style={{ left: `${slot.x}%`, top: `${slot.y}%`, transform: 'translate(-50%, -50%)' }}
              >
                <IntelligenceModuleCard
                  module={moduleItem}
                  language={language}
                  onHoverChange={setActiveModuleId}
                  isEmphasized={activeModuleId === moduleItem.id}
                />
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
