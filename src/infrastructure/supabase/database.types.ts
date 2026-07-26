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
export type SubscriberStatus =
  | "pending"
  | "subscribed"
  | "unsubscribed"
  | "bounced"
  | "complained";
export type CampaignStatus =
  | "draft"
  | "scheduled"
  | "sending"
  | "sent"
  | "cancelled"
  | "failed";

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
          weight_grams: number;
          weight_unit: string;
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
          weight_grams?: number;
          weight_unit?: string;
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
          weight_grams?: number;
          weight_unit?: string;
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
          tax: number;
          discount: number;
          total_weight_grams: number;
          shipping_method: string | null;
          shipping_country_code: string | null;
          shipping_postal: string | null;
          shipping_apartment: string | null;
          tracking_number: string | null;
          payment_status: string;
          payment_provider: string | null;
          paid_at: string | null;
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
          tax?: number;
          discount?: number;
          total_weight_grams?: number;
          shipping_method?: string | null;
          shipping_country_code?: string | null;
          shipping_postal?: string | null;
          shipping_apartment?: string | null;
          tracking_number?: string | null;
          payment_status?: string;
          payment_provider?: string | null;
          paid_at?: string | null;
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
          payment_status?: string;
          payment_provider?: string | null;
          paid_at?: string | null;
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
      shipping_settings: {
        Row: {
          id: boolean;
          ngn_per_usd: number;
          rate_mode: string;
          rate_source: string | null;
          rate_updated_at: string | null;
          tax_rate_bps: number;
          tax_label: string;
          tax_enabled: boolean;
          discount_bps: number;
          discount_label: string;
          discount_enabled: boolean;
          default_item_weight_grams: number;
          updated_at: string;
        };
        Insert: {
          id?: boolean;
          ngn_per_usd?: number;
          rate_mode?: string;
          rate_source?: string | null;
          rate_updated_at?: string | null;
          tax_rate_bps?: number;
          tax_label?: string;
          tax_enabled?: boolean;
          discount_bps?: number;
          discount_label?: string;
          discount_enabled?: boolean;
          default_item_weight_grams?: number;
          updated_at?: string;
        };
        Update: {
          id?: boolean;
          ngn_per_usd?: number;
          rate_mode?: string;
          rate_source?: string | null;
          rate_updated_at?: string | null;
          tax_rate_bps?: number;
          tax_label?: string;
          tax_enabled?: boolean;
          discount_bps?: number;
          discount_label?: string;
          discount_enabled?: boolean;
          default_item_weight_grams?: number;
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
      colors: {
        Row: {
          id: string;
          color_name: string;
          color_code: string | null;
          active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          color_name: string;
          color_code?: string | null;
          active?: boolean;
          created_at?: string;
        };
        Update: {
          color_name?: string;
          color_code?: string | null;
          active?: boolean;
        };
        Relationships: [];
      };
      color_requests: {
        Row: {
          id: string;
          product_id: string | null;
          product_name: string;
          product_sku: string | null;
          requested_color: string;
          requested_size: string | null;
          quantity: number;
          customer_name: string;
          customer_email: string;
          customer_phone: string | null;
          note: string | null;
          status: string;
          admin_note: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          product_id?: string | null;
          product_name: string;
          product_sku?: string | null;
          requested_color: string;
          requested_size?: string | null;
          quantity?: number;
          customer_name: string;
          customer_email: string;
          customer_phone?: string | null;
          note?: string | null;
          status?: string;
          admin_note?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          status?: string;
          admin_note?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      newsletter_subscribers: {
        Row: {
          id: string;
          email: string;
          first_name: string;
          last_name: string | null;
          country: string | null;
          birthday: string | null;
          status: SubscriberStatus;
          source: string;
          consent: boolean;
          consent_at: string;
          consent_text: string | null;
          ip_hash: string | null;
          user_agent: string | null;
          unsubscribe_token: string;
          confirmed_at: string | null;
          unsubscribed_at: string | null;
          last_emailed_at: string | null;
          profile_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          email: string;
          first_name: string;
          last_name?: string | null;
          country?: string | null;
          birthday?: string | null;
          status?: SubscriberStatus;
          source?: string;
          consent?: boolean;
          consent_at?: string;
          consent_text?: string | null;
          ip_hash?: string | null;
          user_agent?: string | null;
          unsubscribe_token?: string;
          confirmed_at?: string | null;
          unsubscribed_at?: string | null;
          last_emailed_at?: string | null;
          profile_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          email?: string;
          first_name?: string;
          last_name?: string | null;
          country?: string | null;
          birthday?: string | null;
          status?: SubscriberStatus;
          source?: string;
          consent?: boolean;
          consent_at?: string;
          consent_text?: string | null;
          ip_hash?: string | null;
          user_agent?: string | null;
          confirmed_at?: string | null;
          unsubscribed_at?: string | null;
          last_emailed_at?: string | null;
          profile_id?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      newsletter_preferences: {
        Row: {
          subscriber_id: string;
          interest: string;
          created_at: string;
        };
        Insert: {
          subscriber_id: string;
          interest: string;
          created_at?: string;
        };
        Update: {
          interest?: string;
        };
        Relationships: [];
      };
      email_templates: {
        Row: {
          id: string;
          key: string;
          name: string;
          subject: string;
          html: string;
          text_body: string | null;
          description: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          key: string;
          name: string;
          subject: string;
          html: string;
          text_body?: string | null;
          description?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          key?: string;
          name?: string;
          subject?: string;
          html?: string;
          text_body?: string | null;
          description?: string | null;
          is_active?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
      email_campaigns: {
        Row: {
          id: string;
          name: string;
          subject: string;
          preheader: string | null;
          html: string | null;
          text_body: string | null;
          template_id: string | null;
          status: CampaignStatus;
          audience_filter: Json;
          scheduled_at: string | null;
          sent_at: string | null;
          provider: string | null;
          recipient_count: number;
          sent_count: number;
          open_count: number;
          click_count: number;
          conversion_count: number;
          bounce_count: number;
          unsubscribe_count: number;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          subject: string;
          preheader?: string | null;
          html?: string | null;
          text_body?: string | null;
          template_id?: string | null;
          status?: string;
          audience_filter?: Json;
          scheduled_at?: string | null;
          sent_at?: string | null;
          provider?: string | null;
          recipient_count?: number;
          sent_count?: number;
          open_count?: number;
          click_count?: number;
          conversion_count?: number;
          bounce_count?: number;
          unsubscribe_count?: number;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          subject?: string;
          preheader?: string | null;
          html?: string | null;
          text_body?: string | null;
          template_id?: string | null;
          status?: string;
          audience_filter?: Json;
          scheduled_at?: string | null;
          sent_at?: string | null;
          provider?: string | null;
          recipient_count?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      campaign_analytics: {
        Row: {
          id: string;
          campaign_id: string;
          subscriber_id: string | null;
          event: string;
          url: string | null;
          user_agent: string | null;
          ip_hash: string | null;
          meta: Json;
          occurred_at: string;
        };
        Insert: {
          id?: string;
          campaign_id: string;
          subscriber_id?: string | null;
          event: string;
          url?: string | null;
          user_agent?: string | null;
          ip_hash?: string | null;
          meta?: Json;
          occurred_at?: string;
        };
        Update: {
          event?: string;
          meta?: Json;
        };
        Relationships: [];
      };
      subscription_history: {
        Row: {
          id: string;
          subscriber_id: string | null;
          email: string;
          action: string;
          source: string | null;
          ip_hash: string | null;
          user_agent: string | null;
          meta: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          subscriber_id?: string | null;
          email: string;
          action: string;
          source?: string | null;
          ip_hash?: string | null;
          user_agent?: string | null;
          meta?: Json;
          created_at?: string;
        };
        Update: {
          action?: string;
          meta?: Json;
        };
        Relationships: [];
      };
      automation_logs: {
        Row: {
          id: string;
          automation: string;
          subscriber_id: string | null;
          campaign_id: string | null;
          provider: string | null;
          status: string;
          error: string | null;
          payload: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          automation: string;
          subscriber_id?: string | null;
          campaign_id?: string | null;
          provider?: string | null;
          status?: string;
          error?: string | null;
          payload?: Json;
          created_at?: string;
        };
        Update: {
          status?: string;
          error?: string | null;
          payload?: Json;
        };
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
