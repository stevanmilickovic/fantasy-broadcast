# Production deployment

`VERSION` is the release version. CI uses it for Maven builds and for the immutable versioned container tags; each image also receives a Git-SHA tag and OCI version/revision labels.

Deploy from the directory that contains `compose.production.yaml`. Create `data/backend/application.env` and `data/backend/application.yaml` there. They are host-managed configuration files and must never be committed.

`application.env` supplies MySQL credentials, `DB_URL`, provider keys, initial-admin credentials, and image variables such as `IMAGE_REGISTRY=ghcr.io/your-account` and `IMAGE_TAG=0.1.0-preproduction`. `application.yaml` holds non-secret application configuration such as the email sender and public URL.

Run `docker compose --env-file data/backend/application.env -f compose.production.yaml up -d`. MySQL is private to the Compose network. The backend alone also joins an egress network so it can reach FPL and the optional narration providers; it has no published port. The web service listens only on localhost:8080; put your hosting provider's TLS reverse proxy in front of it so the app is served under one HTTPS domain.

Before inviting testers:

- Configure TLS, DNS, SPF/DKIM/DMARC, and `BROADCAST_ALLOWED_ORIGIN`.
- Leave `BROADCAST_SECURE_COOKIES=true` (the production default); test sign-in, sign-out, and the live SSE stream through the HTTPS domain.
- Set production profile, database credentials, initial-admin credentials, provider secrets, email sender, and public base URL.
- Check `http://127.0.0.1:8080/actuator/health` through the host and configure an uptime alert.
- Verify Liquibase migration against a database backup and confirm backup/restore procedures.
- Confirm persistent MySQL and narration-audio storage, central log collection, and host firewall rules.
- Create a verified test account, follow the pre-registered league, open an active broadcast, and verify narration and audio access.
