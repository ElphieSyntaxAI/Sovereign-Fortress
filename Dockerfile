# syntax=docker/dockerfile:1
#
# Elphie Syntax monorepo — production MSGF Core image (Next.js standalone + traced deps).
#
# Base: Debian slim (glibc) for native addons (@google-cloud/*, sharp, etc.).
# Stages: deps → builder → production (no root; only traced runtime + static assets).
#
# Build from repository root:
#   docker build \
#     --build-arg GIT_REVISION="$(git rev-parse HEAD)" \
#     --build-arg APP_IMAGE_VERSION="1.0.0" \
#     -t elphie-msgf:latest .
#
# Run (Cloud Run sets PORT):
#   docker run --rm -e PORT=8080 -p 8080:8080 elphie-msgf:latest

# =============================================================================
# Stage 1 — dependency install (full install required for workspace TypeScript build)
# =============================================================================
FROM node:20-bookworm-slim AS deps

WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1

# Native bindings during npm ci may invoke node-gyp / C++ toolchains; discarded after this stage.
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    ca-certificates \
    python3 \
    make \
    g++ \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./

# Workspace trees (manifests + sources). Build context is trimmed via root `.dockerignore`
# (no host node_modules/.next/dist; tests and common dev-only paths excluded).
COPY packages ./packages
COPY apps ./apps
COPY tools ./tools

RUN npm ci --no-audit --no-fund \
  && mkdir -p /app/packages/msgf/node_modules

# =============================================================================
# Stage 2 — compile SDK (`packages/msgf/dist`) + Next production bundle (`.next/*`)
# =============================================================================
FROM node:20-bookworm-slim AS builder

WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
# Next/msgf `prebuild` expects service-account.json locally; omit baking secrets into the image.
ENV MSGF_DOCKER_BUILD_SKIP_SA=1

# Same toolchain as deps — compile phase must not fail on optional native modules.
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    ca-certificates \
    python3 \
    make \
    g++ \
  && rm -rf /var/lib/apt/lists/*

COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json ./
COPY packages ./packages
COPY apps ./apps
COPY tools ./tools

# `npm ci` may install workspace-only deps under `packages/msgf/node_modules`. The context COPY above
# cannot include `**/node_modules` (see `.dockerignore`). Restore that tree from deps (classic Docker;
# no BuildKit mounts).
COPY --from=deps /app/packages/msgf/node_modules ./packages/msgf/node_modules

# MSGF: `build:sdk:prod` emits SDK under packages/msgf/dist; `next build` emits `.next/standalone`
# with traced production dependencies only (devDependencies stay outside this artifact tree).
# Parentheses: without them, `a && b || true` succeeds even when `a` (the build) fails.
RUN npm run build -w msgf \
  && (rm -rf /tmp/* /root/.npm 2>/dev/null || true)

# =============================================================================
# Stage 3 — production runtime: traced JS only (no sources, no devDependencies)
# =============================================================================
FROM node:20-bookworm-slim AS production

ARG GIT_REVISION=unknown
ARG APP_IMAGE_VERSION=0.0.0

WORKDIR /home/node/app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# Next standalone `server.js` binds with `hostname = process.env.HOSTNAME || '0.0.0.0'`.
# Cloud Run / Knative sets HOSTNAME to the pod name — not a bindable address — so we force 0.0.0.0 at exec time.

LABEL org.opencontainers.image.title="MSGF Core"
LABEL org.opencontainers.image.description="Elphie Syntax MSGF — Next.js standalone"
LABEL org.opencontainers.image.version="${APP_IMAGE_VERSION}"
LABEL org.opencontainers.image.revision="${GIT_REVISION}"
LABEL org.opencontainers.image.vendor="Elphie Syntax LLC"

# Slim runtime: only CA bundle — no python/make/g++ from build stages.
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Next standalone output (includes traced production node_modules / workspace copies).
# Static chunks live outside the standalone folder and must be copied explicitly.
COPY --from=builder --chown=node:node /app/packages/msgf/.next/standalone ./
COPY --from=builder --chown=node:node /app/packages/msgf/.next/static ./packages/msgf/.next/static

# Official Node.js image provides non-root user `node` (UID 1000).
USER node

EXPOSE 8080

# Cloud Run sets HOSTNAME to the pod id; Next standalone uses HOSTNAME for listen() — override when starting node.
CMD ["sh", "-c", "if [ -f server.js ]; then HOSTNAME=0.0.0.0 exec node server.js; elif [ -f packages/msgf/server.js ]; then HOSTNAME=0.0.0.0 exec node packages/msgf/server.js; else echo 'MSGF: server.js not found in standalone layout' >&2; find . -maxdepth 4 -name server.js -print; exit 1; fi"]
