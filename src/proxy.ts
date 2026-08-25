import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Proxy (Next.js 16's renamed Middleware). Runs before every matched request.
 *
 * Responsibilities — OPTIMISTIC ONLY:
 *   cheap redirect of signed-out users away from /admin, /account, /checkout
 *   and /reset-password.
 *
 * This is NOT the security boundary. Authoritative authorization (including the
 * admin role check) happens in the /admin layout and in every Server Action —
 * see AGENTS.md / docs/PROJECT_PLAN.md.
 *
 * Two things got simpler when Supabase left:
 *
 *  - **No session refresh.** The old proxy constructed a Supabase SSR client on
 *    every request and called `getClaims()` to validate and re-issue the JWT,
 *    writing refreshed cookies onto the response and hand-copying them onto any
 *    redirect. Better Auth sessions are server-side rows keyed by an opaque
 *    cookie; there is no token to refresh here, so all of that is gone.
 *
 *  - **No database call.** `getSessionCookie` only checks that a signed session
 *    cookie is present. It deliberately does NOT validate the session against
 *    the database — that would put a query on every navigation, and Next's own
 *    docs warn against using Proxy for session management. A forged or expired
 *    cookie gets past this and is then rejected by `requireUser`/`requireAdmin`,
 *    which is exactly the intended division of labour.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // /admin/login is the staff sign-in page itself — gating it would redirect
  // it to itself.
  if (pathname.startsWith("/admin/login")) return NextResponse.next();

  const isProtected =
    pathname.startsWith("/admin") ||
    pathname.startsWith("/account") ||
    pathname.startsWith("/checkout") ||
    pathname.startsWith("/reset-password");

  if (!isProtected) return NextResponse.next();

  // Must match `advanced.cookiePrefix` in src/infrastructure/auth/auth.ts.
  const sessionCookie = getSessionCookie(request, { cookiePrefix: "fancy" });

  if (!sessionCookie) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = pathname.startsWith("/admin")
      ? "/admin/login"
      : "/login";
    redirectUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  return NextResponse.next();
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
