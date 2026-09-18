'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { lookupNavigatorPlace } from '@/lib/api/geoNavigatorApi';
import {
  declaredRegionSelection,
  regionSelectionFrom,
  type RegionSelection,
} from '@/lib/map/region/regionSelection';
import { governedRegionExtent } from '@/lib/map/navigation/breadcrumbs';
import type { MapSelection } from '@/lib/map/state/mapState';

/**
 * RSC-1 — THE RESOLVED REGION BEHIND A REGION SELECTION, IN ONE PLACE.
 *
 * `MapSelection` carries kind, id and (RSC-1.1) definitionId — enough for the
 * URL and for equality, and deliberately not enough to render. The NAME, the
 * TYPE and the published DEFINITION belong to G, so they are resolved here
 * rather than copied into the selection, where they could drift from the id.
 *
 * ── TWO ENTRY PATHS, ONE STATE ────────────────────────────────────────────
 *
 * A SEARCH COMMIT already holds the resolved node, so it calls `adopt` and no
 * request is made: no flicker, and the rail is correct on the same frame the
 * camera moves.
 *
 * A URL RESTORE has only the id, so it asks `/geo/place` — BY ID, NEVER BY
 * NAME. G's own note records 71 duplicated settlement names inside a single
 * country, and resolving a stored selection by name is precisely how two places
 * quietly swap.
 *
 * A failed lookup leaves `null`, and the card says the identifier did not
 * resolve rather than inventing a name for it. THE SELECTION SURVIVES THAT: an
 * unreachable navigator is a capability briefly absent, not a reason to
 * silently deselect what the reader asked for.
 *
 * ── ONE HOOK, BOTH SHELLS ─────────────────────────────────────────────────
 *
 * Desktop and mobile call this rather than each holding an effect. A second
 * copy would be a second place for the id-to-identity relationship to be got
 * subtly wrong — and mobile is the R2 completion gate, so the copy that drifted
 * would be the one under the most scrutiny.
 */
export function useResolvedRegion(selection: MapSelection | null | undefined): {
  readonly region: RegionSelection | null;
  readonly adopt: (region: RegionSelection) => void;
} {
  const [region, setRegion] = useState<RegionSelection | null>(null);
  const selectedRegionId =
    selection !== null && selection !== undefined && selection.kind === 'REGION'
      ? selection.id
      : null;

  /*
    THE ID ALREADY HELD, IN A REF RATHER THAN IN THE DEPENDENCY LIST.

    The effect must not depend on `region`, or it re-runs on its own write and
    the adopt path — which sets region and selection together — fires a request
    for a node it is already holding. A ref answers "do I have this one?"
    without making the answer a dependency. The read stays out of the state
    updater, which must remain pure: an updater with a fetch inside it runs
    twice under StrictMode and issues two requests for one selection.
  */
  const heldRef = useRef<string | null>(null);

  const adopt = useCallback((next: RegionSelection): void => {
    heldRef.current = next.geographyId;
    setRegion(next);
  }, []);

  useEffect(() => {
    if (selectedRegionId === null) {
      heldRef.current = null;
      setRegion(null);

      return;
    }

    if (heldRef.current === selectedRegionId) return;

    /*
      ══ LOCAL FIRST — A PRODUCT-GOVERNED REGION IS NOT IN THE GAZETTEER ═════

      MEASURED against the deployed Alpha backend:

          GET /geo/place?id=region:east-africa -> {"found":false,"node":null}

      That is correct rather than broken: `region:east-africa` is a coverage
      region the Product Owner declared, deliberately not the East African
      Community and not a UN M49 grouping, so no gazetteer holds it and none
      should.

      Without this branch, selecting East Africa would set the scope correctly
      and the rail would then render "This region could not be resolved" — the
      URL right and the reader told nothing. Resolved SYNCHRONOUSLY, so no
      render shows the unresolved state for a region the product itself
      declares, and no request is spent asking G about one.
    */
    const governed = declaredRegionSelection(
      selectedRegionId,
      governedRegionExtent(selectedRegionId),
    );

    if (governed !== null) {
      heldRef.current = selectedRegionId;
      setRegion(governed);

      return;
    }

    let live = true;

    heldRef.current = selectedRegionId;
    /* Cleared first: the previous region must not be shown under a new id. */
    setRegion(null);

    void lookupNavigatorPlace(selectedRegionId).then((place) => {
      if (!live) return;

      setRegion(place === null ? null : regionSelectionFrom(place));
    });

    return () => {
      live = false;
    };
  }, [selectedRegionId]);

  return { region, adopt };
}
