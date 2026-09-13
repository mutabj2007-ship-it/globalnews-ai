'use client';

import {
  regionCapability,
  REGIONAL_EVIDENCE_SCOPE,
  type RegionSelection,
  type RegionType,
} from '@/lib/map/region/regionSelection';
import { MachineReadable } from '@/lib/typography/runBoundary';

/**
 * RSC-1 / RSC-1.1 — THE RAIL WHEN A REGION IS SELECTED.
 *
 * ── WHY A REGION DOES NOT GET THE EVIDENCE CARD ───────────────────────────
 *
 * `EvidenceSelectionCard` answers "what is retained HERE?" — a total, a
 * verification split, a period, a follow relationship. Rendering it for a region
 * would have produced, measured on the wired build before this component
 * existed: a card headed `region:eastern-africa` (the raw id, because no country
 * name resolves) reporting NO RETAINED EVIDENCE for a region across which seven
 * countries hold reporting. Both halves wrong, and the second one wrong in the
 * direction that matters — "absence of evidence is absence of the event", said
 * about a whole region.
 *
 * So a region gets its own card, and the card's job is different: state the
 * IDENTITY, state the DEFINITION, and state plainly what is NOT being claimed.
 *
 * ── WHAT IS DELIBERATELY ABSENT ───────────────────────────────────────────
 *
 *   no count        RSC-1 forbids evidence aggregation across members
 *   no boundary     RSC-1: a member-country union is not a region boundary
 *   no watch CTA    RSC-1 lists regional Watch scoping among what it does NOT
 *                   settle; a control with no contract behind it is the
 *                   fabricated-capability failure
 *   no definition   G-REG-3 has not landed, so there is nothing to choose. A
 *   picker          picker over an empty list is a control that looks
 *                   actionable and is not.
 *
 * Each of those is a control the reader might expect. Their absence is stated in
 * the card rather than left as a silence, which is why this component carries
 * more prose than chrome.
 */

export interface RegionCardLabels {
  readonly heading: string;
  readonly types: Readonly<Record<RegionType, string>>;
  readonly definitionHeading: string;
  readonly membersHeading: string;
  readonly membersUnknown: string;
  readonly noDefinitionSelected: string;
  readonly evidenceScopeHeading: string;
  readonly evidenceScopeBody: string;
  readonly cameraHeld: string;
  readonly noBoundary: string;
  readonly unresolvedHeading: string;
  readonly unresolvedBody: string;
  readonly clear: string;
  readonly watchUnavailable: string;
}

export interface RegionIdentityCardProps {
  /**
   * `null` while the identifier has not resolved — a URL restore against an
   * unreachable navigator, or an id the gazetteer does not hold. NOT an error
   * state: the client fails soft and says what it has.
   */
  readonly region: RegionSelection | null;
  /** Always present. The selection's id, shown verbatim when nothing resolved. */
  readonly geographyId: string;
  readonly labels: RegionCardLabels;
  readonly onClearSelection?: () => void;
}

const Row = ({ heading, children }: { heading: string; children: React.ReactNode }) => (
  <div className="mt-3 border-t border-gn-line-structural pt-3">
    <p className="text-[10px] uppercase tracking-[0.14em] text-sp-ink-3">{heading}</p>
    <div className="mt-1 text-[12px] leading-[1.5] text-sp-ink">{children}</div>
  </div>
);

export function RegionIdentityCard({
  region,
  geographyId,
  labels,
  onClearSelection,
}: RegionIdentityCardProps) {
  if (region === null) {
    return (
      <div data-gn="region-card" data-gn-region-resolved="false" className="text-sp-ink">
        <p className="text-[13px] font-medium">{labels.unresolvedHeading}</p>
        <p className="mt-1 text-[12px] leading-[1.5] text-sp-ink-3">{labels.unresolvedBody}</p>
        {/* Verbatim, and in a code face, so it reads as an identifier rather than a name. */}
        <p data-gn="region-id" className="mt-2 break-all font-mono text-[11px] text-sp-ink-3">
          <MachineReadable>{geographyId}</MachineReadable>
        </p>
        {onClearSelection && (
          <button
            type="button"
            data-gn="region-clear"
            onClick={onClearSelection}
            className="mt-3 min-h-[44px] w-full rounded-sm border border-gn-line-structural px-3 text-[12px] text-sp-ink transition-colors hover:bg-sp-item-hover"
          >
            {labels.clear}
          </button>
        )}
      </div>
    );
  }

  const capability = regionCapability(region);

  return (
    <div
      data-gn="region-card"
      data-gn-region-resolved="true"
      data-gn-region-type={region.regionType}
      data-gn-evidence-scope={REGIONAL_EVIDENCE_SCOPE}
      className="text-sp-ink"
    >
      <p className="text-[10px] uppercase tracking-[0.14em] text-sp-ink-3">{labels.heading}</p>
      <p data-gn="region-name" className="mt-1 text-[15px] font-medium leading-[1.25]">
        {region.name}
      </p>
      <p data-gn="region-type" className="mt-1 text-[11px] leading-[1.45] text-sp-ink-3">
        {labels.types[region.regionType]}
      </p>

      <Row heading={labels.definitionHeading}>
        {/*
          G'S OWN SENTENCE, VERBATIM AND UNEDITED.

          For an OPERATIONAL region this is the paragraph that says HOW membership
          is disputed — "No agreed membership. UN M49 has no 'Middle East'; usage
          disagrees over Egypt, Turkey, Iran, Afghanistan and the Maghreb." That is
          the difference between honest-and-empty and honest-and-useful, and
          paraphrasing it here would put words in a source's mouth.
        */}
        <p data-gn="region-definition">{region.definition}</p>
        {/* RSC-1.1: absent is a state, and it is stated rather than left blank. */}
        {region.definitionId === null && (
          <p data-gn="region-definition-absent" className="mt-1 text-sp-ink-3">
            {labels.noDefinitionSelected}
          </p>
        )}
      </Row>

      <Row heading={labels.membersHeading}>
        {/* `null` is UNKNOWN and renders as such. It is never printed as 0. */}
        <p data-gn="region-members">
          {region.memberCount === null ? labels.membersUnknown : String(region.memberCount)}
        </p>
      </Row>

      <Row heading={labels.evidenceScopeHeading}>
        <p data-gn="region-evidence-scope">{labels.evidenceScopeBody}</p>
      </Row>

      {/*
        THE TWO REFUSALS, STATED WHERE THE READER WOULD OTHERWISE INFER.

        `noBoundary` always: the map deliberately draws nothing, and an unexplained
        nothing reads as a rendering failure.

        `cameraHeld` only when the camera genuinely did not move, so it describes
        what happened rather than asserting a rule the reader did not experience.
      */}
      <p data-gn="region-no-boundary" className="mt-3 text-[11px] leading-[1.45] text-sp-ink-3">
        {labels.noBoundary}
      </p>
      {!capability.cameraTargetDerivable && (
        <p data-gn="region-camera-held" className="mt-1 text-[11px] leading-[1.45] text-sp-ink-3">
          {labels.cameraHeld}
        </p>
      )}
      {/* Not a disabled button. A control the product cannot honour is not drawn. */}
      <p data-gn="region-watch-unavailable" className="mt-1 text-[11px] leading-[1.45] text-sp-ink-3">
        {labels.watchUnavailable}
      </p>

      {onClearSelection && (
        <button
          type="button"
          data-gn="region-clear"
          onClick={onClearSelection}
          className="mt-3 min-h-[44px] w-full rounded-sm border border-gn-line-structural px-3 text-[12px] text-sp-ink transition-colors hover:bg-sp-item-hover"
        >
          {labels.clear}
        </button>
      )}
    </div>
  );
}
