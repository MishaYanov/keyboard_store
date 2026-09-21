FROM node:24-bookworm-slim AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
COPY client/package.json ./client/
COPY server/package.json ./server/
COPY shared/package.json ./shared/
COPY tests/package.json ./tests/
RUN npm ci

FROM dependencies AS client
COPY shared ./shared
COPY client ./client
WORKDIR /app/client
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--strictPort"]

FROM dependencies AS server
COPY shared ./shared
COPY server ./server
WORKDIR /app/server
EXPOSE 3001
CMD ["npm", "run", "dev"]

FROM dependencies AS unit
RUN node -e "require.resolve('zod')"
COPY shared ./shared
COPY client ./client
COPY server ./server
COPY tests ./tests
CMD ["npm", "test"]
