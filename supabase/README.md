# Supabase — database for Fancy Finery

Phase 1 schema lives in `migrations/` (versioned, ordered) with sample data in
`seed.sql`. A concatenated `apply_all.sql` is generated for convenience.

## What's here

| File | Purpose |
|---|---|
| `migrations/20260712000001_init_schema.sql` | Enums, tables, indexes, `updated_at` trigger |
| `migrations/20260712000002_rls_policies.sql` | RLS + `is_admin()` + role-escalation guard |
| `migrations/20260712000003_profiles_trigger.sql` | Auto-create a `profiles` row on signup |
| `migrations/20260712000004_storage.sql` | `product-images` bucket + storage policies |
| `seed.sql` | Categories, sample products, images, variants |
| `apply_all.sql` | All of the above concatenated (paste-and-run) |

Money is stored as **integer minor units (kobo)**.

## Applying the schema

Pick ONE path. The REST API keys in `.env` **cannot** run DDL, so applying
needs one of:

### Option A — SQL Editor (no tooling, fastest)
1. Open the [Supabase SQL Editor](https://supabase.com/dashboard/project/_/sql).
2. Paste the contents of `apply_all.sql` and **Run**.
3. Locally: `node scripts/db-check.mjs` → expect all tables ✓.

### Option B — Supabase CLI (recommended for ongoing work)
```bash
npm i -g supabase           # or: npx supabase ...
supabase login              # opens browser for an access token
supabase link --project-ref ficgdouwcbqncdkhpurt   # asks for DB password
supabase db push            # applies migrations/
supabase db execute -f supabase/seed.sql            # load seed data
```
This keeps the repo migrations as the source of truth and versions future
changes.

## Verifying
```bash
node scripts/db-check.mjs
```
Lists each Phase 1 table as present (with row count) or missing.

## Making an admin
No admin self-signup. After a user signs in once (Phase 3), promote them:
```sql
update public.profiles set role = 'admin'
where id = (select id from auth.users where email = 'you@example.com');
```

## Note: legacy `Products` table
The project already contained a capitalised `Products` table (2 rows) from an
earlier experiment, with images in a `Products` storage bucket. It is a
different table from the normalized `products` used here and is **not** touched
by these migrations. Decide whether to migrate those rows into the new schema
and drop the old table — see the team before dropping.
