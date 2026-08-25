// Provision the bootstrap admin directly in the database, from environment
// variables. Every other admin is then invited from inside the app
// (Admin → Team), so this runs once per environment and never again.
//
// Called by `npm run db:seed`. Idempotent: re-running an existing email resets
// that account's password to the current ADMIN_PASSWORD, which is also the
// documented recovery path if the password is lost.
//
// The password hash is produced by `better-auth/crypto`'s own `hashPassword` —
// the exact function Better Auth calls when verifying a sign-in. Rolling our
// own scrypt here would work right up until Better Auth changed its parameters,
// and then fail as a mysterious "invalid credentials" months later.

import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";

const MIN_PASSWORD_LENGTH = 8;

export async function seedAdmin(client) {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME?.trim() || "Administrator";

  if (!email || !password) {
    console.log(
      "  admin     … skipped (set ADMIN_EMAIL and ADMIN_PASSWORD to provision one)",
    );
    return;
  }

  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(
      `ADMIN_PASSWORD must be at least ${MIN_PASSWORD_LENGTH} characters.`,
    );
  }

  process.stdout.write("  admin     … ");

  const hash = await hashPassword(password);

  try {
    await client.query("begin");

    // The identity row. Email is pre-verified: this account is provisioned by
    // whoever controls the server, so there is no address to prove.
    const { rows } = await client.query(
      `insert into auth_user (id, name, email, email_verified, created_at, updated_at)
       values ($1, $2, $3, true, now(), now())
       on conflict (email) do update
         set name = excluded.name, email_verified = true, updated_at = now()
       returning id`,
      [randomUUID(), name, email],
    );
    const userId = rows[0].id;

    // Better Auth stores email+password credentials as an account row with
    // providerId 'credential' and accountId equal to the user id.
    const existing = await client.query(
      `select id from auth_account where user_id = $1 and provider_id = 'credential'`,
      [userId],
    );

    if (existing.rowCount > 0) {
      await client.query(
        `update auth_account set password = $2, updated_at = now() where id = $1`,
        [existing.rows[0].id, hash],
      );
    } else {
      await client.query(
        `insert into auth_account (id, account_id, provider_id, user_id, password, created_at, updated_at)
         values ($1, $2, 'credential', $3, $4, now(), now())`,
        [randomUUID(), userId, userId, hash],
      );
    }

    // The application-side profile, carrying the admin role. Normally created
    // by the Better Auth databaseHook on sign-up; created here because this
    // account bypasses sign-up entirely.
    await client.query(
      `insert into profiles (id, full_name, role)
       values ($1, $2, 'admin')
       on conflict (id) do update
         set role = 'admin', full_name = coalesce(profiles.full_name, excluded.full_name)`,
      [userId, name],
    );

    await client.query("commit");
    console.log(`ok (${email} — role admin)`);
  } catch (e) {
    await client.query("rollback").catch(() => {});
    console.log("FAILED");
    throw e;
  }
}
