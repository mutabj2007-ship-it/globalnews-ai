'use client';

import {
  type LayerDefinition,
  RAIL_EVIDENCE_LAYERS,
  layerVisibleAtZoom,
  railLayers,
} from '@/lib/map/layers/layerRegistry';
import type { MapMode } from '@/lib/map/state/mapState';
import { BAND_CLASS, bandFor } from '@/lib/map/spatial/controlBands';

/**
 * SPATIAL M2 — THE LAYER RAIL, FROM DESIGN PART II §2.
 *
 * "READS THE LAYER REGISTRY, renders toggles the surface permits, persists per
 * user. Horizontal chip strip below 860 px."
 *
 * It holds no list of its own. Every layer it can show comes from
 * `layerRegistry.ts`, which is also where each layer's CLASS, zoom range,
 * licence and data availability live — so a layer cannot be drawn on the map
 * without appearing here with its licence recorded, and cannot appear here
 * without existing in the registry the renderer reads.
 *
 * ── THREE HONEST STATES, NOT TWO ──────────────────────────────────────────
 *
 * ON / OFF is the obvious pair, and it is not enough.
 *
 *   UNAVAILABLE   the dataset does not exist yet (admin-1 and admin-2 are
 *                 Missing · M7). Disabled, with the reason stated. A toggle
 *                 that switches on and draws nothing teaches the user that the
 *                 world is empty there, which is the same lie as an empty map.
 *
 *   OUT OF RANGE  the layer is on, but the camera is outside its declared zoom
 *                 range — rivers are 4–11, admin-2 is 8–13. The toggle stays
 *                 ON, because the user's preference is unchanged; what is
 *                 shown is that it is not drawing AT THIS ZOOM. Silently
 *                 rendering an enabled toggle over an empty map is how a user
 *                 concludes the data is missing rather than that they are too
 *                 far out.
 *
 * ── CLASS IS DISPLAYED, NOT JUST STORED ───────────────────────────────────
 *
 * Part I §F: reference is "geography the world has", evidence is "geography
 * the platform knows". The rail groups by class and says which is which,
 * because a user toggling a district outline on needs to know that doing so
 * reveals more world and not more evidence — the governing rule of §G, made
 * visible at the control that would otherwise imply the opposite.
 */

/**
 * THE GLYPH VOCABULARY, FROM THE DESIGN PROTOTYPE ITSELF.
 *
 * My earlier package declared a labelled 150 px rail as a deviation, on the
 * grounds that the spec gave no icon vocabulary for fourteen layers. That was
 * wrong: Part III's mockups and the prototype's own `LAYERS` table supply it —
 * `◈ EVID`, `◇ SRC`, `◎ WATCH`, `⬡ SITU`, a separator, `≈ WATER`, `A LABEL`,
 * `# GRID`. The deviation is withdrawn and the 52 px iconographic rail the
 * spec asks for is implemented.
 *
 * A layer with no glyph in the prototype falls back to its first letter rather
 * than to an invented symbol — an unfamiliar glyph is worse than a letter,
 * and the tooltip and the accessible name always carry the full label.
 */
const GLYPH: Readonly<Record<string, string>> = {
  countryEvidence: '◈',
  evidencePoints: '◈',
  sourceDensity: '◇',
  watch: '◎',
  situations: '⬡',
  hydrography: '≈',
  rivers: '≈',
  labels: 'A',
  graticule: '#',
  base: '▦',
  admin0: '⬟',
  admin1: '⬡',
  admin2: '⬢',
  places: '·',
};

/** The prototype's short technical codes. Falls back to the layer id. */
const CODE: Readonly<Record<string, string>> = {
  countryEvidence: 'EVID',
  evidencePoints: 'PTS',
  sourceDensity: 'SRC',
  watch: 'WATCH',
  situations: 'SITU',
  hydrography: 'WATER',
  rivers: 'RIVER',
  labels: 'LABEL',
  graticule: 'GRID',
  base: 'LAND',
  admin0: 'ADM0',
  admin1: 'ADM1',
  admin2: 'ADM2',
  places: 'CITY',
};

export interface LayerToggleRailLabels {
  readonly group: string;
  readonly layers: Readonly<Record<string, string>>;
  readonly reference: string;
  readonly evidence: string;
  readonly unavailable: string;
  readonly outOfRange: string;
}

export interface LayerToggleRailProps {
  readonly mode: MapMode;
  readonly zoom: number;
  readonly state: Readonly<Record<string, boolean>>;
  readonly onToggle: (layerId: string, next: boolean) => void;
  readonly labels: LayerToggleRailLabels;
  /** Horizontal chip strip below 860px — Part II §2 and §5. */
  readonly orientation?: 'vertical' | 'horizontal';
  readonly className?: string;
  /**
   * PART IV §14.5 — THE FIFTH ICON, BELOW A DIVIDER.
   *
   * The watchboard is the ONLY alert affordance over the map (§8.3): alerts
   * never arrive as toasts, they accumulate and are opened deliberately. It
   * sits below a divider because it is not a layer — it toggles nothing on the
   * canvas — and grouping it with the layers would say it was one.
   *
   * Optional, so a rail rendered without it is exactly the accepted rail.
   */
  readonly watchboard?: {
    readonly label: string;
    /** Amber, capped at 9+ by §8.3. `0` renders no badge at all. */
    readonly unread: number;
    readonly onOpen: () => void;
  } | null;
}

export function LayerToggleRail({
  mode,
  zoom,
  state,
  onToggle,
  labels,
  orientation = 'vertical',
  className = '',
  watchboard = null,
}: LayerToggleRailProps): JSX.Element {
  /*
    The rail is STABLE across modes — see `railLayers()`. `mode` is still a prop
    because the availability copy may one day differ by mode, and because a rail
    that silently ignored it would be lying about what it reads.
  */
  void mode;
  const offered = railLayers();

  const renderGroup = (heading: string, layers: readonly LayerDefinition[]): JSX.Element | null => {
    if (layers.length === 0) return null;

    return (
      <div key={heading} className={orientation === 'horizontal' ? 'flex items-center gap-[2px]' : 'flex flex-col items-center gap-[4px]'}>
        {layers.map((layer) => {
          const on = state[layer.id] === true;
          const inRange = layerVisibleAtZoom(layer, zoom);
          const drawing = on && layer.available && inRange;
          const status = !layer.available ? 'unavailable' : !inRange ? 'out-of-range' : on ? 'on' : 'off';
          const code = CODE[layer.id] ?? layer.id.slice(0, 5).toUpperCase();
          const reason = !layer.available
            ? labels.unavailable
            : !inRange
              ? `${labels.outOfRange} (Z${layer.zoomRange[0]}–${layer.zoomRange[1]})`
              : null;

          return (
            <button
              key={layer.id}
              type="button"
              role="switch"
              aria-checked={on}
              disabled={!layer.available}
              data-gn="layer-toggle"
              data-gn-layer={layer.id}
              data-gn-class={layer.class}
              data-gn-status={status}
              data-gn-drawing={drawing}
              /*
                THE FULL LABEL AND THE REASON TRAVEL WITH THE CONTROL.
                A 52 px rail shows a glyph and a five-character code; the
                accessible name is the whole label, and a disabled control
                always states WHY. An icon rail that explains nothing is how a
                dense HUD becomes unreadable.
              */
              aria-label={reason ? `${labels.layers[layer.id] ?? layer.id} — ${reason}` : (labels.layers[layer.id] ?? layer.id)}
              title={reason ? `${labels.layers[layer.id] ?? layer.id} — ${reason}` : (labels.layers[layer.id] ?? layer.id)}
              onClick={() => {
                if (!layer.available) return;
                onToggle(layer.id, !on);
              }}
              /*
                DESIGN v1.6 — the three bands.

                `available` is the BUILT question: a layer with no data behind
                it is UNBUILT, and a layer that is simply switched off is
                AVAILABLE. Those two were previously separated only by opacity
                on the same ink, which is exactly the collapse the revision
                names — a reader could not tell "off" from "does not exist".

                `on && !drawing` — a layer enabled but drawing nothing right now
                — keeps its own brighter-than-idle treatment on top of the
                AVAILABLE band, because it is neither the active layer nor an
                untouched one.
              */
              className={`flex h-[38px] w-[38px] shrink-0 cursor-pointer flex-col items-center justify-center gap-[3px] rounded-[3px] border font-gn-mono text-[8px] tracking-[0.06em] ${
                BAND_CLASS[bandFor({ active: drawing, built: layer.available })]
              } ${on && !drawing ? 'text-sp-ui-hover' : ''}`}
            >
              <span aria-hidden="true" className="text-[13px] leading-none">
                {GLYPH[layer.id] ?? (labels.layers[layer.id] ?? layer.id).charAt(0).toUpperCase()}
              </span>
              <span aria-hidden="true">{code}</span>
              {/*
                OUT OF RANGE IS SHOWN, NOT HIDDEN. The toggle stays ON — the
                user's preference has not changed — and a hairline says it is
                not drawing at this zoom. Silently rendering an enabled toggle
                over an empty map is how a reader concludes the data is missing
                rather than that they are too far out.
              */}
              {layer.available && on && !inRange && (
                <span data-gn="layer-out-of-range" aria-hidden="true" className="h-[2px] w-[14px] bg-sp-amber" />
              )}
            </button>
          );
        })}
      </div>
    );
  };

  return (
    <div
      data-gn="map-layer-rail"
      data-gn-orientation={orientation}
      aria-label={labels.group}
      role="group"
      className={`${
        orientation === 'horizontal'
          ? 'flex items-center gap-[6px] overflow-x-auto'
          : 'flex flex-col items-center gap-[4px]'
      } ${className}`}
    >
      {renderGroup(labels.evidence, offered.filter((l) => RAIL_EVIDENCE_LAYERS.includes(l.id)))}
      {/* The prototype's own divider between evidence and reference layers. */}
      <span
        aria-hidden="true"
        data-gn="rail-separator"
        className={orientation === 'horizontal' ? 'mx-[6px] h-[22px] w-px shrink-0 bg-sp-line' : 'my-[6px] h-px w-[26px] bg-sp-line'}
      />
      {renderGroup(labels.reference, offered.filter((l) => !RAIL_EVIDENCE_LAYERS.includes(l.id)))}

      {/*
        ── PART IV §14.5 · THE WATCHBOARD ICON, BELOW ITS OWN DIVIDER ───────

        Not a layer: it toggles nothing on the canvas, so it is separated from
        the layer groups rather than appended to them. §8.3 makes it the ONLY
        alert affordance over the map — alerts never arrive as toasts — and the
        count is amber because an unread alert is attention, capped at 9+ so a
        busy world cannot widen the rail.

        MINT WOULD BE WRONG HERE. Mint says a watch is RUNNING; this badge says
        something is UNREAD, which is attention and therefore amber.
      */}
      {watchboard !== null && (
        <>
          <span
            aria-hidden="true"
            data-gn="rail-separator"
            className={
              orientation === 'horizontal'
                ? 'mx-[6px] h-[22px] w-px shrink-0 bg-sp-line'
                : 'my-[6px] h-px w-[26px] bg-sp-line'
            }
          />
          <button
            type="button"
            data-gn="rail-watchboard"
            aria-label={watchboard.label}
            title={watchboard.label}
            onClick={watchboard.onOpen}
            className="relative flex h-[38px] w-[38px] shrink-0 cursor-pointer items-center justify-center rounded-[3px] border border-[rgba(126,166,186,.14)] bg-[rgba(126,166,186,.045)] text-sp-ui-idle outline-none transition-[color,background-color,border-color] duration-[140ms] hover:border-[rgba(126,166,186,.3)] hover:bg-[rgba(126,166,186,.11)] hover:text-sp-ui-hover focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-1 focus-visible:outline-sp-cyan"
          >
            {/* Concentric rings: a standing assignment, not a bell. */}
            <span
              aria-hidden="true"
              className="block h-[13px] w-[13px] rounded-full border-[1.5px] border-current"
            >
              <span className="mt-[3px] ml-[3px] block h-[4px] w-[4px] rounded-full bg-current" />
            </span>
            {watchboard.unread > 0 && (
              <span
                data-gn="rail-watchboard-count"
                className="absolute -right-[3px] -top-[3px] min-w-[15px] rounded-full border border-sp-amber/60 bg-sp-panel px-[3px] text-center font-gn-mono text-[8px] leading-[13px] text-sp-amber"
              >
                {watchboard.unread > 9 ? '9+' : watchboard.unread}
              </span>
            )}
          </button>
        </>
      )}
    </div>
  );

}
