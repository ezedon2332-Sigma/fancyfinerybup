import type { Metadata } from "next";

import { requireAdmin } from "@/infrastructure/auth/session";
import {
  listAdminInvites,
  listAdmins,
} from "@/infrastructure/db/admin-invite-service";
import { TeamPanel } from "@/components/admin/TeamPanel";

export const metadata: Metadata = { title: "Admin · Team" };

// Invites change state as they are sent, accepted and revoked; never cache.
export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const me = await requireAdmin();
  const [admins, invites] = await Promise.all([listAdmins(), listAdminInvites()]);

  return (
    <div>
      <header className="mb-6">
        <p className="text-xs uppercase tracking-[4px] text-yellow-500">Access</p>
        <h1 className="mt-1 text-2xl font-bold">Team</h1>
        <p className="mt-2 max-w-2xl text-sm text-gray-400">
          Admin accounts are issued by invitation only — there is no way to sign
          up for one. An invitation is a single-use link that expires after seven
          days and can be revoked before it is used.
        </p>
      </header>

      <TeamPanel
        admins={admins.map((a) => ({
          id: a.id,
          name: a.name,
          email: a.email,
          isSelf: a.id === me.id,
        }))}
        invites={invites.map((i) => ({
          id: i.id,
          email: i.email,
          status: i.status,
          invitedByName: i.invitedByName,
          expiresAt: i.expiresAt.toISOString(),
        }))}
      />
    </div>
  );
}
