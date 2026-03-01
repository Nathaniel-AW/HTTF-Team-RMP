create extension if not exists vector;

create table if not exists professors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  school text,
  department text,
  rmp_url text unique not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists reviews (
  id uuid primary key default gen_random_uuid(),
  professor_id uuid not null references professors(id) on delete cascade,
  review_text text not null,
  rating_overall numeric,
  rating_difficulty numeric,
  created_at timestamptz not null default now()
);

create table if not exists external_sources (
  id uuid primary key default gen_random_uuid(),
  professor_id uuid not null references professors(id) on delete cascade,
  url text not null,
  domain text not null,
  title text,
  retrieved_at timestamptz not null default now(),
  status text not null check (status in ('fetched', 'failed', 'blocked')),
  content_hash text,
  created_at timestamptz not null default now()
);

create unique index if not exists external_sources_professor_url_idx
  on external_sources (professor_id, url);

create table if not exists external_chunks (
  id uuid primary key default gen_random_uuid(),
  source_id uuid references external_sources(id) on delete cascade,
  professor_id uuid not null references professors(id) on delete cascade,
  chunk_index int not null,
  chunk_text text not null,
  embedding vector(1536),
  created_at timestamptz not null default now()
);

create index if not exists external_chunks_professor_idx
  on external_chunks (professor_id);

create table if not exists professor_outputs (
  id uuid primary key default gen_random_uuid(),
  professor_id uuid not null references professors(id) on delete cascade,
  summary text not null,
  score_total numeric not null,
  score_reviews numeric not null,
  score_profile numeric not null,
  achievements_json jsonb not null default '[]'::jsonb,
  citations_json jsonb not null default '[]'::jsonb,
  model text,
  generated_at timestamptz not null default now()
);

create index if not exists professor_outputs_professor_generated_idx
  on professor_outputs (professor_id, generated_at desc);

create table if not exists chat_sessions (
  id uuid primary key default gen_random_uuid(),
  professor_id uuid not null references professors(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists chat_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references chat_sessions(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  created_at timestamptz not null default now()
);

create or replace function match_external_chunks(
  query_embedding vector(1536),
  target_professor_id uuid,
  match_count int default 10
)
returns table (
  id uuid,
  source_id uuid,
  professor_id uuid,
  chunk_index int,
  chunk_text text,
  similarity float
)
language sql stable as $$
  select
    external_chunks.id,
    external_chunks.source_id,
    external_chunks.professor_id,
    external_chunks.chunk_index,
    external_chunks.chunk_text,
    1 - (external_chunks.embedding <=> query_embedding) as similarity
  from external_chunks
  where external_chunks.professor_id = target_professor_id
    and external_chunks.embedding is not null
  order by external_chunks.embedding <=> query_embedding
  limit greatest(match_count, 1);
$$;
