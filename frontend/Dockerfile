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
