"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2, ShieldCheck, ShieldOff } from "lucide-react";

import { updateCustomerRole } from "@/app/admin/customers/actions";

export function RoleToggle({
  userId,
  role,
  isSelf,
}: {
  userId: string;
  role: "customer" | "admin";
  isSelf: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const makeAdmin = role !== "admin";
  const disabled = busy || (isSelf && role === "admin"); // no self-demote

  async function onClick() {
    const next = makeAdmin ? "admin" : "customer";
    if (!makeAdmin && !confirm("Revoke admin access for this user?")) return;
    setBusy(true);
    const res = await updateCustomerRole(userId, next);
    setBusy(false);
    if (res.ok) router.refresh();
    else alert(res.error ?? "Could not update role.");
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={isSelf && role === "admin" ? "You can't remove your own admin access" : undefined}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-40 ${
        makeAdmin
          ? "border-yellow-500/40 text-yellow-400 hover:bg-yellow-500/10"
          : "border-red-500/40 text-red-400 hover:bg-red-500/10"
      }`}
    >
      {busy ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : makeAdmin ? (
        <ShieldCheck className="h-3.5 w-3.5" />
      ) : (
        <ShieldOff className="h-3.5 w-3.5" />
      )}
      {makeAdmin ? "Make admin" : "Revoke admin"}
    </button>
  );
}
