ALTER TABLE "shipping_settings" ADD COLUMN "ngn_per_eur" integer DEFAULT 1750 NOT NULL;--> statement-breakpoint
ALTER TABLE "shipping_settings" ADD COLUMN "ngn_per_gbp" integer DEFAULT 2050 NOT NULL;--> statement-breakpoint
ALTER TABLE "shipping_settings" ADD COLUMN "fx_enabled" boolean DEFAULT false NOT NULL;