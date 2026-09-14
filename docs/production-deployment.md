# Production deployment

`VERSION` is the release version. CI uses it for Maven builds and for the immutable versioned container tags; each image also receives a Git-SHA tag and OCI version/revision labels.

Deploy from the directory that contains `compose.production.yaml`. Create `data/backend/application.env` and `data/backend/application.yaml` there. They are host-managed configuration files and must never be committed.

`application.env` supplies MySQL credentials, `DB_URL`, provider keys, initial-admin credentials, the Cloudflare Tunnel token, and image variables such as `IMAGE_REGISTRY=ghcr.io/your-account` and `IMAGE_TAG=1.0.1`. `application.yaml` holds non-secret application configuration such as the email sender and public URL.

To deploy a released image, run `bash scripts/deploy-production.sh`. The script validates the host-managed configuration files, pulls the configured image tags, starts the services, and checks backend health. MySQL, the backend, and the web service are private to the Compose network. The Cloudflare Tunnel container reaches the web service at `http://web:8080`; configure that service URL when creating the tunnel's published application. No HTTP or HTTPS port is published on the VPS.

Before going live:

- Create a remotely managed Cloudflare Tunnel, configure its published hostname to target `http://web:8080`, and store `CLOUDFLARE_TUNNEL_TOKEN` only in `application.env`. Configure DNS, SPF/DKIM/DMARC, and `BROADCAST_ALLOWED_ORIGIN`.
- Leave `BROADCAST_SECURE_COOKIES=true` (the production default); test sign-in, sign-out, and the live SSE stream through the HTTPS domain.
- Set production profile, database credentials, initial-admin credentials, provider secrets, email sender, and public base URL.
- Check `docker compose --env-file data/backend/application.env -f compose.production.yaml exec backend wget -qO- http://localhost:8080/actuator/health` and configure an uptime alert.
- Verify Liquibase migration against a database backup and confirm backup/restore procedures.
- Confirm persistent MySQL and narration-audio storage, central log collection, and host firewall rules.
- Create a verified account, register or follow a league, open an active broadcast, and verify narration and audio access.
