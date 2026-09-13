'use client';

import { railLayers, type LayerDefinition } from '@/lib/map/layers/layerRegistry';

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
}

export interface LayersControlProps {
  readonly state: Readonly<Record<string, boolean>>;
  readonly labels: LayersControlLabels;
  readonly onToggle?: (layerId: string, next: boolean) => void;
  /** Test seam. Defaults to the registry's own rail set. */
  readonly layers?: readonly LayerDefinition[];
}

export function LayersControl({ state, labels, onToggle, layers }: LayersControlProps): JSX.Element {
  const rows = layers ?? railLayers();

  return (
    <section
      data-gn-control="layers"
      data-gn-cluster="lower-left"
      aria-label={labels.title}
      className="rounded-[9px] border border-[#22303f] bg-[rgba(5,8,13,0.86)] p-2"
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
                aria-label={live ? name : `${name} — ${statusLabel}: ${layer.runtimeEvidence}`}
                title={live ? name : `${name} — ${statusLabel}`}
                className={
                  live
                    ? 'flex min-h-[44px] w-full items-center gap-2 px-1 text-left font-gn-mono text-[11px] uppercase tracking-[0.12em] text-[#a9bccf] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-gn-focus'
                    : 'flex min-h-[44px] w-full cursor-not-allowed items-center gap-2 px-1 text-left font-gn-mono text-[11px] uppercase tracking-[0.12em] text-[#54687f]'
                }
              >
                <span aria-hidden="true" className="inline-block h-[8px] w-[8px] shrink-0 rounded-[2px] border border-current">
                  {on ? '' : ''}
                </span>
                <span className="min-w-0 truncate">{name}</span>
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
