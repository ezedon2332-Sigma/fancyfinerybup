import { z } from "zod";

import { INTEREST_IDS, SUBSCRIBER_SOURCES } from "@/domain/newsletter";
import { checkPassword } from "@/domain/password-policy";

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

/** Checkout — full delivery address + cart lines.
 *  Prices are recomputed server-side; the client sends only the destination
 *  and cart line references. Delivery is currently free, so no method is
 *  selected or submitted. */
export const checkoutSchema = z.object({
  name: z.string().trim().min(2, "Full name is required"),
  email: emailSchema,
  phone: z.string().trim().min(7, "A phone number is required"),
  countryCode: z
    .string()
    .trim()
    .toUpperCase()
    .refine((c) => /^[A-Z]{2}$/.test(c), "Select a country"),
  country: z.string().trim().min(1, "Country is required"),
  state: z.string().trim().min(1, "State/Province is required"),
  city: z.string().trim().min(1, "City is required"),
  postal: z.string().trim().min(1, "ZIP/Postal code is required").max(32),
  address: z.string().trim().min(5, "Street address is required"),
  apartment: z.string().trim().max(120).nullable().optional(),
  /** Chosen courier and coupon. Both are re-validated and re-priced on the
   *  server — these are a request, not an instruction. */
  courierId: z.string().uuid().nullable().optional(),
  /** Nigeria local delivery area. Id only; the fee is read server-side. */
  ngDestinationId: z.string().uuid().nullable().optional(),
  couponCode: z.string().trim().max(64).nullable().optional(),
  lat: z.number().finite().nullable().optional(),
  lng: z.number().finite().nullable().optional(),
  items: z
    .array(
      z.object({
        productId: z.string().uuid(),
        variantId: z.string().uuid().nullable(),
        qty: z.number().int().positive().max(99),
      }),
    )
    .min(1, "Your bag is empty"),
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;

/** Admin — product create/edit. Price is entered in major units (Naira). */
export const productVariantSchema = z.object({
  id: z.string().uuid().optional(),
  size: z.string().trim().max(40).nullable().optional(),
  color: z.string().trim().max(40).nullable().optional(),
  sku: z.string().trim().max(60).nullable().optional(),
  stockQty: z.number().int().min(0).max(100000),
});

export const productMediaSchema = z.object({
  storagePath: z.string().min(1),
  mediaType: z.enum(["image", "video"]),
  alt: z.string().trim().max(200).nullable().optional(),
});

export const productSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(2, "Name is required"),
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9-]*$/, "Slug: lowercase letters, numbers and dashes only")
    .optional()
    .or(z.literal("")),
  description: z.string().trim().max(4000).nullable().optional(),
  priceNaira: z.number().nonnegative("Price must be 0 or more"),
  categoryId: z.string().uuid().nullable().optional(),
  status: z.enum(["draft", "published", "archived"]),
  featured: z.boolean(),
  /** Shipping weight, in `weightUnit`. Converted to canonical grams on save. */
  weight: z.number().nonnegative("Weight must be 0 or more").max(500),
  weightUnit: z.enum(["g", "kg"]),
  media: z.array(productMediaSchema).max(100),
  variants: z.array(productVariantSchema).max(50),
});

export type ProductInput = z.infer<typeof productSchema>;

/** Admin — category (collection) create/edit. */
export const categorySchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(2, "Name is required"),
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9-]*$/, "Slug: lowercase letters, numbers and dashes only")
    .optional()
    .or(z.literal("")),
  description: z.string().trim().max(1000).nullable().optional(),
  sortOrder: z.number().int().min(0).max(1000),
});

export type CategoryInput = z.infer<typeof categorySchema>;

/** Customer profile — name + saved delivery address/location. */
export const profileSchema = z.object({
  fullName: z.string().trim().max(120).nullable().optional(),
  phone: z.string().trim().max(40).nullable().optional(),
  address: z.string().trim().max(300).nullable().optional(),
  city: z.string().trim().max(120).nullable().optional(),
  state: z.string().trim().max(120).nullable().optional(),
  country: z.string().trim().max(120).nullable().optional(),
  lat: z.number().finite().nullable().optional(),
  lng: z.number().finite().nullable().optional(),
});

export type ProfileInput = z.infer<typeof profileSchema>;

/** On-demand colour request submitted from a product page. */
export const colorRequestSchema = z.object({
  productId: z.string().uuid().nullable().optional(),
  productName: z.string().trim().min(1).max(200),
  productSku: z.string().trim().max(80).nullable().optional(),
  requestedColor: z.string().trim().min(1, "Please choose a colour").max(60),
  requestedSize: z.string().trim().max(40).nullable().optional(),
  quantity: z.number().int().positive().max(99),
  customerName: z.string().trim().min(2, "Your name is required").max(120),
  customerEmail: emailSchema,
  customerPhone: z.string().trim().max(40).nullable().optional(),
  note: z.string().trim().max(1000).nullable().optional(),
});

export type ColorRequestInput = z.infer<typeof colorRequestSchema>;

/** Privé Circle — VIP newsletter signup. `website` is a honeypot: it is
 *  hidden from humans, so anything in it means a bot filled the form. */
/**
 * Account creation.
 *
 * The same schema runs in the browser for instant feedback and again inside the
 * server action, which is the copy that actually decides. Password rules come
 * from `domain/password-policy` rather than being restated here, so there is a
 * single definition of what the house considers a strong password.
 */
const signUpShape = z
  .object({
    firstName: z.string().trim().min(2, "Your first name is required").max(80),
    lastName: z.string().trim().min(2, "Your last name is required").max(80),
    email: emailSchema,
    // Optional — but if it is given, it has to look like something dialable.
    phone: z
      .string()
      .trim()
      .max(40, "That phone number is too long")
      .refine((v) => v === "" || /^[+\d][\d\s()-]{5,}$/.test(v), {
        message: "Enter a valid phone number, or leave it blank",
      })
      .optional()
      .default(""),
    password: z
      .string()
      .max(200, "That password is too long")
      .refine((v) => checkPassword(v).valid, {
        message: "Your password does not meet all of the requirements below",
      }),
    confirmPassword: z.string(),
    // Optional. Two-letter code when given, so it matches the shipping data.
    country: z
      .string()
      .trim()
      .max(2)
      .optional()
      .default(""),
    // Required, and validated on the server too — a consent flag that only the
    // browser checks is not a record of consent.
    acceptTerms: z.literal(true, {
      message: "Please accept the terms to create an account",
    }),
    // Deliberately permissive: the action inspects this itself and returns a
    // fake success. Rejecting it here would parse-fail instead, telling the bot
    // exactly which field gave it away.
    website: z.string().max(200).optional(),
  });

const PASSWORD_MISMATCH = "Those passwords do not match";

/**
 * The authoritative gate. Shape plus the cross-field check, so nothing can be
 * submitted with mismatched passwords even if the UI is bypassed.
 */
export const signUpSchema = signUpShape.refine(
  (d) => d.password === d.confirmPassword,
  { path: ["confirmPassword"], message: PASSWORD_MISMATCH },
);

export type SignUpInput = z.infer<typeof signUpSchema>;

/**
 * Every problem with a signup attempt, at once.
 *
 * Needed because a zod `.refine()` on an object only runs when the shape itself
 * parses. Left to `signUpSchema` alone, an unticked terms box would suppress the
 * password-mismatch message entirely: the customer fixes the checkbox, submits
 * again, and only then discovers the passwords never matched. Reporting one
 * fault per submit is precisely what the live checklist exists to avoid, so the
 * cross-field check runs here independently of shape validity.
 *
 * Used for the messages; `signUpSchema` still decides whether to proceed.
 */
export function signUpFieldErrors(input: unknown): Record<string, string> {
  const errors: Record<string, string> = {};

  const parsed = signUpShape.safeParse(input);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "form");
      if (!errors[key]) errors[key] = issue.message;
    }
  }

  const v = input as { password?: unknown; confirmPassword?: unknown } | null;
  if (
    typeof v?.password === "string" &&
    typeof v?.confirmPassword === "string" &&
    v.confirmPassword.length > 0 &&
    v.password !== v.confirmPassword &&
    !errors.confirmPassword
  ) {
    errors.confirmPassword = PASSWORD_MISMATCH;
  }

  return errors;
}

export const newsletterSignupSchema = z.object({
  firstName: z.string().trim().min(2, "Your first name is required").max(80),
  lastName: z.string().trim().max(80).nullable().optional(),
  email: emailSchema,
  country: z.string().trim().max(80).nullable().optional(),
  birthday: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
    .nullable()
    .optional()
    .or(z.literal("")),
  interests: z.array(z.enum(INTEREST_IDS as [string, ...string[]])).max(6),
  consent: z.literal(true, {
    message: "Please accept the terms to join",
  }),
  source: z.enum(SUBSCRIBER_SOURCES).default("homepage"),
  // Deliberately permissive: the action inspects this itself and returns a
  // fake success. Rejecting it here would parse-fail instead, telling the bot
  // exactly which field gave it away.
  website: z.string().max(200).optional(),
});

export type NewsletterSignupInput = z.infer<typeof newsletterSignupSchema>;

/** Admin — campaign create/edit. */
export const campaignSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(2, "Campaign name is required").max(160),
  subject: z.string().trim().min(2, "Subject is required").max(200),
  preheader: z.string().trim().max(200).nullable().optional(),
  html: z.string().max(200000).nullable().optional(),
  textBody: z.string().max(50000).nullable().optional(),
  interests: z.array(z.enum(INTEREST_IDS as [string, ...string[]])).max(6),
  scheduledAt: z.string().trim().nullable().optional(),
});

export type CampaignInput = z.infer<typeof campaignSchema>;

/** Slugify a display name into a URL-safe slug. */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
