-- Fancy Finery — VIP Newsletter & Membership ("Privé Circle").
--
-- Seven tables: subscribers, their interest preferences, reusable email
-- templates, campaigns, per-recipient analytics events, an append-only
-- subscription audit trail, and automation delivery logs.
--
-- All access is server-side via the service role (public subscribe action
-- validates; admin reads/writes require admin), so RLS is enabled with no
-- public policies — subscriber PII is never exposed through the public API.
-- Additive & safe: nothing here touches existing tables.

-- Subscribers ---------------------------------------------------------------
create table if not exists public.newsletter_subscribers (
  id                 uuid primary key default gen_random_uuid(),
  email              text not null,
  first_name         text not null,
  last_name          text,
  country            text,
  birthday           date,
  status             text not null default 'subscribed'
    check (status in ('pending', 'subscribed', 'unsubscribed', 'bounced', 'complained')),
  source             text not null default 'homepage'
    check (source in ('homepage', 'modal', 'footer', 'checkout', 'admin', 'import')),
  -- GDPR-style consent record: what they agreed to, when, and from where.
  consent            boolean not null default true,
  consent_at         timestamptz not null default now(),
  consent_text       text,
  ip_hash            text,
  user_agent         text,
  -- One-click unsubscribe without requiring a login.
  unsubscribe_token  uuid not null default gen_random_uuid(),
  confirmed_at       timestamptz,
  unsubscribed_at    timestamptz,
  last_emailed_at    timestamptz,
  -- Link to an account when the subscriber is also a registered customer.
  profile_id         uuid references public.profiles (id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- Case-insensitive uniqueness is what actually prevents duplicate signups.
create unique index if not exists newsletter_subscribers_email_key
  on public.newsletter_subscribers (lower(email));
create unique index if not exists newsletter_subscribers_token_key
  on public.newsletter_subscribers (unsubscribe_token);
create index if not exists newsletter_subscribers_status_idx
  on public.newsletter_subscribers (status);
create index if not exists newsletter_subscribers_created_idx
  on public.newsletter_subscribers (created_at desc);
create index if not exists newsletter_subscribers_country_idx
  on public.newsletter_subscribers (country);
create index if not exists newsletter_subscribers_source_idx
  on public.newsletter_subscribers (source);
create index if not exists newsletter_subscribers_profile_idx
  on public.newsletter_subscribers (profile_id);
-- Birthday automation looks up "whose birthday is today" regardless of year.
create index if not exists newsletter_subscribers_birthday_idx
  on public.newsletter_subscribers (
    (extract(month from birthday)), (extract(day from birthday))
  )
  where birthday is not null;
-- Rate limiting counts recent signups per IP.
create index if not exists newsletter_subscribers_ip_recent_idx
  on public.newsletter_subscribers (ip_hash, created_at desc);

-- Subscriber preferences (fashion interests) --------------------------------
create table if not exists public.newsletter_preferences (
  subscriber_id uuid not null
    references public.newsletter_subscribers (id) on delete cascade,
  interest      text not null
    check (interest in (
      'mens', 'womens', 'childrens', 'shoes', 'accessories', 'luxury'
    )),
  created_at    timestamptz not null default now(),
  primary key (subscriber_id, interest)
);

create index if not exists newsletter_preferences_interest_idx
  on public.newsletter_preferences (interest);

-- Reusable email templates ---------------------------------------------------
create table if not exists public.email_templates (
  id          uuid primary key default gen_random_uuid(),
  key         text not null unique,
  name        text not null,
  subject     text not null,
  html        text not null,
  text_body   text,
  description text,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists email_templates_active_idx
  on public.email_templates (is_active);

-- Campaigns ------------------------------------------------------------------
create table if not exists public.email_campaigns (
  id                 uuid primary key default gen_random_uuid(),
  name               text not null,
  subject            text not null,
  preheader          text,
  html               text,
  text_body          text,
  template_id        uuid references public.email_templates (id) on delete set null,
  status             text not null default 'draft'
    check (status in ('draft', 'scheduled', 'sending', 'sent', 'cancelled', 'failed')),
  -- Audience selection, e.g. {"interests":["womens"],"countries":["NG"]}.
  audience_filter    jsonb not null default '{}'::jsonb,
  scheduled_at       timestamptz,
  sent_at            timestamptz,
  provider           text,
  -- Denormalised counters kept in step by triggers on campaign_analytics, so
  -- the dashboard never has to aggregate the full event table.
  recipient_count    integer not null default 0,
  sent_count         integer not null default 0,
  open_count         integer not null default 0,
  click_count        integer not null default 0,
  conversion_count   integer not null default 0,
  bounce_count       integer not null default 0,
  unsubscribe_count  integer not null default 0,
  created_by         uuid references public.profiles (id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists email_campaigns_status_idx
  on public.email_campaigns (status);
create index if not exists email_campaigns_scheduled_idx
  on public.email_campaigns (scheduled_at)
  where status = 'scheduled';
create index if not exists email_campaigns_created_idx
  on public.email_campaigns (created_at desc);

-- Per-recipient analytics events ---------------------------------------------
create table if not exists public.campaign_analytics (
  id            uuid primary key default gen_random_uuid(),
  campaign_id   uuid not null
    references public.email_campaigns (id) on delete cascade,
  subscriber_id uuid
    references public.newsletter_subscribers (id) on delete set null,
  event         text not null
    check (event in (
      'queued', 'sent', 'delivered', 'opened', 'clicked',
      'bounced', 'complained', 'unsubscribed', 'converted'
    )),
  url           text,
  user_agent    text,
  ip_hash       text,
  meta          jsonb not null default '{}'::jsonb,
  occurred_at   timestamptz not null default now()
);

create index if not exists campaign_analytics_campaign_event_idx
  on public.campaign_analytics (campaign_id, event);
create index if not exists campaign_analytics_subscriber_idx
  on public.campaign_analytics (subscriber_id);
create index if not exists campaign_analytics_occurred_idx
  on public.campaign_analytics (occurred_at desc);
-- One "opened"/"clicked" row per subscriber per campaign keeps unique-rate
-- maths honest; repeat opens are counted via meta, not extra rows.
create unique index if not exists campaign_analytics_unique_engagement
  on public.campaign_analytics (campaign_id, subscriber_id, event)
  where event in ('opened', 'clicked', 'converted', 'unsubscribed');

-- Subscription audit trail ----------------------------------------------------
create table if not exists public.subscription_history (
  id            uuid primary key default gen_random_uuid(),
  subscriber_id uuid
    references public.newsletter_subscribers (id) on delete cascade,
  email         text not null,
  action        text not null
    check (action in (
      'subscribed', 'resubscribed', 'unsubscribed',
      'preferences_updated', 'imported', 'deleted', 'bounced'
    )),
  source        text,
  ip_hash       text,
  user_agent    text,
  meta          jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);

create index if not exists subscription_history_subscriber_idx
  on public.subscription_history (subscriber_id, created_at desc);
create index if not exists subscription_history_email_idx
  on public.subscription_history (lower(email));
create index if not exists subscription_history_action_idx
  on public.subscription_history (action);
-- Rate limiting reads recent attempts by IP from here.
create index if not exists subscription_history_ip_recent_idx
  on public.subscription_history (ip_hash, created_at desc);

-- Automation delivery log ------------------------------------------------------
create table if not exists public.automation_logs (
  id            uuid primary key default gen_random_uuid(),
  automation    text not null
    check (automation in (
      'welcome', 'birthday', 'new_collection', 'vip_invitation', 'flash_sale',
      'back_in_stock', 'style_guide', 'seasonal', 'abandoned_cart',
      'review_request', 'order_followup'
    )),
  subscriber_id uuid
    references public.newsletter_subscribers (id) on delete cascade,
  campaign_id   uuid references public.email_campaigns (id) on delete set null,
  provider      text,
  status        text not null default 'queued'
    check (status in ('queued', 'sent', 'failed', 'skipped')),
  error         text,
  payload       jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);

create index if not exists automation_logs_automation_idx
  on public.automation_logs (automation, created_at desc);
create index if not exists automation_logs_subscriber_idx
  on public.automation_logs (subscriber_id);
create index if not exists automation_logs_status_idx
  on public.automation_logs (status);
-- Guards against sending the same one-shot automation twice in a season.
create index if not exists automation_logs_dedupe_idx
  on public.automation_logs (subscriber_id, automation, created_at desc);

-- Keep campaign counters in step with the event stream ------------------------
create or replace function public.bump_campaign_counters()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
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

drop trigger if exists campaign_analytics_bump on public.campaign_analytics;
create trigger campaign_analytics_bump
  after insert on public.campaign_analytics
  for each row execute function public.bump_campaign_counters();

-- updated_at triggers ----------------------------------------------------------
drop trigger if exists newsletter_subscribers_set_updated_at
  on public.newsletter_subscribers;
create trigger newsletter_subscribers_set_updated_at
  before update on public.newsletter_subscribers
  for each row execute function public.set_updated_at();

drop trigger if exists email_templates_set_updated_at on public.email_templates;
create trigger email_templates_set_updated_at
  before update on public.email_templates
  for each row execute function public.set_updated_at();

drop trigger if exists email_campaigns_set_updated_at on public.email_campaigns;
create trigger email_campaigns_set_updated_at
  before update on public.email_campaigns
  for each row execute function public.set_updated_at();

-- RLS: service-role only, matching the color_requests precedent ----------------
alter table public.newsletter_subscribers enable row level security;
alter table public.newsletter_preferences enable row level security;
alter table public.email_templates        enable row level security;
alter table public.email_campaigns        enable row level security;
alter table public.campaign_analytics     enable row level security;
alter table public.subscription_history   enable row level security;
alter table public.automation_logs        enable row level security;
-- Intentionally no policies on any of the above.
