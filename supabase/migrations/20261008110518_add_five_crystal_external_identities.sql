with approved_mapping (item_id, external_item_id, source_url) as (
  values
    ('SW-ITEM-092', '4408', 'https://bdocodex.com/ru/item/4408/'),
    ('SW-ITEM-093', '4412', 'https://bdocodex.com/ru/item/4412/'),
    ('SW-ITEM-094', '4411', 'https://bdocodex.com/ru/item/4411/'),
    ('SW-ITEM-095', '4413', 'https://bdocodex.com/ru/item/4413/'),
    ('SW-ITEM-096', '4414', 'https://bdocodex.com/ru/item/4414/')
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
