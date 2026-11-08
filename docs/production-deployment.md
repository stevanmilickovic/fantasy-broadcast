# Production deployment

`VERSION` is the release version. CI uses it for Maven builds and for the immutable versioned container tags; each image also receives a Git-SHA tag and OCI version/revision labels.

Only pushed version tags matching `vMAJOR.MINOR.PATCH` trigger image publishing;
ordinary branch pushes and pull requests do not run CI. The tag must match `VERSION`.
The release job runs frontend checks/build and backend tests/package once on the
runner, then uses the Dockerfiles' `release` targets with the prebuilt artifacts as
named build contexts. Docker does not repeat compilation or tests. npm, Maven and
Docker layers are cached; both published images retain HIGH/CRITICAL security scans.
Default Docker builds still compile from source, including backend tests, for the
local testing launcher.

Browser/screen tests are separate: start **Actions → Browser tests (manual) → Run
workflow** for the desired branch or tag when responsive verification is needed.

Deploy from the directory that contains `compose.production.yaml`. Create `data/backend/application.env` and `data/backend/application.yaml` there. They are host-managed configuration files and must never be committed.

`application.env` supplies MySQL credentials, `DB_URL`, provider keys, initial-admin credentials, the Cloudflare Tunnel token, and image variables such as `IMAGE_REGISTRY=ghcr.io/your-account` and `IMAGE_TAG=1.4.0`. `application.yaml` holds non-secret application configuration such as the email sender and public URL.

To deploy a released image, run `bash scripts/deploy-production.sh`. The script validates the host-managed configuration files, pulls the configured image tags, starts the services, and checks backend health. MySQL, the backend, and the web service are private to the Compose network. The Cloudflare Tunnel container reaches the web service at `http://web:8080`; configure that service URL when creating the tunnel's published application. No HTTP or HTTPS port is published on the VPS.

Before going live:

- Create a remotely managed Cloudflare Tunnel, configure its published hostname to target `http://web:8080`, and store `CLOUDFLARE_TUNNEL_TOKEN` only in `application.env`. Configure DNS, SPF/DKIM/DMARC, and `BROADCAST_ALLOWED_ORIGIN`.
- Leave `BROADCAST_SECURE_COOKIES=true` (the production default); test sign-in, sign-out, and the live SSE stream through the HTTPS domain.
- Set production profile, database credentials, initial-admin credentials, provider secrets, email sender, and public base URL.
- Check `docker compose --env-file data/backend/application.env -f compose.production.yaml exec backend wget -qO- http://localhost:8080/actuator/health` and configure an uptime alert.
- Verify Liquibase migration against a database backup and confirm backup/restore procedures.
- Confirm persistent MySQL and narration-audio storage, central log collection, and host firewall rules.
- Create a verified account, register or follow a league, open an active broadcast, and verify narration and audio access.

## Coordinating the next username migration

Version 1.4.0 includes the username migration. Do not publish its images under an
earlier immutable release tag. See the [verification handoff](next-version-verification.md)
before deployment; the version-update commit does not deploy or publish the application.

Migration 019 adds a canonical, case-normalized Unicode username key and enforces
uniqueness. It preserves existing display names and fails on a conflicting existing
name; it never silently renames an account. Rehearse it against a recent restored
MySQL backup before production rollout. Resolve any reported conflict explicitly
before retrying, rather than bypassing its validation.

1. Stop every application writer, including old replicas and background workers,
   and keep the site in maintenance until the coordinated rollout completes.
2. Take a consistent database backup and retain the previous application images and
   host configuration. Restore the backup into an isolated database and verify account
   identities and migration history before relying on it for recovery.
3. Start the new backend against the production database with only the new application
   writing. Check Liquibase completion, username uniqueness, authentication and health;
   deploy the matching frontend and smoke-test chat privacy and private-league access.
4. Reopen traffic after the checks pass. Keep the backup through the release observation
   period and monitor failed authentication, upstream requests and webhook processing.

Old application versions do not maintain `username_key`; a rolling deployment with
old writers can reject account creation or leave stale keys after renaming. Do not
restore an old writer against the migrated schema. Recovery requires a compatible
application or maintenance-mode restoration of the verified pre-migration backup and
matching old images. Restoring a backup discards subsequent writes, so assess those
writes, including payment webhook records, before choosing that recovery path.
