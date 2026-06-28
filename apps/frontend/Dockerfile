# Build context is the repo root (see docker-compose*.yml: context: ., dockerfile:
# apps/frontend/Dockerfile) — this app depends on the @variedreach-vdr/shared
# workspace package, which only exists alongside the rest of the monorepo.
FROM node:20-alpine AS build
WORKDIR /app
COPY . .
RUN npm ci
RUN npm run build --workspace=apps/frontend

# next.config.ts sets output: 'standalone'. Inside an npm workspace, Next traces
# dependencies from the monorepo root, so the standalone bundle nests everything
# under apps/frontend/ rather than putting server.js at the top level.
FROM node:20-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/apps/frontend/public ./apps/frontend/public
COPY --from=build /app/apps/frontend/.next/standalone ./
COPY --from=build /app/apps/frontend/.next/static ./apps/frontend/.next/static

EXPOSE 3000
CMD ["node", "apps/frontend/server.js"]
