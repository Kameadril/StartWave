create table public.item_external_identities (
  id bigint generated always as identity,
  item_id text not null,
  provider text not null,
  external_item_id text not null,
  source_name text not null,
  source_url text,
  checked_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint item_external_identities_pkey
    primary key (id),

  constraint item_external_identities_item_fk
    foreign key (item_id)
    references public.items(id)
    on update cascade
    on delete restrict,

  constraint item_external_identities_provider_external_key
    unique (provider, external_item_id),

  constraint item_external_identities_item_provider_key
    unique (item_id, provider),

  constraint item_external_identities_provider_canonical
    check (
      provider <> ''
      and provider = lower(btrim(provider))
    ),

  constraint item_external_identities_external_item_id_canonical
    check (
      external_item_id <> ''
      and external_item_id = btrim(external_item_id)
    ),

  constraint item_external_identities_source_name_not_blank
    check (btrim(source_name) <> ''),

  constraint item_external_identities_source_url_not_blank
    check (
      source_url is null
      or btrim(source_url) <> ''
    )
);

alter table public.item_external_identities
  enable row level security;

revoke all on table public.item_external_identities
  from public, anon, authenticated;

grant select on table public.item_external_identities
  to anon;

grant all privileges on table public.item_external_identities
  to service_role;

grant usage, select
  on sequence public.item_external_identities_id_seq
  to service_role;

create policy item_external_identities_public_items_read
  on public.item_external_identities
  for select
  to anon
  using (
    exists (
      select 1
      from public.items public_item
      where public_item.id = item_external_identities.item_id
        and public_item.status in ('curated', 'active')
    )
  );
