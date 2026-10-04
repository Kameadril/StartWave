create table public.cities (
  id text primary key,
  name text not null,
  name_en text,
  city_type text,
  status text not null default 'curated',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.cities enable row level security;

create table public.villages (
  id text primary key,
  name text not null,
  name_en text,
  village_type text,
  status text not null default 'curated',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.villages enable row level security;

create table public.knowledge (
  id text primary key,
  name text not null,
  name_en text,
  knowledge_type text,
  status text not null default 'curated',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.knowledge enable row level security;

create table public.monsters (
  id text primary key,
  name text not null,
  name_en text,
  monster_type text,
  status text not null default 'curated',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.monsters enable row level security;

create table public.people (
  id text primary key,
  name text not null,
  name_en text,
  person_type text,
  status text not null default 'curated',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.people enable row level security;
