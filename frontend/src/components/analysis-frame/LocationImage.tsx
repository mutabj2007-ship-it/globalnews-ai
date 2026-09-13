'use client';

import type { LanguageCode } from '@globalnews-ai/shared';
import type { GeographicPrecision } from '../search/analysisDimensions';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { resolveLocationImage, type LocationAssetRegistry } from './locationAssets';

/**
 * P-09 — the precision-integrity component (handoff §7).
 *
 * `precision` is REQUIRED and there is no default. `resolvedPlace` is the
 * RESOLVED place. Neither the query nor the article record is reachable
 * from this component, so rendering above the resolved precision is not
 * a mistake that can be made here — it would require a new prop.
 *
 * CHIP vs LABEL (04 §3, §7.3). The provenance chip is the one element
 * the spec promises never yields: fixed size, fixed top-left position,
 * opaque ground so it holds contrast over arbitrary photography. Below
 * an 84px wrapper the in-image LABEL bottom-aligns and shortens. The
 * label yields; the provenance device does not.
 *
 * PAF-R1.2 — THE `strip` TIER, and why it had to exist. Compressed row 1
 * is 52px. The smallest previous tier came to 80px with its caption, so
 * the panel rendered its own provenance text sliced through the middle.
 * F-7 says compress before hide, so removing the figure was not available:
 * the answer is a tier that actually fits. `strip` is sized to the ONE
 * element that may not yield — the chip's 18px plus its 7px margins, 32px
 * exactly — and applies §7.3's own priority to everything else: the
 * in-image label yields (it is suppressed), the caption stays (it is the
 * provenance claim, not decoration) at a reduced size. 3 + 32 + 3 + 8 = 46
 * inside a 52px row, with the wrapper's own 6px of padding.
 */

export type LocationImageTier = 'expanded' | 'compressed' | 'tight' | 'strip';

const WRAPPER_HEIGHT: Readonly<Record<LocationImageTier, number>> = {
  expanded: 148,
  compressed: 84,
  tight: 56,
  strip: 32,
};

/** At or below this the in-image label is suppressed — the chip owns the band. */
export const LABEL_SUPPRESSED_AT_OR_BELOW = 32;

/** Below this the in-image label bottom-aligns rather than centring. */
export const LABEL_BOTTOM_ALIGN_BELOW = 84;

export interface LocationImageProps {
  /** RESOLVED precision. Required by design — see §7. */
  precision: GeographicPrecision;
  /** RESOLVED place. Null whenever nothing was resolved. */
  resolvedPlace: string | null;
  tier?: LocationImageTier;
  language?: LanguageCode;
  /** Injectable only so tests can exercise the asset branch. */
  registry?: LocationAssetRegistry;
}

export function LocationImage({
  precision,
  resolvedPlace,
  tier = 'expanded',
  language = 'en',
  registry,
}: LocationImageProps): JSX.Element | null {
  const t = getDictionary(language).analysisFrame;
  const decision = resolveLocationImage({ precision, resolvedPlace }, registry);

  // 09 §3 / §7 row 3: the element is ABSENT, never an empty <img> with
  // an alt apology.
  if (decision.kind === 'suppressed-unresolved') return null;

  const height = WRAPPER_HEIGHT[tier];
  const labelBottomAligned = height < LABEL_BOTTOM_ALIGN_BELOW;
  // §7.3: the label yields, the provenance device does not. At 32px the
  // band is exactly the chip, so the label is the thing that goes.
  const labelSuppressed = height <= LABEL_SUPPRESSED_AT_OR_BELOW;

  const chip = (
    <span
      data-paf="provenance-chip"
      className="pointer-events-none absolute left-0 top-0 m-[7px] inline-flex h-[18px] shrink-0 items-center gap-[5px] rounded-[3px] border border-[#2a3a4d] bg-[rgba(5,8,13,.88)] px-[6px] font-gn-mono text-[12px] md:text-[11px] uppercase leading-none tracking-[0.14em] text-[#94a3b8]"
    >
      {/* provenance-grey, never verified-green: article imagery in the
          dock and library carries a GREEN chip with different words in a
          different position (§7.2). */}
      <span aria-hidden="true" className="inline-block h-[4px] w-[4px] rounded-full bg-[#94a3b8]" />
      {t.locationContextChip} · {decision.place}
    </span>
  );

  return (
    <figure data-paf="location-image" className="m-0">
      <div
        className="relative w-full overflow-hidden rounded-[10px] border border-[#16202e] bg-[#071016]"
        style={{ height: `${height}px` }}
      >
        {decision.kind === 'asset' ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={decision.src}
            alt={t.locationImageAlt.replace('{place}', decision.place)}
            className="h-full w-full object-cover"
          />
        ) : (
          <div
            data-paf="no-verified-image"
            role="img"
            aria-label={`${t.noVerifiedLocationImage} · ${decision.place}`}
            className="h-full w-full"
            style={{
              backgroundImage:
                'repeating-linear-gradient(135deg, rgba(148,163,184,.09) 0 6px, transparent 6px 12px)',
            }}
          >
            {labelSuppressed ? null : (
            <span
              data-paf="in-image-label"
              data-align={labelBottomAligned ? 'bottom' : 'centre'}
              className={
                labelBottomAligned
                  ? 'absolute inset-x-0 bottom-0 px-[5px] pb-[5px] text-center font-gn-mono text-[12px] md:text-[11px] uppercase tracking-[0.12em] text-[#54687f]'
                  : 'absolute inset-0 flex items-center justify-center px-3 text-center font-gn-mono text-[12px] md:text-[11px] uppercase tracking-[0.12em] text-[#54687f]'
              }
            >
              {t.noVerifiedLocationImage}
              {labelBottomAligned ? '' : ` · ${decision.place}`}
            </span>
            )}
          </div>
        )}
        {chip}
      </div>
      {/* The caption strip is never dropped for space, in any tier. */}
      <figcaption
        data-paf="provenance-caption"
        className={
          labelSuppressed
            ? 'mt-[3px] truncate font-gn-mono text-[12px] md:text-[11px] leading-[1.2] text-[#4b7f8c]'
            : 'mt-[6px] font-gn-mono text-[12px] md:text-[11px] leading-[1.35] text-[#4b7f8c]'
        }
      >
        {t.representativeImagery}
      </figcaption>
    </figure>
  );
}
