'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { ArrowUpRight } from 'lucide-react';
import type { CountryNewsResponse, LanguageCode } from '@globalnews-ai/shared';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { getCountryDisplayName } from '@/lib/countryDisplayName';
import { formatRelativeTime } from '@/lib/formatRelativeTime';
import { pluralWithForms } from '@/lib/i18n/pluralize';
import { fetchCountryNews } from '@/lib/api/countryApi';
import type { HoveredCountry } from '@/components/map/WorldMap';

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
 * Data truth: this section makes ZERO automatic fetch on page load —
 * `countryStoryCounts` starts empty (an honest "nothing loaded yet"
 * state, not fabricated zeros pretending to be real counts). A real
 * fetchCountryNews() call — the SAME function /map itself uses —
 * happens only on a genuine user action (clicking a country), and
 * only for that one country. This preserves the "one homepage fetch
 * on load" architecture: this is a user-initiated interaction fetch,
 * not a page-load fetch. The summary panel shows only values computed
 * from that real response (story count, distinct publisher count,
 * most recent timestamp, most common category) — never a fabricated
 * "alert count" or "risk score."
 */
const WorldMap = dynamic(() => import('@/components/map/WorldMap').then((m) => m.WorldMap), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse rounded-xl bg-surface" />,
});

interface HomepageSituationMapProps {
  language?: LanguageCode;
}

/** CTO Frontend Visual Revision, Section 16 — restrained, consistent per-category color for the map legend/summary. Uses only the real, existing GlobalNews AI category taxonomy (world/politics/business/technology/science/health) — no reference-mockup categories the classifier doesn't actually support. */
const CATEGORY_COLORS: Record<string, string> = {
  world: 'bg-blue-400',
  politics: 'bg-violet-400',
  business: 'bg-amber-400',
  technology: 'bg-cyan-400',
  science: 'bg-emerald-400',
  health: 'bg-rose-400',
};

function computeSummary(response: CountryNewsResponse) {
  const articles = response.articles;
  const publisherCount = new Set(articles.map((a) => a.sourceId)).size;
  const latest = articles.reduce<string | null>((latestSoFar, article) => {
    if (!latestSoFar) return article.publishedAt;
    return new Date(article.publishedAt).getTime() > new Date(latestSoFar).getTime()
      ? article.publishedAt
      : latestSoFar;
  }, null);
  const categoryCounts = new Map<string, number>();
  for (const article of articles) {
    categoryCounts.set(article.category, (categoryCounts.get(article.category) ?? 0) + 1);
  }
  const primaryCategory = [...categoryCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  return { storyCount: articles.length, publisherCount, latest, primaryCategory };
}

export function HomepageSituationMap({ language = 'en' }: HomepageSituationMapProps): JSX.Element {
  const t = getDictionary(language).situationMap;
  const categoryLabels = getDictionary(language).map.categories;
  const [countryStoryCounts] = useState<Record<string, number>>({});
  const [, setHovered] = useState<HoveredCountry | null>(null);
  const [selectedIso3, setSelectedIso3] = useState<string | null>(null);
  const [selectedName, setSelectedName] = useState<{ iso2: string; name: string } | null>(null);
  const [response, setResponse] = useState<CountryNewsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSelectCountry(feature: {
    properties: { country?: { iso3: string; iso2: string; name: string } };
  }): Promise<void> {
    const country = feature.properties.country;
    if (!country) return;

    setSelectedIso3(country.iso3);
    setSelectedName({ iso2: country.iso2, name: country.name });
    setIsLoading(true);

    try {
      const result = await fetchCountryNews(country.iso3, { limit: 8, lang: language });
      setResponse(result);
    } catch {
      setResponse(null);
    } finally {
      setIsLoading(false);
    }
  }

  const summary = response ? computeSummary(response) : null;
  const displayName = selectedName ? getCountryDisplayName(selectedName.iso2, language, selectedName.name) : null;

  return (
    <section className="border-b border-border bg-void" aria-labelledby="situation-map-heading">
      <div className="mx-auto max-w-[1480px] px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <span className="font-mono text-xs uppercase tracking-widest text-cyan-400">{t.eyebrow}</span>
            <h2 id="situation-map-heading" className="mt-1 font-display text-2xl font-medium text-ink-primary sm:text-3xl">
              {t.heading}
            </h2>
            <p className="mt-2 max-w-lg text-sm leading-relaxed text-ink-secondary">{t.description}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[2.7fr_1fr]">
          <div
            className={`relative h-[360px] overflow-hidden rounded-2xl border bg-void transition-all duration-500 sm:h-[440px] ${
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
              className="pointer-events-none absolute inset-0 opacity-[0.15]"
              style={{
                backgroundImage:
                  'linear-gradient(rgba(34,211,238,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(34,211,238,0.5) 1px, transparent 1px)',
                backgroundSize: '32px 32px',
              }}
            />
            <div className="pointer-events-none absolute inset-0 rounded-2xl shadow-[inset_0_0_60px_-10px_rgba(34,211,238,0.25)]" aria-hidden="true" />

            {/* HUD corner brackets */}
            {['left-2 top-2 border-l border-t', 'right-2 top-2 border-r border-t', 'left-2 bottom-2 border-l border-b', 'right-2 bottom-2 border-r border-b'].map((pos) => (
              <span key={pos} aria-hidden="true" className={`pointer-events-none absolute h-4 w-4 border-cyan-400/50 ${pos}`} />
            ))}

            {/* Vignette — darkened edge falloff so the map reads as a layered intelligence surface, not a flat rectangle. */}
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_55%,rgba(2,7,13,0.55)_100%)]" aria-hidden="true" />

            {/* Category legend — CTO Frontend Visual Revision, Section 16. Real taxonomy only. */}
            <div className="pointer-events-none absolute bottom-3 left-3 flex flex-wrap gap-x-3 gap-y-1 rounded-lg border border-cyan-500/25 bg-void/85 px-3 py-2 backdrop-blur-sm">
              {Object.entries(CATEGORY_COLORS).map(([category, colorClass]) => (
                <span key={category} className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-wide text-ink-tertiary">
                  <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${colorClass}`} />
                  {categoryLabels[category] ?? category}
                </span>
              ))}
            </div>
          </div>

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
            ) : isLoading ? (
              <p className="text-sm text-ink-tertiary" role="status" aria-live="polite">
                {t.loadingLabel}
              </p>
            ) : summary && summary.storyCount > 0 ? (
              <>
                <h3 className="font-display text-lg font-medium text-ink-primary">{displayName}</h3>
                <dl className="mt-3 flex flex-col gap-2 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-ink-tertiary">{pluralWithForms(summary.storyCount, language, t.storyForms)}</dt>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-ink-tertiary">
                      {pluralWithForms(summary.publisherCount, language, t.publisherForms)}
                    </dt>
                  </div>
                  {summary.latest && (
                    <div className="flex justify-between">
                      <dt className="text-ink-tertiary">{t.latestLabel}</dt>
                      <dd className="text-ink-primary">{formatRelativeTime(summary.latest, language)}</dd>
                    </div>
                  )}
                  {summary.primaryCategory && (
                    <div className="flex items-center justify-between">
                      <dt className="text-ink-tertiary">{t.primaryTopicLabel}</dt>
                      <dd className="flex items-center gap-1.5 text-ink-primary">
                        <span
                          aria-hidden="true"
                          className={`h-1.5 w-1.5 rounded-full ${CATEGORY_COLORS[summary.primaryCategory] ?? 'bg-ink-tertiary'}`}
                        />
                        {summary.primaryCategory}
                      </dd>
                    </div>
                  )}
                </dl>
              </>
            ) : (
              <p className="text-sm text-ink-secondary">{t.noCoverageLabel}</p>
            )}

            {/* Open Full Map CTA — integrated into this same HUD panel frame rather than sitting in the section header, per the reference's single-context-block composition. */}
            <a
              href="/map"
              className="mt-4 inline-flex items-center justify-center gap-1.5 border-t border-cyan-500/10 pt-3 text-xs font-medium text-cyan-300 transition-colors hover:text-cyan-200"
            >
              {t.openFullMap}
              <ArrowUpRight size={13} strokeWidth={2.25} aria-hidden="true" />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
