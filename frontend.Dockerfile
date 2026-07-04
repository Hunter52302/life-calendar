# syntax=docker/dockerfile:1
# ── Web frontend (Vite build → nginx static) ──────────────────────────────────
# Serves the built SPA with PWA-correct cache headers. The whole point of this
# image (vs. a default static host) is the nginx config: the service worker and
# HTML shell are served no-cache so every deploy propagates immediately, while
# content-hashed /assets/* are cached forever. Without this, a CDN/browser keeps
# a stale sw.js and the app freezes on an old bundle (old __APP_VERSION__).
#
# Coolify: set this as the frontend resource's Dockerfile, build context = repo
# root, and expose port 80. VITE_API_URL must be available at BUILD time.

# ---- Build stage ----
FROM node:22-alpine AS build
WORKDIR /app

# Vite inlines the API base URL at build time. Coolify passes it as a build arg;
# default keeps a working value if the arg is ever missing.
ARG VITE_API_URL=https://calapi.zrieger.xyz/api
ENV VITE_API_URL=$VITE_API_URL

# Root deps + devDeps only. The web app doesn't use the shared/mobile
# workspaces, so --no-workspaces skips the heavy Expo/React Native install.
# (Install scripts run so esbuild can fetch its platform binary for Vite.)
COPY package.json package-lock.json ./
RUN npm ci --no-workspaces

# App source (.dockerignore keeps node_modules, dist, mobile, .env* out).
COPY . .
RUN npm run build

# ---- Serve stage ----
FROM nginx:alpine AS serve
COPY --from=build /app/dist /usr/share/nginx/html
COPY deploy/frontend.nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
