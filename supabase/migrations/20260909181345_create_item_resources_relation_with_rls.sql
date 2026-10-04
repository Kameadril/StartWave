create table public.item_resources (
  item_id text not null,
  resource_id text not null,
  created_at timestamptz not null default now(),
  primary key (item_id, resource_id),
  constraint item_resources_item_fk
    foreign key (item_id)
    references public.items(id)
    on update cascade
    on delete restrict,
  constraint item_resources_resource_fk
    foreign key (resource_id)
    references public.resources(id)
    on update cascade
    on delete restrict
);

alter table public.item_resources enable row level security;
