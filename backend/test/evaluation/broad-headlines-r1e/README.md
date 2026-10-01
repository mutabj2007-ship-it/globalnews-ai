# Broad headlines offline quality benchmark (PUBLIC BETA HARDENING R1E)

**Evaluation only. Not product code.**
- Nothing in `backend/src` imports these files.
- `tsconfig.build.json` excludes `test/`, so they never reach `dist`.
- The backend unit suite (`src/**/*.spec.ts`) and the e2e suite (`*.e2e-spec.ts`) never collect `*.eval.ts`.

```
cd backend
R1E_OUT=<output dir> npx jest -c test/evaluation/broad-headlines-r1e/jest.eval.config.js
```

## What it does
- **CURRENT:** the accepted broad-headline selection, run through the **real** `NewsService.topHeadlines` and the `AnalysisService` broad branch with a stub GNews provider that returns the dataset.
  - The "model" only records the evidence it was handed; the repository's `MockAnalysisProvider` output is discarded.
  - Every dataset asserts that the recorded model input equals the first 8 de-duplicated candidates.
- **A, B, C1, C2:** prototypes of the R1D options (`prototypes.ts`), applied to the same ordered, de-duplicated candidate list.
  - Every signal is an imported repository function.
  - Every weight, cap and precedence is an **unvalidated prototype parameter**, printed in the output.
- **D:** prompt-only, so it is not executed. Its evidence set equals CURRENT.
- No provider, OpenAI or database is contacted.

## Datasets
- `datasets/fixtures.json`: [FIXTURE] EN and PL sets (not real articles).
- `datasets/real/*.json` (when present): verbatim captures of the cache-only `GET /news/top-headlines/retained`. These are picked up automatically.

## Outputs
- `CURRENT-PIPELINE.md`
- `OPTION-A-RESULTS.md`, `OPTION-B-RESULTS.md`, `OPTION-C-RESULTS.md`
- `EN-RESULTS.md`, `PL-RESULTS.md`
- `BLIND-COMPARISON.md`, `ANSWER-KEY.md`
- `METRICS.csv`
- `raw-inputs/`
- `summary.json`

The metrics are descriptive only. There is no overall quality score and no winner.
