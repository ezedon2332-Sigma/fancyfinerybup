import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { serverEnv } from "@/config/server-env";
import type { Database } from "./database.types";

/**
 * Supabase client for Server Components, Server Actions, and Route Handlers.
 * Reads/writes the session from Next.js cookies and enforces Row Level
 * Security via the publishable key — every query runs as the signed-in user
 * (or anonymously).
 *
 * `cookies()` is async in Next.js 16, so this helper is async too.
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    serverEnv.supabaseUrl,
    serverEnv.supabasePublishableKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // `setAll` was called from a Server Component, where mutating
            // cookies is disallowed. Safe to ignore: proxy.ts refreshes the
            // session cookie on every request.
          }
        },
      },
    },
  );
}
