#!/bin/sh
set -eu

if [ "${FINANZAPP_SQLSERVER_API:-false}" = "true" ]; then
  printf '%s\n' 'window.FINANZAPP_CONFIG = Object.freeze({ sqlServerApi: true });' \
    > /usr/share/nginx/html/runtime-config.js
fi
