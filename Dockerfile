# syntax=docker/dockerfile:1

# Development image for the Vite dev server. Production serving (build + express
# server.js) is intentionally not handled here.
#
# Run via: docker compose -f docker-compose.local.yml up

ARG NODE_VERSION=24
FROM node:${NODE_VERSION}-slim

WORKDIR /app

# Install dependencies first so this layer is cached unless the lockfile changes.
# node_modules is built here, inside the image, and lives in a named volume at
# runtime (see docker-compose.local.yml) so the host bind mount never clobbers it.
COPY package.json package-lock.json ./
RUN npm ci

# App code is bind-mounted in dev; copy it too so the image is usable standalone.
COPY . .

EXPOSE 5175

# --host 0.0.0.0 makes the dev server reachable from outside the container.
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
