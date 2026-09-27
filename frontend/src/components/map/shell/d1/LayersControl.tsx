'use client';

import { useState } from 'react';
import { railLayers, type LayerDefinition } from '@/lib/map/layers/layerRegistry';
import {
  GRATICULE_RAIL_KEY,
  graticuleGuaranteedAtZoom,
} from '@/lib/map/reference/graticule';

/**
 * THE LAYERS CONTROL — lower-left cluster, second control (specification §3d).
 *
 * Product-Owner ruling 5 is the whole design of this component:
 *
 *   "A layer may be visible/toggleable only if implementation exists AND
 *    runtime backing exists AND activation gate is green. Otherwise classify
 *    GATED / NOT IMPLEMENTED / FAILED MEASUREMENT. Do not create decorative
 *    toggles."
 *
 * So the enabled/disabled decision is NOT taken here. It is read from
 * `layer.runtime`, which the registry derives from measured runtime capability,
 * and `available` is derived from that in turn. A component that decided for
 * itself would be a second opinion, and the second opinion is how `watch` came
 * to be offered as an enabled toggle over a runtime that does not exist.
 *
 * A NON-LIVE LAYER IS SHOWN, NOT HIDDEN — with its status and its reason. The
 * reader learns that Situations exist and are not yet available, which is true;
 * hiding them would teach that they do not exist, which is not. This is the
 * same "unavailable rather than empty" rule the modes already follow, and it is
 * the opposite decision from the Watch composer, which is HIDDEN because there
 * a control would be an activation affordance rather than a statement.
 */
export interface LayersControlLabels {
  readonly title: string;
  readonly layers: Readonly<Record<string, string>>;
  readonly status: Readonly<Record<string, string>>;
  /**
   * "On, but not guaranteed to be visible at this scale" — R2-B §8.
   *
   * The GRID reported as dead is not dead. It draws under the land and over
   * the ocean, at 10° spacing, so a reader zoomed to a country is looking at a
   * viewport that is nearly all land and may not contain a single line. The
   * control worked; the map simply had nothing to show them.
   *
   * See `graticule.ts` for why none of that is changed and a note is issued
   * instead.
   */
  readonly outOfScale: string;
}

export interface LayersControlProps {
  readonly state: Readonly<Record<string, boolean>>;
  readonly labels: LayersControlLabels;
  readonly onToggle?: (layerId: string, next: boolean) => void;
  /** Test seam. Defaults to the registry's own rail set. */
  readonly layers?: readonly LayerDefinition[];
  /**
   * The camera's current zoom, for the scale note above.
   *
   * Optional, and its absence means NO NOTE rather than a guessed one: a
   * surface that does not pass a camera has not told this control anything
   * about scale, and inventing one would be worse than staying quiet.
   */
  readonly zoom?: number;
  /**
   * MAP / SPATIAL VISUAL CONVERGENCE R2 — D1 §3d names Layers a CONTROL beside
   * the globe locator and 3D, not a standing panel. Collapsible, it is one
   * 44px control and the rows open above it on demand; the always-open list
   * was taller than the map's lower third and collided with the legend and
   * the precision banner. Absent, the component renders exactly as before.
   */
  readonly collapsible?: boolean;
}

export function LayersControl(props: LayersControlProps): JSX.Element {
  const [open, setOpen] = useState(false);

  if (props.collapsible !== true) return <LayerPanel {...props} />;

  const onCount = (props.layers ?? railLayers()).filter(
    (layer) => layer.runtime === 'LIVE' && props.state[layer.id] === true,
  ).length;

  return (
    <div data-gn-control="layers" data-gn-cluster="lower-left" data-gn-layers-open={open ? 'true' : 'false'} className="flex flex-col-reverse items-start gap-2">
      <button
        type="button"
        data-gn="layers-toggle"
        aria-expanded={open}
        onClick={() => setOpen((was) => !was)}
        className={`flex h-11 items-center gap-2 rounded-[9px] border bg-[rgba(5,8,13,0.86)] px-3 font-gn-mono text-[11px] uppercase tracking-[0.12em] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gn-focus ${
          open
            ? 'border-[rgba(34,211,238,0.55)] text-sp-cyan'
            : 'border-[#22303f] text-[#a9bccf] hover:border-[rgba(34,211,238,0.55)]'
        }`}
      >
        <span aria-hidden="true" className="inline-block h-[9px] w-[9px] rotate-45 border border-current" />
        {props.labels.title}
        <span aria-hidden="true" className="text-[#54687f]">{onCount}</span>
      </button>
      {open && (
        <div data-gn="layers-popover" className="w-[272px]">
          <LayerPanel {...props} embedded />
        </div>
      )}
    </div>
  );
}

function LayerPanel({
  state,
  labels,
  onToggle,
  layers,
  zoom,
  embedded = false,
}: LayersControlProps & { readonly embedded?: boolean }): JSX.Element {
  const rows = layers ?? railLayers();

  return (
    <section
      {...(embedded ? {} : { 'data-gn-control': 'layers', 'data-gn-cluster': 'lower-left' })}
      aria-label={labels.title}
      className="rounded-[9px] border border-[#22303f] bg-[rgba(5,8,13,0.94)] p-2"
    >
      <h2 className="px-1 pb-1 font-gn-mono text-[11px] uppercase tracking-[0.16em] text-[#54687f]">
        {labels.title}
      </h2>
      <ul className="flex flex-col">
        {rows.map((layer) => {
          const live = layer.runtime === 'LIVE';
          const on = live && state[layer.id] === true;
          const statusLabel = labels.status[layer.runtime] ?? layer.runtime;
          const name = labels.layers[layer.id] ?? layer.id;
          /*
            R2-B §8 — THE ONE LAYER WITH A SCALE CONTRACT.

            Keyed off the graticule's own rail key rather than a list kept
            here, so the module that owns the contract is the module that says
            which layer has one. Only raised when the layer is ON: a reader who
            has not turned it on is not owed an explanation of where it would
            have appeared.
          */
          const outOfScale =
            on &&
            layer.id === GRATICULE_RAIL_KEY &&
            zoom !== undefined &&
            !graticuleGuaranteedAtZoom(zoom);

          return (
            <li key={layer.id}>
              <button
                type="button"
                data-gn-layer={layer.id}
                data-gn-layer-runtime={layer.runtime}
                data-gn-layer-toggleable={live ? 'true' : 'false'}
                aria-pressed={live ? on : undefined}
                aria-disabled={live ? undefined : 'true'}
                disabled={!live}
                onClick={live && onToggle ? () => onToggle(layer.id, !on) : undefined}
                /*
                  The reason travels in the accessible name, not only in a
                  tooltip: a disabled control whose explanation is hover-only is
                  unexplained to a keyboard or screen-reader user, and this is
                  precisely the population most likely to be told "nothing here".
                */
                data-gn-layer-scale={outOfScale ? 'out-of-scale' : undefined}
                aria-label={
                  live
                    ? outOfScale
                      ? `${name} — ${labels.outOfScale}`
                      : name
                    : `${name} — ${statusLabel}: ${layer.runtimeEvidence}`
                }
                title={live ? name : `${name} — ${statusLabel}`}
                className={
                  live
                    ? 'flex min-h-[44px] w-full items-center gap-2 px-1 text-left font-gn-mono text-[11px] uppercase tracking-[0.12em] text-[#a9bccf] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-gn-focus'
                    : 'flex min-h-[44px] w-full cursor-not-allowed items-center gap-2 px-1 text-left font-gn-mono text-[11px] uppercase tracking-[0.12em] text-[#54687f]'
                }
              >
                {/*
                  ══ MAP-COUNTRY-EVIDENCE-LAYER-TOGGLE-1 — THE STATE INDICATOR ══

                  MEASURED LIVE: "DOWODY KRAJOWE clicked repeatedly — checkbox
                  remained OFF." It was never going to look otherwise. This span
                  rendered `{on ? '' : ''}` — two empty strings — inside a fixed
                  8px outlined box, so the ON and OFF states produced
                  BYTE-IDENTICAL markup. A reader could not have seen a change
                  even once the click was wired, and neither could a screenshot.

                  The box is FILLED when on and hollow when off. `aria-pressed`
                  above was always correct; this is the visible half catching up
                  to it, and `data-gn-layer-state` is what a probe can read.
                */}
                <span
                  aria-hidden="true"
                  data-gn-layer-state={live ? (on ? 'on' : 'off') : 'unavailable'}
                  className={`inline-block h-[8px] w-[8px] shrink-0 rounded-[2px] border border-current ${
                    on ? 'bg-current' : 'bg-transparent'
                  }`}
                />
                <span className="min-w-0 truncate">{name}</span>
                {/*
                  STATED, NOT WHISPERED. The reason travels in the accessible
                  name above as well as in this chip, for the same reason the
                  disabled rows' reasons do: an explanation only a mouse can
                  reach is no explanation for the readers most likely to be
                  told "nothing happened".
                */}
                {outOfScale && (
                  <span
                    data-gn="layer-out-of-scale"
                    className="ml-auto shrink-0 rounded-[4px] border border-[#22303f] px-1 text-[10px] tracking-[0.1em] text-[#54687f]"
                  >
                    {labels.outOfScale}
                  </span>
                )}
                {live ? null : (
                  <span className="ml-auto shrink-0 rounded-[4px] border border-[#22303f] px-1 text-[10px] tracking-[0.1em]">
                    {statusLabel}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
