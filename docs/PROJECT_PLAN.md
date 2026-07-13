# Fancy Finery — Project Plan

> Single-brand luxury clothing store with a **customer storefront** and an **admin section**.
> Stack: **Next.js 16** (App Router, full-stack) · **Supabase** (Postgres + Auth + Storage) · **Paystack** (payments) · deployed on **Vercel**.
>
> This is a living document. Each phase has a checklist; check items off as we ship them. Update this file whenever a decision changes.

---

## 1. Decisions (locked)

| Decision | Choice |
|---|---|
| Store model | **Single-brand store** — one seller (you). One product catalog. |
| Customer auth | **Google sign-in** + **Magic link (email)** via Supabase Auth |
| Admin auth | Same login, but **admin role granted via allowlist / role flag** in the DB (no self-signup) |
| Payments | **Paystack** (cards, bank transfer, USSD — Nigeria-friendly) |
| Data / backend | **Supabase** (Postgres, Auth, Storage, Row Level Security) |
| Framework | **Next.js 16** — App Router, Server Components, Server Actions, Route Handlers |
| Hosting | **Vercel** (app) + **Supabase cloud** (database & auth) |
| Currency | NGN (₦) — configurable |

---

## 2. Next.js 16 conventions we MUST follow

> This project runs Next.js **16.2.10**, which has breaking changes vs. older versions. Read the bundled docs in `node_modules/next/dist/docs/` before each phase.

- **Middleware is now `proxy.ts`** (root or `src/`). It is for *optimistic* checks only (e.g. refreshing the Supabase session cookie, cheap redirects). **Never treat it as the security boundary.**
- **Real authorization happens server-side**, inside every Server Component, Server Action, and Route Handler. Server Actions are reachable via direct POST, so each one re-checks auth.
- **Mutations** use **Server Actions** (`'use server'`) — preferred over API routes for form/data mutations. Use Route Handlers (`route.ts`) for webhooks and third-party callbacks (e.g. Paystack).
- **Data fetching** happens in Server Components (async components) by default; client components only where interactivity is required (cart, forms).
- Path alias `@/*` → `src/*`. Keep everything under `src/`.

---

## 3. High-level architecture

```
Browser
  │
  ├── Customer storefront (RSC pages)  ── read via Supabase (RLS: public read of published products)
  │       └── Cart (client) ── Checkout (Server Action) ── Paystack init
  │
  ├── Admin section (/admin, role-gated) ── CRUD via Server Actions (service role, server-only)
  │
  └── proxy.ts ── refreshes Supabase auth cookie, cheap /admin redirect for signed-out users

Supabase
  ├── Postgres (products, orders, etc.) + Row Level Security
  ├── Auth (Google OAuth + magic link) → user rows + profiles.role
  └── Storage (product images bucket)

Paystack
  └── Route Handler /api/paystack/webhook  ← payment confirmation → mark order paid
```

**Two Supabase clients:**
- **Browser/anon client** (`@supabase/ssr`) — respects RLS, used in client components & user-context server reads.
- **Service-role client** — server-only (never shipped to browser), used in admin Server Actions and the Paystack webhook to bypass RLS safely.

---

## 4. Data model (Postgres / Supabase)

Tables (final shape may refine during Phase 1):

- **profiles** — `id` (FK → auth.users), `full_name`, `avatar_url`, `role` (`'customer' | 'admin'`, default `customer`), `created_at`. Auto-created on signup via trigger.
- **categories** — `id`, `name`, `slug`, `description`, `sort_order`.
- **products** — `id`, `name`, `slug`, `description`, `price` (integer, kobo/minor units), `currency`, `category_id`, `status` (`'draft' | 'published' | 'archived'`), `featured` (bool), `created_at`, `updated_at`.
- **product_images** — `id`, `product_id`, `storage_path`, `alt`, `sort_order`.
- **product_variants** — `id`, `product_id`, `size`, `color`, `sku`, `stock_qty`. (Handles size/color inventory.)
- **orders** — `id`, `user_id`, `status` (`'pending' | 'paid' | 'fulfilled' | 'cancelled'`), `total`, `currency`, `paystack_reference`, `shipping_*` fields, `created_at`.
- **order_items** — `id`, `order_id`, `product_id`, `variant_id`, `name_snapshot`, `unit_price`, `qty`.

**Row Level Security (RLS) principles:**
- `products`/`categories`/`product_images`: **public read** where `status = 'published'`; write only for admins.
- `orders`/`order_items`: a user reads/writes **only their own**; admins read all.
- `profiles`: user reads/updates own; admins read all. `role` column only changeable by admin (or via SQL).
- Admin mutations run through **service-role** Server Actions that assert `profiles.role = 'admin'` before acting.

Prices stored as **integer minor units** (kobo) to avoid float errors.

---

## 5. Auth design

- **Sign-in methods:** Google OAuth + email magic link, both via Supabase Auth. Configured in Supabase dashboard (Google provider creds + redirect URLs).
- **Session handling:** `@supabase/ssr` stores the session in cookies; `proxy.ts` refreshes it on navigation.
- **Admin allowlist:** `profiles.role` defaults to `customer`. You promote an account by setting `role = 'admin'` (SQL / Supabase dashboard), or via a seeded allowlist of emails on first login. No admin self-signup.
- **Gating `/admin`:** proxy does a cheap redirect if no session; the admin layout (Server Component) does the authoritative `role === 'admin'` check and calls `forbidden()`/`redirect()` otherwise. Every admin Server Action re-verifies role.

---

## 6. Payments (Paystack) flow

1. Customer checks out → **Server Action** creates an `order` (`status='pending'`) and calls Paystack **initialize transaction** (server-side, secret key) → gets an `authorization_url` + `reference`.
2. Redirect customer to Paystack checkout.
3. Paystack redirects back to a **callback page**; we also rely on the **webhook** as source of truth.
4. **Route Handler** `/api/paystack/webhook` verifies the signature, on `charge.success` marks the matching order `paid`, decrements stock. (Webhook uses service-role client.)
5. Customer sees order confirmation; order appears in admin.

Secret key and webhook secret live only in server env vars.

---

## 7. Environment variables

```
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=        # server-only, NEVER prefixed NEXT_PUBLIC

# Paystack
PAYSTACK_SECRET_KEY=              # server-only
NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY=
PAYSTACK_WEBHOOK_SECRET=          # (Paystack signs with secret key; store for verification)

# App
NEXT_PUBLIC_SITE_URL=            # e.g. https://fancyfinery.vercel.app
```

Stored in `.env.local` (git-ignored) locally and in **Vercel project settings** for production.

---

## 8. Folder structure — Clean Architecture (under `src/`)

Dependencies point **inward**: `domain` knows nothing about Next or Supabase;
`infrastructure` implements domain ports; the Next.js `app`/`components` layer
is the delivery mechanism and depends on the inner layers, never the reverse.

```
src/
  domain/                        # Enterprise rules — NO framework imports
    entities/                    # product, category, order, profile
    repositories/                # ports (interfaces) implemented by infra
    shared/                      # value objects (money)
  application/                   # Use cases (added Phase 2+)
  infrastructure/                # Frameworks & drivers
    supabase/
      browser-client.ts          # Client Components (publishable key, RLS)
      server-client.ts           # RSC/Actions/Handlers (cookies, RLS)
      admin-client.ts            # SECRET key, RLS-bypass, server-only
      database.types.ts          # typed schema contract
      repositories/              # concrete repos implementing domain ports (Phase 2)
    paystack/                    # payment gateway (Phase 4)
  config/
    env.ts                       # browser-safe env (validated)
    server-env.ts                # server-only env (server-only import)
  app/                           # Next.js delivery layer
    (store)/ … admin/ … api/ … auth/          # (added in later phases)
  components/                    # shared UI (existing Navigation, Hero, …)
  proxy.ts                       # session refresh + optimistic /admin,/account gate

supabase/
  migrations/                    # versioned SQL (schema, RLS, triggers, storage)
  seed.sql                       # sample catalog data
  apply_all.sql                  # concatenated, paste-and-run
  README.md                      # how to apply & verify
scripts/
  db-check.mjs                   # verify schema is applied
```

---

## 9. Phases

Each phase ends in a **shippable, verifiable** state. We build in order; do not start a phase before the previous is green.

### Phase 0 — Project setup & guardrails ✅ DONE
- [x] Install deps: `@supabase/supabase-js`, `@supabase/ssr`, `server-only`.
- [x] Env scaffolding (`.env.example`, `.env` with new-format keys + `NEXT_PUBLIC_` mirrors).
- [x] Supabase project exists; URL/keys in `.env`.
- [x] Three Supabase client helpers under `infrastructure/supabase/`.
- [x] `proxy.ts` refreshes session (JWKS `getClaims`) + optimistic `/admin`,`/account` gate.
- [x] `config/env.ts` + `config/server-env.ts` (validated, `server-only` boundary).
- [x] Fix root `metadata` → Fancy Finery.
- **Done:** `npm run build` green, `ƒ Proxy (Middleware)` registered, tsc clean.

### Phase 1 — Database schema & RLS ✅ DONE (applied + seeded + verified)
- [x] SQL migrations for all tables in §4 (`supabase/migrations/`), applied to the live DB.
- [x] RLS + policies (public read published; user-owned orders; admin write) + `is_admin()` + role-escalation guard.
- [x] `profiles` auto-insert trigger on new auth user.
- [x] Storage bucket `product-images` + policies.
- [x] Seed applied via `scripts/seed.mjs` — 4 categories, 8 products (7 published + 1 draft), 8 images, 14 variants.
- [x] Domain entities + repository ports (clean architecture) + `database.types.ts`.
- [x] Legacy `Products` table + bucket: 2 rows migrated (images re-uploaded to `product-images`), then dropped.
- [x] Verify scripts: `scripts/db-check.mjs` (all present), RLS checked (anon sees only published; draft hidden; orders empty).
- **Done:** verified end-to-end against the live project (region eu-west-1).

> How it was applied: REST keys can't run DDL, so migrations were applied over the
> **session pooler** with `scripts/db-apply.mjs` (connection string passed via a transient
> `SUPABASE_DB_URL`, never persisted). See `supabase/README.md` for the repeatable steps.

### Phase 2 — Customer storefront (read-only, real data) ✅ DONE
- [x] Collections page reads published products from Supabase; category filter via `?category=`.
- [x] Product detail `products/[slug]` with image gallery + variant selection (add-to-bag stubbed for Phase 4).
- [x] Home wired to real data (featured + shop-by-category); `HeroSection` refreshed.
- [x] Loading (`loading.tsx`) & not-found (`not-found.tsx`, per-product) states.
- [x] Clean architecture: domain `ProductSummary`, Supabase repositories, `application/use-cases/catalog`, composition root.
- [x] Standard-height responsive navbar (lucide icons, mobile menu, framer-motion), footer, dark theme in root layout.
- [x] `next.config` `images.remotePatterns` for Supabase storage.
- **Done:** verified — home/collections/detail render seeded products; drafts hidden; build green.

### Phase 3 — Authentication ✅ DONE (needs Supabase URL/Google config to exercise live)
- [x] Login UI: magic link (zod-validated) + Google OAuth button.
- [x] `auth/callback` route handler (code + token_hash flows).
- [x] Sign-out server action; navbar + account reflect auth state.
- [x] `account/` page (protected via `requireUser`) showing profile.
- [x] `admin/` layout with authoritative `requireAdmin` role gate + dashboard.
- **Done:** verified — signed-out `/account` & `/admin` redirect to `/login`; forms render. Live sign-in needs Supabase redirect URLs (+ Google creds) per `docs/DEPLOYMENT.md`.

> Icons: `lucide-react`. Animations: `framer-motion` + CSS. Validation: `zod`.
> Deploy/env setup: **`docs/DEPLOYMENT.md`** (Vercel env vars are required or the build fails).

### Phase 4 — Cart & checkout + Paystack
- [ ] Client cart (context + localStorage), add-to-cart on product page.
- [ ] Checkout page (shipping details, requires auth).
- [ ] Server Action: create `pending` order + Paystack initialize.
- [ ] Paystack webhook Route Handler → mark `paid`, decrement stock.
- [ ] Order confirmation page + `account` order history.
- **Done when:** a test-mode Paystack payment creates a paid order end-to-end.

### Phase 5 — Admin section
- [ ] `/admin` layout with authoritative role gate.
- [ ] Product CRUD (create/edit/publish/archive) with image upload to Storage.
- [ ] Category management.
- [ ] Orders list + detail; update status (fulfilled/cancelled).
- [ ] Basic dashboard (counts: products, orders, revenue).
- **Done when:** an admin can manage catalog & orders entirely from the UI.

### Phase 6 — Polish & deploy
- [ ] Responsive/mobile pass on all pages; keep black/gold luxury theme.
- [ ] SEO metadata + Open Graph per product.
- [ ] Error boundaries, empty states, form validation.
- [ ] Configure Vercel env vars; connect repo; deploy.
- [ ] Point Paystack + Supabase redirect/webhook URLs at the production domain.
- **Done when:** live on Vercel, real (test-mode) purchase works in production.

### Later / backlog (out of scope for v1)
- Search, wishlist (♡), reviews, discount codes, email receipts, inventory alerts, multi-currency, analytics.

---

## 10. Working agreement

- Read the relevant `node_modules/next/dist/docs/` guide before writing code for a phase.
- Secrets never committed; service-role key never reaches the browser.
- Every Server Action / admin route re-checks authz server-side.
- Prices always in integer minor units.
- Commit at the end of each phase with a clear message.
```
