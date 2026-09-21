FROM mcr.microsoft.com/playwright:v1.63.0-noble
WORKDIR /app
COPY package.json package-lock.json ./
COPY client/package.json ./client/
COPY server/package.json ./server/
COPY shared/package.json ./shared/
COPY tests/package.json ./tests/
RUN npm ci --workspace @keycaps/tests
COPY tests/e2e ./tests/e2e
WORKDIR /app/tests
CMD ["npm", "run", "e2e"]
