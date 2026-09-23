'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import type { AnalysisApiResponse, LanguageCode } from '@globalnews-ai/shared';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { MapControlCluster } from '@/components/map/shell/d1/MapControlCluster';
import { GlobeLocator } from '@/components/map/shell/d1/GlobeLocator';
import { LayersControl } from '@/components/map/shell/d1/LayersControl';
import { ThreeDControl } from '@/components/map/shell/d1/ThreeDControl';
import { EvidenceLegend } from '@/components/map/shell/EvidenceLegend';
import { ChangeStrip } from '@/components/map/shell/monetization/ChangeStrip';
import {
  buildEvidenceGeography,
  EMPTY_EVIDENCE_GEOGRAPHY,
} from '@/components/analysis-frame/evidenceGeography';
import { globalEvidenceRecords } from '@/lib/map/evidence/globalEvidenceFeed';
import { localisedCountryName } from '@/lib/map/geography/displayName';
import { boundsFromCamera } from '@/lib/map/d1/globeLocatorGeometry';
import { labelDetailFor } from '@/lib/map/d1/mapComposition';
import { defaultLayerState } from '@/lib/map/layers/layerRegistry';
import { normaliseCamera, WORLD_CAMERA, type CameraState } from '@/lib/map/camera/cameraState';
import type { CountryFeature } from '@/lib/map/countryGeometry';
import type { AskStrings } from '@/lib/ask/askStrings';
import { ASK_MICRO } from './AskParts';

const EvidenceMapCanvas = dynamic(
  () => import('@/components/map/shell/EvidenceMapCanvas').then((m) => m.EvidenceMapCanvas),
  { ssr: false },
);

/** v1.8 map/HUD composition over the existing, bundled, request-free spatial renderer.
 * Selection is context only. Only the workspace's evidence projection may colour countries.
 * No raster reference, new provider, invented incident or inferred point coordinates.
 */
export function AskMapColumn({
  t,
  language,
  camera,
  onCamera,
  onSelect,
  selectedIso3,
  response,
  compact = false,
}: {
  t: AskStrings;
  language: LanguageCode;
  camera: CameraState;
  onCamera: (camera: CameraState) => void;
  onSelect: (country: CountryFeature) => void;
  selectedIso3?: string;
  response?: AnalysisApiResponse;
  compact?: boolean;
}): JSX.Element {
  const d = getDictionary(language).map;
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 900, height: 700 });
  const [layers, setLayers] = useState(defaultLayerState);
  const [legendOpen, setLegendOpen] = useState(false);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) =>
      setSize({ width: entry.contentRect.width, height: entry.contentRect.height }),
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  const geography = useMemo(
    () => (response ? buildEvidenceGeography(response) : EMPTY_EVIDENCE_GEOGRAPHY),
    [response],
  );
  const counts = useMemo(
    () => Object.fromEntries(geography.countries.map((c) => [c.iso3, c.articleCount])),
    [geography],
  );
  const records = useMemo(
    () =>
      globalEvidenceRecords(response?.articles ?? [], {
        displayNameFor: (iso3, fallback) => localisedCountryName(iso3, language) ?? fallback,
      }),
    [response, language],
  );
  const bounds = boundsFromCamera(camera.center, camera.zoom, size.width, size.height);
  return (
    <div
      ref={ref}
      data-ask-region="map-canvas"
      data-ask="map-column"
      data-ask-label-detail={labelDetailFor(size.width)}
      className="relative h-full min-h-0 overflow-hidden border border-sp-line bg-sp-bg"
    >
      <EvidenceMapCanvas
        camera={camera}
        origin="control"
        onGesture={onCamera}
        onSelectCountry={onSelect}
        selectedIso3={selectedIso3}
        countryStoryCounts={counts}
        evidenceRecords={records}
        layers={layers}
        language={language}
        ariaLabel={d.shell.canvasLabel}
        interactionHint={d.shell.interactionHint}
        labelNames={{
          continents: d.spatial.continents,
          waters: d.spatial.waters,
          territories: d.spatial.territories,
        }}
      />
      <div
        data-ask-region="change-strip"
        className="pointer-events-none absolute right-[12px] top-[12px] z-20"
      >
        <ChangeStrip states={[]} zoom={camera.zoom} labels={d.spatial.monetization.changeStrip} />
      </div>
      <div
        data-ask="map-zoom"
        data-gn-cluster="top-right"
        className="absolute right-[12px] top-[44px] z-20 flex flex-col rounded border border-sp-line bg-sp-panel"
      >
        {[1, -1].map((delta) => (
          <button
            key={delta}
            type="button"
            aria-label={delta > 0 ? d.shell.zoomIn : d.shell.zoomOut}
            onClick={() => onCamera(normaliseCamera({ ...camera, zoom: camera.zoom + delta }))}
            className="h-11 w-11 text-sp-ink"
          >
            {delta > 0 ? '+' : '−'}
          </button>
        ))}
      </div>
      {!compact && (
        <div
          data-ask="map-lower-left-stack"
          className="pointer-events-none absolute bottom-[44px] left-[12px] z-20 flex max-h-[calc(100%-132px)] flex-col-reverse items-start gap-2 overflow-y-auto"
        >
          <MapControlCluster
            positioned={false}
            label={d.shell.lowerLeftControlsLabel}
            globeLocator={
              <GlobeLocator
                bounds={bounds}
                label={d.shell.globeLocator}
                homeLabel={d.shell.goGlobal}
                onGoGlobal={() => onCamera(WORLD_CAMERA)}
              />
            }
            layers={
              <details className="pointer-events-auto rounded-[9px] border border-sp-line bg-sp-panel">
                <summary className="flex min-h-11 cursor-pointer items-center px-3 text-[10px] uppercase">
                  {d.shell.layersTitle}
                </summary>
                <LayersControl
                  state={layers}
                  zoom={camera.zoom}
                  onToggle={(id, next) => setLayers((current) => ({ ...current, [id]: next }))}
                  labels={{
                    title: d.shell.layersTitle,
                    layers: d.spatial.layers.layers,
                    outOfScale: d.shell.layerOutOfScale,
                    status: {
                      LIVE: d.shell.layerStatusLive,
                      GATED: d.shell.layerStatusGated,
                      NOT_IMPLEMENTED: d.shell.layerStatusNotImplemented,
                      FAILED_MEASUREMENT: d.shell.layerStatusUnmeasured,
                    },
                  }}
                />
              </details>
            }
            threeD={
              <ThreeDControl
                enabled={false}
                available={false}
                unavailableReason={d.shell.threeDUnavailable}
                label={d.shell.threeD}
              />
            }
          />
          <div data-ask="map-legend-island" className="pointer-events-auto">
            <EvidenceLegend
              labels={d.spatial.legend}
              open={legendOpen}
              onToggle={() => setLegendOpen((v) => !v)}
            />
          </div>
        </div>
      )}
      <div
        data-ask-region="evidence-footer"
        className="absolute bottom-0 inset-x-0 z-10 flex flex-wrap gap-x-4 border-t border-sp-line bg-sp-panel/90 px-3 py-[7px]"
      >
        <span className={ASK_MICRO}>{t.regions.evidenceFooter}</span>
        <span className="text-[11px] text-sp-ink-2">
          {response ? `${geography.resolvedArticleCount} / ${geography.totalArticleCount}` : '—'}
        </span>
      </div>
    </div>
  );
}
