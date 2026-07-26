import { Crown, MailCheck, TrendingUp, UserMinus } from "lucide-react";

import {
  listCampaigns,
  listSubscribers,
  newsletterStats,
} from "@/infrastructure/supabase/newsletter-service";
import { activeProvider } from "@/infrastructure/notifications/email-provider";
import { interestLabel } from "@/domain/newsletter";
import { SubscribersPanel } from "@/components/admin/SubscribersPanel";
import { CampaignsPanel } from "@/components/admin/CampaignsPanel";

export const metadata = { title: "Newsletter" };

/** Privé Circle control room: membership, campaigns and engagement. */
export default async function AdminNewsletterPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; interest?: string }>;
}) {
  const { q, status, interest } = await searchParams;

  const [subscribers, stats, campaigns] = await Promise.all([
    listSubscribers({ search: q, status, interest }),
    newsletterStats(),
    listCampaigns(),
  ]);

  const provider = activeProvider();

  return (
    <div>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[4px] text-yellow-500">
            Privé Circle
          </p>
          <h1 className="mt-2 font-display text-3xl text-white">Newsletter</h1>
        </div>
        <span
          className={`rounded-full border px-3 py-1.5 text-[11px] ${
            provider === "none"
              ? "border-amber-500/40 bg-amber-500/10 text-amber-300"
              : "border-green-500/40 bg-green-500/10 text-green-300"
          }`}
        >
          {provider === "none"
            ? "No email provider configured — sends are logged, not delivered"
            : `Delivering via ${provider}`}
        </span>
      </header>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={<Crown className="h-4 w-4" />} label="Total members" value={stats.total} />
        <Stat
          icon={<MailCheck className="h-4 w-4" />}
          label="Active"
          value={stats.subscribed}
        />
        <Stat
          icon={<UserMinus className="h-4 w-4" />}
          label="Unsubscribed"
          value={stats.unsubscribed}
        />
        <Stat
          icon={<TrendingUp className="h-4 w-4" />}
          label="Joined (30 days)"
          value={stats.last30Days}
        />
      </div>

      {stats.byInterest.length > 0 && (
        <section className="mt-6 rounded-xl border border-white/10 bg-white/[0.02] p-5">
          <h2 className="text-[11px] uppercase tracking-widest text-gray-400">
            Interests
          </h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {stats.byInterest.map((i) => (
              <span
                key={i.interest}
                className="rounded-full border border-yellow-600/30 px-3 py-1.5 text-xs text-gray-200"
              >
                {interestLabel(i.interest)}
                <span className="ml-2 font-semibold text-yellow-400">{i.count}</span>
              </span>
            ))}
          </div>
        </section>
      )}

      <div className="mt-10">
        <SubscribersPanel
          subscribers={subscribers}
          filters={{ q: q ?? "", status: status ?? "", interest: interest ?? "" }}
        />
      </div>

      <div className="mt-12">
        <CampaignsPanel campaigns={campaigns} />
      </div>
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
      <div className="flex items-center gap-2 text-yellow-500">{icon}</div>
      <p className="mt-3 text-2xl font-semibold text-white">
        {value.toLocaleString()}
      </p>
      <p className="mt-1 text-[11px] uppercase tracking-widest text-gray-500">
        {label}
      </p>
    </div>
  );
}
