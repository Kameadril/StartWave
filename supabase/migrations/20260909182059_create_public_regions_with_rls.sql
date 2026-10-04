create table public.regions (
  id text primary key,
  name text not null,
  name_en text,
  region_type text,
  status text not null default 'curated',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.regions enable row level security;
