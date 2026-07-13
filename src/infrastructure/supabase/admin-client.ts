import "server-only";

import { createClient } from "@supabase/supabase-js";

import { serverEnv } from "@/config/server-env";
import type { Database } from "./database.types";

/**
 * Privileged Supabase client using the SECRET key. Bypasses Row Level
 * Security, so it must ONLY be used from trusted server code (admin Server
 * Actions after an authorization check, the Paystack webhook, seed scripts).
 *
 * Never import this into a Client Component — `server-only` makes that a build
 * error. Never expose its results to an unauthenticated caller.
 *
 * No session persistence: this client is not tied to any user.
 */
export function createSupabaseAdminClient() {
  return createClient<Database>(
    serverEnv.supabaseUrl,
    serverEnv.supabaseSecretKey,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );
}
