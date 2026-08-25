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
3. This repository checked out at `VPS_APP_DIR`. Only `docker-compose.prod.yml`,
   `Caddyfile` and `.env` are read from it — the application itself comes from
   the image.
4. A `.env` beside the compose file. Copy `.env.example`. Every secret is
   required and has no default: an unset value fails loudly rather than shipping
   a known credential.

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

Required GitHub secrets: `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`, `VPS_APP_DIR`.
Required variables: `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_MEDIA_URL`,
`NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` —
these are inlined into the client bundle at build time, so they must be present
then, not at run time.

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
