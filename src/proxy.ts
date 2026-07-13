import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import type { Database } from "@/infrastructure/supabase/database.types";

/**
 * Proxy (Next.js 16's renamed Middleware). Runs before every matched request.
 *
 * Responsibilities — OPTIMISTIC ONLY:
 *  1. Refresh the Supabase auth session cookie so Server Components see a
 *     current session.
 *  2. Cheap redirect of signed-out users away from /admin and /account.
 *
 * This is NOT the security boundary. Authoritative authorization (including
 * the admin role check) happens in the /admin layout and in every Server
 * Action — see AGENTS.md / docs/PROJECT_PLAN.md.
 *
 * We read env directly here (not via the config module) because Proxy runs in
 * an isolated edge-style context that shouldn't share app modules.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // Touch the session: validates the JWT (locally via JWKS when possible) and
  // refreshes it if expired, writing fresh cookies through setAll above.
  const { data } = await supabase.auth.getClaims();
  const isSignedIn = Boolean(data?.claims);

  const { pathname } = request.nextUrl;
  const isProtected =
    pathname.startsWith("/admin") ||
    pathname.startsWith("/account") ||
    pathname.startsWith("/checkout");

  if (isProtected && !isSignedIn) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.searchParams.set("redirect", pathname);
    const redirect = NextResponse.redirect(redirectUrl);
    // Carry over any refreshed auth cookies onto the redirect response.
    for (const cookie of response.cookies.getAll()) {
      redirect.cookies.set(cookie);
    }
    return redirect;
  }

  return response;
}

export const config = {
  /**
   * Run on all paths EXCEPT Next internals and static assets. Without this,
   * Proxy would run on every CSS/JS/image request too.
   */
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
