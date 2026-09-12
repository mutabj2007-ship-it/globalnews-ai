
import {
  type DisplayPrecision,
  markerStyleFor,
  precisionStatementKeys,
  referenceCeilingForZoom,
} from '@/lib/map/spatial/precisionModel';
import { legendToken } from '@/lib/map/spatial/colourGrammar';
import type { LocationProvenance } from '@/lib/spatial/spatialPrecision';

/**
 * SPATIAL M2 — THE TRUST BANNER, ON THE TWO-AXIS MODEL.
 *
 * Part II §2: "Mandatory on every interactive surface — A MAP WITHOUT IT FAILS
 * REVIEW." Part I §E calls it "the single most important element on the map".
 *
 * WHAT THIS IS FOR, unchanged since M1a. A map invites a reader to believe the
 * thing they are looking at is where the news happened. This line is the
 * standing correction: it states the level at which the surface can honestly
 * speak, so zooming cannot be mistaken for resolving.
 *
 * ── WHAT M2 CHANGED ───────────────────────────────────────────────────────
 *
 * M1a rendered ONE axis and two states, because two were all that could be
 * produced. The spec supersedes that with two independent fields, and Part I
 * §E gives the banner's job precisely: it states "the evidence ceiling of the
 * current SELECTION, or the reference-geography ceiling of the current ZOOM".
 *
 * Both halves are now real:
 *
 *   SELECTED   — precision in words, with provenance APPENDED when it is not
 *                STATED: "City level — location interpreted, unverified".
 *   NOTHING    — the reference ceiling for the zoom, which is a statement
 *   SELECTED     about geography and never about evidence.
 *
 * ── THE PROP THAT LOOKS DANGEROUS AND IS NOT ──────────────────────────────
 *
 * M1a's banner deliberately had no `zoom` prop, so that a zoom level could
 * never become an evidence claim. It has one now, and the guarantee is kept a
 * different way: `zoom` is read ONLY when `precision` is absent, and only
 * through `referenceCeilingForZoom`, whose answer is gated by what reference
 * geometry the deployment actually holds. With a selection present the zoom is
 * not read at all — so zooming still cannot change what is claimed about
 * evidence, which is the property that mattered.
 */

export interface PrecisionBannerLabels {
  /** One entry per precision level the banner may state, plus NONE. */
  readonly levels: Readonly<Record<DisplayPrecision, string>>;
  /** Appended after an em dash when provenance is not STATED. */
  readonly interpreted: string;
  readonly contested: string;
  /** Used when nothing is selected: "Reference geography ceiling — <level>". */
  readonly referencePrefix: string;
  /** Stated when the record claims more than the surface can draw. */
  readonly coarserThanEvidence: string;
  /** Part I §G's governing sentence, printed under the level. */
  readonly governingRule: string;
}

export interface PrecisionBannerProps {
  /** Absent means nothing is selected — the banner falls to the reference ceiling. */
  readonly precision?: DisplayPrecision;
  readonly provenance?: LocationProvenance;
  /** Read ONLY when `precision` is absent. See the note above. */
  readonly zoom?: number;
  /** The finest level this surface holds geometry for. */
  readonly availableGeometry?: DisplayPrecision;
  /** True when the record asserts a finer level than the surface can draw. */
  readonly drawnCoarser?: boolean;
  readonly labels: PrecisionBannerLabels;
  readonly className?: string;
}

export function PrecisionBanner({
  precision,
  provenance,
  zoom,
  availableGeometry = 'COUNTRY',
  drawnCoarser = false,
  labels,
  className = '',
}: PrecisionBannerProps): JSX.Element {
  const selected = precision !== undefined;

  /*
    NO SELECTION -> REFERENCE GEOGRAPHY, AND SAID AS SUCH. The prefix is not
    decoration: without it the same words would read as a claim about what is
    known here, which is the exact confusion the banner exists to prevent.
  */
  const level: DisplayPrecision = selected
    ? precision
    : referenceCeilingForZoom(zoom ?? 0, availableGeometry);

  const keys = precisionStatementKeys(level, selected ? provenance : undefined);
  const style = markerStyleFor(level, selected ? provenance : undefined);
  const token = legendToken(selected ? style.legendKey : 'reference');

  const qualifier =
    keys.provenanceKey === 'interpreted'
      ? labels.interpreted
      : keys.provenanceKey === 'contested'
        ? labels.contested
        : null;

  const statement = selected
    ? labels.levels[level]
    : `${labels.referencePrefix} ${labels.levels[level]}`;

  return (
    /*
      THE TRUST BANNER, IN THE REFERENCE'S OWN TREATMENT: a 2px cyan left
      edge, a blurred panel ground, a 9.5px mono headline and an 11px
      explanatory line beneath it. Part I §E calls it "the single most
      important element on the map", and the reference gives it a sentence,
      not just a level — the level says WHAT, the sentence says why it matters.
    */
    <div
      data-gn="map-precision-banner"
      data-gn-precision={level}
      data-gn-provenance={selected ? (provenance ?? 'STATED') : 'none'}
      data-gn-source={selected ? 'selection' : 'reference'}
      data-gn-legend={selected ? style.legendKey : 'reference'}
      role="status"
      aria-live="polite"
      className={`max-w-[330px] border border-sp-line bg-sp-panel/90 px-[11px] py-[8px] backdrop-blur-[6px] ${className}`}
      style={{ borderLeftWidth: 2, borderLeftColor: token.stroke }}
    >
      <p
        className="font-gn-mono text-[9.5px] uppercase tracking-[0.14em]"
        style={{ color: token.stroke }}
      >
        {statement}
        {qualifier !== null && (
          <>
            {' — '}
            <span data-gn="precision-provenance-qualifier">{qualifier}</span>
          </>
        )}
      </p>
      {/*
        THE RULE, IN WORDS, UNDER THE LEVEL. Part I §G's governing sentence is
        the one thing a reader must take from this surface, and the reference
        prints it rather than assuming the level implies it.
      */}
      <p className="mt-[3px] text-[11px] leading-[1.45] text-sp-ink-2">
        {drawnCoarser ? labels.coarserThanEvidence : labels.governingRule}
      </p>
    </div>
  );
}
