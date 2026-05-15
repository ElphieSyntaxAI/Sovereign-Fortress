# syntax=docker/dockerfile:1
# Legacy path — prefer the **repository root** `Dockerfile` for Cloud Build and local builds.
#
# MSGF Core — Next.js standalone image for Google Cloud Run
#
# Build from the monorepo root (required for npm workspaces + @elphie-syntax/core):
#   docker build -f packages/msgf/Dockerfile \
#     --build-arg GIT_REVISION="$(git rev-parse HEAD)" \
#     --build-arg MSGF_IMAGE_VERSION="1.0.0" \
#     -t msgf-core:local .
#
# Cloud Run injects PORT; Next.js standalone honors process.env.PORT.
# See: https://cloud.google.com/run/docs/container-contract

# -----------------------------------------------------------------------------
# Stage: install dependencies (cached layer)
# -----------------------------------------------------------------------------
FROM node:20-slim AS deps

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./

# Workspace members required for a successful `npm ci` against the root lockfile
COPY packages ./packages
COPY apps ./apps

ENV NEXT_TELEMETRY_DISABLED=1

RUN npm ci --no-audit --no-fund

# -----------------------------------------------------------------------------
# Stage: compile SDK + Next.js (TypeScript via Next/tsc pipeline)
# -----------------------------------------------------------------------------
FROM node:20-slim AS builder

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json ./
COPY packages ./packages
COPY apps ./apps

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Production SDK + Next production bundle (outputs `.next/standalone` + traced deps)
RUN npm run build -w msgf

# -----------------------------------------------------------------------------
# Stage: runtime — only Next standalone trace (no sources, no devDependencies)
# -----------------------------------------------------------------------------
FROM node:20-slim AS runner

ARG GIT_REVISION=unknown
ARG MSGF_IMAGE_VERSION=0.0.0

WORKDIR /srv/msgf

LABEL org.opencontainers.image.title="MSGF Core"
LABEL org.opencontainers.image.description="MSGF Next.js API and Brain services for Google Cloud Run"
LABEL org.opencontainers.image.version="${MSGF_IMAGE_VERSION}"
LABEL org.opencontainers.image.revision="${GIT_REVISION}"
LABEL org.opencontainers.image.vendor="Elphie Syntax LLC"
LABEL com.google.cloud.run.service="msgf-core"

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# Cloud Run sets $PORT; bind on all interfaces
ENV HOSTNAME=0.0.0.0

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates \
  && rm -rf /var/lib/apt/lists/* \
  && groupadd --system --gid 65532 msgf \
  && useradd --system --uid 65532 --gid msgf --home-dir /srv/msgf --no-create-home --shell /usr/sbin/nologin msgf

# Standalone server + traced node_modules only
COPY --from=builder --chown=65532:65532 /app/packages/msgf/.next/standalone ./
# Static assets (not included inside standalone by default)
COPY --from=builder --chown=65532:65532 /app/packages/msgf/.next/static ./packages/msgf/.next/static

USER msgf

# Document the default Cloud Run port; the runtime still honors $PORT from the platform
EXPOSE 8080

# Next monorepo standalone may emit `server.js` at the tracing root or under `packages/msgf/`
CMD ["sh", "-c", "if [ -f server.js ]; then exec node server.js; elif [ -f packages/msgf/server.js ]; then exec node packages/msgf/server.js; else echo 'MSGF: server.js not found in standalone layout' >&2; find . -name server.js -print; exit 1; fi"]
