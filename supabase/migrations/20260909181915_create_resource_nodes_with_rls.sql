create table public.resource_nodes (
  resource_id text not null,
  node_id text not null,
  created_at timestamptz not null default now(),
  constraint resource_nodes_pkey primary key (resource_id, node_id),
  constraint resource_nodes_resource_fk foreign key (resource_id) references public.resources(id) on update cascade on delete restrict,
  constraint resource_nodes_node_fk foreign key (node_id) references public.nodes(id) on update cascade on delete restrict
);

alter table public.resource_nodes enable row level security;
