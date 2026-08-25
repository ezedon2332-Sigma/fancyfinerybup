--> statement-breakpoint
-- Foreign keys, added by hand: the generated migration omits them because the
-- referenced tables live in separate schema modules. A favourite must not
-- outlive its user or its product.
ALTER TABLE "product_favorites"
  ADD CONSTRAINT "product_favorites_user_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "auth_user"("id") ON DELETE cascade;--> statement-breakpoint
ALTER TABLE "product_favorites"
  ADD CONSTRAINT "product_favorites_product_id_fk"
  FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE cascade;
