# M60 — Closed Alpha Readiness

## Milestone

M60 — Closed Alpha Readiness

## Base repository state audited

```
branch: main
HEAD: c1be6a1
commit: docs: record M59 scale readiness evidence
```

## Audit conclusion

The application is **functionally at MVP level**. No P0 code blocker was
found. Exactly one P1 gap was identified, and is corrected by this
milestone:

**`NEXT_PUBLIC_API_URL` was missing from `.env.example`.** Every frontend
API helper (`analysisApi.ts`, `newsApi.ts`, `countryApi.ts`,
`accountFetch.ts`, `AccountControl.tsx`) reads
`process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'` — a correct
pattern in the code itself, but the variable was never documented for
anyone configuring a real deployment. Because Next.js inlines
`NEXT_PUBLIC_*` variables into the frontend bundle at build time (not read
at runtime), an undocumented or unset value in a production build would
silently ship a frontend that tries to reach `localhost:4000` from every
visitor's own browser — a real, concrete deployment risk, not a
theoretical one.

## Correction performed

Added a new, clearly labeled `NEXT_PUBLIC_API_URL` section to
`.env.example`, placed immediately after `FRONTEND_ORIGIN` (its natural
counterpart — `FRONTEND_ORIGIN` tells the backend which frontend to
trust; `NEXT_PUBLIC_API_URL` tells the frontend which backend to call).
The documentation explains: what the variable is, the local development
default (`http://localhost:4000`), that production must use the real
deployed backend URL, the build-time-inlining behavior specific to
`NEXT_PUBLIC_` prefixed variables and why that matters, and that it must
never contain a secret.

## Scope of this correction

- **Database impact**: none.
- **Migration impact**: none.
- **Production source-code impact**: none — `.env.example` only.
- **Files changed**: `.env.example` (documentation), plus this report
  (`docs/milestones/M60_CLOSED_ALPHA_READINESS_REPORT.md`).

## MVP / Closed Alpha status

This repository state is:

- ✅ **FUNCTIONALLY MVP-READY** — the core product (guest browse/search/
  map/AI analysis, plus fully optional accounts with Google OAuth,
  history, and account deletion) is code-complete and tested, and the one
  identified documentation gap is now corrected.
- ⬜ **NOT YET EXTERNALLY CONFIGURED FOR CLOSED ALPHA** — real credentials
  and a real deployment target are still required before real closed-alpha
  users can be given access with live providers and live sign-in. See the
  pending external configuration list below.
- ⬜ **NOT PUBLIC-PRODUCTION READY** — public launch involves additional
  considerations (broader legal/policy artifacts, wider provider capacity
  planning, etc.) intentionally out of scope for this milestone.

This report makes no claim that external services are configured, and no
claim of official public launch readiness.

## External configuration still pending (operational, not code)

The following are genuinely required before closed-alpha users can use the
product with real providers and real sign-in. None of these were created,
generated, or fabricated as part of this milestone — they require manual
setup with CTO involvement:

1. Production `DATABASE_URL`
2. Production `FRONTEND_ORIGIN`
3. Production `NEXT_PUBLIC_API_URL`
4. `GNEWS_API_KEY`, if a real (non-mock) news provider is to be enabled
5. `OPENAI_API_KEY` and a configured model, if real (non-mock) AI analysis
   is to be enabled
6. `OAUTH_CLIENT_ID`
7. `OAUTH_CLIENT_SECRET`
8. `OAUTH_FLOW_SECRET`
9. Correct Google OAuth callback URL / authorized origin configuration in
   Google Cloud Console, matching the real production frontend/backend
   origins

Accounts remain fully optional by product design — the guest experience
does not depend on items 6–9 being configured.
