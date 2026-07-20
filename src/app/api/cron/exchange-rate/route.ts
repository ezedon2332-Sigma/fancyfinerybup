import { NextResponse } from "next/server";

import { refreshExchangeRate } from "@/infrastructure/exchange-rate/service";

export const dynamic = "force-dynamic";

/**
 * Hourly live-rate refresh (Vercel Cron → see vercel.json).
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
  const result = await refreshExchangeRate();
  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}
