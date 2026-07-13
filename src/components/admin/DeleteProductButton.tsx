"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2, Trash2 } from "lucide-react";

import { deleteProduct } from "@/app/admin/products/actions";

export function DeleteProductButton({
  id,
  name,
  redirectTo,
}: {
  id: string;
  name: string;
  redirectTo?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onDelete() {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    setBusy(true);
    const res = await deleteProduct(id);
    if (res.ok) {
      if (redirectTo) router.push(redirectTo);
      router.refresh();
    } else {
      setBusy(false);
      alert(res.error ?? "Could not delete.");
    }
  }

  return (
    <button
      type="button"
      onClick={onDelete}
      disabled={busy}
      className="inline-flex items-center gap-1 text-sm text-gray-400 transition-colors hover:text-red-400 disabled:opacity-50"
      aria-label={`Delete ${name}`}
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
    </button>
  );
}
