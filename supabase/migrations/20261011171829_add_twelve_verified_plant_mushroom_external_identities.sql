with approved_mapping (item_id, external_item_id, source_url) as (
  values
    ('SW-ITEM-077', '5006', 'https://bdocodex.com/ru/item/5006/'),
    ('SW-ITEM-078', '5407', 'https://bdocodex.com/ru/item/5407/'),
    ('SW-ITEM-079', '5408', 'https://bdocodex.com/ru/item/5408/'),
    ('SW-ITEM-080', '5410', 'https://bdocodex.com/ru/item/5410/'),
    ('SW-ITEM-081', '5405', 'https://bdocodex.com/ru/item/5405/'),
    ('SW-ITEM-082', '5412', 'https://bdocodex.com/ru/item/5412/'),
    ('SW-ITEM-083', '5413', 'https://bdocodex.com/ru/item/5413/'),
    ('SW-ITEM-084', '5432', 'https://bdocodex.com/ru/item/5432/'),
    ('SW-ITEM-085', '5411', 'https://bdocodex.com/ru/item/5411/'),
    ('SW-ITEM-086', '5430', 'https://bdocodex.com/ru/item/5430/'),
    ('SW-ITEM-087', '5532', 'https://bdocodex.com/ru/item/5532/'),
    ('SW-ITEM-088', '5404', 'https://bdocodex.com/ru/item/5404/')
)
insert into public.item_external_identities (
  item_id,
  provider,
  external_item_id,
  source_name,
  source_url,
  checked_at
)
select
  item_id,
  'bdo',
  external_item_id,
  'BDO Codex',
  source_url,
  statement_timestamp()
from approved_mapping;
