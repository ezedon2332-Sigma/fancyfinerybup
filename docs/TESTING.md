# Testing — Phases 0 & 1

How to verify what's been built so far. Phases 0–1 are **foundation + database**;
there's no storefront UI wired to data yet (that's Phase 2), so most checks are
build/DB/security rather than clicking around.

## Prerequisites
```bash
npm install
# .env must contain SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_SECRET_KEY,
# SUPABASE_JWKS_URL, NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
```

## 1. Build & typecheck (Phase 0)
```bash
npx tsc --noEmit      # expect: no output (clean)
npm run build         # expect: "Compiled successfully" + a line: ƒ Proxy (Middleware)
```
The `ƒ Proxy (Middleware)` line proves `src/proxy.ts` is picked up by Next 16.

## 2. Database schema present (Phase 1)
```bash
node scripts/db-check.mjs
```
Expected — all present with these row counts:
```
✓ profiles          present (0 rows)
✓ categories        present (4 rows)
✓ products          present (8 rows)
✓ product_images    present (8 rows)
✓ product_variants  present (14 rows)
✓ orders            present (0 rows)
✓ order_items       present (0 rows)
```

## 3. Seed data looks right
Published products should be 7 (6 sample + 1 migrated legacy… actually 5 sample
published + 1 sample draft + 2 migrated = 7 published, 1 draft). Quick check via
the Supabase dashboard → Table editor → `products`, or:
```bash
# uses the browser-safe publishable key
curl -s -H "apikey: $NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY" \
  "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/products?select=slug,price,status"
```

## 4. Row Level Security (the important security check)
Using the **publishable (anon)** key you should see ONLY published products and
NO orders:
- `products` → 7 rows, none with `status=draft`
- `orders` → `[]`

If the draft (`draft-spring-trench`) ever appears via the anon key, RLS is
broken. (Verified passing at time of writing.)

## 5. Proxy redirect (Phase 0 auth guard — optimistic)
```bash
npm run dev
```
- Open http://localhost:3000 → the Fancy Finery landing page renders.
- Open http://localhost:3000/admin (or `/account`) while signed out →
  you're redirected to `/login?redirect=/admin`. That `/login` page doesn't
  exist yet (Phase 3) so it 404s — the **redirect itself** is what proves the
  proxy guard works.

## Not testable yet (later phases)
- Storefront showing DB products — **Phase 2**
- Google / magic-link sign-in, real admin role gate — **Phase 3**
- Cart, checkout, Paystack — **Phase 4**
- Admin CRUD UI — **Phase 5**

## Re-running DB setup from scratch (reference)
See `supabase/README.md`. Schema was applied over the session pooler with
`scripts/db-apply.mjs`; data via `scripts/seed.mjs`.
