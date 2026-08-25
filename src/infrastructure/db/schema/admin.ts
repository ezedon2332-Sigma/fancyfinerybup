import {
  index,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { user } from "./auth";

/**
 * Admin invitations.
 *
 * Replaces the old `admin_allowlist` table, which hard-coded promoted emails in
 * a migration and had no expiry, no audit trail and no way to revoke. The
 * bootstrap admin is seeded straight into the database from environment
 * variables (scripts/seed-admin.mjs); every subsequent admin arrives through a
 * row here, created by an existing admin.
 *
 * `tokenHash` stores a SHA-256 of the invite token, never the token itself —
 * the raw value exists only in the emailed link. A leaked database backup
 * therefore cannot be replayed into an admin account.
 */
export const adminInvites = pgTable(
  "admin_invites",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    tokenHash: text("token_hash").notNull().unique(),
    invitedBy: uuid("invited_by").references(() => user.id, {
      onDelete: "set null",
    }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // Pending-invite lookup by email happens on every sign-up.
    index("admin_invites_email_idx").on(table.email),
  ],
);

/**
 * Favourites ("wishlist").
 *
 * The heart icon already existed but wrote only to localStorage, so a favourite
 * lived on one browser: it vanished on a new device, survived a sign-out into
 * the next person's session, and was invisible to the shop. Persisting it makes
 * it a real signal — admin can see what is wanted, and the catalogue can order
 * by it.
 *
 * Composite primary key rather than a surrogate id: "this customer favourited
 * this product" is the identity, and the key makes a double-tap a no-op at the
 * database level instead of something the app has to de-duplicate.
 *
 * Anonymous visitors keep using localStorage — there is no user to attribute a
 * row to. Their list is merged on sign-in (see mergeFavorites).
 */
export const productFavorites = pgTable(
  "product_favorites",
  {
    userId: uuid("user_id").notNull(),
    productId: uuid("product_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.productId] }),
    // "Most favourited" groups by product; the PK's leading column is user_id,
    // so it cannot serve that.
    index("product_favorites_product_idx").on(table.productId),
  ],
);
