# MY INTELLIGENCE R1.3 — REVIEW HARNESS

**Verification scaffolding only. This branch must never be promoted as product code.**

These two scripts are not imported by the application, are not part of any build,
and are deliberately absent from the promotion candidate
`feature/my-intelligence-r1-frontend-h` @ `517e450100ca3f116d26ce6c6e52df59b3961ff1`,
whose reviewed inventory is 28 product files under `frontend/src`.

They live here so the evidence behind the R1.3 delivery can be re-run and
re-checked by someone other than its author — which is the only reason to keep
a harness at all.

| Script | What it proves |
|---|---|
| `mi-capture.mjs` | Drives the running frontend through the 36 approved states — 360/390/430, 768/1024, 1440/1920, EN and PL, selection, keyboard, first-visit, empty, degraded, error, signed-out and the Home delta — and photographs each one. Per frame it also asserts zero horizontal overflow, zero POSTs to any analysis or ask endpoint, and zero overlap between the floating Ask launcher and the frozen Select control. The run fails if any of those is non-zero. |
| `ruling1-proof.mjs` | Ruling 1, measured per width: on `/my-intelligence` the launcher is absent, the Select control is present, the overlap is 0 px, and the dock still opens on `globalnews:ask-open` — the path "Ask about selected" rides on. On `/` the launcher is intact. |

## Running them

```
# build and serve the candidate with review fixtures
cd frontend
NEXT_PUBLIC_MI_DEV_FIXTURES=true npm run build
NEXT_PUBLIC_MI_DEV_FIXTURES=true npx next start -p 4320

# then, from the repository root
node scripts/my-intelligence-review/mi-capture.mjs
node scripts/my-intelligence-review/ruling1-proof.mjs
```

Both expect the frontend on `http://127.0.0.1:4320` and write PNGs to
`/home/claude/mishots`; change `BASE` and `OUT` at the top of `mi-capture.mjs`
for another environment. `mi-capture.mjs` stubs the Home feed request because a
review container has no backend — without it Home renders "Couldn't load the
latest updates." and the Home bookmark delta cannot be photographed at all.
That stub is a capture concern and never reaches the application bundle.

The `executablePath` in both files points at this container's Chromium. On
another machine, remove it and let Playwright resolve its own browser.
