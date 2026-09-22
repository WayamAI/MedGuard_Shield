# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# Drishti frontend — production image
#
# Two stages: build the static bundle with Node, serve it with nginx. The
# runtime image carries no Node, no node_modules and no source — just the
# compiled assets and a web server.
#
# VITE_API_BASE_URL is a BUILD-TIME variable. Vite inlines import.meta.env at
# build, so it cannot be changed by setting an environment variable on the
# running container — a different API host needs a different build. This is a
# property of Vite, not a decision made here; see the deployment notes in
# README-DEPLOY.md for the runtime-config alternative if you need one image
# per environment.
# ---------------------------------------------------------------------------

FROM node:20-alpine AS build
WORKDIR /app

# Dependencies first, so a source-only change does not reinstall them.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Baked into the bundle. Override at build time:
#   docker build --build-arg VITE_API_BASE_URL=https://api.example.com .
ARG VITE_API_BASE_URL=http://localhost:4000
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

RUN npm run build


FROM nginx:1.27-alpine AS runtime

# SPA routing: every unmatched path must return index.html, or a reload on
# /assets or /risks 404s instead of reaching the client router.
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

# nginx:alpine already runs the master as root and workers as nginx; the
# image listens on 8080 so it can run unprivileged if the platform requires.
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:8080/healthz || exit 1

CMD ["nginx", "-g", "daemon off;"]
