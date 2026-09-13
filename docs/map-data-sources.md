# World Map \u2014 Data Sources & Limitations (Sprint 5.2)

## Mapping library

**[MapLibre GL JS](https://maplibre.org/)** \u2014 an open-source (BSD-3-Clause),
community-maintained fork of Mapbox GL JS v1. It requires **no API key or
paid token** for the base map itself, which is why it was chosen over
proprietary alternatives. The map in this project uses a fully local
style (a solid background color plus our own country layers) rather than
fetching any external raster/vector tile set, so there is no third-party
tile-server dependency at all \u2014 not even a free one.

## Geographic boundary dataset

**Source:** [Natural Earth](https://www.naturalearthdata.com/) Admin-0
countries (1:110m resolution), distributed via the
[`world-atlas`](https://www.npmjs.com/package/world-atlas) npm package
(`world-atlas/countries-110m.json`), converted to GeoJSON client-side
using [`topojson-client`](https://www.npmjs.com/package/topojson-client).

**License / public-domain status:** Natural Earth data is explicitly
placed in the **public domain** by its creators ("No permission is
needed to use Natural Earth. Crediting the authors is unnecessary.").
The `world-atlas` package that redistributes it as TopoJSON is published
under the ISC license. No attribution is legally required, though
Natural Earth is credited here as good practice.

**Why this approach, not a hand-drawn or invented dataset:** country
boundary coordinates are precise geographic data, not something that can
be approximated or hand-drawn without introducing real inaccuracies.
Rather than fetching this data from a third-party URL at runtime (which
Sprint 5.2 explicitly rules out, and which would also be a reliability
risk), it's resolved from the `world-atlas` package already present in
`node_modules` after `npm install` \u2014 fully local, no network request,
same trusted publication as a direct Natural Earth download.

**Resolution:** 1:110,000,000 (110m) was chosen deliberately \u2014 it's
Natural Earth's most simplified admin-0 boundary set, appropriate for a
small world-view map at the zoom levels this feature uses. `world-atlas`
also publishes 50m and 10m variants for higher-detail use cases if a
future sprint needs them.

## Boundary-policy disclaimer

Natural Earth's admin-0 country boundaries reflect a *de facto*,
practical cartographic representation and are **not a statement of
recognition, legal position, or endorsement** by GlobalNews AI regarding
any territorial dispute, contested border, or the political status of
any region. Some boundaries shown (for example, in parts of the Middle
East, South Asia, and Eastern Europe) are contested by one or more
states or communities. Where our own curated country list
(`shared/src/countries.ts`) omits a disputed or partially-recognized
territory, that is a scope limitation of this initial implementation,
not a political statement.

## Known limitations (Sprint 5.2)

- The curated country registry (`shared/src/countries.ts`) covers a
  substantial set of countries across every populated continent, but not
  the full ISO 3166-1 list of ~249 entries. It's isolated in one file
  specifically so it can be extended later.
- Category filtering narrows one selected country's own results; it does
  not perform a combined "country AND category" query against the
  underlying provider API, since neither GNews's public search endpoint
  nor the mock provider support that as a single request. The backend
  fetches a bounded pool of country-matched articles and filters by
  category from that pool. For countries with limited coverage, a
  specific category may show zero results even if the provider has
  more coverage under a broader query.
- Story counts are only ever known for countries the user has actually
  selected (or, on repeat hovers, previously selected) in the current
  session \u2014 by design, to avoid calling the news provider once per
  country on page load. There is no pre-computed "story count for every
  country" data source.

## Local testing

See the root `README.md`'s "World News Map" section for setup and
manual test steps.
