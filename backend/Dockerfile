# ── Stage 1: deps ──────────────────────────────────────────────────────────────
FROM node:20-alpine AS deps

WORKDIR /app

COPY package.json package-lock.json ./
COPY prisma ./prisma

RUN npm ci

RUN npx prisma generate

# ── Stage 2: builder ───────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/prisma ./prisma

COPY tsconfig.json ./
COPY src ./src

RUN npx tsc --project tsconfig.json

# ── Stage 3: runner ────────────────────────────────────────────────────────────
FROM node:20-alpine AS runner

# OpenSSL is required by the Prisma query engine on Alpine
RUN apk add --no-cache openssl

WORKDIR /app

COPY package.json package-lock.json ./
COPY prisma ./prisma

# Install prod deps and generate Prisma client while still root
# so the engine binaries can be written to node_modules
RUN npm ci --omit=dev && npx prisma generate

COPY --from=builder /app/dist ./dist

# Switch to non-root user only after all writes to node_modules are done
RUN addgroup -S appgroup && adduser -S appuser -G appgroup \
    && chown -R appuser:appgroup /app

USER appuser

ENV NODE_ENV=production
ENV PORT=4000
EXPOSE 4000

# prisma migrate deploy is idempotent — safe to run on every boot
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
