ARG APP_VERSION=dev
FROM maven:3.9-eclipse-temurin-21 AS build
ARG APP_VERSION
WORKDIR /workspace
COPY VERSION ./VERSION
COPY backend ./backend
RUN cd backend && ./mvnw -Drevision=${APP_VERSION} --no-transfer-progress package

FROM eclipse-temurin:21-jre-alpine
ARG APP_VERSION=dev
ARG VCS_REF=unknown
LABEL org.opencontainers.image.title="Fantasy Broadcast backend" \
      org.opencontainers.image.version="${APP_VERSION}" \
      org.opencontainers.image.revision="${VCS_REF}"
RUN apk upgrade --no-cache && addgroup -S broadcast && adduser -S broadcast -G broadcast && mkdir -p /var/lib/fantasy-broadcast/narrations && chown -R broadcast:broadcast /var/lib/fantasy-broadcast
USER broadcast
WORKDIR /app
COPY --from=build /workspace/backend/target/backend-*.jar app.jar
ENV SPRING_PROFILES_ACTIVE=production,db \
    BROADCAST_NARRATION_TEMP_DIRECTORY=/var/lib/fantasy-broadcast/narrations
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
