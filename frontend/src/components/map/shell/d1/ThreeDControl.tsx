'use client';

/**
 * THE 3D CONTROL — lower-left cluster, third control (specification §3d).
 *
 * Product-Owner ruling 3 settled the question that gated this: a precision /
 * provenance halo MAY be rendered over a photographic or topographic underlay,
 * as a GN semantic overlay, in the order basemap -> halo -> evidence ->
 * labels/HUD. So a 3D control is legitimate rather than a semantics hazard.
 *
 * IT IS A SEPARATE CONTROL FROM THE GLOBE LOCATOR and must stay one. The two
 * sit in the same cluster and would be easy to fold together — a globe that
 * also turns the globe on. The specification forbids exactly that, and
 * `controlsMayMerge('globe-locator','three-d')` returns `false` so the rule has
 * a call site rather than only a comment.
 *
 * UNAVAILABLE IS NOT THE SAME AS OFF, and this component keeps them apart. Off
 * is a state the reader chose. Unavailable is the product saying it cannot do
 * this here — with the reason attached, never as a silently inert button. That
 * is the same "unavailable rather than empty" rule the layer rail follows.
 */
export interface ThreeDControlProps {
  readonly enabled: boolean;
  readonly available: boolean;
  /** Why it is unavailable, shown to the reader. Required when not available. */
  readonly unavailableReason?: string;
  readonly label: string;
  readonly onToggle?: (next: boolean) => void;
}

export function ThreeDControl({
  enabled,
  available,
  unavailableReason,
  label,
  onToggle,
}: ThreeDControlProps): JSX.Element {
  const reason = available ? null : (unavailableReason ?? null);

  return (
    <button
      type="button"
      data-gn-control="three-d"
      data-gn-cluster="lower-left"
      /* The inverse of the locator's marker, so a merge fails a test from both
         sides rather than only from one. */
      data-gn-is-globe-locator="false"
      data-gn-state={available ? (enabled ? 'on' : 'off') : 'unavailable'}
      aria-pressed={available ? enabled : undefined}
      aria-disabled={available ? undefined : 'true'}
      disabled={!available}
      onClick={available && onToggle ? () => onToggle(!enabled) : undefined}
      aria-label={reason === null ? label : `${label} — ${reason}`}
      title={reason === null ? label : `${label} — ${reason}`}
      className={
        available
          ? 'flex h-11 w-11 items-center justify-center rounded-[9px] border border-[#22303f] bg-[rgba(5,8,13,0.86)] font-gn-mono text-[11px] uppercase tracking-[0.12em] text-[#a9bccf] transition-colors hover:border-[rgba(34,211,238,0.55)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gn-focus'
          : 'flex h-11 w-11 cursor-not-allowed items-center justify-center rounded-[9px] border border-[#1a222c] bg-[rgba(5,8,13,0.5)] font-gn-mono text-[11px] uppercase tracking-[0.12em] text-[#54687f]'
      }
    >
      3D
    </button>
  );
}
