create table public.nodes (
  id text primary key,
  name text not null,
  name_en text,
  node_type text,
  status text not null default 'curated',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.nodes enable row level security;
