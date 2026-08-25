import "server-only";

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

import { and, desc, eq, gt, isNull, sql } from "drizzle-orm";

import { db } from "./client";
import { adminInvites, profiles, user } from "./schema";

/**
 * Admin invitations.
 *
 * The bootstrap admin is seeded from environment variables
 * (scripts/seed-admin.mjs); every admin after that is invited from inside the
 * app by an existing one.
 *
 * The raw token is returned to the caller exactly once, to be put in the emailed
 * link, and only its SHA-256 is stored. A leaked database dump therefore cannot
 * be replayed into an admin account — which is the whole reason this replaced
 * the old `admin_allowlist`, a plain list of emails with no expiry, no
 * revocation and no record of who added whom.
 */

const INVITE_TTL_DAYS = 7;

export interface AdminInviteRow {
  id: string;
  email: string;
  invitedByName: string | null;
  expiresAt: Date;
  acceptedAt: Date | null;
  revokedAt: Date | null;
  status: "pending" | "accepted" | "revoked" | "expired";
  createdAt: Date;
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Create an invitation and return the raw token for the email link.
 * Re-inviting an address revokes any outstanding invite for it first, so only
 * one link is ever live per address.
 */
export async function createAdminInvite(
  email: string,
  invitedBy: string,
): Promise<{ token: string; expiresAt: Date }> {
  const normalized = email.trim().toLowerCase();
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000);

  await db.transaction(async (tx) => {
    await tx
      .update(adminInvites)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(adminInvites.email, normalized),
          isNull(adminInvites.acceptedAt),
          isNull(adminInvites.revokedAt),
        ),
      );

    await tx.insert(adminInvites).values({
      email: normalized,
      tokenHash: hashToken(token),
      invitedBy,
      expiresAt,
    });
  });

  return { token, expiresAt };
}

/**
 * Consume a pending invite for an address, promoting that account to admin.
 * Called from the Better Auth `user.create.after` hook, so it runs for every
 * sign-up route — password, magic link and Google alike.
 *
 * Returns true when an invite was consumed (the caller should set role=admin).
 */
export async function consumeInviteForEmail(
  email: string,
  userId: string,
): Promise<boolean> {
  const normalized = email.trim().toLowerCase();

  const rows = await db
    .update(adminInvites)
    .set({ acceptedAt: new Date() })
    .where(
      and(
        eq(adminInvites.email, normalized),
        isNull(adminInvites.acceptedAt),
        isNull(adminInvites.revokedAt),
        gt(adminInvites.expiresAt, new Date()),
      ),
    )
    .returning({ id: adminInvites.id });

  if (rows.length === 0) return false;

  // The role is written by the caller inside the same request; setting it here
  // too keeps the promotion correct even if the profile row already exists
  // (a customer who was later invited to be an admin).
  await db
    .update(profiles)
    .set({ role: "admin" })
    .where(eq(profiles.id, userId));

  return true;
}

/**
 * Validate a raw invite token from a link. Used to show the invitee a sensible
 * page before they sign up, and to reject expired or revoked links early.
 */
export async function findValidInviteByToken(
  token: string,
): Promise<{ id: string; email: string } | null> {
  const candidate = hashToken(token);

  const row = await db.query.adminInvites.findFirst({
    where: and(
      eq(adminInvites.tokenHash, candidate),
      isNull(adminInvites.acceptedAt),
      isNull(adminInvites.revokedAt),
      gt(adminInvites.expiresAt, new Date()),
    ),
    columns: { id: true, email: true, tokenHash: true },
  });
  if (!row) return null;

  // The lookup above is an indexed equality match on a hash, which is already
  // not a timing oracle for the raw token. Comparing again in constant time
  // costs nothing and keeps that property if the lookup ever changes shape.
  const a = Buffer.from(row.tokenHash, "hex");
  const b = Buffer.from(candidate, "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  return { id: row.id, email: row.email };
}

/** All invitations, newest first, for the Admin → Team screen. */
export async function listAdminInvites(): Promise<AdminInviteRow[]> {
  const rows = await db
    .select({
      id: adminInvites.id,
      email: adminInvites.email,
      invitedByName: user.name,
      expiresAt: adminInvites.expiresAt,
      acceptedAt: adminInvites.acceptedAt,
      revokedAt: adminInvites.revokedAt,
      createdAt: adminInvites.createdAt,
    })
    .from(adminInvites)
    .leftJoin(user, eq(user.id, adminInvites.invitedBy))
    .orderBy(desc(adminInvites.createdAt));

  const now = Date.now();
  return rows.map((r) => ({
    ...r,
    status: r.acceptedAt
      ? ("accepted" as const)
      : r.revokedAt
        ? ("revoked" as const)
        : r.expiresAt.getTime() < now
          ? ("expired" as const)
          : ("pending" as const),
  }));
}

export async function revokeAdminInvite(id: string): Promise<void> {
  await db
    .update(adminInvites)
    .set({ revokedAt: new Date() })
    .where(and(eq(adminInvites.id, id), isNull(adminInvites.acceptedAt)));
}

/** Existing admins, for the Team screen. */
export async function listAdmins() {
  return db
    .select({
      id: profiles.id,
      name: sql<string | null>`coalesce(${profiles.fullName}, ${user.name})`,
      email: user.email,
      createdAt: profiles.createdAt,
    })
    .from(profiles)
    .innerJoin(user, eq(user.id, profiles.id))
    .where(eq(profiles.role, "admin"))
    .orderBy(profiles.createdAt);
}
