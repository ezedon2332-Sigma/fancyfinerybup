"use client";

import { useState, useTransition } from "react";

import { inviteAdmin, revokeInvite } from "@/app/admin/team/actions";
import { toastResult } from "@/components/ui/Toast";

const FIELD =
  "w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-yellow-500";

export interface TeamAdmin {
  id: string;
  name: string | null;
  email: string | null;
  isSelf: boolean;
}

export interface TeamInvite {
  id: string;
  email: string;
  status: "pending" | "accepted" | "revoked" | "expired";
  invitedByName: string | null;
  expiresAt: string;
}

const STATUS_STYLE: Record<TeamInvite["status"], string> = {
  pending: "bg-yellow-500/15 text-yellow-400",
  accepted: "bg-green-500/15 text-green-400",
  revoked: "bg-white/10 text-gray-400",
  expired: "bg-white/10 text-gray-500",
};

export function TeamPanel({
  admins,
  invites,
}: {
  admins: TeamAdmin[];
  invites: TeamInvite[];
}) {
  const [email, setEmail] = useState("");
  const [pending, start] = useTransition();

  function send(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      const res = await inviteAdmin({ email });
      if (toastResult(res, { success: "Invitation sent." })) setEmail("");
    });
  }

  function revoke(id: string) {
    start(async () => {
      const res = await revokeInvite(id);
      toastResult(res, { success: "Invitation revoked." });
    });
  }

  return (
    <div className="max-w-3xl space-y-8">
      <section className="rounded-2xl border border-white/10 bg-neutral-950/60 p-5">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-gray-300">
          Invite an admin
        </h2>
        <p className="mt-1 text-xs text-gray-500">
          They receive a single-use link. It expires in seven days, and the
          account becomes an admin the moment they complete sign-up.
        </p>

        <form onSubmit={send} className="mt-4 flex flex-wrap gap-3">
          <input
            className={`${FIELD} flex-1 min-w-56`}
            type="email"
            required
            placeholder="colleague@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <button
            type="submit"
            disabled={pending}
            className="rounded-full bg-yellow-500 px-5 py-2 text-sm font-semibold text-black transition-colors hover:bg-yellow-400 disabled:opacity-50"
          >
            {pending ? "Sending…" : "Send invitation"}
          </button>
        </form>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-gray-300">
          Admins ({admins.length})
        </h2>
        <ul className="divide-y divide-white/8 rounded-2xl border border-white/10 bg-neutral-950/60">
          {admins.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-3 px-5 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm text-gray-100">
                  {a.name ?? a.email ?? "Unnamed"}
                  {a.isSelf && (
                    <span className="ml-2 text-xs text-gray-500">(you)</span>
                  )}
                </p>
                {a.email && (
                  <p className="truncate text-xs text-gray-500">{a.email}</p>
                )}
              </div>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-gray-600">
          Admin access is removed from Customers → the person&apos;s record, so
          the change sits with the audit trail for that account.
        </p>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-gray-300">
          Invitations
        </h2>
        {invites.length === 0 ? (
          <p className="rounded-2xl border border-white/10 bg-neutral-950/60 px-5 py-6 text-sm text-gray-500">
            No invitations yet.
          </p>
        ) : (
          <ul className="divide-y divide-white/8 rounded-2xl border border-white/10 bg-neutral-950/60">
            {invites.map((i) => (
              <li
                key={i.id}
                className="flex flex-wrap items-center justify-between gap-3 px-5 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm text-gray-100">{i.email}</p>
                  <p className="truncate text-xs text-gray-500">
                    {i.invitedByName ? `Invited by ${i.invitedByName}` : "Invited"}
                    {i.status === "pending" &&
                      ` · expires ${new Date(i.expiresAt).toDateString()}`}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wide ${STATUS_STYLE[i.status]}`}
                  >
                    {i.status}
                  </span>
                  {i.status === "pending" && (
                    <button
                      type="button"
                      onClick={() => revoke(i.id)}
                      disabled={pending}
                      className="text-xs text-gray-400 underline transition-colors hover:text-red-400 disabled:opacity-50"
                    >
                      Revoke
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
