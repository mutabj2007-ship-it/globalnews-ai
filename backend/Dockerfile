# NOTE: build context is the monorepo root (see docker-compose.yml),
# because this workspace depends on the local `shared` package.
#
#   docker build -f backend/Dockerfile .

# ---- Base ----
FROM node:20-alpine AS base
WORKDIR /app

# ---- Dependencies ----
FROM base AS dependencies
COPY package*.json ./
COPY shared/package*.json ./shared/
COPY backend/package*.json ./backend/
# RC-E2 / C-1 - `npm ci`, not `npm install`.
#
# CI installs with `npm ci` (.github/workflows/ci.yml) while this image
# installed with `npm install`, which may resolve versions package-lock.json
# does not pin and may rewrite the lockfile. Two builds of the same commit
# could therefore produce different images, and neither necessarily matched
# the tree CI tested - so "CI is green" did not imply "the image is sound".
#
# Verified before changing it: this stage copies only the root, shared and
# backend package.json files, and `npm ci` resolves the root lockfile against
# that partial workspace set without complaint.
RUN npm ci

# ---- Build ----
FROM dependencies AS build
COPY shared ./shared
COPY backend ./backend
# The production packaging gate. `npm run build --workspace=backend` now runs
# `nest build` AND `scripts/verify-geo-packaging.mjs`, so this directory must be
# in the build stage or the build fails for the wrong reason.
#
# THIS IS THE FOURTH TIME THIS FILE HAS LEARNED THE SAME LESSON. Milestone #54
# added an explicit COPY because the Prisma schema and migrations were not in
# `dist`; the gazetteer, the NISR authority and both Rwanda boundary files were
# not in `dist` for exactly the same reason and took `/geo/search` and
# `/geo/map-feed` down on Alpha. The difference this time is that the omission
# can no longer be silent: the gate below fails the build rather than letting a
# green compile ship an image with no geography in it.
COPY scripts ./scripts
# Milestone #54 — mirrors the CI workflow's own proven sequence
# (.github/workflows/ci.yml: "Generate Prisma Client" runs before any
# build step) exactly: generates the Prisma client from the tracked
# schema/config fresh at build time, so the image can never ship a
# stale or missing client regardless of what happens to be committed
# under backend/src/generated. Same command, same working directory
# (repo root / WORKDIR /app) as CI uses. Does not touch schema.prisma,
# migrations, or prisma.config.ts — reads them as-is.
RUN npx prisma generate --config backend/prisma.config.ts
RUN npm run build:shared
RUN npm run build --workspace=backend
# OPS ONE-SHOT ONLY: compile the already-reviewed NISR manual proof to plain Node JS.
# This branch is never a release authority; the proof remains outside backend/dist.
RUN npx tsc -p backend/tooling/nisr-rehearsal/tsconfig.proof.json

# ---- Production ----
FROM node:20-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
COPY shared/package*.json ./shared/
COPY backend/package*.json ./backend/
# RC-E2 / C-1 - deterministic, production-only install. Verified to keep the
# Prisma CLI and its engines, which the CMD below depends on: `prisma` is a
# runtime dependency of the backend workspace, not a devDependency, so
# `migrate deploy` at container start needs no network.
RUN npm ci --omit=dev
COPY --from=build /app/shared/dist ./shared/dist
COPY --from=build /app/backend/dist ./backend/dist
# OPS ONE-SHOT ONLY: make the compiled manual proof available to the pre-deploy container.
COPY --from=build /app/backend/.proof-dist ./backend/.proof-dist
# Milestone #54 (final runtime correction) — the compiled dist/ output
# above does NOT include the Prisma schema/migrations/config, so a
# fresh database was never actually receiving the tracked migrations
# in a real deployment: `docker compose down -v && up --build` left
# `public` with zero tables even though the migrations themselves were
# correct and complete. Copying these two paths lets the production
# image run `prisma migrate deploy` against its own tracked migration
# history at container start — the same three existing migrations,
# unmodified, not `db push`, not a manually-authored schema sync.
COPY backend/prisma ./backend/prisma
COPY backend/prisma.config.ts ./backend/prisma.config.ts

EXPOSE 4000
# Milestone #54 (final runtime correction) — `&&` is deliberate: if
# `prisma migrate deploy` fails (unreachable database, a migration
# that can't apply, etc.), `node backend/dist/main` never runs. The
# container exits non-zero and never reaches a running state, so the
# healthcheck never gets a chance to report healthy — a failed
# migration is a visibly failed deployment, never a silently
# schema-mismatched one serving traffic anyway. Concurrent/multiple
# container starts against the same DATABASE_URL are safe without any
# extra coordination here: `prisma migrate deploy` itself takes a
# database-level advisory lock, so simultaneous starts serialize
# automatically rather than racing to apply the same migration twice.
CMD ["sh", "-c", "npx prisma migrate deploy --config backend/prisma.config.ts && node backend/dist/main"]
