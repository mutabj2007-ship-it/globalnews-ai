# Pinned protected-frame evidence — C907 R2

Every file here is served by `interception.mjs` in place of a real API response,
keyed by request pathname: `/geo/map-feed` → `geo__map-feed.json`.

**This directory is deliberately incomplete, and the harness is deliberately
strict about that.** Only `/geo/map-feed` is seeded, because that is the one
response contract verified directly against the product's own reader
(`frontend/src/lib/api/mapFeedApi.ts`, `readMapFeed`). Payloads for endpoints
whose contract was not verified have NOT been invented: a fixture that is merely
plausible produces a plausible frame and therefore a plausible, wrong verdict —
the same class of error as a fabricated golden.

Any other API request the page makes is **aborted**, recorded, and fails the
test by name. The first run in a Playwright-capable environment therefore prints
the exact list of endpoints still to pin. Add one file per endpoint, shaped
against that endpoint's own reader in `frontend/src/lib/api/`, and re-run.

Do not "fix" a failing run by widening `isApiCall` or by letting unpinned
requests continue. Falling back to the live feed is exactly the
non-determinism this harness exists to remove.
