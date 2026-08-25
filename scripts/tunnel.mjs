// Start a public HTTPS tunnel to the local dev server and print the webhook
// URLs to paste into the payment providers' TEST-mode settings.
//
//   npm run tunnel        (leave running; Ctrl-C to stop)
//
// Why this exists: Paystack and Stripe deliver webhooks server-to-server, so
// they cannot reach localhost. The browser redirect after payment is fine
// without a tunnel — that hop happens in YOUR browser, which is already on the
// dev machine — so NEXT_PUBLIC_SITE_URL should stay http://localhost:3000.
// Only the webhook needs a public address.
//
// Production is untouched: both providers keep separate test-mode and live-mode
// webhook endpoints. Point the TEST one here and leave the LIVE one on
// fancyfinerybup.com.

import { spawn } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
try {
  process.loadEnvFile(join(root, ".env"));
} catch {}

// ---------------------------------------------------------------------------
// Refuse to run anywhere that is not a developer's machine.
//
// A tunnel exists to punch a public hole through to a local process. Opening
// one from a production host would expose that host under a hostname with no
// WAF, no rate limiting and no audit trail — so this fails CLOSED on every
// signal that we are not in development, rather than relying on the operator
// not typing the command.
//
// Defence in depth, three independent layers:
//   1. these checks
//   2. next.config.ts only sets allowedDevOrigins when NODE_ENV !== production,
//      so a production build rejects the tunnel's Host header regardless
//   3. the production compose file contains no cloudflared service at all
// ---------------------------------------------------------------------------
function refuse(reason) {
  console.error(`\n  Refusing to open a tunnel: ${reason}\n`);
  console.error("  Tunnels are a development-only tool. In production, webhooks");
  console.error("  reach https://fancyfinerybup.com directly.\n");
  process.exit(1);
}

if (process.env.NODE_ENV === "production") {
  refuse("NODE_ENV=production");
}
if (process.env.APP_ENV === "production" || process.env.APP_ENV === "staging") {
  refuse(`APP_ENV=${process.env.APP_ENV}`);
}

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
const siteHost = (() => {
  try {
    return new URL(siteUrl).hostname;
  } catch {
    return "";
  }
})();
if (siteHost && !["localhost", "127.0.0.1", "0.0.0.0"].includes(siteHost)) {
  refuse(`NEXT_PUBLIC_SITE_URL points at "${siteHost}", not localhost`);
}

const dbHost = (() => {
  try {
    return new URL(process.env.DATABASE_URL ?? "").hostname;
  } catch {
    return "";
  }
})();
if (dbHost && !["localhost", "127.0.0.1", "postgres"].includes(dbHost)) {
  refuse(`DATABASE_URL points at "${dbHost}", not a local database`);
}

const compose = spawn(
  "docker",
  ["compose", "--profile", "tunnel", "up", "cloudflared", "--no-log-prefix"],
  { stdio: ["ignore", "pipe", "pipe"] },
);

let announced = false;

function scan(chunk) {
  const text = chunk.toString();
  process.stdout.write(text);

  if (announced) return;
  // cloudflared prints the assigned hostname once the tunnel is registered.
  const match = text.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/i);
  if (!match) return;

  announced = true;
  const base = match[0];
  console.log(
    [
      "",
      "─".repeat(72),
      `  Tunnel is live:  ${base}`,
      "",
      "  Paste these into the providers' TEST-mode webhook settings:",
      `    Paystack   ${base}/api/paystack/webhook`,
      `    Stripe     ${base}/api/stripe/webhook`,
      "",
      "  Then add the host to next.config.ts allowedDevOrigins, or set:",
      `    DEV_TUNNEL_HOST=${new URL(base).host}`,
      "  and restart `npm run dev` (Next reads it at startup).",
      "",
      "  Leave NEXT_PUBLIC_SITE_URL as http://localhost:3000 — the post-payment",
      "  redirect happens in your own browser and does not need the tunnel.",
      "",
      "  LIVE webhook URLs stay pointed at fancyfinerybup.com. Untouched.",
      "─".repeat(72),
      "",
    ].join("\n"),
  );
}

compose.stdout.on("data", scan);
compose.stderr.on("data", scan);

const stop = () => {
  spawn("docker", ["compose", "--profile", "tunnel", "stop", "cloudflared"], {
    stdio: "inherit",
  });
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);

compose.on("exit", (code) => process.exit(code ?? 0));
