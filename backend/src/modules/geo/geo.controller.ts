import { Controller, Get, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import {
  childrenOf,
  lookupGeographyId,
  searchGazetteer,
  searchIndexStats,
  type GeoNode,
  type GeoNodeKind,
  type GeoSearchResponse,
} from './gazetteer-search';
import {
  mapGeographyForArticle,
  mapGeographyForQuery,
  type MapEvidenceGeography,
} from './map-feed.contract';
import { GAZETTEER_ATTRIBUTION, gazetteerCounts } from './geo-gazetteer';

export class MapFeedQueryDto {
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  q!: string;

  /** An ISO 3166-1 alpha-3 the caller already knows. Breaks ties; never manufactures a place. */
  @IsOptional()
  @IsString()
  @MaxLength(3)
  country?: string;

  /**
   * WHICH GATE APPLIES. Defaults to 'query', so every existing caller is
   * byte-for-byte unchanged.
   *
   *   'query'    a USER QUESTION. Casing is not required - readers type
   *              lowercase - but an explicit geographic context is, so
   *              "Chad missed the bus" never becomes a camera over N'Djamena.
   *
   *   'article'  EVIDENCE TEXT - a headline, a summary, a body. Prose supplies
   *              capitalisation, so casing is required instead of a
   *              preposition. This is what makes "Goma residents flee as
   *              fighting intensifies" resolve, which the query gate refuses.
   *
   * THE TWO ARE NOT INTERCHANGEABLE AND NEITHER IS THE LENIENT ONE. They apply
   * different evidence tests to different kinds of text, and sending a user
   * question through the article gate is as wrong as the reverse.
   */
  @IsOptional()
  @IsIn(['query', 'article'])
  mode?: 'query' | 'article';
}

/**
 * GEO — the read-only map feed.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THIS ENDPOINT EXISTS
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * H is implementing the Spatial M2 evidence overlay NOW, and needs the runtime
 * geography output to build against. The eventual home for that output is the
 * evidence record itself - `precision` and `locationProvenance` on every record,
 * which the design specification calls mandatory.
 *
 * That home is a SHARED CONTRACT, and shared contracts are Main's to converge
 * under the collision rule. Waiting for that convergence would block H on
 * governance; editing `shared/` unilaterally would break the rule. So this is
 * the third option: a read-only, additive, G-owned endpoint that serves the
 * exact same projection, from the same single function, against real data,
 * today.
 *
 * WHEN MAIN CONVERGES THE SHARED TYPE, THIS ENDPOINT BECOMES REDUNDANT AND
 * SHOULD BE DELETED. `toMapEvidenceGeography` is the durable artefact; this is
 * scaffolding with a documented demolition date, not a second API.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * READ-ONLY, AND NO PROVIDER IS CALLED
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * This resolves against the shipped gazetteer in memory. It issues no network
 * request, spends no provider quota, and writes nothing - so H can hammer it
 * during development without touching the retrieval budget.
 */
export class GeoSearchQueryDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  q!: string;

  /** ISO2, ISO3 or a country name. Restricts results to that country. */
  @IsOptional()
  @IsString()
  @MaxLength(60)
  country?: string;

  /** Restrict to one rung of the ladder. */
  @IsOptional()
  @IsIn(['region', 'country', 'admin1', 'admin2', 'city'])
  kind?: GeoNodeKind;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class GeoPlaceQueryDto {
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  id!: string;
}

export class GeoChildrenQueryDto {
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  id!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  limit?: number;
}

/*
  G-6 — THE INTERACTIVE-MAP RATE LIMIT, BOUNDED AND STATED.

  Product Owner ruling for Alpha: 120 requests / 60 seconds per resolved
  client identity. The global default is 20/min, which is correct for a
  page that a reader loads and reads — and wrong for a map, where one
  session legitimately issues a request per pan, per zoom and per keystroke
  in the place search. Inheriting 20/min here would 429 ordinary use.

  IT IS A CEILING, NOT AN EXEMPTION. 120/min still bounds a single client,
  and every route below is a pure gazetteer read — no provider call, no
  model quota, no database — so the cost of the ceiling is CPU on a shipped
  table, not spend.

  IF THIS PROVES INSUFFICIENT IT IS RAISED WITH MEASURED EVIDENCE, never
  silently: `geo-throttle-pressure.spec.ts` pins the number so a change has
  to be deliberate, and 429s on these routes are observable as such rather
  than as a map that mysteriously stops responding.
*/
@Throttle({ default: { limit: 120, ttl: 60000 } })
@Controller('geo')
export class GeoController {
  /**
   * GET /geo/map-feed?q=...&country=...&mode=query|article
   *
   * The geography of one piece of text, in the exact shape the map overlay
   * consumes.
   *
   * ─────────────────────────────────────────────────────────────────────────
   * WHY `mode` EXISTS, AND THE DEFECT IT CLOSES
   * ─────────────────────────────────────────────────────────────────────────
   *
   * Article-mode resolution was implemented and had NO ROUTE. This endpoint
   * served only the query gate, so the only HTTP way to resolve geography
   * applied the USER-QUESTION test to EVIDENCE TEXT. Measured, through this
   * route before the fix:
   *
   *     "Goma residents flee as fighting intensifies"      NO_PLACE_EVIDENCE
   *     "Musanze District officials confirm road closure"  NO_PLACE_EVIDENCE
   *     "Rubavu border post reopens after two weeks"       NO_PLACE_EVIDENCE
   *
   * All three resolve correctly under article resolution. The capability
   * existed; the runtime path to it did not.
   *
   * `country` is a tiebreak and NEVER manufactures a place. In article mode it
   * is also the corroboration that permits a country-level claim - pass the
   * article's scored `countryCode` there.
   */
  @Get('map-feed')
  mapFeed(@Query() query: MapFeedQueryDto): MapEvidenceGeography {
    return query.mode === 'article'
      ? mapGeographyForArticle(query.q, query.country)
      : mapGeographyForQuery(query.q, query.country);
  }

  /**
   * GET /geo/gazetteer
   *
   * What the gazetteer actually contains, and its attribution.
   *
   * THE ATTRIBUTION IS THE POINT, not the counts. The underlying data is
   * GeoNames under CC BY 4.0, which REQUIRES attribution wherever it is
   * presented. Serving it from the same place as the data means a frontend can
   * render the credit line without anyone having to remember to copy a string
   * into a component.
   */
  
  /**
   * GET /geo/search?q=...&country=...&kind=...&limit=...
   *
   * THE NAVIGATOR'S LOOKUP, over the whole ladder:
   *
   *     region -> country -> admin1 -> admin2 -> city
   *
   * ─────────────────────────────────────────────────────────────────────────
   * WHY THIS IS NOT `map-feed` WITH A DIFFERENT NAME
   * ─────────────────────────────────────────────────────────────────────────
   *
   * `map-feed` resolves PROSE — a question, a headline — and applies an
   * evidence gate, because "Chad missed the bus" must not become a camera over
   * N'Djamena. This resolves a DELIBERATE LOOKUP, where the reader typing
   * "Chad" means the country and an evidence gate would refuse their own
   * explicit intent. Same gazetteer, same identity scheme, different question.
   *
   * ─────────────────────────────────────────────────────────────────────────
   * WHY `gazetteer` (COUNTS) WAS NOT ENOUGH
   * ─────────────────────────────────────────────────────────────────────────
   *
   * That route can report that 51,057 settlements exist and cannot name one.
   * It stays — the counts and the attribution are a real audit surface — but it
   * was never a lookup, and a navigator cannot be built on a total.
   *
   * READ-ONLY, IN-MEMORY, NO PROVIDER. Same as every other route on this
   * controller: no network, no quota, no write.
   */
  @Get('search')
  search(@Query() query: GeoSearchQueryDto): GeoSearchResponse {
    return searchGazetteer(query.q, {
      country: query.country,
      kind: query.kind,
      limit: query.limit,
    });
  }

  /**
   * GET /geo/place?id=city:RWA:kigali@-1.94995,30.05885
   *
   * One node, by the identity a selection already holds.
   *
   * WHY THIS IS SEPARATE FROM SEARCH, AND WHY IT MATTERS. A map selection, a
   * watch entry and a shared link all carry a `geographyId` and no name.
   * Recovering the node by re-searching its name is exactly how two different
   * places that share a name get silently swapped — which is why the city id
   * carries its point: 71 settlement names in this gazetteer are duplicated
   * within a single country.
   *
   * Returns `{ found: false }` rather than 404 for an unknown id: a stale watch
   * entry is a normal state for a client to hold, not an error condition.
   */
  @Get('place')
  place(@Query() query: GeoPlaceQueryDto): { found: boolean; node: GeoNode | null } {
    const node = lookupGeographyId(query.id);

    return { found: node !== null, node };
  }

  /**
   * GET /geo/children?id=country:RWA
   *
   * One rung down the ladder — the drill-down a navigator walks.
   *
   *     region  -> its member countries (EMPTY for a contested region, which
   *                is the honest answer, not a gap)
   *     country -> its admin1 units
   *     admin1  -> its admin2 units, or its settlements where no admin2 data
   *                exists for that country
   *     admin2  -> its settlements
   *     city    -> nothing
   */
  @Get('children')
  children(@Query() query: GeoChildrenQueryDto): {
    parent: string;
    count: number;
    nodes: readonly GeoNode[];
  } {
    const nodes = childrenOf(query.id, query.limit);

    return { parent: query.id, count: nodes.length, nodes };
  }

  /**
   * GET /geo/search-index
   *
   * What the search index actually holds, what it was built from, and under
   * WHICH RETENTION POLICY.
   *
   * The policy is the point. `minPopulation: 5000` is why a settlement is
   * missing far more often than any resolver rule is, and a caller debugging a
   * "why can't I find X" question needs to see that number rather than infer
   * it. Serving it makes the gazetteer's own filter auditable from outside.
   */
  @Get('search-index')
  searchIndex(): Record<string, unknown> {
    return searchIndexStats();
  }

  @Get('gazetteer')
  gazetteer(): { counts: Record<string, unknown>; attribution: string } {
    return {
      counts: gazetteerCounts() as unknown as Record<string, unknown>,
      attribution: GAZETTEER_ATTRIBUTION(),
    };
  }
}
