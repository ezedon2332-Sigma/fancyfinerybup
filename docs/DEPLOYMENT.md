# Deployment & configuration

The app deploys to **Vercel** (from the GitHub repo) and uses **Supabase**.
Pushing to `main` triggers a Vercel build. **The build validates env vars at
build time and will FAIL if they're missing** (`src/config/*env.ts`), so set
them on Vercel before/with the first Phase 2+ deploy.

## 1. Vercel environment variables (required)

Vercel → Project → **Settings → Environment Variables**. Add each for
**Production, Preview, and Development**. Copy the values from your local
`.env` (never commit them):

| Variable | Notes |
|---|---|
| `SUPABASE_URL` | Project URL |
| `SUPABASE_PUBLISHABLE_KEY` | Browser-safe key |
| `SUPABASE_SECRET_KEY` | **Server-only** — bypasses RLS. Do not prefix with `NEXT_PUBLIC_`. |
| `SUPABASE_JWKS_URL` | For JWT verification |
| `NEXT_PUBLIC_SUPABASE_URL` | Same value as `SUPABASE_URL` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Same value as `SUPABASE_PUBLISHABLE_KEY` |

After adding them, redeploy (Deployments → ⋯ → Redeploy) so the build picks
them up.

> CLI alternative (if you install it): `vercel link` then
> `vercel env add NEXT_PUBLIC_SUPABASE_URL production` (repeat per var), then
> `vercel --prod`.

## 2. Supabase Auth configuration (Phase 3)

Supabase Dashboard → **Authentication → URL Configuration**:
- **Site URL**: your production URL, e.g. `https://<app>.vercel.app`
- **Redirect URLs** (allow-list — add all):
  - `http://localhost:3000/**`
  - `https://<app>.vercel.app/**`
  - any preview domains you use

Magic-link sign-in works out of the box once redirect URLs are allowed.

### Google sign-in (optional but wired up)
Authentication → **Providers → Google** → enable, then:
1. In Google Cloud Console create an OAuth 2.0 Client (Web).
2. Authorized redirect URI: `https://<project-ref>.supabase.co/auth/v1/callback`.
3. Paste the Client ID + Secret into Supabase.

Until Google is configured, the "Continue with Google" button will return a
provider error — magic link still works.

## 3. Make yourself an admin
After signing in once:
```sql
update public.profiles set role = 'admin'
where id = (select id from auth.users where email = 'you@example.com');
```
Then `/admin` becomes reachable (the layout enforces the role server-side).

## 4. Security note
The database password was shared in chat during setup; consider **rotating**
it in Supabase → Settings → Database. App runtime does not need the DB password
(it uses the API keys), so rotating won't affect the deployment.
