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
RUN pnpm --filter @continuum/api build
RUN pnpm --filter @continuum/api deploy --legacy --prod /deploy

FROM deps AS web-build
WORKDIR /repo
ENV PUBLIC_API_BASE_URL=""
RUN pnpm --filter @continuum/web build

FROM node:22.12-bookworm-slim AS model-fetch
WORKDIR /tmp/fetch
RUN npm install --no-save @huggingface/transformers@4.2.0 \
  && node -e "(async () => { const m = await import('@huggingface/transformers'); m.env.cacheDir = '/cache/'; await m.pipeline('feature-extraction', 'Snowflake/snowflake-arctic-embed-m-v1.5', { dtype: 'q8' }); console.log('cached'); })().catch((e) => { console.error(e); process.exit(1); })" \
  && ls /cache

FROM node:22.12-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    PORT=7776 \
    ORCHESTRATOR_DB_PATH=/data/orchestrator.db \
    TRANSFORMERS_CACHE=/app/.cache/huggingface \
    HF_HUB_CACHE=/app/.cache/huggingface \
    PANEL_STATIC_ROOT=/app/panel \
    PANEL_REST_ENABLED=true
RUN mkdir -p /data && chown -R node:node /data
USER node
COPY --from=build --chown=node:node /deploy /app
COPY --from=web-build --chown=node:node /repo/apps/web/dist /app/panel
COPY --from=model-fetch --chown=node:node /cache /app/.cache/huggingface
EXPOSE 7776
VOLUME ["/data"]
CMD ["node", "dist/main.js"]
