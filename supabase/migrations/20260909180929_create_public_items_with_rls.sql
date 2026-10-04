create table public.items (
  id text primary key,
  name text not null,
  name_en text,
  category text,
  item_type text,
  status text not null default 'curated',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.items enable row level security;
