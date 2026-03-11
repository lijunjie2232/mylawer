# ============================================
# Law Assistant Application Dockerfile
# 两步构建：前端构建 + 后端生产环境
# 不包含 PostgreSQL，需要外部数据库服务
# ============================================

# ============================================
# Step 1: Build Frontend
# ============================================
FROM node:24-alpine AS frontend-builder

WORKDIR /app/frontend

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy frontend package files
COPY frontend/package.json frontend/pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy frontend source
COPY frontend/ ./

# Build frontend
RUN pnpm build

# ============================================
# Step 2: Build Backend and Create Production Image
# ============================================
FROM debian:bookworm-slim

# Set environment variables
ENV NODE_ENV=production
ENV DEBIAN_FRONTEND=noninteractive

# Install system dependencies
RUN apt-get update && apt-get install -y \
    # Node.js prerequisites
    curl \
    gnupg \
    ca-certificates \
    # PostgreSQL client libraries for database migrations
    postgresql-client\
    # Playwright browser dependencies
    libnss3 \
    libnspr4 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libdbus-1-3 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    libpango-1.0-0 \
    libcairo2 \
    # XVFB for headless browser automation
    xvfb \
    # Cleanup apt cache to reduce image size
    && rm -rf /var/lib/apt/lists/* \
    && rm -rf /var/cache/apt/archives/* \
    && apt-get clean \
    && truncate -s 0 /var/log/*log 2>/dev/null || true

# Install Node.js 24.x
RUN curl -fsSL https://deb.nodesource.com/setup_24.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/* \
    && rm -rf /var/cache/apt/archives/* \
    && apt-get clean

# Install pnpm globally
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy backend package files
COPY package.json pnpm-lock.yaml ./

# Install backend dependencies (production + prisma + typescript)
RUN pnpm install --frozen-lockfile

# Install Playwright browsers and system dependencies
# Only install Chromium to save space
RUN pnpm exec playwright install-deps chromium && \
   pnpm exec playwright install chromium

# Copy backend source code and configuration
COPY src/ ./src/
COPY prisma/schema.prisma ./prisma/
COPY scripts/ ./scripts/
COPY tsconfig.json ./
COPY prisma.config.ts ./

# Generate Prisma client and build
RUN pnpm dlx prisma generate \
    && pnpm build

# Copy built frontend from builder stage
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Copy startup script
COPY docker-start.app.sh /docker-start.app.sh
RUN chmod +x /docker-start.app.sh

# Expose port
# 3000: Application server
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# Start the application
ENTRYPOINT ["/docker-start.app.sh"]
CMD ["node", "dist/index.js", "--server"]
