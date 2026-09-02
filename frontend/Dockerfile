FROM node:22-alpine AS build
ARG APP_VERSION=dev
WORKDIR /workspace
COPY frontend/package*.json ./
RUN npm ci
COPY frontend ./
RUN npm run build && sed -i "s/content=\"dev\"/content=\"${APP_VERSION}\"/" dist/index.html

FROM nginx:1.27-alpine
ARG APP_VERSION=dev
ARG VCS_REF=unknown
LABEL org.opencontainers.image.title="Fantasy Broadcast web" \
      org.opencontainers.image.version="${APP_VERSION}" \
      org.opencontainers.image.revision="${VCS_REF}"
RUN apk upgrade --no-cache
COPY frontend/nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /workspace/dist /usr/share/nginx/html
EXPOSE 8080
