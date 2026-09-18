'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { lookupNavigatorPlace } from '@/lib/api/geoNavigatorApi';
import { citySelectionFrom, type CitySelection } from '@/lib/map/geography/semanticGeography';
import type { MapSelection } from '@/lib/map/state/mapState';

/**
 * ══ RESTORING A CITY SELECTION — MAP-SEARCH-CITY/REGION-URL-STATE ═════════
 *
 * Deliberately the same shape as `useResolvedRegion`, because it solves the
 * same problem and any divergence between the two would be a second way for a
 * selection to resolve. A committed row ADOPTS the identity it already has, so
 * the common path issues no request at all; a cold restore from `sel=city:…`
 * looks the node up once.
 *
 * WHY A LOOKUP AND NOT A PARSE. `city:RWA:kigali@-1.94995,30.05885` visibly
 * contains an ISO-3 and a coordinate pair, and reading them out of the string
 * would remove this request entirely. It is still refused: `geographyId` is
 * documented "Join and look up by it; never parse it", and an id whose shape is
 * convenient today is an id whose shape changes without notice. The country
 * shown beside a city is the EVIDENCE CEILING — the one fact on this card it
 * would be worst to infer.
 *
 * THIS IS NOT A PROVIDER CALL. `/geo/place` is the geography navigator; it
 * executes no news provider, consumes no quota, and is outside the §11
 * provider-execution gate, which is about GNews and analysis. A city selection
 * therefore still performs zero provider executions.
 */
export function useResolvedCity(selection: MapSelection | null | undefined): {
  readonly city: CitySelection | null;
  readonly adopt: (city: CitySelection) => void;
} {
  const [city, setCity] = useState<CitySelection | null>(null);

  const selectedCityId =
    selection !== null && selection !== undefined && selection.kind === 'CITY'
      ? selection.id
      : null;

  /*
    THE ID ALREADY HELD, IN A REF RATHER THAN IN THE DEPENDENCY LIST — the same
    reasoning `useResolvedRegion` records: an effect that depended on `city`
    would re-run on its own write, and the adopt path would fetch a node it is
    already holding. StrictMode doubles that into two requests for one click.
  */
  const heldRef = useRef<string | null>(null);

  const adopt = useCallback((next: CitySelection): void => {
    heldRef.current = next.geographyId;
    setCity(next);
  }, []);

  useEffect(() => {
    if (selectedCityId === null) {
      heldRef.current = null;
      setCity(null);

      return;
    }

    if (heldRef.current === selectedCityId) return;

    let live = true;

    heldRef.current = selectedCityId;
    setCity(null);

    void lookupNavigatorPlace(selectedCityId).then((place) => {
      if (!live) return;

      setCity(place === null ? null : citySelectionFrom(place));
    });

    return () => {
      live = false;
    };
  }, [selectedCityId]);

  return { city, adopt };
}
