import Link from "next/link";
import { LogIn, UserPlus } from "lucide-react";

/**
 * Create Account / Sign In, paired.
 *
 * Guests only — once there is a session these disappear and `AccountMenu` takes
 * the space, so the header never offers to create an account for someone who is
 * already signed in.
 *
 * Create Account is the filled gold control and Sign In is the quiet one beside
 * it, because a first-time visitor is the person this pair exists for: someone
 * returning already knows where sign-in lives.
 *
 * These live in the utility bar on desktop rather than the main nav row. That is
 * a measured constraint, not a preference: at 1280 the nav row has 28px of slack
 * and this pair needs about 200, so putting it there would push the action icons
 * off the edge. The top-right of a black header is where the eye goes for
 * account controls anyway.
 */
export function AuthButtons({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex shrink-0 items-center gap-2">
      <Link
        href="/login?intent=signup"
        className={`group inline-flex shrink-0 items-center gap-1.5 rounded-full border border-yellow-500/70 bg-gradient-to-b from-yellow-400/25 to-yellow-600/15 font-semibold uppercase tracking-[0.12em] text-yellow-200 transition-all hover:border-yellow-400 hover:from-yellow-400/35 hover:to-yellow-600/25 hover:text-yellow-100 active:scale-[0.98] ${
          compact
            ? "min-h-[44px] px-4 text-[11px]"
            : "min-h-[32px] px-3.5 text-[10px] lg:min-h-[34px]"
        }`}
      >
        <UserPlus
          aria-hidden
          className={compact ? "h-3.5 w-3.5" : "h-3 w-3"}
          strokeWidth={2.2}
        />
        Create Account
      </Link>

      <Link
        href="/login"
        className={`inline-flex shrink-0 items-center gap-1.5 rounded-full uppercase tracking-[0.12em] text-gray-300 transition-colors hover:text-yellow-400 ${
          compact
            ? "min-h-[44px] px-3 text-[11px] font-medium"
            : "min-h-[32px] px-2.5 text-[10px] lg:min-h-[34px]"
        }`}
      >
        <LogIn
          aria-hidden
          className={compact ? "h-3.5 w-3.5" : "h-3 w-3"}
          strokeWidth={2.2}
        />
        Sign In
      </Link>
    </div>
  );
}
