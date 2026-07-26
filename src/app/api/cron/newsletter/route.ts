import { NextResponse } from "next/server";

import {
  runBirthdayEmails,
  runDueCampaigns,
} from "@/infrastructure/supabase/newsletter-service";

export const dynamic = "force-dynamic";
// Campaign sends are sequential; give them room before the platform cuts in.
export const maxDuration = 300;

/**
 * Daily newsletter automation (Vercel Cron → see vercel.json).
 *
 * Two jobs, both idempotent so a retry or a double-fire is harmless:
 *   1. Dispatch any campaign whose scheduled time has passed.
 *   2. Wish a happy birthday to members whose birthday is today (UTC),
 *      skipping anyone already wished within the year.
 *
 * If CRON_SECRET is set, requires `Authorization: Bearer <CRON_SECRET>`
 * (Vercel sends this automatically for scheduled invocations).
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return new NextResponse("Unauthorized", { status: 401 });
    }
  }

  // One job failing must not stop the other.
  const [campaigns, birthdays] = await Promise.allSettled([
    runDueCampaigns(),
    runBirthdayEmails(),
  ]);

  const body = {
    ok: campaigns.status === "fulfilled" && birthdays.status === "fulfilled",
    campaigns:
      campaigns.status === "fulfilled"
        ? campaigns.value
        : { error: String(campaigns.reason) },
    birthdays:
      birthdays.status === "fulfilled"
        ? birthdays.value
        : { error: String(birthdays.reason) },
  };

  if (!body.ok) console.error("[cron:newsletter] partial failure", body);
  return NextResponse.json(body, { status: body.ok ? 200 : 500 });
}
