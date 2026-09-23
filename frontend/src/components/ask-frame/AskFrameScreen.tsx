'use client';

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useSearchParams } from 'next/navigation';
import type { StoryContext } from '@globalnews-ai/shared';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { usePublishStoryContext } from '@/lib/ask/storyContextStore';
import { dashboardContext } from '@/lib/ask/dashboardContext';
import { useAskConversation } from '@/lib/ask/useAskConversation';
import { resolveAskStrings, type AskLocale } from '@/lib/ask/askStrings';
import {
  splitFor,
  sheetHeightPercent,
  SHEET_DETENTS,
  type SheetDetent,
  type MapSplitMode,
} from '@/lib/map/d1/mapComposition';
import { WORLD_CAMERA, type CameraState } from '@/lib/map/camera/cameraState';
import { computeFeatureCenter, type CountryFeature } from '@/lib/map/countryGeometry';
import { getSpatialCountryFeatureCollection } from '@/lib/map/spatial/spatialCountryGeometry';
import { localisedCountryName } from '@/lib/map/geography/displayName';
import { buildEvidenceGeography } from '@/components/analysis-frame/evidenceGeography';
import { AskCompactResult } from '@/components/ask/AskCompactResult';
import { LoadingStages } from '@/components/search/LoadingStages';
import { WatchCta } from '@/components/map/shell/monetization/WatchCta';
import { AskMapColumn } from './AskMapColumn';
import { Composer, Region, Statement, SuggestionList, TierBoundary, ASK_MICRO } from './AskParts';
import styles from './askDashboard.module.css';

/** v1.8 composition, CTO /ask ruling. /search continues to own the complete record. */
export function AskFrameScreen({ locale }: { readonly locale: AskLocale }): JSX.Element {
  const params = useSearchParams();
  const urlKey = params.toString();
  const incoming = useMemo(() => dashboardContext(new URLSearchParams(urlKey)), [urlKey]);
  const [contextOverride, setContextOverride] = useState<{ key: string; context?: StoryContext }>();
  const context = contextOverride?.key === urlKey ? contextOverride.context : incoming;
  usePublishStoryContext(context);
  const [question, setQuestion] = useState(params.get('q') ?? '');
  const [mode, setMode] = useState<MapSplitMode>('explore');
  const [detent, setDetent] = useState<SheetDetent>('peek');
  const [compact, setCompact] = useState(false);
  const [camera, setCamera] = useState<CameraState>(WORLD_CAMERA);
  const [watchOpen, setWatchOpen] = useState(false);
  const [customSplit, setCustomSplit] = useState<number | null>(null);
  const [tab, setTab] = useState<'answer' | 'sources' | 'map'>('answer');
  const reader = useRef<HTMLDivElement>(null);
  const layout = useRef<HTMLDivElement>(null);
  const t = resolveAskStrings(locale).strings;
  const dict = getDictionary(locale);
  const mon = dict.map.spatial.monetization;
  const { turns, pending, submit } = useAskConversation(locale, context);
  const last = turns[turns.length - 1];
  const split = splitFor(mode);
  const mapPercent = mode === 'full-map' ? 100 : (customSplit ?? split.mapPercent);

  useEffect(() => {
    setQuestion(new URLSearchParams(urlKey).get('q') ?? '');
  }, [urlKey]);
  useEffect(() => {
    const media = matchMedia('(max-width: 860px)');
    const update = () => setCompact(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  useEffect(() => {
    if (reader.current) reader.current.scrollTop = reader.current.scrollHeight;
  }, [turns, pending]);
  useEffect(() => {
    // The geographic evidence reader already enforces country precision and fail-closed ties.
    const iso = last?.response
      ? buildEvidenceGeography(last.response).primary?.iso3
      : context?.countryCode;
    if (!iso) return;
    const country = getSpatialCountryFeatureCollection().features.find(
      (f) => f.properties.country?.iso3 === iso || f.properties.country?.iso2 === iso,
    );
    const center = country && computeFeatureCenter(country);
    if (center) setCamera((current) => ({ ...current, center, zoom: 3 }));
  }, [last?.response, context?.countryCode]);
  useEffect(() => {
    const viewport = window.visualViewport;
    const update = () => {
      const node = layout.current;
      if (node) {
        node.style.setProperty(
          '--ask-visible-height',
          `${viewport?.height ?? window.innerHeight}px`,
        );
        node.style.setProperty('--ask-top', `${node.getBoundingClientRect().top}px`);
      }
    };
    update();
    viewport?.addEventListener('resize', update);
    window.addEventListener('resize', update);
    return () => {
      viewport?.removeEventListener('resize', update);
      window.removeEventListener('resize', update);
    };
  }, []);
  useEffect(() => {
    try {
      const n = Number(sessionStorage.getItem('ask-map-percent'));
      if (n >= 35 && n <= 70) setCustomSplit(n);
    } catch {
      /* storage is optional */
    }
  }, []);

  function chooseMode(next: MapSplitMode) {
    setMode(next);
    setCustomSplit(null);
  }
  function resize(next: number) {
    const n = Math.max(35, Math.min(70, next));
    setCustomSplit(n);
    try {
      sessionStorage.setItem('ask-map-percent', String(n));
    } catch {
      /* storage is optional */
    }
  }
  function selectCountry(feature: CountryFeature) {
    const c = feature.properties.country;
    if (!c) return;
    setContextOverride({
      key: urlKey,
      context: { title: localisedCountryName(c.iso3, locale) ?? c.name, countryCode: c.iso3 },
    });
    const center = computeFeatureCenter(feature);
    if (center) setCamera((current) => ({ ...current, center, zoom: 3 }));
    chooseMode('question');
    setDetent('half');
  }
  function ask() {
    if (pending || !question.trim()) return;
    const draft = question;
    setQuestion('');
    setDetent('full');
    setTab('answer');
    chooseMode('answer');
    void submit(draft);
  }
  const map = (
    <AskMapColumn
      t={t}
      language={locale}
      camera={camera}
      onCamera={setCamera}
      onSelect={selectCountry}
      selectedIso3={context?.countryCode}
      response={last?.response}
      compact={compact}
    />
  );
  const composer = (
    <Composer
      value={question}
      onChange={(value) => {
        setQuestion(value);
        if (!turns.length && value) chooseMode('question');
      }}
      inputLabel={dict.askAi.inputLabel}
      placeholder={dict.askAi.inputPlaceholder}
      submitLabel={dict.askAi.submit}
      costNote={t.states.costNotConfigured}
      onSubmit={ask}
      pending={pending !== null}
    />
  );

  return (
    <main
      ref={layout}
      data-ask="frame-screen"
      data-ask-split={mode}
      data-ask-phase={pending ? 'loading' : turns.length ? 'answered' : 'idle'}
      className={styles.frame}
      style={
        {
          '--ask-map-percent': `${mapPercent}%`,
          '--ask-sheet-height': `${sheetHeightPercent(detent)}%`,
        } as CSSProperties
      }
    >
      <header className={styles.header}>
        <h1 className="text-[14px] font-semibold">{t.frameLabel}</h1>
        <nav aria-label={t.controls.splitMode} className="flex flex-wrap gap-1">
          {(['explore', 'question', 'answer', 'full-map'] as const).map((m, index) => (
            <button
              key={m}
              type="button"
              aria-pressed={mode === m}
              className="min-h-11 rounded border border-sp-line px-2 text-[11px] aria-pressed:border-sp-cyan aria-pressed:text-sp-cyan"
              onClick={() => chooseMode(m)}
            >
              {
                [
                  t.controls.exploreMode,
                  t.controls.questionMode,
                  t.controls.answerMode,
                  t.controls.fullMapMode,
                ][index]
              }
            </button>
          ))}
        </nav>
      </header>
      <div className={styles.body}>
        <div className={styles.map} data-full={compact && detent === 'full' && mode !== 'full-map'}>
          {!(compact && detent === 'full' && mode !== 'full-map') && map}
        </div>
        {!compact && mode !== 'full-map' && (
          <div
            role="separator"
            aria-label={t.controls.splitMode}
            aria-orientation="vertical"
            aria-valuemin={35}
            aria-valuemax={70}
            aria-valuenow={mapPercent}
            tabIndex={0}
            className={styles.resize}
            onKeyDown={(e) => {
              if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                e.preventDefault();
                resize(mapPercent + (e.key === 'ArrowRight' ? 5 : -5));
              }
            }}
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
            }}
            onPointerMove={(e) => {
              if (e.currentTarget.hasPointerCapture(e.pointerId)) {
                const bounds = layout.current?.getBoundingClientRect();
                if (bounds) resize(((e.clientX - bounds.left) / bounds.width) * 100);
              }
            }}
          />
        )}
        <section
          data-ask="ask-panel"
          data-detent={detent}
          className={styles.panel}
          data-fullmap={mode === 'full-map'}
        >
          {compact && mode !== 'full-map' && (
            <nav
              aria-label={t.controls.detent}
              className="flex shrink-0 justify-center gap-2 border-b border-sp-line"
            >
              {SHEET_DETENTS.map((d, i) => (
                <button
                  key={d}
                  type="button"
                  data-detent-target={d}
                  aria-pressed={detent === d}
                  onClick={() => setDetent(d)}
                  className="min-h-11 px-3 text-[11px] text-sp-ink-2"
                >
                  {[t.controls.peek, t.controls.half, t.controls.full][i]}
                </button>
              ))}
            </nav>
          )}
          {mode !== 'full-map' && (
            <>
              <div className="shrink-0 border-b border-sp-line p-3">
                <p className="text-[14px] font-semibold">{dict.askAi.title}</p>
                {context && (
                  <div
                    data-ask="context"
                    className="mt-2 flex items-center justify-between gap-2 text-[12px] text-sp-cyan"
                  >
                    <span>{context.title}</span>
                    <button
                      type="button"
                      className="min-h-11 min-w-11"
                      aria-label={t.controls.removeContext}
                      onClick={() => setContextOverride({ key: urlKey })}
                    >
                      ×
                    </button>
                  </div>
                )}
              </div>
              {compact && turns.length > 0 && (
                <nav className="flex shrink-0 gap-2 px-3" aria-label={t.regions.answer}>
                  {(['answer', 'sources', 'map'] as const).map((item) => (
                    <button
                      type="button"
                      key={item}
                      aria-pressed={tab === item}
                      className="min-h-11 px-2 text-[11px] aria-pressed:text-sp-cyan"
                      onClick={() => setTab(item)}
                    >
                      {item === 'map' ? t.controls.miniMap : t.regions[item]}
                    </button>
                  ))}
                </nav>
              )}
              <div
                ref={reader}
                data-ask="conversation"
                className={styles.reader}
                data-tab={compact ? tab : 'answer'}
                aria-live="polite"
              >
                {compact && detent === 'full' && (tab === 'map' || tab === 'answer') && (
                  <div className="mb-3 h-[160px]">{map}</div>
                )}
                {(!compact || tab !== 'map') && (
                  <>
                    {turns.length === 0 && pending === null && (
                      <>
                        <Region id="context-summary" label={t.regions.contextSummary}>
                          <Statement text={context?.title ?? t.states.noEvidenceYet} />
                        </Region>
                        <Region id="suggestions" label={t.regions.suggestions}>
                          <SuggestionList t={t} />
                          <Statement text={t.states.suggestionsUnavailable} />
                        </Region>
                      </>
                    )}
                    {turns.map((turn, i) => (
                      <article
                        key={i}
                        data-ask="turn"
                        className="mb-5 border-b border-sp-line pb-4"
                      >
                        <h2 className="mb-3 text-[13px] font-semibold">{turn.question}</h2>
                        {turn.response ? (
                          <AskCompactResult
                            response={turn.response}
                            question={turn.question}
                            language={turn.language}
                            context={turn.context}
                          />
                        ) : (
                          <p role="alert">{turn.error}</p>
                        )}
                      </article>
                    ))}
                    {pending !== null && (
                      <section data-ask="pending">
                        <h2 className="mb-3 text-[13px]">{pending}</h2>
                        <LoadingStages stages={dict.loadingStages} />
                      </section>
                    )}
                  </>
                )}
                <Region id="watch" label={t.regions.watch}>
                  <WatchCta
                    stage="OPENED"
                    labels={mon.watch}
                    onOpenComposer={() => setWatchOpen((v) => !v)}
                  />
                  {watchOpen && (
                    <TierBoundary
                      title={mon.activation.unavailableTitle}
                      body={mon.activation.unavailableBody}
                    />
                  )}
                </Region>
                <Region id="alerts" label={t.regions.alerts}>
                  <Statement text={t.states.noAlerts} />
                </Region>
              </div>
            </>
          )}
          <div data-ask="composer-footer" className={styles.composer}>
            {mode === 'full-map' && (
              <button
                type="button"
                className={`${ASK_MICRO} min-h-11`}
                onClick={() => chooseMode(turns.length ? 'answer' : 'explore')}
              >
                {dict.askAi.title} ↑
              </button>
            )}
            {composer}
          </div>
        </section>
      </div>
    </main>
  );
}
