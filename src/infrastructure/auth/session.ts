import "server-only";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";

import type { Profile } from "@/domain/entities/profile";
import { db } from "@/infrastructure/db/client";
import { profiles } from "@/infrastructure/db/schema";
import { toProfile } from "@/infrastructure/db/mappers";
import { auth } from "./auth";

/**
 * Session and authorization helpers.
 *
 * This module keeps the EXACT exported signatures the Supabase version had
 * (`getCurrentUser`, `getCurrentProfile`, `requireUser`, `requireAdmin`) and
 * returns the same domain types. Only the bodies changed, which is why dozens
 * of call sites across the app were untouched by the auth swap — the old file
 * was already a correctly-shaped seam that hid the provider behind domain
 * types. This is the payoff for that.
 *
 * `requireAdmin` remains THE authoritative gate. proxy.ts does a cheap
 * signed-in check for UX, and is explicitly not the security boundary
 * (see AGENTS.md).
 */

export interface AuthUser {
  id: string;
  email: string | null;
}

/** The currently signed-in user, or null. */
export async function getCurrentUser(): Promise<AuthUser | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return null;
  return { id: session.user.id, email: session.user.email ?? null };
}

/** The signed-in user's profile row (includes role), or null. */
export async function getCurrentProfile(): Promise<Profile | null> {
  const user = await getCurrentUser();
  if (!user) return null;

  const row = await db.query.profiles.findFirst({
    where: eq(profiles.id, user.id),
  });
  return row ? toProfile(row) : null;
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
  // Staff get the staff door, not the storefront one. Signed in but not an
  // admin also lands there, where the form explains why rather than silently
  // bouncing them to the home page as if nothing happened.
  if (!profile) redirect("/admin/login?redirect=/admin");
  if (profile.role !== "admin") redirect("/admin/login?redirect=/admin");
  return profile;
}
