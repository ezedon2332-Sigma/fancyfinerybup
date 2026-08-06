-- Fancy Finery — AI concierge: conversation persistence, human handoff, and a
-- knowledge base (full-text retrieval).
--
-- All four tables are admin-only under RLS; the public chat + messages routes
-- reach them through the service-role client and gate the customer on an
-- unguessable per-conversation token, so an anonymous shopper can only ever see
-- their own thread.

-- Conversations -------------------------------------------------------------
create table if not exists public.ai_conversations (
  id              uuid primary key default gen_random_uuid(),
  -- The customer's bearer secret (kept client-side). Not enumerable.
  token           uuid not null unique default gen_random_uuid(),
  user_id         uuid references public.profiles (id) on delete set null,
  contact_email   text,
  -- bot: the assistant is answering. awaiting_human: escalated, no agent yet.
  -- human: a staff member is replying. closed: ended.
  status          text not null default 'bot'
                    check (status in ('bot', 'awaiting_human', 'human', 'closed')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  last_message_at timestamptz not null default now()
);

create index if not exists ai_conversations_status_idx
  on public.ai_conversations (status, last_message_at desc);

create table if not exists public.ai_messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.ai_conversations (id) on delete cascade,
  -- 'agent' = a human staff reply; 'system' = internal notes.
  role            text not null check (role in ('user', 'assistant', 'agent', 'system')),
  content         text not null,
  created_at      timestamptz not null default now()
);

create index if not exists ai_messages_conversation_idx
  on public.ai_messages (conversation_id, created_at);

-- Knowledge base ------------------------------------------------------------
create table if not exists public.knowledge_documents (
  id         uuid primary key default gen_random_uuid(),
  title      text not null,
  content    text not null,
  enabled    boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.knowledge_chunks (
  id          uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.knowledge_documents (id) on delete cascade,
  content     text not null,
  -- Generated full-text vector — retrieval is FTS ranking, no external
  -- embeddings provider required. (Swap to pgvector later if you add one.)
  tsv         tsvector generated always as (to_tsvector('english', content)) stored,
  created_at  timestamptz not null default now()
);

create index if not exists knowledge_chunks_tsv_idx
  on public.knowledge_chunks using gin (tsv);
create index if not exists knowledge_chunks_doc_idx
  on public.knowledge_chunks (document_id);

-- RLS: admin-only; the public routes use the service-role client (RLS bypass)
-- and enforce the per-conversation token themselves.
alter table public.ai_conversations   enable row level security;
alter table public.ai_messages         enable row level security;
alter table public.knowledge_documents enable row level security;
alter table public.knowledge_chunks    enable row level security;

drop policy if exists ai_conversations_admin on public.ai_conversations;
create policy ai_conversations_admin on public.ai_conversations
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists ai_messages_admin on public.ai_messages;
create policy ai_messages_admin on public.ai_messages
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists knowledge_documents_admin on public.knowledge_documents;
create policy knowledge_documents_admin on public.knowledge_documents
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists knowledge_chunks_admin on public.knowledge_chunks;
create policy knowledge_chunks_admin on public.knowledge_chunks
  for all using (public.is_admin()) with check (public.is_admin());
