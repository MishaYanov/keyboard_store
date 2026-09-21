FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY client/package.json ./client/
COPY server/package.json ./server/
COPY shared/package.json ./shared/
COPY tests/package.json ./tests/
RUN npm ci
COPY shared ./shared
COPY client ./client
COPY server ./server
RUN npm run build && npm run api:build

FROM build AS runtime-dependencies
RUN npm ci --omit=dev --workspace @keycaps/server && node -e "require.resolve('zod')"

FROM node:24-bookworm-slim AS api
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/server/package.json ./package.json
COPY --from=build /app/server/dist ./dist
COPY --from=runtime-dependencies /app/node_modules ./node_modules
RUN mkdir /data && chown node:node /data && chmod 0700 /data
USER node
EXPOSE 3001
CMD ["node", "dist/start.js"]

FROM caddy:2-alpine AS web
COPY docker/Caddyfile /etc/caddy/Caddyfile
COPY docker/web-entrypoint.sh /usr/local/bin/keycaps-web-entrypoint.sh
RUN sed -i 's/\r$//' /usr/local/bin/keycaps-web-entrypoint.sh
COPY --from=build /app/client/dist /srv
EXPOSE 80 443
CMD ["sh", "/usr/local/bin/keycaps-web-entrypoint.sh"]
