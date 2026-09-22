# Governed EU-27 national source packs — R1

This is an inactive source-discovery catalogue for CTO convergence. It is not a runtime feed registry, rights authority, or assertion of live coverage. The 27 country manifests contain 162 candidates: two domestic publishers plus public news, national statistics, parliament and central bank sources per country.

All countries are **PARTIAL**. Each category separately records a **COVERAGE_GAP** until validated. No country earns **VALIDATED_LOCAL_BASELINE** from a homepage, an advertised feed, an EU-level source or Poland's evidence. R1's validator intentionally refuses baseline promotion: a later reviewed revision must add retained payload evidence and scoped rights/identity reviews, not flip a status string.

## Files and validation

- `countries/<ISO2>.json`: source identity, original publisher name, role, language targets, discovery outcome, documented endpoints, blockers and next steps.
- `governance.json`: membership, baseline requirements, language policy, HOLD and supplementary Eurostat API/RSS.
- Run `npm run test:eu27-source-packs` from the repository root. Node 20+; no dependency install or network requests.
- CI runs the same offline validator and negative tests when these files change.

## Evidence limits

Research date: 2026-09-22. Every candidate homepage was attempted through the web research tool. Its output can be cached, so `checkedAt` is the review date, not a direct HTTP fetch time. `reportedCrawlAge` preserves the tool's cache indication. Discovery stores metadata only; no article bodies were copied, translated or admitted.

`PAGE_OBSERVED` means the tool returned page content. `LIMITED_PAGE` covers empty, short, interstitial or rejected-page results. `ACCESS_UNRESOLVED` means the tool failed; it does not establish a dead source or a specific HTTP status. None proves freshness, machine transport, ownership, editorial independence or permission. Redirect destinations are recorded without expanding any host or rights allowlist.

The national statistics and central-bank identities have shared directory references in the [ESS partner directory](https://ec.europa.eu/eurostat/web/european-statistical-system/ess-partners) and [ECB national-bank directory](https://www.ecb.europa.eu/services/links/html/index.en.html). These references support discovery, not a blanket endorsement of new domains or subdomains. Candidate roles require review before runtime registry admission.

Endpoint kinds distinguish actual advertised RSS/API URLs from RSS indexes and API documentation pages. Empty endpoint lists are deliberate gaps; no conventional feed paths were invented. Documented endpoints were not live payload-validated in this round.

## Governance

All 162 candidates have `enabled: false`, `ingestionMethod: none`, unresolved rights and unreviewed ownership. Public news does not count as independent domestic journalism. Two mastheads do not prove two ownership groups; syndicated copies do not prove corroboration. Country code describes publisher market, not the subject of every article.

Baseline requirements include two domestic editorially independent publishers in distinct reviewed ownership groups, national official sources, current permitted original-language payloads, parsing/freshness/lineage checks and CTO review. Public-source applicability should be reviewed explicitly in the next revision if a category is unsuitable.

Activation remains a separate source-ID authorization through existing runtime and rights controls. There is no import from providers, routes, schedulers or frontend code. This pack supplies no acquisition function and no click-triggered fetch. Production HOLD remains; no mass activation.

Rights restrictions observed in Le Monde, Tagesschau and Polskie Radio documentation are recorded as blockers, with source URLs. These observations do not create rights grades. A public RSS/API endpoint is not permission to retain or redistribute its contents. Positive published terms also require a scoped binding through the existing rights evaluator.

## Original language

Publisher names retain their scripts and diacritics. Expected languages are discovery targets; observed payload language remains unknown. They must never stamp an unread payload with an assumed language. When retention is permitted, keep the original text/bytes, source URL, language (or `und`), timestamps and hash. A future translation is a separately linked derived artifact and must not overwrite the original.

Multilingual and regional gaps are explicit, including Belgian German, Cypriot Turkish, Irish, Maltese independent news and Spain's regional languages. National candidates do not imply complete regional or minority-language coverage.

## Poland as the deep reference

Poland binds WP and GUS to their existing registry IDs. The WP record reports a 2026-08-31 Polish feed fetch but has no retained WP byte fixture. The retained GUS fixture is **English**, structurally accurate with normalized whitespace, not a Polish-language capture or byte-accurate original.

The Polish GUS RSS index remains access-unresolved. BDL documentation supports Polish labels. Sejm API discovery records term 10 as a documentation example, requiring term and pagination checks. NBP FX/gold API is economic PUBLIC_DATA, never domestic journalism. Its publication discovery link is recorded separately. OKO.press supplies a second publisher candidate; its transport and independence review remain open. Polskie Radio advertises RSS but restricts reuse.

Historical PAP, TVN24 and Rzeczpospolita failures remain historical findings, not current checks. Poland's explicit promotion checklist can be applied independently to every country; its captures cannot validate another national pack.

## Supplementary European authority

Eurostat uses its existing registry/rights binding and stays disabled. Official documentation confirms a [REST data API](https://ec.europa.eu/eurostat/web/user-guides/data-browser/api-data-access/) and [catalogue RSS update feeds](https://ec.europa.eu/eurostat/web/user-guides/data-browser/api-data-access/api-detailed-guidelines/catalogue-api/rss) in English, German and French. These announce statistical updates, not domestic journalism.

Keep dataset dimensions, units, periods, flags and original labels. Map ISO Greece `GR` to Eurostat dataset geo `EL` explicitly. Eurostat cannot satisfy a national-authority or local-journalism slot, even for a dataset about that country.
