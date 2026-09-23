# Retained evidence R2: offline inventory and review

These commands read local retained files only. They do not bootstrap Nest, Prisma, a provider, an AI client or a public reader. Outputs contain private retained material: keep them outside the web root and Git. Run from the repository root with existing dependencies/shared build available. No installation or acquisition is part of this workflow.

## Commands available now

```powershell
node scripts/retained-evidence-offline.cjs inventory > retained-inventory.json
node scripts/retained-evidence-offline.cjs review C:\PrivateReview\articles.json > C:\PrivateReview\queue.json
node scripts/retained-evidence-offline.cjs record-review C:\PrivateReview\queue.json C:\PrivateReview\decisions.json > C:\PrivateReview\receipt.json
node scripts/retained-evidence-offline.cjs admit security C:\PrivateReview\receipt.json
node scripts/retained-evidence-offline.cjs admit humanitarian C:\PrivateReview\capture.json
```

`review` accepts the Article export below (an array, at most 10,000 rows and 32 MiB). It reuses `classifySecurityCandidate` and `buildSecurityObservation` with relevant retained ArticleCountry rows. No country is inferred from the headline or Article.countryCode. `fetchedAt` becomes firstSeenAt, as in the existing persistence mapper. Unknown publication basis becomes unproven. Provider identity is not reconstructed because Article does not persist it. The classifier's ADMITTED_TO_SECURITY verdict means internal domain ownership, never public truth.

`decisions.json` is a human-authored review record:

```json
{
  "queueSha256": "SHA256 of exact queue.json bytes",
  "reviewer": "actual internal reviewer identity",
  "reviewedAt": "actual UTC review timestamp",
  "records": [
    {
      "retainedId": "id copied from queue",
      "recordSha256": "hash copied from queue",
      "decision": "REVIEWED_INTERNAL",
      "reason": "actual review finding and limitations"
    }
  ]
}
```

Use `REJECTED` for a rejected record. Obtain the queue digest using `(Get-FileHash C:\PrivateReview\queue.json -Algorithm SHA256).Hash.ToLowerInvariant()`. Decisions bind exact queue bytes and retained record hashes; unknown, duplicate, incomplete or public-approval decisions are refused. This records an operator assertion for internal review, not authenticated publication authority or a rights grant. Retain the original export, queue and receipt together under existing internal access controls.

**The `admit` command is a fail-closed admission preflight, not a write command.** It exits 2 with the current gate reason and `persisted:false`. Today Security always returns PUBLIC_CONTENT_NOT_AUTHORISED; Humanitarian returns NO_MATCHING_GOVERNED_CAPTURE_APPROVAL. Adding `approved:true` to an input or recording an internal review cannot change these outcomes. There is no honest executable public approval command under the current contracts. This lane does not invent one.

For a future governed Humanitarian import, the existing exact API is `admitRetainedEvidence(bytes, trustedReviewAuthority, governedResolver, recordedAt)`, followed by `HumanitarianRetainedRepository.append(admitted)`. The composition root must first install current protection authority through `loadHumanitarianAuthority`; capture review must independently bind the SHA256 and paths into original bytes. No installed production review authority exists here. JSON receipts from this tool are deliberately not accepted as that authority. A reviewed offline composition binding is still required before an executable import can succeed. The public Humanitarian retained-read contract currently carries only absence and must not be widened merely because internal retention succeeds.

Security's existing repository lifecycle (`startRun`, `completeRun`, append-only integrity/revision validation) remains separate from public admission. This tool does not start a producer or write projection runs. A governed publication instrument and independent assessment approval, plus a public projection implementation, remain prerequisites. An internal review receipt is insufficient.

## Alpha measurement later, not run in this lane

With an explicitly selected Alpha connection and an existing read-only role (no Production credentials):

```powershell
psql -X -qAt -v ON_ERROR_STOP=1 --dbname=$env:ALPHA_READONLY_DATABASE_URL -f docs/retained-evidence-r2/inventory-alpha.sql
psql -X -qAt -v ON_ERROR_STOP=1 --dbname=$env:ALPHA_READONLY_DATABASE_URL -f docs/retained-evidence-r2/export-alpha.sql > C:\PrivateReview\articles.json
```

Both SQL scripts use repeatable-read, read-only transactions and a 30-second statement timeout. Export is bounded to the first 10,000 Article IDs; compare its count with inventory before claiming corpus coverage. The CLI refuses exports exceeding 32 MiB; export a smaller authorized batch if necessary. No database URL is loaded by the offline CLI. SQL was inspected but not executed against a database in this lane.

The inventory measures Article, ArticleCountry and SecurityObservation counts and reports whether Humanitarian retained tables exist. If installed and the read-only role is authorized for them, use a separate read-only transaction to count `hum_authority.retained_capture` and `hum_authority.retained_observation_revision`; readers are denied these raw tables by design. A permission error means unmeasured, not zero. Article model counts cannot establish exact GNews/GDELT split because providerId is not stored. Security revisions are not necessarily distinct incidents or publicly approved records.

## Repository findings and scope

The Git-tracked data-like inventory at base 16961be finds 105 JSON/GeoJSON/JSONL/CSV/XML/HTML/text/archive files. Three article-shaped rows occur only in two visual fixtures and are excluded. Non-fixture article-shaped retained rows: zero. This is bounded format discovery, not proof that every arbitrary binary or ignored local holding is empty.

`backend/source-packs/east-africa-r1/captures.json` holds 86 source-audit entries. Its feed samples contain links/dates and title-presence flags, not retained article bodies or original raw XML. The associated reviews concern source discovery/rights, not domain occurrence, person-claim or protection approvals. Neither URL slugs nor source category labels may supply missing claims. Copernicus machinery and test captures are implementation evidence; no repository original capture with installed current review was established. Imihigo, election, reference geography and source packs do not constitute Humanitarian/Security admission.

## Existing dashboard slot mapping

| Existing region                                 | What reaches it now                                    | What an internally reviewed candidate preserves privately                                                                                                           |
| ----------------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Humanitarian coverage / assessment paragraph    | Existing absence/read-failure and gate explanation     | No article-to-Humanitarian rule exists                                                                                                                              |
| Humanitarian geography / selected situation     | No positive record                                     | A governed Copernicus admission can preserve publisher-stated inundation geometry/country, chronology, revision and citation; it establishes no need/access finding |
| Humanitarian sector / need / access             | Withheld                                               | No inference from reporting, flood extent or source category                                                                                                        |
| Security A0 / coverage                          | Existing canonical absence and public-gate explanation | Internal review reason and denied public decision                                                                                                                   |
| Security incidents / source / time              | Withheld                                               | Publisher claim text, source reference, retrieval time, publisher vintage only when established                                                                     |
| Security map                                    | Withheld                                               | Retained country attribution, COUNTRY / INTERPRETED; not incident coordinates                                                                                       |
| Security attribution / actor / cause / severity | Withheld separately                                    | No missing field inferred; classifier ownership is not actor identity or attribution confidence                                                                     |
| Security infrastructure / border panels         | Withheld                                               | No evidence for these axes is manufactured from an incident report                                                                                                  |
| Related reporting                               | Existing contextual reporting only                     | Never promoted to a domain observation                                                                                                                              |

No positive record reaches any dashboard slot in this change. No visual component, dictionary, route or reader contract changes from accepted head 16961be. Synthetic tests prove internal mapping and governed Humanitarian admission, not a public positive route. A public reviewed-record mapping demonstration would require a currently nonexistent public success contract; it is not simulated in the reader.
