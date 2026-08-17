# NOTE: build context is the monorepo root (see docker-compose.yml).
#
#   docker build -f frontend/Dockerfile .

# ---- Base ----
FROM node:20-alpine AS base
WORKDIR /app

# ---- Dependencies ----
FROM base AS dependencies
COPY package*.json ./
COPY shared/package*.json ./shared/
COPY frontend/package*.json ./frontend/
RUN npm install

# ---- Build ----
FROM dependencies AS build
# Milestone B3 — NEXT_PUBLIC_API_URL is a Next.js public build-time
# variable: Next.js inlines it into the built JavaScript bundle when
# `next build` runs, not read at container runtime. Declared here,
# inside the `build` stage specifically, per Docker's ARG scoping
# rules — a global ARG declared before the first FROM is usable only
# in FROM lines themselves, not automatically inside any stage; each
# stage that needs it must re-declare it. This is public frontend
# configuration (the backend's base URL), never a secret, so ARG/ENV
# here is the correct, safe mechanism — unlike OAUTH_CLIENT_SECRET/
# OAUTH_FLOW_SECRET, which must never appear in a Docker build
# instruction and are instead passed only as backend container
# runtime environment variables (see docker-compose.yml).
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
COPY shared ./shared
COPY frontend ./frontend
RUN npm run build:shared
RUN npm run build --workspace=frontend

# ---- Production ----
FROM node:20-alpine AS production
WORKDIR /app/frontend
ENV NODE_ENV=production
COPY --from=build /app/frontend/next.config.mjs ./
COPY --from=build /app/frontend/public ./public
COPY --from=build /app/frontend/.next ./.next
COPY --from=build /app/frontend/package*.json ./
COPY --from=build /app/node_modules ../node_modules

EXPOSE 3000
CMD ["npx", "next", "start"]
