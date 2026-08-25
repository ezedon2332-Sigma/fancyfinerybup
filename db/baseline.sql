-- ---------------------------------------------------------------------------
-- Fancy Finery — canonical database baseline (plain PostgreSQL 17).
--
-- GENERATED, not hand-written. Provenance: the 28 migrations in
-- supabase/migrations/ were applied verbatim to a scratch database behind
-- compat shims, then every Supabase-ism was stripped and the result dumped.
-- Applying those migrations unmodified is what makes this a faithful port
-- rather than a retyped approximation.
--
-- What was deliberately removed, and where it went instead:
--   * 35 RLS policies + RLS on 33 tables -> application-layer authorization
--     (repository adapters + requireAdmin). See docs/MIGRATION_PLAN.md Phase 6.
--   * is_admin(), guard_profile_role()   -> the admin gate in src/infrastructure/auth
--   * handle_new_user() trigger          -> Better Auth databaseHooks
--   * email_exists()                     -> a plain repository query
--   * storage.buckets / storage.objects  -> MinIO
--   * auth.users                         -> Better Auth's auth_user table
--
-- profiles.id has no foreign key here on purpose: it is re-pointed at
-- auth_user(id) once Better Auth's tables exist (see db/0001_auth_fk.sql).
--
-- Regenerate with: npm run db:baseline
-- ---------------------------------------------------------------------------

--
-- PostgreSQL database dump
--



-- Dumped from database version 17.10
-- Dumped by pg_dump version 17.10

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA IF NOT EXISTS public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: order_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.order_status AS ENUM (
    'pending',
    'paid',
    'fulfilled',
    'cancelled',
    'processing',
    'packed',
    'shipped',
    'out_for_delivery',
    'delivered'
);


--
-- Name: product_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.product_status AS ENUM (
    'draft',
    'published',
    'archived'
);


--
-- Name: user_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.user_role AS ENUM (
    'customer',
    'admin'
);


--
-- Name: bump_campaign_counters(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.bump_campaign_counters() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
                                                                                                                                                                                                                                                                                                                                                                      begin
                                                                                                                                                                                                                                                                                                                                                                        update public.email_campaigns
                                                                                                                                                                                                                                                                                                                                                                             set sent_count        = sent_count        + (new.event = 'sent')::int,
                                                                                                                                                                                                                                                                                                                                                                                      open_count        = open_count        + (new.event = 'opened')::int,
                                                                                                                                                                                                                                                                                                                                                                                               click_count       = click_count       + (new.event = 'clicked')::int,
                                                                                                                                                                                                                                                                                                                                                                                                        conversion_count  = conversion_count  + (new.event = 'converted')::int,
                                                                                                                                                                                                                                                                                                                                                                                                                 bounce_count      = bounce_count      + (new.event = 'bounced')::int,
                                                                                                                                                                                                                                                                                                                                                                                                                          unsubscribe_count = unsubscribe_count + (new.event = 'unsubscribed')::int,
                                                                                                                                                                                                                                                                                                                                                                                                                                   updated_at        = now()
                                                                                                                                                                                                                                                                                                                                                                                                                                      where id = new.campaign_id;
                                                                                                                                                                                                                                                                                                                                                                                                                                        return new;
                                                                                                                                                                                                                                                                                                                                                                                                                                        end;
                                                                                                                                                                                                                                                                                                                                                                                                                                        $$;


--
-- Name: bump_discount_usage(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.bump_discount_usage() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  update public.discount_codes
     set used_count = used_count + 1, updated_at = now()
   where id = new.code_id;
  return new;
end;
$$;


--
-- Name: recount_product_rating(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.recount_product_rating() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  target uuid := coalesce(new.product_id, old.product_id);
begin
  -- Recomputed from the table rather than incremented, so it is self-healing:
  -- a moderation change, an edit or a delete all land correctly, and any drift
  -- is corrected on the next write.
  update public.products p
     set rating_sum = coalesce(agg.total, 0),
         rating_count = coalesce(agg.n, 0)
    from (
      select sum(rating)::int as total, count(*)::int as n
        from public.product_reviews
       where product_id = target and status = 'approved'
    ) agg
   where p.id = target;
  return null;
end;
$$;


--
-- Name: set_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


--
-- Name: touch_ng_destination(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.touch_ng_destination() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: admin_allowlist; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_allowlist (
    email text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: ai_conversations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_conversations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    token uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    contact_email text,
    status text DEFAULT 'bot'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    last_message_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ai_conversations_status_check CHECK ((status = ANY (ARRAY['bot'::text, 'awaiting_human'::text, 'human'::text, 'closed'::text])))
);


--
-- Name: ai_faqs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_faqs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    question text NOT NULL,
    answer text NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: ai_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    conversation_id uuid NOT NULL,
    role text NOT NULL,
    content text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ai_messages_role_check CHECK ((role = ANY (ARRAY['user'::text, 'assistant'::text, 'agent'::text, 'system'::text])))
);


--
-- Name: ai_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_settings (
    id text DEFAULT 'default'::text NOT NULL,
    enabled boolean DEFAULT false NOT NULL,
    welcome_message text DEFAULT 'Welcome to Fancy Finery. I''m your personal concierge — ask me about our pieces, sizing, fabrics, shipping, or anything else.'::text NOT NULL,
    persona text DEFAULT 'You are the personal shopping concierge for Fancy Finery, a luxury fashion house. Speak with warm, refined elegance — poised and concise, never pushy. You are knowledgeable about style, fit, and fabric.'::text NOT NULL,
    model text DEFAULT 'claude-opus-5'::text NOT NULL,
    suggested_questions jsonb DEFAULT '["What''s new this season?", "Help me choose the right size", "What are your shipping options?", "What''s your return policy?"]'::jsonb NOT NULL,
    quick_actions jsonb DEFAULT '[{"href": "/collections", "label": "Shop Collections"}, {"href": "/account", "label": "Track Order"}, {"href": "/shipping", "label": "Shipping Info"}, {"href": "/contact", "label": "Contact Support"}]'::jsonb NOT NULL,
    human_handoff boolean DEFAULT false NOT NULL,
    handoff_message text DEFAULT 'I''ll connect you with our team — please reach us at the contact page and we''ll be delighted to help personally.'::text NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ai_settings_id_check CHECK ((id = 'default'::text))
);


--
-- Name: automation_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.automation_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    automation text NOT NULL,
    subscriber_id uuid,
    campaign_id uuid,
    provider text,
    status text DEFAULT 'queued'::text NOT NULL,
    error text,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT automation_logs_automation_check CHECK ((automation = ANY (ARRAY['welcome'::text, 'birthday'::text, 'new_collection'::text, 'vip_invitation'::text, 'flash_sale'::text, 'back_in_stock'::text, 'style_guide'::text, 'seasonal'::text, 'abandoned_cart'::text, 'review_request'::text, 'order_followup'::text]))),
    CONSTRAINT automation_logs_status_check CHECK ((status = ANY (ARRAY['queued'::text, 'sent'::text, 'failed'::text, 'skipped'::text])))
);


--
-- Name: campaign_analytics; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.campaign_analytics (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    campaign_id uuid NOT NULL,
    subscriber_id uuid,
    event text NOT NULL,
    url text,
    user_agent text,
    ip_hash text,
    meta jsonb DEFAULT '{}'::jsonb NOT NULL,
    occurred_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT campaign_analytics_event_check CHECK ((event = ANY (ARRAY['queued'::text, 'sent'::text, 'delivered'::text, 'opened'::text, 'clicked'::text, 'bounced'::text, 'complained'::text, 'unsubscribed'::text, 'converted'::text])))
);


--
-- Name: categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    description text,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: color_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.color_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    product_id uuid,
    product_name text NOT NULL,
    product_sku text,
    requested_color text NOT NULL,
    requested_size text,
    quantity integer DEFAULT 1 NOT NULL,
    customer_name text NOT NULL,
    customer_email text NOT NULL,
    customer_phone text,
    note text,
    status text DEFAULT 'pending'::text NOT NULL,
    admin_note text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT color_requests_quantity_check CHECK ((quantity > 0)),
    CONSTRAINT color_requests_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'available'::text, 'in_production'::text, 'ready'::text, 'completed'::text, 'cancelled'::text])))
);


--
-- Name: colors; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.colors (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    color_name text NOT NULL,
    color_code text,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: discount_codes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.discount_codes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code text NOT NULL,
    description text,
    campaign text,
    kind text NOT NULL,
    percent_bps integer,
    amount_kobo integer,
    min_subtotal_kobo integer DEFAULT 0 NOT NULL,
    max_discount_kobo integer,
    first_time_only boolean DEFAULT false NOT NULL,
    starts_at timestamp with time zone,
    ends_at timestamp with time zone,
    usage_limit integer,
    used_count integer DEFAULT 0 NOT NULL,
    per_customer_limit integer,
    enabled boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT discount_codes_amount_kobo_check CHECK ((amount_kobo >= 0)),
    CONSTRAINT discount_codes_kind_check CHECK ((kind = ANY (ARRAY['percent'::text, 'fixed'::text, 'free_shipping'::text]))),
    CONSTRAINT discount_codes_max_discount_kobo_check CHECK ((max_discount_kobo >= 0)),
    CONSTRAINT discount_codes_min_subtotal_kobo_check CHECK ((min_subtotal_kobo >= 0)),
    CONSTRAINT discount_codes_per_customer_limit_check CHECK (((per_customer_limit IS NULL) OR (per_customer_limit > 0))),
    CONSTRAINT discount_codes_percent_bps_check CHECK (((percent_bps >= 0) AND (percent_bps <= 10000))),
    CONSTRAINT discount_codes_usage_limit_check CHECK (((usage_limit IS NULL) OR (usage_limit > 0))),
    CONSTRAINT discount_codes_used_count_check CHECK ((used_count >= 0)),
    CONSTRAINT discount_codes_value_matches_kind CHECK ((((kind = 'percent'::text) AND (percent_bps IS NOT NULL)) OR ((kind = 'fixed'::text) AND (amount_kobo IS NOT NULL)) OR (kind = 'free_shipping'::text)))
);


--
-- Name: discount_redemptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.discount_redemptions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code_id uuid NOT NULL,
    order_id uuid,
    user_id uuid,
    amount_kobo integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: email_campaigns; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.email_campaigns (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    subject text NOT NULL,
    preheader text,
    html text,
    text_body text,
    template_id uuid,
    status text DEFAULT 'draft'::text NOT NULL,
    audience_filter jsonb DEFAULT '{}'::jsonb NOT NULL,
    scheduled_at timestamp with time zone,
    sent_at timestamp with time zone,
    provider text,
    recipient_count integer DEFAULT 0 NOT NULL,
    sent_count integer DEFAULT 0 NOT NULL,
    open_count integer DEFAULT 0 NOT NULL,
    click_count integer DEFAULT 0 NOT NULL,
    conversion_count integer DEFAULT 0 NOT NULL,
    bounce_count integer DEFAULT 0 NOT NULL,
    unsubscribe_count integer DEFAULT 0 NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT email_campaigns_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'scheduled'::text, 'sending'::text, 'sent'::text, 'cancelled'::text, 'failed'::text])))
);


--
-- Name: email_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.email_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    key text NOT NULL,
    name text NOT NULL,
    subject text NOT NULL,
    html text NOT NULL,
    text_body text,
    description text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: knowledge_chunks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.knowledge_chunks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    document_id uuid NOT NULL,
    content text NOT NULL,
    tsv tsvector GENERATED ALWAYS AS (to_tsvector('english'::regconfig, content)) STORED,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: knowledge_documents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.knowledge_documents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    content text NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: newsletter_preferences; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.newsletter_preferences (
    subscriber_id uuid NOT NULL,
    interest text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT newsletter_preferences_interest_check CHECK ((interest = ANY (ARRAY['mens'::text, 'womens'::text, 'childrens'::text, 'shoes'::text, 'accessories'::text, 'luxury'::text])))
);


--
-- Name: newsletter_subscribers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.newsletter_subscribers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email text NOT NULL,
    first_name text NOT NULL,
    last_name text,
    country text,
    birthday date,
    status text DEFAULT 'subscribed'::text NOT NULL,
    source text DEFAULT 'homepage'::text NOT NULL,
    consent boolean DEFAULT true NOT NULL,
    consent_at timestamp with time zone DEFAULT now() NOT NULL,
    consent_text text,
    ip_hash text,
    user_agent text,
    unsubscribe_token uuid DEFAULT gen_random_uuid() NOT NULL,
    confirmed_at timestamp with time zone,
    unsubscribed_at timestamp with time zone,
    last_emailed_at timestamp with time zone,
    profile_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT newsletter_subscribers_source_check CHECK ((source = ANY (ARRAY['homepage'::text, 'modal'::text, 'footer'::text, 'checkout'::text, 'admin'::text, 'import'::text]))),
    CONSTRAINT newsletter_subscribers_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'subscribed'::text, 'unsubscribed'::text, 'bounced'::text, 'complained'::text])))
);


--
-- Name: ng_destinations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ng_destinations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    state_id uuid NOT NULL,
    name text NOT NULL,
    price_kobo integer NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ng_destinations_price_kobo_check CHECK ((price_kobo >= 0))
);


--
-- Name: ng_states; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ng_states (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    code text,
    sort_order integer DEFAULT 0 NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: order_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.order_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid NOT NULL,
    product_id uuid,
    variant_id uuid,
    name_snapshot text NOT NULL,
    unit_price integer NOT NULL,
    qty integer NOT NULL,
    CONSTRAINT order_items_qty_check CHECK ((qty > 0)),
    CONSTRAINT order_items_unit_price_check CHECK ((unit_price >= 0))
);


--
-- Name: orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.orders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    status public.order_status DEFAULT 'processing'::public.order_status NOT NULL,
    total integer NOT NULL,
    currency text DEFAULT 'NGN'::text NOT NULL,
    paystack_reference text,
    shipping_name text,
    shipping_email text,
    shipping_phone text,
    shipping_address text,
    shipping_city text,
    shipping_state text,
    shipping_country text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    shipping_lat double precision,
    shipping_lng double precision,
    subtotal integer DEFAULT 0 NOT NULL,
    shipping_cost integer DEFAULT 0 NOT NULL,
    shipping_method text,
    shipping_country_code text,
    shipping_postal text,
    shipping_apartment text,
    tracking_number text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    payment_status text DEFAULT 'unpaid'::text NOT NULL,
    payment_provider text,
    paid_at timestamp with time zone,
    tax integer DEFAULT 0 NOT NULL,
    discount integer DEFAULT 0 NOT NULL,
    total_weight_grams integer DEFAULT 0 NOT NULL,
    discount_code text,
    tax_label text,
    courier_name text,
    estimated_min_days integer,
    estimated_max_days integer,
    payment_reference text,
    CONSTRAINT orders_discount_check CHECK ((discount >= 0)),
    CONSTRAINT orders_payment_status_check CHECK ((payment_status = ANY (ARRAY['unpaid'::text, 'paid'::text, 'failed'::text, 'refunded'::text]))),
    CONSTRAINT orders_shipping_cost_check CHECK ((shipping_cost >= 0)),
    CONSTRAINT orders_subtotal_check CHECK ((subtotal >= 0)),
    CONSTRAINT orders_tax_check CHECK ((tax >= 0)),
    CONSTRAINT orders_total_check CHECK ((total >= 0)),
    CONSTRAINT orders_total_weight_grams_check CHECK ((total_weight_grams >= 0))
);


--
-- Name: payment_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payment_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    provider text NOT NULL,
    event_id text,
    event_type text,
    reference text,
    order_id uuid,
    raw jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    processed_at timestamp with time zone
);


--
-- Name: product_images; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_images (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    product_id uuid NOT NULL,
    storage_path text NOT NULL,
    alt text,
    sort_order integer DEFAULT 0 NOT NULL,
    media_type text DEFAULT 'image'::text NOT NULL,
    CONSTRAINT product_images_media_type_check CHECK ((media_type = ANY (ARRAY['image'::text, 'video'::text])))
);


--
-- Name: product_reviews; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_reviews (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    product_id uuid NOT NULL,
    profile_id uuid,
    author_name text NOT NULL,
    rating smallint NOT NULL,
    title text,
    body text NOT NULL,
    order_id uuid,
    verified boolean DEFAULT false NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    fit_feedback text,
    helpful_count integer DEFAULT 0 NOT NULL,
    admin_note text,
    ip_hash text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT product_reviews_body_check CHECK (((char_length(body) >= 10) AND (char_length(body) <= 4000))),
    CONSTRAINT product_reviews_fit_feedback_check CHECK (((fit_feedback IS NULL) OR (fit_feedback = ANY (ARRAY['small'::text, 'true'::text, 'large'::text])))),
    CONSTRAINT product_reviews_rating_check CHECK (((rating >= 1) AND (rating <= 5))),
    CONSTRAINT product_reviews_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text, 'spam'::text])))
);


--
-- Name: product_variants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_variants (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    product_id uuid NOT NULL,
    size text,
    color text,
    sku text,
    stock_qty integer DEFAULT 0 NOT NULL,
    CONSTRAINT product_variants_stock_qty_check CHECK ((stock_qty >= 0))
);


--
-- Name: products; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.products (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    description text,
    price integer NOT NULL,
    currency text DEFAULT 'NGN'::text NOT NULL,
    category_id uuid,
    status public.product_status DEFAULT 'draft'::public.product_status NOT NULL,
    featured boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    weight_grams integer DEFAULT 0 NOT NULL,
    weight_unit text DEFAULT 'g'::text NOT NULL,
    fit_type text DEFAULT 'regular'::text NOT NULL,
    model_height_cm integer,
    model_weight_kg integer,
    model_size text,
    rating_sum integer DEFAULT 0 NOT NULL,
    rating_count integer DEFAULT 0 NOT NULL,
    CONSTRAINT products_fit_type_check CHECK ((fit_type = ANY (ARRAY['slim'::text, 'regular'::text, 'relaxed'::text, 'oversized'::text]))),
    CONSTRAINT products_model_height_cm_check CHECK (((model_height_cm IS NULL) OR ((model_height_cm >= 100) AND (model_height_cm <= 250)))),
    CONSTRAINT products_model_weight_kg_check CHECK (((model_weight_kg IS NULL) OR ((model_weight_kg >= 25) AND (model_weight_kg <= 250)))),
    CONSTRAINT products_price_check CHECK ((price >= 0)),
    CONSTRAINT products_weight_grams_check CHECK ((weight_grams >= 0)),
    CONSTRAINT products_weight_unit_check CHECK ((weight_unit = ANY (ARRAY['g'::text, 'kg'::text])))
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    full_name text,
    avatar_url text,
    role public.user_role DEFAULT 'customer'::public.user_role NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    phone text,
    address text,
    city text,
    state text,
    country text,
    lat double precision,
    lng double precision
);


--
-- Name: shipping_countries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.shipping_countries (
    code text NOT NULL,
    name text NOT NULL,
    zone text NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    standard_price integer DEFAULT 0 NOT NULL,
    standard_min_days integer DEFAULT 3 NOT NULL,
    standard_max_days integer DEFAULT 10 NOT NULL,
    express_price integer,
    express_min_days integer DEFAULT 1 NOT NULL,
    express_max_days integer DEFAULT 4 NOT NULL,
    free_over integer,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT shipping_countries_express_max_days_check CHECK ((express_max_days >= 0)),
    CONSTRAINT shipping_countries_express_min_days_check CHECK ((express_min_days >= 0)),
    CONSTRAINT shipping_countries_express_price_check CHECK (((express_price IS NULL) OR (express_price >= 0))),
    CONSTRAINT shipping_countries_free_over_check CHECK (((free_over IS NULL) OR (free_over >= 0))),
    CONSTRAINT shipping_countries_standard_max_days_check CHECK ((standard_max_days >= 0)),
    CONSTRAINT shipping_countries_standard_min_days_check CHECK ((standard_min_days >= 0)),
    CONSTRAINT shipping_countries_standard_price_check CHECK ((standard_price >= 0))
);


--
-- Name: shipping_methods; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.shipping_methods (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    description text,
    rate_source text DEFAULT 'table'::text NOT NULL,
    carrier_code text,
    carrier_config jsonb DEFAULT '{}'::jsonb NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    min_days integer DEFAULT 3 NOT NULL,
    max_days integer DEFAULT 10 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    display_name text,
    tracking_url_template text,
    CONSTRAINT shipping_methods_carrier_needs_code CHECK (((rate_source <> 'carrier'::text) OR (carrier_code IS NOT NULL))),
    CONSTRAINT shipping_methods_max_days_check CHECK ((max_days >= 0)),
    CONSTRAINT shipping_methods_min_days_check CHECK ((min_days >= 0)),
    CONSTRAINT shipping_methods_rate_source_check CHECK ((rate_source = ANY (ARRAY['table'::text, 'carrier'::text])))
);


--
-- Name: shipping_rates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.shipping_rates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    zone_id uuid,
    country_code text,
    method_id uuid NOT NULL,
    bracket_id uuid NOT NULL,
    price integer DEFAULT 0 NOT NULL,
    free_over integer,
    enabled boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT shipping_rates_free_over_check CHECK (((free_over IS NULL) OR (free_over >= 0))),
    CONSTRAINT shipping_rates_one_scope CHECK ((((zone_id IS NOT NULL) AND (country_code IS NULL)) OR ((zone_id IS NULL) AND (country_code IS NOT NULL)))),
    CONSTRAINT shipping_rates_price_check CHECK ((price >= 0))
);


--
-- Name: shipping_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.shipping_settings (
    id boolean DEFAULT true NOT NULL,
    ngn_per_usd integer DEFAULT 1600 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    rate_mode text DEFAULT 'auto'::text NOT NULL,
    rate_source text,
    rate_updated_at timestamp with time zone,
    tax_rate_bps integer DEFAULT 0 NOT NULL,
    tax_label text DEFAULT 'VAT'::text NOT NULL,
    tax_enabled boolean DEFAULT false NOT NULL,
    discount_bps integer DEFAULT 0 NOT NULL,
    discount_label text DEFAULT 'Discount'::text NOT NULL,
    discount_enabled boolean DEFAULT false NOT NULL,
    default_item_weight_grams integer DEFAULT 500 NOT NULL,
    CONSTRAINT shipping_settings_default_item_weight_grams_check CHECK ((default_item_weight_grams >= 0)),
    CONSTRAINT shipping_settings_discount_bps_check CHECK (((discount_bps >= 0) AND (discount_bps <= 10000))),
    CONSTRAINT shipping_settings_id_check CHECK (id),
    CONSTRAINT shipping_settings_ngn_per_usd_check CHECK ((ngn_per_usd > 0)),
    CONSTRAINT shipping_settings_rate_mode_check CHECK ((rate_mode = ANY (ARRAY['auto'::text, 'manual'::text]))),
    CONSTRAINT shipping_settings_tax_rate_bps_check CHECK (((tax_rate_bps >= 0) AND (tax_rate_bps <= 10000)))
);


--
-- Name: shipping_weight_brackets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.shipping_weight_brackets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    label text NOT NULL,
    min_grams integer NOT NULL,
    max_grams integer,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT shipping_weight_brackets_check CHECK (((max_grams IS NULL) OR (max_grams > min_grams))),
    CONSTRAINT shipping_weight_brackets_min_grams_check CHECK ((min_grams >= 0))
);


--
-- Name: shipping_zone_countries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.shipping_zone_countries (
    country_code text NOT NULL,
    zone_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: shipping_zones; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.shipping_zones (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: subscription_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subscription_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    subscriber_id uuid,
    email text NOT NULL,
    action text NOT NULL,
    source text,
    ip_hash text,
    user_agent text,
    meta jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT subscription_history_action_check CHECK ((action = ANY (ARRAY['subscribed'::text, 'resubscribed'::text, 'unsubscribed'::text, 'preferences_updated'::text, 'imported'::text, 'deleted'::text, 'bounced'::text])))
);


--
-- Name: tax_rules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tax_rules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    scope text NOT NULL,
    country_code text,
    zone_id uuid,
    rate_bps integer DEFAULT 0 NOT NULL,
    label text DEFAULT 'VAT'::text NOT NULL,
    applies_to_shipping boolean DEFAULT false NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT tax_rules_rate_bps_check CHECK (((rate_bps >= 0) AND (rate_bps <= 10000))),
    CONSTRAINT tax_rules_scope_check CHECK ((scope = ANY (ARRAY['global'::text, 'zone'::text, 'country'::text]))),
    CONSTRAINT tax_rules_scope_key CHECK ((((scope = 'global'::text) AND (country_code IS NULL) AND (zone_id IS NULL)) OR ((scope = 'zone'::text) AND (country_code IS NULL) AND (zone_id IS NOT NULL)) OR ((scope = 'country'::text) AND (country_code IS NOT NULL) AND (zone_id IS NULL))))
);


--
-- Name: admin_allowlist admin_allowlist_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_allowlist
    ADD CONSTRAINT admin_allowlist_pkey PRIMARY KEY (email);


--
-- Name: ai_conversations ai_conversations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_conversations
    ADD CONSTRAINT ai_conversations_pkey PRIMARY KEY (id);


--
-- Name: ai_conversations ai_conversations_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_conversations
    ADD CONSTRAINT ai_conversations_token_key UNIQUE (token);


--
-- Name: ai_faqs ai_faqs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_faqs
    ADD CONSTRAINT ai_faqs_pkey PRIMARY KEY (id);


--
-- Name: ai_messages ai_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_messages
    ADD CONSTRAINT ai_messages_pkey PRIMARY KEY (id);


--
-- Name: ai_settings ai_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_settings
    ADD CONSTRAINT ai_settings_pkey PRIMARY KEY (id);


--
-- Name: automation_logs automation_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.automation_logs
    ADD CONSTRAINT automation_logs_pkey PRIMARY KEY (id);


--
-- Name: campaign_analytics campaign_analytics_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_analytics
    ADD CONSTRAINT campaign_analytics_pkey PRIMARY KEY (id);


--
-- Name: categories categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_pkey PRIMARY KEY (id);


--
-- Name: categories categories_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_slug_key UNIQUE (slug);


--
-- Name: color_requests color_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.color_requests
    ADD CONSTRAINT color_requests_pkey PRIMARY KEY (id);


--
-- Name: colors colors_color_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.colors
    ADD CONSTRAINT colors_color_name_key UNIQUE (color_name);


--
-- Name: colors colors_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.colors
    ADD CONSTRAINT colors_pkey PRIMARY KEY (id);


--
-- Name: discount_codes discount_codes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.discount_codes
    ADD CONSTRAINT discount_codes_pkey PRIMARY KEY (id);


--
-- Name: discount_redemptions discount_redemptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.discount_redemptions
    ADD CONSTRAINT discount_redemptions_pkey PRIMARY KEY (id);


--
-- Name: email_campaigns email_campaigns_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_campaigns
    ADD CONSTRAINT email_campaigns_pkey PRIMARY KEY (id);


--
-- Name: email_templates email_templates_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_templates
    ADD CONSTRAINT email_templates_key_key UNIQUE (key);


--
-- Name: email_templates email_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_templates
    ADD CONSTRAINT email_templates_pkey PRIMARY KEY (id);


--
-- Name: knowledge_chunks knowledge_chunks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_chunks
    ADD CONSTRAINT knowledge_chunks_pkey PRIMARY KEY (id);


--
-- Name: knowledge_documents knowledge_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_documents
    ADD CONSTRAINT knowledge_documents_pkey PRIMARY KEY (id);


--
-- Name: newsletter_preferences newsletter_preferences_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.newsletter_preferences
    ADD CONSTRAINT newsletter_preferences_pkey PRIMARY KEY (subscriber_id, interest);


--
-- Name: newsletter_subscribers newsletter_subscribers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.newsletter_subscribers
    ADD CONSTRAINT newsletter_subscribers_pkey PRIMARY KEY (id);


--
-- Name: ng_destinations ng_destinations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ng_destinations
    ADD CONSTRAINT ng_destinations_pkey PRIMARY KEY (id);


--
-- Name: ng_states ng_states_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ng_states
    ADD CONSTRAINT ng_states_pkey PRIMARY KEY (id);


--
-- Name: order_items order_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_pkey PRIMARY KEY (id);


--
-- Name: orders orders_paystack_reference_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_paystack_reference_key UNIQUE (paystack_reference);


--
-- Name: orders orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_pkey PRIMARY KEY (id);


--
-- Name: payment_events payment_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_events
    ADD CONSTRAINT payment_events_pkey PRIMARY KEY (id);


--
-- Name: product_images product_images_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_images
    ADD CONSTRAINT product_images_pkey PRIMARY KEY (id);


--
-- Name: product_reviews product_reviews_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_reviews
    ADD CONSTRAINT product_reviews_pkey PRIMARY KEY (id);


--
-- Name: product_variants product_variants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_variants
    ADD CONSTRAINT product_variants_pkey PRIMARY KEY (id);


--
-- Name: product_variants product_variants_sku_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_variants
    ADD CONSTRAINT product_variants_sku_key UNIQUE (sku);


--
-- Name: products products_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_pkey PRIMARY KEY (id);


--
-- Name: products products_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_slug_key UNIQUE (slug);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: shipping_countries shipping_countries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shipping_countries
    ADD CONSTRAINT shipping_countries_pkey PRIMARY KEY (code);


--
-- Name: shipping_methods shipping_methods_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shipping_methods
    ADD CONSTRAINT shipping_methods_code_key UNIQUE (code);


--
-- Name: shipping_methods shipping_methods_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shipping_methods
    ADD CONSTRAINT shipping_methods_pkey PRIMARY KEY (id);


--
-- Name: shipping_rates shipping_rates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shipping_rates
    ADD CONSTRAINT shipping_rates_pkey PRIMARY KEY (id);


--
-- Name: shipping_settings shipping_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shipping_settings
    ADD CONSTRAINT shipping_settings_pkey PRIMARY KEY (id);


--
-- Name: shipping_weight_brackets shipping_weight_brackets_min_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shipping_weight_brackets
    ADD CONSTRAINT shipping_weight_brackets_min_key UNIQUE (min_grams);


--
-- Name: shipping_weight_brackets shipping_weight_brackets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shipping_weight_brackets
    ADD CONSTRAINT shipping_weight_brackets_pkey PRIMARY KEY (id);


--
-- Name: shipping_zone_countries shipping_zone_countries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shipping_zone_countries
    ADD CONSTRAINT shipping_zone_countries_pkey PRIMARY KEY (country_code);


--
-- Name: shipping_zones shipping_zones_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shipping_zones
    ADD CONSTRAINT shipping_zones_code_key UNIQUE (code);


--
-- Name: shipping_zones shipping_zones_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shipping_zones
    ADD CONSTRAINT shipping_zones_pkey PRIMARY KEY (id);


--
-- Name: subscription_history subscription_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription_history
    ADD CONSTRAINT subscription_history_pkey PRIMARY KEY (id);


--
-- Name: tax_rules tax_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tax_rules
    ADD CONSTRAINT tax_rules_pkey PRIMARY KEY (id);


--
-- Name: ai_conversations_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ai_conversations_status_idx ON public.ai_conversations USING btree (status, last_message_at DESC);


--
-- Name: ai_faqs_order_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ai_faqs_order_idx ON public.ai_faqs USING btree (enabled, sort_order);


--
-- Name: ai_messages_conversation_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ai_messages_conversation_idx ON public.ai_messages USING btree (conversation_id, created_at);


--
-- Name: automation_logs_automation_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX automation_logs_automation_idx ON public.automation_logs USING btree (automation, created_at DESC);


--
-- Name: automation_logs_dedupe_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX automation_logs_dedupe_idx ON public.automation_logs USING btree (subscriber_id, automation, created_at DESC);


--
-- Name: automation_logs_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX automation_logs_status_idx ON public.automation_logs USING btree (status);


--
-- Name: automation_logs_subscriber_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX automation_logs_subscriber_idx ON public.automation_logs USING btree (subscriber_id);


--
-- Name: campaign_analytics_campaign_event_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX campaign_analytics_campaign_event_idx ON public.campaign_analytics USING btree (campaign_id, event);


--
-- Name: campaign_analytics_occurred_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX campaign_analytics_occurred_idx ON public.campaign_analytics USING btree (occurred_at DESC);


--
-- Name: campaign_analytics_subscriber_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX campaign_analytics_subscriber_idx ON public.campaign_analytics USING btree (subscriber_id);


--
-- Name: campaign_analytics_unique_engagement; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX campaign_analytics_unique_engagement ON public.campaign_analytics USING btree (campaign_id, subscriber_id, event) WHERE (event = ANY (ARRAY['opened'::text, 'clicked'::text, 'converted'::text, 'unsubscribed'::text]));


--
-- Name: color_requests_color_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX color_requests_color_idx ON public.color_requests USING btree (requested_color);


--
-- Name: color_requests_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX color_requests_created_idx ON public.color_requests USING btree (created_at DESC);


--
-- Name: color_requests_product_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX color_requests_product_idx ON public.color_requests USING btree (product_id);


--
-- Name: color_requests_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX color_requests_status_idx ON public.color_requests USING btree (status);


--
-- Name: colors_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX colors_active_idx ON public.colors USING btree (active);


--
-- Name: discount_codes_campaign_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX discount_codes_campaign_idx ON public.discount_codes USING btree (campaign);


--
-- Name: discount_codes_code_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX discount_codes_code_key ON public.discount_codes USING btree (upper(code));


--
-- Name: discount_codes_enabled_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX discount_codes_enabled_idx ON public.discount_codes USING btree (enabled, starts_at, ends_at);


--
-- Name: discount_redemptions_code_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX discount_redemptions_code_idx ON public.discount_redemptions USING btree (code_id, created_at DESC);


--
-- Name: discount_redemptions_once_per_order; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX discount_redemptions_once_per_order ON public.discount_redemptions USING btree (code_id, order_id) WHERE (order_id IS NOT NULL);


--
-- Name: discount_redemptions_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX discount_redemptions_user_idx ON public.discount_redemptions USING btree (user_id);


--
-- Name: email_campaigns_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX email_campaigns_created_idx ON public.email_campaigns USING btree (created_at DESC);


--
-- Name: email_campaigns_scheduled_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX email_campaigns_scheduled_idx ON public.email_campaigns USING btree (scheduled_at) WHERE (status = 'scheduled'::text);


--
-- Name: email_campaigns_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX email_campaigns_status_idx ON public.email_campaigns USING btree (status);


--
-- Name: email_templates_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX email_templates_active_idx ON public.email_templates USING btree (is_active);


--
-- Name: knowledge_chunks_doc_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX knowledge_chunks_doc_idx ON public.knowledge_chunks USING btree (document_id);


--
-- Name: knowledge_chunks_tsv_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX knowledge_chunks_tsv_idx ON public.knowledge_chunks USING gin (tsv);


--
-- Name: newsletter_preferences_interest_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX newsletter_preferences_interest_idx ON public.newsletter_preferences USING btree (interest);


--
-- Name: newsletter_subscribers_birthday_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX newsletter_subscribers_birthday_idx ON public.newsletter_subscribers USING btree (EXTRACT(month FROM birthday), EXTRACT(day FROM birthday)) WHERE (birthday IS NOT NULL);


--
-- Name: newsletter_subscribers_country_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX newsletter_subscribers_country_idx ON public.newsletter_subscribers USING btree (country);


--
-- Name: newsletter_subscribers_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX newsletter_subscribers_created_idx ON public.newsletter_subscribers USING btree (created_at DESC);


--
-- Name: newsletter_subscribers_email_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX newsletter_subscribers_email_key ON public.newsletter_subscribers USING btree (lower(email));


--
-- Name: newsletter_subscribers_ip_recent_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX newsletter_subscribers_ip_recent_idx ON public.newsletter_subscribers USING btree (ip_hash, created_at DESC);


--
-- Name: newsletter_subscribers_profile_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX newsletter_subscribers_profile_idx ON public.newsletter_subscribers USING btree (profile_id);


--
-- Name: newsletter_subscribers_source_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX newsletter_subscribers_source_idx ON public.newsletter_subscribers USING btree (source);


--
-- Name: newsletter_subscribers_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX newsletter_subscribers_status_idx ON public.newsletter_subscribers USING btree (status);


--
-- Name: newsletter_subscribers_token_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX newsletter_subscribers_token_key ON public.newsletter_subscribers USING btree (unsubscribe_token);


--
-- Name: ng_destinations_state_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ng_destinations_state_idx ON public.ng_destinations USING btree (state_id, enabled, sort_order, name);


--
-- Name: ng_destinations_state_name_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ng_destinations_state_name_key ON public.ng_destinations USING btree (state_id, lower(name));


--
-- Name: ng_states_name_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ng_states_name_key ON public.ng_states USING btree (lower(name));


--
-- Name: order_items_order_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX order_items_order_idx ON public.order_items USING btree (order_id);


--
-- Name: orders_payment_reference_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX orders_payment_reference_key ON public.orders USING btree (payment_reference);


--
-- Name: orders_payment_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX orders_payment_status_idx ON public.orders USING btree (payment_status);


--
-- Name: orders_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX orders_status_idx ON public.orders USING btree (status);


--
-- Name: orders_tracking_number_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX orders_tracking_number_key ON public.orders USING btree (tracking_number) WHERE (tracking_number IS NOT NULL);


--
-- Name: orders_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX orders_user_idx ON public.orders USING btree (user_id);


--
-- Name: payment_events_order_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX payment_events_order_idx ON public.payment_events USING btree (order_id);


--
-- Name: payment_events_provider_event_id_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX payment_events_provider_event_id_key ON public.payment_events USING btree (provider, event_id) WHERE (event_id IS NOT NULL);


--
-- Name: payment_events_reference_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX payment_events_reference_idx ON public.payment_events USING btree (reference);


--
-- Name: payment_events_unprocessed_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX payment_events_unprocessed_idx ON public.payment_events USING btree (created_at) WHERE (processed_at IS NULL);


--
-- Name: product_images_product_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX product_images_product_idx ON public.product_images USING btree (product_id);


--
-- Name: product_reviews_ip_recent_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX product_reviews_ip_recent_idx ON public.product_reviews USING btree (ip_hash, created_at DESC);


--
-- Name: product_reviews_one_per_customer; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX product_reviews_one_per_customer ON public.product_reviews USING btree (product_id, profile_id) WHERE (profile_id IS NOT NULL);


--
-- Name: product_reviews_profile_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX product_reviews_profile_idx ON public.product_reviews USING btree (profile_id);


--
-- Name: product_reviews_public_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX product_reviews_public_idx ON public.product_reviews USING btree (product_id, created_at DESC) WHERE (status = 'approved'::text);


--
-- Name: product_reviews_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX product_reviews_status_idx ON public.product_reviews USING btree (status, created_at DESC);


--
-- Name: product_variants_product_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX product_variants_product_idx ON public.product_variants USING btree (product_id);


--
-- Name: products_category_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX products_category_idx ON public.products USING btree (category_id);


--
-- Name: products_featured_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX products_featured_idx ON public.products USING btree (featured) WHERE featured;


--
-- Name: products_fit_type_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX products_fit_type_idx ON public.products USING btree (fit_type);


--
-- Name: products_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX products_status_idx ON public.products USING btree (status);


--
-- Name: shipping_countries_enabled_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX shipping_countries_enabled_idx ON public.shipping_countries USING btree (enabled);


--
-- Name: shipping_countries_zone_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX shipping_countries_zone_idx ON public.shipping_countries USING btree (zone);


--
-- Name: shipping_methods_enabled_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX shipping_methods_enabled_idx ON public.shipping_methods USING btree (enabled, sort_order);


--
-- Name: shipping_rates_country_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX shipping_rates_country_key ON public.shipping_rates USING btree (country_code, method_id, bracket_id) WHERE (country_code IS NOT NULL);


--
-- Name: shipping_rates_lookup_country_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX shipping_rates_lookup_country_idx ON public.shipping_rates USING btree (country_code, method_id) WHERE enabled;


--
-- Name: shipping_rates_lookup_zone_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX shipping_rates_lookup_zone_idx ON public.shipping_rates USING btree (zone_id, method_id) WHERE enabled;


--
-- Name: shipping_rates_zone_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX shipping_rates_zone_key ON public.shipping_rates USING btree (zone_id, method_id, bracket_id) WHERE (zone_id IS NOT NULL);


--
-- Name: shipping_weight_brackets_order_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX shipping_weight_brackets_order_idx ON public.shipping_weight_brackets USING btree (min_grams);


--
-- Name: shipping_zone_countries_zone_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX shipping_zone_countries_zone_idx ON public.shipping_zone_countries USING btree (zone_id);


--
-- Name: shipping_zones_enabled_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX shipping_zones_enabled_idx ON public.shipping_zones USING btree (enabled, sort_order);


--
-- Name: subscription_history_action_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX subscription_history_action_idx ON public.subscription_history USING btree (action);


--
-- Name: subscription_history_email_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX subscription_history_email_idx ON public.subscription_history USING btree (lower(email));


--
-- Name: subscription_history_ip_recent_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX subscription_history_ip_recent_idx ON public.subscription_history USING btree (ip_hash, created_at DESC);


--
-- Name: subscription_history_subscriber_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX subscription_history_subscriber_idx ON public.subscription_history USING btree (subscriber_id, created_at DESC);


--
-- Name: tax_rules_country_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX tax_rules_country_key ON public.tax_rules USING btree (country_code) WHERE (scope = 'country'::text);


--
-- Name: tax_rules_enabled_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tax_rules_enabled_idx ON public.tax_rules USING btree (enabled);


--
-- Name: tax_rules_global_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX tax_rules_global_key ON public.tax_rules USING btree ((true)) WHERE (scope = 'global'::text);


--
-- Name: tax_rules_zone_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX tax_rules_zone_key ON public.tax_rules USING btree (zone_id) WHERE (scope = 'zone'::text);


--
-- Name: campaign_analytics campaign_analytics_bump; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER campaign_analytics_bump AFTER INSERT ON public.campaign_analytics FOR EACH ROW EXECUTE FUNCTION public.bump_campaign_counters();


--
-- Name: color_requests color_requests_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER color_requests_set_updated_at BEFORE UPDATE ON public.color_requests FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: discount_codes discount_codes_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER discount_codes_set_updated_at BEFORE UPDATE ON public.discount_codes FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: discount_redemptions discount_redemptions_bump; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER discount_redemptions_bump AFTER INSERT ON public.discount_redemptions FOR EACH ROW EXECUTE FUNCTION public.bump_discount_usage();


--
-- Name: email_campaigns email_campaigns_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER email_campaigns_set_updated_at BEFORE UPDATE ON public.email_campaigns FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: email_templates email_templates_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER email_templates_set_updated_at BEFORE UPDATE ON public.email_templates FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: newsletter_subscribers newsletter_subscribers_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER newsletter_subscribers_set_updated_at BEFORE UPDATE ON public.newsletter_subscribers FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: ng_destinations ng_destinations_touch; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER ng_destinations_touch BEFORE UPDATE ON public.ng_destinations FOR EACH ROW EXECUTE FUNCTION public.touch_ng_destination();


--
-- Name: orders orders_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER orders_set_updated_at BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: product_reviews product_reviews_recount; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER product_reviews_recount AFTER INSERT OR DELETE OR UPDATE ON public.product_reviews FOR EACH ROW EXECUTE FUNCTION public.recount_product_rating();


--
-- Name: product_reviews product_reviews_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER product_reviews_set_updated_at BEFORE UPDATE ON public.product_reviews FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: products products_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER products_set_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: shipping_countries shipping_countries_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER shipping_countries_set_updated_at BEFORE UPDATE ON public.shipping_countries FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: shipping_methods shipping_methods_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER shipping_methods_set_updated_at BEFORE UPDATE ON public.shipping_methods FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: shipping_rates shipping_rates_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER shipping_rates_set_updated_at BEFORE UPDATE ON public.shipping_rates FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: shipping_settings shipping_settings_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER shipping_settings_set_updated_at BEFORE UPDATE ON public.shipping_settings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: shipping_zones shipping_zones_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER shipping_zones_set_updated_at BEFORE UPDATE ON public.shipping_zones FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: tax_rules tax_rules_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tax_rules_set_updated_at BEFORE UPDATE ON public.tax_rules FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: ai_conversations ai_conversations_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_conversations
    ADD CONSTRAINT ai_conversations_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: ai_messages ai_messages_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_messages
    ADD CONSTRAINT ai_messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.ai_conversations(id) ON DELETE CASCADE;


--
-- Name: automation_logs automation_logs_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.automation_logs
    ADD CONSTRAINT automation_logs_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.email_campaigns(id) ON DELETE SET NULL;


--
-- Name: automation_logs automation_logs_subscriber_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.automation_logs
    ADD CONSTRAINT automation_logs_subscriber_id_fkey FOREIGN KEY (subscriber_id) REFERENCES public.newsletter_subscribers(id) ON DELETE CASCADE;


--
-- Name: campaign_analytics campaign_analytics_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_analytics
    ADD CONSTRAINT campaign_analytics_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.email_campaigns(id) ON DELETE CASCADE;


--
-- Name: campaign_analytics campaign_analytics_subscriber_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_analytics
    ADD CONSTRAINT campaign_analytics_subscriber_id_fkey FOREIGN KEY (subscriber_id) REFERENCES public.newsletter_subscribers(id) ON DELETE SET NULL;


--
-- Name: color_requests color_requests_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.color_requests
    ADD CONSTRAINT color_requests_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE SET NULL;


--
-- Name: discount_redemptions discount_redemptions_code_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.discount_redemptions
    ADD CONSTRAINT discount_redemptions_code_id_fkey FOREIGN KEY (code_id) REFERENCES public.discount_codes(id) ON DELETE CASCADE;


--
-- Name: discount_redemptions discount_redemptions_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.discount_redemptions
    ADD CONSTRAINT discount_redemptions_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE SET NULL;


--
-- Name: discount_redemptions discount_redemptions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.discount_redemptions
    ADD CONSTRAINT discount_redemptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: email_campaigns email_campaigns_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_campaigns
    ADD CONSTRAINT email_campaigns_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: email_campaigns email_campaigns_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_campaigns
    ADD CONSTRAINT email_campaigns_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.email_templates(id) ON DELETE SET NULL;


--
-- Name: knowledge_chunks knowledge_chunks_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_chunks
    ADD CONSTRAINT knowledge_chunks_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.knowledge_documents(id) ON DELETE CASCADE;


--
-- Name: newsletter_preferences newsletter_preferences_subscriber_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.newsletter_preferences
    ADD CONSTRAINT newsletter_preferences_subscriber_id_fkey FOREIGN KEY (subscriber_id) REFERENCES public.newsletter_subscribers(id) ON DELETE CASCADE;


--
-- Name: newsletter_subscribers newsletter_subscribers_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.newsletter_subscribers
    ADD CONSTRAINT newsletter_subscribers_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: ng_destinations ng_destinations_state_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ng_destinations
    ADD CONSTRAINT ng_destinations_state_id_fkey FOREIGN KEY (state_id) REFERENCES public.ng_states(id) ON DELETE CASCADE;


--
-- Name: order_items order_items_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: order_items order_items_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE SET NULL;


--
-- Name: order_items order_items_variant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_variant_id_fkey FOREIGN KEY (variant_id) REFERENCES public.product_variants(id) ON DELETE SET NULL;


--
-- Name: orders orders_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE RESTRICT;


--
-- Name: payment_events payment_events_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_events
    ADD CONSTRAINT payment_events_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE SET NULL;


--
-- Name: product_images product_images_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_images
    ADD CONSTRAINT product_images_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: product_reviews product_reviews_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_reviews
    ADD CONSTRAINT product_reviews_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE SET NULL;


--
-- Name: product_reviews product_reviews_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_reviews
    ADD CONSTRAINT product_reviews_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: product_reviews product_reviews_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_reviews
    ADD CONSTRAINT product_reviews_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: product_variants product_variants_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_variants
    ADD CONSTRAINT product_variants_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: products products_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE SET NULL;


--
-- Name: shipping_rates shipping_rates_bracket_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shipping_rates
    ADD CONSTRAINT shipping_rates_bracket_id_fkey FOREIGN KEY (bracket_id) REFERENCES public.shipping_weight_brackets(id) ON DELETE CASCADE;


--
-- Name: shipping_rates shipping_rates_method_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shipping_rates
    ADD CONSTRAINT shipping_rates_method_id_fkey FOREIGN KEY (method_id) REFERENCES public.shipping_methods(id) ON DELETE CASCADE;


--
-- Name: shipping_rates shipping_rates_zone_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shipping_rates
    ADD CONSTRAINT shipping_rates_zone_id_fkey FOREIGN KEY (zone_id) REFERENCES public.shipping_zones(id) ON DELETE CASCADE;


--
-- Name: shipping_zone_countries shipping_zone_countries_zone_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shipping_zone_countries
    ADD CONSTRAINT shipping_zone_countries_zone_id_fkey FOREIGN KEY (zone_id) REFERENCES public.shipping_zones(id) ON DELETE CASCADE;


--
-- Name: subscription_history subscription_history_subscriber_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription_history
    ADD CONSTRAINT subscription_history_subscriber_id_fkey FOREIGN KEY (subscriber_id) REFERENCES public.newsletter_subscribers(id) ON DELETE CASCADE;


--
-- Name: tax_rules tax_rules_zone_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tax_rules
    ADD CONSTRAINT tax_rules_zone_id_fkey FOREIGN KEY (zone_id) REFERENCES public.shipping_zones(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--



