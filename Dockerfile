# ============================================================
# HandBrake Web - Docker build
# Supports: CPU encoding + NVIDIA NVENC GPU acceleration
# ============================================================

FROM ubuntu:24.04

ENV DEBIAN_FRONTEND=noninteractive
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Install Node.js 20
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    curl ca-certificates gnupg && \
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y --no-install-recommends nodejs && \
    rm -rf /var/lib/apt/lists/*

# Install build tools for native modules (better-sqlite3)
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    python3 make g++ && \
    rm -rf /var/lib/apt/lists/*

# Install HandBrakeCLI + ffmpeg (ffprobe for media analysis)
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    software-properties-common && \
    add-apt-repository -y ppa:stebbins/handbrake-releases && \
    apt-get update && \
    apt-get install -y --no-install-recommends \
    handbrake-cli ffmpeg && \
    apt-get purge -y software-properties-common && \
    apt-get autoremove -y && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install dependencies (including dev for build)
COPY package.json package-lock.json* ./
RUN npm ci

# Copy source and build
COPY . .
RUN npm run build

# Remove dev dependencies after build
RUN npm prune --omit=dev

# Clean up build tools to reduce image size
RUN apt-get purge -y python3 make g++ && \
    apt-get autoremove -y && \
    rm -rf /var/lib/apt/lists/* /tmp/* /root/.npm

# Create non-root user
RUN groupadd --system --gid 1001 nodejs && \
    useradd --system --uid 1001 --gid nodejs nextjs

# Create directories
RUN mkdir -p /app/data /input /output && \
    chown -R nextjs:nodejs /app/data /input /output /app/.next

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/api/system || exit 1

CMD ["npx", "next", "start", "-H", "0.0.0.0"]
