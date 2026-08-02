FROM node:24.18.0-bookworm-slim AS build

WORKDIR /app

RUN apt-get -y update \
  && apt-get install -y --no-install-recommends build-essential python3 \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json tsconfig.docker.json ./
COPY src ./src
RUN npm run compile:docker


FROM node:24.18.0-bookworm-slim AS production-deps

WORKDIR /app

RUN apt-get -y update \
  && apt-get install -y --no-install-recommends build-essential python3 \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci --omit=dev


FROM node:24.18.0-bookworm-slim AS production

WORKDIR /app

ENV NODE_ENV=production

COPY package.json ./
COPY --from=build /app/dist-docker ./dist
COPY --from=production-deps /app/node_modules ./node_modules

RUN mkdir -p /app/db && chown node:node /app/db

USER node

CMD [ "node", "dist/main.js" ]