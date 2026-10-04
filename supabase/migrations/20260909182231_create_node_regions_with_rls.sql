create table public.node_regions (
  node_id text not null,
  region_id text not null,
  created_at timestamptz not null default now(),
  constraint node_regions_pkey primary key (node_id, region_id),
  constraint node_regions_node_fk foreign key (node_id)
    references public.nodes(id)
    on update cascade
    on delete restrict,
  constraint node_regions_region_fk foreign key (region_id)
    references public.regions(id)
    on update cascade
    on delete restrict
);

alter table public.node_regions enable row level security;
