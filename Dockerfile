FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --chown=node:node . .
RUN mkdir -p /app/submissions && chown node:node /app/submissions && chmod 700 /app/submissions

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=8000

USER node
EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:8000/healthz').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["npm", "run", "serve", "--", "--host", "0.0.0.0"]
