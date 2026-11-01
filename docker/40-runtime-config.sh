#!/bin/sh
set -eu
: "${PORT:=8080}"
: "${FLOPPY_URL:?Set FLOPPY_URL to a browser-reachable Floppy base URL}"
: "${FLOPPY_TOKEN:?Set FLOPPY_TOKEN to your Floppy app token}"
case "$PORT" in ''|*[!0-9]*) echo 'PORT must be an integer' >&2; exit 1;; esac
[ "$PORT" -ge 1 ] && [ "$PORT" -le 65535 ] || { echo 'PORT must be 1–65535' >&2; exit 1; }
# jq encodes quotes, backslashes, newlines and Unicode as valid JSON.
# Environment variables are read by jq rather than interpolated into program code.
jq -n '{FLOPPY_URL:env.FLOPPY_URL,FLOPPY_TOKEN:env.FLOPPY_TOKEN}' |
  { printf 'window.__FLOOPY_CONFIG__ = '; cat; printf ';\n'; } > /usr/share/nginx/html/config.js
export PORT
envsubst '${PORT}' < /opt/floopy/default.conf.template > /etc/nginx/conf.d/default.conf
