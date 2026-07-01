# Build context is the repo root (see docker-compose*.yml: context: ., dockerfile:
# apps/backend/Dockerfile) — this is an npm workspaces monorepo, so even though the
# backend never imports @variedreach-vdr/shared at runtime, npm needs the root
# lockfile and every workspace's package.json to install correctly.
FROM node:20-alpine AS build
WORKDIR /app
RUN apk add --no-cache openssl
COPY . .
RUN npm ci
RUN npm run build --workspace=apps/backend

FROM node:20-alpine AS production
WORKDIR /app
# su-exec: lightweight setuid helper for dropping privileges after volume chown
RUN apk add --no-cache openssl su-exec
ENV NODE_ENV=production

# Non-root service user — no home directory, no shell, no password
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

COPY package.json package-lock.json ./
COPY apps/backend/package.json ./apps/backend/package.json
COPY apps/frontend/package.json ./apps/frontend/package.json
COPY packages/shared/package.json ./packages/shared/package.json
RUN npm ci --omit=dev --ignore-scripts --workspace=apps/backend
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=build /app/apps/backend/dist ./apps/backend/dist
COPY --from=build /app/apps/backend/prisma ./apps/backend/prisma
COPY --from=build /app/apps/backend/tsconfig.json ./apps/backend/tsconfig.json

# Pre-create uploads dir so it exists when no volume is attached
RUN mkdir -p /app/uploads && chown appuser:appgroup /app/uploads

COPY apps/backend/docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

EXPOSE 4000

# Entrypoint chowns the volume-mounted /app/uploads then exec su-exec drops to appuser
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:4000/api/v1/health || exit 1

ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["node", "apps/backend/dist/main.js"]
