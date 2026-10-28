#!/usr/bin/env bash
# Rebuild and restart the isolated local testing stack, keeping its database.
set -Eeuo pipefail

repository_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
environment_file="$repository_root/.env.testing"
cd "$repository_root"

command -v docker >/dev/null || { echo "Docker is required." >&2; exit 1; }
docker compose version >/dev/null
docker info >/dev/null

if [[ ! -f "$environment_file" ]]; then
  command -v openssl >/dev/null || { echo "OpenSSL is required to generate local credentials." >&2; exit 1; }
  (
    umask 077
    set -o noclobber
    {
      printf 'TEST_ADMIN_PASSWORD=%s\n' "$(openssl rand -hex 24)"
      printf 'TEST_DB_PASSWORD=%s\n' "$(openssl rand -hex 24)"
      printf 'TEST_DB_ROOT_PASSWORD=%s\n' "$(openssl rand -hex 24)"
      printf 'TEST_WEB_PORT=5173\nTEST_BACKEND_PORT=8080\n'
    } > "$environment_file"
  )
  echo "Created local credentials in $environment_file (keep this file for subsequent runs)."
fi

compose=(docker compose --env-file "$environment_file" -f "$repository_root/compose.testing.yaml")
"${compose[@]}" config --quiet

echo "Compiling and building backend and frontend images..."
"${compose[@]}" build

echo "Restarting the local test stack; database contents are preserved..."
if ! "${compose[@]}" up -d --force-recreate --wait --wait-timeout 240; then
  "${compose[@]}" ps
  "${compose[@]}" logs --tail 80 backend web
  exit 1
fi

"${compose[@]}" ps
web_binding="$("${compose[@]}" port web 8080)"
backend_binding="$("${compose[@]}" port backend 8080)"
printf '\nFrontend: http://localhost:%s\nBackend: http://%s\n' "${web_binding##*:}" "$backend_binding"
printf 'Admin: skelolegenda@gmail.com\nPassword: TEST_ADMIN_PASSWORD in %s\n' "$environment_file"
printf 'Stop: docker compose --env-file .env.testing -f compose.testing.yaml down\n'
