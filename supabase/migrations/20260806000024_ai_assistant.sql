-- Fancy Finery — AI concierge.
--
-- Two tables, admin-managed, read server-side only:
--   ai_settings  — a single row (id = 'default') holding the assistant's on/off
--                  switch, persona, welcome copy, suggested questions, quick
--                  actions, and model. Enforced-singleton via the id check.
--   ai_faqs      — curated Q&A the assistant is grounded on, so answers about
--                  policy come from the house, not the model's imagination.
--
-- RLS on, admin-only policies. The public chat route reads these through the
-- service-role client (which bypasses RLS), so no public policy is needed.

create table if not exists public.ai_settings (
  id                  text primary key default 'default'
                        check (id = 'default'),
  enabled             boolean not null default false,
  welcome_message     text not null default
    'Welcome to Fancy Finery. I''m your personal concierge — ask me about our pieces, sizing, fabrics, shipping, or anything else.',
  persona             text not null default
    'You are the personal shopping concierge for Fancy Finery, a luxury fashion house. Speak with warm, refined elegance — poised and concise, never pushy. You are knowledgeable about style, fit, and fabric.',
  model               text not null default 'claude-opus-5',
  suggested_questions jsonb not null default
    '["What''s new this season?","Help me choose the right size","What are your shipping options?","What''s your return policy?"]'::jsonb,
  quick_actions       jsonb not null default
    '[{"label":"Shop Collections","href":"/collections"},{"label":"Track Order","href":"/account"},{"label":"Shipping Info","href":"/shipping"},{"label":"Contact Support","href":"/contact"}]'::jsonb,
  human_handoff       boolean not null default false,
  handoff_message     text not null default
    'I''ll connect you with our team — please reach us at the contact page and we''ll be delighted to help personally.',
  updated_at          timestamptz not null default now()
);

-- Seed the single settings row (disabled until an API key is set + admin opts in).
insert into public.ai_settings (id) values ('default')
on conflict (id) do nothing;

create table if not exists public.ai_faqs (
  id         uuid primary key default gen_random_uuid(),
  question   text not null,
  answer     text not null,
  sort_order integer not null default 0,
  enabled    boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists ai_faqs_order_idx on public.ai_faqs (enabled, sort_order);

alter table public.ai_settings enable row level security;
alter table public.ai_faqs     enable row level security;

drop policy if exists ai_settings_admin_all on public.ai_settings;
create policy ai_settings_admin_all on public.ai_settings
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists ai_faqs_admin_all on public.ai_faqs;
create policy ai_faqs_admin_all on public.ai_faqs
  for all using (public.is_admin()) with check (public.is_admin());
