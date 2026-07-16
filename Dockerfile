FROM node:24.18.0-alpine3.23@sha256:595398b0081eacda8e1c4c5b97b76cd1020e4d58a8ebcb4843b9bca1e79e7436 AS production-dependencies

WORKDIR /app

ENV NPM_CONFIG_AUDIT=false
ENV NPM_CONFIG_FUND=false
ENV NPM_CONFIG_UPDATE_NOTIFIER=false

COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts --omit=dev --no-audit --no-fund \
  && npm cache clean --force

FROM node:24.18.0-alpine3.23@sha256:595398b0081eacda8e1c4c5b97b76cd1020e4d58a8ebcb4843b9bca1e79e7436

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
COPY --chown=node:node package.json package-lock.json ./
COPY --chown=node:node \
  assessment-data.js \
  assessment-engine.js \
  assessment-room.js \
  assessment-ui.css \
  audio-feedback.js \
  class-materials.js \
  class-page.css \
  class-page.js \
  concept-clinic.js \
  course-app.js \
  course-ui.css \
  dashboard-model.js \
  dashboard-ui.css \
  dashboard-view.js \
  exercise-data.js \
  favicon.svg \
  index.html \
  learning-clinic.css \
  learning-clinics.js \
  learning-content.js \
  learning-toolbox.js \
  python-runner-worker.mjs \
  rounding-lab.css \
  rounding-lab.js \
  rounding-model.js \
  starter-code.js \
  theme-bootstrap.js \
  ./
COPY --chown=node:node assets ./assets
COPY --chown=node:node test-data ./test-data
COPY --chown=node:node docs/screenshots ./docs/screenshots
COPY --chown=node:node db/migrations ./db/migrations
COPY --chown=node:node scripts/serve.mjs scripts/migrate.mjs ./scripts/
COPY --chown=node:node server/*.mjs ./server/

RUN mkdir -p /app/submissions \
  && chown node:node /app/submissions \
  && chmod 700 /app/submissions

USER node
EXPOSE 8000
STOPSIGNAL SIGTERM

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:8000/healthz').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["node", "scripts/serve.mjs", "--host", "0.0.0.0"]
