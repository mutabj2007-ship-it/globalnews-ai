# GlobalNews AI

Enterprise monorepo for the GlobalNews AI platform.

> **Status:** Sprint 3 — Homepage UI (Sprint 2) plus a provider-agnostic
> backend news module serving mock data (Sprint 3). No AI integration,
> authentication, or database yet.

## Tech Stack

| Layer    | Technology                          |
| -------- | ------------------------------------ |
| Frontend | Next.js, TypeScript, Tailwind CSS    |
| Backend  | NestJS, TypeScript                   |
| Shared   | TypeScript (types/constants package) |
| Tooling  | ESLint, Prettier, Docker, GitHub Actions |

## Repository Structure

```
globalnews-ai/
├── frontend/       # Next.js + TypeScript + Tailwind CSS app
├── backend/        # NestJS + TypeScript API service
├── shared/         # Shared TypeScript types/constants used by both apps
├── docs/           # Project documentation
├── .github/        # CI workflows, PR/issue templates
├── docker-compose.yml
├── .env.example
├── .gitignore
├── .editorconfig
├── .prettierrc
└── package.json    # npm workspaces root
```

## Prerequisites

Install before running the project:

- **Node.js** v20 or later
- **npm** v10 or later (ships with Node 20)
- **Docker** and **Docker Compose** (only required if running via containers)
- **Git**

## Getting Started (local, without Docker)

1. Install dependencies for all workspaces from the repo root:
   ```bash
   npm install
   ```
2. Copy environment files:
   ```bash
   cp backend/.env.example backend/.env
   cp frontend/.env.example frontend/.env.local
   ```
3. Run the backend (NestJS, default port 4000). This automatically builds
   the `shared` workspace first — see
   [Monorepo Workspace Build Order](#monorepo-workspace-build-order) below.
   ```bash
   npm run dev:backend
   ```
4. In a separate terminal, run the frontend (Next.js, default port 3000):
   ```bash
   npm run dev:frontend
   ```
5. Visit `http://localhost:3000` (frontend) and `http://localhost:4000/health`
   (backend health check).

## Getting Started (with Docker)

1. Copy the root environment file:
   ```bash
   cp .env.example .env
   ```
2. Build and start both services:
   ```bash
   docker compose up --build
   ```
3. Frontend will be available at `http://localhost:3000`, backend at
   `http://localhost:4000`.
4. Stop the containers:
   ```bash
   docker compose down
   ```

## Monorepo Workspace Build Order

`shared` is a real npm workspace package (`@globalnews-ai/shared`), not a
path alias. `backend` and `frontend` both depend on it as a normal npm
dependency (`"@globalnews-ai/shared": "*"` in their `package.json`), and
`npm install` symlinks it into each workspace's `node_modules` the same
way any other npm dependency would be linked.

That means **`shared` must be built (`npm run build:shared`) before
`backend` is built or started**, because `backend` imports the shared
package's compiled output (`shared/dist/index.js` /
`shared/dist/index.d.ts`), not its TypeScript source. `backend`'s
`tsconfig.json` does not — and should not — map `@globalnews-ai/shared`
to `../shared/src`; doing so previously caused TypeScript to pull shared's
source files into the backend's compilation, which expanded the inferred
`rootDir` and produced a broken output path
(`backend/dist/backend/src/main.js` instead of `backend/dist/main.js`).

To make this build order automatic instead of relying on people
remembering it, the root `package.json` defines `pre`-hooks that npm runs
automatically:

```json
"predev:backend": "npm run build:shared",
"prebuild:backend": "npm run build:shared"
```

So both `npm run dev:backend` and `npm run build:backend` always build
`shared` first. If you ever see an error like `Cannot find module
'.../backend/dist/main'` or a resolution failure for
`@globalnews-ai/shared`, run `npm run build:shared` manually and retry —
that almost always means `shared/dist` is missing or stale.

### Backend build cache

The backend's own build is also self-cleaning. `backend/package.json`
defines `prebuild` and `prestart:dev` hooks that run `npm run clean`
(`rimraf dist "*.tsbuildinfo"`) before every `nest build` or
`nest start --watch`. This exists because TypeScript's incremental
build cache (`*.tsbuildinfo`) can go stale if `backend/dist` is ever
deleted or edited outside of a normal build: TypeScript compares source
file hashes recorded in the cache, not whether the output files still
exist on disk, so it can report a successful build while silently
skipping emission entirely. `backend/tsconfig.json` also sets
`"incremental": false` to remove this class of bug altogether. If you
need to clean the backend manually, run `npm run clean --workspace=backend`.

## Common Scripts (run from repo root)

| Command                    | Description                                  |
| --------------------------- | --------------------------------------------- |
| `npm run dev:frontend`     | Start Next.js dev server                     |
| `npm run dev:backend`      | Build `shared`, then start NestJS dev server (watch mode) |
| `npm run build`            | Build shared, frontend, and backend          |
| `npm run build:backend`    | Build `shared`, then build the backend       |
| `npm run lint`             | Lint frontend and backend                    |
| `npm run format`           | Format all files with Prettier               |
| `npm run test:backend`     | Run backend unit tests                       |
| `npm run docker:up`        | Build and start via Docker Compose           |
| `npm run docker:down`      | Stop Docker Compose services                 |

## News Module (Sprint 3, extended in Sprint 4.1)

The backend exposes a provider-agnostic news API at `backend/src/modules/news/`.
As of Sprint 4.1 it has two providers — `MockNewsProvider` and
`GNewsProvider`, the first real provider — but the module only ever
activates **one of them at a time** for reads (see below). Adding another
real provider (Reuters, AP News, BBC, NewsAPI, GDELT, Google News, ...)
means implementing the `NewsProvider` interface and registering it in
`news.module.ts` — no other code changes. Endpoints:

- `GET /news/search?q=...&limit=...`
- `GET /news/top-headlines?limit=...`
- `GET /news/category/:category?limit=...`
- `GET /news/providers/health`

The homepage fetches from these endpoints instead of using static content.
If the backend isn't running, the affected sections show a clear
"temporarily unavailable" message rather than fake data.

## GNews Integration (Sprint 4.1)

[GNews](https://gnews.io) is the first real (non-mock) news provider,
implemented at `backend/src/modules/news/providers/gnews.provider.ts`.

**Mock vs. live mode.** Exactly one provider is active for
search/top-headlines/category at a time, decided once at backend startup:

- `GNEWS_API_KEY` **set** → `GNewsProvider` serves real requests.
- `GNEWS_API_KEY` **unset** → `MockNewsProvider` serves requests instead.

The two are never blended in the same response — that's deliberate, so
mock data can never be silently presented as live reporting. You can see
which provider actually answered a given request in the response's
`providers` field (e.g. `"providers": ["gnews"]` or `"providers":
["mock-wire"]`), and `GET /news/providers/health` always reports GNews's
status (including a clear "not configured" message) even while it's
inactive.

**Setup.** Get a free API key from [gnews.io](https://gnews.io), then:
```bash
# backend/.env
GNEWS_API_KEY=your_real_key_here
```
Never commit a real key — `backend/.env.example` only ever contains the
placeholder `replace_with_your_gnews_key`, and `.env` files are
git-ignored. If you're using Docker Compose, set `GNEWS_API_KEY` in the
root `.env` instead; `docker-compose.yml` passes it through to the
backend container only (never to the frontend container or the browser).

**Security.** The API key is read server-side only, via
`ConfigService.get('GNEWS_API_KEY')` inside `GNewsProvider`. It is never
logged, never included in any HTTP response (including error messages
and the health endpoint), and never referenced from `frontend/` — the
frontend only ever talks to the GlobalNews AI backend, never to GNews
directly.

**Error handling.** `GNewsProvider` converts GNews-specific failures
(missing/invalid key, timeout, rate limiting, malformed responses) into
a controlled `GNewsProviderError` rather than letting them crash a
request. Combined with `NewsService`'s existing per-provider failure
isolation (Sprint 3), a GNews outage degrades to an empty/error result
for that request rather than crashing the backend or silently swapping
in mock data.

## AI Analysis Module (Sprint 5.1)

The backend can turn a set of search results into a structured,
evidence-grounded analysis at `backend/src/modules/analysis/`. Like the
news module, it's provider-agnostic: `OpenAiAnalysisProvider` (real) and
`MockAnalysisProvider` (demo) both implement the same `AnalysisProvider`
interface, and exactly one is active at a time based on whether
`OPENAI_API_KEY` is configured.

**Endpoint:** `POST /analysis/news` with `{ "query": "..." }`.

**Flow:** search the news module \u2192 cluster obvious duplicates/syndicated
copies \u2192 send a bounded, truncated article set to the AI provider \u2192
validate the model's JSON output (dropping any claim that cites an
article ID we didn't actually send it) \u2192 cache briefly in memory \u2192
return `{ analysis, articles, analysisError? }`.

**Grounding:** every key fact, agreement, difference, and timeline event
must cite real article IDs or it's dropped before the response ever
leaves the backend. `sources` is always built from the real input
articles, never from the model, so a fabricated publisher or URL is
structurally impossible.

**Cost/safety controls** (all in `backend/.env.example`):
`ANALYSIS_MAX_ARTICLES`, `ANALYSIS_MAX_ARTICLE_CHARS`,
`ANALYSIS_TIMEOUT_MS`, `ANALYSIS_CACHE_TTL_SECONDS`.

**Frontend:** submitting the homepage search now navigates to
`/search?q=...`, a dedicated results page showing the AI summary, key
facts, agreements/differences, an unknowns list, a timeline, confidence,
entity chips, and the original article cards side by side with the
analysis \u2014 never hidden underneath it. A `LIVE AI ANALYSIS` or
`DEMO AI ANALYSIS` badge always makes the mode clear.

## World News Map (Sprint 5.2)

An interactive world map at `/map` (also linked from the nav as "World
Map") lets you explore current coverage by country: search by name or
click a country, see its live headlines with a `LIVE`/`DEMO MODE` label
identical to the rest of the site, filter by category, and jump to full
coverage at `/search?q=<country name>`.

- **Map library:** [MapLibre GL JS](https://maplibre.org/) — open-source,
  no API key or paid token required. Dynamically imported client-side
  only (`ssr: false`) to avoid Next.js server-side rendering errors.
- **Geographic data:** Natural Earth Admin-0 countries (public domain),
  via the [`world-atlas`](https://www.npmjs.com/package/world-atlas) npm
  package — resolved locally after `npm install`, no runtime fetch to a
  third-party URL. Full source/license/disputed-boundary disclaimer:
  [`docs/map-data-sources.md`](docs/map-data-sources.md).
- **Backend:** `GET /news/country/:countryCode` (optional `category`,
  `limit`) reuses the existing provider-agnostic `NewsService` — it has
  no idea whether GNews or Mock is active, same as every other endpoint.
- **Story counts:** never computed for every country up front. Counts
  are only known for countries you've actually selected this session,
  cached briefly server-side and client-side, per Sprint 5.2's cost
  controls.
- **Mobile:** the map itself is hidden below the `lg` breakpoint; country
  search and the selection panel remain fully functional without it.

Local testing:
```bash
npm install
npm run build:shared
npm run dev:backend
npm run dev:frontend
```
Visit `http://localhost:3000/map`, search "Spain", select it, open a
source link, click "View full country coverage", and try the category
filters.

## Contributing


See `.github/PULL_REQUEST_TEMPLATE.md` for the expected PR checklist. All
code must pass lint, build, and test checks defined in
`.github/workflows/ci.yml` before merging.

## License

Proprietary — all rights reserved.
