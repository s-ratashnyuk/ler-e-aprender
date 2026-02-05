# syntax=docker/dockerfile:1.6
FROM node:20-bookworm AS build
WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY client/package.json client/
COPY server/package.json server/

RUN corepack enable \
  && pnpm --dir client install \
  && pnpm --dir server install

COPY client client
COPY server server

RUN pnpm --dir client build \
  && pnpm --dir server build

FROM node:20-bookworm-slim AS runtime
WORKDIR /app

ENV NODE_ENV=production
ENV AUTH_DB_DIR=/data

RUN apt-get update \
  && apt-get install -y --no-install-recommends nginx ca-certificates bash python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

RUN rm -f /etc/nginx/conf.d/default.conf \
  && mkdir -p /var/www/app /data

COPY --from=build /app/server/node_modules /app/server/node_modules
COPY --from=build /app/server/dist /app/server/dist
COPY --from=build /app/client/dist /var/www/app

RUN npm rebuild --prefix /app/server better-sqlite3

RUN cat <<'NGINX_CONF' > /etc/nginx/conf.d/app.conf
server {
  listen 8080;
  server_name _;
  root /var/www/app;
  index index.html;

  access_log /dev/stdout;
  error_log /dev/stderr warn;

  location / {
    try_files $uri $uri/ /index.html;
  }

  location /api/ {
    proxy_pass http://127.0.0.1:8787;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
NGINX_CONF

RUN cat <<'ENTRYPOINT_SH' > /usr/local/bin/entrypoint.sh
#!/usr/bin/env bash
set -euo pipefail

node /app/server/dist/index.js &
node_pid=$!

nginx -g 'daemon off;' &
nginx_pid=$!

term_handler() {
  kill -TERM "$node_pid" "$nginx_pid" 2>/dev/null || true
  wait "$node_pid" "$nginx_pid" 2>/dev/null || true
}

trap term_handler INT TERM

wait -n "$node_pid" "$nginx_pid"
exit_code=$?
term_handler
exit "$exit_code"
ENTRYPOINT_SH

RUN chmod +x /usr/local/bin/entrypoint.sh

VOLUME ["/data"]
EXPOSE 8080

CMD ["/usr/local/bin/entrypoint.sh"]
