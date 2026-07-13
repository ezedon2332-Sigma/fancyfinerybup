import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";

import { createSupabaseServerClient } from "@/infrastructure/supabase/server-client";

/**
 * Auth callback — exchanges the credential returned by Supabase for a session
 * cookie, then redirects. Handles both flows:
 *   - OAuth / PKCE:   ?code=...
 *   - Email link:     ?token_hash=...&type=...
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const next = safeNext(searchParams.get("next"));
  const supabase = await createSupabaseServerClient();

  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  let ok = false;
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    ok = !error;
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });
    ok = !error;
  }

  if (ok) return NextResponse.redirect(`${origin}${next}`);
  return NextResponse.redirect(`${origin}/login?error=auth`);
}

/** Only allow internal relative redirects. */
function safeNext(next: string | null): string {
  if (next && next.startsWith("/") && !next.startsWith("//")) return next;
  return "/account";
}
