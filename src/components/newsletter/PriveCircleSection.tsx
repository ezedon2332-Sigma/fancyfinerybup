import {
  BookOpen,
  CalendarHeart,
  Compass,
  Crown,
  Gem,
  Gift,
  Mail,
  Sparkles,
  Tag,
  Timer,
} from "lucide-react";

import { PriveCircleForm } from "./PriveCircleForm";

/** The ten privileges of membership. Icons carry no meaning on their own, so
 *  they stay decorative and the label does the talking. */
const BENEFITS = [
  { icon: Timer, label: "Early access to new collections" },
  { icon: Tag, label: "Members-only offers" },
  { icon: Sparkles, label: "Exclusive product launches" },
  { icon: Gift, label: "Birthday rewards" },
  { icon: Crown, label: "VIP invitations" },
  { icon: BookOpen, label: "Fashion editorials" },
  { icon: Gem, label: "Designer stories" },
  { icon: Compass, label: "Luxury style inspiration" },
  { icon: CalendarHeart, label: "Seasonal trend reports" },
  { icon: Mail, label: "Private shopping experiences" },
] as const;

export function PriveCircleSection() {
  return (
    <section
      id="prive-circle"
      className="relative overflow-hidden border-y border-yellow-600/20 bg-[#0a0a0a] py-20 lg:py-28"
    >
      {/* Ambient gold light — decorative only */}
      <div
        aria-hidden
        className="pointer-events-none absolute -left-40 top-0 h-[520px] w-[520px] rounded-full bg-[radial-gradient(circle,rgba(212,175,55,0.13),transparent_68%)] blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-40 bottom-0 h-[520px] w-[520px] rounded-full bg-[radial-gradient(circle,rgba(212,175,55,0.10),transparent_68%)] blur-3xl"
      />

      <div className="relative mx-auto max-w-7xl px-6 lg:px-10">
        <header className="animate-fade-up mx-auto max-w-3xl text-center">
          <p className="inline-flex items-center gap-2 rounded-full border border-yellow-600/40 px-4 py-1.5 text-[10px] uppercase tracking-[0.3em] text-yellow-500">
            <Crown className="h-3 w-3" /> Privé Circle
          </p>
          <h2 className="brand-wordmark mt-7 text-3xl leading-tight tracking-[0.04em] sm:text-4xl lg:text-5xl">
            Experience Exclusive Luxury
          </h2>
          <p className="mx-auto mt-6 max-w-2xl text-sm leading-relaxed text-gray-300 sm:text-base sm:leading-loose">
            Become part of the Fancy Finery Privé Circle and enjoy exclusive
            access to new collections, private sales, luxury fashion insights,
            VIP invitations, personalized offers, and timeless elegance curated
            for our most valued members.
          </p>
        </header>

        <div className="mt-16 grid gap-10 lg:grid-cols-[1fr_1.05fr] lg:gap-14">
          {/* Benefits */}
          <div
            className="animate-fade-up"
            style={{ animationDelay: "0.12s" }}
          >
            <h3 className="text-[10px] uppercase tracking-[0.3em] text-yellow-500">
              Member Privileges
            </h3>
            <ul className="mt-7 grid gap-3 sm:grid-cols-2">
              {BENEFITS.map(({ icon: Icon, label }) => (
                <li
                  key={label}
                  className="group flex items-center gap-3 rounded-xl border border-white/8 bg-white/[0.025] px-4 py-3.5 backdrop-blur-sm transition-all duration-500 hover:-translate-y-0.5 hover:border-yellow-600/50 hover:bg-white/[0.05] hover:shadow-[0_12px_30px_-18px_rgba(212,175,55,0.7)]"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-yellow-600/30 bg-gradient-to-br from-yellow-500/15 to-transparent transition-colors duration-500 group-hover:border-yellow-500/70">
                    <Icon className="h-4 w-4 text-yellow-500" strokeWidth={1.5} />
                  </span>
                  <span className="text-sm leading-snug text-gray-200">{label}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Join card */}
          <div
            className="animate-fade-up rounded-2xl border border-yellow-600/25 bg-white/[0.035] p-6 shadow-[0_30px_80px_-40px_rgba(0,0,0,0.9)] backdrop-blur-xl sm:p-9"
            style={{ animationDelay: "0.22s" }}
          >
            <h3 className="font-display text-2xl text-white">
              Request your invitation
            </h3>
            <p className="mt-2 text-xs leading-relaxed text-gray-400">
              Membership is complimentary. Tell us what you love and we will
              curate accordingly.
            </p>
            <div className="mt-7">
              <PriveCircleForm source="homepage" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
