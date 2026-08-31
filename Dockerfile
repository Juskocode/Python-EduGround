FROM node:26.8.1-alpine3.23@sha256:871eb674ad6e692c91330a8959f1ce2f80ba3f445cdc54e306869d2ea265e42d AS server-build

WORKDIR /app

ENV NPM_CONFIG_AUDIT=false
ENV NPM_CONFIG_FUND=false
ENV NPM_CONFIG_UPDATE_NOTIFIER=false

COPY package.json package-lock.json tsconfig.server.json ./
RUN npm ci --ignore-scripts --no-audit --no-fund

COPY src ./src
RUN npm run build:server

FROM node:26.8.1-alpine3.23@sha256:871eb674ad6e692c91330a8959f1ce2f80ba3f445cdc54e306869d2ea265e42d AS production-dependencies

WORKDIR /app

ENV NPM_CONFIG_AUDIT=false
ENV NPM_CONFIG_FUND=false
ENV NPM_CONFIG_UPDATE_NOTIFIER=false

COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts --omit=dev --no-audit --no-fund \
  && npm cache clean --force

FROM node:26.8.1-alpine3.23@sha256:871eb674ad6e692c91330a8959f1ce2f80ba3f445cdc54e306869d2ea265e42d

ARG BUILD_DATE=""
ARG VCS_REF=""
ARG VERSION="development"

LABEL org.opencontainers.image.title="Python EduGround" \
      org.opencontainers.image.description="Interactive, solution-free Python learning playground" \
      org.opencontainers.image.created="${BUILD_DATE}" \
      org.opencontainers.image.revision="${VCS_REF}" \
      org.opencontainers.image.version="${VERSION}" \
      org.opencontainers.image.source="https://github.com/Juskocode/Python-EduGround"

WORKDIR /app

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=8000

COPY --from=production-dependencies --chown=node:node /app/node_modules ./node_modules
COPY --from=server-build --chown=node:node /app/dist ./dist
COPY --chown=node:node package.json package-lock.json ./
COPY --chown=node:node public ./public
COPY --chown=node:node database/migrations ./database/migrations
COPY --chown=node:node scripts/database/migrate.js ./scripts/database/migrate.js

RUN mkdir -p /app/submissions \
  && chown node:node /app/submissions \
  && chmod 700 /app/submissions

USER node
EXPOSE 8000
STOPSIGNAL SIGTERM

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:8000/healthz').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["node", "dist/server/main.js", "--host", "0.0.0.0"]
