import {
  getCurrentProfile,
  getCurrentUser,
} from "@/infrastructure/supabase/auth";
import { Navbar } from "./Navbar";

/** Server wrapper: resolves auth state (+ first name), then renders the navbar. */
export async function SiteHeader() {
  const user = await getCurrentUser();
  const profile = user ? await getCurrentProfile() : null;
  const firstName = profile?.fullName?.trim()?.split(" ")[0] ?? null;
  return <Navbar user={user ? { email: user.email, firstName } : null} />;
}
