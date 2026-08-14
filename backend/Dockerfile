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

EXPOSE 4000
CMD ["node", "backend/dist/main"]
