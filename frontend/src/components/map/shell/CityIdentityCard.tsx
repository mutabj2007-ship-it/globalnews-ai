'use client';

import type { CitySelection } from '@/lib/map/geography/semanticGeography';
import { MachineReadable } from '@/lib/typography/runBoundary';

/**
 * ══ THE CITY CARD — WHERE THE READER IS, AND WHERE THE EVIDENCE IS ════════
 *
 * MAP-SEARCH-CITY/REGION-RIGHT-RAIL. The live inspection found the rail
 * reading "Widok świata" after committing Kigali, because a city selected
 * nothing and the rail had nothing to describe.
 *
 * THIS CARD EXISTS TO HOLD TWO FACTS APART THAT THE PRODUCT USED TO COLLAPSE:
 *
 *     SELECTED SEMANTIC GEOGRAPHY   Kigali          CITY
 *     EVIDENCE GEOGRAPHY / CEILING  Rwanda          COUNTRY
 *
 * The CTO ruling is explicit that the first is new and the second is
 * unchanged: "CITY is now a selectable semantic/navigation geography. It does
 * not supersede the evidence ceiling." So this card NAMES the city the reader
 * chose and, in the same breath, names the country evidence actually resolves
 * at. It does not show a city-level total, because none exists — and inventing
 * one is the precise failure the ruling forbids.
 *
 * WHY NOT AN `EvidenceSelectionCard` WITH A CITY NAME ON IT. That card's whole
 * vocabulary — a total, a verification split, a period, a follow relationship —
 * answers "what is retained HERE?". Pointed at a city it would answer with
 * Rwanda's numbers under Kigali's name, which is the fabrication this card is
 * built to avoid. `RegionIdentityCard` was separated from it for the same
 * reason and its header says so.
 */

export interface CityCardLabels {
  readonly heading: string;
  /** "Evidence resolves at" — the ceiling, stated rather than implied. */
  readonly evidenceCeilingHeading: string;
  /**
   * The sentence that keeps the two geographies apart. It must say that
   * evidence is the country's, not the city's, without implying the city has
   * its own and it is merely hidden.
   */
  readonly evidenceCeilingBody: string;
  readonly noCountryHeading: string;
  readonly noCountryBody: string;
  readonly unresolvedHeading: string;
  readonly unresolvedBody: string;
  readonly provenanceHeading: string;
  readonly clear: string;
}

export interface CityIdentityCardProps {
  /**
   * `null` while the identifier has not resolved — a URL restore against an
   * unreachable navigator, or an id the gazetteer no longer holds. NOT an
   * error: the client fails soft and shows what it has, exactly as the region
   * card does.
   */
  readonly city: CitySelection | null;
  /** Always present. The selection's id, shown verbatim when nothing resolved. */
  readonly geographyId: string;
  /** Resolved display name for the evidence country, when one is known. */
  readonly countryName?: string;
  readonly labels: CityCardLabels;
  readonly onClearSelection?: () => void;
}

export function CityIdentityCard({
  city,
  geographyId,
  countryName,
  labels,
  onClearSelection,
}: CityIdentityCardProps): JSX.Element {
  if (city === null) {
    return (
      <section
        data-gn="map-city-card"
        data-gn-state="unresolved"
        className="flex flex-col gap-2 rounded-[6px] border border-gn-line-card p-3"
      >
        <p className="font-gn-mono text-[10px] uppercase tracking-[0.08em] text-gn-ink-secondary">
          {labels.unresolvedHeading}
        </p>
        <p className="text-[12px] text-gn-ink-secondary">{labels.unresolvedBody}</p>
        <MachineReadable>{geographyId}</MachineReadable>
        {onClearSelection && (
          <button
            type="button"
            data-gn="city-clear"
            onClick={onClearSelection}
            className="self-start rounded-[5px] border border-gn-line-chip px-2 py-0.5 font-gn-mono text-[10px] uppercase tracking-[0.08em] text-gn-ink-secondary hover:border-gn-line-hover"
          >
            {labels.clear}
          </button>
        )}
      </section>
    );
  }

  return (
    <section
      data-gn="map-city-card"
      data-gn-state="resolved"
      className="flex flex-col gap-3 rounded-[6px] border border-gn-line-card p-3"
    >
      <div className="flex flex-col gap-1">
        <p
          data-gn="city-kind"
          className="font-gn-mono text-[10px] uppercase tracking-[0.08em] text-gn-ink-secondary"
        >
          {labels.heading}
        </p>
        <p data-gn="city-name" className="text-[15px] text-gn-ink-primary">
          {city.name}
        </p>
      </div>

      {/*
        THE CEILING, STATED. Not a footnote and not a tooltip: a reader looking
        at Kigali must be able to see, without hovering anything, that the
        evidence beside it is Rwanda's.
      */}
      <div className="flex flex-col gap-1 border-t border-gn-line-card pt-2">
        <p className="font-gn-mono text-[10px] uppercase tracking-[0.08em] text-gn-ink-secondary">
          {city.countryIso3 === null ? labels.noCountryHeading : labels.evidenceCeilingHeading}
        </p>
        {city.countryIso3 === null ? (
          <p className="text-[12px] text-gn-ink-secondary">{labels.noCountryBody}</p>
        ) : (
          <>
            <p data-gn="city-evidence-geography" className="text-[13px] text-gn-ink-primary">
              {countryName ?? city.countryIso3}
            </p>
            <p className="text-[12px] text-gn-ink-secondary">{labels.evidenceCeilingBody}</p>
          </>
        )}
      </div>

      {city.provenance.length > 0 && (
        <div className="flex flex-col gap-1 border-t border-gn-line-card pt-2">
          <p className="font-gn-mono text-[10px] uppercase tracking-[0.08em] text-gn-ink-secondary">
            {labels.provenanceHeading}
          </p>
          <p className="text-[11px] text-gn-ink-secondary">{city.provenance}</p>
        </div>
      )}

      <MachineReadable>{city.geographyId}</MachineReadable>

      {onClearSelection && (
        <button
          type="button"
          data-gn="city-clear"
          onClick={onClearSelection}
          className="self-start rounded-[5px] border border-gn-line-chip px-2 py-0.5 font-gn-mono text-[10px] uppercase tracking-[0.08em] text-gn-ink-secondary hover:border-gn-line-hover"
        >
          {labels.clear}
        </button>
      )}
    </section>
  );
}
