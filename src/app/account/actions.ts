"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { getCurrentUser } from "@/infrastructure/auth/session";
import { eq } from "drizzle-orm";

import { auth } from "@/infrastructure/auth/auth";
import { db } from "@/infrastructure/db/client";
import { profiles } from "@/infrastructure/db/schema";
import { profileSchema } from "@/lib/validation";

/** Sign the current user out and return to the home page. */
export async function signOut() {
  // Better Auth revokes the session row and clears the cookie. Unlike the
  // Supabase JWT it replaces, the session is server-side state, so signing out
  // genuinely invalidates it rather than only discarding the browser's copy.
  await auth.api.signOut({ headers: await headers() });
  redirect("/");
}

export interface ProfileResult {
  ok: boolean;
  error?: string;
}

/** Update the signed-in user's name + saved delivery address. */
export async function updateProfile(payload: unknown): Promise<ProfileResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Please sign in." };

  const parsed = profileSchema.safeParse(payload);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid details." };
  }
  const p = parsed.data;

  try {
    // Scoped to the signed-in user's own id — never a value from the payload.
    // The old RLS policy (`profiles_update_self_or_admin`) is what used to make
    // that true; here it is the WHERE clause.
    await db
      .update(profiles)
      .set({
        fullName: p.fullName ?? null,
        phone: p.phone ?? null,
        address: p.address ?? null,
        city: p.city ?? null,
        state: p.state ?? null,
        country: p.country ?? null,
        lat: p.lat ?? null,
        lng: p.lng ?? null,
      })
      .where(eq(profiles.id, user.id));
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }

  revalidatePath("/account");
  return { ok: true };
}
