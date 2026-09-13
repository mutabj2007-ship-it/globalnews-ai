# Part B validation tooling — pinned procedure

The Alpha validation environment needs one tool this repository deliberately
does not carry. Everything below is exact, so the networked environment
reproduces a known runner rather than "whatever npm resolved that day".

## Pinned version

```
@playwright/test   1.47.2
browser            chromium (the only browser this gate uses)
```

`1.47.2` is pinned exactly — not `^1.47.0`. The gate's thresholds are
measurements of rendered pixels, and a browser engine change can move
antialiasing and glyph rasterisation. A floating range would let the reference
drift underneath a fixed set of goldens, which is the same class of problem as
an ungoverned golden.

## Procedure, in the networked validation environment

```bash
# 1. install the runner and regenerate the lockfile
npm install --save-dev --workspaces=false --save-exact @playwright/test@1.47.2

# 2. install the browser binary (NOT committed; it lives in the tool cache)
npx playwright install chromium

# 3. commit BOTH package.json and package-lock.json
#    this moves C, which is the reviewed identity change it should be

# 4. serve the application, then run the gate
npm run verify:visual-authority                     # Alpha
npm run verify:visual-authority:production          # Production; fails while V3/V4 pend
```

## What must NOT be done

- **Do not hand-edit `package-lock.json`.** A hand-written `integrity` hash is a
  supply-chain assertion nobody verified. If the lockfile cannot be regenerated
  from a registry, the correct outcome is that this gate stays red.
- **Do not add the dependency without regenerating the lockfile.** `npm ci`
  installs strictly from the lockfile and fails on a manifest it does not cover,
  and `npm ci` is the first instruction in `frontend/Dockerfile`'s dependencies
  stage — so a lockfile-less dependency re-breaks the Railway frontend build,
  which is the defect C907 R2 exists to fix.
- **Do not add Playwright to the frontend workspace.** `--workspaces=false` keeps
  it a root devDependency, out of the application image entirely.

## Expected first run

The interception harness fails closed, so the first real run may name API
endpoints that still need a pinned fixture. That output is the task list; add one
file per endpoint under `fixtures/`, shaped against that endpoint's own reader in
`frontend/src/lib/api/`. Do not widen the matcher and do not let unpinned
requests reach the live backend.

Pre-pinned here, each verified against its reader:

| Endpoint | Reader verified against | Fixture |
|---|---|---|
| `GET /geo/map-feed` | `readMapFeed`, `mapFeedApi.ts` | `geo__map-feed.json` |
| `GET /news/top-headlines` | `fetchTopHeadlines` → `NewsResponse`, `shared/src/news.ts` | `news__top-headlines.json` |
| `GET /news/country/:iso3` | `fetchCountryNews` → `CountryNewsResponse` | `news__country__ANY.json` |
| `GET /geo/gazetteer` | `fetchGazetteerAttribution` | `geo__gazetteer.json` |

`/geo/search` and `/geo/place` are navigator lookups reached by user
interaction; the protected frames do not interact, so they are deliberately
unpinned and will fail closed if a frame ever reaches them.
