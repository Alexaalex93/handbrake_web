# ============================================================
# HandBrake Web - Docker build (multi-stage)
# Supports: CPU encoding + NVIDIA NVENC GPU acceleration
# ============================================================

# --- Stage 1: Build ---
FROM ubuntu:24.04 AS builder

ENV DEBIAN_FRONTEND=noninteractive
ENV NEXT_TELEMETRY_DISABLED=1

# Install Node.js 20 + build tools
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    curl ca-certificates gnupg python3 make g++ && \
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y --no-install-recommends nodejs && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json* ./
RUN npm ci

# Copy source and build (standalone output)
COPY . .
RUN npm run build

# --- Stage 2: Runtime ---
FROM ubuntu:24.04

ENV DEBIAN_FRONTEND=noninteractive
ENV NEXT_TELEMETRY_DISABLED=1

# Install Node.js 20 (runtime only) + HandBrakeCLI + ffmpeg
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    curl ca-certificates gnupg && \
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y --no-install-recommends \
    nodejs handbrake-cli ffmpeg && \
    rm -rf /var/lib/apt/lists/* /usr/lib/node_modules/npm /usr/bin/npx

WORKDIR /app

# Copy standalone build output from builder
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

ENV NODE_ENV=production

# Create non-root user
RUN groupadd --system --gid 1001 nodejs && \
    useradd --system --uid 1001 --gid nodejs nextjs

# Create directories
RUN mkdir -p /app/data /input /output && \
    chown -R nextjs:nodejs /app /input /output

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/api/system || exit 1

CMD ["node", "server.js"]
