import { getCurrentProfile, requireAdmin } from "@/infrastructure/supabase/auth";
import { AdminShell } from "@/components/admin/AdminShell";

/**
 * Authoritative admin gate.
 *
 * The proxy does an optimistic signed-in check; this is where the ROLE is
 * actually enforced, server-side, on every request. That has to stay in the
 * layout rather than move into the shell — the shell is a client component and
 * anything it checked would be advisory only.
 *
 * Navigation, search and responsive behaviour all live in AdminShell, so a new
 * admin page inherits them by existing.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdmin();
  const profile = await getCurrentProfile();

  return (
    <AdminShell who={profile?.fullName ?? null}>{children}</AdminShell>
  );
}
