'use client';

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useSearchParams } from 'next/navigation';
import type { StoryContext } from '@globalnews-ai/shared';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { usePublishStoryContext } from '@/lib/ask/storyContextStore';
import { dashboardContext } from '@/lib/ask/dashboardContext';
import { useAskConversation } from '@/lib/ask/useAskConversation';
import { resolveAskStrings, type AskLocale } from '@/lib/ask/askStrings';
import { askR2Strings } from '@/lib/ask/askR2Strings';
import { askR2View } from '@/lib/ask/askR2View';
import {
  sanitizeReturnPath,
  useAskR2Conversation,
  type AskR2Turn,
} from '@/lib/ask/useAskR2Conversation';
import { askR2PayloadOf, askV2Api } from '@/lib/api/askV2Api';
import { splitFor, type MapSplitMode } from '@/lib/map/d1/mapComposition';
import { WORLD_CAMERA, type CameraState } from '@/lib/map/camera/cameraState';
import { computeFeatureCenter, type CountryFeature } from '@/lib/map/countryGeometry';
import { getSpatialCountryFeatureCollection } from '@/lib/map/spatial/spatialCountryGeometry';
import { localisedCountryName } from '@/lib/map/geography/displayName';
import { buildEvidenceGeography } from '@/components/analysis-frame/evidenceGeography';
import { AskCompactResult } from '@/components/ask/AskCompactResult';
import { LoadingStages } from '@/components/search/LoadingStages';
import { WatchCta } from '@/components/map/shell/monetization/WatchCta';
import { AskMapColumn } from './AskMapColumn';
import { AskR2TurnView } from './AskR2TurnView';
import { AskDeepConfirm } from './AskDeepConfirm';
import { Composer, Region, Statement, SuggestionList, TierBoundary, ASK_MICRO } from './AskParts';
import styles from './askDashboard.module.css';

/**
 * v1.8 composition, CTO /ask ruling. /search continues to own the complete record.
 *
 * ASK R2 CONSOLIDATED INTEGRATION R1 · GATES F + G.
 *
 *   PHONE AND 768 PORTRAIT ARE FULL SCREEN (D25 11: "PHONE MAP MAY BE PARTIAL. PHONE ASK
 *   MAY NOT."). The surface starts at the top edge: header 56 · context strip 44 ·
 *   full-width conversation · composer, safe-area aware. No Map behind or under it, no
 *   sheet detents, no mini-map in the reader. The 148/52/74 geometry belongs to the Map
 *   country workspace only. 1024 landscape: the Map beside a 460 px Ask pane (D26).
 *   ≥1280 keeps the approved split.
 *
 *   ASK R2 FIRST, EXISTING ASK AS ROLLBACK (§8). A Send goes to Ask V2; if the server says
 *   Ask V2 is off (404, the default) or the reader is signed out (401), that question goes
 *   down the existing /analysis path instead. Opening, focusing and typing request nothing.
 *
 *   `?operation=<id>` is the "Open full analysis" target: a display-only read of a stored
 *   Ask V2 operation — 0 AI · 0 provider · no compute (§15). `?return=<path>` is the return
 *   destination captured at departure (§16), never derived from the answer.
 */
export function AskFrameScreen({ locale }: { readonly locale: AskLocale }): JSX.Element {
  const params = useSearchParams();
  const urlKey = params.toString();
  const incoming = useMemo(() => dashboardContext(new URLSearchParams(urlKey)), [urlKey]);
  const [contextOverride, setContextOverride] = useState<{ key: string; context?: StoryContext }>();
  const context = contextOverride?.key === urlKey ? contextOverride.context : incoming;
  usePublishStoryContext(context);
  const [question, setQuestion] = useState(params.get('q') ?? '');
  const [mode, setMode] = useState<MapSplitMode>('explore');
  const [compact, setCompact] = useState(false);
  const [camera, setCamera] = useState<CameraState>(WORLD_CAMERA);
  const [watchOpen, setWatchOpen] = useState(false);
  const [customSplit, setCustomSplit] = useState<number | null>(null);
  const reader = useRef<HTMLDivElement>(null);
  const layout = useRef<HTMLDivElement>(null);
  const t = resolveAskStrings(locale).strings;
  /* Ask V2 serves the two ACTIVE languages; any other locale reads and renders as English. */
  const r2Locale: 'en' | 'pl' = locale === 'pl' ? 'pl' : 'en';
  const r2s = askR2Strings(r2Locale);
  const dict = getDictionary(locale);
  const mon = dict.map.spatial.monetization;
  const { turns, pending, submit } = useAskConversation(locale, context);
  const returnPath = sanitizeReturnPath(params.get('return'));
  const r2 = useAskR2Conversation(r2Locale, returnPath);
  const operationId = params.get('operation');
  const [opened, setOpened] = useState<AskR2Turn | null>(null);
  const last = turns[turns.length - 1];
  const lastR2 = r2.turns[r2.turns.length - 1] ?? opened ?? undefined;
  const lastR2View =
    lastR2?.payload != null
      ? askR2View(
          lastR2.payload,
          r2s,
          r2Locale,
          (iso) => localisedCountryName(iso, r2Locale) ?? iso,
        )
      : null;
  const showR2 = r2.availability === 'r2' || opened !== null;
  const split = splitFor(mode);
  const mapPercent = mode === 'full-map' ? 100 : (customSplit ?? split.mapPercent);
  const isPending = pending !== null || r2.pending !== null;

  useEffect(() => {
    setQuestion(new URLSearchParams(urlKey).get('q') ?? '');
  }, [urlKey]);
  /* "Open full analysis": ONE display-only read of the stored operation. No AI, no provider. */
  useEffect(() => {
    if (operationId === null) return;
    let live = true;
    void askV2Api.operation(operationId).then((read) => {
      if (!live) return;
      setOpened(
        read.ok
          ? { question: '', operation: read.value, payload: askR2PayloadOf(read.value) }
          : { question: '', failure: read.reason },
      );
    });
    return () => {
      live = false;
    };
  }, [operationId]);
  useEffect(() => {
    const media = matchMedia('(max-width: 860px)');
    const update = () => setCompact(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  useEffect(() => {
    if (reader.current) reader.current.scrollTop = reader.current.scrollHeight;
  }, [turns, pending, r2.turns, r2.pending]);
  useEffect(() => {
    // The geographic evidence reader already enforces country precision and fail-closed ties.
    const response = showR2 ? lastR2?.payload?.analysis : last?.response;
    const iso = response ? buildEvidenceGeography(response).primary?.iso3 : context?.countryCode;
    if (!iso) return;
    const country = getSpatialCountryFeatureCollection().features.find(
      (f) => f.properties.country?.iso3 === iso || f.properties.country?.iso2 === iso,
    );
    const center = country && computeFeatureCenter(country);
    if (center) setCamera((current) => ({ ...current, center, zoom: 3 }));
  }, [last?.response, lastR2?.payload, showR2, context?.countryCode]);
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
  }
  async function ask() {
    if (isPending || !question.trim()) return;
    const draft = question;
    setQuestion('');
    chooseMode('answer');
    /* Ask R2 first; the existing Ask is the rollback path when Ask V2 is off or signed out. */
    const outcome = await r2.submit(draft);
    if (outcome === 'legacy') void submit(draft);
  }
  /* Back / Close: the captured return destination, else the previous page, else Home. */
  function leave() {
    if (returnPath !== null) {
      window.location.assign(returnPath);
      return;
    }
    if (window.history.length > 1) window.history.back();
    else window.location.assign('/');
  }
  const returnsToMap = returnPath?.startsWith('/map') ?? false;

  const map = (
    <AskMapColumn
      t={t}
      language={locale}
      camera={camera}
      onCamera={setCamera}
      onSelect={selectCountry}
      selectedIso3={context?.countryCode}
      response={showR2 ? (lastR2?.payload?.analysis ?? undefined) : last?.response}
      compact={compact}
    />
  );
  const composer = (
    <Composer
      value={question}
      onChange={(value) => {
        setQuestion(value);
        if (!turns.length && !r2.turns.length && value) chooseMode('question');
      }}
      inputLabel={dict.askAi.inputLabel}
      placeholder={dict.askAi.inputPlaceholder}
      submitLabel={dict.askAi.submit}
      costNote={t.states.costNotConfigured}
      onSubmit={() => void ask()}
      pending={isPending}
    />
  );

  return (
    <main
      ref={layout}
      data-ask="frame-screen"
      data-ask-surface
      data-ask-path={showR2 ? 'r2' : r2.availability === 'legacy' ? 'legacy' : 'unknown'}
      data-ask-split={mode}
      data-ask-phase={
        isPending ? 'loading' : turns.length || r2.turns.length || opened ? 'answered' : 'idle'
      }
      className={styles.frame}
      style={{ '--ask-map-percent': `${mapPercent}%` } as CSSProperties}
    >
      {/* PHONE / 768 PORTRAIT — header 56 (D25 11). Hidden by CSS on wider layouts. */}
      <header data-ask="header" className={styles.phoneHeader}>
        <button
          type="button"
          data-ask={returnsToMap ? 'back' : 'close'}
          aria-label={returnsToMap ? r2s.returnMap : r2s.close}
          onClick={leave}
          className="inline-flex min-h-11 min-w-11 items-center justify-center text-[18px]"
        >
          {returnsToMap ? '←' : '×'}
        </button>
        <h1 className="flex-1 truncate text-[16px] font-semibold">{r2s.askTitle}</h1>
        {lastR2View !== null && (
          <span data-ask="header-state" className="text-[12px] text-sp-ink-2">
            {lastR2View.badgeText} · {r2s.sourcesLabel(lastR2View.sourceCount)}
          </span>
        )}
      </header>
      {/* PHONE / 768 PORTRAIT — context strip 44, chips from the plan only (D25 05). */}
      <div data-ask="context-strip" className={styles.phoneStrip}>
        {returnsToMap && (
          <button
            type="button"
            data-ask="return-to-map"
            onClick={leave}
            className="shrink-0 rounded-full border border-dashed border-sp-line px-2 py-0.5"
          >
            {r2s.returnMap}
          </button>
        )}
        {lastR2View !== null
          ? lastR2View.chips.items.map((chip, i) => (
              <span
                key={`${chip.kind}-${i}`}
                className="shrink-0 rounded-full border border-sp-line px-2 py-0.5"
              >
                {chip.label}
              </span>
            ))
          : context !== undefined && <span className="shrink-0 truncate">{context.title}</span>}
        {lastR2View?.chips.note != null && (
          <span className="shrink-0 text-sp-ink-2">{lastR2View.chips.note}</span>
        )}
      </div>

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
        <div data-ask-map className={styles.map}>
          {!compact && map}
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
          data-ask-pane
          className={styles.panel}
          data-fullmap={mode === 'full-map'}
        >
          {mode !== 'full-map' && (
            <>
              <div className={`${styles.panelTitle} shrink-0 border-b border-sp-line p-3`}>
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
              <div ref={reader} data-ask="reader" className={styles.reader} aria-live="polite">
                {opened !== null && (
                  <AskR2TurnView turn={opened} locale={r2Locale} context={context} displayOnly />
                )}
                {turns.length === 0 && r2.turns.length === 0 && opened === null && !isPending && (
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
                {r2.turns.map((turn, i) => (
                  <AskR2TurnView
                    key={`r2-${i}`}
                    turn={turn}
                    locale={r2Locale}
                    context={context}
                    onRunDeeper={(q) => void r2.runDeeper(q)}
                  />
                ))}
                {turns.map((turn, i) => (
                  <article
                    key={i}
                    data-ask-turn
                    data-ask="turn"
                    className="mb-5 border-b border-sp-line pb-4"
                  >
                    <h2 className="mb-3 text-[15px] font-semibold leading-[1.45]">
                      {turn.question}
                    </h2>
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
                {isPending && (
                  <section data-ask="pending">
                    <h2 className="mb-3 text-[15px]">{pending ?? r2.pending}</h2>
                    <LoadingStages stages={dict.loadingStages} />
                  </section>
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
            {mode === 'full-map' && !compact && (
              <button
                type="button"
                className={`${ASK_MICRO} min-h-11`}
                onClick={() => chooseMode(turns.length || r2.turns.length ? 'answer' : 'explore')}
              >
                {dict.askAi.title} ↑
              </button>
            )}
            {composer}
          </div>
        </section>
      </div>
      {r2.deepQuote !== null && (
        <AskDeepConfirm
          locale={r2Locale}
          onConfirm={() => void r2.confirmDeeper()}
          onCancel={() => void r2.cancelDeeper()}
        />
      )}
    </main>
  );
}
