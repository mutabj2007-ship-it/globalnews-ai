# Alpha Home-feed capture — read-only evidence

`alpha-home-feed.json` is a **verbatim, read-only capture of the real Alpha
Home feed**, taken on 2026-09-25 from

```
GET https://backend-production-bed5.up.railway.app/news/top-headlines?limit=24&lang=en
    -> 10 articles · providers: ["gnews"] · dataMode: "live"
```

## How it was taken, and why that matters

The cloud container and the device VM both refuse that host (000 on every path
tried, twice reported). It was captured instead through the **Claude-in-Chrome
extension on the Product Owner's own browser**, which is the sanctioned route in
§15 of the Master Authority — the one that does not require exposing local
development publicly.

Nothing was invented, reworded, trimmed or reordered. Every field is the
backend's own: real publishers, real URLs, real `publishedAt`, real
`imageUrl`, real `sourcesCount`, real `dataMode`.

## What it is for, and what it must never become

It exists so desktop fidelity can be judged against **real content**, which the
Product Owner requires before approval: *"do not use geometry-harness cards as
final fidelity proof — final desktop validation must use real Alpha feed
content."*

- It is **read-only evidence**. It is never imported by production Home code.
- It lives under `scripts/`, outside `frontend/src`, so it cannot enter the
  bundle.
- It is reached only by pointing `SERVER_INTERNAL_API_URL` at the local replay
  server for the duration of a capture. The application is byte-identical with
  and without it.
- It is **never deployed as live data**. Alpha and production read the live
  feed exactly as before.
- It is a **snapshot of one moment**, not a fixture to keep in sync. When it
  goes stale, re-capture it; do not edit it.

## One honest limitation of the capture environment

The article images are remote publisher URLs (bbc.co.uk, usatoday.com,
mb.com.ph and so on) and **the container cannot reach any of them** — the same
egress allowlist that blocks the backend blocks them. Cards in these captures
therefore render the product's own governed "image unavailable" treatment
rather than photography.

That is the honest behaviour for a record whose image cannot be fetched, and it
is stated rather than worked around: **photography fidelity is still an Alpha
judgement.** Everything else in these captures — headline lengths, publisher
names, source counts, real elapsed times, category distribution, and therefore
card height, clamping and rail density — is real.
