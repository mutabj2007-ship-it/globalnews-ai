# Map Ask Geography Context R1

Base: release `30fd93637094041e9b046df7c6f68e7648c6e354`. Backend + shared only; the frontend wiring belongs to H.

## Contract

`POST /analysis/news` accepts one new optional field:

```json
{ "query": "…", "geographyContext": { "countryCode": "POL", "displayName": "Poland" } }
```

| Field | Rule |
|---|---|
| `countryCode` | **Retrieval authority. R1.1:** it must be the ISO alpha-2 or alpha-3 code of a governed country in the shared `COUNTRIES` registry (`resolveGovernedCountryCode`). A 2-letter code is looked up only as alpha-2 and a 3-letter code only as alpha-3. Lower case is normalized to upper case (`pl` → `PL`). A name (`Poland`), an alias (`UK`), a numeric code (`616`) or an unknown code (`ZZ`, `ZZZ`) is a **400**. The service re-checks it and refuses too, so a supplied geography is never silently dropped. |
| `displayName` | **Presentation only.** 1–`MAX_GEOGRAPHY_DISPLAY_NAME_LENGTH` (100) characters. It is validated and then never read by retrieval, the cache key, the model prompt or history. |
| anything else | Rejected with a 400 by the global `ValidationPipe` (`forbidNonWhitelisted`). No article, source, evidence, report or cluster ids. |

Shared types: `GeographyContext`, and `AnalysisRetrievalContext.geographyContextUsed`.

## Precedence (strongest first)

1. A multi-story `selection`: the whole scope, so the geography context is ignored.
2. A place typed in the question (a declared region, one or more countries, or a demonym). The response carries `geographyContextUsed: false`.
3. `storyContext`: the more specific anchor. When present, the geography context is ignored entirely; it is not stamped and not recorded.
4. `geographyContext`: it seeds exactly the location a country-only `storyContext` always seeded. The response carries `geographyContextUsed: true`.

The cache key gains `:geo:<iso3>` only when the geography context applies.

## Compute

- Opening Ask with a map country selected sends nothing: 0 AI.
- Only an explicit Send/Run reaches `POST /analysis/news`, the one compute boundary.
- A verified Ask records its question with the governing country code: the story's country if there is one, otherwise the map country's code.

## Tests

- `backend/src/modules/analysis/service/map-geography-context.spec.ts`
- `backend/src/modules/history/question-history-writer.spec.ts` (two MAP GEOGRAPHY R1 cases)
