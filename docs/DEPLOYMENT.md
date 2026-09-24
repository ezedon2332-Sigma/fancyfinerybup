# Deployment

Docker Compose on a VPS, behind Caddy. There is no Vercel and no Supabase
anywhere in this project — see `docs/MIGRATION_PLAN.md` for how it got here.

## Local development

```bash
docker compose up -d          # postgres · minio · redis
npm run db:migrate            # baseline + reference data + migrations
npm run db:seed               # demo catalogue + the bootstrap admin
npm run dev
```

Storefront on <http://localhost:3000>, admin on `/admin/login`.

`npm run db:reset` rebuilds the database from nothing. It refuses to run against
a non-local `DATABASE_URL` without `--force`.

### Webhooks in development

Paystack and Stripe deliver server-to-server, so they cannot reach localhost:

```bash
npm run tunnel
```

Paste the printed URL into the providers' **test-mode** webhook settings. Live
mode stays pointed at production — both providers keep the two separate, which
is what makes this safe. The tunnel refuses to start if `NODE_ENV=production`,
`APP_ENV` is staging/production, or `DATABASE_URL`/`NEXT_PUBLIC_SITE_URL` point
anywhere non-local.

Leave `NEXT_PUBLIC_SITE_URL` as localhost: the post-payment redirect happens in
your own browser and does not need the tunnel.

## Environments

`NODE_ENV` is `production` for both staging and production, because both run a
production build. **`APP_ENV` is what tells them apart** — set it to `staging`
or `production`.

## Server prerequisites

1. Docker and Compose.
2. DNS **already resolving** for both hosts before the first start, or Caddy's
   certificate request fails:
   - `APP_DOMAIN` → the server
   - `MEDIA_DOMAIN` → the server
3. A `deploy` user in the `docker` group, with the deploy key in its
   `authorized_keys`. The workflow always connects as `deploy`; the username is
   not configurable.
4. The directories `/opt/fancy/staging`, `/opt/fancy/production` and
   `/opt/fancy/edge`, owned by `deploy`. These paths are hardcoded in the
   workflow. Deploy ships `docker-compose.prod.yml`, `docker-compose.edge.yml`,
   `Caddyfile` and the rendered `.env` into them — the application itself comes
   from the image, so the repository is never checked out on the box.

## One host, both environments

Staging and production run side by side on a single VPS, as three compose
projects:

| Project            | Contents                                  |
|--------------------|-------------------------------------------|
| `fancy-staging`    | web · postgres · redis · minio · cron     |
| `fancy-production` | the same five, separate data              |
| `fancy-edge`       | one Caddy, owning `:80` and `:443`        |

Two things make that possible, and both are easy to undo by accident:

- **`COMPOSE_PROJECT_NAME=fancy-<env>`**, exported by deploy, namespaces
  containers, networks and volumes. Containers are additionally named
  `fancy-${APP_ENV}-*`, because a `container_name` is global to the host and
  two stacks sharing one would collide before anything else failed.
- **The proxy lives outside both stacks**, in `docker-compose.edge.yml`, and is
  always brought up with an explicit `-p fancy-edge`. Only one process can bind
  `:443`, so a per-stack Caddy cannot work here. Without the explicit project
  name it is absorbed into whichever environment deployed last, and the next
  deploy starts a second Caddy that cannot bind.

The stacks reach the proxy over the external network `fancy-edge`, which each
joins publishing the aliases `web-<env>` and `minio-<env>`. Create it once per
host with `docker network create fancy-edge`; deploy also creates it if missing,
before the first compose command that attaches to it. An environment that is
not deployed simply has no alias, and its hostnames 502 until it is.

Each deploy writes only its own domains to `/opt/fancy/edge/.env.<env>`, and
they are concatenated into `.env`, so redeploying one environment never drops
the other's vhosts.

Generate real values:

```bash
openssl rand -base64 32   # BETTER_AUTH_SECRET
openssl rand -base64 32   # IP_HASH_SALT
openssl rand -base64 32   # CRON_SECRET
```

Create a **least-privilege MinIO service account** scoped to the bucket
(Identity → Service Accounts) for `S3_ACCESS_KEY_ID`/`S3_SECRET_ACCESS_KEY`. The
root credentials bootstrap the container and must not be used by the app.

`EMAIL_ASSET_BASE_URL` must be publicly reachable — a mail client fetches the
logo from wherever the reader is, so it can never be localhost.

## Deploying

Push to `main`. `.github/workflows/deploy.yml` then:

1. typechecks and lints (including the clean-architecture layer rules),
2. builds the image and pushes it to GHCR tagged with the commit SHA,
3. SSHes to the VPS, pulls that exact image,
4. **runs migrations from inside it** — the SQL and the code expecting it are
   the same build — before anything serves,
5. brings the stack up and verifies the site answers.

Required GitHub **secrets**:

| Secret           | Holds                                                     |
|------------------|-----------------------------------------------------------|
| `VPS_SSH_KEY`    | private key for the `deploy` user, used for both environments |
| `STAGING_ENV`    | the entire runtime `.env` for staging                     |
| `PRODUCTION_ENV` | the entire runtime `.env` for production                  |

Required **variables** — public, not secret, and `NEXT_PUBLIC_*` are inlined
into the client bundle at build time, so they must be present then rather than
at run time:

| Variable                              | Used for   |
|---------------------------------------|------------|
| `VPS_HOST` / `PROD_VPS_HOST`          | target box |
| `NEXT_PUBLIC_SITE_URL` / `PROD_…`     | staging / production |
| `NEXT_PUBLIC_MEDIA_URL` / `PROD_…`    | staging / production |
| `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY` / `PROD_…` | test key / live key |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`  | shared     |

There is no `VPS_USER` or `VPS_APP_DIR`: the workflow always connects as
`deploy` and writes to `/opt/fancy/<env>`.

Until `PRODUCTION_ENV` is set, a push to `main` skips the deploy steps cleanly
rather than failing, so `main` stays green while only staging exists.

### Rollback

Every build is tagged with its commit SHA:

```bash
APP_IMAGE=ghcr.io/<owner>/<repo>:sha-abc1234 \
  docker compose -f docker-compose.prod.yml up -d web
```

Migrations are **not** rolled back automatically. Write reversible migrations,
or roll forward.

## Third-party configuration

**Google sign-in** — the redirect URI is ours now, not a Supabase one:

```
https://<APP_DOMAIN>/api/auth/callback/google
```

**Payment webhooks** — live mode:

```
https://<APP_DOMAIN>/api/paystack/webhook
https://<APP_DOMAIN>/api/stripe/webhook
```

**Email** — `EMAIL_FROM`'s domain must be verified in Resend, with the DKIM and
SPF records it issues added to DNS. Resend will not send from an unverified
domain. For a brand logo in the inbox list, you additionally need DMARC at
`p=quarantine` or `p=reject`, a BIMI record, and (for Gmail) a VMC.

## What runs

| Service | Exposed | Purpose |
|---|---|---|
| `caddy` | 80, 443 | TLS, reverse proxy — the only thing published |
| `web` | internal | the app |
| `postgres` | internal | database, volume-backed |
| `minio` | internal | product media, volume-backed |
| `redis` | internal | cache; the app runs without it |
| `ofelia` | — | daily newsletter (09:00) + payment reconciliation (03:00) |

Nothing but Caddy publishes a port, so the database is not reachable from the
internet even if the host firewall is misconfigured.

## Backups

Not automated. The two things that cannot be rebuilt:

```bash
docker exec fancy-postgres pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" | gzip > db-$(date +%F).sql.gz
docker run --rm -v fancyfinerybup_minio-data:/data -v "$PWD:/backup" alpine \
  tar czf /backup/media-$(date +%F).tar.gz /data
```

Take both off the box. Product video makes the media volume the fastest-growing
thing on the server — size the disk for it and alarm on free space.
