# Dockerfile for production environment
FROM node:24.13.0-bookworm-slim AS base
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

# Dependencies stage
FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod=false

# Build stage
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm prisma generate
RUN pnpm build

# Production dependencies
FROM base AS prod-deps
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod

# Runner stage
FROM node:24.13.0-bookworm-slim AS runner
ENV NODE_ENV=production
WORKDIR /app

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nestjs

# Copy only necessary files
COPY --from=build --chown=nestjs:nodejs /app/dist ./dist
COPY --from=prod-deps --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=build --chown=nestjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build --chown=nestjs:nodejs /app/package.json ./

USER nestjs

EXPOSE 3000

CMD ["node", "dist/main.js"]
