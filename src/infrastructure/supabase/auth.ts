import "server-only";

import { redirect } from "next/navigation";

import type { Profile } from "@/domain/entities/profile";
import { createSupabaseServerClient } from "./server-client";

export interface AuthUser {
  id: string;
  email: string | null;
}

/** The currently signed-in user, or null. Validated against the auth server. */
export async function getCurrentUser(): Promise<AuthUser | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ? { id: user.id, email: user.email ?? null } : null;
}

/** The signed-in user's profile row (includes role), or null. */
export async function getCurrentProfile(): Promise<Profile | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();
  if (!data) return null;

  return {
    id: data.id,
    fullName: data.full_name,
    avatarUrl: data.avatar_url,
    role: data.role,
    createdAt: data.created_at,
  };
}

/** Require a signed-in user; redirect to /login otherwise. */
export async function requireUser(redirectTo = "/account"): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?redirect=${encodeURIComponent(redirectTo)}`);
  return user;
}

/** Require an admin; redirect non-admins. Authoritative admin gate. */
export async function requireAdmin(): Promise<Profile> {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login?redirect=/admin");
  if (profile.role !== "admin") redirect("/");
  return profile;
}
