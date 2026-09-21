#!/bin/sh
set -eu
: "${SITE_ADDRESS:?Set SITE_ADDRESS from APP_ORIGIN}"
case "$DEPLOY_ENV:$SITE_ADDRESS" in
  production:https://*|staging:https://*|staging:http://*) ;;
  *) echo 'Production requires HTTPS; staging requires an HTTP(S) origin.' >&2; exit 1 ;;
esac
# Public ports belong to Compose's host mapping. Caddy listens on 80/443 inside.
export SITE_ADDRESS="$(printf '%s' "$SITE_ADDRESS" | sed -E 's#:[0-9]+$##')"
exec caddy run --config /etc/caddy/Caddyfile --adapter caddyfile
