'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { ArrowUpRight } from 'lucide-react';
import type { LanguageCode } from '@globalnews-ai/shared';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { getCountryDisplayName } from '@/lib/countryDisplayName';
import type { HoveredCountry } from '@/components/map/WorldMap';
import { INTELLIGENCE_MODULES, isModuleNavigable } from '@/lib/intelligenceModules';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * C3 · THE LEGEND — FOUR MODULES, NOT FOUR MAP LAYERS
 * ════════════════════════════════════════════════════════════════════════════
 *
 * The R2 contract names the legend Energy · Conflict · Humanitarian · Economy
 * and requires that it "map to real layers, no fake dots".
 *
 * Those four are not layers and cannot be made into layers honestly. The map's
 * real vocabulary is country coverage; the governed news taxonomy is world,
 * politics, business, technology, science, health, sports and entertainment.
 * All four legend names are INTELLIGENCE MODULE ids. So each entry resolves
 * through `INTELLIGENCE_MODULES` to its real destination and its governed
 * title, gated by the same `isModuleNavigable` the nine-card Engine uses — and
 * the map draws nothing for them. No dot, no count, no severity, no shading.
 *
 * Reading them out of the registry rather than writing a table here is what
 * guarantees it: a legend entry cannot acquire a route the registry does not
 * have, and cannot keep one the registry removes.
 */
const LEGEND_MODULE_IDS = ['energy', 'conflict', 'humanitarian', 'economy'] as const;

const LEGEND_DOT: Record<string, string> = {
  energy: 'bg-amber-300',
  conflict: 'bg-red-300',
  humanitarian: 'bg-purple-300',
  economy: 'bg-emerald-300',
};

/**
 * Master Frontend Recomposition, Checkpoint 3 — the real Global
 * Situation Map, distinct from Hero's ambient decorative globe (see
 * Hero.tsx / WorldMapAnimatedVisual.tsx). This is a genuine
 * geographic product surface: real world geometry, a real country
 * selection interaction, and real computed coverage data — not
 * decoration.
 *
 * Reuses /map's own infrastructure directly rather than duplicating
 * it: the SAME `WorldMap` component, lazy-loaded via the SAME
 * next/dynamic({ ssr:false }) pattern MapPageClient.tsx already
 * established (confirmed by direct inspection before writing this
 * file), so MapLibre is never part of the initial homepage/Hero
 * bundle — it loads only once this section's client boundary
 * actually mounts.
 *
 * Data truth: this section performs ZERO provider-capable country reads,
 * both on page load AND on country selection. `countryStoryCounts` starts
 * empty and selection changes geographic scope only. The full Map owns the
 * explicit retrieval action, so merely exploring geography on Home cannot
 * spend GNews quota. No alert/risk/severity/story metrics are fabricated here.
 */
const WorldMap = dynamic(() => import('@/components/map/WorldMap').then((m) => m.WorldMap), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse rounded-xl bg-surface" />,
});

interface HomepageSituationMapProps {
  /**
   * ── Z5 · THE RAIL VARIANT ────────────────────────────────────────────
   *
   * The Product Owner's desktop prototype puts this card in the right column
   * beside the story rail, at roughly 368px. The released presentation is a
   * full-width section: a heading block, then a `2.7fr / 1fr` grid whose
   * second track is a text panel. At rail width that second track collapses to
   * about 90px and breaks one word per line, the legend spills its row, and
   * the card overflows its column — measured, not predicted.
   *
   * So the card gets a second presentation rather than a mangled first one.
   * `variant="rail"` drops the section heading and the side panel, keeps the
   * map itself and the four-entry legend the ruling requires kept visible, and
   * moves "Open full map" onto the card header where the prototype draws its
   * external-link glyph.
   *
   * NOTHING ABOUT THE MAP'S BEHAVIOUR CHANGES IN EITHER VARIANT. Same
   * `WorldMap`, same `next/dynamic({ ssr: false })`, same selection handling,
   * and the same zero provider-capable reads on mount and on selection.
   */
  language?: LanguageCode;
  variant?: 'section' | 'rail';
}

export function HomepageSituationMap({
  language = 'en',
  variant = 'section',
}: HomepageSituationMapProps): JSX.Element {
  const t = getDictionary(language).situationMap;
  const [countryStoryCounts] = useState<Record<string, number>>({});
  const [, setHovered] = useState<HoveredCountry | null>(null);
  const [selectedIso3, setSelectedIso3] = useState<string | null>(null);
  const [selectedName, setSelectedName] = useState<{ iso2: string; name: string } | null>(null);

  function handleSelectCountry(feature: {
    properties: { country?: { iso3: string; iso2: string; name: string } };
  }): void {
    const country = feature.properties.country;
    if (!country) return;
    setSelectedIso3(country.iso3);
    setSelectedName({ iso2: country.iso2, name: country.name });
  }

  const displayName = selectedName ? getCountryDisplayName(selectedName.iso2, language, selectedName.name) : null;

  /* Z5 — see the variant note on the props interface. */
  const isRail = variant === 'rail';

  return (
    /* C3 — it now sits INSIDE PageCanvas, which already supplies the page
       column and its side padding. The former full-width wrapper (its own
       max-width, its own gutters and a bottom rule) would have double-padded
       the card and drawn a rule across the middle of the page. */
    <section className="scroll-mt-24" aria-labelledby="situation-map-heading">
      {/*
        §8 — IN THE RAIL THIS IS ONE CARD, not a stack of boxes.

        The prototype draws a single panel: title, map, legend, one clean edge.
        The released section draws three separately-bordered blocks, which is
        right at full width and reads as clutter at 308px. So the rail variant
        puts the border on the OUTER element and lets the map and the legend sit
        inside it, separated by a rule rather than by two more borders.
      */}
      <div className={isRail ? 'rounded-2xl border border-border-strong bg-void/60 p-3' : undefined}>
        <div className={`${isRail ? 'mb-3' : 'mb-5'} flex flex-wrap items-end justify-between gap-3`}>
          <div>
            {isRail ? (
              /* The rail header is the prototype's: the card's name and its
                 open-in-new glyph on one line. The section eyebrow, display
                 heading and description belong to the full-width presentation
                 and would outweigh the map at 368px. */
              <div className="flex w-full items-center justify-between gap-2">
                <h2 id="situation-map-heading" className="font-display text-base font-semibold text-ink-primary">
                  {t.heading}
                </h2>
                <a
                  href="/map"
                  aria-label={t.openFullMap}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border-strong text-ink-secondary transition-colors hover:border-cyan-400/50 hover:text-cyan-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50 motion-reduce:transition-none"
                >
                  <ArrowUpRight size={15} strokeWidth={2} aria-hidden="true" />
                </a>
              </div>
            ) : (
              <>
                <span className="font-mono text-xs uppercase tracking-widest text-cyan-400">{t.eyebrow}</span>
                <h2 id="situation-map-heading" className="mt-1 font-display text-2xl font-medium text-ink-primary sm:text-3xl">
                  {t.heading}
                </h2>
                <p className="mt-2 max-w-lg text-sm leading-relaxed text-ink-secondary">{t.description}</p>
              </>
            )}
          </div>
        </div>

        <div className={`grid grid-cols-1 gap-3 ${isRail ? '' : 'lg:grid-cols-[2.7fr_1fr]'}`}>
          <div
            /*
              §8 — `[&_.maplibregl-ctrl-top-right]:hidden` in the rail variant
              removes MapLibre's own zoom cluster from the card. It is a
              presentational scope on THIS container, not a change to WorldMap
              or to the shared MapLibre setup: the same component in the
              full-width section keeps its controls exactly as before. The card
              keeps one clear affordance — "Open full map" in its header — which
              is what the prototype draws.
            */
            className={`relative overflow-hidden rounded-xl border bg-void transition-all duration-500 ${isRail ? 'h-[188px] [&_.maplibregl-ctrl-bottom-left]:hidden [&_.maplibregl-ctrl-bottom-right]:hidden [&_.maplibregl-ctrl-top-right]:hidden' : 'h-[360px] sm:h-[440px]'} ${
              selectedIso3
                ? 'border-cyan-400/60 shadow-[0_0_70px_-8px_rgba(34,211,238,0.45)]'
                : 'border-cyan-500/30 shadow-[0_0_50px_-10px_rgba(34,211,238,0.3)]'
            }`}
            role="application"
            aria-label={t.heading}
          >
            <WorldMap
              countryStoryCounts={countryStoryCounts}
              selectedIso3={selectedIso3}
              onHoverCountry={setHovered}
              onSelectCountry={handleSelectCountry}
              language={language}
            />

            {/* Scan/grid overlay — CTO review: "stronger cyan geographic outline treatment... subtle technical grid/scan overlay." Sits above the real MapLibre canvas but pointer-events-none throughout, so real map interaction (pan/zoom/click) is never blocked. WorldMap.tsx's own internals remain untouched, per explicit instruction not to risk shared MapLibre code. */}
            <div
              aria-hidden="true"
              className={`pointer-events-none absolute inset-0 ${isRail ? 'opacity-[0.07]' : 'opacity-[0.15]'}`}
              style={{
                backgroundImage:
                  'linear-gradient(rgba(34,211,238,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(34,211,238,0.5) 1px, transparent 1px)',
                backgroundSize: '32px 32px',
              }}
            />
            <div className="pointer-events-none absolute inset-0 rounded-2xl shadow-[inset_0_0_60px_-10px_rgba(34,211,238,0.25)]" aria-hidden="true" />

            {/*
              §8 — HUD corner brackets are FULL-SECTION CHROME ONLY.

              The ruling: *"The map must be a compact right-rail card, not a
              mini analyst workstation... Remove tool-like visual noise that
              makes it look like /map embedded in Home."* Brackets read as
              instrument framing, which is right at 440px in a section of its
              own and wrong in a 308px rail card beside four story cards.
            */}
            {isRail
              ? null
              : ['left-2 top-2 border-l border-t', 'right-2 top-2 border-r border-t', 'left-2 bottom-2 border-l border-b', 'right-2 bottom-2 border-r border-b'].map((pos) => (
                  <span key={pos} aria-hidden="true" className={`pointer-events-none absolute h-4 w-4 border-cyan-400/50 ${pos}`} />
                ))}

            {/* Vignette — darkened edge falloff so the map reads as a layered intelligence surface, not a flat rectangle. */}
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_55%,rgba(2,7,13,0.55)_100%)]" aria-hidden="true" />


          </div>

          {isRail ? null : (
          <div className="relative flex flex-col overflow-hidden rounded-2xl border border-cyan-500/25 bg-surface/90 p-5 backdrop-blur-sm">
            <span aria-hidden="true" className="absolute inset-x-0 top-0 h-0.5 bg-cyan-400/60" />
            {!selectedIso3 ? (
              <div className="flex flex-1 flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <span className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-widest text-cyan-400">
                    <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full border border-cyan-400" />
                    {t.eyebrow}
                  </span>
                  <p className="text-sm text-ink-secondary">{t.noSelectionPrompt}</p>
                  <p className="text-xs text-ink-tertiary">{t.hoverPrompt}</p>
                </div>

                <dl className="flex flex-col gap-2 border-t border-cyan-500/10 pt-3 text-sm">
                  <div className="flex items-center justify-between">
                    <dt className="font-mono text-[11px] uppercase tracking-wide text-ink-tertiary">{t.countryCoverageLabel}</dt>
                    <dd className="text-xs text-ink-secondary">{t.countryCoverageValue}</dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="font-mono text-[11px] uppercase tracking-wide text-ink-tertiary">{t.mapModeLabel}</dt>
                    <dd className="inline-flex items-center gap-1.5 text-xs text-emerald-300">
                      <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                      {t.mapModeValue}
                    </dd>
                  </div>
                </dl>
              </div>
            ) : (
              <div className="flex flex-1 flex-col gap-3">
                <h3 className="font-display text-lg font-medium text-ink-primary">{displayName}</h3>
                {/* C3 — was an inline English sentence, which answered a Polish
                    reader in English the moment they selected a country. */}
                <p className="text-sm text-ink-secondary">{t.selectionScopeNote}</p>
              </div>
            )}

            {/* Open Full Map CTA — integrated into this same HUD panel frame rather than sitting in the section header, per the reference's single-context-block composition. */}
            <a
              href="/map"
              className="mt-4 inline-flex min-h-[44px] items-center justify-center gap-1.5 border-t border-cyan-500/10 pt-3 text-xs font-medium text-cyan-300 transition-colors hover:text-cyan-200"
            >
              {t.openFullMap}
              <ArrowUpRight size={13} strokeWidth={2.25} aria-hidden="true" />
            </a>
          </div>
          )}
        </div>

        <MapLegend language={language} compact={isRail} />
      </div>
    </section>
  );
}

/**
 * The four legend entries, resolved from the module registry. An entry the
 * registry cannot route is rendered as plain text rather than a dead link —
 * the same rule the nine-card Engine applies through `isModuleNavigable`.
 */
function MapLegend({
  language,
  compact = false,
}: {
  language: LanguageCode;
  compact?: boolean;
}): JSX.Element {
  const t = getDictionary(language).situationMap;
  const moduleText = getDictionary(language).intelligenceModules.modules;

  const entries = LEGEND_MODULE_IDS.map((id) =>
    INTELLIGENCE_MODULES.find((m) => m.id === id),
  ).filter((m): m is NonNullable<typeof m> => m !== undefined);

  return (
    <div className={compact ? 'mt-3 border-t border-border-strong/70 pt-3' : 'mt-4 rounded-2xl border border-border-strong bg-void/60 p-4'}>
      <h3 className="font-mono text-[11px] uppercase tracking-widest text-cyan-400">
        {t.legendTitle}
      </h3>
      <ul className={compact ? 'mt-2.5 grid grid-cols-2 gap-x-2 gap-y-1.5' : 'mt-3 flex flex-wrap items-center gap-x-5 gap-y-2'}>
        {entries.map((module) => {
          const label =
            moduleText[module.dictionaryKey as keyof typeof moduleText]?.title ?? module.id;
          const dot = (
            <span
              aria-hidden="true"
              className={`h-2.5 w-2.5 shrink-0 rounded-full ${LEGEND_DOT[module.id] ?? 'bg-ink-tertiary'}`}
            />
          );

          return (
            <li key={module.id}>
              {isModuleNavigable(module) && module.destination !== undefined ? (
                <a
                  href={module.destination}
                  className="flex min-h-[44px] items-center gap-2 text-sm text-ink-secondary transition-colors hover:text-ink-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50 motion-reduce:transition-none"
                >
                  {dot}
                  {label}
                </a>
              ) : (
                <span className="flex min-h-[44px] items-center gap-2 text-sm text-ink-tertiary">
                  {dot}
                  {label}
                </span>
              )}
            </li>
          );
        })}
      </ul>
      {compact ? null : <p className="mt-3 text-xs leading-relaxed text-ink-tertiary">{t.legendNote}</p>}
    </div>
  );
}
