# syntax=docker/dockerfile:1.7
ARG REPO_DIR=continuum

FROM node:22.12-bookworm-slim AS deps
ARG REPO_DIR
WORKDIR /repo
RUN npm install -g corepack@latest \
  && corepack enable \
  && corepack prepare pnpm@10.33.2 --activate
COPY ${REPO_DIR}/pnpm-lock.yaml ${REPO_DIR}/pnpm-workspace.yaml ${REPO_DIR}/package.json ${REPO_DIR}/turbo.json ./
COPY ${REPO_DIR}/packages packages
COPY ${REPO_DIR}/apps apps
RUN pnpm install --frozen-lockfile

FROM deps AS build
ARG REPO_DIR
WORKDIR /repo
COPY PLOT.md /canonical/PLOT.md
RUN ORCHESTRATOR_PLOT_PATH=/canonical/PLOT.md pnpm --filter @continuum/api exec tsx scripts/sync-plot.ts
RUN ORCHESTRATOR_PLOT_PATH=/canonical/PLOT.md pnpm --filter @continuum/api build
RUN pnpm --filter @continuum/api exec tsc scripts/seed-orchestrator-state.ts \
  --outDir dist/scripts \
  --module nodenext --moduleResolution nodenext --target es2022 --esModuleInterop \
  --skipLibCheck
RUN pnpm --filter @continuum/api deploy --legacy --prod /deploy

FROM node:22.12-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production PORT=7776 ORCHESTRATOR_DB_PATH=/data/orchestrator.db
RUN mkdir -p /data && chown -R node:node /data
USER node
COPY --from=build --chown=node:node /deploy /app
EXPOSE 7776
VOLUME ["/data"]
CMD ["node", "dist/main.js"]
