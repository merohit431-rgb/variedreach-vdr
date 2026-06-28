# Build context is the repo root (see docker-compose*.yml: context: ., dockerfile:
# apps/backend/Dockerfile) — this is an npm workspaces monorepo, so even though the
# backend never imports @variedreach-vdr/shared at runtime, npm needs the root
# lockfile and every workspace's package.json to install correctly.
FROM node:20-alpine AS build
WORKDIR /app
COPY . .
RUN npm ci
RUN npm run build --workspace=apps/backend

FROM node:20-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
COPY apps/backend/package.json ./apps/backend/package.json
COPY apps/frontend/package.json ./apps/frontend/package.json
COPY packages/shared/package.json ./packages/shared/package.json
RUN npm ci --omit=dev --ignore-scripts --workspace=apps/backend
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=build /app/apps/backend/dist ./apps/backend/dist
COPY --from=build /app/apps/backend/prisma ./apps/backend/prisma

EXPOSE 4000
CMD ["node", "apps/backend/dist/main.js"]
