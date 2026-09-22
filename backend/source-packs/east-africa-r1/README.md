# East Africa source-pack R1 format

This directory contains offline source-pack data. Nothing imports it into the application, seeds a database, changes the provider registry, or enables Alpha ingestion. Every source and pack is disabled; production HOLD remains.

The exact country set is BDI COD DJI ERI ETH KEN RWA SOM SSD TZA UGA. A source covering Sudan does not add Sudan to that set. No Zambia entry exists.

## Files

- `index.json`: governed membership and base branch/commit.
- Country JSON files: proposed sources, six-category audit, technical status, rights hold, provenance and explicit `COVERAGE_GAP` findings.
- `candidates.txt`: finite input inventory, including failed candidates and separately identified replacement hosts. Columns are ISO3, key, name, category, homepage, optional explicit identity/rights or previously known feed URL.
- `captures.json`: timestamped HTTP results, redirect chains, content type, bounded byte count/hash, errors and metadata-only samples. Hashes identify the fetched bounded bytes; raw publisher content is not retained. Initial regex samples are not parsed XML proof. The later `XML_STRUCTURE_RECHECK.xml` fields are the parsed evidence.
- `reviews.json`: human-reviewed primary-page evidence, ownership group notes, rights restrictions and country findings. Web-tool discovery/review is separate from measured direct requests; its HTTP counts/bytes are not included in capture limits.

## Status meanings

`VERIFIED_FEED_ENDPOINT` means a bounded request returned a complete XML feed, strict parsing succeeded, the first three items had titles, same-host HTTPS links and usable dates, and the newest sampled date was within 90 days. It does not validate every item, semantic publication scope, identity, independence, article rights or freshness suitable for alerts. Institutional news RSS is not a statistical API. The 90-day cutoff is an audit triage threshold, not an ingestion policy.

`FEED_SIGNATURE_ONLY` is weaker: no successful strict XML recheck. `EMPTY_FEED`, `INVALID_XML`, `RECHECK_FAILED`, `STALE_FEED`, `DEAD_ENDPOINT`, `BOT_CHALLENGE`, `ACCESS_BLOCKED`, `INACCESSIBLE`, `NOT_FETCHED`, `TRUNCATED` and `ACCESS_POLICY_REVIEW` retain uncertainty or failure. An HTML page only confirms a page response; it does not confirm institution identity or structured ingestion support. Historical failures are not presented as current observations.

A `COVERAGE_GAP` remains until the category's rights and admission requirements are met. Independent local diversity additionally requires at least two distinct verified ownership groups and usable, legally cleared endpoints. Self-described independence and different domains alone do not qualify. Alternative domains and multiple roles for one institution do not create diversity. OCHA/IFRC references are humanitarian context only. No Reuters/AP fallback exists.

Publisher-declared feed language is retained as metadata, not detected article language. Shabelle and RNA demonstrate why English CMS language metadata cannot safely classify every article.

## Offline validation

Run from the repository root with Node 20+ and Windows PowerShell:

```text
node scripts/source-packs/build-east-africa.mjs
node --test scripts/source-packs/east-africa.spec.mjs
```

The builder is deterministic and network-free. Tests cover membership, dormancy, all six categories, evidence linkage and request bounds, publisher deduplication, negative endpoint evidence, strict XML rejection and fail-closed readiness.

## Optional bounded recapture

```text
node scripts/source-packs/audit-east-africa.mjs --live
node scripts/source-packs/complete-east-africa-audit.mjs --live
```

This replaces the capture and requires renewed human review before regenerating manifests. Known explicitly restricted sources are retained without refetching. Do not run it as a scheduled crawler. There are at most five logical direct requests per candidate, four concurrent candidates, a 12-second timeout per logical request, a 512-KiB decoded body limit and at most three followed redirects (20 maximum HTTP requests including redirects per candidate). No article links, PDFs, pagination, authentication, anti-bot bypass or TLS bypass are followed. Five selected robots evidence rechecks were retained separately inside the five-request budget.

Robots handling is deliberately conservative: matching Disallow rules from any agent group cause a skip, even when the group would not apply to this audit. This may understate technical coverage. Missing robots (404) permits the bounded check; access failure or a challenge prevents further discovery. Initial-run exceptions and subsequent corrections are recorded in `captures.json.auditNotes` rather than hidden. The XML parser prohibits DTD and external entity resolution. Captures are observations from this machine at the recorded time, not permanent availability claims.

No source is approved for product use by this pack. CTO convergence must resolve independence, authority, rights, publication scope, item language, freshness and parser compatibility before any separate activation decision.
