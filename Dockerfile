# Multi-stage build für minimales Image
FROM nginx:alpine

# Statische Dateien kopieren
COPY index.html /usr/share/nginx/html/

# Nginx Konfiguration für SPA (falls nötig)
RUN echo 'server { \
    listen 80; \
    server_name _; \
    root /usr/share/nginx/html; \
    index index.html; \
    location / { \
        try_files $uri $uri/ /index.html; \
    } \
}' > /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
