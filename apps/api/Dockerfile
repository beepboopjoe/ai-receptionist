# ---- Base ----
FROM node:20-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate
RUN apk add --no-cache libc6-compat

# ---- Build ----
# Install all workspace deps so tsup can resolve @ai-receptionist/shared
FROM base AS builder
WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/api/package.json ./apps/api/
COPY packages/shared/package.json ./packages/shared/
COPY packages/config/ ./packages/config/
RUN pnpm install --frozen-lockfile

COPY packages/shared/ ./packages/shared/
COPY apps/api/ ./apps/api/

# tsup bundles @ai-receptionist/shared into dist — no workspace symlinks at runtime
RUN pnpm --filter @ai-receptionist/api build

# Migration SQL files must sit alongside dist/migrate.js at dist/migrations/
RUN cp -r apps/api/src/db/migrations apps/api/dist/

# ---- Runner ----
FROM node:20-alpine AS runner
WORKDIR /app
RUN addgroup -g 1001 -S nodejs && adduser -S api -u 1001 -G nodejs

# Copy compiled output
COPY --from=builder --chown=api:nodejs /app/apps/api/dist ./dist

# Install only production npm deps (strip workspace dep — it's bundled by tsup)
COPY --from=builder --chown=api:nodejs /app/apps/api/package.json ./package.json
RUN node -e " \
  const p = JSON.parse(require('fs').readFileSync('package.json', 'utf8')); \
  delete p.dependencies['@ai-receptionist/shared']; \
  delete p.devDependencies; \
  p.scripts = {}; \
  require('fs').writeFileSync('package.json', JSON.stringify(p, null, 2)); \
"
RUN npm install --omit=dev --ignore-scripts

USER api
ENV NODE_ENV=production
EXPOSE 3001

# Run migrations then start the server
CMD ["sh", "-c", "node dist/migrate.js && node dist/main.js"]
