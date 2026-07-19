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

/** Shipping method chosen at checkout. */
export const shippingMethodSchema = z.enum(["standard", "express"]);

/** Checkout — full shipping address + method + cart lines.
 *  Prices AND shipping cost are recomputed server-side; the client sends only
 *  the destination (country/method) and cart line references. */
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
  method: shippingMethodSchema,
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
  media: z.array(productMediaSchema).max(12),
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

/** Slugify a display name into a URL-safe slug. */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
