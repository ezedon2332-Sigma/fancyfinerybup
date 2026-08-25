import { customType } from "drizzle-orm/pg-core";

/**
 * Postgres types Drizzle has no first-class mapping for.
 *
 * `tsvector` backs the AI knowledge-base search: `knowledge_chunks.tsv` is a
 * GENERATED ALWAYS column (`to_tsvector('english', content)`) with a GIN index.
 * Postgres computes and maintains it, so nothing ever writes this column from
 * TypeScript — it exists in the schema purely so Drizzle knows the column and
 * its index are there and does not try to drop them on the next diff.
 */
export const tsvector = customType<{ data: string; driverData: string }>({
  dataType() {
    return "tsvector";
  },
});
