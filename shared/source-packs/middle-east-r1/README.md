# Middle East multi-vantage source packs R1

These are dormant research manifests for CTO source convergence. They are not
feed-registry entries, runtime configuration, verified ingestion coverage, or
permission to acquire content. No application imports these files.

The governed Alpha baseline is exactly:
`BHR EGY IRN IRQ ISR JOR KWT LBN OMN PSE QAT SAU SYR TUR ARE YEM`.
This is GlobalNews AI's monitoring construct, not a geopolitical boundary claim.
The manifest does not change the existing regional resolver.

## Reading the records

`pack.json` contains scope, immutable R1 safety controls, and country file references.
Each country file includes source records, initial language targets, and explicit gaps.
The country is the **pack coverage assignment**, not an article-location assertion,
publisher nationality proof, or territorial-authority decision.

- `publisher.id` identifies a publication identity. It is not a claim of independent
  ownership; every ownership review is pending. Editions of one publisher must share
  its identity in subsequent rounds.
- `canonicalHost` is the proposed publisher endpoint host, preserving observed
  subdomains. For failed or title-only checks it remains provisional, as the evidence
  states. Alternate hosts are evidence, not automatic aliases or authority grants.
- `language` describes the selected edition; `languageStatus` distinguishes observed,
  indexed, and candidate language assignments. URL path names alone do not verify
  language. The checklist includes further relevant languages (for example Kurdish
  and French); it is deliberately non-exhaustive.
- `sourceType` uses the existing shared vocabulary. Institutional landing pages use
  OFFICIAL_SOURCE; news publications use NEWS_PROVIDER. These research classifications
  do not register institutional authority or assign independent corroboration.
  No structured dataset is claimed from a landing page.
- `endpoint.url` is a review/discovery landing page. All `feedUrl` values are null,
  all machine ingestion flags are false. bianet advertised RSS, but traversal failed;
  the manifest deliberately does not guess the link destination.
- `verificationEvidence` records URLs, method, review date, result and a short
  observation. `page_observed` means readable content returned by the research browser;
  `index_observed` means a search-index observation; `limited_content` covers transfer
  screens, titles and incomplete application rendering; `retrieval_failed` records
  failure in this environment. These are not live HTTP availability certifications.
- `LOCAL` means a country-facing publisher/institution candidate; it does not certify
  that its staff are physically inside the country. BBC Persian is explicitly
  INTERNATIONAL. OCHA is INTERNATIONAL institutional context. Their inclusion cannot
  fill a missing domestic newsroom slot.
- Rights and robots are independent axes. All rights are NOT_REVIEWED with null
  binding/instrument. Robots files were sampled only for ISNA, Ynet, bianet, WAFA and
  The Times of Israel; four failed, while the latter disclosed feed-path restrictions.
  The BBC research tool reported a robots block. All others are NOT_CHECKED.
  Neither a readable page nor an unavailable robots file grants permission.
- `accessLimitation` is specific to the observed check. A retrieval error does not
  establish national censorship, global outage or a paywall. Region, production
  network, authentication and subscription behaviour remain untested.

Research was limited to targeted publisher/institution pages, indexed identity
evidence, one advertised RSS traversal and five robots-file checks on 2026-09-22.
No crawling, article corpus collection, access bypass or broad scraping occurred.
Search and browser results may be cached; their review date is not their publication
date or a guarantee of freshness. Only short metadata observations are retained.

## Multi-vantage requirements

Every country retains at least two distinct news publication candidates and one
institutional candidate. Country packs cannot substitute for each other. The region
must retain Arab-language, Hebrew-language, Persian-language, Turkish-language and
English-language environments; English translation is not an additional independent
publisher. Source counts measure candidates only, never reliable or active coverage.

Preserve original report text/language, publisher, byline where available, canonical
item URL, publication/retrieval timestamps, geography as reported, corrections and
syndication origin when any future acquisition is authorized. Translation must be
labelled and linked to its original. Keep conflicting claims with their source and
time; do not replace them with a fabricated consensus or majority-vote truth.
Deduplication may link copies but must not discard distinct accounts. A wire copy,
translation, and official release repeated by another outlet are not automatically
independent corroboration.

The two Saba-branded hosts retain separate IDs and host attribution. Shared branding
does not establish equivalence, and distinct hosts do not establish independent
ownership. Their operating locations and institutional relationships remain open.
Israeli and Palestinian packs remain distinct. Iranian domestic and external Persian
coverage remain distinct. Iraqi Arabic and Kurdistan-focused environments remain
visible. A regional network cannot stand in for all 16 countries.

No political sentiment scoring, ideological labels, credibility ranking or invented
truth score is stored. An external ideological classification would require separate
governance; this R1 contract admits no such field.

## Gaps and convergence

All packs are incomplete. In addition to per-country gaps: there are **zero verified
machine feeds, zero governed rights bindings and zero active sources**. Syria's bank
candidate and Iran's statistical endpoint are particularly provisional. English
institutional pages do not fill English newsroom gaps. Official statistics must keep
their reference dates, units, methods, revisions and actual geographic scope;
institutional releases are not independent journalistic corroboration.

Before any later activation, review exact feed/API payloads and publisher identity,
rights instruments and product conditions, agent/path robots directives, access
limits, ownership relationships, omitted language/subnational environments, and the
explicit country gaps. No review in this pack authorizes Alpha activation or removes
Production HOLD.

## Offline validation

Run from this worktree:

```sh
node scripts/verify-middle-east-source-packs.mjs
node --test scripts/verify-middle-east-source-packs.test.mjs
```

The dependency-free validator rejects scope drift, missing fields/evidence/gaps,
cross-country substitution, loss of required language environments, insufficient
publication/institutional candidates, unknown metadata fields, and activation or
rights/feed promotion. Mutation tests exercise these refusals. No test makes network
requests. This deliberately strict R1 contract must be revised under governance
before it can represent a later approved acquisition state.
