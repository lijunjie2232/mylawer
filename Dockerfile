# ============================================================
# Dockerfile for mylawer private server
# ============================================================
# Stage 1: Builder
# ============================================================
FROM node:24.15.0-bookworm-slim AS builder

# Install system deps + pnpm BEFORE CACHEBUST so they stay cached
RUN apt-get update \
    && apt-get upgrade -y \
    && apt-get install -y --no-install-recommends \
        git \
        ca-certificates \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

RUN npm install -g pnpm

# git config BEFORE clone so submodules work
RUN git config --global url."https://github.com/".insteadOf "git@github.com:"

# Cache bust only invalidates from here downwards
ARG CACHEBUST=-1
RUN echo "Building for commit: $CACHEBUST"

RUN git clone https://github.com/lijunjie2232/mylawer.git /app \
    && cd /app \
    && git submodule update --init --recursive

# --- Build frontend ---
WORKDIR /app/frontend
RUN pnpm install --frozen-lockfile \
    && pnpm build \
    && pnpm store prune

# --- Build legal-mcp ---
WORKDIR /app/third/legal-mcp/js_legal
RUN pnpm install --frozen-lockfile \
    && pnpm build \
    && pnpm store prune

# --- Build webmcp ---
WORKDIR /app/third/webmcp
RUN pnpm install --frozen-lockfile \
    && pnpm binary:sync \
    && pnpm store prune

# --- Build main app ---
WORKDIR /app
RUN pnpm install --frozen-lockfile \
    && pnpm db:generate \
    && pnpm build \
    && pnpm store prune

# Strip devDependencies
RUN pnpm prune

# ============================================================
# Stage 2: Runtime
# ============================================================
FROM node:24.15.0-bookworm-slim AS runner

RUN apt-get update \
    && apt-get install -y \
        libatomic1 \
        openssl \
        libnss3 \
        libnspr4 \
        libatk1.0-0 \
        libatk-bridge2.0-0 \
        libcups2 \
        libdrm2 \
        libxkbcommon0 \
        libxcomposite1 \
        libxdamage1 \
        libxfixes3 \
        libxrandr2 \
        libgbm1 \
        libasound2 \
        libpango-1.0-0 \
        libcairo2 \
        libatspi2.0-0 \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

RUN npm install -g pnpm && npx playwright install-deps chromium

WORKDIR /app

# Copy only built artifacts — no source, no dev deps, no git history
COPY --from=builder /app/dist               ./dist
COPY --from=builder /app/node_modules       ./node_modules
COPY --from=builder /app/package.json       ./package.json
COPY --from=builder /app/prisma             ./prisma
COPY --from=builder /app/frontend/dist      ./frontend/dist
COPY --from=builder /app/third              ./third
COPY --from=builder /app/prisma.config.ts   ./prisma.config.ts

EXPOSE 3000
