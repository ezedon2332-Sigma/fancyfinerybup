# Migration Plan — Supabase → self-hosted, Docker on a VPS

> Living document. Supersedes the Supabase/Vercel sections of `docs/PROJECT_PLAN.md`
> and `docs/DEPLOYMENT.md` as each phase lands.

## Decisions (locked)

| Decision | Choice | Why |
|---|---|---|
| App shape | **Next.js 16 stays full-stack** — Server Actions + Route Handlers *are* the backend | Keeps ~90% of existing code. We replace the layers underneath, not the app's shape. |
| Database | **Own `postgres:17-alpine` container** + named volume | Schema uses only `pgcrypto` + generated `tsvector`. No pgvector, no Supabase-only extensions. |
| Data access | **Drizzle ORM** (`drizzle-orm` + `drizzle-kit`) | Relational queries map ~1:1 onto the existing embedded selects. Introspects the live schema. |
| Auth | **Better Auth** (MIT, v1.6.28) + Drizzle adapter | Free forever, self-hosted, audited crypto (`@noble/hashes`, `jose`). Covers email+password, magic link, Google OAuth, verification, reset. |
| Storage | **MinIO container** on the same VPS, volume-backed; browser→MinIO presigned PUT uploads | S3-compatible. Keeps large video uploads out of the Next.js process, and lifts Supabase's 50 MB ceiling. |
| Data migration | **None — fresh start.** Seed from `supabase/seed.sql` | Removes an entire workstream and the cutover window. |
| Hosting | Docker Compose on a VPS behind Caddy (auto-TLS) | Replaces Vercel. |

## Architecture — the governing constraint

The existing layering is sound and **is not up for renegotiation by this migration**. Verified, not assumed:

- `src/domain/` — **zero** imports outside itself. Entities, repository ports, and the pure shipping/pricing/currency/Nigeria logic.
- `src/application/use-cases/` — imports **only** `@/domain`. Dependencies arrive as injected ports (`CatalogDeps`, `CheckoutDeps`), never as concrete clients.
- `src/infrastructure/supabase/catalog-service.ts` is already a named **composition root**, wiring concrete repositories into the use-case dependency shape.

That is textbook dependency inversion, and it is the reason this migration is tractable at all.

### The rule

**Dependencies point inward. Supabase — and Drizzle after it — is a detail of the outermost ring.**

| Layer | May import | Must never import |
|---|---|---|
| `domain/` | `domain/` only | anything |
| `application/` | `domain/` | `infrastructure/`, `app/`, `components/`, `next/*` |
| `infrastructure/` | `domain/`, `application/` (ports) | `app/`, `components/` |
| `app/`, `components/` | `domain/`, `application/`, composition roots | concrete adapters, DB row types, `drizzle-orm` |

**Success test:** when Phase 2 is done, `src/domain/` and `src/application/` must have a **zero-line diff**. If either changes, an abstraction leaked and we fix the leak rather than the layer.

### Where it already leaks — and why the migration must care

The pattern exists but is applied to **only 3 of ~13 data concerns**. The rest are "services" called straight from pages and Server Actions:

- **67 files under `src/app/` import `@/infrastructure/*` directly.** `AdminCategoriesPage` calls `listAdminCategories()` from `admin-service.ts` with no port in between.
- **11 component files import `@/infrastructure/*`** — `CategoryManager` imports the `AdminCategoryRow` *type* from a Supabase service, so a database row shape is a prop type in JSX. Same for `CustomersTable`, `NigeriaShippingPanel`, `ProductForm`.
- `image-url.ts` (pure presentation) sits in infrastructure and is imported by 4 components; `browser-client.ts` is imported directly by 2 auth components.

This is not a style complaint — it sets the size of the job:

> Behind a port, swapping Supabase → Drizzle means rewriting **one adapter file**. Without one, it means touching **every call site**, and DB-shaped types like `AdminCategoryRow` and `media_type` ripple out into `.tsx`.

So Phase 2 **completes the pattern already present** rather than inventing a new one: grow `domain/repositories/` from 3 ports to ~13, and add composition roots alongside `getCatalogDeps()`. This costs more typing than a blind find-and-replace, but it replaces work we would do anyway, caps the blast radius, and is what stops us repeating this exercise the next time an external dependency changes.

## What we are actually removing

Measured, not estimated:

| Surface | Scale | Difficulty |
|---|---|---|
| PostgREST query builder | **203 `.from()` calls across 51 files**, incl. ~30 embedded nested selects, `.or()` ilike filters, `.range()`, `.maybeSingle()`, 1 `.rpc()` | **Bulk of the work** |
| Service-role client | 107 call sites (`createSupabaseAdminClient`) | Mechanical |
| RLS-enforcing client | 51 call sites (`createSupabaseServerClient`) | **Security-critical** — see Phase 6 |
| Auth (GoTrue) | 14 `supabase.auth.*` calls, `@supabase/ssr` cookie handling, JWKS verification in `proxy.ts` | High-risk, well-bounded |
| Storage | 1 public bucket, 1 browser-direct upload path, 1 URL resolver | Low |
| SQL to port | 28 migrations · 37 tables · 20 triggers · **35 policies** · **33 `enable row level security`** · 12 `auth.uid()` · 7 `auth.users` FKs · 10 `storage.*` refs | Mostly mechanical |

**Not affected** (already provider-abstracted): Paystack + Stripe payments, the 8-provider email layer (Resend), the Anthropic AI concierge, all of `src/domain/` and `src/application/`.

**Also Vercel-coupled, must be replaced:** `vercel.json` crons (newsletter 09:00, payment reconciliation 03:00), next/image optimization, `*.supabase.co` entries in the CSP and `next.config.ts` remotePatterns.

---

## Phase 0 — Container foundations

No application code changes. Prove the box before moving the app onto it.

- `Dockerfile` — multi-stage, `output: "standalone"` in `next.config.ts`, non-root user, `sharp` installed for next/image.
- `docker-compose.yml` — `postgres`, `minio`, `web`, `caddy`, `ofelia` (cron).
- `Caddyfile` — auto-TLS; reverse proxy `your-domain.com` → `web:3000` and `media.your-domain.com` → `minio:9000`.
- `.env` restructure — **already done**, see `.env.example`. New blocks: database, Better Auth, MinIO/S3, deployment. The six `SUPABASE_*` vars stay set until Phases 3–4 land, because `src/config/*env.ts` throws on startup without them.
- Healthchecks, `restart: unless-stopped`, log rotation, `pg_dump` + `mc mirror` backup jobs.

**Deliverable:** `docker compose up` serves the *current* app (still on Supabase) from the VPS over HTTPS. De-risks the infrastructure independently of the code change.

## Phase 1 — Schema onto plain Postgres

Reuse the 28 existing migrations — they encode real design work — collapsed into one baseline for plain Postgres:

- Strip **33 `enable row level security`** + **35 policies** (revisited in Phase 6).
- Strip **10 `storage.*`** references and the `product-images` bucket.
- Re-point **7 `auth.users` FKs** → Better Auth's `user` table.
- Drop `is_admin()` and the **12 `auth.uid()`** call sites; drop the `anon`/`authenticated` grants.
- Keep the 20 triggers **except** `handle_new_user()` — that moves to a Better Auth `databaseHooks` callback (Phase 3), carrying the `admin_allowlist` logic with it.
- Drop the `email_exists()` RPC → becomes a plain Drizzle query in `src/app/auth/actions.ts`.
- `drizzle-kit introspect` → `src/infrastructure/db/schema.ts` + relations. Drizzle owns migrations from here.
- Port `supabase/seed.sql`.

**Deliverable:** `docker compose exec postgres psql` shows all 37 tables; `pnpm db:seed` populates a working catalog.

## Phase 2 — Data access swap (the bulk)

Done port-first, so the 203 call sites are insulated from the swap.

**2a — Ports (inner rings, no Supabase, no Drizzle).** For each data concern currently living in a `*-service.ts`, define its interface in `src/domain/repositories/` and its return types as domain entities. Ports grow 3 → ~13: products, categories, orders, customers, reviews, newsletter, campaigns, colour requests, shipping rates, Nigeria shipping, tax, AI settings/conversations/knowledge, admin allowlist. This is the step that turns `AdminCategoryRow` from a Supabase row into a domain type.

**2b — Drizzle adapters (outermost ring).**
- `src/infrastructure/db/client.ts` — `pg.Pool` + Drizzle (`pg` is already a dependency).
- `src/infrastructure/db/schema.ts` — introspected in Phase 1.
- `src/infrastructure/db/repositories/*` — one adapter per port, each implementing an interface it does not own.
- `src/infrastructure/db/mappers.ts` — the DB-row → domain-entity boundary. **Widen the existing `mappers.ts` seam rather than bypassing it**; it is what keeps row shapes out of the app.

**2c — Composition roots.** Extend the `getCatalogDeps()` pattern: one wiring function per feature area, the only place that names a concrete adapter. Pages and actions import these, never adapters.

**2d — Delivery layer.** Repoint the ~35 Server Action files and RSC pages at ports + composition roots. Mostly import-line changes once 2a–2c are in place.

**2e — Teardown.** Delete `src/infrastructure/supabase/` and `database.types.ts` (38KB — replaced by Drizzle's inferred types).

**Invariants, enforced not hoped for:**
- `src/domain/` and `src/application/` end with a **zero-line diff**.
- No file under `src/app/` or `src/components/` imports `drizzle-orm` or `@/infrastructure/db/*`.
- Add an ESLint `no-restricted-imports` rule encoding the layer table above, so the rule survives us. Cheap, and it fails the build instead of a review.

**Deliverable:** zero imports of `@supabase/supabase-js` outside auth; lint + `npm run build` clean; storefront + admin exercised per `docs/TESTING.md`.

## Phase 3 — Auth

- Better Auth mounted at `/api/auth/[...all]`, Drizzle adapter, **telemetry explicitly disabled**.
- Parity with the current surface: email+password, magic link (plugin), Google OAuth, email verification, password reset — all sending through the existing Resend layer in `src/infrastructure/notifications/email.ts`, which also retires the separate Supabase SMTP configuration.
- Profile creation via `databaseHooks.user.create.after` — replaces the `handle_new_user()` trigger and the `admin_allowlist` check.
- Rewrite the browser-side callers: `AuthPanel.tsx`, `ResetPasswordForm.tsx`, `/auth/callback/route.ts`.
- `proxy.ts`: swap `supabase.auth.getClaims()` for Better Auth's cookie check. It remains **optimistic only** — the security boundary stays in the admin layout and every Server Action, per `AGENTS.md`.

**Layering:**
- `src/infrastructure/auth/` holds the Better Auth instance and adapter. Nothing outside it imports `better-auth`.
- `src/infrastructure/supabase/auth.ts` → `src/infrastructure/auth/session.ts`, **keeping its exact exported signatures** (`getCurrentUser`, `getCurrentProfile`, `requireUser`, `requireAdmin`) and its domain return types (`AuthUser`, `Profile`). Only the body changes, so its dozens of call sites are untouched. This file is already a correctly-shaped seam — it returns domain entities and hides the provider.
- Fix the two component leaks the migration forces: `AuthPanel.tsx` and `ResetPasswordForm.tsx` currently import `browser-client` directly. They move to Server Actions over a thin auth port, so no client component imports an auth SDK. `SiteHeader.tsx` keeps importing the session module — that is a legitimate composition-root import, not a leak.

**Deliverable:** all five auth flows pass end to end; `role='admin'` promotion works; `/admin` gate holds against a direct POST.

## Phase 4 — Storage (MinIO)

The bucket carries **both images and video** (`product_images.media_type`), with the admin uploader accepting `image/*,video/*` across 9 video and 9 image extensions. That shapes the design:

- `minio` container + volume; bucket `product-media` with a public-read policy on `products/*`; a **least-privilege service account** for the app (not the root credentials).
- **Uploads stay browser-direct.** An admin-gated Server Action validates MIME + size and returns a short-lived **presigned PUT URL**; the browser uploads straight to MinIO. Three consequences, all improvements:
  - A 200 MB video never streams through the Next.js container — no body-size limit, no memory spike.
  - `MEDIA_MAX_VIDEO_MB` is genuinely ours. `upload-media.ts` currently hardcodes 50 MB with the comment *"the project ceiling"* — that was Supabase's limit, and it's gone.
  - The XHR carrying the PUT gives **real upload progress**, replacing the coarse fake the current code documents as a workaround for `supabase-js`'s `upload()` resolving only on completion.
  - Presigned URLs must be signed against `NEXT_PUBLIC_MEDIA_URL` (the host the browser actually hits), not the internal `S3_ENDPOINT` — signature includes the host.
**Layering:**
- A `MediaStorage` port (`put`/`presignPut`/`remove`/`publicUrl`) with a MinIO adapter in `src/infrastructure/storage/`. Nothing outside it imports the S3 SDK — which is precisely what makes a later move to R2/S3 a one-file change instead of a second migration.
- **`image-url.ts` moves out of infrastructure entirely** → `src/lib/media-url.ts`. It is a pure `(storagePath, baseUrl) => url` function with no I/O; it only lived in `infrastructure/supabase/` because of the hardcoded Supabase base. Reading `NEXT_PUBLIC_MEDIA_URL` instead removes the last reason. This clears **4 of the 11 component leaks** (`ProductCard`, `ProductDetail`, `ProductSearch`, `ProductForm`) for free.
- Rewrite `src/lib/upload-media.ts`. Its useful parts — extension/MIME classification, the `mediaKind` fallback for browsers that report empty `type` on `.mov`/`.mkv`, size validation, abort handling, the immutable `products/<uuid>.<ext>` path — all survive; only the transport changes.
- `resolveImageUrl()` → `NEXT_PUBLIC_MEDIA_URL` base. Its absolute-URL and bare-filename branches still work unchanged.
- `next.config.ts`: swap the `*.supabase.co` remotePattern for the media host; swap `*.supabase.co` for it in `img-src`/`media-src`, and add it to `connect-src` (the browser now PUTs there directly). Keep `minimumCacheTTL` — the immutable-path reasoning documented there still holds, and the egress-quota problem that motivated it is now our own disk.

## Phase 5 — Production deployment

- Compose stack: `postgres` · `minio` · `web` · `caddy` · `ofelia`.
- `ofelia` replaces the two `vercel.json` crons, calling `/api/cron/*` with `Authorization: Bearer $CRON_SECRET`. That guard already exists and is unchanged.
- Nightly `pg_dump` + `mc mirror` of the MinIO bucket, offsite. **Video makes the media volume the fastest-growing thing on the box** — size the disk and alarm on it.
- Update `docs/DEPLOYMENT.md`; delete `vercel.json`.
- Note: the in-memory rate limiter in `src/lib/ai-rate-limit.ts` becomes **more** correct on a single container than it was on serverless. Its "per-instance only" caveat no longer applies.

## Phase 6 — Hardening

**The top risk of this entire migration.** Today, 51 call sites rely on RLS for row filtering — `product-repository.ts` says so explicitly ("Relies on RLS for the published-only rule"). Removing RLS means every one of those must prove its own authorization in code.

- **Authorization audit:** each of the 51 ex-RLS sites reviewed and its ownership/visibility filter proven. Tracked as a checklist, not a vibe.
- **Query helpers that make the mistake impossible:** scoped accessors (`ordersForUser(userId)`, `publishedProducts()`) so a missing `where` clause fails to compile rather than leaking rows.
- **Optional defence-in-depth:** reinstate RLS via a `withUser()` transaction wrapper (`SET LOCAL role authenticated` + `SET LOCAL request.jwt.claims`), preserving the existing policies as a second layer. Costs a transaction per user-context query; buys back exactly the protection this migration removes. Recommended *after* the core migration is green.
- Promote the CSP from `Report-Only` once the console is quiet on the new origins.

---

## Effort

| Phase | Estimate |
|---|---|
| 0 — Containers | 1–2 days |
| 1 — Schema | 1–2 days |
| 2 — Data access, port-first (203 sites) | **7–10 days** |
| 3 — Auth | 3–4 days |
| 4 — Storage (MinIO) | 1–2 days |
| 5 — Deploy | 1–2 days |
| 6 — Hardening | 2–3 days |
| **Total** | **~3–4.5 weeks** focused |

Phase 2 carries **+2 days versus a blind find-and-replace** — the cost of writing the ~10 missing ports. That buys a zero-line diff in `domain/` and `application/`, DB row types out of JSX, and a lint rule that keeps it that way. It is the difference between migrating off Supabase once and being coupled to Drizzle exactly as hard as we were coupled to Supabase.

## Risk register

1. **Authorization regressions from dropping RLS** — highest impact. Mitigated by the Phase 6 audit + scoped query helpers; optionally by reinstating RLS.
2. **The ~30 embedded-select rewrites** — subtle shape changes (a missing nested row silently becoming `[]` instead of `null`). Mitigated by keeping the `mappers.ts` boundary and diffing mapper output before/after.
3. **Auth edge cases** — verification-link expiry, OAuth state, session rotation. Mitigated by Better Auth owning them rather than us.
4. **VPS operational burden** — backups, upgrades, disk, TLS renewal now ours. Mitigated by Phase 0 landing before any app change.
5. **Architectural drift under deadline pressure** — the temptation, at 203 call sites, is to import the Drizzle client directly "just here" and move on. That reproduces the exact coupling this migration exists to remove. Mitigated by the ESLint `no-restricted-imports` rule (Phase 2), which makes drift a build failure rather than a review comment.

## Order of work

Phases 0 and 1 are independent and can run in parallel. Phase 2 is the long pole and should start as soon as Phase 1's schema is stable. Phase 3 can proceed alongside late Phase 2 (auth and data touch mostly different files). Phases 4–6 follow.
