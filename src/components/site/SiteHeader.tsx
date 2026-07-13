import { getCurrentUser } from "@/infrastructure/supabase/auth";
import { Navbar } from "./Navbar";

/** Server wrapper: resolves auth state, then renders the interactive navbar. */
export async function SiteHeader() {
  const user = await getCurrentUser();
  return <Navbar user={user ? { email: user.email } : null} />;
}
