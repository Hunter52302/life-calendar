# syntax=docker/dockerfile:1
# ── Express API server (server/index.js) ──────────────────────────────────────
# Self-contained backend: pure-JS deps, talks to PocketBase over HTTP.
FROM node:22-alpine

ENV NODE_ENV=production
WORKDIR /app

# Install ONLY the root production dependencies. The server does not use the
# `shared`/`mobile` workspaces, so --no-workspaces keeps React Native/Expo and
# all devDependencies out of the image. --ignore-scripts is safe: every runtime
# dep is pure JavaScript (bcryptjs, jsonwebtoken, web-push, express, …).
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-workspaces --ignore-scripts && npm cache clean --force

# Application code (routes, lib, middleware, services).
COPY server ./server

EXPOSE 3001
CMD ["node", "server/index.js"]
