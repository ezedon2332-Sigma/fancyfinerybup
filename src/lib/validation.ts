import { z } from "zod";

/** Shared zod schemas. Reused by client forms and server actions. */

export const emailSchema = z
  .string()
  .trim()
  .min(1, "Email is required")
  .email("Enter a valid email address");

export const magicLinkSchema = z.object({
  email: emailSchema,
});

export type MagicLinkInput = z.infer<typeof magicLinkSchema>;
