import { NextResponse } from "next/server";

import {
  runBirthdayEmails,
  runDueCampaigns,
} from "@/infrastructure/db/newsletter-service";

export const dynamic = "force-dynamic";
// Campaign sends are sequential; give them room before the platform cuts in.
export const maxDuration = 300;

/**
 * Daily newsletter automation. Fired by the `ofelia` container in
 * docker-compose, which sends the CRON_SECRET bearer token.
 *
 * Two jobs, both idempotent so a retry or a double-fire is harmless:
 *   1. Dispatch any campaign whose scheduled time has passed.
 *   2. Wish a happy birthday to members whose birthday is today (UTC),
 *      skipping anyone already wished within the year.
 *
 * If CRON_SECRET is set, requires `Authorization: Bearer <CRON_SECRET>`
 * (the ofelia scheduler sends it on each run).
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

  const ok =
    campaigns.status === "fulfilled" && birthdays.status === "fulfilled";
  const body = {
    ok,
    // Never return raw error strings (they can carry internal detail); the real
    // reasons are logged server-side below.
    campaigns:
      campaigns.status === "fulfilled" ? campaigns.value : { error: "failed" },
    birthdays:
      birthdays.status === "fulfilled" ? birthdays.value : { error: "failed" },
  };

  if (!ok) {
    console.error("[cron:newsletter] partial failure", {
      campaigns: campaigns.status === "rejected" ? campaigns.reason : "ok",
      birthdays: birthdays.status === "rejected" ? birthdays.reason : "ok",
    });
  }
  return NextResponse.json(body, { status: ok ? 200 : 500 });
}
