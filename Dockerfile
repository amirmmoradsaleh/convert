# Multi-stage Dockerfile for Convert24 Application
# Syntax: Dockerfile

# Stage 1: Base image with Node.js 22 LTS and system prerequisites
FROM node:22-bookworm-slim AS base
RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# Stage 2: Development & Build Dependencies (full npm ci + prisma generation)
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY prisma ./prisma
RUN npx prisma generate

# Stage 3: Production Dependencies only (prunes devDependencies without network calls)
FROM deps AS prod-deps
WORKDIR /app
RUN npm prune --omit=dev

# Stage 4: Builder stage (compiles Next.js application)
FROM deps AS builder
WORKDIR /app
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ENV DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/filetools_db?schema=public"
RUN npm run build

# Stage 5: Comprehensive Validation & Testing environment (Vitest, Lint, Build, Playwright)
FROM deps AS validator
WORKDIR /app
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
RUN npx playwright install --with-deps chromium \
    && rm -rf /var/lib/apt/lists/*
COPY . .
COPY --from=builder /app/.next ./.next
RUN npx prisma generate

# Stage 6: Production Runtime image (minimal footprint, non-root user)
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Enforce least privilege by running as non-root user
RUN groupadd --system --gid 1001 nodejs && \
    useradd --system --uid 1001 nextjs

# Copy compiled application assets and pruned production dependencies
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

RUN chown -R nextjs:nodejs /app
USER nextjs

EXPOSE 3000

CMD ["npm", "run", "start"]
