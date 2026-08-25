import Link from "next/link";
import type { Metadata } from "next";

import { requireAdmin } from "@/infrastructure/auth/session";
import { loadConversations } from "@/infrastructure/db/admin-read-service";

export const metadata: Metadata = { title: "Admin · AI Conversations" };

const STATUS_BADGE: Record<string, string> = {
  bot: "bg-white/10 text-gray-300",
  awaiting_human: "bg-yellow-500/15 text-yellow-400",
  human: "bg-green-500/15 text-green-400",
  closed: "bg-neutral-700/30 text-gray-500",
};

const STATUS_LABEL: Record<string, string> = {
  bot: "Bot",
  awaiting_human: "Needs human",
  human: "With team",
  closed: "Closed",
};

export default async function AdminConversationsPage() {
  await requireAdmin();
  const rows = await loadConversations(100);

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">AI Conversations</h1>
          <p className="mt-1 text-sm text-gray-400">
            Every concierge chat. Ones marked “Needs human” are awaiting a reply.
          </p>
        </div>
        <Link href="/admin/ai" className="text-sm text-gray-400 hover:text-yellow-400">
          ← AI settings
        </Link>
      </div>

      {rows.length === 0 ? (
        <p className="mt-10 text-gray-400">No conversations yet.</p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-2xl border border-white/10">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="bg-white/5 text-left text-xs uppercase tracking-widest text-gray-400">
              <tr>
                <th className="px-4 py-3">Conversation</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Last activity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {rows.map((c) => (
                <tr key={c.id} className="hover:bg-white/5">
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/ai/conversations/${c.id}`}
                      className="font-medium text-white hover:text-yellow-400"
                    >
                      #{c.id.slice(0, 8)}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-300">
                    {c.contact_email ?? "Guest"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_BADGE[c.status] ?? STATUS_BADGE.bot}`}
                    >
                      {STATUS_LABEL[c.status] ?? c.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-400">
                    {new Date(c.last_message_at).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
