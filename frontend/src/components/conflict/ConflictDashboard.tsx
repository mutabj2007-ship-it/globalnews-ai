'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import type {
  ConflictObservation,
  ConflictRetainedEvidenceDetail,
  LanguageCode,
} from '@globalnews-ai/shared';
import { severityValueOrNull } from '@globalnews-ai/shared';
import { GlobalMapShell } from '@/components/map/shell/GlobalMapShell';
import { EvidenceMapCanvas } from '@/components/map/shell/EvidenceMapCanvas';
import { ContextSummaryPanel } from '@/components/map/shell/ContextSummaryPanel';
import { ConflictAssessmentRail } from '@/components/map/conflict/ConflictAssessmentRail';
import { MobileBottomSheet, type SheetStop } from '@/components/map/mobile/MobileBottomSheet';
import { MapLanguageControl } from '@/components/map/shell/MapLanguageControl';
import { persistLanguageSelection } from '@/lib/i18n/languages';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { evidenceTotals } from '@/lib/map/evidence/evidenceModel';
import {
  WORLD_CAMERA,
  normaliseCamera,
  type CameraState,
  type Bounds,
} from '@/lib/map/camera/cameraState';
import { encodeCamera, decodeCamera } from '@/lib/map/camera/cameraUrl';
import {
  conflictDisplayStats,
  conflictPlaceLabel,
  reviewedObservations,
  observationMapRecord,
  sourceHref,
} from '@/lib/conflict/retained';
import { conflictStrings } from '@/lib/conflict/strings';
import { readConflictEvidenceDetail } from '@/lib/conflict/evidenceDetail';
import type { AttentionQueue } from '@/lib/specialist/attentionQueue';
import './conflict.css';

export const CONFLICT_DETENTS = { peek: 54, half: 0.5, full: 0.9 } as const;
const RETURN_KEY = 'gn-conflict-return-v1';
const section = 'border-b border-sp-line px-[14px] py-[12px]';
const button =
  'min-h-[44px] border border-sp-line px-3 text-[11px] text-sp-ink-2 hover:text-sp-cyan';

export function ConflictDashboard({
  language,
  spatialView = false,
}: {
  language: LanguageCode;
  spatialView?: boolean;
}) {
  const t = conflictStrings[language === 'pl' ? 'pl' : 'en'];
  const spatial = getDictionary(language).map.spatial;
  const [rows, setRows] = useState<readonly ConflictObservation[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [attempt, setAttempt] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [evidenceDetail, setEvidenceDetail] =
    useState<ConflictRetainedEvidenceDetail | null>(null);
  const [evidenceDetailStatus, setEvidenceDetailStatus] =
    useState<'idle' | 'loading' | 'ready'>('idle');
  const [drawer, setDrawer] = useState(false);
  const [layersOpen, setLayersOpen] = useState(false);
  const [incidentsVisible, setIncidentsVisible] = useState(true);
  const [stop, setStop] = useState<SheetStop>('PEEK');
  const [camera, setCamera] = useState<CameraState>(WORLD_CAMERA);
  const [requestedCamera, requestCamera] = useState<CameraState>();
  const [origin, setOrigin] = useState<'initial' | 'control' | 'gesture'>('initial');
  const [fitBounds, setFitBounds] = useState<Bounds | null>(null);
  const [mounted, setMounted] = useState(false);
  const [phone, setPhone] = useState(false);
  const scroll = useRef(0);
  useEffect(() => {
    const query = matchMedia('(max-width: 860px)');
    const resize = () => setPhone(query.matches);
    resize();
    query.addEventListener('change', resize);
    const params = new URLSearchParams(location.search);
    setCamera(decodeCamera(params.get('cam')) ?? WORLD_CAMERA);
    setSelected(params.get('observation'));
    try {
      const saved = JSON.parse(sessionStorage.getItem(RETURN_KEY) ?? 'null');
      if (params.get('restore') === '1' && saved) {
        setSelected(typeof saved.selected === 'string' ? saved.selected : null);
        setCamera(decodeCamera(saved.cam) ?? WORLD_CAMERA);
        setStop(['PEEK', 'HALF', 'FULL'].includes(saved.stop) ? saved.stop : 'PEEK');
        setDrawer(saved.drawer === true);
        scroll.current = Number.isFinite(saved.scroll) ? saved.scroll : 0;
      }
    } catch {
      /* Storage unavailable: retain the explicit URL state. */
    }
    setMounted(true);
    return () => query.removeEventListener('change', resize);
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    setStatus('loading');
    fetch('/conflict-data/observations?limit=500', {
      signal: controller.signal,
      cache: 'no-store',
    })
      .then((response) => {
        if (!response.ok) throw new Error('RETAINED_READ_FAILED');
        return response.json();
      })
      .then((value) => {
        setRows(reviewedObservations(value));
        setStatus('ready');
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setRows([]);
          setStatus('error');
        }
      });
    return () => controller.abort();
  }, [attempt]);
  useEffect(() => {
    if (status !== 'ready') return;
    const target = document.querySelector<HTMLElement>(
      '[data-gn="rail-scroll"], [data-gn="mobile-sheet-content"]',
    );
    if (target) target.scrollTop = scroll.current;
  }, [status, phone]);

  useEffect(() => {
    if (!selected) {
      setEvidenceDetail(null);
      setEvidenceDetailStatus('idle');
      return;
    }

    const controller = new AbortController();
    setEvidenceDetail(null);
    setEvidenceDetailStatus('loading');
    void readConflictEvidenceDetail(selected, controller.signal).then((detail) => {
      if (controller.signal.aborted) return;
      setEvidenceDetail(detail);
      setEvidenceDetailStatus('ready');
    });

    return () => controller.abort();
  }, [selected]);

  const row = rows.find((item) => item.observationKey === selected) ?? null;
  const records = useMemo(
    () =>
      rows.flatMap((item) => {
        const record = observationMapRecord(item);
        return record ? [record] : [];
      }),
    [rows],
  );
  const stats = useMemo(() => conflictDisplayStats(rows), [rows]);
  const visibleRecords = incidentsVisible ? records : [];
  const evidenceSet = useMemo(
    () => ({
      records: incidentsVisible ? records : [],
      scope: 'GLOBAL' as const,
      loadedAt: new Date(0).toISOString(),
    }),
    [records, incidentsVisible],
  );
  const queue: AttentionQueue = {
    domain: 'CONFLICT',
    headerLabel: spatial.conflictQueue.headerLabel,
    headerCount: 0,
    items: [],
    holdingLabel: t.notAssessed,
    holdingCount: 0,
    holdingItems: [],
    emptyIsResult: true,
    orderedBy: t.unordered,
  };
  const choose = (key: string) => {
    setSelected(key);
    setDrawer(false);
    setStop('HALF');
    const found = rows.find((o) => o.observationKey === key);
    const point = found && observationMapRecord(found)?.geography.point;
    if (point) {
      const focused = normaliseCamera({
        ...WORLD_CAMERA,
        center: point,
        zoom: found.geography.precision === 'EXACT' ? 7 : 5,
      });
      setOrigin('control');
      setCamera(focused);
      requestCamera(focused);
      if (phone) {
        const d = found.geography.precision === 'EXACT' ? 0.1 : 2;
        setFitBounds([
          point[0] - d,
          Math.max(-85, point[1] - d),
          point[0] + d,
          Math.min(85, point[1] + d),
        ]);
      }
    }
  };
  const save = () => {
    const target = document.querySelector<HTMLElement>(
      '[data-gn="rail-scroll"], [data-gn="mobile-sheet-content"]',
    );
    try {
      sessionStorage.setItem(
        RETURN_KEY,
        JSON.stringify({
          selected,
          drawer,
          stop,
          cam: encodeCamera(camera),
          scroll: target?.scrollTop ?? 0,
        }),
      );
    } catch {
      /* URL still carries identity and camera. */
    }
  };
  const mapParams = new URLSearchParams({
    domain: 'conflict',
    from: 'conflict',
    cam: encodeCamera(camera),
  });
  if (selected) mapParams.set('observation', selected);
  const returnParams = new URLSearchParams({ restore: '1' });
  if (selected) returnParams.set('observation', selected);
  returnParams.set('cam', encodeCamera(camera));
  const mapLink = (
    <a
      className={button + ' flex items-center'}
      href={spatialView ? '/conflict?' + returnParams.toString() : '/map?' + mapParams.toString()}
      onClick={spatialView ? undefined : save}
    >
      {spatialView ? t.return : t.map}
    </a>
  );
  const labels = {
    ...spatial.conflict,
    situationLabel: t.evidence,
    roleLabels: spatial.conflict.roles,
  };
  const details = row ? (
    <dl className="mt-3 space-y-3 break-words text-[11px] text-sp-ink-2">
      <div>
        <dt>
          {row.temporal.temporalProvenance === 'PUBLICATION_DATE_ONLY'
            ? t.publicationOnly
            : t.occurrence}
        </dt>
        <dd>
          {row.temporal.eventStartedAt}
          {row.temporal.eventEndedAt ? ' — ' + row.temporal.eventEndedAt : ''}
        </dd>
      </div>
      {!spatialView && row.actors.some((actor) => actor.upstreamName) && (
        <div>
          <dt>{t.actors}</dt>
          <dd>
            {row.actors
              .map((actor) => actor.upstreamName)
              .filter(Boolean)
              .join(' · ')}
          </dd>
        </div>
      )}
      {evidenceDetail?.sourceParties.length ? (
        <div>
          <dt>{t.sourceParties}</dt>
          <dd>{evidenceDetail.sourceParties.join(' · ')}</dd>
        </div>
      ) : null}
      <div>
        <dt>{t.sourceCountry}</dt>
        <dd>{evidenceDetail?.sourceCountryName ?? conflictPlaceLabel(row)}</dd>
      </div>
      {evidenceDetail?.whereDescription && (
        <div>
          <dt>{t.sourceLocationText}</dt>
          <dd>{evidenceDetail.whereDescription}</dd>
        </div>
      )}
      <div>
        <dt>{t.eventClassification}</dt>
        <dd>{t.events[row.eventType]}</dd>
        {row.eventType === 'EVENT_TYPE_NOT_CLASSIFIED' && (
          <dd className="mt-1 text-sp-ink-3">{t.unclassifiedDetail}</dd>
        )}
      </div>
      <div>
        <dt>{t.sourceEventId}</dt>
        <dd className="font-gn-mono text-[9px] text-sp-ink-3">
          {row.identity.authority} · {row.identity.upstreamEventId}
        </dd>
      </div>
      <div>
        <dt>{t.precision}</dt>
        <dd>{spatial.context.levels[row.geography.precision]}</dd>
      </div>
      <div>
        <dt>{t.provenance}</dt>
        <dd>{spatial.card.provenanceValues[row.geography.locationProvenance]}</dd>
      </div>
      {!observationMapRecord(row) && <div>{t.geometryWithheld}</div>}
      <div>
        <dt>{t.revision}</dt>
        <dd>
          {row.revision.revisionOrdinal}
          {row.revision.revisionKind ? ' · ' + t.revisions[row.revision.revisionKind] : ''}
        </dd>
        {row.revision.upstreamVersion && <dd>{row.revision.upstreamVersion}</dd>}
        <dd>{row.revision.recordedAt}</dd>
      </div>
      {row.severity.kind === 'PUBLISHER_STATED' && (
        <div>
          <dt>{t.scale}</dt>
          <dd>
            {row.severity.publisherAuthority} · {row.severity.publisherScaleRef}
          </dd>
        </div>
      )}
      <div>
        <dt>{t.source}</dt>
        <dd>{row.sourceReference.citation ?? row.identity.authority}</dd>
        {row.sourceReference.reportingOffice && <dd>{row.sourceReference.reportingOffice}</dd>}
        {sourceHref(row.sourceReference.sourceUrl) && (
          <dd>
            <a
              href={sourceHref(row.sourceReference.sourceUrl)!}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sp-cyan underline"
            >
              {t.source}
            </a>
          </dd>
        )}
      </div>
      {evidenceDetail?.sourceHeadline && (
        <div>
          <dt>{t.sourceHeadline}</dt>
          <dd>{evidenceDetail.sourceHeadline}</dd>
        </div>
      )}
      {evidenceDetail?.sourceOriginal && (
        <div>
          <dt>{t.sourceOriginal}</dt>
          <dd>{evidenceDetail.sourceOriginal}</dd>
        </div>
      )}
      {evidenceDetail?.conflictName && (
        <div>
          <dt>{t.conflictName}</dt>
          <dd>{evidenceDetail.conflictName}</dd>
        </div>
      )}
      {evidenceDetail?.dyadName && (
        <div>
          <dt>{t.dyadName}</dt>
          <dd>{evidenceDetail.dyadName}</dd>
        </div>
      )}
      {evidenceDetail?.numberOfSources !== undefined && (
        <div>
          <dt>{t.sourceCount}</dt>
          <dd>{evidenceDetail.numberOfSources}</dd>
        </div>
      )}
      {evidenceDetailStatus === 'ready' && evidenceDetail === null && (
        <p className="text-sp-ink-3">{t.evidenceDetailUnavailable}</p>
      )}
      {row.temporal.publisherRecordedAt && (
        <div>
          <dt>{t.publisherTime}</dt>
          <dd>{row.temporal.publisherRecordedAt}</dd>
        </div>
      )}
      <div>
        <dt>{t.acquired}</dt>
        <dd>{row.temporal.ingestedAt}</dd>
      </div>
    </dl>
  ) : null;
  const layers = (
    <div className="flex flex-col gap-2">
      <button
        className={button + ' !px-1'}
        title={t.evidence}
        aria-label={t.evidence}
        onClick={() => {
          setDrawer(true);
          setStop('HALF');
        }}
      >
        EVID
      </button>
      <button
        className={button + ' !px-1'}
        title={t.incidents}
        aria-label={t.incidents}
        aria-pressed={incidentsVisible}
        onClick={() => setIncidentsVisible((v) => !v)}
      >
        INC
      </button>
      <button
        className={button + ' !px-1'}
        aria-label={t.layers}
        aria-expanded={layersOpen}
        onClick={() => setLayersOpen((v) => !v)}
      >
        …
      </button>
      {layersOpen && (
        <div
          data-gn="conflict-layers"
          className="absolute left-[52px] top-[44px] z-50 w-[260px] border border-sp-line bg-sp-panel p-3"
        >
          <h2>{t.layers}</h2>
          {t.layerNames.map((name) => (
            <p key={name} className="my-2 text-[11px] text-sp-ink-3">
              {name} · {t.unavailable}
            </p>
          ))}
        </div>
      )}
    </div>
  );
  const rail = (
    <div
      data-gn="conflict-workspace"
      data-assessment={row ? 'SELECTED_OBSERVATION' : 'NOT_MOUNTED_NO_SUBJECT'}
    >
      {phone && (
        <nav className="flex flex-wrap border-b border-sp-line">
          {mapLink}
          {!spatialView && (
            <button
              className={button}
              aria-expanded={layersOpen}
              onClick={() => setLayersOpen((v) => !v)}
            >
              {t.layers}
            </button>
          )}
        </nav>
      )}
      {phone && layersOpen ? (
        <section className={section} data-gn="conflict-layers">
          <button className={button} onClick={() => setLayersOpen(false)}>
            {t.back}
          </button>
          <h2>{t.layers}</h2>
          {t.layerNames.map((name) => (
            <p key={name} className="my-2 text-[11px] text-sp-ink-3">
              {name} · {t.unavailable}
            </p>
          ))}
        </section>
      ) : row ? (
        <>
          <button
            className={button + ' w-full !min-h-[34px] text-left'}
            onClick={() => {
              setSelected(null);
              setDrawer(true);
            }}
          >
            {t.back}
          </button>
          {spatialView ? (
            <section className={section} data-gn="conflict-spatial-evidence">
              <h2>{row.geography.countryIso3 ?? '—'}</h2>
              {details}
            </section>
          ) : (
            <ConflictAssessmentRail
              subjectLabel={
                row.eventType === 'EVENT_TYPE_NOT_CLASSIFIED'
                  ? conflictPlaceLabel(row) + ' · ' + row.temporal.eventStartedAt
                  : t.events[row.eventType] + ' · ' + conflictPlaceLabel(row)
              }
              severity={severityValueOrNull(row.severity)}
              changeStateLabel={null}
              assessment={null}
              confidenceLabel={null}
              geographyLabel={null}
              participants={[]}
              indicators={null}
              readings={null}
              evidenceLine={t.evidence}
              evidenceDetails={details}
              region={null}
              nowMs={0}
              labels={labels}
            />
          )}
        </>
      ) : drawer ? (
        <section className={section} data-gn="conflict-incidents">
          <button className={button} onClick={() => setDrawer(false)}>
            {spatial.conflict.queueHeading}
          </button>
          <h2 className="my-3 font-gn-mono text-[11px] text-sp-ink-3">{t.observations}</h2>
          {rows.length === 0 ? (
            <p>{t.empty}</p>
          ) : (
            <ul>
              {rows.map((item) => {
                const place = conflictPlaceLabel(item);
                const classification =
                  item.eventType === 'EVENT_TYPE_NOT_CLASSIFIED'
                    ? t.observation
                    : t.events[item.eventType];

                return (
                  <li key={item.observationKey}>
                    <button
                      className={button + ' w-full py-3 text-left'}
                      onClick={() => choose(item.observationKey)}
                    >
                      <span className="block text-[12px] font-medium text-sp-ink">
                        {classification}
                      </span>
                      <span className="mt-1 block text-[11px] text-sp-ink-2">
                        {place} · <time>{item.temporal.eventStartedAt}</time>
                      </span>
                      <span className="mt-1 block font-gn-mono text-[8.5px] uppercase tracking-[0.08em] text-sp-ink-3">
                        {spatial.context.levels[item.geography.precision]} ·{' '}
                        {spatial.card.provenanceValues[item.geography.locationProvenance]}
                      </span>
                      <span className="mt-1 block break-all font-gn-mono text-[8px] text-sp-ink-3/70">
                        {t.sourceEventId}: {item.identity.upstreamEventId}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      ) : (
        <>
          <ContextSummaryPanel
            mode="WORLD"
            period="24H"
            totals={evidenceTotals(records)}
            ranked={[]}
            noEvidence={[]}
            queue={queue}
            labels={{ ...spatial.context, queueUnavailable: t.unordered }}
          />
          <section className={section} data-gn="conflict-evidence-status" aria-live="polite">
            <h2 className="mb-2 font-gn-mono text-[10px] uppercase text-sp-ink-3">{t.evidence}</h2>
            <p className="text-[12px] text-sp-ink-2">
              {status === 'loading'
                ? t.loading
                : status === 'error'
                  ? t.error
                  : rows.length === 0
                    ? t.empty
                    : rows.length + ' ' + t.records}
            </p>
            {status === 'ready' && rows.length > 0 && (
              <p className="mt-2 font-gn-mono text-[8.5px] uppercase tracking-[0.1em] text-sp-ink-3">
                {stats.retained} {t.retainedCount} · {stats.drawable} {t.drawableCount} ·{' '}
                {stats.withheld} {t.withheldCount}
              </p>
            )}
            {status === 'error' ? (
              <button className={button} onClick={() => setAttempt((n) => n + 1)}>
                {t.retry}
              </button>
            ) : status === 'ready' && rows.length > 0 ? (
              <button
                className={button + ' mt-3'}
                onClick={() => {
                  setDrawer(true);
                  setStop('HALF');
                }}
              >
                {t.observations}
              </button>
            ) : null}
          </section>
        </>
      )}
    </div>
  );
  return (
    <main
      className="conflict-dashboard fixed inset-0 overflow-hidden bg-sp-bg text-sp-ink"
      data-gn="conflict-dashboard"
    >
      {mounted &&
        (phone ? (
          <>
            <EvidenceMapCanvas
              camera={camera}
              origin={origin}
              onGesture={(value) => {
                setOrigin('gesture');
                setCamera(value);
              }}
              fitBounds={fitBounds}
              onBoundsResolved={(value) => {
                setFitBounds(null);
                setOrigin('control');
                setCamera(value);
              }}
              fitInset={() => ({
                top: 78,
                bottom:
                  stop === 'PEEK'
                    ? 54
                    : Math.floor(window.innerHeight * (stop === 'HALF' ? 0.5 : 0.9)),
              })}
              ariaLabel={t.title}
              interactionHint={t.base}
              evidenceRecords={spatialView ? [] : visibleRecords}
              onSelectEvidence={choose}
              language={language}
              labelNames={{
                continents: spatial.continents,
                waters: spatial.waters,
                territories: spatial.territories,
              }}
            />
            <header className="absolute inset-x-0 top-0 flex h-[46px] items-center justify-between border-b border-sp-line bg-sp-top-a px-3">
              <a href="/" className="font-gn-mono text-[10px]">
                {spatialView ? spatial.topBar.brandSub : t.title}
              </a>
              <MapLanguageControl
                value={language}
                label={spatial.topBar.languageGroup}
                onChange={(next) => {
                  save();
                  persistLanguageSelection(next);
                  const url = new URL(location.href);
                  url.searchParams.set('restore', '1');
                  location.assign(url);
                }}
              />
            </header>
            <p
              className="absolute inset-x-0 top-[46px] h-[32px] truncate bg-sp-panel px-3 py-2 font-gn-mono text-[9px]"
              title={t.base}
            >
              {t.base}
            </p>
            {stop !== 'FULL' && (
              <div
                className="absolute right-3 flex flex-col"
                style={{
                  bottom: stop === 'PEEK' ? 66 : 'calc(50% + 12px)',
                }}
              >
                {[1, -1].map((delta) => (
                  <button
                    key={delta}
                    className={button + ' bg-sp-panel text-lg'}
                    aria-label={delta === 1 ? t.zoomIn : t.zoomOut}
                    onClick={() => {
                      setOrigin('control');
                      setCamera(normaliseCamera({ ...camera, zoom: camera.zoom + delta }));
                    }}
                  >
                    {delta === 1 ? '+' : '−'}
                  </button>
                ))}
              </div>
            )}
            <MobileBottomSheet
              geometry={CONFLICT_DETENTS}
              stop={stop}
              onStopChange={setStop}
              labels={{
                sheetLabel: t.sheet,
                handleLabel: t.expand,
                stops: { PEEK: '54px', HALF: '50%', FULL: '90%' },
              }}
            >
              {rail}
            </MobileBottomSheet>
          </>
        ) : (
          <GlobalMapShell
            language={language}
            initialCamera={camera}
            initialCameraRestored
            onCameraChange={setCamera}
            requestedCamera={requestedCamera}
            retainedWindowLabel={t.evidence}
            contextQueue={queue}
            specialistLayers={spatialView ? undefined : layers}
            specialistNavigation={mapLink}
            specialistRail={rail}
            specialistLabel={spatialView ? spatial.topBar.brandSub : t.title}
            evidenceSet={spatialView ? { ...evidenceSet, records: [] } : evidenceSet}
            retainedWindow
            onSelectEvidence={choose}
          />
        ))}
    </main>
  );
}
