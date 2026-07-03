# syntax=docker/dockerfile:1
# ── PocketBase (database + auth) ──────────────────────────────────────────────
# Downloads the OFFICIAL Linux binary from pocketbase.io releases. Your local
# ./pocketbase/pocketbase is a platform-specific binary (Windows/macOS) and is
# NOT used in the container.
#
# IMPORTANT: keep PB_VERSION matched to the version you run locally
# (check with: ./pocketbase/pocketbase --version) so migrations behave
# identically. Override at build time or via the PB_VERSION env in Coolify.
FROM alpine:3.20 AS fetch
ARG PB_VERSION=0.39.5
ARG TARGETARCH=amd64
RUN apk add --no-cache ca-certificates unzip wget \
 && wget -q -O /tmp/pb.zip \
      "https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_linux_${TARGETARCH}.zip" \
 && unzip /tmp/pb.zip -d /pb \
 && rm /tmp/pb.zip

FROM alpine:3.20
RUN apk add --no-cache ca-certificates wget
WORKDIR /pb

COPY --from=fetch /pb/pocketbase /usr/local/bin/pocketbase
# Committed migrations run automatically on `serve`.
COPY pb_migrations ./pb_migrations
COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

# pb_data holds the actual database — must be a persistent volume (see compose).
VOLUME ["/pb/pb_data"]
EXPOSE 8090

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
