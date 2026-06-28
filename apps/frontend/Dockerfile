# Build context is the repo root (see docker-compose*.yml: context: ., dockerfile:
# apps/frontend/Dockerfile) — this app depends on the @variedreach-vdr/shared
# workspace package, which only exists alongside the rest of the monorepo.
FROM node:20-alpine AS build
WORKDIR /app
COPY . .
RUN npm ci
RUN npm run build --workspace=apps/frontend

# Deliberately not using next.config.ts's `output: 'standalone'` here — it was
# tried and reverted. The standalone bundle omits .next/static (Next expects a
# reverse proxy or a manual copy step to serve it), and the one local copy
# step that existed only lived in this Dockerfile — running the standalone
# server.js directly outside Docker 404'd on every JS/CSS asset, which broke
# hydration on every page (blank /, stuck-loading /dashboard). `next start`
# against a full build has no such gap and behaves identically in Docker and
# on a bare VPS/laptop, which matters more here than the smaller image would
# have.
FROM node:20-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
COPY apps/backend/package.json ./apps/backend/package.json
COPY apps/frontend/package.json ./apps/frontend/package.json
COPY packages/shared/package.json ./packages/shared/package.json
RUN npm ci --omit=dev --ignore-scripts --workspace=apps/frontend
COPY --from=build /app/apps/frontend/.next ./apps/frontend/.next
COPY --from=build /app/apps/frontend/public ./apps/frontend/public

EXPOSE 3000
CMD ["npm", "run", "start", "--workspace=apps/frontend"]
