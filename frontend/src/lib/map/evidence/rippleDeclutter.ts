export interface ProjectedRippleCandidate {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly amber: boolean;
}

/**
 * Declutter only the ANIMATION layer. Static evidence cores remain complete.
 *
 * The threshold is derived from the Design ripple diameter supplied by the
 * caller. At world/region zooms, overlapping 26px ripples are redundant motion
 * around already-visible static cores; at local zooms every retained mark may
 * ripple again.
 */
export function declutterProjectedRipples(
  candidates: readonly ProjectedRippleCandidate[],
  zoom: number,
  rippleDiameterPx: number,
): readonly ProjectedRippleCandidate[] {
  if (!Number.isFinite(zoom) || !Number.isFinite(rippleDiameterPx) || rippleDiameterPx <= 0) {
    return candidates;
  }

  const separation =
    zoom < 3
      ? rippleDiameterPx * 1.25
      : zoom < 5
        ? rippleDiameterPx
        : 0;

  if (separation === 0) return candidates;

  const kept: ProjectedRippleCandidate[] = [];
  for (const candidate of candidates) {
    const collides = kept.some(
      (existing) =>
        Math.abs(existing.x - candidate.x) < separation &&
        Math.abs(existing.y - candidate.y) < separation,
    );
    if (!collides) kept.push(candidate);
  }

  return kept;
}
