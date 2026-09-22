# Kenya Elections retained evidence

This is a separate Election specialist module. The public reader imports no producer,
network transport, model, scheduler, or credential. `GET /election/evidence/ke?locale=en|pl`
reads only the digest-pinned admitted bundle. The default is `COVERAGE_GAP` because
`ELECTION_EVIDENCE_READ_ENABLED` is false/unset. Set true only for an authorized local
rehearsal. Setting false immediately stops evidence delivery; responses are no-store.
No production activation is authorized by this recovery.

## Bounded source and pipeline

The first capture is one official IEBC-hosted PDF: Gazette Notice 11216, page 3571,
Ol Kalou Member of National Assembly by-election, 16 July 2026. It explicitly declares
the person elected and states votes garnered. This is an OFFICIAL_DECLARATION record;
it is not a result form, a form reporting percentage, or an inferred tally outcome.
The PDF does not explicitly supply cycle or polling/tallying-centre identity; those
remain null. The source language is en regardless of the product locale.

Run from the repository root, with a separately permissioned operator:

```
node --use-system-ca node_modules/ts-node/dist/bin.js --project backend/tsconfig.json backend/src/modules/election/election-capture.cli.ts OFFICIAL_URL REVIEW_DIRECTORY DISCOVERY_URL
node node_modules/ts-node/dist/bin.js --project backend/tsconfig.json backend/src/modules/election/election-admit.cli.ts REVIEWED_CANDIDATE_JSON ADMISSION_DIRECTORY APPROVED_BUNDLE_SHA256 APPROVED_TLS_FINGERPRINT
```

Capture issues one GET, caps the body at 8 MiB and the deadline at 30 seconds, rejects
redirects and unexpected TLS identities, and stops on errors including 429/503 rather
than retrying. There is no crawler or scheduled acquisition. Certificate renewal needs
an explicit operator review of the pin. The initial bootstrap certificate was inspected
and recorded during the user-authorized first capture; subsequent capture is pinned.
Normal CA/hostname verification remains enabled (the host requires the Windows CA store).

The operator retains bytes first, reviews PDF text AND its rendered page, transcribes
only supported fields with source locators, and approves the exact bundle digest.
Admission validates the schema, bounded set, hashes, origin, lineage, revision chain,
denominators and vote sanity. It refuses rather than repairs. Exclusive file creation
prevents overwriting a retained bundle. The review-approved digest also pins all
transcriptions and allowed evidence kinds; a plausible invented declaration is not
admitted merely because it matches the schema. Update the read pin only after review.

Deployment must mount admitted data read-only to the reader process and use a separate
operator identity for capture/admission. This recovery does not provision/deploy such
infrastructure. Raw retained bytes and admission details are never returned by public GET.
No reader interest history is stored, and correlated access logs are suppressed on this
specific evidence route. Upstream hosting access-log configuration remains a deployment gate.

## Evidence distinctions and limits

- FORM_AVAILABLE: an identified form can be accessed; blank templates are explicitly labelled.
- FORM_REPORTED: the publisher reports X of Y forms; even 100% remains only form reporting.
- TALLY_OBSERVATION: qualified, scoped vote observations from a publisher-identified unit;
  registration sanity and a six-hour maximum expiry apply. No aggregation is exposed.
- OFFICIAL_DECLARATION: an explicit documented declaration, never derived from forms/votes.

Only OFFICIAL_DECLARATION is admitted in the first real bundle. Other variants are
modelled and tested with synthetic fixtures, not represented as real captured evidence.
No forecasts, rankings, swing/sentiment estimates, recommendations, candidate profiles,
watch registrations, geometry, or political joins exist. Unknown fields are rejected.
Corrections are append-only and replace their predecessor only in the current read view.
A tally decrease without an explicit correction is refused; no silent adjustment occurs.

The recovered `/election-visual-preview` and `/election-visual-preview/compact` are the
approved unbound H R2 design, retaining EN/PL and four-region ordering. The official
capture is deliberately not inserted among the preview's placeholder contestants.
`/election` remains closed. Public read activation, full live UI binding, electoral
geometry licensing and any wider acquisition remain outside this recovery's HOLD.

## Validation

```
npm run build:shared
npm run test --workspace=backend -- --runInBand election-evidence
npm run test --workspace=frontend -- --runInBand electionContract
npm run build:backend
npm run build:frontend
```

`verify-election-preview.cjs` uses Playwright (available through NODE_PATH or an installed
package) and a built local frontend on port 3128. It writes review artifacts only to the
explicit output directory supplied as its argument. No production URL is used.
