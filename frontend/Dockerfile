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
# RC-E2 / C-1 - `npm ci`, not `npm install`. See backend/Dockerfile for the
# full reasoning; the short version is that CI installs from the lockfile and
# this image did not, so the image was never provably the tree CI tested.
# Verified against this stage's exact partial workspace COPY set.
RUN npm ci

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
ARG SERVER_INTERNAL_API_URL
ENV SERVER_INTERNAL_API_URL=$SERVER_INTERNAL_API_URL
# MAIN-CONVERGED-ALPHA-POST-AUTH-1-R3 — THE SPATIAL SHELL FLAG IS READ AT
# BUILD TIME. `mapShellFlag.ts` reads `process.env.NEXT_PUBLIC_MAP_SHELL`
# through the literal so Next can inline it, which means the value must be
# present during `npm run build --workspace=frontend` or the bundle is built
# with it unset. An unset value is inlined by Next as the EMPTY STRING, which
# `resolveMapShellVariant` treats as OFF — so the default remains the accepted
# legacy World Map, and forgetting the build arg can never ship the shell.
#
# DELIBERATELY NOT HARD-PINNED TO true. The deployment environment decides:
# alpha may pass --build-arg NEXT_PUBLIC_MAP_SHELL=true; production passes
# nothing and gets the legacy map from the SAME SOURCE BYTES.
ARG NEXT_PUBLIC_MAP_SHELL
ENV NEXT_PUBLIC_MAP_SHELL=$NEXT_PUBLIC_MAP_SHELL
COPY shared ./shared
COPY frontend ./frontend
# C907 R2 — THE BUILD GATES LIVE IN scripts/, SO scripts/ MUST BE IN THE IMAGE.
# `npm run build --workspace=frontend` runs the Spatial token and structure
# gates from `../scripts/` before `next build`. Without this COPY the build
# stage fails with "Cannot find module /app/scripts/verify-spatial-tokens.mjs"
# — which is exactly how Railway frontend deployment 34cf76f9 failed. The gates
# are source-truth checks over frontend/src and frontend/tailwind.config.ts;
# they need no browser, no network and no golden PNG, so they belong here.
#
# The golden-authority gate deliberately does NOT run here. It verifies the
# approved V1/V2 capture binaries, which live OUTSIDE the repository (see
# docs/spatial-visual-gate.md, Part B) and are never copied into an application
# image. It runs in release/CI validation instead, via
# `npm run verify:visual-authority`. It was not weakened and was not dropped —
# scripts/verify-spatial-structure.mjs section 10 fails the build if that
# release wiring is ever removed.
COPY scripts ./scripts
RUN npm run build:shared
# ALPHA-FRONTEND-BUILD-RETRY-R1 — next/font/google resolves font CSS and
# font binaries during next build. Railway has twice failed here with the
# same transient loader/network error while this exact source passed CI on
# a clean rerun. A bounded retry keeps the ACCEPTED typography unchanged:
# no font family, weight, CSS variable, runtime fallback or UI code changes.
#
# This does NOT turn a bad build green. Any deterministic compile/test/gate
# failure is retried from a clean .next directory and still exits non-zero
# after the third attempt. Spatial token/structure gates remain inside the
# same npm build command on every attempt.
RUN set -eu; \
    attempt=1; \
    while true; do \
      if npm run build --workspace=frontend; then \
        break; \
      fi; \
      if [ "$attempt" -ge 3 ]; then \
        echo "Frontend build failed after $attempt attempts"; \
        exit 1; \
      fi; \
      echo "Frontend build attempt $attempt failed; retrying from a clean .next directory"; \
      rm -rf frontend/.next; \
      attempt=$((attempt + 1)); \
      sleep 2; \
    done

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
