FROM nginx:alpine

LABEL org.opencontainers.image.title="FinanzApp Pro" \
      org.opencontainers.image.description="Aplicación web estática de gestión financiera personal" \
      org.opencontainers.image.source="https://github.com/bradymoncada17/FinanzazAPP"

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY index.html app.js financeService.js styles.css premium-ui.css local-auth.js manifest.json sw.js runtime-config.js /usr/share/nginx/html/
COPY --chmod=755 docker/40-runtime-config.sh /docker-entrypoint.d/40-runtime-config.sh

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q --spider http://127.0.0.1/healthz || exit 1
