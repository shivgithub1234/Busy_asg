FROM node:20-alpine AS deps

WORKDIR /app

# Copy manifests first to leverage layer caching
COPY package.json package-lock.json ./
COPY prisma ./prisma

# Install ALL deps (dev needed for tsc / prisma generate)
RUN npm ci

# Generate the Prisma client
RUN npx prisma generate

FROM node:20-alpine AS builder

WORKDIR /app

# Bring in node_modules + generated Prisma client from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/prisma ./prisma

# Copy source
COPY tsconfig.json ./
COPY src ./src

# Compile TypeScript → dist/
RUN npx tsc --project tsconfig.json

FROM node:20-alpine AS runner

# Non-root user for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

# Only copy what's needed at runtime
COPY package.json package-lock.json ./
COPY prisma ./prisma

# Install production dependencies only
RUN npm ci --omit=dev && npx prisma generate

# Copy compiled output
COPY --from=builder /app/dist ./dist

# Render injects PORT automatically; default to 4000 for local runs
ENV NODE_ENV=production
ENV PORT=4000
EXPOSE 4000

USER appuser

# Run migrations then start the server.
# prisma migrate deploy is safe to run on every boot (idempotent).
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
