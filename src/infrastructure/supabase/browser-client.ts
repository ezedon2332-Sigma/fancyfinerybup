"use client";

import { createBrowserClient } from "@supabase/ssr";

import { publicEnv } from "@/config/env";
import type { Database } from "./database.types";

/**
 * Supabase client for Client Components (auth UI, realtime, session listeners).
 * Uses the browser-safe publishable key; Row Level Security is enforced.
 *
 * `createBrowserClient` is a singleton under the hood, so calling this per
 * component is fine.
 */
export function createSupabaseBrowserClient() {
  return createBrowserClient<Database>(
    publicEnv.supabaseUrl,
    publicEnv.supabasePublishableKey,
  );
}
