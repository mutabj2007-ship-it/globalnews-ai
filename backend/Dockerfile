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
RUN npm install

# ---- Build ----
FROM dependencies AS build
COPY shared ./shared
COPY backend ./backend
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

# ---- Production ----
FROM node:20-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
COPY shared/package*.json ./shared/
COPY backend/package*.json ./backend/
RUN npm install --omit=dev
COPY --from=build /app/shared/dist ./shared/dist
COPY --from=build /app/backend/dist ./backend/dist
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
