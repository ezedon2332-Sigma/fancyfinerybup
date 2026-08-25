ALTER TABLE "products" ADD COLUMN "lookbook" boolean DEFAULT false NOT NULL;--> statement-breakpoint
-- The lookbook query is `where lookbook and status='published'`, which on a
-- growing catalogue would otherwise be a sequential scan for a handful of rows.
-- Partial: only the flagged rows are indexed, so it stays tiny.
CREATE INDEX IF NOT EXISTS "products_lookbook_idx"
  ON "products" ("created_at" DESC)
  WHERE "lookbook" AND "status" = 'published';
