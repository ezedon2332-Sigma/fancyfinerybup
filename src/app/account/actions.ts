"use server";

import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/infrastructure/supabase/server-client";

/** Sign the current user out and return to the home page. */
export async function signOut() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/");
}
