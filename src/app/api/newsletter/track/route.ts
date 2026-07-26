import { NextResponse, type NextRequest } from "next/server";

import {
  hashIp,
  recordCampaignEvent,
} from "@/infrastructure/supabase/newsletter-service";

/**
 * Campaign engagement tracking.
 *
 *   GET /api/newsletter/track?c=<campaign>&s=<subscriber>&e=open
 *     → returns a 1x1 transparent GIF (the tracking pixel)
 *
 *   GET /api/newsletter/track?c=<campaign>&s=<subscriber>&e=click&u=<url>
 *     → records the click, then redirects to the destination
 *
 * Recording is best-effort: a tracking failure must never stop the pixel
 * rendering or the reader reaching the page they clicked.
 */

// 1x1 transparent GIF.
const PIXEL = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64",
);

function pixelResponse(): NextResponse {
  return new NextResponse(new Uint8Array(PIXEL), {
    status: 200,
    headers: {
      "Content-Type": "image/gif",
      "Content-Length": String(PIXEL.byteLength),
      "Cache-Control": "no-store, no-cache, must-revalidate, private",
      Pragma: "no-cache",
    },
  });
}

/** Only same-origin destinations are followed — an open redirect here would
 *  let anyone borrow the store's domain for phishing. */
function safeRedirect(raw: string | null, origin: string): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw, origin);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    if (url.origin !== origin) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const p = req.nextUrl.searchParams;
  const campaignId = p.get("c");
  const subscriberId = p.get("s");
  const kind = p.get("e") === "click" ? "clicked" : "opened";
  const destination = safeRedirect(p.get("u"), req.nextUrl.origin);

  if (campaignId) {
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      req.headers.get("x-real-ip");
    await recordCampaignEvent({
      campaignId,
      subscriberId,
      event: kind,
      url: destination,
      userAgent: req.headers.get("user-agent"),
      ipHash: hashIp(ip),
    });
  }

  if (kind === "clicked") {
    return NextResponse.redirect(destination ?? req.nextUrl.origin, 302);
  }
  return pixelResponse();
}
