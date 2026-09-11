#!/usr/bin/env bash

# Run from any directory on the production host with:
#   bash scripts/deploy-production.sh
set -Eeuo pipefail

repository_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
compose_file="$repository_root/compose.production.yaml"
environment_file="$repository_root/data/backend/application.env"
application_file="$repository_root/data/backend/application.yaml"

if [[ ! -f "$environment_file" ]]; then
  echo "Missing production environment file: $environment_file" >&2
  exit 1
fi

if [[ ! -f "$application_file" ]]; then
  echo "Missing production application config: $application_file" >&2
  exit 1
fi

cd "$repository_root"

compose=(docker compose --env-file "$environment_file" -f "$compose_file")

echo "Pulling the configured production images..."
"${compose[@]}" pull

echo "Starting the production stack..."
"${compose[@]}" up -d

echo
"${compose[@]}" ps

echo
echo "Checking backend health..."
health_response="$("${compose[@]}" exec -T backend wget -qO- http://localhost:8080/actuator/health)"
if [[ "$health_response" != *'"status":"UP"'* ]]; then
  echo "Backend did not report UP: $health_response" >&2
  exit 1
fi

echo "Production deployment is healthy: $health_response"
