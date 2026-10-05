'use client';

import { useEffect, useId, useMemo, useRef, useState, type JSX } from 'react';
import dynamic from 'next/dynamic';
import { ArrowUpRight, Maximize2, Minimize2, MessagesSquare, Search, X } from 'lucide-react';
import { COUNTRIES, type CountryMeta, type LanguageCode } from '@globalnews-ai/shared';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { getCountryDisplayName } from '@/lib/countryDisplayName';
import { encodeSelection, SELECTION_QUERY_KEY } from '@/lib/map/state/mapUrl';
import { usePublishGeographyContext } from '@/lib/ask/geographyContextStore';
import { openGlobalAsk } from '@/lib/ask/openGlobalAsk';
import { VISUAL_REGIONS, type VisualRegionId } from '@/lib/visual/visualRegions';
import { fill } from '@/components/home/reva/homeRevaModel';
import type { CountryFeature } from '@/lib/map/countryGeometry';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * COMPACT VISUAL PRODUCT R1 — THE HERO GLOBAL MAP (bound to the REAL map, H0/24)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * The SAME `WorldMap` MapLibre renderer /map uses, lazy-loaded exactly as HomepageSituationMap
 * established (next/dynamic, ssr:false), so MapLibre is never in the first Home bundle. Bundled
 * world-atlas geometry joined to the shared registry by ISO numeric id — no runtime geometry
 * fetch, no tile or style server: the measured ZERO external map endpoints stay zero. The
 * Design's stand-in `global-map.js` is not used.
 *
 * DATA TRUTH (the HomepageSituationMap precedent): Home performs ZERO provider-capable country
 * reads — on load AND on selection. `countryStoryCounts` is the honest empty set, so no coverage
 * fill and no marker is drawn, and the legend says why instead of showing SAMPLE levels.
 * Selecting a country (map click, or the keyboard-operable country list — the documented
 * accessible equivalent, option (b) of design doc 05) changes the map's selection and offers two
 * REAL next steps: open that country in World Map (which owns the explicit retrieval action),
 * or put it into Ask as geography context (zero compute until the reader presses Send).
 *
 * Region buttons are CAMERA FRAMING ONLY, and each states its DECLARED meaning across layers
 * (lib/visual/visualRegions.ts, from EA-REGION-AUTHORITY-01). No region Watch is drawn: there is
 * no product-region Watch path, and the unavailable state is said, not implied.
 * Greenland is a registry place and selectable through the registry; Western Sahara, Kosovo,
 * Antarctica and the Falklands have geometry and no registry identity, so they stay unselectable
 * and unnamed — exactly as WorldMap already treats them.
 */
const WorldMap = dynamic(() => import('@/components/map/WorldMap').then((m) => m.WorldMap), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-[var(--gt-hdr)]" />,
});

const NO_COUNTS: Record<string, number> = Object.freeze({}) as Record<string, number>;

export function visualCountryMapHref(iso3: string): string {
  const params = new URLSearchParams();
  params.set(SELECTION_QUERY_KEY, encodeSelection({ kind: 'COUNTRY', id: iso3 }));
  return `/map?${params.toString()}`;
}

export function VisualHeroMap({ language }: { readonly language: LanguageCode }): JSX.Element {
  const t = getDictionary(language).visual.map;
  const [preset, setPreset] = useState<VisualRegionId>('world');
  const [frameKey, setFrameKey] = useState(0);
  const [selected, setSelected] = useState<CountryMeta | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [askStaged, setAskStaged] = useState<string | null>(null);
  const statusId = useId();

  const nameOf = (country: CountryMeta): string => getCountryDisplayName(country.iso2, language, country.name);
  const selectedName = selected === null ? null : nameOf(selected);
  const activePreset = VISUAL_REGIONS.find((p) => p.id === preset) ?? VISUAL_REGIONS[0];
  const frame = useMemo(() => ({ key: `${activePreset.id}:${frameKey}`, bounds: activePreset.bounds }), [activePreset, frameKey]);

  /* Ask geography context is published ONLY after the reader's explicit "Ask about …" press. */
  usePublishGeographyContext(
    askStaged !== null && selected !== null && selectedName !== null ? { countryCode: selected.iso3, displayName: selectedName } : undefined,
  );

  const choose = (country: CountryMeta | null): void => {
    setSelected(country);
    setAskStaged(null);
  };

  const onSelectCountry = (feature: CountryFeature): void => {
    const country = feature.properties.country;
    if (country === undefined) return; /* geometry with no registry identity: not selectable */
    choose(selected?.iso3 === country.iso3 ? null : country);
  };

  return (
    <section aria-labelledby="visual-map-title" data-visual-hero-map="" className="flex min-w-0 flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="visual-map-title" className="font-mono text-[0.75rem] font-semibold uppercase tracking-[0.14em] text-[var(--gt-hdrInk)] opacity-80">
          {t.heading}
        </h2>
      </div>
      <div role="group" aria-label={t.regionsAria} className="flex flex-wrap gap-2">
        {VISUAL_REGIONS.map((p) => (
          <button
            key={p.id}
            type="button"
            aria-pressed={preset === p.id}
            data-visual-map-preset={p.id}
            aria-label={t.regionNames[p.id]}
            onClick={() => {
              setPreset(p.id);
              setFrameKey((k) => k + 1);
            }}
            className={`min-h-[44px] rounded-[0.5rem] border px-3 text-[0.8125rem] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 ${
              preset === p.id ? 'border-white/60 bg-white/15 text-white' : 'border-white/20 bg-white/[0.04] text-[var(--gt-hdrInk)] hover:border-white/40'
            }`}
          >
            {p.id === 'eac' ? t.eac : p.id === 'eu' ? t.eu : t.regionNames[p.id]}
          </button>
        ))}
      </div>

      <div
        data-visual-map-host=""
        data-expanded={expanded ? 'true' : 'false'}
        className={`relative w-full overflow-hidden rounded-[0.75rem] border border-white/10 bg-[#080b12] ${
          expanded ? 'h-[clamp(180px,60svh,640px)]' : 'h-[clamp(140px,42svh,320px)] max-[599px]:h-[min(180px,42svh)]'
        }`}
      >
        <div aria-hidden="true" className="h-full w-full">
          <WorldMap
            countryStoryCounts={NO_COUNTS}
            selectedIso3={selected?.iso3 ?? null}
            compact
            frame={frame}
            trackHostResize
            onHoverCountry={() => undefined}
            onSelectCountry={onSelectCountry}
            language={language}
          />
        </div>
        <span className="sr-only">{t.mapAria}</span>
      </div>

      <p
        data-visual-region-meaning={activePreset.id}
        data-region-membership={activePreset.membership}
        data-region-ask-retrieval={activePreset.askRetrieval ? 'declared' : 'none'}
        aria-live="polite"
        className="text-[0.8125rem] leading-snug text-white"
      >
        <span className="font-semibold">{t.regionNames[activePreset.id]}: </span>
        {fill(t.regionMeaning[activePreset.id], { count: activePreset.memberCount ?? '' })}
      </p>
      <p className="text-[0.75rem] leading-snug text-[var(--gt-hdrInk)] opacity-75">
        {t.framingNote} {activePreset.id === 'world' ? null : t.regionWatch}
      </p>
      <p data-visual-map-coverage="none" className="text-[0.75rem] leading-snug text-[var(--gt-hdrInk)] opacity-75">
        {t.noCoverage}
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setSearchOpen(true)}
          aria-haspopup="dialog"
          data-visual-country-search=""
          className="inline-flex min-h-[44px] items-center gap-2 rounded-[0.5rem] border border-white/25 px-3 text-[0.8125rem] font-semibold text-white hover:border-white/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
        >
          <Search aria-hidden="true" className="h-4 w-4" />
          {t.moreCountries}
        </button>
        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpanded((e) => !e)}
          data-visual-map-expand=""
          className="inline-flex min-h-[44px] items-center gap-2 rounded-[0.5rem] px-3 text-[0.8125rem] font-semibold text-[var(--gt-hdrInk)] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
        >
          {expanded ? <Minimize2 aria-hidden="true" className="h-4 w-4" /> : <Maximize2 aria-hidden="true" className="h-4 w-4" />}
          {expanded ? t.collapse : t.expand}
        </button>
        <a
          href="/map"
          className="ms-auto inline-flex min-h-[44px] items-center gap-1 px-1 text-[0.8125rem] font-semibold text-[var(--gt-hdrInk)] underline-offset-4 hover:text-white hover:underline"
        >
          {t.openFullMap}
          <ArrowUpRight aria-hidden="true" className="h-4 w-4 rtl:-scale-x-100" />
        </a>
      </div>

      {selected !== null && selectedName !== null && (
        <div data-visual-country-scope="" className="flex flex-col gap-2 rounded-[0.625rem] border border-white/15 bg-white/[0.06] p-3">
          <p id={statusId} role="status" className="text-[0.875rem] font-semibold text-white">
            {fill(t.selected, { country: selectedName })}
          </p>
          <div className="flex flex-wrap gap-2">
            <a
              href={visualCountryMapHref(selected.iso3)}
              data-visual-country-open=""
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-[0.5rem] bg-white px-3 text-[0.8125rem] font-bold text-[var(--gt-navy)] hover:brightness-95"
            >
              {fill(t.openInMap, { country: selectedName })}
            </a>
            <button
              type="button"
              data-visual-country-ask=""
              onClick={() => {
                setAskStaged(selected.iso3);
                openGlobalAsk();
              }}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-[0.5rem] border border-white/30 px-3 text-[0.8125rem] font-semibold text-white hover:border-white/60"
            >
              <MessagesSquare aria-hidden="true" className="h-4 w-4" />
              {fill(t.askAbout, { country: selectedName })}
            </button>
            <button
              type="button"
              onClick={() => choose(null)}
              className="inline-flex min-h-[44px] items-center px-2 text-[0.8125rem] font-semibold text-[var(--gt-hdrInk)] underline-offset-4 hover:underline"
            >
              {t.clear}
            </button>
          </div>
          <p className="text-[0.75rem] text-[var(--gt-hdrInk)] opacity-75">{fill(t.askAboutNote, { country: selectedName })}</p>
        </div>
      )}

      {searchOpen && (
        <CountrySheet
          language={language}
          onClose={() => setSearchOpen(false)}
          onChoose={(country) => {
            choose(country);
            setSearchOpen(false);
          }}
        />
      )}
    </section>
  );
}

/**
 * The keyboard-operable accessible equivalent of the map (design doc 05 option (b)): every
 * registry place, searchable, each a real button. The map selection follows it.
 */
function CountrySheet({
  language,
  onClose,
  onChoose,
}: {
  readonly language: LanguageCode;
  readonly onClose: () => void;
  readonly onChoose: (country: CountryMeta) => void;
}): JSX.Element {
  const t = getDictionary(language).visual.map;
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);
  const opener = useRef<Element | null>(null);
  const titleId = useId();

  useEffect(() => {
    opener.current = document.activeElement;
    inputRef.current?.focus();
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      if (opener.current instanceof HTMLElement) opener.current.focus();
    };
  }, [onClose]);

  const collator = useMemo(() => new Intl.Collator(language), [language]);
  const rows = useMemo(() => {
    const folded = query.trim().toLocaleLowerCase(language);
    return COUNTRIES.map((country) => ({ country, name: getCountryDisplayName(country.iso2, language, country.name) }))
      .filter(({ country, name }) => folded === '' || name.toLocaleLowerCase(language).includes(folded) || country.name.toLowerCase().includes(folded))
      .sort((a, b) => collator.compare(a.name, b.name));
  }, [query, language, collator]);

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-[var(--gt-scrim)] min-[600px]:items-center" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        data-visual-country-sheet=""
        className="flex max-h-[85dvh] w-full max-w-[480px] flex-col rounded-t-[1rem] bg-[var(--gt-card)] text-[var(--gt-ink)] shadow-xl min-[600px]:rounded-[1rem]"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex items-center gap-2 border-b border-[var(--gt-line)] p-3">
          <h2 id={titleId} className="flex-1 text-[1rem] font-bold">
            {t.countriesAria}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t.searchClose}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full hover:bg-[var(--gt-sunk)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gt-act)]"
          >
            <X aria-hidden="true" className="h-5 w-5" />
          </button>
        </div>
        <div className="p-3">
          <label className="sr-only" htmlFor={`${titleId}-q`}>
            {t.searchCountries}
          </label>
          <input
            ref={inputRef}
            id={`${titleId}-q`}
            type="search"
            dir="auto"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t.searchCountries}
            className="h-11 w-full rounded-[0.5rem] border border-[var(--gt-line)] bg-[var(--gt-bg)] px-3 text-[1rem] outline-none focus:border-[var(--gt-act)]"
          />
        </div>
        <ul className="min-h-0 flex-1 overflow-y-auto px-3 pb-3" aria-label={t.countriesAria}>
          {rows.length === 0 ? (
            <li role="status" className="p-3 text-[0.875rem] text-[var(--gt-ink2)]">
              {t.noMatch}
            </li>
          ) : (
            rows.map(({ country, name }) => (
              <li key={country.iso3}>
                <button
                  type="button"
                  data-visual-country-option={country.iso3}
                  onClick={() => onChoose(country)}
                  className="flex min-h-[44px] w-full items-center rounded-[0.5rem] px-3 text-start text-[0.9375rem] hover:bg-[var(--gt-sunk)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gt-act)]"
                >
                  <bdi>{name}</bdi>
                </button>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}
