create index if not exists cities_region_id_idx
  on public.cities (region_id);

create index if not exists item_resources_resource_id_idx
  on public.item_resources (resource_id);

create index if not exists node_regions_region_id_idx
  on public.node_regions (region_id);

create index if not exists resource_nodes_node_id_idx
  on public.resource_nodes (node_id);
