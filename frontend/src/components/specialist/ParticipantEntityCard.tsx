'use client';

import {
  entityProvenanceReachable,
  resolveEntityImage,
  type EntityImageSize,
  type ParticipantEntity,
} from '@/lib/specialist/participantEntity';

/**
 * SHARED · ENTITY — the platform's one identity surface for any party to an
 * intelligence object. Addendum §15. Conflict is its first consumer; Election
 * and Delivery are registered second and third.
 *
 * NOTHING IN THIS FILE KNOWS WHAT A CONFLICT IS. Every domain-specific word —
 * the role, the state, the measure's unit — arrives as a prop or a label. That
 * is the whole point of the promotion: §21 forbids a `CandidateCard`, and the
 * way a `CandidateCard` gets built is that the first consumer's vocabulary
 * leaks into the shared component and the second consumer cannot use it.
 *
 * ── THE RESERVED BOX ──────────────────────────────────────────────────────
 *
 * The image slot occupies its box whether or not an image resolves, and the
 * platform never generates one. Three outcomes: a licensed image, initials
 * derived from the verified name, or an empty bordered box. See
 * `resolveEntityImage` — the type has nowhere to put a fourth.
 */

export interface ParticipantEntityLabels {
  readonly evidence: string;
  readonly provenance: string;
  readonly noImage: string;
  readonly unlicensedImage: string;
}

export interface ParticipantEntityCardProps {
  readonly entity: ParticipantEntity;
  /** Domain-supplied display words. The card resolves none of them itself. */
  readonly roleLabel: string;
  readonly stateLabel?: string;
  readonly size?: EntityImageSize;
  readonly labels: ParticipantEntityLabels;
  readonly onOpenProvenance?: () => void;
  readonly onSelect?: () => void;
}

export function ParticipantEntityCard({
  entity,
  roleLabel,
  stateLabel,
  size = 44,
  labels,
  onOpenProvenance,
  onSelect,
}: ParticipantEntityCardProps): JSX.Element {
  const image = resolveEntityImage(entity);
  const box = `${size}px`;

  return (
    <article
      data-gn="participant-entity"
      data-gn-entity={entity.entityId}
      data-gn-role={entity.roleType}
      data-gn-state={entity.currentState ?? undefined}
      data-gn-image={image.kind}
      className="flex items-start gap-[10px] border-b border-sp-line py-[10px] last:border-b-0"
    >
      {/*
        RESERVED UNCONDITIONALLY. The box is laid out before anything is known
        about whether it can be filled, so the row's geometry does not depend on
        a licence — which is what stops a missing portrait from reading as a
        layout fault someone should fix by supplying an image.
      */}
      {/*
        B3.1 · SPECIALIST-SP-SURFACE-RAISED-TOKEN-1 — RESOLVED.

        A DIFFERENT ROLE FROM THE HOVER CASE, which is why one ruling could not
        cover both: this is the RESTING fill of the reserved entity-image block,
        not a pointer state. The accepted hover mapping would have asserted a
        hover treatment on something that is never hovered.

        `sp-panel-2` (#101b25) is the existing panel fill for a nested surface.
        No token invented.
      */}
      <div
        data-gn="entity-image"
        aria-hidden={image.kind !== 'IMAGE'}
        style={{ width: box, height: box, minWidth: box }}
        className="flex shrink-0 items-center justify-center rounded-[2px] border border-gn-line-structural bg-sp-panel-2 font-gn-mono text-[12px] tracking-[0.08em] text-sp-ink-3"
      >
        {image.kind === 'IMAGE' ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={image.src} alt={entity.verifiedName} className="h-full w-full rounded-[2px] object-cover" />
        ) : image.kind === 'INITIALS' ? (
          <span data-gn="entity-initials">{image.initials}</span>
        ) : (
          <span className="sr-only">
            {entity.imageLicence === 'UNLICENSED' ? labels.unlicensedImage : labels.noImage}
          </span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-[8px]">
          {/* The verified name, verbatim. Not translated, not shortened. */}
          <h4 data-gn="entity-name" className="truncate text-[13px] font-medium leading-tight text-sp-ink">
            {entity.verifiedName}
          </h4>
          {/* WORD PLUS MARK — never colour alone (§21). The mark is the border. */}
          {stateLabel && (
            <span
              data-gn="entity-state"
              className="shrink-0 rounded-[2px] border border-gn-line-structural px-[5px] py-[1px] font-gn-mono text-[9px] uppercase tracking-[0.12em] text-sp-ink-2"
            >
              {stateLabel}
            </span>
          )}
        </div>

        <p data-gn="entity-role" className="mt-[2px] font-gn-mono text-[9.5px] uppercase tracking-[0.14em] text-sp-ink-3">
          {roleLabel}
          {entity.affiliation ? ` · ${entity.affiliation}` : ''}
        </p>

        {/*
          MEASURE AND DELTA SHARE ONE BASELINE ROW — §15. Two rows would read as
          two facts; they are one fact and its movement.
        */}
        {(entity.measure !== undefined || entity.delta !== undefined) && (
          <p data-gn="entity-measure" className="mt-[4px] flex items-baseline gap-[6px] text-[12px] text-sp-ink">
            {entity.measure !== undefined && (
              <span>
                {entity.measure}
                {entity.measureUnit ? <span className="text-sp-ink-3"> {entity.measureUnit}</span> : null}
              </span>
            )}
            {entity.delta !== undefined && (
              /* Amber hierarchy, secondary weight: a delta on an entity row is
                 movement, not the object's material change. C·4. */
              <span data-gn="entity-delta" className="font-gn-mono text-[10px] text-[rgba(242,169,60,.62)]">
                {entity.delta}
              </span>
            )}
          </p>
        )}

        <p className="mt-[4px] flex items-center gap-[10px] font-gn-mono text-[9px] uppercase tracking-[0.12em] text-sp-ink-3">
          <span data-gn="entity-evidence">
            {entity.evidenceCount} {labels.evidence}
          </span>
          {/* PROVENANCE IN ONE TAP — §15. Rendered only when there is provenance
              to reach, so the control is never actionable-with-nothing-behind-it. */}
          {entityProvenanceReachable(entity) && onOpenProvenance && (
            <button
              type="button"
              data-gn="entity-provenance"
              onClick={onOpenProvenance}
              className="min-h-[44px] text-sp-ui-idle underline-offset-2 hover:text-sp-ui-hover hover:underline"
            >
              {labels.provenance}
            </button>
          )}
        </p>
      </div>

      {onSelect && (
        <button
          type="button"
          data-gn="entity-select"
          onClick={onSelect}
          aria-label={entity.verifiedName}
          className="min-h-[44px] min-w-[44px] shrink-0 text-sp-ui-idle hover:text-sp-ui-hover"
        >
          <span aria-hidden="true">›</span>
        </button>
      )}
    </article>
  );
}
