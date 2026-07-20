/**
 * Typed contract for the Supabase (Postgres) schema.
 *
 * Hand-authored to mirror `supabase/migrations`. When the Supabase CLI becomes
 * available this can be regenerated with:
 *   supabase gen types typescript --linked > src/infrastructure/supabase/database.types.ts
 * Until then, keep this in sync with the migrations by hand.
 */

export type ProductStatus = "draft" | "published" | "archived";
export type OrderStatus =
  | "processing"
  | "packed"
  | "shipped"
  | "out_for_delivery"
  | "delivered"
  | "cancelled";
export type UserRole = "customer" | "admin";

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string | null;
          avatar_url: string | null;
          role: UserRole;
          created_at: string;
          phone: string | null;
          address: string | null;
          city: string | null;
          state: string | null;
          country: string | null;
          lat: number | null;
          lng: number | null;
        };
        Insert: {
          id: string;
          full_name?: string | null;
          avatar_url?: string | null;
          role?: UserRole;
          created_at?: string;
          phone?: string | null;
          address?: string | null;
          city?: string | null;
          state?: string | null;
          country?: string | null;
          lat?: number | null;
          lng?: number | null;
        };
        Update: {
          id?: string;
          full_name?: string | null;
          avatar_url?: string | null;
          role?: UserRole;
          created_at?: string;
          phone?: string | null;
          address?: string | null;
          city?: string | null;
          state?: string | null;
          country?: string | null;
          lat?: number | null;
          lng?: number | null;
        };
        Relationships: [];
      };
      categories: {
        Row: {
          id: string;
          name: string;
          slug: string;
          description: string | null;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          description?: string | null;
          sort_order?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          description?: string | null;
          sort_order?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      products: {
        Row: {
          id: string;
          name: string;
          slug: string;
          description: string | null;
          price: number;
          currency: string;
          category_id: string | null;
          status: ProductStatus;
          featured: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          description?: string | null;
          price: number;
          currency?: string;
          category_id?: string | null;
          status?: ProductStatus;
          featured?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          description?: string | null;
          price?: number;
          currency?: string;
          category_id?: string | null;
          status?: ProductStatus;
          featured?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey";
            columns: ["category_id"];
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
        ];
      };
      product_images: {
        Row: {
          id: string;
          product_id: string;
          storage_path: string;
          alt: string | null;
          sort_order: number;
          media_type: "image" | "video";
        };
        Insert: {
          id?: string;
          product_id: string;
          storage_path: string;
          alt?: string | null;
          sort_order?: number;
          media_type?: "image" | "video";
        };
        Update: {
          id?: string;
          product_id?: string;
          storage_path?: string;
          alt?: string | null;
          sort_order?: number;
          media_type?: "image" | "video";
        };
        Relationships: [
          {
            foreignKeyName: "product_images_product_id_fkey";
            columns: ["product_id"];
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      product_variants: {
        Row: {
          id: string;
          product_id: string;
          size: string | null;
          color: string | null;
          sku: string | null;
          stock_qty: number;
        };
        Insert: {
          id?: string;
          product_id: string;
          size?: string | null;
          color?: string | null;
          sku?: string | null;
          stock_qty?: number;
        };
        Update: {
          id?: string;
          product_id?: string;
          size?: string | null;
          color?: string | null;
          sku?: string | null;
          stock_qty?: number;
        };
        Relationships: [
          {
            foreignKeyName: "product_variants_product_id_fkey";
            columns: ["product_id"];
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      orders: {
        Row: {
          id: string;
          user_id: string;
          status: OrderStatus;
          total: number;
          currency: string;
          paystack_reference: string | null;
          shipping_name: string | null;
          shipping_email: string | null;
          shipping_phone: string | null;
          shipping_address: string | null;
          shipping_city: string | null;
          shipping_state: string | null;
          shipping_country: string | null;
          shipping_lat: number | null;
          shipping_lng: number | null;
          subtotal: number;
          shipping_cost: number;
          shipping_method: string | null;
          shipping_country_code: string | null;
          shipping_postal: string | null;
          shipping_apartment: string | null;
          tracking_number: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          status?: OrderStatus;
          total: number;
          currency?: string;
          paystack_reference?: string | null;
          shipping_name?: string | null;
          shipping_email?: string | null;
          shipping_phone?: string | null;
          shipping_address?: string | null;
          shipping_city?: string | null;
          shipping_state?: string | null;
          shipping_country?: string | null;
          shipping_lat?: number | null;
          shipping_lng?: number | null;
          subtotal?: number;
          shipping_cost?: number;
          shipping_method?: string | null;
          shipping_country_code?: string | null;
          shipping_postal?: string | null;
          shipping_apartment?: string | null;
          tracking_number?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          status?: OrderStatus;
          total?: number;
          currency?: string;
          paystack_reference?: string | null;
          shipping_name?: string | null;
          shipping_email?: string | null;
          shipping_phone?: string | null;
          shipping_address?: string | null;
          shipping_city?: string | null;
          shipping_state?: string | null;
          shipping_country?: string | null;
          shipping_lat?: number | null;
          shipping_lng?: number | null;
          subtotal?: number;
          shipping_cost?: number;
          shipping_method?: string | null;
          shipping_country_code?: string | null;
          shipping_postal?: string | null;
          shipping_apartment?: string | null;
          tracking_number?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "orders_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      order_items: {
        Row: {
          id: string;
          order_id: string;
          product_id: string | null;
          variant_id: string | null;
          name_snapshot: string;
          unit_price: number;
          qty: number;
        };
        Insert: {
          id?: string;
          order_id: string;
          product_id?: string | null;
          variant_id?: string | null;
          name_snapshot: string;
          unit_price: number;
          qty: number;
        };
        Update: {
          id?: string;
          order_id?: string;
          product_id?: string | null;
          variant_id?: string | null;
          name_snapshot?: string;
          unit_price?: number;
          qty?: number;
        };
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey";
            columns: ["order_id"];
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
        ];
      };
      shipping_countries: {
        Row: {
          code: string;
          name: string;
          zone: string;
          enabled: boolean;
          standard_price: number;
          standard_min_days: number;
          standard_max_days: number;
          express_price: number | null;
          express_min_days: number;
          express_max_days: number;
          free_over: number | null;
          updated_at: string;
        };
        Insert: {
          code: string;
          name: string;
          zone: string;
          enabled?: boolean;
          standard_price?: number;
          standard_min_days?: number;
          standard_max_days?: number;
          express_price?: number | null;
          express_min_days?: number;
          express_max_days?: number;
          free_over?: number | null;
          updated_at?: string;
        };
        Update: {
          code?: string;
          name?: string;
          zone?: string;
          enabled?: boolean;
          standard_price?: number;
          standard_min_days?: number;
          standard_max_days?: number;
          express_price?: number | null;
          express_min_days?: number;
          express_max_days?: number;
          free_over?: number | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      shipping_settings: {
        Row: {
          id: boolean;
          ngn_per_usd: number;
          rate_mode: string;
          rate_source: string | null;
          rate_updated_at: string | null;
          updated_at: string;
        };
        Insert: {
          id?: boolean;
          ngn_per_usd?: number;
          rate_mode?: string;
          rate_source?: string | null;
          rate_updated_at?: string | null;
          updated_at?: string;
        };
        Update: {
          id?: boolean;
          ngn_per_usd?: number;
          rate_mode?: string;
          rate_source?: string | null;
          rate_updated_at?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      admin_allowlist: {
        Row: { email: string; created_at: string };
        Insert: { email: string; created_at?: string };
        Update: { email?: string; created_at?: string };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      product_status: ProductStatus;
      order_status: OrderStatus;
      user_role: UserRole;
    };
    CompositeTypes: Record<string, never>;
  };
}
