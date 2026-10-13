with approved_mapping (item_id, external_item_id, source_url) as (
  values
    ('SW-ITEM-132', '7019', 'https://bdocodex.com/ru/item/7019/'),
    ('SW-ITEM-134', '5801', 'https://bdocodex.com/ru/item/5801/'),
    ('SW-ITEM-138', '5008', 'https://bdocodex.com/ru/item/5008/'),
    ('SW-ITEM-139', '4612', 'https://bdocodex.com/ru/item/4612/')
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
